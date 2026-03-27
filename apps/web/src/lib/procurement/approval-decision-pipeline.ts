/**
 * Approval Decision Pipeline — batch 3 보강
 *
 * 고정 규칙:
 * 1. approve/return/reject는 typed decision pipeline으로 commit.
 * 2. approve 시 POConversionDraft seed 즉시 생성.
 * 3. return 시 ReturnedReviewLoopState 생성 + quote_review 복귀.
 * 4. reject 시 closed 종결.
 * 5. center/rail/dock 모두 동일 selector truth 사용.
 * 6. auto-create PO / auto-send PO 금지.
 */

import type { ProcurementCase } from "./procurement-case";
import type { ApprovalDraft, ApprovalReviewState, ApprovalDecisionRecord } from "./approval-workbench";

// ══════════════════════════════════════════════════════════════════════════════
// Detailed Approve Readiness (approve guard 강화)
// ══════════════════════════════════════════════════════════════════════════════

export interface ApprovalApproveReadiness {
  canApprove: boolean;
  missingFields: string[];
  blockingIssues: string[];
  warningIssues: string[];
}

export function computeApprovalApproveReadiness(
  draft: ApprovalDraft,
  review: ApprovalReviewState,
  procCase: ProcurementCase
): ApprovalApproveReadiness {
  const missingFields: string[] = [];
  const blockingIssues: string[] = [];
  const warningIssues: string[] = [];

  // 필수 필드
  if (!draft.selectedSupplierId) missingFields.push("selected_supplier");
  if (!draft.reviewRationale || draft.reviewRationale.trim().length < 5) missingFields.push("rationale");

  // blocking
  if (review.pendingChecks.length > 0) blockingIssues.push(`pending_checks_${review.pendingChecks.length}`);
  if (draft.status === "approved" || draft.status === "returned" || draft.status === "rejected") {
    blockingIssues.push("already_decided");
  }
  if (procCase.stage !== "approval_ready" && procCase.stage !== "approval_in_progress") {
    blockingIssues.push("invalid_stage");
  }

  // warnings (non-blocking)
  if (draft.supportingDocuments.length === 0) warningIssues.push("no_supporting_documents");
  if (draft.quoteSummarySnapshot.pendingSuppliers > 0) warningIssues.push("pending_supplier_responses");
  if (review.reviewerNotes.length === 0) warningIssues.push("no_reviewer_notes");

  return {
    canApprove: missingFields.length === 0 && blockingIssues.length === 0,
    missingFields,
    blockingIssues,
    warningIssues,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Return / Reject Readiness
// ══════════════════════════════════════════════════════════════════════════════

export interface ApprovalReturnReadiness {
  canReturn: boolean;
  missingFields: string[];
}

export function computeApprovalReturnReadiness(
  review: ApprovalReviewState,
  draft: ApprovalDraft
): ApprovalReturnReadiness {
  const missingFields: string[] = [];
  if (!review.returnReason || review.returnReason.trim().length < 3) missingFields.push("return_reason");
  if (draft.status === "returned") missingFields.push("already_returned");
  return { canReturn: missingFields.length === 0, missingFields };
}

export interface ApprovalRejectReadiness {
  canReject: boolean;
  missingFields: string[];
}

export function computeApprovalRejectReadiness(
  review: ApprovalReviewState,
  draft: ApprovalDraft
): ApprovalRejectReadiness {
  const missingFields: string[] = [];
  if (!review.rejectionReason || review.rejectionReason.trim().length < 3) missingFields.push("rejection_reason");
  if (draft.status === "rejected") missingFields.push("already_rejected");
  return { canReject: missingFields.length === 0, missingFields };
}

// ══════════════════════════════════════════════════════════════════════════════
// Extended PO Conversion Draft (batch 3 확장)
// ══════════════════════════════════════════════════════════════════════════════

export type PODraftStatus = "seeded" | "editing" | "ready_for_po_creation";

export interface ExtendedPOConversionDraft {
  poConversionDraftId: string;
  procurementCaseId: string;
  sourceApprovalDecisionId: string;
  sourceRequestAssemblyId: string;
  sourceCompareSessionId: string | null;

  selectedSupplierId: string;
  selectedQuoteId: string | null;
  itemIds: string[];

  currency: string | null;
  paymentTerms: string | null;
  incoterms: string | null;
  shippingTerms: string | null;
  requestedBy: string | null;

  approvalSnapshot: {
    approvedAt: string;
    approvedBy: string | null;
    rationale: string | null;
  };

  draftStatus: PODraftStatus;
  createdAt: string;
  updatedAt: string;
}

let _epoc = 0;
function epoUid(): string { return `epo_${Date.now()}_${++_epoc}`; }

export function createExtendedPOConversionDraft(input: {
  procurementCaseId: string;
  sourceApprovalDecisionId: string;
  sourceRequestAssemblyId: string;
  sourceCompareSessionId: string | null;
  selectedSupplierId: string;
  selectedQuoteId?: string | null;
  itemIds: string[];
  rationale: string;
  approvedBy?: string | null;
}): ExtendedPOConversionDraft {
  const now = new Date().toISOString();
  return {
    poConversionDraftId: epoUid(),
    procurementCaseId: input.procurementCaseId,
    sourceApprovalDecisionId: input.sourceApprovalDecisionId,
    sourceRequestAssemblyId: input.sourceRequestAssemblyId,
    sourceCompareSessionId: input.sourceCompareSessionId,
    selectedSupplierId: input.selectedSupplierId,
    selectedQuoteId: input.selectedQuoteId ?? null,
    itemIds: input.itemIds,
    currency: null,
    paymentTerms: null,
    incoterms: null,
    shippingTerms: null,
    requestedBy: null,
    approvalSnapshot: {
      approvedAt: now,
      approvedBy: input.approvedBy ?? null,
      rationale: input.rationale,
    },
    draftStatus: "seeded",
    createdAt: now,
    updatedAt: now,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Next Stage Handoff Selector
// ══════════════════════════════════════════════════════════════════════════════

export type ApprovalDecisionState = "pending" | "approved" | "returned" | "rejected";
export type NextStage = "quote_review" | "po_conversion" | "closed" | null;

export interface ApprovalNextStageHandoff {
  currentDecisionState: ApprovalDecisionState;
  nextStage: NextStage;
  poConversionDraftId: string | null;
  returnedLoopId: string | null;
  primaryActionLabel: string | null;
}

export function buildApprovalNextStageHandoff(input: {
  procCase: ProcurementCase;
  latestDecision: ApprovalDecisionRecord | null;
  poDraftId: string | null;
  returnedLoopCaseId: string | null;
}): ApprovalNextStageHandoff {
  if (!input.latestDecision) {
    return {
      currentDecisionState: "pending",
      nextStage: null,
      poConversionDraftId: null,
      returnedLoopId: null,
      primaryActionLabel: null,
    };
  }

  switch (input.latestDecision.decision) {
    case "approved":
      return {
        currentDecisionState: "approved",
        nextStage: "po_conversion",
        poConversionDraftId: input.poDraftId,
        returnedLoopId: null,
        primaryActionLabel: "PO 전환 검토 열기",
      };
    case "returned":
      return {
        currentDecisionState: "returned",
        nextStage: "quote_review",
        poConversionDraftId: null,
        returnedLoopId: input.returnedLoopCaseId,
        primaryActionLabel: "quote 검토로 이동",
      };
    case "rejected":
      return {
        currentDecisionState: "rejected",
        nextStage: "closed",
        poConversionDraftId: null,
        returnedLoopId: null,
        primaryActionLabel: null,
      };
    default:
      return {
        currentDecisionState: "pending",
        nextStage: null,
        poConversionDraftId: null,
        returnedLoopId: null,
        primaryActionLabel: null,
      };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Approval Workbench ViewModel (center/rail/dock 공통 truth)
// ══════════════════════════════════════════════════════════════════════════════

export interface ApprovalWorkbenchViewModel {
  approveReadiness: ApprovalApproveReadiness;
  returnReadiness: ApprovalReturnReadiness;
  rejectReadiness: ApprovalRejectReadiness;
  nextStageHandoff: ApprovalNextStageHandoff;
  auditSummary: {
    totalEvents: number;
    latestEventType: string | null;
    latestEventAt: string | null;
  };
  currentStageBadge: string;
  nextActionLabel: string | null;
}

export function buildApprovalWorkbenchViewModel(input: {
  draft: ApprovalDraft;
  review: ApprovalReviewState;
  procCase: ProcurementCase;
  latestDecision: ApprovalDecisionRecord | null;
  auditEventCount: number;
  latestAuditType: string | null;
  latestAuditAt: string | null;
  poDraftId: string | null;
  returnedLoopCaseId: string | null;
}): ApprovalWorkbenchViewModel {
  const approveReadiness = computeApprovalApproveReadiness(input.draft, input.review, input.procCase);
  const returnReadiness = computeApprovalReturnReadiness(input.review, input.draft);
  const rejectReadiness = computeApprovalRejectReadiness(input.review, input.draft);
  const nextStageHandoff = buildApprovalNextStageHandoff({
    procCase: input.procCase,
    latestDecision: input.latestDecision,
    poDraftId: input.poDraftId,
    returnedLoopCaseId: input.returnedLoopCaseId,
  });

  // stage badge
  let currentStageBadge: string;
  switch (input.procCase.approvalStatus) {
    case "approved": currentStageBadge = "승인 완료"; break;
    case "rejected": currentStageBadge = "거절됨"; break;
    case "in_progress": currentStageBadge = "검토 중"; break;
    case "ready": currentStageBadge = "승인 대기"; break;
    default: currentStageBadge = "미시작";
  }

  return {
    approveReadiness,
    returnReadiness,
    rejectReadiness,
    nextStageHandoff,
    auditSummary: {
      totalEvents: input.auditEventCount,
      latestEventType: input.latestAuditType,
      latestEventAt: input.latestAuditAt,
    },
    currentStageBadge,
    nextActionLabel: nextStageHandoff.primaryActionLabel,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Stage Transition Rules (허용 전이만)
// ══════════════════════════════════════════════════════════════════════════════

export const ALLOWED_APPROVAL_STAGE_TRANSITIONS = {
  approval_ready: ["approval_in_progress"],
  approval_in_progress: ["approved", "quote_review", "closed"],
  approved: ["po_conversion"],
} as const;

export function isValidApprovalStageTransition(
  from: string,
  to: string
): boolean {
  const allowed = (ALLOWED_APPROVAL_STAGE_TRANSITIONS as Record<string, readonly string[]>)[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
