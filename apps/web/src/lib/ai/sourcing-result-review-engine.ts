/**
 * Sourcing Result Review Engine — 검색 결과 triage + candidate assembly + compare/request reopen handoff
 *
 * 고정 규칙:
 * 1. result review = search reopen 결과를 compare-ready candidate로 번역하는 canonical gate.
 * 2. search reopen ≠ result review — query seed truth와 candidate truth는 다른 객체.
 * 3. compare candidate / request-direct / excluded를 structured decision으로 저장.
 * 4. canonical sourcing result review object 없이 compare/request reopen 진입 금지.
 * 5. baseline bias가 candidate set을 오염시키면 안 됨.
 */

import type { SourcingSearchResultHandoff } from "./sourcing-search-reopen-engine";

// ── Status ──
export type SourcingResultReviewStatus = "sourcing_result_open" | "sourcing_result_in_progress" | "sourcing_result_review_recorded";
export type SourcingResultReviewSubstatus = "awaiting_result_triage" | "awaiting_compare_candidate_assembly" | "awaiting_request_direct_decision" | "sourcing_result_blocked" | "ready_for_compare_reopen" | "ready_for_request_reopen";

// ── Candidate Decision ──
export type CandidateDecisionType = "compare_candidate" | "request_direct" | "excluded" | "held" | "blocked";

export interface ResultCandidateDecision { candidateId: string; candidateName: string; vendorName: string; decisionType: CandidateDecisionType; fitScore: "high" | "medium" | "low"; baselineBiasFlag: boolean; rationale: string; }

// ── State ──
export interface SourcingResultReviewState {
  sourcingResultReviewStatus: SourcingResultReviewStatus;
  substatus: SourcingResultReviewSubstatus;
  sourcingResultReviewOpenedAt: string;
  sourcingSearchReopenObjectId: string;
  querySeedSummary: string;
  resultCount: number;
  compareCandidateCount: number;
  requestDirectCandidateCount: number;
  excludedCandidateCount: number;
  baselineBiasFlag: boolean;
  missingDecisionCount: number;
  sourcingResultBlockedFlag: boolean;
  sourcingResultBlockedReason: string | null;
  sourcingResultReviewObjectId: string | null;
  candidateDecisions: ResultCandidateDecision[];
}

export function createInitialSourcingResultReviewState(handoff: SourcingSearchResultHandoff): SourcingResultReviewState {
  return {
    sourcingResultReviewStatus: "sourcing_result_open",
    substatus: "awaiting_result_triage",
    sourcingResultReviewOpenedAt: new Date().toISOString(),
    sourcingSearchReopenObjectId: handoff.sourcingSearchReopenObjectId,
    querySeedSummary: handoff.querySeedSummary,
    resultCount: 0,
    compareCandidateCount: 0,
    requestDirectCandidateCount: 0,
    excludedCandidateCount: 0,
    baselineBiasFlag: false,
    missingDecisionCount: 0,
    sourcingResultBlockedFlag: handoff.sourcingResultReadiness === "blocked",
    sourcingResultBlockedReason: handoff.sourcingResultReadiness === "blocked" ? "Result Review 조건 미충족" : null,
    sourcingResultReviewObjectId: null,
    candidateDecisions: [],
  };
}

// ── Triage ──
export interface SourcingResultTriage { highFitCount: number; mediumFitCount: number; excludedCount: number; baselineBiasCount: number; compareSuitableCount: number; requestDirectSuitableCount: number; blockingIssues: string[]; warnings: string[]; }
export function buildSourcingResultTriage(decisions: ResultCandidateDecision[]): SourcingResultTriage {
  const high = decisions.filter(d => d.fitScore === "high");
  const medium = decisions.filter(d => d.fitScore === "medium");
  const excluded = decisions.filter(d => d.decisionType === "excluded");
  const bias = decisions.filter(d => d.baselineBiasFlag);
  const compare = decisions.filter(d => d.decisionType === "compare_candidate");
  const request = decisions.filter(d => d.decisionType === "request_direct");
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (decisions.length === 0) blocking.push("결과 후보 없음");
  if (bias.length > 0) warnings.push(`${bias.length}개 baseline bias 의심`);
  if (compare.length < 2 && request.length === 0) warnings.push("비교 가능 후보 2개 미만");
  return { highFitCount: high.length, mediumFitCount: medium.length, excludedCount: excluded.length, baselineBiasCount: bias.length, compareSuitableCount: compare.length, requestDirectSuitableCount: request.length, blockingIssues: blocking, warnings };
}

// ── Candidate Assembly Plan ──
export interface SourcingCandidateAssemblyPlan { compareCandidateIds: string[]; requestDirectCandidateIds: string[]; excludedCandidateIds: string[]; heldCandidateIds: string[]; blockedCandidateIds: string[]; nextRouteRecommendation: "compare_reopen" | "request_reopen" | "hold" | "blocked"; blockingIssues: string[]; warnings: string[]; }
export function buildSourcingCandidateAssemblyPlan(decisions: ResultCandidateDecision[]): SourcingCandidateAssemblyPlan {
  const compare = decisions.filter(d => d.decisionType === "compare_candidate").map(d => d.candidateId);
  const request = decisions.filter(d => d.decisionType === "request_direct").map(d => d.candidateId);
  const excluded = decisions.filter(d => d.decisionType === "excluded").map(d => d.candidateId);
  const held = decisions.filter(d => d.decisionType === "held").map(d => d.candidateId);
  const blocked = decisions.filter(d => d.decisionType === "blocked").map(d => d.candidateId);
  const route: "compare_reopen" | "request_reopen" | "hold" | "blocked" = compare.length >= 2 ? "compare_reopen" : request.length > 0 ? "request_reopen" : held.length > 0 ? "hold" : "blocked";
  return { compareCandidateIds: compare, requestDirectCandidateIds: request, excludedCandidateIds: excluded, heldCandidateIds: held, blockedCandidateIds: blocked, nextRouteRecommendation: route, blockingIssues: blocked.length > 0 && compare.length === 0 && request.length === 0 ? ["진행 가능 후보 없음"] : [], warnings: held.length > 0 ? [`${held.length}개 보류 후보`] : [] };
}

// ── Validator ──
export interface SourcingResultReviewValidation { canRecordSourcingResultReview: boolean; canOpenCompareReopen: boolean; canOpenRequestReopen: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateSourcingResultReviewBeforeRecord(state: SourcingResultReviewState): SourcingResultReviewValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.sourcingResultBlockedFlag) blocking.push(state.sourcingResultBlockedReason || "차단됨");
  if (state.candidateDecisions.length === 0) { blocking.push("후보 결정 없음"); missing.push("후보별 결정"); }
  const triage = buildSourcingResultTriage(state.candidateDecisions);
  triage.blockingIssues.forEach(b => blocking.push(b));
  triage.warnings.forEach(w => warnings.push(w));
  const plan = buildSourcingCandidateAssemblyPlan(state.candidateDecisions);
  plan.blockingIssues.forEach(b => { if (!blocking.includes(b)) blocking.push(b); });
  const canRecord = blocking.length === 0;
  return { canRecordSourcingResultReview: canRecord, canOpenCompareReopen: canRecord && plan.compareCandidateIds.length >= 2, canOpenRequestReopen: canRecord && plan.requestDirectCandidateIds.length > 0, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : plan.nextRouteRecommendation === "compare_reopen" ? "Compare Reopen으로 보내기" : plan.nextRouteRecommendation === "request_reopen" ? "Request Reopen으로 보내기" : "후보 결정 완료 후 진행" };
}

// ── Decision Options ──
export interface SourcingResultDecisionOptions { canRecordReview: boolean; canOpenCompareReopen: boolean; canOpenRequestReopen: boolean; canHold: boolean; canReturnSearchReopen: boolean; decisionReasonSummary: string; }
export function buildSourcingResultDecisionOptions(state: SourcingResultReviewState): SourcingResultDecisionOptions {
  const v = validateSourcingResultReviewBeforeRecord(state);
  return { canRecordReview: v.canRecordSourcingResultReview, canOpenCompareReopen: v.canOpenCompareReopen, canOpenRequestReopen: v.canOpenRequestReopen, canHold: state.candidateDecisions.some(d => d.decisionType === "held"), canReturnSearchReopen: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface SourcingResultReviewObject { id: string; sourcingSearchReopenObjectId: string; querySeedSummary: string; filterSeedSummary: string; baselineReuseSummary: string; compareCandidateIds: string[]; requestDirectCandidateIds: string[]; excludedCandidateIds: string[]; nextRouteRecommendation: string; recordedAt: string; recordedBy: string; }
export function buildSourcingResultReviewObject(state: SourcingResultReviewState): SourcingResultReviewObject {
  const plan = buildSourcingCandidateAssemblyPlan(state.candidateDecisions);
  return { id: `srcresult_${Date.now().toString(36)}`, sourcingSearchReopenObjectId: state.sourcingSearchReopenObjectId, querySeedSummary: state.querySeedSummary, filterSeedSummary: "", baselineReuseSummary: "", compareCandidateIds: plan.compareCandidateIds, requestDirectCandidateIds: plan.requestDirectCandidateIds, excludedCandidateIds: plan.excludedCandidateIds, nextRouteRecommendation: plan.nextRouteRecommendation, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Compare Reopen Handoff ──
export interface CompareReopenHandoff { sourcingResultReviewObjectId: string; compareCandidateIds: string[]; baselineReuseSummary: string; querySeedSummary: string; compareReopenReadiness: "ready" | "pending" | "blocked"; }
export function buildCompareReopenHandoff(obj: SourcingResultReviewObject): CompareReopenHandoff {
  return { sourcingResultReviewObjectId: obj.id, compareCandidateIds: obj.compareCandidateIds, baselineReuseSummary: obj.baselineReuseSummary, querySeedSummary: obj.querySeedSummary, compareReopenReadiness: obj.compareCandidateIds.length >= 2 ? "ready" : "pending" };
}

// ── Request Reopen Handoff ──
export interface RequestReopenHandoff { sourcingResultReviewObjectId: string; requestDirectCandidateIds: string[]; baselineReuseSummary: string; requestReopenReadiness: "ready" | "pending" | "blocked"; }
export function buildRequestReopenHandoff(obj: SourcingResultReviewObject): RequestReopenHandoff {
  return { sourcingResultReviewObjectId: obj.id, requestDirectCandidateIds: obj.requestDirectCandidateIds, baselineReuseSummary: obj.baselineReuseSummary, requestReopenReadiness: obj.requestDirectCandidateIds.length > 0 ? "ready" : "pending" };
}
