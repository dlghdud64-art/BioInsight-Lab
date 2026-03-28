/**
 * Procurement Re-entry Reopen Engine — route reclassification + baseline reuse + sourcing reopen handoff
 * 이 단계 완성 → Sourcing Search Reopen (20단계)으로 순환 → 전체 40단계 자기순환 Procurement OS 최종 완성
 */

import type { ProcurementReentryReopenHandoff } from "./reorder-decision-reentry-engine";

export type ProcurementReentryReopenStatus = "procurement_reentry_reopen_open" | "procurement_reentry_reopen_in_progress" | "procurement_reentry_reopen_recorded";
export type ProcurementReentryReopenSubstatus = "awaiting_route_reclassification" | "awaiting_baseline_reuse_recheck" | "awaiting_reopen_scope_confirmation" | "procurement_reentry_reopen_blocked" | "ready_for_sourcing_search_reopen" | "ready_for_compare_reopen" | "ready_for_request_reopen";

export type ReopenRoute = "search_reopen" | "compare_reopen" | "request_reopen" | "watch_only" | "blocked_from_procurement_reopen";

export interface ProcurementReentryReopenState {
  procurementReentryReopenStatus: ProcurementReentryReopenStatus; substatus: ProcurementReentryReopenSubstatus; procurementReentryReopenOpenedAt: string;
  reorderDecisionReentryObjectId: string; reorderCandidateQtySummary: string; watchCandidateQtySummary: string;
  selectedReopenRoute: ReopenRoute | null; baselineReuseMode: "full_reuse" | "partial_reuse" | "full_reset" | "pending"; reopenScopeSummary: string;
  priorProcurementOverlapCount: number; missingDecisionCount: number;
  procurementReentryReopenBlockedFlag: boolean; procurementReentryReopenBlockedReason: string | null; procurementReentryReopenObjectId: string | null;
}

export function createInitialProcurementReentryReopenState(handoff: ProcurementReentryReopenHandoff): ProcurementReentryReopenState {
  const hasReorder = handoff.reorderCandidateQtySummary && handoff.reorderCandidateQtySummary !== "0개";
  return { procurementReentryReopenStatus: "procurement_reentry_reopen_open", substatus: "awaiting_route_reclassification", procurementReentryReopenOpenedAt: new Date().toISOString(), reorderDecisionReentryObjectId: handoff.reorderDecisionReentryObjectId, reorderCandidateQtySummary: handoff.reorderCandidateQtySummary, watchCandidateQtySummary: handoff.watchCandidateQtySummary, selectedReopenRoute: null, baselineReuseMode: "pending", reopenScopeSummary: "", priorProcurementOverlapCount: 0, missingDecisionCount: 2, procurementReentryReopenBlockedFlag: handoff.procurementReentryReopenReadiness === "blocked", procurementReentryReopenBlockedReason: handoff.procurementReentryReopenReadiness === "blocked" ? "Procurement Re-entry Reopen 조건 미충족" : null, procurementReentryReopenObjectId: null };
}

export interface ProcurementReentryReopenValidation { canRecordProcurementReentryReopen: boolean; canOpenSourcingSearchReopen: boolean; canOpenCompareReopen: boolean; canOpenRequestReopen: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateProcurementReentryReopenBeforeRecord(state: ProcurementReentryReopenState): ProcurementReentryReopenValidation {
  const blocking: string[] = []; const warnings: string[] = []; const missing: string[] = [];
  if (state.procurementReentryReopenBlockedFlag) blocking.push(state.procurementReentryReopenBlockedReason || "차단됨");
  if (!state.selectedReopenRoute) { blocking.push("Reopen route 미선택"); missing.push("Route 선택"); }
  if (state.baselineReuseMode === "pending") { warnings.push("Baseline reuse 미결정"); missing.push("Baseline 결정"); }
  if (state.selectedReopenRoute === "watch_only") warnings.push("Watch 상태 — 즉시 reopen 없음");
  const canRecord = blocking.length === 0;
  const route = state.selectedReopenRoute;
  return { canRecordProcurementReentryReopen: canRecord, canOpenSourcingSearchReopen: canRecord && route === "search_reopen", canOpenCompareReopen: canRecord && route === "compare_reopen", canOpenRequestReopen: canRecord && route === "request_reopen", blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : route === "search_reopen" ? "Sourcing Search Reopen으로 보내기" : route === "compare_reopen" ? "Compare Reopen으로 보내기" : route === "request_reopen" ? "Request Reopen으로 보내기" : "Route 선택 후 진행" };
}

export interface ProcurementReentryReopenObject { id: string; reorderDecisionReentryObjectId: string; reorderCandidateQtySummary: string; watchCandidateQtySummary: string; selectedReopenRoute: ReopenRoute; baselineReuseSummary: string; reopenScopeSummary: string; priorProcurementOverlapSummary: string; decisionRationaleSummary: string; recordedAt: string; recordedBy: string; }
export function buildProcurementReentryReopenObject(state: ProcurementReentryReopenState): ProcurementReentryReopenObject {
  return { id: `procreentryreopen_${Date.now().toString(36)}`, reorderDecisionReentryObjectId: state.reorderDecisionReentryObjectId, reorderCandidateQtySummary: state.reorderCandidateQtySummary, watchCandidateQtySummary: state.watchCandidateQtySummary, selectedReopenRoute: state.selectedReopenRoute || "watch_only", baselineReuseSummary: state.baselineReuseMode, reopenScopeSummary: state.reopenScopeSummary || state.reorderCandidateQtySummary, priorProcurementOverlapSummary: state.priorProcurementOverlapCount > 0 ? "충돌 있음" : "충돌 없음", decisionRationaleSummary: `Route: ${state.selectedReopenRoute}, Baseline: ${state.baselineReuseMode}`, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

export interface SourcingSearchReopenFromProcurementHandoff { procurementReentryReopenObjectId: string; selectedReopenRoute: ReopenRoute; reorderCandidateQtySummary: string; baselineReuseSummary: string; reopenScopeSummary: string; sourcingSearchReopenReadiness: "ready" | "pending" | "blocked"; }
export function buildSourcingSearchReopenFromProcurementHandoff(obj: ProcurementReentryReopenObject): SourcingSearchReopenFromProcurementHandoff {
  return { procurementReentryReopenObjectId: obj.id, selectedReopenRoute: obj.selectedReopenRoute, reorderCandidateQtySummary: obj.reorderCandidateQtySummary, baselineReuseSummary: obj.baselineReuseSummary, reopenScopeSummary: obj.reopenScopeSummary, sourcingSearchReopenReadiness: obj.selectedReopenRoute === "search_reopen" ? "ready" : "pending" };
}
