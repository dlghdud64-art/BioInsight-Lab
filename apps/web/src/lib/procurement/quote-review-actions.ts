/**
 * Quote Review Actions — operator review truth 조작 + selector helpers
 *
 * 원칙:
 * 1. SupplierQuoteResponse.responseStatus = incoming supplier truth (AI/시스템이 변경)
 * 2. QuoteReviewState = operator review truth (운영자만 변경)
 * 3. 두 축을 섞지 않는다.
 * 4. approval readiness는 둘을 조합해 계산한다.
 */

import type {
  QuoteReviewState,
  QuoteReviewNote,
  SupplierQuoteResponse,
  ProcurementCase,
  ProcurementSummary,
  QuoteStatus,
  ApprovalReadiness,
} from "./procurement-case";
import {
  recomputeProcurementSummary,
  recomputeQuoteStatus,
  checkApprovalReadiness,
} from "./procurement-case";

// ══════════════════════════════════════════════════════════════════════════════
// Review Actions (operator truth mutation)
// ══════════════════════════════════════════════════════════════════════════════

let _noteCounter = 0;
function noteUid(): string { return `rn_${Date.now()}_${++_noteCounter}`; }

export function addSupplierToShortlist(
  review: QuoteReviewState,
  supplierId: string
): QuoteReviewState {
  if (review.shortlistedSupplierIds.includes(supplierId)) return review;
  return {
    ...review,
    shortlistedSupplierIds: [...review.shortlistedSupplierIds, supplierId],
    excludedSupplierIds: review.excludedSupplierIds.filter(id => id !== supplierId),
    followupSupplierIds: review.followupSupplierIds.filter(id => id !== supplierId),
  };
}

export function excludeSupplierFromReview(
  review: QuoteReviewState,
  supplierId: string
): QuoteReviewState {
  if (review.excludedSupplierIds.includes(supplierId)) return review;
  return {
    ...review,
    excludedSupplierIds: [...review.excludedSupplierIds, supplierId],
    shortlistedSupplierIds: review.shortlistedSupplierIds.filter(id => id !== supplierId),
    followupSupplierIds: review.followupSupplierIds.filter(id => id !== supplierId),
  };
}

export function markSupplierNeedsFollowup(
  review: QuoteReviewState,
  supplierId: string
): QuoteReviewState {
  if (review.followupSupplierIds.includes(supplierId)) return review;
  return {
    ...review,
    followupSupplierIds: [...review.followupSupplierIds, supplierId],
    shortlistedSupplierIds: review.shortlistedSupplierIds.filter(id => id !== supplierId),
    excludedSupplierIds: review.excludedSupplierIds.filter(id => id !== supplierId),
  };
}

export function appendReviewNote(
  review: QuoteReviewState,
  text: string
): QuoteReviewState {
  const note: QuoteReviewNote = {
    id: noteUid(),
    text,
    createdAt: new Date().toISOString(),
  };
  return {
    ...review,
    reviewNotes: [...review.reviewNotes, note],
  };
}

export function setSelectedSupplier(
  review: QuoteReviewState,
  supplierId: string
): QuoteReviewState {
  return {
    ...review,
    selectedSupplierId: supplierId,
    shortlistedSupplierIds: review.shortlistedSupplierIds.includes(supplierId)
      ? review.shortlistedSupplierIds
      : [...review.shortlistedSupplierIds, supplierId],
  };
}

export function setReviewRationale(
  review: QuoteReviewState,
  rationale: string
): QuoteReviewState {
  return { ...review, reviewRationale: rationale };
}

export function setActiveSupplier(
  review: QuoteReviewState,
  supplierId: string | null
): QuoteReviewState {
  return { ...review, activeSupplierId: supplierId };
}

// ══════════════════════════════════════════════════════════════════════════════
// Selector Helpers (surface model computation)
// ══════════════════════════════════════════════════════════════════════════════

export interface ProcurementCaseSummaryModel {
  totalSuppliers: number;
  respondedSuppliers: number;
  pendingSuppliers: number;
  shortlistedSuppliers: number;
  lowestQuotedTotal: number | null;
  fastestLeadTimeDays: number | null;
  missingCriticalResponses: boolean;
  approvalReady: boolean;
}

export function buildProcurementCaseSummaryModel(
  procCase: ProcurementCase,
  responses: SupplierQuoteResponse[],
  review: QuoteReviewState
): ProcurementCaseSummaryModel {
  const summary = recomputeProcurementSummary(procCase.supplierIds, responses, review);
  const quoteStatus = recomputeQuoteStatus(responses, review);
  const readiness = checkApprovalReadiness(quoteStatus, review, summary);

  return {
    totalSuppliers: summary.totalSuppliers,
    respondedSuppliers: summary.respondedSuppliers,
    pendingSuppliers: summary.pendingSuppliers,
    shortlistedSuppliers: summary.shortlistedSuppliers,
    lowestQuotedTotal: summary.lowestQuotedTotal,
    fastestLeadTimeDays: summary.fastestLeadTimeDays,
    missingCriticalResponses: summary.pendingSuppliers > 0 && summary.respondedSuppliers === 0,
    approvalReady: readiness.ready,
  };
}

export interface QuoteReviewWorkbenchModel {
  procurementCase: ProcurementCase | null;
  summaryModel: ProcurementCaseSummaryModel | null;
  responses: SupplierQuoteResponse[];
  reviewState: QuoteReviewState | null;
  activeSupplierResponse: SupplierQuoteResponse | null;
  quoteStatus: QuoteStatus;
  approvalReadiness: ApprovalReadiness;
  shouldRender: boolean;
}

export function buildQuoteReviewWorkbenchModel(input: {
  procCase: ProcurementCase | null;
  responses: SupplierQuoteResponse[];
  review: QuoteReviewState | null;
}): QuoteReviewWorkbenchModel {
  const { procCase, responses, review } = input;

  if (!procCase || !review) {
    return {
      procurementCase: null,
      summaryModel: null,
      responses: [],
      reviewState: null,
      activeSupplierResponse: null,
      quoteStatus: "awaiting_responses",
      approvalReadiness: { ready: false, blockers: ["no_active_case"] },
      shouldRender: false,
    };
  }

  const summaryModel = buildProcurementCaseSummaryModel(procCase, responses, review);
  const quoteStatus = recomputeQuoteStatus(responses, review);
  const summary = recomputeProcurementSummary(procCase.supplierIds, responses, review);
  const approvalReadiness = checkApprovalReadiness(quoteStatus, review, summary);

  const activeSupplierResponse = review.activeSupplierId
    ? responses.find(r => r.supplierId === review.activeSupplierId) ?? null
    : null;

  return {
    procurementCase: procCase,
    summaryModel,
    responses,
    reviewState: review,
    activeSupplierResponse,
    quoteStatus,
    approvalReadiness,
    shouldRender: true,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Dock CTA Logic
// ══════════════════════════════════════════════════════════════════════════════

export type DockCtaState =
  | { type: "approval_ready"; label: string }
  | { type: "needs_responses"; label: string }
  | { type: "review_continue"; label: string }
  | { type: "empty"; label: string };

export function computeDockCta(
  quoteStatus: QuoteStatus,
  approvalReadiness: ApprovalReadiness,
  summary: ProcurementCaseSummaryModel
): DockCtaState {
  if (approvalReadiness.ready) {
    return { type: "approval_ready", label: "approval 준비로 이동" };
  }
  if (summary.respondedSuppliers === 0) {
    return { type: "needs_responses", label: "공급사 응답 대기 중" };
  }
  if (summary.pendingSuppliers > 0 && summary.respondedSuppliers < summary.totalSuppliers) {
    return { type: "needs_responses", label: "추가 응답 요청 필요" };
  }
  if (quoteStatus === "quotes_ready_for_review" || quoteStatus === "review_in_progress") {
    return { type: "review_continue", label: "quote review 계속" };
  }
  return { type: "empty", label: "상태 확인 필요" };
}

// ══════════════════════════════════════════════════════════════════════════════
// Supplier Review Status (operator truth를 UI에 표시)
// ══════════════════════════════════════════════════════════════════════════════

export type SupplierReviewLabel =
  | "shortlisted"
  | "excluded"
  | "needs_followup"
  | "selected"
  | "neutral";

export function getSupplierReviewLabel(
  review: QuoteReviewState,
  supplierId: string
): SupplierReviewLabel {
  if (review.selectedSupplierId === supplierId) return "selected";
  if (review.shortlistedSupplierIds.includes(supplierId)) return "shortlisted";
  if (review.excludedSupplierIds.includes(supplierId)) return "excluded";
  if (review.followupSupplierIds.includes(supplierId)) return "needs_followup";
  return "neutral";
}
