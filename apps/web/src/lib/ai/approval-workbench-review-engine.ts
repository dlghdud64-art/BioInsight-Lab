/**
 * Approval Workbench Review Engine — actual approval decision + approve/return/reject/rationale
 *
 * 고정 규칙:
 * 1. approvalReviewSessionV2 = 단일 입력 source.
 * 2. ready_for_approval_review ≠ approved. review decision 이후에만 record 생성.
 * 3. approve / return / reject 3분류 구조적 분리.
 * 4. compare rationale ≠ approval rationale. approval 판단 근거는 별도 기록.
 * 5. governance / budget / policy reference는 decision 보조 — truth 자동 생성 금지.
 * 6. canonical approvalDecisionRecordV2 = downstream PO handoff gate의 단일 intake.
 * 7. PO conversion handoff 직접 실행 금지.
 * 8. review → decision record → PO handoff gate 순서 강제.
 */

import type { ApprovalReviewSessionV2, ApprovalReviewSessionStatus } from "./approval-workbench-hydration-engine";
import type { CandidateRationale } from "./compare-reopen-v2-review-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";

// ── Review Status ──
export type ApprovalReviewStatusV2 = "blocked" | "warning" | "ready" | "in_progress" | "completed" | "failed";

// ── Approval Action ──
export type ApprovalAction = "approve_scope" | "return_for_revision" | "reject_scope" | "keep_under_review";

// ── Approval Rationale Code ──
export type ApprovalRationaleCode =
  | "budget_ok"
  | "policy_fit"
  | "preferred_vendor_accepted"
  | "risk_acceptable"
  | "quote_valid"
  | "urgency_supported"
  | "compare_rationale_accepted"
  | "budget_exceeded"
  | "policy_violation"
  | "vendor_risk_high"
  | "quote_stale"
  | "insufficient_rationale"
  | "revision_required"
  | "rejection_reason"
  | "governance_override"
  | "operator_judgment";

// ── Exception Flag ──
export type ApprovalReviewExceptionFlag =
  | "budget_reference_missing"
  | "policy_reference_missing"
  | "equivalent_heavy_risk"
  | "stale_quote_risk"
  | "mixed_scope_unresolved"
  | "return_reason_missing"
  | "reject_reason_missing";

// ── Approval Review Decision ──
export interface ApprovalReviewDecision {
  scopeId: string;
  candidateIds: string[];
  decisionAction: ApprovalAction;
  approveFlag: boolean;
  returnFlag: boolean;
  rejectFlag: boolean;
  rationaleCodes: ApprovalRationaleCode[];
  operatorNote: string;
  exceptionFlags: ApprovalReviewExceptionFlag[];
}

// ── State ──
export interface ApprovalWorkbenchReviewState {
  reviewStatus: ApprovalReviewStatusV2;
  approvalReviewSessionV2Id: string;
  sourceHandoffPackageV2Id: string;
  sourceCompareDecisionSnapshotV2Id: string;
  poRecordId: string;
  approvalScope: string;
  shortlistCandidateIds: string[];
  holdExcludedIds: string[];
  excludedCandidateIds: string[];
  provenanceByCandidate: LaneProvenance[];
  compareRationaleByCandidate: CandidateRationale[];
  quoteReferenceVisible: boolean;
  policyReferenceVisible: boolean;
  budgetReferenceVisible: boolean;
  scopeDecisions: ApprovalReviewDecision[];
  operatorReviewNote: string;
  blockerCount: number;
  warningCount: number;
  decisionRecordId: string | null;
}

export function createInitialApprovalReviewState(session: ApprovalReviewSessionV2): ApprovalWorkbenchReviewState {
  return {
    reviewStatus: "in_progress",
    approvalReviewSessionV2Id: session.id,
    sourceHandoffPackageV2Id: session.sourceApprovalHandoffPackageV2Id,
    sourceCompareDecisionSnapshotV2Id: "",
    poRecordId: session.poRecordId,
    approvalScope: session.approvalScope,
    shortlistCandidateIds: session.shortlistCandidateIds,
    holdExcludedIds: session.holdExcludedIds,
    excludedCandidateIds: session.excludedCandidateIds,
    provenanceByCandidate: session.provenanceByCandidate,
    compareRationaleByCandidate: session.rationaleByCandidate,
    quoteReferenceVisible: session.quoteReferenceVisible,
    policyReferenceVisible: session.policyReferenceVisible,
    budgetReferenceVisible: session.budgetReferenceVisible,
    scopeDecisions: [],
    operatorReviewNote: "",
    blockerCount: 0,
    warningCount: 0,
    decisionRecordId: null,
  };
}

// ── Review Readiness ──
export interface ApprovalReviewReadinessResult {
  status: ApprovalReviewStatusV2;
  blockers: string[];
  warnings: string[];
  canComplete: boolean;
}

export function evaluateApprovalReviewReadiness(state: ApprovalWorkbenchReviewState): ApprovalReviewReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.approvalReviewSessionV2Id) blockers.push("Approval review session lineage 없음");

  // Decision coverage
  if (state.scopeDecisions.length === 0) {
    blockers.push("Approval decision이 하나도 없습니다");
  }

  // Scope coverage
  const decidedCandidateIds = new Set<string>();
  for (const d of state.scopeDecisions) {
    for (const id of d.candidateIds) decidedCandidateIds.add(id);
  }
  const undecided = state.shortlistCandidateIds.filter(id => !decidedCandidateIds.has(id));
  if (undecided.length > 0) {
    blockers.push(`${undecided.length}건 shortlist candidate approval decision 미완료`);
  }

  // Under-review guard
  const underReview = state.scopeDecisions.filter(d => d.decisionAction === "keep_under_review");
  if (underReview.length > 0) {
    blockers.push(`${underReview.length}건 scope가 아직 review 미확정`);
  }

  // Approved scope
  const approved = state.scopeDecisions.filter(d => d.decisionAction === "approve_scope");
  const returned = state.scopeDecisions.filter(d => d.decisionAction === "return_for_revision");
  const rejected = state.scopeDecisions.filter(d => d.decisionAction === "reject_scope");

  // At least one decisive action
  if (approved.length === 0 && returned.length === 0 && rejected.length === 0) {
    blockers.push("승인 / 보완 요청 / 반려 결론이 하나도 없습니다");
  }

  // Rationale completeness
  const noRationale = state.scopeDecisions.filter(
    d => d.decisionAction !== "keep_under_review" && d.rationaleCodes.length === 0
  );
  if (noRationale.length > 0) {
    blockers.push(`${noRationale.length}건 approval decision에 rationale 누락`);
  }

  // Return reason guard
  const returnNoReason = returned.filter(d => d.rationaleCodes.length === 0 && !d.operatorNote);
  if (returnNoReason.length > 0) {
    blockers.push(`${returnNoReason.length}건 보완 요청에 사유 누락`);
  }

  // Reject reason guard
  const rejectNoReason = rejected.filter(d => d.rationaleCodes.length === 0 && !d.operatorNote);
  if (rejectNoReason.length > 0) {
    blockers.push(`${rejectNoReason.length}건 반려에 사유 누락`);
  }

  // Mixed scope overlap guard
  for (const d of state.scopeDecisions) {
    const flags = [d.approveFlag, d.returnFlag, d.rejectFlag].filter(Boolean);
    if (flags.length > 1) {
      blockers.push(`Scope ${d.scopeId}: approve/return/reject가 동시 선택됨`);
    }
  }

  // Hold/excluded contamination
  const allDecidedIds = new Set<string>();
  for (const d of state.scopeDecisions) {
    for (const id of d.candidateIds) allDecidedIds.add(id);
  }
  const holdInDecision = state.holdExcludedIds.filter(id => allDecidedIds.has(id));
  if (holdInDecision.length > 0) {
    blockers.push(`${holdInDecision.length}건 hold candidate가 approval decision에 포함`);
  }
  const excludedInDecision = state.excludedCandidateIds.filter(id => allDecidedIds.has(id));
  if (excludedInDecision.length > 0) {
    blockers.push(`${excludedInDecision.length}건 excluded candidate가 approval decision에 포함`);
  }

  // Governance warnings
  for (const d of state.scopeDecisions) {
    if (d.exceptionFlags.includes("budget_reference_missing")) warnings.push(`Scope ${d.scopeId}: budget reference 누락`);
    if (d.exceptionFlags.includes("policy_reference_missing")) warnings.push(`Scope ${d.scopeId}: policy reference 누락`);
    if (d.exceptionFlags.includes("equivalent_heavy_risk")) warnings.push(`Scope ${d.scopeId}: equivalent 비중 높은 승인 리스크`);
    if (d.exceptionFlags.includes("stale_quote_risk")) warnings.push(`Scope ${d.scopeId}: stale quote 리스크`);
  }

  const status: ApprovalReviewStatusV2 =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "completed";

  // Batch 1: warning에서도 completion 금지 (보수적)
  return { status, blockers, warnings, canComplete: status === "completed" };
}

// ── Decision Record Status ──
export type ApprovalDecisionRecordStatus = "approved" | "returned_for_revision" | "rejected" | "mixed_scope_blocked" | "cancelled";

// ── Rationale By Scope ──
export interface ScopeRationale {
  scopeId: string;
  candidateIds: string[];
  action: ApprovalAction;
  rationaleCodes: ApprovalRationaleCode[];
  operatorNote: string;
}

// ── Canonical Approval Decision Record V2 ──
export interface ApprovalDecisionRecordV2 {
  id: string;
  sourceApprovalReviewSessionV2Id: string;
  sourceApprovalHandoffPackageV2Id: string;
  sourceCompareDecisionSnapshotV2Id: string;
  poRecordId: string;
  approvedScopeIds: string[];
  returnedScopeIds: string[];
  rejectedScopeIds: string[];
  provenanceByCandidate: LaneProvenance[];
  rationaleByScope: ScopeRationale[];
  governanceReferenceSummary: string;
  operatorReviewNote: string;
  createdAt: string;
  createdBy: string;
  status: ApprovalDecisionRecordStatus;
  nextDestination: string;
}

export function buildApprovalDecisionRecordV2(state: ApprovalWorkbenchReviewState): ApprovalDecisionRecordV2 | null {
  const readiness = evaluateApprovalReviewReadiness(state);
  if (!readiness.canComplete) return null;

  const approved = state.scopeDecisions.filter(d => d.approveFlag);
  const returned = state.scopeDecisions.filter(d => d.returnFlag);
  const rejected = state.scopeDecisions.filter(d => d.rejectFlag);

  const approvedIds = approved.flatMap(d => d.candidateIds);
  const returnedIds = returned.flatMap(d => d.candidateIds);
  const rejectedIds = rejected.flatMap(d => d.candidateIds);

  const rationaleByScope: ScopeRationale[] = state.scopeDecisions
    .filter(d => d.decisionAction !== "keep_under_review")
    .map(d => ({
      scopeId: d.scopeId,
      candidateIds: d.candidateIds,
      action: d.decisionAction,
      rationaleCodes: d.rationaleCodes,
      operatorNote: d.operatorNote,
    }));

  const hasApproved = approvedIds.length > 0;
  const hasReturned = returnedIds.length > 0;
  const hasRejected = rejectedIds.length > 0;

  const status: ApprovalDecisionRecordStatus =
    hasApproved && !hasReturned && !hasRejected ? "approved"
    : !hasApproved && hasReturned && !hasRejected ? "returned_for_revision"
    : !hasApproved && !hasReturned && hasRejected ? "rejected"
    : "mixed_scope_blocked";

  const nextDest =
    status === "approved" ? "po_conversion_handoff_gate"
    : status === "returned_for_revision" ? "compare_revision_route"
    : status === "rejected" ? "rejection_route"
    : "mixed_scope_resolution";

  const govSummary = [
    state.quoteReferenceVisible ? "quote:visible" : "quote:hidden",
    state.policyReferenceVisible ? "policy:visible" : "policy:hidden",
    state.budgetReferenceVisible ? "budget:visible" : "budget:hidden",
  ].join("; ");

  return {
    id: `apprdecv2_${Date.now().toString(36)}`,
    sourceApprovalReviewSessionV2Id: state.approvalReviewSessionV2Id,
    sourceApprovalHandoffPackageV2Id: state.sourceHandoffPackageV2Id,
    sourceCompareDecisionSnapshotV2Id: state.sourceCompareDecisionSnapshotV2Id,
    poRecordId: state.poRecordId,
    approvedScopeIds: approvedIds,
    returnedScopeIds: returnedIds,
    rejectedScopeIds: rejectedIds,
    provenanceByCandidate: state.provenanceByCandidate,
    rationaleByScope,
    governanceReferenceSummary: govSummary,
    operatorReviewNote: state.operatorReviewNote,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status,
    nextDestination: nextDest,
  };
}

// ── Activity Events ──
export type ApprovalReviewEventType =
  | "approval_review_opened"
  | "approval_review_saved"
  | "approval_review_hold_set"
  | "approval_review_blocker_detected"
  | "approval_review_warning_detected"
  | "approval_review_completed"
  | "approval_decision_record_v2_created"
  | "approval_ready_for_po_handoff_gate";

export interface ApprovalReviewEvent {
  type: ApprovalReviewEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  approvalReviewSessionV2Id: string;
  decisionRecordV2Id: string | null;
  changedFields: string[];
  destination: string;
}

export function createApprovalReviewEvent(
  type: ApprovalReviewEventType,
  state: ApprovalWorkbenchReviewState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): ApprovalReviewEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    approvalReviewSessionV2Id: state.approvalReviewSessionV2Id,
    decisionRecordV2Id: state.decisionRecordId,
    changedFields,
    destination,
  };
}
