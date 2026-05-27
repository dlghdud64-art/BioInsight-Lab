/**
 * Ontology Action Layer — Phase 1
 *
 * 단순 CRUD(create/update/delete)가 아닌, 비즈니스 의미를 가진 Atomic Action 정의.
 * 각 Action은 pre-condition, post-condition, audit trail을 포함한다.
 *
 * 규칙:
 * 1. Action 이름은 "무엇을 하라"로 (governance-grammar-registry 명명 규칙 준수)
 * 2. CRUD 동사(create/update/delete) 금지 → 비즈니스 동사 사용
 * 3. 모든 Action은 ActionResult를 반환 (성공/실패 + audit trace)
 * 4. pre-condition 실패 시 Action은 실행되지 않음 (optimistic unlock 금지)
 * 5. AI가 Action Schema를 읽고 호출할 수 있도록 메타데이터 포함
 */

import type { OntologyObjectType } from "../types";

// ══════════════════════════════════════════════════════════════════════════════
// Action Contract — 모든 Action의 기본 구조
// ══════════════════════════════════════════════════════════════════════════════

export interface ActionContract<TInput, TOutput> {
  /** Action 고유 이름 (registry에 등록) */
  readonly actionName: string;
  /** 대상 Object 타입 */
  readonly targetObjectType: OntologyObjectType;
  /** 비즈니스 설명 (AI가 참조) */
  readonly description: string;
  /** 위험 수준 — ARCHITECTURE.md mutation boundary 준수 */
  readonly riskLevel: ActionRiskLevel;
  /** 비가역 여부 */
  readonly irreversible: boolean;
  /** pre-condition 검증 */
  checkPreconditions(input: TInput): PreconditionResult;
  /** 실행 */
  execute(input: TInput): Promise<ActionResult<TOutput>>;
}

export type ActionRiskLevel = "immediate" | "reviewed" | "governed" | "irreversible";

// ══════════════════════════════════════════════════════════════════════════════
// Pre-condition & Result
// ══════════════════════════════════════════════════════════════════════════════

export interface PreconditionResult {
  satisfied: boolean;
  violations: PreconditionViolation[];
}

export interface PreconditionViolation {
  code: string;
  message: string;
  severity: "hard" | "soft";
  /** soft violation은 사용자 확인 후 진행 가능 */
  canOverride: boolean;
}

export interface ActionResult<T> {
  success: boolean;
  data: T | null;
  error: ActionError | null;
  /** 감사 추적 */
  auditTrace: AuditTrace;
}

export interface ActionError {
  code: string;
  message: string;
  /** 복구 가능한 에러인지 */
  recoverable: boolean;
  /** 다음 추천 Action */
  suggestedAction: string | null;
}

export interface AuditTrace {
  actionName: string;
  executedAt: string;
  executedBy: string;
  targetObjectId: string;
  targetObjectType: OntologyObjectType;
  /** 변경 전 스냅샷 ID */
  snapshotBeforeId: string | null;
  /** 변경 후 스냅샷 ID */
  snapshotAfterId: string | null;
  /** 전이된 상태 */
  stateTransition: { from: string; to: string } | null;
  /** pre-condition 검증 결과 */
  preconditionSummary: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Concrete Action Definitions — Quote Domain
// ══════════════════════════════════════════════════════════════════════════════

/** 견적 요청서 제출 */
export interface SubmitQuoteRequestInput {
  quoteId: string;
  vendorIds: string[];
  requestedBy: string;
  budgetId: string | null;
  urgencyLevel: "normal" | "urgent" | "critical";
}

export interface SubmitQuoteRequestOutput {
  submittedQuoteId: string;
  sentToVendorCount: number;
  estimatedResponseDate: string | null;
}

/** 견적 후보 선정 */
export interface ShortlistQuoteInput {
  quoteId: string;
  selectedLineIds: string[];
  selectionReason: string;
  reviewedBy: string;
}

/** 견적 승인 */
export interface ApproveQuoteInput {
  quoteId: string;
  approvedBy: string;
  approvalComment: string | null;
  /** budget lock — 승인 시 예산 예약 */
  budgetReservation: {
    budgetId: string;
    amount: number;
    currency: string;
  } | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Concrete Action Definitions — PO Domain
// ══════════════════════════════════════════════════════════════════════════════

/** PO 전환 실행 (Quote → PO) */
export interface ConvertQuoteToPOInput {
  quoteId: string;
  approvedLineIds: string[];
  vendorId: string;
  convertedBy: string;
  budgetId: string;
  deliveryAddress: string | null;
  specialInstructions: string | null;
}

export interface ConvertQuoteToPOOutput {
  purchaseOrderId: string;
  poNumber: string;
  /** 다음 Action 힌트 */
  nextRequiredAction: "dispatch_preparation" | "pending_approval";
}

/** PO 발송 승인 (Dispatch Preparation → Send) */
export interface AuthorizeDispatchInput {
  poId: string;
  authorizedBy: string;
  /** 발송 일시 (즉시 or 예약) */
  sendMode: "immediate" | "scheduled";
  scheduledAt: string | null;
  /** 최종 확인 항목 */
  confirmations: {
    recipientVerified: boolean;
    payloadReviewed: boolean;
    attachmentsComplete: boolean;
    termsAccepted: boolean;
  };
}

export interface AuthorizeDispatchOutput {
  dispatchId: string;
  status: "queued_to_send" | "scheduled";
  estimatedSendAt: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Concrete Action Definitions — Budget Domain
// ══════════════════════════════════════════════════════════════════════════════

/** 예산 예약 (PO 승인 시) */
export interface ReserveBudgetInput {
  budgetId: string;
  poId: string;
  amount: number;
  currency: string;
  reservedBy: string;
}

export interface ReserveBudgetOutput {
  reservationId: string;
  remainingAvailable: number;
  newBurnRate: number;
}

/** 예산 확정 (PO 발송 확인 시) */
export interface CommitBudgetInput {
  budgetId: string;
  reservationId: string;
  committedBy: string;
}

/** 예산 해제 (PO 취소 시) */
export interface ReleaseBudgetInput {
  budgetId: string;
  reservationId: string;
  reason: string;
  releasedBy: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Concrete Action Definitions — Inventory Domain
// ══════════════════════════════════════════════════════════════════════════════

/** 재고 입고 기록 (Receiving → Inventory) */
export interface RecordStockReceiptInput {
  inventoryId: string;
  poId: string;
  receivedQuantity: number;
  unit: string;
  lotNumber: string | null;
  expiryDate: string | null;
  receivedBy: string;
  /** 검수 결과 */
  inspectionResult: "accepted" | "accepted_with_note" | "rejected";
  inspectionNote: string | null;
}

export interface RecordStockReceiptOutput {
  newAvailableQuantity: number;
  stockStatus: string;
  /** 재주문 트리거 여부 */
  reorderTriggered: boolean;
}

/** 재고 사용 기록 (Stock Release) */
export interface ReleaseStockInput {
  inventoryId: string;
  quantity: number;
  unit: string;
  purpose: string;
  releasedBy: string;
  releasedTo: string;
}

/** 재주문 판단 실행 */
export interface ExecuteReorderDecisionInput {
  inventoryId: string;
  decision: "reorder" | "no_action" | "defer";
  reorderQuantity: number | null;
  preferredVendorId: string | null;
  decidedBy: string;
  decisionReason: string;
}

export interface ExecuteReorderDecisionOutput {
  /** 재주문 시 생성된 Quote 요청 ID */
  newQuoteRequestId: string | null;
  /** 연결된 예산 ID */
  linkedBudgetId: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Action Registry Type — 모든 Action을 중앙 등록
// ══════════════════════════════════════════════════════════════════════════════

export interface ActionRegistryEntry {
  actionName: string;
  targetObjectType: OntologyObjectType;
  description: string;
  riskLevel: ActionRiskLevel;
  irreversible: boolean;
  /** 이 Action이 트리거하는 후속 이벤트 */
  emitsEvents: string[];
  /** 이 Action이 invalidation하는 대상 */
  invalidates: string[];
}

/**
 * Phase 1 Action Registry — 정적 등록.
 * Phase 2에서 runtime registry로 전환 예정.
 */
export const ACTION_REGISTRY: readonly ActionRegistryEntry[] = [
  // ── Quote Domain ──
  {
    actionName: "SubmitQuoteRequest",
    targetObjectType: "Quote",
    description: "견적 요청서를 공급사에 제출",
    riskLevel: "reviewed",
    irreversible: false,
    emitsEvents: ["quote_submitted"],
    invalidates: ["vendor_inbox"],
  },
  {
    actionName: "ShortlistQuote",
    targetObjectType: "Quote",
    description: "견적 후보 선정",
    riskLevel: "reviewed",
    irreversible: false,
    emitsEvents: ["quote_shortlisted"],
    invalidates: ["approval_inbox"],
  },
  {
    actionName: "ApproveQuote",
    targetObjectType: "Quote",
    description: "견적 승인 및 예산 예약",
    riskLevel: "governed",
    irreversible: false,
    emitsEvents: ["quote_approved", "budget_reserved"],
    invalidates: ["po_conversion_readiness", "budget_control_state"],
  },

  // ── PO Domain ──
  {
    actionName: "ConvertQuoteToPO",
    targetObjectType: "PurchaseOrder",
    description: "승인된 견적을 발주서로 전환",
    riskLevel: "governed",
    irreversible: false,
    emitsEvents: ["po_conversion_completed"],
    invalidates: ["dispatch_prep_readiness"],
  },
  {
    actionName: "AuthorizeDispatch",
    targetObjectType: "PurchaseOrder",
    description: "발주서 발송 승인 및 실행",
    riskLevel: "irreversible",
    irreversible: true,
    emitsEvents: ["dispatch_authorized", "send_scheduled"],
    invalidates: ["dispatch_execution_state"],
  },

  // ── Budget Domain ──
  {
    actionName: "ReserveBudget",
    targetObjectType: "Budget",
    description: "PO 승인 시 예산 예약",
    riskLevel: "reviewed",
    irreversible: false,
    emitsEvents: ["budget_reserved"],
    invalidates: ["budget_control_state"],
  },
  {
    actionName: "CommitBudget",
    targetObjectType: "Budget",
    description: "발송 확인 후 예산 확정",
    riskLevel: "reviewed",
    irreversible: false,
    emitsEvents: ["budget_committed"],
    invalidates: ["budget_control_state"],
  },
  {
    actionName: "ReleaseBudget",
    targetObjectType: "Budget",
    description: "PO 취소 시 예산 해제",
    riskLevel: "reviewed",
    irreversible: false,
    emitsEvents: ["budget_released"],
    invalidates: ["budget_control_state"],
  },

  // ── Inventory Domain ──
  {
    actionName: "RecordStockReceipt",
    targetObjectType: "Inventory",
    description: "입고 검수 후 재고 기록",
    riskLevel: "reviewed",
    irreversible: false,
    emitsEvents: ["stock_received"],
    invalidates: ["inventory_stock_status", "reorder_readiness"],
  },
  {
    actionName: "ReleaseStock",
    targetObjectType: "Inventory",
    description: "재고 출고 기록",
    riskLevel: "reviewed",
    irreversible: false,
    emitsEvents: ["stock_released"],
    invalidates: ["inventory_stock_status", "reorder_readiness"],
  },
  {
    actionName: "ExecuteReorderDecision",
    targetObjectType: "Inventory",
    description: "재주문 판단 실행",
    riskLevel: "governed",
    irreversible: false,
    emitsEvents: ["reorder_decided"],
    invalidates: ["procurement_reentry"],
  },

  // ── Cross-Object Actions (Phase 2) ──
  {
    actionName: "FinalizeApproval",
    targetObjectType: "PurchaseOrder",
    description: "주문 승인 + 연결 예산 소진액 업데이트 (atomic)",
    riskLevel: "governed",
    irreversible: false,
    emitsEvents: ["order_approved", "budget_spent_updated"],
    invalidates: ["budget_control_state", "dispatch_prep_readiness"],
  },
  {
    actionName: "ReceiveOrder",
    targetObjectType: "PurchaseOrder",
    description: "물품 수령 + 연결 재고 수량 반영 (atomic)",
    riskLevel: "reviewed",
    irreversible: false,
    emitsEvents: ["order_received", "inventory_updated"],
    invalidates: ["inventory_stock_status", "reorder_readiness"],
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// Helper — Action lookup
// ══════════════════════════════════════════════════════════════════════════════

export function lookupAction(actionName: string): ActionRegistryEntry | undefined {
  return ACTION_REGISTRY.find((a) => a.actionName === actionName);
}

export function getActionsForObjectType(objectType: OntologyObjectType): readonly ActionRegistryEntry[] {
  return ACTION_REGISTRY.filter((a) => a.targetObjectType === objectType);
}

export function getIrreversibleActions(): readonly ActionRegistryEntry[] {
  return ACTION_REGISTRY.filter((a) => a.irreversible);
}
