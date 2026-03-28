/**
 * Compare Reopen Engine — 비교 재개 baseline reuse + difference-first + shortlist/request candidate + request reopen handoff
 */

import type { CompareReopenHandoff } from "./sourcing-result-review-engine";

// ── Status ──
export type CompareReopenStatus = "compare_reopen_open" | "compare_reopen_in_progress" | "compare_reopen_decision_recorded";
export type CompareReopenSubstatus = "awaiting_compare_basis_review" | "awaiting_baseline_reuse_confirmation" | "awaiting_difference_review" | "compare_reopen_blocked" | "shortlist_pending" | "ready_for_request_reopen";

// ── State ──
export interface CompareReopenState {
  compareReopenStatus: CompareReopenStatus;
  substatus: CompareReopenSubstatus;
  compareReopenOpenedAt: string;
  sourcingResultReviewObjectId: string;
  compareCandidateIds: string[];
  baselineReuseMode: "full_reuse" | "partial_reuse" | "full_reset" | "pending";
  compareBasisSummary: string;
  shortlistIds: string[];
  excludedIds: string[];
  heldIds: string[];
  requestCandidateIds: string[];
  compareReopenBlockedFlag: boolean;
  compareReopenBlockedReason: string | null;
  compareReopenDecisionSnapshotId: string | null;
}

export function createInitialCompareReopenState(handoff: CompareReopenHandoff): CompareReopenState {
  return {
    compareReopenStatus: "compare_reopen_open",
    substatus: "awaiting_compare_basis_review",
    compareReopenOpenedAt: new Date().toISOString(),
    sourcingResultReviewObjectId: handoff.sourcingResultReviewObjectId,
    compareCandidateIds: handoff.compareCandidateIds,
    baselineReuseMode: handoff.baselineReuseSummary.includes("full") ? "full_reuse" : handoff.baselineReuseSummary.includes("partial") ? "partial_reuse" : "full_reset",
    compareBasisSummary: "",
    shortlistIds: [...handoff.compareCandidateIds],
    excludedIds: [],
    heldIds: [],
    requestCandidateIds: [],
    compareReopenBlockedFlag: handoff.compareReopenReadiness === "blocked",
    compareReopenBlockedReason: handoff.compareReopenReadiness === "blocked" ? "Compare Reopen 조건 미충족" : null,
    compareReopenDecisionSnapshotId: null,
  };
}

// ── Baseline Reuse ──
export interface CompareBaselineReuseDecision { reuseCompareAxis: boolean; reuseShortlistLogic: boolean; reuseExclusionLogic: boolean; resetVendorPreferenceBias: boolean; resetOldRequestCandidateBias: boolean; baselineCarryForwardRiskSummary: string; }
export function buildCompareBaselineReuseDecision(state: CompareReopenState): CompareBaselineReuseDecision {
  const m = state.baselineReuseMode;
  return { reuseCompareAxis: m === "full_reuse" || m === "partial_reuse", reuseShortlistLogic: m === "full_reuse", reuseExclusionLogic: m === "full_reuse", resetVendorPreferenceBias: m === "full_reset" || m === "partial_reuse", resetOldRequestCandidateBias: m !== "full_reuse", baselineCarryForwardRiskSummary: m === "full_reuse" ? "이전 shortlist bias 주의" : m === "partial_reuse" ? "비교 축만 재사용" : "전체 초기화" };
}

// ── Difference Summary ──
export interface CompareReopenDifferenceSummary { priceDeltaSummary: string; leadTimeDeltaSummary: string; specFitDeltaSummary: string; availabilityDeltaSummary: string; vendorFitDeltaSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildCompareReopenDifferenceSummary(candidateCount: number): CompareReopenDifferenceSummary {
  return { priceDeltaSummary: candidateCount >= 2 ? "가격 비교 가능" : "비교 불가", leadTimeDeltaSummary: candidateCount >= 2 ? "납기 비교 가능" : "비교 불가", specFitDeltaSummary: "규격 확인 필요", availabilityDeltaSummary: "재고 확인 필요", vendorFitDeltaSummary: `${candidateCount}개 공급사`, blockingIssues: candidateCount < 2 ? ["비교 가능 후보 2개 미만"] : [], warnings: [] };
}

// ── Decision Plan ──
export interface CompareReopenDecisionPlan { shortlistIds: string[]; excludedIds: string[]; heldIds: string[]; requestCandidateIds: string[]; blockedForRequestIds: string[]; decisionRationaleSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildCompareReopenDecisionPlan(state: CompareReopenState): CompareReopenDecisionPlan {
  return { shortlistIds: state.shortlistIds, excludedIds: state.excludedIds, heldIds: state.heldIds, requestCandidateIds: state.requestCandidateIds, blockedForRequestIds: [], decisionRationaleSummary: `${state.shortlistIds.length}개 shortlist, ${state.requestCandidateIds.length}개 request 후보`, blockingIssues: state.shortlistIds.length === 0 && state.requestCandidateIds.length === 0 ? ["shortlist 또는 request 후보 없음"] : [], warnings: state.heldIds.length > 0 ? [`${state.heldIds.length}개 보류`] : [] };
}

// ── Validator ──
export interface CompareReopenValidation { canRecordCompareReopenDecision: boolean; canOpenRequestReopen: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateCompareReopenBeforeRecord(state: CompareReopenState): CompareReopenValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.compareReopenBlockedFlag) blocking.push(state.compareReopenBlockedReason || "차단됨");
  if (state.compareCandidateIds.length < 2) blocking.push("비교 후보 2개 미만");
  if (state.baselineReuseMode === "pending") { warnings.push("Baseline 미결정"); missing.push("Baseline 결정"); }
  const plan = buildCompareReopenDecisionPlan(state);
  plan.blockingIssues.forEach(b => blocking.push(b));
  plan.warnings.forEach(w => warnings.push(w));
  const canRecord = blocking.length === 0;
  return { canRecordCompareReopenDecision: canRecord, canOpenRequestReopen: canRecord && state.requestCandidateIds.length > 0, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : state.requestCandidateIds.length > 0 ? "Request Reopen으로 보내기" : "Request 후보 지정 후 진행" };
}

// ── Decision Options ──
export interface CompareReopenDecisionOptions { canRecordDecision: boolean; canOpenRequestReopen: boolean; canHold: boolean; canReturnSourcingResult: boolean; decisionReasonSummary: string; }
export function buildCompareReopenDecisionOptions(state: CompareReopenState): CompareReopenDecisionOptions {
  const v = validateCompareReopenBeforeRecord(state);
  return { canRecordDecision: v.canRecordCompareReopenDecision, canOpenRequestReopen: v.canOpenRequestReopen, canHold: state.heldIds.length > 0, canReturnSourcingResult: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Snapshot ──
export interface CompareReopenDecisionSnapshot { id: string; sourcingResultReviewObjectId: string; compareCandidateIds: string[]; baselineReuseSummary: string; compareBasisSummary: string; shortlistIds: string[]; excludedIds: string[]; heldIds: string[]; requestCandidateIds: string[]; recordedAt: string; recordedBy: string; }
export function buildCompareReopenDecisionSnapshot(state: CompareReopenState): CompareReopenDecisionSnapshot {
  return { id: `cmpreopen_${Date.now().toString(36)}`, sourcingResultReviewObjectId: state.sourcingResultReviewObjectId, compareCandidateIds: state.compareCandidateIds, baselineReuseSummary: state.baselineReuseMode, compareBasisSummary: state.compareBasisSummary || `${state.compareCandidateIds.length}개 후보 비교`, shortlistIds: state.shortlistIds, excludedIds: state.excludedIds, heldIds: state.heldIds, requestCandidateIds: state.requestCandidateIds, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Request Reopen Handoff ──
export interface RequestReopenFromCompareHandoff { compareReopenDecisionSnapshotId: string; requestCandidateIds: string[]; shortlistIds: string[]; baselineReuseSummary: string; requestReopenReadiness: "ready" | "pending" | "blocked"; }
export function buildRequestReopenFromCompareHandoff(snapshot: CompareReopenDecisionSnapshot): RequestReopenFromCompareHandoff {
  return { compareReopenDecisionSnapshotId: snapshot.id, requestCandidateIds: snapshot.requestCandidateIds, shortlistIds: snapshot.shortlistIds, baselineReuseSummary: snapshot.baselineReuseSummary, requestReopenReadiness: snapshot.requestCandidateIds.length > 0 ? "ready" : "pending" };
}
