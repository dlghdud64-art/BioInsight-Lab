/**
 * Quote Case Canonical Contract
 *
 * 모든 surface (row / KPI / rail / work window / detail)가
 * 같은 normalized DTO와 state selector를 공유합니다.
 *
 * param 명칭: quoteCaseId (id / caseId / requestId 금지)
 */

// ── DB Status ──
export type QuoteStatus = "PENDING" | "SENT" | "RESPONDED" | "COMPLETED" | "CANCELLED";

// ── Canonical UI State Enum ──
export type QuoteCaseUiState =
  | "request_not_sent"
  | "awaiting_responses"
  | "response_delayed"
  | "compare_not_ready"
  | "compare_review_required"
  | "condition_check_required"
  | "external_approval_required"
  | "ready_for_po_conversion";

// ── Work Window Keys ──
export type WorkWindowKey = "request_send" | "followup_send" | "compare_review" | "approval_prep" | "po_conversion" | null;

// ── Raw API Response Shape (from /api/quotes) ──
export interface QuoteCaseRaw {
  id: string;
  title: string;
  status: QuoteStatus;
  createdAt: string;
  deliveryDate?: string;
  deliveryLocation?: string;
  items: Array<{ id: string; product: { id: string; name: string }; quantity: number }>;
  responses?: Array<{ id: string; vendor: { name: string }; totalPrice?: number; createdAt: string }>;
}

// ── Normalized DTO (모든 surface의 공통 truth) ──
export interface QuoteCaseNormalized {
  quoteCaseId: string;
  requestTitle: string;
  dbStatus: QuoteStatus;
  createdAt: string;
  lastActivityAt: string;
  deadlineAt?: string;
  deliveryLocation?: string;
  itemCount: number;
  items: Array<{ id: string; productName: string; quantity: number }>;
  responseCount: number;
  responses: Array<{ id: string; vendorName: string; totalPrice?: number; createdAt: string }>;
  validQuoteCount: number;
  pendingSupplierCount: number;
  delayedSupplierCount: number;
  isDelayed: boolean;
  estimatedAmount: number;
  // State resolution
  resolvedUiState: QuoteCaseUiState;
  priorityScore: number;
  // Compare/approval/PO resolution
  selectedQuoteId?: string;
  selectedVendorName?: string;
  compareCompleted: boolean;
  conditionIssues: number;
  requiredDocsMissing: boolean;
  approvalPolicy: "none" | "external_manual" | "in_app_light";
  externalApprovalStatus: "not_required" | "external_approval_required" | "external_approval_pending" | "externally_approved" | "externally_rejected";
  poConversionReady: boolean;
  blockerCount: number;
}

// ── Rail Handoff Payload (rail → work window) ──
export interface RailHandoffPayload {
  quoteCaseId: string;
  resolvedUiState: QuoteCaseUiState;
  actionKey: WorkWindowKey;
  requestTitle: string;
  selectedQuoteId?: string;
  selectedVendorName?: string;
  validQuoteCount: number;
  conditionIssues: number;
  approvalPolicy: string;
  externalApprovalStatus: string;
  estimatedAmount: number;
}

// ── Aggregate DTO (KPI / chip count) ──
export interface QuoteCaseAggregate {
  totalCount: number;
  requestTrackingCount: number;
  compareReviewCount: number;
  approvalExceptionCount: number;
  readyForPoCount: number;
  priorityCount: number;
  todayCount: number;
}

// ── Error Contract ──
export interface QuoteSurfaceError {
  errorCode: string;
  message: string;
  retryable: boolean;
  surface: "queue_list" | "queue_aggregate" | "rail_summary" | "work_window" | "detail";
  missingFields?: string[];
}

// ── State Resolution Functions ──

export function isQuoteCaseDelayed(q: QuoteCaseRaw): boolean {
  if (!q.deliveryDate) return false;
  if (q.status === "COMPLETED" || q.status === "CANCELLED") return false;
  return new Date(q.deliveryDate) < new Date();
}

export function deriveUiState(q: QuoteCaseRaw): QuoteCaseUiState {
  const rc = q.responses?.length ?? 0;
  if (q.status === "COMPLETED") return "ready_for_po_conversion";
  if (q.status === "RESPONDED") return rc >= 2 ? "compare_review_required" : "compare_not_ready";
  if (q.status === "SENT") {
    if (rc === 0) return isQuoteCaseDelayed(q) ? "response_delayed" : "awaiting_responses";
    return rc >= 2 ? "compare_review_required" : "compare_not_ready";
  }
  return "request_not_sent";
}

export function derivePriorityScore(q: QuoteCaseRaw): number {
  if (isQuoteCaseDelayed(q)) return 0;
  if (q.deliveryDate && new Date(q.deliveryDate).toDateString() === new Date().toDateString()) return 1;
  const map: Record<QuoteStatus, number> = { RESPONDED: 2, SENT: 3, PENDING: 4, COMPLETED: 6, CANCELLED: 7 };
  if (q.status === "SENT" && (q.responses?.length ?? 0) > 0) return 2;
  return map[q.status] ?? 9;
}

/**
 * Raw API 응답 → Normalized DTO 변환
 * API boundary에서 1회만 호출, 이후 모든 surface는 이 결과만 소비
 */
export function toQuoteCaseNormalized(raw: QuoteCaseRaw): QuoteCaseNormalized {
  const rc = raw.responses?.length ?? 0;
  const prices = (raw.responses ?? []).map(r => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);
  const delayed = isQuoteCaseDelayed(raw);
  const uiState = deriveUiState(raw);
  const bestPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const bestResponse = raw.responses?.find(r => r.totalPrice === bestPrice);

  return {
    quoteCaseId: raw.id,
    requestTitle: raw.title,
    dbStatus: raw.status,
    createdAt: raw.createdAt,
    lastActivityAt: raw.responses?.[0]?.createdAt ?? raw.createdAt,
    deadlineAt: raw.deliveryDate,
    deliveryLocation: raw.deliveryLocation,
    itemCount: raw.items.length,
    items: raw.items.map(i => ({ id: i.id, productName: i.product.name, quantity: i.quantity })),
    responseCount: rc,
    responses: (raw.responses ?? []).map(r => ({ id: r.id, vendorName: r.vendor.name, totalPrice: r.totalPrice, createdAt: r.createdAt })),
    validQuoteCount: prices.length,
    pendingSupplierCount: Math.max(0, 3 - rc), // 기본 3곳 가정
    delayedSupplierCount: delayed ? Math.max(1, 3 - rc) : 0,
    isDelayed: delayed,
    estimatedAmount: bestPrice,
    resolvedUiState: uiState,
    priorityScore: derivePriorityScore(raw),
    selectedQuoteId: bestResponse?.id,
    selectedVendorName: bestResponse?.vendorName,
    compareCompleted: uiState === "ready_for_po_conversion" || uiState === "external_approval_required",
    conditionIssues: 0, // 실제 API에서 조건 이슈 필드가 오면 여기서 매핑
    requiredDocsMissing: false,
    approvalPolicy: "none",
    externalApprovalStatus: "not_required",
    poConversionReady: uiState === "ready_for_po_conversion",
    blockerCount: uiState === "condition_check_required" || uiState === "external_approval_required" ? 1 : 0,
  };
}

/**
 * Normalized DTO → Rail Handoff Payload
 */
export function toRailHandoff(n: QuoteCaseNormalized, actionKey: WorkWindowKey): RailHandoffPayload {
  return {
    quoteCaseId: n.quoteCaseId,
    resolvedUiState: n.resolvedUiState,
    actionKey,
    requestTitle: n.requestTitle,
    selectedQuoteId: n.selectedQuoteId,
    selectedVendorName: n.selectedVendorName,
    validQuoteCount: n.validQuoteCount,
    conditionIssues: n.conditionIssues,
    approvalPolicy: n.approvalPolicy,
    externalApprovalStatus: n.externalApprovalStatus,
    estimatedAmount: n.estimatedAmount,
  };
}

/**
 * Normalized DTO[] → Aggregate
 */
export function aggregateQuoteCases(cases: QuoteCaseNormalized[]): QuoteCaseAggregate {
  const today = new Date().toDateString();
  const RESPONSE_TRACK = new Set<QuoteCaseUiState>(["request_not_sent", "awaiting_responses", "response_delayed"]);
  const COMPARE = new Set<QuoteCaseUiState>(["compare_not_ready", "compare_review_required", "condition_check_required"]);
  const APPROVAL = new Set<QuoteCaseUiState>(["external_approval_required", "condition_check_required"]);
  const PRIORITY = new Set<QuoteCaseUiState>(["response_delayed", "condition_check_required", "external_approval_required"]);

  return {
    totalCount: cases.length,
    requestTrackingCount: cases.filter(c => RESPONSE_TRACK.has(c.resolvedUiState)).length,
    compareReviewCount: cases.filter(c => COMPARE.has(c.resolvedUiState)).length,
    approvalExceptionCount: cases.filter(c => APPROVAL.has(c.resolvedUiState)).length,
    readyForPoCount: cases.filter(c => c.resolvedUiState === "ready_for_po_conversion").length,
    priorityCount: cases.filter(c => PRIORITY.has(c.resolvedUiState) || (c.deadlineAt && new Date(c.deadlineAt).toDateString() === today)).length,
    todayCount: cases.filter(c => c.deadlineAt && new Date(c.deadlineAt).toDateString() === today).length,
  };
}

// ── State group constants (for chip/KPI filters) ──
export const RESPONSE_TRACK_STATES = new Set<QuoteCaseUiState>(["request_not_sent", "awaiting_responses", "response_delayed"]);
export const COMPARE_STATES = new Set<QuoteCaseUiState>(["compare_not_ready", "compare_review_required", "condition_check_required"]);
export const BLOCKED_STATES = new Set<QuoteCaseUiState>(["condition_check_required", "external_approval_required", "compare_not_ready"]);
