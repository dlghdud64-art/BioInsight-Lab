/**
 * Procurement Re-entry Engine — 조달 재진입 route 분기 + baseline reuse + sourcing reopen handoff
 */

import type { ProcurementReentryHandoff } from "./reorder-decision-engine";

// ── Status ──
export type ProcurementReentryStatus = "procurement_reentry_open" | "procurement_reentry_in_progress" | "procurement_reentry_recorded";
export type ProcurementReentrySubstatus = "awaiting_route_selection" | "awaiting_baseline_reuse_review" | "awaiting_reentry_scope_confirmation" | "procurement_reentry_blocked" | "ready_for_search_reopen" | "ready_for_compare_reopen" | "ready_for_request_reopen";

// ── Route ──
export type ReentryRoute = "search_reopen" | "compare_reopen" | "request_reopen" | "watch_no_reentry" | "blocked_from_reentry";

// ── State ──
export interface ProcurementReentryState {
  procurementReentryStatus: ProcurementReentryStatus;
  substatus: ProcurementReentrySubstatus;
  procurementReentryOpenedAt: string;
  reorderDecisionObjectId: string;
  reorderCandidateQtySummary: string;
  watchCandidateQtySummary: string;
  selectedReentryRoute: ReentryRoute | null;
  baselineReuseStatus: "full_reuse" | "partial_reuse" | "full_reset" | "pending";
  reentryScopeSummary: string;
  missingDecisionCount: number;
  procurementReentryBlockedFlag: boolean;
  procurementReentryBlockedReason: string | null;
  procurementReentryObjectId: string | null;
}

export function createInitialProcurementReentryState(handoff: ProcurementReentryHandoff): ProcurementReentryState {
  return {
    procurementReentryStatus: "procurement_reentry_open",
    substatus: "awaiting_route_selection",
    procurementReentryOpenedAt: new Date().toISOString(),
    reorderDecisionObjectId: handoff.reorderDecisionObjectId,
    reorderCandidateQtySummary: handoff.reorderCandidateQtySummary,
    watchCandidateQtySummary: handoff.watchCandidateQtySummary,
    selectedReentryRoute: null,
    baselineReuseStatus: "pending",
    reentryScopeSummary: "",
    missingDecisionCount: 2,
    procurementReentryBlockedFlag: handoff.procurementReentryReadiness === "blocked",
    procurementReentryBlockedReason: handoff.procurementReentryReadiness === "blocked" ? "Procurement Re-entry 조건 미충족" : null,
    procurementReentryObjectId: null,
  };
}

// ── Route Plan ──
export interface ReentryRoutePlan { recommendedRoute: ReentryRoute; allowedRoutes: ReentryRoute[]; blockedRoutes: ReentryRoute[]; routeRationaleSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildProcurementReentryRoutePlan(state: ProcurementReentryState): ReentryRoutePlan {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (state.procurementReentryBlockedFlag) blocking.push(state.procurementReentryBlockedReason || "차단됨");
  const hasReorder = state.reorderCandidateQtySummary && state.reorderCandidateQtySummary !== "0개";
  const recommended: ReentryRoute = hasReorder ? "search_reopen" : "watch_no_reentry";
  const allowed: ReentryRoute[] = hasReorder ? ["search_reopen", "compare_reopen", "request_reopen"] : ["watch_no_reentry"];
  const blocked: ReentryRoute[] = hasReorder ? [] : ["search_reopen", "compare_reopen", "request_reopen"];
  return { recommendedRoute: recommended, allowedRoutes: allowed, blockedRoutes: blocked, routeRationaleSummary: hasReorder ? "재주문 후보 기반 소싱 재진입" : "Watch 유지 — 즉시 재진입 불필요", blockingIssues: blocking, warnings };
}

// ── Baseline Reuse Plan ──
export interface BaselineReusePlan { reuseSearchContext: boolean; reuseCompareBasis: boolean; reuseRequestLineStructure: boolean; resetVendorBaseline: boolean; baselineCarryForwardRisks: string[]; recommendedBaselineMode: "full_reuse" | "partial_reuse" | "full_reset"; }
export function buildBaselineReusePlan(state: ProcurementReentryState): BaselineReusePlan {
  const route = state.selectedReentryRoute;
  if (route === "request_reopen") return { reuseSearchContext: true, reuseCompareBasis: true, reuseRequestLineStructure: true, resetVendorBaseline: false, baselineCarryForwardRisks: ["이전 공급사 가격 변동 가능"], recommendedBaselineMode: "full_reuse" };
  if (route === "compare_reopen") return { reuseSearchContext: true, reuseCompareBasis: false, reuseRequestLineStructure: false, resetVendorBaseline: false, baselineCarryForwardRisks: ["비교 기준 재설정 필요"], recommendedBaselineMode: "partial_reuse" };
  return { reuseSearchContext: false, reuseCompareBasis: false, reuseRequestLineStructure: false, resetVendorBaseline: true, baselineCarryForwardRisks: [], recommendedBaselineMode: "full_reset" };
}

// ── Validator ──
export interface ProcurementReentryValidation { canRecordProcurementReentry: boolean; canOpenSourcingReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateProcurementReentryBeforeRecord(state: ProcurementReentryState): ProcurementReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.procurementReentryBlockedFlag) blocking.push(state.procurementReentryBlockedReason || "차단됨");
  if (!state.selectedReentryRoute) { blocking.push("재진입 경로 미선택"); missing.push("경로 선택"); }
  if (state.baselineReuseStatus === "pending") { warnings.push("Baseline reuse 미결정"); missing.push("Baseline 결정"); }
  if (state.selectedReentryRoute === "watch_no_reentry") warnings.push("Watch 상태 — 즉시 소싱 재진입 없음");
  const routePlan = buildProcurementReentryRoutePlan(state);
  routePlan.blockingIssues.forEach(b => { if (!blocking.includes(b)) blocking.push(b); });
  const canRecord = blocking.length === 0;
  const canReopen = canRecord && state.selectedReentryRoute !== "watch_no_reentry" && state.selectedReentryRoute !== "blocked_from_reentry";
  return { canRecordProcurementReentry: canRecord, canOpenSourcingReentry: canReopen, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : !canReopen ? "Watch 저장 또는 경로 변경" : "Sourcing Reopen으로 보내기" };
}

// ── Decision Options ──
export interface ProcurementReentryDecisionOptions { canRecordReentry: boolean; canOpenSourcingReentry: boolean; canHoldWatch: boolean; canReturnReorderDecision: boolean; decisionReasonSummary: string; }
export function buildProcurementReentryDecisionOptions(state: ProcurementReentryState): ProcurementReentryDecisionOptions {
  const v = validateProcurementReentryBeforeRecord(state);
  return { canRecordReentry: v.canRecordProcurementReentry, canOpenSourcingReentry: v.canOpenSourcingReentry, canHoldWatch: state.selectedReentryRoute === "watch_no_reentry", canReturnReorderDecision: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface ProcurementReentryObject { id: string; reorderDecisionObjectId: string; reorderCandidateQtySummary: string; watchCandidateQtySummary: string; selectedReentryRoute: ReentryRoute; baselineReuseSummary: string; reentryScopeSummary: string; recordedAt: string; recordedBy: string; }
export function buildProcurementReentryObject(state: ProcurementReentryState): ProcurementReentryObject {
  const baseline = buildBaselineReusePlan(state);
  return { id: `procreentry_${Date.now().toString(36)}`, reorderDecisionObjectId: state.reorderDecisionObjectId, reorderCandidateQtySummary: state.reorderCandidateQtySummary, watchCandidateQtySummary: state.watchCandidateQtySummary, selectedReentryRoute: state.selectedReentryRoute || "watch_no_reentry", baselineReuseSummary: `${baseline.recommendedBaselineMode} — Search: ${baseline.reuseSearchContext}, Compare: ${baseline.reuseCompareBasis}, Request: ${baseline.reuseRequestLineStructure}`, reentryScopeSummary: state.reentryScopeSummary || "미지정", recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Sourcing Reopen Handoff ──
export interface SourcingReopenHandoff { procurementReentryObjectId: string; selectedReentryRoute: ReentryRoute; reorderCandidateQtySummary: string; baselineReuseSummary: string; reentryScopeSummary: string; sourcingReopenReadiness: "ready" | "pending" | "blocked"; }
export function buildSourcingReopenHandoff(obj: ProcurementReentryObject): SourcingReopenHandoff {
  const isWatch = obj.selectedReentryRoute === "watch_no_reentry";
  return { procurementReentryObjectId: obj.id, selectedReentryRoute: obj.selectedReentryRoute, reorderCandidateQtySummary: obj.reorderCandidateQtySummary, baselineReuseSummary: obj.baselineReuseSummary, reentryScopeSummary: obj.reentryScopeSummary, sourcingReopenReadiness: isWatch ? "pending" : "ready" };
}
