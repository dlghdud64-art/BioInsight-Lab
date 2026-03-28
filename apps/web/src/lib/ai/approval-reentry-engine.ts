/**
 * Approval Re-entry Engine — commercial/governance/budget delta 재검토 + approved candidate + PO conversion re-entry handoff
 */

import type { ApprovalReentryHandoff } from "./quote-compare-reentry-engine";

// ── Status ──
export type ApprovalReentryStatus = "approval_reentry_open" | "approval_reentry_in_progress" | "approval_reentry_decision_recorded";
export type ApprovalReentrySubstatus = "awaiting_commercial_revalidation" | "awaiting_governance_revalidation" | "awaiting_budget_revalidation" | "approval_reentry_blocked" | "ready_for_po_conversion_reentry";

// ── State ──
export interface ApprovalReentryState {
  approvalReentryStatus: ApprovalReentryStatus;
  substatus: ApprovalReentrySubstatus;
  approvalReentryOpenedAt: string;
  quoteCompareReentryDecisionSnapshotId: string;
  shortlistQuoteIds: string[];
  approvalCandidateIds: string[];
  commercialDeltaStatus: "reviewed" | "pending" | "blocked";
  governanceDeltaStatus: "reviewed" | "pending" | "blocked";
  budgetDeltaStatus: "reviewed" | "pending" | "blocked";
  approvedCandidateIds: string[];
  heldApprovalCandidateIds: string[];
  blockedApprovalCandidateIds: string[];
  approvalReentryBlockedFlag: boolean;
  approvalReentryBlockedReason: string | null;
  approvalReentryDecisionObjectId: string | null;
}

export function createInitialApprovalReentryState(handoff: ApprovalReentryHandoff): ApprovalReentryState {
  return {
    approvalReentryStatus: "approval_reentry_open",
    substatus: "awaiting_commercial_revalidation",
    approvalReentryOpenedAt: new Date().toISOString(),
    quoteCompareReentryDecisionSnapshotId: handoff.quoteCompareReentryDecisionSnapshotId,
    shortlistQuoteIds: handoff.shortlistQuoteIds,
    approvalCandidateIds: handoff.approvalCandidateIds,
    commercialDeltaStatus: "pending",
    governanceDeltaStatus: "pending",
    budgetDeltaStatus: "pending",
    approvedCandidateIds: [],
    heldApprovalCandidateIds: [],
    blockedApprovalCandidateIds: [],
    approvalReentryBlockedFlag: handoff.approvalReentryReadiness === "blocked",
    approvalReentryBlockedReason: handoff.approvalReentryReadiness === "blocked" ? "Approval Re-entry 조건 미충족" : null,
    approvalReentryDecisionObjectId: null,
  };
}

// ── Delta Review ──
export interface ApprovalReentryDeltaReview { commercialDeltaSummary: string; governanceDeltaSummary: string; budgetDeltaSummary: string; vendorChangeImpactSummary: string; approvalExceptionDeltaSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildApprovalReentryDeltaReview(state: ApprovalReentryState): ApprovalReentryDeltaReview {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (state.commercialDeltaStatus === "blocked") blocking.push("상업 조건 재검토 차단");
  if (state.governanceDeltaStatus === "blocked") blocking.push("거버넌스 재검토 차단");
  if (state.budgetDeltaStatus === "blocked") blocking.push("예산 재검토 차단");
  if (state.commercialDeltaStatus === "pending") warnings.push("상업 조건 delta 미검토");
  if (state.governanceDeltaStatus === "pending") warnings.push("거버넌스 delta 미검토");
  if (state.budgetDeltaStatus === "pending") warnings.push("예산 delta 미검토");
  return { commercialDeltaSummary: state.commercialDeltaStatus === "reviewed" ? "검토 완료" : "미검토", governanceDeltaSummary: state.governanceDeltaStatus === "reviewed" ? "검토 완료" : "미검토", budgetDeltaSummary: state.budgetDeltaStatus === "reviewed" ? "검토 완료" : "미검토", vendorChangeImpactSummary: "", approvalExceptionDeltaSummary: "", blockingIssues: blocking, warnings };
}

// ── Decision Plan ──
export interface ApprovalReentryDecisionPlan { approvedCandidateIds: string[]; heldApprovalCandidateIds: string[]; blockedApprovalCandidateIds: string[]; returnToCompareCandidateIds: string[]; decisionRationaleSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildApprovalReentryDecisionPlan(state: ApprovalReentryState): ApprovalReentryDecisionPlan {
  return { approvedCandidateIds: state.approvedCandidateIds, heldApprovalCandidateIds: state.heldApprovalCandidateIds, blockedApprovalCandidateIds: state.blockedApprovalCandidateIds, returnToCompareCandidateIds: [], decisionRationaleSummary: `Approved ${state.approvedCandidateIds.length}, Held ${state.heldApprovalCandidateIds.length}, Blocked ${state.blockedApprovalCandidateIds.length}`, blockingIssues: state.approvedCandidateIds.length === 0 ? ["승인 후보 없음"] : [], warnings: state.heldApprovalCandidateIds.length > 0 ? [`${state.heldApprovalCandidateIds.length}개 보류`] : [] };
}

// ── Validator ──
export interface ApprovalReentryValidation { canRecordApprovalReentryDecision: boolean; canOpenPoConversionReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateApprovalReentryBeforeRecord(state: ApprovalReentryState): ApprovalReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.approvalReentryBlockedFlag) blocking.push(state.approvalReentryBlockedReason || "차단됨");
  const delta = buildApprovalReentryDeltaReview(state);
  delta.blockingIssues.forEach(b => blocking.push(b));
  delta.warnings.forEach(w => { warnings.push(w); missing.push(w); });
  const plan = buildApprovalReentryDecisionPlan(state);
  plan.blockingIssues.forEach(b => blocking.push(b));
  plan.warnings.forEach(w => warnings.push(w));
  const canRecord = blocking.length === 0;
  return { canRecordApprovalReentryDecision: canRecord, canOpenPoConversionReentry: canRecord && state.approvedCandidateIds.length > 0, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : state.approvedCandidateIds.length > 0 ? "PO Conversion Re-entry로 보내기" : "승인 후보 지정 후 진행" };
}

// ── Decision Options ──
export interface ApprovalReentryDecisionOptions { canRecordDecision: boolean; canOpenPoConversionReentry: boolean; canHold: boolean; canReturnQuoteCompareReentry: boolean; decisionReasonSummary: string; }
export function buildApprovalReentryDecisionOptions(state: ApprovalReentryState): ApprovalReentryDecisionOptions {
  const v = validateApprovalReentryBeforeRecord(state);
  return { canRecordDecision: v.canRecordApprovalReentryDecision, canOpenPoConversionReentry: v.canOpenPoConversionReentry, canHold: state.heldApprovalCandidateIds.length > 0, canReturnQuoteCompareReentry: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface ApprovalReentryDecisionObject { id: string; quoteCompareReentryDecisionSnapshotId: string; compareBasisSummary: string; commercialDeltaSummary: string; governanceDeltaSummary: string; budgetDeltaSummary: string; approvedCandidateIds: string[]; heldApprovalCandidateIds: string[]; blockedApprovalCandidateIds: string[]; recordedAt: string; recordedBy: string; }
export function buildApprovalReentryDecisionObject(state: ApprovalReentryState): ApprovalReentryDecisionObject {
  const delta = buildApprovalReentryDeltaReview(state);
  return { id: `appreentry_${Date.now().toString(36)}`, quoteCompareReentryDecisionSnapshotId: state.quoteCompareReentryDecisionSnapshotId, compareBasisSummary: `SL ${state.shortlistQuoteIds.length}, AP ${state.approvalCandidateIds.length}`, commercialDeltaSummary: delta.commercialDeltaSummary, governanceDeltaSummary: delta.governanceDeltaSummary, budgetDeltaSummary: delta.budgetDeltaSummary, approvedCandidateIds: state.approvedCandidateIds, heldApprovalCandidateIds: state.heldApprovalCandidateIds, blockedApprovalCandidateIds: state.blockedApprovalCandidateIds, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── PO Conversion Re-entry Handoff ──
export interface PoConversionReentryHandoff { approvalReentryDecisionObjectId: string; approvedCandidateIds: string[]; commercialDeltaSummary: string; governanceDeltaSummary: string; poConversionReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildPoConversionReentryHandoff(obj: ApprovalReentryDecisionObject): PoConversionReentryHandoff {
  return { approvalReentryDecisionObjectId: obj.id, approvedCandidateIds: obj.approvedCandidateIds, commercialDeltaSummary: obj.commercialDeltaSummary, governanceDeltaSummary: obj.governanceDeltaSummary, poConversionReentryReadiness: obj.approvedCandidateIds.length > 0 ? "ready" : "pending" };
}
