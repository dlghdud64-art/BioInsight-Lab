/**
 * Approval Post-Decision — PO conversion entry + audit trail + returned loop
 *
 * 원칙:
 * 1. approved → POConversionDraft 생성 + next stage entry.
 * 2. returned → quote review loop (반려 사유 + unresolved items 전달).
 * 3. rejected → case closed (history 유지).
 * 4. audit trail = 누가, 언제, 어떤 근거로, 어떤 결정. decorative log 금지.
 * 5. return ≠ reject. return은 loop, reject는 종료.
 */

import type { ProcurementCase } from "./procurement-case";
import type { ApprovalDraft, ApprovalDecisionRecord, ApprovalReviewState } from "./approval-workbench";

// ══════════════════════════════════════════════════════════════════════════════
// PO Conversion Draft
// ══════════════════════════════════════════════════════════════════════════════

export type POConversionStatus = "ready" | "in_progress" | "converted" | "cancelled";

export interface POConversionDraft {
  poConversionDraftId: string;
  procurementCaseId: string;
  approvalDraftId: string;

  selectedSupplierId: string | null;
  approvedQuotedTotal: number | null;
  currency: string | null;
  leadTimeDays: number | null;

  approvalDecisionRationale: string;
  supportingDocuments: string[];

  status: POConversionStatus;
  createdAt: string;
  updatedAt: string;
}

let _poCounter = 0;
function poUid(): string { return `po_${Date.now()}_${++_poCounter}`; }

export interface CreatePOConversionDraftInput {
  procurementCaseId: string;
  approvalDraftId: string;
  selectedSupplierId: string | null;
  approvedQuotedTotal: number | null;
  currency?: string;
  leadTimeDays: number | null;
  approvalDecisionRationale: string;
  supportingDocuments?: string[];
}

export function createPOConversionDraft(input: CreatePOConversionDraftInput): POConversionDraft {
  const now = new Date().toISOString();
  return {
    poConversionDraftId: poUid(),
    procurementCaseId: input.procurementCaseId,
    approvalDraftId: input.approvalDraftId,
    selectedSupplierId: input.selectedSupplierId,
    approvedQuotedTotal: input.approvedQuotedTotal,
    currency: input.currency ?? "KRW",
    leadTimeDays: input.leadTimeDays,
    approvalDecisionRationale: input.approvalDecisionRationale,
    supportingDocuments: input.supportingDocuments ?? [],
    status: "ready",
    createdAt: now,
    updatedAt: now,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Approval Audit Event
// ══════════════════════════════════════════════════════════════════════════════

export type ApprovalAuditEventType =
  | "approval_draft_created"
  | "approval_review_started"
  | "approval_check_completed"
  | "approval_check_reopened"
  | "approval_note_added"
  | "approval_returned"
  | "approval_rejected"
  | "approval_approved"
  | "po_conversion_draft_created"
  | "returned_case_reopened_in_quote_review";

export interface ApprovalAuditEvent {
  eventId: string;
  procurementCaseId: string;
  approvalDraftId: string | null;
  type: ApprovalAuditEventType;
  actorId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

let _auditCounter = 0;
function auditUid(): string { return `aev_${Date.now()}_${++_auditCounter}`; }

export function createAuditEvent(input: {
  procurementCaseId: string;
  approvalDraftId?: string | null;
  type: ApprovalAuditEventType;
  actorId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}): ApprovalAuditEvent {
  return {
    eventId: auditUid(),
    procurementCaseId: input.procurementCaseId,
    approvalDraftId: input.approvalDraftId ?? null,
    type: input.type,
    actorId: input.actorId ?? null,
    summary: input.summary,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Returned Review Loop State
// ══════════════════════════════════════════════════════════════════════════════

export interface ReturnedReviewLoopState {
  procurementCaseId: string;
  lastReturnedAt: string | null;
  lastReturnReason: string | null;
  unresolvedReturnItems: string[];
  resolvedReturnItems: string[];
  returnSourceApprovalDraftId: string | null;
}

export function createReturnedLoopState(input: {
  procurementCaseId: string;
  returnReason: string;
  approvalDraftId: string;
}): ReturnedReviewLoopState {
  return {
    procurementCaseId: input.procurementCaseId,
    lastReturnedAt: new Date().toISOString(),
    lastReturnReason: input.returnReason,
    unresolvedReturnItems: [input.returnReason], // 최소 1개: returnReason 전체를 item으로
    resolvedReturnItems: [],
    returnSourceApprovalDraftId: input.approvalDraftId,
  };
}

export function resolveReturnedItem(
  state: ReturnedReviewLoopState,
  item: string
): ReturnedReviewLoopState {
  if (state.resolvedReturnItems.includes(item)) return state;
  return {
    ...state,
    unresolvedReturnItems: state.unresolvedReturnItems.filter(i => i !== item),
    resolvedReturnItems: [...state.resolvedReturnItems, item],
  };
}

export function reopenReturnedItem(
  state: ReturnedReviewLoopState,
  item: string
): ReturnedReviewLoopState {
  if (state.unresolvedReturnItems.includes(item)) return state;
  return {
    ...state,
    resolvedReturnItems: state.resolvedReturnItems.filter(i => i !== item),
    unresolvedReturnItems: [...state.unresolvedReturnItems, item],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Extended Decision Record (snapshot 포함)
// ══════════════════════════════════════════════════════════════════════════════

export interface ExtendedApprovalDecisionRecord extends ApprovalDecisionRecord {
  selectedSupplierId: string | null;
  blockersSnapshot: string[];
  pendingChecksSnapshot: string[];
}

export function createExtendedDecisionRecord(input: {
  procurementCaseId: string;
  approvalDraftId: string;
  decision: "approved" | "returned" | "rejected";
  rationale: string;
  reviewerId?: string;
  draft: ApprovalDraft;
  review: ApprovalReviewState;
}): ExtendedApprovalDecisionRecord {
  return {
    procurementCaseId: input.procurementCaseId,
    approvalDraftId: input.approvalDraftId,
    decision: input.decision,
    rationale: input.rationale,
    reviewerId: input.reviewerId ?? null,
    createdAt: new Date().toISOString(),
    selectedSupplierId: input.draft.selectedSupplierId,
    blockersSnapshot: [], // 결정 시점 blockers
    pendingChecksSnapshot: input.review.pendingChecks.slice(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Post-Decision Orchestration
// ══════════════════════════════════════════════════════════════════════════════

export interface ApproveOrchestratedResult {
  decisionRecord: ExtendedApprovalDecisionRecord;
  poConversionDraft: POConversionDraft;
  auditEvents: ApprovalAuditEvent[];
  caseUpdate: Partial<ProcurementCase>;
  draftStatusUpdate: "approved";
}

export function orchestrateApproval(input: {
  procurementCaseId: string;
  approvalDraftId: string;
  rationale: string;
  reviewerId?: string;
  draft: ApprovalDraft;
  review: ApprovalReviewState;
}): ApproveOrchestratedResult {
  const now = new Date().toISOString();

  const decisionRecord = createExtendedDecisionRecord({
    ...input,
    decision: "approved",
  });

  const poConversionDraft = createPOConversionDraft({
    procurementCaseId: input.procurementCaseId,
    approvalDraftId: input.approvalDraftId,
    selectedSupplierId: input.draft.selectedSupplierId,
    approvedQuotedTotal: input.draft.quoteSummarySnapshot.lowestQuotedTotal,
    leadTimeDays: input.draft.quoteSummarySnapshot.fastestLeadTimeDays,
    approvalDecisionRationale: input.rationale,
    supportingDocuments: input.draft.supportingDocuments,
  });

  const auditEvents = [
    createAuditEvent({
      procurementCaseId: input.procurementCaseId,
      approvalDraftId: input.approvalDraftId,
      type: "approval_approved",
      actorId: input.reviewerId,
      summary: `승인 완료 — ${input.rationale.substring(0, 50)}`,
    }),
    createAuditEvent({
      procurementCaseId: input.procurementCaseId,
      type: "po_conversion_draft_created",
      summary: `PO 전환 준비 생성 — ${poConversionDraft.poConversionDraftId}`,
    }),
  ];

  return {
    decisionRecord,
    poConversionDraft,
    auditEvents,
    caseUpdate: {
      stage: "approved",
      approvalStatus: "approved",
      updatedAt: now,
    },
    draftStatusUpdate: "approved",
  };
}

export interface ReturnOrchestratedResult {
  decisionRecord: ExtendedApprovalDecisionRecord;
  returnedLoopState: ReturnedReviewLoopState;
  auditEvents: ApprovalAuditEvent[];
  caseUpdate: Partial<ProcurementCase>;
  draftStatusUpdate: "returned";
}

export function orchestrateReturn(input: {
  procurementCaseId: string;
  approvalDraftId: string;
  returnReason: string;
  reviewerId?: string;
  draft: ApprovalDraft;
  review: ApprovalReviewState;
}): ReturnOrchestratedResult {
  const now = new Date().toISOString();

  const decisionRecord = createExtendedDecisionRecord({
    ...input,
    decision: "returned",
    rationale: input.returnReason,
  });

  const returnedLoopState = createReturnedLoopState({
    procurementCaseId: input.procurementCaseId,
    returnReason: input.returnReason,
    approvalDraftId: input.approvalDraftId,
  });

  const auditEvents = [
    createAuditEvent({
      procurementCaseId: input.procurementCaseId,
      approvalDraftId: input.approvalDraftId,
      type: "approval_returned",
      actorId: input.reviewerId,
      summary: `반려 — ${input.returnReason.substring(0, 50)}`,
    }),
    createAuditEvent({
      procurementCaseId: input.procurementCaseId,
      type: "returned_case_reopened_in_quote_review",
      summary: "quote review로 반려 case 복원",
    }),
  ];

  return {
    decisionRecord,
    returnedLoopState,
    auditEvents,
    caseUpdate: {
      stage: "quote_review",
      quoteStatus: "review_in_progress",
      approvalStatus: "not_started",
      updatedAt: now,
    },
    draftStatusUpdate: "returned",
  };
}

export interface RejectOrchestratedResult {
  decisionRecord: ExtendedApprovalDecisionRecord;
  auditEvents: ApprovalAuditEvent[];
  caseUpdate: Partial<ProcurementCase>;
  draftStatusUpdate: "rejected";
}

export function orchestrateReject(input: {
  procurementCaseId: string;
  approvalDraftId: string;
  rejectionReason: string;
  reviewerId?: string;
  draft: ApprovalDraft;
  review: ApprovalReviewState;
}): RejectOrchestratedResult {
  const now = new Date().toISOString();

  const decisionRecord = createExtendedDecisionRecord({
    ...input,
    decision: "rejected",
    rationale: input.rejectionReason,
  });

  const auditEvents = [
    createAuditEvent({
      procurementCaseId: input.procurementCaseId,
      approvalDraftId: input.approvalDraftId,
      type: "approval_rejected",
      actorId: input.reviewerId,
      summary: `거절 — ${input.rejectionReason.substring(0, 50)}`,
    }),
  ];

  return {
    decisionRecord,
    auditEvents,
    caseUpdate: {
      stage: "closed",
      approvalStatus: "rejected",
      updatedAt: now,
    },
    draftStatusUpdate: "rejected",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Post-Decision Models (selector output)
// ══════════════════════════════════════════════════════════════════════════════

export interface ApprovalPostDecisionModel {
  decision: "approved" | "returned" | "rejected" | null;
  nextActionLabel: string | null;
  nextRoute: string | null;
  showHistory: boolean;
}

export function buildApprovalPostDecisionModel(
  procCase: ProcurementCase | null,
  latestRecord: ApprovalDecisionRecord | null
): ApprovalPostDecisionModel {
  if (!procCase || !latestRecord) {
    return { decision: null, nextActionLabel: null, nextRoute: null, showHistory: false };
  }

  switch (latestRecord.decision) {
    case "approved":
      return {
        decision: "approved",
        nextActionLabel: "PO 전환 준비로 이동",
        nextRoute: `/app/po-conversion?case=${procCase.procurementCaseId}`,
        showHistory: true,
      };
    case "returned":
      return {
        decision: "returned",
        nextActionLabel: "quote 검토로 이동",
        nextRoute: `/app/quotes?case=${procCase.procurementCaseId}&mode=returned-review`,
        showHistory: true,
      };
    case "rejected":
      return {
        decision: "rejected",
        nextActionLabel: null,
        nextRoute: null,
        showHistory: true,
      };
    default:
      return { decision: null, nextActionLabel: null, nextRoute: null, showHistory: false };
  }
}

export interface ApprovalGovernanceRailModel {
  procurementCase: ProcurementCase | null;
  approvalDraft: ApprovalDraft | null;
  latestDecision: ApprovalDecisionRecord | null;
  auditEvents: ApprovalAuditEvent[];
  poConversionDraft: POConversionDraft | null;
  returnedLoopState: ReturnedReviewLoopState | null;
  shouldRender: boolean;
}

export function buildApprovalGovernanceRailModel(input: {
  procCase: ProcurementCase | null;
  draft: ApprovalDraft | null;
  latestDecision: ApprovalDecisionRecord | null;
  auditEvents: ApprovalAuditEvent[];
  poDraft: POConversionDraft | null;
  returnedLoop: ReturnedReviewLoopState | null;
}): ApprovalGovernanceRailModel {
  return {
    procurementCase: input.procCase,
    approvalDraft: input.draft,
    latestDecision: input.latestDecision,
    auditEvents: input.auditEvents,
    poConversionDraft: input.poDraft,
    returnedLoopState: input.returnedLoop,
    shouldRender: !!input.procCase && !!input.draft,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Returned Quote Banner Model
// ══════════════════════════════════════════════════════════════════════════════

export interface ReturnedQuoteBannerModel {
  isReturnedCase: boolean;
  returnReason: string | null;
  unresolvedItems: string[];
  resolvedItems: string[];
}

export function buildReturnedQuoteBannerModel(
  returnedLoop: ReturnedReviewLoopState | null
): ReturnedQuoteBannerModel {
  if (!returnedLoop || !returnedLoop.lastReturnedAt) {
    return { isReturnedCase: false, returnReason: null, unresolvedItems: [], resolvedItems: [] };
  }
  return {
    isReturnedCase: true,
    returnReason: returnedLoop.lastReturnReason,
    unresolvedItems: returnedLoop.unresolvedReturnItems,
    resolvedItems: returnedLoop.resolvedReturnItems,
  };
}
