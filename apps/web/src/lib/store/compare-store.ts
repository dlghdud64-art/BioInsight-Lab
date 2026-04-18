/**
 * 비교 대상 스토어 — Single Source of Truth
 *
 * 모든 비교 관련 UI(검색 결과 배지, 상단 비교 바, 비교 페이지)가
 * 이 스토어의 productIds를 참조한다.
 *
 * Flow scope: /search, /search, /search 에서만 활성.
 * 다른 메뉴(/dashboard 등)로 이동 시 stash로 대피 → 플로우 재진입 시 복원 제안.
 *
 * localStorage key: "compare-storage"
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";

interface ProductMeta {
  name: string;
  brand?: string;
}

interface CompareState {
  /** 비교 대상 제품 ID 목록 (최대 5개) */
  productIds: string[];
  /** 제품 ID → 이름/브랜드 매핑 (표시용) */
  productMeta: Record<string, ProductMeta>;
  /** stash: 플로우 이탈 시 대피한 데이터 */
  _stashedIds: string[];
  _stashedMeta: Record<string, ProductMeta>;
  /** 비교 대상에 추가 (meta 전달 시 이름 저장) */
  addProduct: (productId: string, meta?: ProductMeta) => void;
  /** 비교 대상에서 개별 제거 */
  removeProduct: (productId: string) => void;
  /** 비교 대상 전체 비우기 */
  clearProducts: () => void;
  /** 비교 대상 포함 여부 확인 */
  hasProduct: (productId: string) => boolean;
  /** 제품 표시명 조회 */
  getDisplayName: (productId: string) => string;
  /** 현재 상태를 stash로 대피 후 비우기 */
  stashAndClear: () => void;
  /** stash에서 복원 */
  restoreFromStash: () => void;
  /** stash 비우기 (복원하지 않고 폐기) */
  clearStash: () => void;
  /** stash에 데이터가 있는지 */
  hasStash: () => boolean;
  /** Supabase에서 비교함 복원 */
  fetchComparisons: () => Promise<void>;
  /** Supabase에 비교 항목 동기화 저장 */
  syncToSupabase: (productId: string, meta?: ProductMeta) => Promise<void>;
  /** Supabase에서 비교 항목 삭제 */
  removeFromSupabase: (productId: string) => Promise<void>;
}

/** 플로우 경로 판별 (search / compare / quote) */
export function isFlowPath(pathname: string): boolean {
  return /^\/test\/(search|compare|quote)(\/.*)?$/.test(pathname);
}

/**
 * 전체 workbench 임시 상태 초기화 (logout 시 호출)
 *
 * clear 대상:
 *  - compare store: productIds, productMeta, stash
 *  - quote-draft store
 *  - ai-suggestion store
 *  - localStorage 키: compare-storage, quote-draft-storage
 *
 * 명시적으로 save된 데이터(DB 영속)는 건드리지 않음.
 */
export function clearAllWorkbenchState() {
  // 1. compare store 초기화
  useCompareStore.getState().clearProducts();
  useCompareStore.getState().clearStash();

  // 2. localStorage 직접 제거 (persist middleware가 hydrate로 복원하는 것 방지)
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("compare-storage");
    window.localStorage.removeItem("quote-draft-storage");
  }
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      productIds: [],
      productMeta: {},
      _stashedIds: [],
      _stashedMeta: {},
      addProduct: (productId: string, meta?: ProductMeta) => {
        const { productIds, productMeta } = get();
        if (productIds.length >= 5) {
          alert("최대 5개까지 비교할 수 있습니다.");
          return;
        }
        if (!productIds.includes(productId)) {
          set({
            productIds: [...productIds, productId],
            ...(meta ? { productMeta: { ...productMeta, [productId]: meta } } : {}),
          });
        } else if (meta && !productMeta[productId]) {
          // 이미 추가되었지만 meta가 없으면 보충
          set({ productMeta: { ...productMeta, [productId]: meta } });
        }
      },
      removeProduct: (productId: string) => {
        const { productMeta } = get();
        const { [productId]: _, ...remainingMeta } = productMeta;
        set({
          productIds: get().productIds.filter((id) => id !== productId),
          productMeta: remainingMeta,
        });
      },
      clearProducts: () => {
        set({ productIds: [], productMeta: {} });
      },
      hasProduct: (productId: string) => {
        return get().productIds.includes(productId);
      },
      getDisplayName: (productId: string) => {
        const meta = get().productMeta[productId];
        return meta?.name || meta?.brand || "";
      },
      stashAndClear: () => {
        const { productIds, productMeta } = get();
        if (productIds.length === 0) return; // 빈 상태면 stash 불필요
        set({
          _stashedIds: productIds,
          _stashedMeta: productMeta,
          productIds: [],
          productMeta: {},
        });
      },
      restoreFromStash: () => {
        const { _stashedIds, _stashedMeta } = get();
        set({
          productIds: _stashedIds,
          productMeta: _stashedMeta,
          _stashedIds: [],
          _stashedMeta: {},
        });
      },
      clearStash: () => {
        set({ _stashedIds: [], _stashedMeta: {} });
      },
      hasStash: () => {
        return get()._stashedIds.length > 0;
      },

      // ── Supabase 연동 ──
      fetchComparisons: async () => {
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData?.user?.id) return;
          const { data, error } = await supabase
            .from("comparisons")
            .select("*")
            .eq("user_id", userData.user.id)
            .order("added_at", { ascending: false });
          if (error || !data) return;
          const ids = data.map((r: Record<string, unknown>) => r.product_id as string);
          const meta: Record<string, ProductMeta> = {};
          for (const r of data as Record<string, unknown>[]) {
            if (r.product_name || r.product_brand) {
              meta[r.product_id as string] = {
                name: (r.product_name as string) || "",
                brand: (r.product_brand as string) || undefined,
              };
            }
          }
          const { productIds: localIds, productMeta: localMeta } = get();
          const mergedIds = Array.from(new Set([...ids, ...localIds])).slice(0, 5);
          set({ productIds: mergedIds, productMeta: { ...meta, ...localMeta } });
        } catch (err) {
          console.warn("[compare-store] fetchComparisons 실패:", err);
        }
      },

      syncToSupabase: async (productId: string, meta?: ProductMeta) => {
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData?.user?.id) return;
          await supabase.from("comparisons").upsert(
            { user_id: userData.user.id, product_id: productId, product_name: meta?.name || null, product_brand: meta?.brand || null },
            { onConflict: "user_id,product_id" },
          );
        } catch (err) {
          console.warn("[compare-store] syncToSupabase 실패:", err);
        }
      },

      removeFromSupabase: async (productId: string) => {
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData?.user?.id) return;
          await supabase.from("comparisons").delete().eq("user_id", userData.user.id).eq("product_id", productId);
        } catch (err) {
          console.warn("[compare-store] removeFromSupabase 실패:", err);
        }
      },
    }),
    {
      name: "compare-storage",
    }
  )
);