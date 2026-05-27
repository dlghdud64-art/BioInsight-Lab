/**
 * Quote Compare Re-entry Engine — delta-aware compare 재판단 + shortlist/approval candidate + approval re-entry handoff
 */

import type { QuoteCompareReentryFromNormHandoff } from "./quote-normalization-reentry-engine";

// ── Status ──
export type QuoteCompareReentryStatus = "quote_compare_reentry_open" | "quote_compare_reentry_in_progress" | "quote_compare_reentry_decision_recorded";
export type QuoteCompareReentrySubstatus = "awaiting_compare_basis_review" | "awaiting_delta_difference_review" | "awaiting_shortlist_reconstruction" | "quote_compare_reentry_blocked" | "ready_for_approval_reentry";

// ── State ──
export interface QuoteCompareReentryState {
  quoteCompareReentryStatus: QuoteCompareReentryStatus;
  substatus: QuoteCompareReentrySubstatus;
  quoteCompareReentryOpenedAt: string;
  quoteNormalizationReentryObjectId: string;
  retainedQuoteIds: string[];
  remappedQuoteIds: string[];
  compareReentryCandidateIds: string[];
  compareBasisSummary: string;
  shortlistQuoteIds: string[];
  excludedQuoteIds: string[];
  heldQuoteIds: string[];
  approvalCandidateIds: string[];
  quoteCompareReentryBlockedFlag: boolean;
  quoteCompareReentryBlockedReason: string | null;
  quoteCompareReentryDecisionSnapshotId: string | null;
}

export function createInitialQuoteCompareReentryState(handoff: QuoteCompareReentryFromNormHandoff): QuoteCompareReentryState {
  return {
    quoteCompareReentryStatus: "quote_compare_reentry_open",
    substatus: "awaiting_compare_basis_review",
    quoteCompareReentryOpenedAt: new Date().toISOString(),
    quoteNormalizationReentryObjectId: handoff.quoteNormalizationReentryObjectId,
    retainedQuoteIds: handoff.retainedQuoteIds,
    remappedQuoteIds: handoff.remappedQuoteIds,
    compareReentryCandidateIds: handoff.compareReentryCandidateIds,
    compareBasisSummary: "",
    shortlistQuoteIds: [...handoff.compareReentryCandidateIds],
    excludedQuoteIds: [],
    heldQuoteIds: [],
    approvalCandidateIds: [],
    quoteCompareReentryBlockedFlag: handoff.quoteCompareReentryReadiness === "blocked",
    quoteCompareReentryBlockedReason: handoff.quoteCompareReentryReadiness === "blocked" ? "Compare Re-entry 조건 미충족" : null,
    quoteCompareReentryDecisionSnapshotId: null,
  };
}

// ── Difference Summary ──
export interface QuoteCompareReentryDiffSummary { priceDeltaSummary: string; leadTimeDeltaSummary: string; specDeltaSummary: string; availabilityDeltaSummary: string; vendorFitDeltaSummary: string; approvalRiskSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildQuoteCompareReentryDifferenceSummary(candidateCount: number, retainedCount: number, remappedCount: number): QuoteCompareReentryDiffSummary {
  const blocking: string[] = [];
  if (candidateCount < 2) blocking.push("비교 가능 후보 2개 미만");
  return { priceDeltaSummary: candidateCount >= 2 ? "가격 비교 가능" : "비교 불가", leadTimeDeltaSummary: candidateCount >= 2 ? "납기 비교 가능" : "비교 불가", specDeltaSummary: remappedCount > 0 ? "Remap 기준 재확인 필요" : "규격 유지", availabilityDeltaSummary: "재고 확인 필요", vendorFitDeltaSummary: `Retained ${retainedCount} + Remapped ${remappedCount}`, approvalRiskSummary: remappedCount > 0 ? "Remap quote 포함 — approval 재검토 필요" : "표준 승인 가능", blockingIssues: blocking, warnings: remappedCount > 0 ? ["Remapped quote carry-forward risk"] : [] };
}

// ── Decision Plan ──
export interface QuoteCompareReentryDecisionPlan { shortlistQuoteIds: string[]; excludedQuoteIds: string[]; heldQuoteIds: string[]; approvalCandidateIds: string[]; blockedApprovalQuoteIds: string[]; decisionRationaleSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildQuoteCompareReentryDecisionPlan(state: QuoteCompareReentryState): QuoteCompareReentryDecisionPlan {
  return { shortlistQuoteIds: state.shortlistQuoteIds, excludedQuoteIds: state.excludedQuoteIds, heldQuoteIds: state.heldQuoteIds, approvalCandidateIds: state.approvalCandidateIds, blockedApprovalQuoteIds: [], decisionRationaleSummary: `SL ${state.shortlistQuoteIds.length}, Approval ${state.approvalCandidateIds.length}, Excluded ${state.excludedQuoteIds.length}`, blockingIssues: state.shortlistQuoteIds.length === 0 && state.approvalCandidateIds.length === 0 ? ["shortlist 또는 approval 후보 없음"] : [], warnings: state.heldQuoteIds.length > 0 ? [`${state.heldQuoteIds.length}개 보류`] : [] };
}

// ── Validator ──
export interface QuoteCompareReentryValidation { canRecordQuoteCompareReentryDecision: boolean; canOpenApprovalReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateQuoteCompareReentryBeforeRecord(state: QuoteCompareReentryState): QuoteCompareReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.quoteCompareReentryBlockedFlag) blocking.push(state.quoteCompareReentryBlockedReason || "차단됨");
  if (state.compareReentryCandidateIds.length < 2) blocking.push("비교 후보 2개 미만");
  const plan = buildQuoteCompareReentryDecisionPlan(state);
  plan.blockingIssues.forEach(b => blocking.push(b));
  plan.warnings.forEach(w => warnings.push(w));
  const canRecord = blocking.length === 0;
  return { canRecordQuoteCompareReentryDecision: canRecord, canOpenApprovalReentry: canRecord && state.approvalCandidateIds.length > 0, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : state.approvalCandidateIds.length > 0 ? "Approval Re-entry로 보내기" : "Approval 후보 지정 후 진행" };
}

// ── Decision Options ──
export interface QuoteCompareReentryDecisionOptions { canRecordDecision: boolean; canOpenApprovalReentry: boolean; canHold: boolean; canReturnNormReentry: boolean; decisionReasonSummary: string; }
export function buildQuoteCompareReentryDecisionOptions(state: QuoteCompareReentryState): QuoteCompareReentryDecisionOptions {
  const v = validateQuoteCompareReentryBeforeRecord(state);
  return { canRecordDecision: v.canRecordQuoteCompareReentryDecision, canOpenApprovalReentry: v.canOpenApprovalReentry, canHold: state.heldQuoteIds.length > 0, canReturnNormReentry: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Snapshot ──
export interface QuoteCompareReentryDecisionSnapshot { id: string; quoteNormalizationReentryObjectId: string; retainedQuoteIds: string[]; remappedQuoteIds: string[]; compareBasisSummary: string; shortlistQuoteIds: string[]; excludedQuoteIds: string[]; heldQuoteIds: string[]; approvalCandidateIds: string[]; recordedAt: string; recordedBy: string; }
export function buildQuoteCompareReentryDecisionSnapshot(state: QuoteCompareReentryState): QuoteCompareReentryDecisionSnapshot {
  return { id: `qcmpreentry_${Date.now().toString(36)}`, quoteNormalizationReentryObjectId: state.quoteNormalizationReentryObjectId, retainedQuoteIds: state.retainedQuoteIds, remappedQuoteIds: state.remappedQuoteIds, compareBasisSummary: state.compareBasisSummary || `${state.compareReentryCandidateIds.length}개 후보 비교`, shortlistQuoteIds: state.shortlistQuoteIds, excludedQuoteIds: state.excludedQuoteIds, heldQuoteIds: state.heldQuoteIds, approvalCandidateIds: state.approvalCandidateIds, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Approval Re-entry Handoff ──
export interface ApprovalReentryHandoff { quoteCompareReentryDecisionSnapshotId: string; shortlistQuoteIds: string[]; approvalCandidateIds: string[]; compareBasisSummary: string; approvalReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildApprovalReentryHandoff(snapshot: QuoteCompareReentryDecisionSnapshot): ApprovalReentryHandoff {
  return { quoteCompareReentryDecisionSnapshotId: snapshot.id, shortlistQuoteIds: snapshot.shortlistQuoteIds, approvalCandidateIds: snapshot.approvalCandidateIds, compareBasisSummary: snapshot.compareBasisSummary, approvalReentryReadiness: snapshot.approvalCandidateIds.length > 0 ? "ready" : "pending" };
}
