/**
 * ProcurementCase — request 이후의 canonical 운영 객체
 *
 * 원칙:
 * 1. request submission 이후 화면마다 객체가 갈라지지 않는다. stage만 이동.
 * 2. quote → approval → PO → receiving → stock 전체가 같은 case 안에서 진행.
 * 3. approval은 quote review 이후에만 자연스럽게 나와야 한다.
 * 4. AI 없이도 버티는 운영 큐와 판단면이 먼저.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Procurement Stage
// ══════════════════════════════════════════════════════════════════════════════

export type ProcurementStage =
  | "quote_collection"
  | "quote_review"
  | "approval_ready"
  | "approval_in_progress"
  | "approved"
  | "po_conversion"
  | "po_created"
  | "receiving"
  | "stocked"
  | "closed";

export type QuoteStatus =
  | "awaiting_responses"
  | "partial_responses"
  | "quotes_ready_for_review"
  | "review_in_progress"
  | "selected_for_approval";

export type ApprovalStatus =
  | "not_started"
  | "ready"
  | "in_progress"
  | "approved"
  | "rejected";

// ══════════════════════════════════════════════════════════════════════════════
// Procurement Case
// ══════════════════════════════════════════════════════════════════════════════

export interface ProcurementSummary {
  totalSuppliers: number;
  respondedSuppliers: number;
  pendingSuppliers: number;
  shortlistedSuppliers: number;
  lowestQuotedTotal: number | null;
  fastestLeadTimeDays: number | null;
}

export interface ProcurementCase {
  procurementCaseId: string;

  // ── Source linkage ──
  sourceRequestAssemblyId: string;
  sourceCompareSessionId: string | null;
  selectedDecisionItemId: string | null;

  // ── Core ──
  title: string;
  itemIds: string[];
  supplierIds: string[];

  // ── Stage progression ──
  stage: ProcurementStage;
  quoteStatus: QuoteStatus;
  approvalStatus: ApprovalStatus;

  // ── Summary ──
  procurementSummary: ProcurementSummary;

  // ── Timestamps ──
  createdAt: string;
  updatedAt: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Supplier Quote Response
// ══════════════════════════════════════════════════════════════════════════════

export type QuoteResponseStatus =
  | "pending"
  | "received"
  | "needs_followup"
  | "excluded";

export interface SupplierQuoteResponse {
  procurementCaseId: string;
  supplierId: string;
  supplierName: string;
  responseStatus: QuoteResponseStatus;
  quotedTotal: number | null;
  quotedUnitPrices: Array<{ itemId: string; unitPrice: number | null; quantity: number }>;
  leadTimeDays: number | null;
  substituteOffered: boolean | null;
  termsNotes: string | null;
  attachments: string[];
  receivedAt: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Quote Review State (operator 판단 truth)
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteReviewNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface QuoteReviewState {
  procurementCaseId: string;
  shortlistedSupplierIds: string[];
  excludedSupplierIds: string[];
  followupSupplierIds: string[];
  activeSupplierId: string | null;
  reviewNotes: QuoteReviewNote[];
  selectedSupplierId: string | null; // approval로 넘길 최종 선택
  reviewRationale: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Queue Row (UI view-model)
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteQueueRow {
  procurementCaseId: string;
  title: string;
  itemSummary: string;
  supplierResponseSummary: {
    totalSuppliers: number;
    respondedSuppliers: number;
    pendingSuppliers: number;
  };
  quoteSignals: {
    quoteStatus: QuoteStatus;
    lowestQuotedTotal: number | null;
    fastestLeadTimeDays: number | null;
    missingCriticalResponses: boolean;
    approvalReady: boolean;
  };
  nextAction: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Factories
// ══════════════════════════════════════════════════════════════════════════════

let _caseCounter = 0;
function caseUid(): string {
  return `pc_${Date.now()}_${++_caseCounter}`;
}

export interface CreateProcurementCaseInput {
  sourceRequestAssemblyId: string;
  sourceCompareSessionId: string | null;
  selectedDecisionItemId: string | null;
  title: string;
  itemIds: string[];
  supplierIds: string[];
}

export function createProcurementCase(input: CreateProcurementCaseInput): ProcurementCase {
  const now = new Date().toISOString();
  return {
    procurementCaseId: caseUid(),
    sourceRequestAssemblyId: input.sourceRequestAssemblyId,
    sourceCompareSessionId: input.sourceCompareSessionId,
    selectedDecisionItemId: input.selectedDecisionItemId,
    title: input.title,
    itemIds: input.itemIds,
    supplierIds: input.supplierIds,
    stage: "quote_collection",
    quoteStatus: "awaiting_responses",
    approvalStatus: "not_started",
    procurementSummary: {
      totalSuppliers: input.supplierIds.length,
      respondedSuppliers: 0,
      pendingSuppliers: input.supplierIds.length,
      shortlistedSuppliers: 0,
      lowestQuotedTotal: null,
      fastestLeadTimeDays: null,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function createInitialQuoteReviewState(procurementCaseId: string): QuoteReviewState {
  return {
    procurementCaseId,
    shortlistedSupplierIds: [],
    excludedSupplierIds: [],
    followupSupplierIds: [],
    activeSupplierId: null,
    reviewNotes: [],
    selectedSupplierId: null,
    reviewRationale: "",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Summary Recompute
// ══════════════════════════════════════════════════════════════════════════════

export function recomputeProcurementSummary(
  supplierIds: string[],
  responses: SupplierQuoteResponse[],
  review: QuoteReviewState
): ProcurementSummary {
  const responded = responses.filter(r => r.responseStatus === "received");
  const pending = responses.filter(r => r.responseStatus === "pending");
  const quotedTotals = responded.map(r => r.quotedTotal).filter((t): t is number => t !== null && t > 0);
  const leadTimes = responded.map(r => r.leadTimeDays).filter((d): d is number => d !== null && d > 0);

  return {
    totalSuppliers: supplierIds.length,
    respondedSuppliers: responded.length,
    pendingSuppliers: pending.length,
    shortlistedSuppliers: review.shortlistedSupplierIds.length,
    lowestQuotedTotal: quotedTotals.length > 0 ? Math.min(...quotedTotals) : null,
    fastestLeadTimeDays: leadTimes.length > 0 ? Math.min(...leadTimes) : null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Quote Status Recompute
// ══════════════════════════════════════════════════════════════════════════════

export function recomputeQuoteStatus(
  responses: SupplierQuoteResponse[],
  review: QuoteReviewState
): QuoteStatus {
  if (review.selectedSupplierId) return "selected_for_approval";
  if (review.shortlistedSupplierIds.length > 0) return "review_in_progress";

  const received = responses.filter(r => r.responseStatus === "received");
  const pending = responses.filter(r => r.responseStatus === "pending");

  if (received.length === 0) return "awaiting_responses";
  if (pending.length > 0 && received.length < responses.length) return "partial_responses";
  return "quotes_ready_for_review";
}

// ══════════════════════════════════════════════════════════════════════════════
// Approval Readiness
// ══════════════════════════════════════════════════════════════════════════════

export interface ApprovalReadiness {
  ready: boolean;
  blockers: string[];
}

export function checkApprovalReadiness(
  quoteStatus: QuoteStatus,
  review: QuoteReviewState,
  summary: ProcurementSummary
): ApprovalReadiness {
  const blockers: string[] = [];

  if (review.shortlistedSupplierIds.length === 0) {
    blockers.push("shortlist_empty");
  }
  if (!review.selectedSupplierId) {
    blockers.push("no_selected_supplier");
  }
  if (!review.reviewRationale || review.reviewRationale.trim().length < 5) {
    blockers.push("review_rationale_missing");
  }
  if (summary.respondedSuppliers === 0) {
    blockers.push("no_responses_received");
  }
  if (quoteStatus === "awaiting_responses") {
    blockers.push("still_awaiting_responses");
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Approval Draft Input
// ══════════════════════════════════════════════════════════════════════════════

export interface CreateApprovalDraftInput {
  procurementCaseId: string;
  shortlistedSupplierIds: string[];
  selectedSupplierId: string;
  reviewRationale: string;
  quoteSummarySnapshot: {
    respondedSuppliers: number;
    lowestQuotedTotal: number | null;
    fastestLeadTimeDays: number | null;
  };
}

export function buildApprovalDraftInput(
  procCase: ProcurementCase,
  review: QuoteReviewState,
  summary: ProcurementSummary
): CreateApprovalDraftInput | null {
  if (!review.selectedSupplierId) return null;
  if (review.shortlistedSupplierIds.length === 0) return null;

  return {
    procurementCaseId: procCase.procurementCaseId,
    shortlistedSupplierIds: review.shortlistedSupplierIds,
    selectedSupplierId: review.selectedSupplierId,
    reviewRationale: review.reviewRationale,
    quoteSummarySnapshot: {
      respondedSuppliers: summary.respondedSuppliers,
      lowestQuotedTotal: summary.lowestQuotedTotal,
      fastestLeadTimeDays: summary.fastestLeadTimeDays,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Queue Row Builder
// ══════════════════════════════════════════════════════════════════════════════

export function buildQuoteQueueRow(
  procCase: ProcurementCase,
  quoteStatus: QuoteStatus,
  summary: ProcurementSummary,
  approvalReadiness: ApprovalReadiness
): QuoteQueueRow {
  let nextAction: string;
  switch (quoteStatus) {
    case "awaiting_responses":
      nextAction = "공급사 응답 대기 중";
      break;
    case "partial_responses":
      nextAction = `${summary.respondedSuppliers}/${summary.totalSuppliers} 응답 · 추가 대기`;
      break;
    case "quotes_ready_for_review":
      nextAction = "견적 비교 검토 가능";
      break;
    case "review_in_progress":
      nextAction = "검토 진행 중";
      break;
    case "selected_for_approval":
      nextAction = approvalReadiness.ready ? "승인 요청 가능" : "승인 준비 확인 필요";
      break;
    default:
      nextAction = "상태 확인 필요";
  }

  return {
    procurementCaseId: procCase.procurementCaseId,
    title: procCase.title,
    itemSummary: `${procCase.itemIds.length}건 품목`,
    supplierResponseSummary: {
      totalSuppliers: summary.totalSuppliers,
      respondedSuppliers: summary.respondedSuppliers,
      pendingSuppliers: summary.pendingSuppliers,
    },
    quoteSignals: {
      quoteStatus,
      lowestQuotedTotal: summary.lowestQuotedTotal,
      fastestLeadTimeDays: summary.fastestLeadTimeDays,
      missingCriticalResponses: summary.pendingSuppliers > 0 && summary.respondedSuppliers === 0,
      approvalReady: approvalReadiness.ready,
    },
    nextAction,
  };
}
