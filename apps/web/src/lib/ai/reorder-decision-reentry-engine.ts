/**
 * Reorder Decision Re-entry Engine — shortage/risk 재판단 + reorder/watch 재분류 + procurement re-entry reopen handoff
 * 이 단계 완성 → Procurement Re-entry (19단계)로 순환 → 전체 cycle 자기 자신으로 복귀 (COMPLETE)
 */

import type { ReorderDecisionReentryHandoff } from "./stock-release-reentry-engine";

export type ReorderDecisionReentryStatus = "reorder_decision_reentry_open" | "reorder_decision_reentry_in_progress" | "reorder_decision_reentry_recorded";
export type ReorderDecisionReentrySubstatus = "awaiting_refreshed_shortage_review" | "awaiting_expiry_risk_recheck" | "awaiting_reorder_vs_watch_reclassification" | "reorder_decision_reentry_blocked" | "ready_for_procurement_reentry_reopen";

export type ReorderReentryDecisionType = "reorder_candidate" | "watch_only" | "blocked_from_reorder" | "requires_followup" | "no_reorder_needed";
export interface ReorderReentryItemDecision { itemId: string; itemName: string; decisionType: ReorderReentryDecisionType; reorderQty: number; urgency: "immediate" | "normal" | "watch"; rationale: string; }

export interface ReorderDecisionReentryState {
  reorderDecisionReentryStatus: ReorderDecisionReentryStatus; substatus: ReorderDecisionReentrySubstatus; reorderDecisionReentryOpenedAt: string; availableStockReleaseReentryObjectId: string;
  releasableQtySummary: string; coverageRiskStatus: "critical" | "low" | "adequate"; expiryRiskStatus: "critical" | "warning" | "none";
  reorderCandidateQtySummary: string; watchCandidateQtySummary: string; priorReorderOverlapCount: number; followupRequiredCount: number;
  missingDecisionCount: number; reorderDecisionReentryBlockedFlag: boolean; reorderDecisionReentryBlockedReason: string | null; reorderDecisionReentryObjectId: string | null;
  candidateDecisions: ReorderReentryItemDecision[];
}

export function createInitialReorderDecisionReentryState(handoff: ReorderDecisionReentryHandoff): ReorderDecisionReentryState {
  return { reorderDecisionReentryStatus: "reorder_decision_reentry_open", substatus: "awaiting_refreshed_shortage_review", reorderDecisionReentryOpenedAt: new Date().toISOString(), availableStockReleaseReentryObjectId: handoff.availableStockReleaseReentryObjectId, releasableQtySummary: handoff.releasableQtySummary, coverageRiskStatus: "adequate", expiryRiskStatus: "none", reorderCandidateQtySummary: "", watchCandidateQtySummary: "", priorReorderOverlapCount: 0, followupRequiredCount: 0, missingDecisionCount: 1, reorderDecisionReentryBlockedFlag: handoff.reorderDecisionReentryReadiness === "blocked", reorderDecisionReentryBlockedReason: handoff.reorderDecisionReentryReadiness === "blocked" ? "Reorder Re-entry 조건 미충족" : null, reorderDecisionReentryObjectId: null, candidateDecisions: [] };
}

export interface ReorderDecisionReentryValidation { canRecordReorderDecisionReentry: boolean; canOpenProcurementReentryReopen: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateReorderDecisionReentryBeforeRecord(state: ReorderDecisionReentryState): ReorderDecisionReentryValidation {
  const blocking: string[] = []; const warnings: string[] = []; const missing: string[] = [];
  if (state.reorderDecisionReentryBlockedFlag) blocking.push(state.reorderDecisionReentryBlockedReason || "차단됨");
  if (state.candidateDecisions.length === 0) { blocking.push("품목별 결정 없음"); missing.push("품목 결정"); }
  if (state.coverageRiskStatus === "critical") warnings.push("커버리지 위험");
  if (state.expiryRiskStatus === "critical") warnings.push("유효기한 위험");
  const reorder = state.candidateDecisions.filter(d => d.decisionType === "reorder_candidate");
  const canRecord = blocking.length === 0;
  const canReopen = canRecord && reorder.length > 0;
  return { canRecordReorderDecisionReentry: canRecord, canOpenProcurementReentryReopen: canReopen, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : canReopen ? "Procurement Re-entry Reopen으로 보내기" : "Reorder 후보 지정 후 진행" };
}

export interface ReorderDecisionReentryObject { id: string; availableStockReleaseReentryObjectId: string; releasableQtySummary: string; coverageRiskStatus: string; expiryRiskStatus: string; reorderCandidateQtySummary: string; watchCandidateQtySummary: string; priorReorderOverlapSummary: string; decisionRationaleSummary: string; recordedAt: string; recordedBy: string; }
export function buildReorderDecisionReentryObject(state: ReorderDecisionReentryState): ReorderDecisionReentryObject {
  const reorder = state.candidateDecisions.filter(d => d.decisionType === "reorder_candidate");
  const watch = state.candidateDecisions.filter(d => d.decisionType === "watch_only");
  return { id: `reorderre_${Date.now().toString(36)}`, availableStockReleaseReentryObjectId: state.availableStockReleaseReentryObjectId, releasableQtySummary: state.releasableQtySummary, coverageRiskStatus: state.coverageRiskStatus, expiryRiskStatus: state.expiryRiskStatus, reorderCandidateQtySummary: `${reorder.reduce((s, d) => s + d.reorderQty, 0)}개`, watchCandidateQtySummary: `${watch.length}개`, priorReorderOverlapSummary: state.priorReorderOverlapCount > 0 ? "충돌 있음" : "충돌 없음", decisionRationaleSummary: `Reorder ${reorder.length}, Watch ${watch.length}`, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

export interface ProcurementReentryReopenHandoff { reorderDecisionReentryObjectId: string; reorderCandidateQtySummary: string; watchCandidateQtySummary: string; coverageRiskStatus: string; expiryRiskStatus: string; procurementReentryReopenReadiness: "ready" | "pending" | "blocked"; }
export function buildProcurementReentryReopenHandoff(obj: ReorderDecisionReentryObject): ProcurementReentryReopenHandoff {
  return { reorderDecisionReentryObjectId: obj.id, reorderCandidateQtySummary: obj.reorderCandidateQtySummary, watchCandidateQtySummary: obj.watchCandidateQtySummary, coverageRiskStatus: obj.coverageRiskStatus, expiryRiskStatus: obj.expiryRiskStatus, procurementReentryReopenReadiness: obj.reorderCandidateQtySummary !== "0개" ? "ready" : "pending" };
}
