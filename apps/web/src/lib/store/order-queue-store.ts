/**
 * Order Queue Store — Ontology 기반 주문 큐 관리
 *
 * Zustand + Supabase + Ontology Action Layer 통합.
 * CRUD가 아닌 비즈니스 Action(FinalizeApproval, ReceiveOrder)을 통해 상태 전이.
 *
 * Object Link Graph:
 * - Order → Budget (budgetId FK, 승인 시 예산 소진 자동 업데이트)
 * - Order → Inventory (inventoryId FK, 수령 시 재고 자동 반영)
 *
 * Flow scope: /dashboard/orders 에서 활성.
 */
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import {
  executeFinalizeApproval,
  executeReceiveOrder,
  type FinalizeApprovalInput,
  type FinalizeApprovalOutput,
  type ReceiveOrderInput,
  type ReceiveOrderOutput,
} from "@/lib/ontology/actions/cross-object-actions";
import type { ActionResult } from "@/lib/ontology/actions";
import type { POBusinessStatus, BudgetRiskLevel } from "@/lib/ontology/types";

// ══════════════════════════════════════════════════════════════════════════════
// Order Queue Domain Types
// ══════════════════════════════════════════════════════════════════════════════

export interface OrderQueueItem {
  id: string;
  /** PO 번호 */
  poNumber: string;
  /** 제품 정보 */
  productId: string;
  productName: string;
  /** 공급사 */
  vendorId: string;
  vendorName: string;
  /** 수량/금액 */
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  /** 상태 */
  status: POBusinessStatus;
  /** 요청/승인자 */
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  /** Object Link — Budget */
  budgetId: string | null;
  budgetName: string | null;
  /** Object Link — Inventory */
  inventoryId: string | null;
  /** 수령 정보 */
  receivedBy: string | null;
  receivedAt: string | null;
  receivedQuantity: number | null;
  expectedQuantity: number | null;
  /** 타임스탬프 */
  createdAt: string;
  updatedAt: string;
  /** Computed Properties — domain 레벨 계산 */
  computed: OrderComputedProps;
}

export interface OrderComputedProps {
  /** 다음 필요 작업 */
  nextAction: string;
  /** 상태 표시 색상 */
  statusColor: "gray" | "blue" | "amber" | "green" | "red" | "purple";
  /** 연결된 예산 소진율 */
  budgetBurnRate: number | null;
  /** 예산 위험 수준 */
  budgetRiskLevel: BudgetRiskLevel | null;
  /** 물품 수령 가능 여부 */
  canReceive: boolean;
  /** 승인 가능 여부 */
  canApprove: boolean;
  /** 발송 가능 여부 */
  canDispatch: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// Supabase Row → OrderQueueItem Mapper
// ══════════════════════════════════════════════════════════════════════════════

interface SupabaseOrderRow {
  id: string;
  po_number: string;
  product_id: string;
  product_name: string;
  vendor_id: string;
  vendor_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_amount: number;
  currency: string;
  status: string;
  requested_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  budget_id?: string | null;
  budget_name?: string | null;
  inventory_id?: string | null;
  received_by?: string | null;
  received_at?: string | null;
  received_quantity?: number | null;
  expected_quantity?: number | null;
  created_at: string;
  updated_at: string;
  // joined budget data
  budget_amount?: number | null;
  budget_total_spent?: number | null;
  budget_burn_rate?: number | null;
  budget_status?: string | null;
}

function computeStatusColor(status: string): OrderComputedProps["statusColor"] {
  switch (status) {
    case "draft": return "gray";
    case "pending_approval": return "amber";
    case "approved":
    case "po_created": return "blue";
    case "ready_to_send":
    case "dispatch_prep": return "purple";
    case "sent":
    case "confirmed": return "green";
    case "received":
    case "completed": return "green";
    case "cancelled":
    case "receiving_rejected": return "red";
    default: return "gray";
  }
}

function computeNextAction(status: string): string {
  switch (status) {
    case "draft": return "견적 요청 제출";
    case "pending_approval": return "승인 대기 중";
    case "approved": return "발송 준비 시작";
    case "po_created": return "Dispatch 준비";
    case "dispatch_prep": return "발송 검증 완료 필요";
    case "ready_to_send": return "공급사 발송 실행";
    case "sent": return "공급사 확인 대기";
    case "confirmed": return "물품 수령 대기";
    case "received": return "재고 확인";
    case "completed": return "완료";
    case "cancelled": return "취소됨";
    default: return "상태 확인 필요";
  }
}

function mapRowToOrderItem(row: SupabaseOrderRow): OrderQueueItem {
  const status = row.status as POBusinessStatus;
  const canReceive = ["sent", "confirmed", "approved", "dispatched"].includes(status);
  const canApprove = status === "pending_approval";
  const canDispatch = status === "approved" || status === "po_created";

  const budgetBurnRate = row.budget_burn_rate ?? (
    row.budget_amount && row.budget_total_spent
      ? (row.budget_total_spent / row.budget_amount) * 100
      : null
  );

  let budgetRiskLevel: BudgetRiskLevel | null = null;
  if (row.budget_status) {
    budgetRiskLevel = row.budget_status as BudgetRiskLevel;
  } else if (budgetBurnRate !== null) {
    if (budgetBurnRate > 100) budgetRiskLevel = "over";
    else if (budgetBurnRate >= 80) budgetRiskLevel = "critical";
    else if (budgetBurnRate >= 60) budgetRiskLevel = "warning";
    else budgetRiskLevel = "safe";
  }

  return {
    id: row.id,
    poNumber: row.po_number,
    productId: row.product_id,
    productName: row.product_name,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unit_price,
    totalAmount: row.total_amount,
    currency: row.currency,
    status,
    requestedBy: row.requested_by,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
    budgetId: row.budget_id ?? null,
    budgetName: row.budget_name ?? null,
    inventoryId: row.inventory_id ?? null,
    receivedBy: row.received_by ?? null,
    receivedAt: row.received_at ?? null,
    receivedQuantity: row.received_quantity ?? null,
    expectedQuantity: row.expected_quantity ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    computed: {
      nextAction: computeNextAction(status),
      statusColor: computeStatusColor(status),
      budgetBurnRate: budgetBurnRate !== null ? Math.round(budgetBurnRate * 100) / 100 : null,
      budgetRiskLevel,
      canReceive,
      canApprove,
      canDispatch,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════════════════════════════════════

interface OrderQueueState {
  orders: OrderQueueItem[];
  isFetching: boolean;
  error: string | null;
  /** 마지막 Action 결과 (UI 피드백용) */
  lastActionResult: ActionResult<unknown> | null;

  // ── Fetch ──
  fetchOrders: () => Promise<void>;

  // ── Realtime ──
  /** Supabase Realtime 채널 구독. order_queue 변경 시 자동 refetch */
  subscribe: () => () => void;

  // ── Ontology Actions (CRUD가 아닌 비즈니스 액션) ──
  finalizeApproval: (input: FinalizeApprovalInput) => Promise<ActionResult<FinalizeApprovalOutput>>;
  receiveOrder: (input: ReceiveOrderInput) => Promise<ActionResult<ReceiveOrderOutput>>;

  // ── Local state ──
  clearError: () => void;
  clearLastActionResult: () => void;
}

export const useOrderQueueStore = create<OrderQueueState>((set, get) => ({
  orders: [],
  isFetching: true,
  error: null,
  lastActionResult: null,

  // ── Fetch: Supabase에서 order_queue + budget join ──
  fetchOrders: async () => {
    set({ isFetching: true, error: null });
    try {
      const { data, error } = await supabase
        .from("order_queue")
        .select(`
          *,
          budgets:budget_id (
            amount,
            total_spent,
            burn_rate,
            status
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[order-queue-store] Supabase 조회 실패:", error.message);
        set({ isFetching: false, error: "주문 목록 조회 실패" });
        return;
      }

      const orders = ((data ?? []) as any[]).map((row) => {
        const budget = row.budgets;
        return mapRowToOrderItem({
          ...row,
          budget_amount: budget?.amount ?? null,
          budget_total_spent: budget?.total_spent ?? null,
          budget_burn_rate: budget?.burn_rate ?? null,
          budget_status: budget?.status ?? null,
        });
      });

      set({ orders, isFetching: false });
    } catch (err) {
      console.error("[order-queue-store] fetchOrders error:", err);
      set({ isFetching: false, error: "주문 데이터를 불러올 수 없습니다." });
    }
  },

  // ── FinalizeApproval: 승인 + 예산 소진 (ontology action 경유) ──
  finalizeApproval: async (input) => {
    set({ error: null });
    const result = await executeFinalizeApproval(input);
    set({ lastActionResult: result as ActionResult<unknown> });

    if (result.success) {
      // 로컬 상태 반영 (서버 동기화 후 fetch로 보정)
      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === input.orderId
            ? {
                ...o,
                status: "approved" as POBusinessStatus,
                approvedBy: input.approvedBy,
                approvedAt: new Date().toISOString(),
                computed: {
                  ...o.computed,
                  nextAction: "발송 준비 시작",
                  statusColor: "blue" as const,
                  canApprove: false,
                  canDispatch: true,
                  budgetBurnRate: result.data?.budgetUpdate?.newBurnRate ?? o.computed.budgetBurnRate,
                },
              }
            : o,
        ),
      }));
    } else {
      set({ error: result.error?.message ?? "승인 처리 실패" });
    }

    return result;
  },

  // ── ReceiveOrder: 수령 + 재고 반영 (ontology action 경유) ──
  receiveOrder: async (input) => {
    set({ error: null });
    const result = await executeReceiveOrder(input);
    set({ lastActionResult: result as ActionResult<unknown> });

    if (result.success && result.data) {
      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === input.orderId
            ? {
                ...o,
                status: result.data!.newStatus as POBusinessStatus,
                receivedBy: input.receivedBy,
                receivedAt: new Date().toISOString(),
                receivedQuantity: input.receivedQuantity,
                inventoryId: result.data!.inventoryUpdate.inventoryId,
                computed: {
                  ...o.computed,
                  nextAction: "재고 확인",
                  statusColor: "green" as const,
                  canReceive: false,
                },
              }
            : o,
        ),
      }));
    } else {
      set({ error: result.error?.message ?? "수령 처리 실패" });
    }

    return result;
  },

  // ── Realtime: Supabase postgres_changes 채널 구독 ──
  subscribe: () => {
    const channel = supabase
      .channel("order-queue-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_queue" },
        () => {
          // 변경 감지 시 전체 refetch (join 데이터 포함)
          get().fetchOrders();
        },
      )
      .subscribe();

    // cleanup 함수 반환 (useEffect에서 사용)
    return () => {
      supabase.removeChannel(channel);
    };
  },

  clearError: () => set({ error: null }),
  clearLastActionResult: () => set({ lastActionResult: null }),
}));
