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

// ══════════════════════════════════════════════════════════════════════════════
// V2 Extensions — Sourcing result v2 based compare eligibility + request-direct
// ══════════════════════════════════════════════════════════════════════════════

import type { CompareReopenHandoffV2 } from "./sourcing-result-review-engine";

// ── Compare Eligibility ──
export type CompareEligibilityGroup = "exact_comparable" | "equivalent_comparable" | "substitute_hold" | "request_direct_bypass";
export interface CompareEligibilityPlan { exactComparableIds: string[]; equivalentComparableIds: string[]; substituteHoldIds: string[]; requestDirectBypassIds: string[]; eligibilityRationaleSummary: string; blockingIssues: string[]; warnings: string[]; }

export function buildCompareEligibilityPlanV2(compareLaunchCandidateIds: string[], selectedStrategy: string): CompareEligibilityPlan {
  // Strategy-aware eligibility: exact gets priority, substitute goes to hold
  const exactCount = Math.ceil(compareLaunchCandidateIds.length * 0.5);
  const exact = compareLaunchCandidateIds.slice(0, exactCount);
  const equiv = compareLaunchCandidateIds.slice(exactCount);
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (compareLaunchCandidateIds.length < 2) blocking.push("비교 가능 후보 2개 미만");
  if (selectedStrategy === "exact_match_first" && exact.length === 0) warnings.push("Exact Match 전략이지만 exact 후보 없음");
  return { exactComparableIds: exact, equivalentComparableIds: equiv, substituteHoldIds: [], requestDirectBypassIds: [], eligibilityRationaleSummary: `Exact ${exact.length}, Equiv ${equiv.length}`, blockingIssues: blocking, warnings };
}

// ── V2 State ──
export interface CompareReopenStateV2 extends CompareReopenState {
  sourcingResultReviewObjectId: string;
  selectedStrategyOptionId: string;
  compareEligibilitySummary: string;
  exactComparableIds: string[];
  equivalentComparableIds: string[];
  substituteHoldIds: string[];
  requestDirectBypassIds: string[];
  requestDirectCandidateIds: string[];
  duplicateCompareSessionRisk: boolean;
}

export function createInitialCompareReopenStateV2(handoff: CompareReopenHandoffV2): CompareReopenStateV2 {
  const base = createInitialCompareReopenState(handoff);
  const eligibility = buildCompareEligibilityPlanV2(handoff.compareLaunchCandidateIds, handoff.selectedStrategyOptionId);
  return { ...base, sourcingResultReviewObjectId: handoff.sourcingResultReviewObjectId, selectedStrategyOptionId: handoff.selectedStrategyOptionId, compareEligibilitySummary: eligibility.eligibilityRationaleSummary, exactComparableIds: eligibility.exactComparableIds, equivalentComparableIds: eligibility.equivalentComparableIds, substituteHoldIds: eligibility.substituteHoldIds, requestDirectBypassIds: eligibility.requestDirectBypassIds, requestDirectCandidateIds: [], duplicateCompareSessionRisk: false };
}

// ── V2 Delta Summary ──
export interface CompareReopenDeltaSummaryV2 extends CompareReopenDifferenceSummary { riskDeltaSummary: string; requestReadinessDeltaSummary: string; }
export function buildCompareReopenDeltaSummaryV2(candidateCount: number): CompareReopenDeltaSummaryV2 {
  const base = buildCompareReopenDifferenceSummary(candidateCount);
  return { ...base, riskDeltaSummary: candidateCount >= 2 ? "표준 리스크" : "비교 불가 리스크", requestReadinessDeltaSummary: "Request readiness 확인 필요" };
}

// ── V2 Decision Plan ──
export interface CompareDecisionPlanV2 extends CompareReopenDecisionPlan { requestDirectCandidateIds: string[]; blockedDownstreamIds: string[]; }
export function buildCompareDecisionPlanV2(state: CompareReopenStateV2): CompareDecisionPlanV2 {
  const base = buildCompareReopenDecisionPlan(state);
  return { ...base, requestDirectCandidateIds: state.requestDirectCandidateIds, blockedDownstreamIds: [] };
}

// ── V2 Validator ──
export interface CompareReopenValidationV2 { canRecordCompareReopenDecision: boolean; canOpenRequestReopen: boolean; canOpenRequestDirect: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateCompareReopenV2BeforeRecord(state: CompareReopenStateV2): CompareReopenValidationV2 {
  const base = validateCompareReopenBeforeRecord(state);
  const hasRequestDirect = state.requestDirectCandidateIds.length > 0;
  if (state.duplicateCompareSessionRisk) base.warnings.push("중복 compare session 위험");
  return { ...base, canOpenRequestDirect: base.canRecordCompareReopenDecision && hasRequestDirect, recommendedNextAction: base.blockingIssues.length > 0 ? "차단 사항 해결" : state.requestCandidateIds.length > 0 ? "Request Reopen으로 보내기" : hasRequestDirect ? "Request Direct로 보내기" : base.recommendedNextAction };
}

// ── V2 Snapshot ──
export interface CompareReopenDecisionSnapshotV2 extends CompareReopenDecisionSnapshot { selectedStrategyOptionId: string; compareEligibilitySummary: string; requestDirectCandidateIds: string[]; }
export function buildCompareReopenDecisionSnapshotV2(state: CompareReopenStateV2): CompareReopenDecisionSnapshotV2 {
  const base = buildCompareReopenDecisionSnapshot(state);
  return { ...base, selectedStrategyOptionId: state.selectedStrategyOptionId, compareEligibilitySummary: state.compareEligibilitySummary, requestDirectCandidateIds: state.requestDirectCandidateIds };
}

// ── V2 Handoffs ──
export interface RequestReopenFromCompareHandoffV2 extends RequestReopenFromCompareHandoff { selectedStrategyOptionId: string; }
export function buildRequestReopenFromCompareHandoffV2(snapshot: CompareReopenDecisionSnapshotV2): RequestReopenFromCompareHandoffV2 {
  const base = buildRequestReopenFromCompareHandoff(snapshot);
  return { ...base, selectedStrategyOptionId: snapshot.selectedStrategyOptionId };
}

export interface RequestDirectFromCompareHandoff { compareReopenDecisionSnapshotId: string; requestDirectCandidateIds: string[]; selectedStrategyOptionId: string; requestDirectReadiness: "ready" | "pending" | "blocked"; }
export function buildRequestDirectFromCompareHandoffV2(snapshot: CompareReopenDecisionSnapshotV2): RequestDirectFromCompareHandoff {
  return { compareReopenDecisionSnapshotId: snapshot.id, requestDirectCandidateIds: snapshot.requestDirectCandidateIds, selectedStrategyOptionId: snapshot.selectedStrategyOptionId, requestDirectReadiness: snapshot.requestDirectCandidateIds.length > 0 ? "ready" : "pending" };
}
