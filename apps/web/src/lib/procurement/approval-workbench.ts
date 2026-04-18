/**
 * Approval Workbench — approval-ready queue + review + approve/return/reject
 *
 * 원칙:
 * 1. ProcurementCase는 계속 canonical operational object. approval은 다음 stage.
 * 2. ApprovalDraft = approval 검토 입력. ApprovalReviewState = 승인자 판단. DecisionRecord = 결과 기록.
 * 3. approve / return / reject는 서로 다른 의미. return ≠ reject.
 * 4. approve는 selected supplier + rationale + blocker 해소가 있어야만 가능.
 * 5. return은 quote review로 되돌림. reject는 case 종료.
 */

import type { ProcurementCase, ApprovalStatus } from "./procurement-case";

// ══════════════════════════════════════════════════════════════════════════════
// Approval Draft (pre-commit object — approval 검토 입력)
// ══════════════════════════════════════════════════════════════════════════════

export type ApprovalDraftStatus = "ready" | "in_review" | "approved" | "returned" | "rejected";

export interface ApprovalDraft {
  approvalDraftId: string;
  procurementCaseId: string;

  shortlistedSupplierIds: string[];
  selectedSupplierId: string | null;
  reviewRationale: string;

  quoteSummarySnapshot: {
    respondedSuppliers: number;
    pendingSuppliers: number;
    lowestQuotedTotal: number | null;
    fastestLeadTimeDays: number | null;
  };

  supportingDocuments: string[];
  createdAt: string;
  status: ApprovalDraftStatus;
}

// ══════════════════════════════════════════════════════════════════════════════
// Approval Review State (승인자 판단 truth)
// ══════════════════════════════════════════════════════════════════════════════

export interface ApprovalReviewState {
  procurementCaseId: string;
  approvalDraftId: string;

  reviewerNotes: string[];
  activeSection: "summary" | "documents" | "history" | "decision";

  returnReason: string | null;
  rejectionReason: string | null;

  pendingChecks: string[];
  completedChecks: string[];

  inReviewBy: string | null;
  updatedAt: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Approval Decision Record (결과 기록)
// ══════════════════════════════════════════════════════════════════════════════

export type ApprovalDecision = "approved" | "returned" | "rejected";

export interface ApprovalDecisionRecord {
  procurementCaseId: string;
  approvalDraftId: string;
  decision: ApprovalDecision;
  rationale: string;
  reviewerId: string | null;
  createdAt: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Factories
// ══════════════════════════════════════════════════════════════════════════════

let _adCounter = 0;
function adUid(): string { return `ad_${Date.now()}_${++_adCounter}`; }

export interface CreateApprovalDraftInput {
  procurementCaseId: string;
  shortlistedSupplierIds: string[];
  selectedSupplierId: string | null;
  reviewRationale: string;
  quoteSummarySnapshot: {
    respondedSuppliers: number;
    pendingSuppliers: number;
    lowestQuotedTotal: number | null;
    fastestLeadTimeDays: number | null;
  };
  supportingDocuments?: string[];
}

export function createApprovalDraft(input: CreateApprovalDraftInput): ApprovalDraft {
  return {
    approvalDraftId: adUid(),
    procurementCaseId: input.procurementCaseId,
    shortlistedSupplierIds: input.shortlistedSupplierIds,
    selectedSupplierId: input.selectedSupplierId,
    reviewRationale: input.reviewRationale,
    quoteSummarySnapshot: input.quoteSummarySnapshot,
    supportingDocuments: input.supportingDocuments ?? [],
    createdAt: new Date().toISOString(),
    status: "ready",
  };
}

export function createInitialApprovalReviewState(
  procurementCaseId: string,
  approvalDraftId: string
): ApprovalReviewState {
  return {
    procurementCaseId,
    approvalDraftId,
    reviewerNotes: [],
    activeSection: "summary",
    returnReason: null,
    rejectionReason: null,
    pendingChecks: [
      "선정 사유 확인",
      "견적 문서 검토",
      "리드타임 검토",
      "예산 검토",
    ],
    completedChecks: [],
    inReviewBy: null,
    updatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Decision Gating
// ══════════════════════════════════════════════════════════════════════════════

export interface ApprovalDecisionGateModel {
  canApprove: boolean;
  canReturn: boolean;
  canReject: boolean;
  blockers: string[];
}

export function computeApprovalDecisionGate(
  draft: ApprovalDraft,
  review: ApprovalReviewState
): ApprovalDecisionGateModel {
  const blockers: string[] = [];

  // approve conditions
  if (!draft.selectedSupplierId) blockers.push("selected_supplier_missing");
  if (!draft.reviewRationale || draft.reviewRationale.trim().length < 5) blockers.push("rationale_missing");
  if (review.pendingChecks.length > 0) blockers.push(`pending_checks_${review.pendingChecks.length}`);
  if (draft.status === "approved" || draft.status === "returned" || draft.status === "rejected") {
    blockers.push("already_decided");
  }

  const canApprove = blockers.length === 0;
  const canReturn = !!review.returnReason && review.returnReason.trim().length >= 3 && draft.status !== "returned";
  const canReject = !!review.rejectionReason && review.rejectionReason.trim().length >= 3 && draft.status !== "rejected";

  return { canApprove, canReturn, canReject, blockers };
}

// ══════════════════════════════════════════════════════════════════════════════
// Stage Transition Actions
// ══════════════════════════════════════════════════════════════════════════════

export interface ApproveResult {
  procurementCase: Partial<ProcurementCase>;
  draft: Partial<ApprovalDraft>;
  record: ApprovalDecisionRecord;
}

export function approveProcurementCase(input: {
  procurementCaseId: string;
  approvalDraftId: string;
  rationale: string;
  reviewerId?: string;
}): ApproveResult {
  const now = new Date().toISOString();
  return {
    procurementCase: {
      stage: "approved",
      approvalStatus: "approved",
      updatedAt: now,
    },
    draft: {
      status: "approved",
    },
    record: {
      procurementCaseId: input.procurementCaseId,
      approvalDraftId: input.approvalDraftId,
      decision: "approved",
      rationale: input.rationale,
      reviewerId: input.reviewerId ?? null,
      createdAt: now,
    },
  };
}

export interface ReturnResult {
  procurementCase: Partial<ProcurementCase>;
  draft: Partial<ApprovalDraft>;
  record: ApprovalDecisionRecord;
}

export function returnToQuoteReview(input: {
  procurementCaseId: string;
  approvalDraftId: string;
  returnReason: string;
  reviewerId?: string;
}): ReturnResult {
  const now = new Date().toISOString();
  return {
    procurementCase: {
      stage: "quote_review",
      quoteStatus: "review_in_progress",
      approvalStatus: "not_started",
      updatedAt: now,
    },
    draft: {
      status: "returned",
    },
    record: {
      procurementCaseId: input.procurementCaseId,
      approvalDraftId: input.approvalDraftId,
      decision: "returned",
      rationale: input.returnReason,
      reviewerId: input.reviewerId ?? null,
      createdAt: now,
    },
  };
}

export interface RejectResult {
  procurementCase: Partial<ProcurementCase>;
  draft: Partial<ApprovalDraft>;
  record: ApprovalDecisionRecord;
}

export function rejectProcurementCase(input: {
  procurementCaseId: string;
  approvalDraftId: string;
  rejectionReason: string;
  reviewerId?: string;
}): RejectResult {
  const now = new Date().toISOString();
  return {
    procurementCase: {
      stage: "closed",
      approvalStatus: "rejected",
      updatedAt: now,
    },
    draft: {
      status: "rejected",
    },
    record: {
      procurementCaseId: input.procurementCaseId,
      approvalDraftId: input.approvalDraftId,
      decision: "rejected",
      rationale: input.rejectionReason,
      reviewerId: input.reviewerId ?? null,
      createdAt: now,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Review Actions
// ══════════════════════════════════════════════════════════════════════════════

export function completeApprovalCheck(
  review: ApprovalReviewState,
  check: string
): ApprovalReviewState {
  if (review.completedChecks.includes(check)) return review;
  return {
    ...review,
    pendingChecks: review.pendingChecks.filter(c => c !== check),
    completedChecks: [...review.completedChecks, check],
    updatedAt: new Date().toISOString(),
  };
}

export function reopenApprovalCheck(
  review: ApprovalReviewState,
  check: string
): ApprovalReviewState {
  if (review.pendingChecks.includes(check)) return review;
  return {
    ...review,
    completedChecks: review.completedChecks.filter(c => c !== check),
    pendingChecks: [...review.pendingChecks, check],
    updatedAt: new Date().toISOString(),
  };
}

export function appendApprovalReviewerNote(
  review: ApprovalReviewState,
  note: string
): ApprovalReviewState {
  return {
    ...review,
    reviewerNotes: [...review.reviewerNotes, note],
    updatedAt: new Date().toISOString(),
  };
}

export function setReturnReason(
  review: ApprovalReviewState,
  reason: string
): ApprovalReviewState {
  return { ...review, returnReason: reason, updatedAt: new Date().toISOString() };
}

export function setRejectionReason(
  review: ApprovalReviewState,
  reason: string
): ApprovalReviewState {
  return { ...review, rejectionReason: reason, updatedAt: new Date().toISOString() };
}

export function setApprovalActiveSection(
  review: ApprovalReviewState,
  section: ApprovalReviewState["activeSection"]
): ApprovalReviewState {
  return { ...review, activeSection: section, updatedAt: new Date().toISOString() };
}

// ══════════════════════════════════════════════════════════════════════════════
// Center Workbench Model (selector output for approval review surface)
// ══════════════════════════════════════════════════════════════════════════════

export interface ApprovalWorkbenchModel {
  procurementCase: ProcurementCase | null;
  approvalDraft: ApprovalDraft | null;
  reviewState: ApprovalReviewState | null;
  decisionRecords: ApprovalDecisionRecord[];
  decisionGate: ApprovalDecisionGateModel | null;
  shouldRender: boolean;
}

export function buildApprovalWorkbenchModel(input: {
  procCase: ProcurementCase | null;
  draft: ApprovalDraft | null;
  review: ApprovalReviewState | null;
  decisionRecords: ApprovalDecisionRecord[];
}): ApprovalWorkbenchModel {
  const { procCase, draft, review, decisionRecords } = input;

  if (!procCase || !draft || !review) {
    return {
      procurementCase: null,
      approvalDraft: null,
      reviewState: null,
      decisionRecords: [],
      decisionGate: null,
      shouldRender: false,
    };
  }

  const decisionGate = computeApprovalDecisionGate(draft, review);

  return {
    procurementCase: procCase,
    approvalDraft: draft,
    reviewState: review,
    decisionRecords,
    decisionGate,
    shouldRender: true,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Queue Row Builder
// ══════════════════════════════════════════════════════════════════════════════

export interface ApprovalQueueRow {
  procurementCaseId: string;
  approvalDraftId: string;
  title: string;
  itemSummary: string;
  selectedSupplierSummary: {
    supplierId: string | null;
    supplierName: string | null;
    quotedTotal: number | null;
    leadTimeDays: number | null;
  };
  approvalSignals: {
    approvalStatus: ApprovalStatus;
    hasRationale: boolean;
    pendingChecksCount: number;
    documentsAttached: boolean;
    blockersPresent: boolean;
  };
  nextAction: string;
}

export function buildApprovalQueueRow(
  procCase: ProcurementCase,
  draft: ApprovalDraft,
  review: ApprovalReviewState,
  supplierName: string | null
): ApprovalQueueRow {
  const gate = computeApprovalDecisionGate(draft, review);

  let nextAction: string;
  if (draft.status === "approved") nextAction = "승인 완료";
  else if (draft.status === "returned") nextAction = "quote 검토로 반려됨";
  else if (draft.status === "rejected") nextAction = "거절됨";
  else if (gate.canApprove) nextAction = "승인 가능";
  else if (review.pendingChecks.length > 0) nextAction = `검토 ${review.pendingChecks.length}건 남음`;
  else if (!draft.selectedSupplierId) nextAction = "선정 공급사 확인 필요";
  else nextAction = "승인 검토 대기";

  return {
    procurementCaseId: procCase.procurementCaseId,
    approvalDraftId: draft.approvalDraftId,
    title: procCase.title,
    itemSummary: `${procCase.itemIds.length}건 품목`,
    selectedSupplierSummary: {
      supplierId: draft.selectedSupplierId,
      supplierName,
      quotedTotal: draft.quoteSummarySnapshot.lowestQuotedTotal,
      leadTimeDays: draft.quoteSummarySnapshot.fastestLeadTimeDays,
    },
    approvalSignals: {
      approvalStatus: procCase.approvalStatus,
      hasRationale: !!draft.reviewRationale && draft.reviewRationale.trim().length >= 5,
      pendingChecksCount: review.pendingChecks.length,
      documentsAttached: draft.supportingDocuments.length > 0,
      blockersPresent: gate.blockers.length > 0,
    },
    nextAction,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Dock CTA Logic
// ══════════════════════════════════════════════════════════════════════════════

export type ApprovalDockCtaState =
  | { type: "approve"; label: string; enabled: boolean }
  | { type: "return"; label: string; enabled: boolean }
  | { type: "reject"; label: string; enabled: boolean }
  | { type: "continue_review"; label: string };

export function computeApprovalDockCtas(
  gate: ApprovalDecisionGateModel
): ApprovalDockCtaState[] {
  return [
    { type: "approve", label: "승인", enabled: gate.canApprove },
    { type: "return", label: "quote 검토로 반려", enabled: gate.canReturn },
    { type: "reject", label: "거절", enabled: gate.canReject },
  ];
}
