/**
 * Inventory Store — Ontology 기반 재고 관리
 *
 * Zustand + Supabase + Ontology mapper 통합.
 * InventoryObject(Domain Object)를 사용하여 DB 종속 제거.
 *
 * Object Link Graph:
 * - Inventory → Product (productId, 제품 참조)
 * - Inventory ← Order (수령 시 재고 수량 자동 반영)
 * - Inventory → ReorderDecision (재주문점 도달 시 자동 트리거)
 *
 * Flow scope: /dashboard/inventory 에서 활성.
 */
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import {
  mapInventoryRowToObject,
  type SupabaseInventoryRow,
} from "@/lib/ontology/mappers";
import type { InventoryObject, InventoryStockStatus } from "@/lib/ontology/types";

// ══════════════════════════════════════════════════════════════════════════════
// Computed Properties (domain 레벨)
// ══════════════════════════════════════════════════════════════════════════════

export interface InventoryWithComputed extends InventoryObject {
  computed: InventoryComputedProps;
}

export interface InventoryComputedProps {
  /** 상태 표시 색상 */
  statusColor: "green" | "amber" | "red" | "gray" | "purple";
  /** 다음 필요 작업 */
  nextAction: string;
  /** 재주문 필요 여부 */
  needsReorder: boolean;
  /** 유효기간 경고 (30일 이내 만료) */
  expiryWarning: boolean;
  /** 사용률 (%) */
  utilizationRate: number;
}

function computeInventoryProps(item: InventoryObject): InventoryComputedProps {
  // 상태 색상
  const colorMap: Record<InventoryStockStatus, InventoryComputedProps["statusColor"]> = {
    in_stock: "green",
    low_stock: "amber",
    out_of_stock: "red",
    expired: "red",
    reserved: "purple",
    on_order: "gray",
  };

  // 다음 작업
  const actionMap: Record<InventoryStockStatus, string> = {
    in_stock: "정상",
    low_stock: "재주문 검토 필요",
    out_of_stock: "긴급 발주 필요",
    expired: "폐기 처리 필요",
    reserved: "예약 확인",
    on_order: "입고 대기 중",
  };

  // 재주문 판단
  const needsReorder =
    item.reorderPoint !== null &&
    item.availableQuantity <= item.reorderPoint &&
    item.stockStatus !== "on_order";

  // 유효기간 경고 (30일 이내)
  let expiryWarning = false;
  if (item.expiryDate) {
    const daysUntilExpiry = Math.floor(
      (new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    expiryWarning = daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  }

  // 사용률
  const total = item.currentQuantity + item.reservedQuantity;
  const utilizationRate = total > 0
    ? Math.round((item.reservedQuantity / total) * 100)
    : 0;

  return {
    statusColor: colorMap[item.stockStatus] ?? "gray",
    nextAction: actionMap[item.stockStatus] ?? "상태 확인",
    needsReorder,
    expiryWarning,
    utilizationRate,
  };
}

function enrichWithComputed(item: InventoryObject): InventoryWithComputed {
  return { ...item, computed: computeInventoryProps(item) };
}

// ══════════════════════════════════════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════════════════════════════════════

interface InventoryStoreState {
  items: InventoryWithComputed[];
  isFetching: boolean;
  error: string | null;
  searchQuery: string;
  filterStatus: InventoryStockStatus | "all";

  // ── Actions ──
  fetchInventory: () => Promise<void>;
  /** Supabase Realtime 구독. inventory 변경 시 자동 refetch */
  subscribe: () => () => void;
  setSearchQuery: (q: string) => void;
  setFilterStatus: (status: InventoryStockStatus | "all") => void;

  // ── Selectors (computed) ──
  getFilteredItems: () => InventoryWithComputed[];
  getSummary: () => InventorySummary;

  // ── Ontology-driven mutations ──
  refreshItemAfterReceiving: (inventoryId: string) => Promise<void>;
  clearError: () => void;
}

export interface InventorySummary {
  totalItems: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiredCount: number;
  needsReorderCount: number;
  expiryWarningCount: number;
  totalValue: number;
}

export const useInventoryStore = create<InventoryStoreState>((set, get) => ({
  items: [],
  isFetching: true,
  error: null,
  searchQuery: "",
  filterStatus: "all",

  // ── Fetch: Supabase → Ontology mapper → Computed Props ──
  fetchInventory: async () => {
    set({ isFetching: true, error: null });
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.warn("[inventory-store] Supabase 조회 실패:", error.message);
        set({ isFetching: false, error: "재고 목록 조회 실패" });
        return;
      }

      const items = ((data ?? []) as SupabaseInventoryRow[])
        .map(mapInventoryRowToObject)
        .map(enrichWithComputed);

      set({ items, isFetching: false });
    } catch (err) {
      console.error("[inventory-store] fetchInventory error:", err);
      set({ isFetching: false, error: "재고 데이터를 불러올 수 없습니다." });
    }
  },

  // ── Realtime: Supabase postgres_changes 구독 ──
  subscribe: () => {
    const channel = supabase
      .channel("inventory-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        () => {
          get().fetchInventory();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),

  // ── Filtered items selector ──
  getFilteredItems: () => {
    const { items, searchQuery, filterStatus } = get();
    let filtered = items;

    if (filterStatus !== "all") {
      filtered = filtered.filter((i) => i.stockStatus === filterStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.productName.toLowerCase().includes(q) ||
          (i.lotNumber && i.lotNumber.toLowerCase().includes(q)) ||
          (i.storageLocation && i.storageLocation.toLowerCase().includes(q)),
      );
    }

    return filtered;
  },

  // ── Summary selector ──
  getSummary: () => {
    const { items } = get();
    return {
      totalItems: items.length,
      inStockCount: items.filter((i) => i.stockStatus === "in_stock").length,
      lowStockCount: items.filter((i) => i.stockStatus === "low_stock").length,
      outOfStockCount: items.filter((i) => i.stockStatus === "out_of_stock").length,
      expiredCount: items.filter((i) => i.stockStatus === "expired").length,
      needsReorderCount: items.filter((i) => i.computed.needsReorder).length,
      expiryWarningCount: items.filter((i) => i.computed.expiryWarning).length,
      totalValue: 0, // Phase 3에서 단가 연동 후 계산
    };
  },

  // ── 수령 후 개별 재고 갱신 (targeted invalidation) ──
  refreshItemAfterReceiving: async (inventoryId: string) => {
    try {
      const { data } = await supabase
        .from("inventory")
        .select("*")
        .eq("id", inventoryId)
        .single();

      if (data) {
        const updated = enrichWithComputed(
          mapInventoryRowToObject(data as SupabaseInventoryRow),
        );

        set((state) => ({
          items: state.items.map((i) =>
            i.objectId === inventoryId ? updated : i,
          ),
        }));
      }
    } catch (err) {
      console.error("[inventory-store] refreshItem error:", err);
    }
  },

  clearError: () => set({ error: null }),
}));
