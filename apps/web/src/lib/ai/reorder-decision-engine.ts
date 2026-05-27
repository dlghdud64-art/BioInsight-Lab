/**
 * Reorder Decision Engine — shortage/risk 판단 + reorder/watch 분기 + procurement re-entry handoff
 */

import type { ReorderDecisionHandoff } from "./stock-release-engine";

// ── Status ──
export type ReorderDecisionStatus = "reorder_decision_open" | "reorder_decision_in_progress" | "reorder_decision_recorded";
export type ReorderDecisionSubstatus = "awaiting_shortage_review" | "awaiting_expiry_risk_review" | "awaiting_reorder_vs_watch_decision" | "reorder_decision_blocked" | "watch_only_recorded" | "ready_for_procurement_reentry";

// ── Decision Type ──
export type ReorderCandidateType = "reorder_candidate" | "watch_only" | "blocked_from_reorder" | "requires_followup";

// ── Risk Assessment ──
export interface ReorderRiskAssessment { shortageStatus: "critical" | "warning" | "adequate" | "surplus"; coverageRiskStatus: "critical" | "low" | "adequate"; expiryRiskStatus: "critical" | "warning" | "none"; lotHealthRiskStatus: "critical" | "warning" | "healthy"; pendingInboundOffset: string; blockingIssues: string[]; warnings: string[]; }

// ── State ──
export interface ReorderDecisionState {
  reorderDecisionStatus: ReorderDecisionStatus;
  substatus: ReorderDecisionSubstatus;
  reorderDecisionOpenedAt: string;
  availableStockReleaseObjectId: string;
  releasableQtySummary: string;
  coverageRiskStatus: "critical" | "low" | "adequate";
  expiryRiskStatus: "critical" | "warning" | "none";
  reorderCandidateQtySummary: string;
  watchCandidateQtySummary: string;
  missingDecisionCount: number;
  reorderDecisionBlockedFlag: boolean;
  reorderDecisionBlockedReason: string | null;
  reorderDecisionObjectId: string | null;
  candidateDecisions: ItemReorderDecision[];
}

export interface ItemReorderDecision { itemId: string; itemName: string; decisionType: ReorderCandidateType; reorderQty: number; urgency: "immediate" | "normal" | "watch"; rationale: string; }

export function createInitialReorderDecisionState(handoff: ReorderDecisionHandoff): ReorderDecisionState {
  return {
    reorderDecisionStatus: "reorder_decision_open",
    substatus: "awaiting_shortage_review",
    reorderDecisionOpenedAt: new Date().toISOString(),
    availableStockReleaseObjectId: handoff.availableStockReleaseObjectId,
    releasableQtySummary: handoff.releasableQtySummary,
    coverageRiskStatus: "adequate",
    expiryRiskStatus: "none",
    reorderCandidateQtySummary: "",
    watchCandidateQtySummary: "",
    missingDecisionCount: 0,
    reorderDecisionBlockedFlag: handoff.reorderDecisionReadiness === "blocked",
    reorderDecisionBlockedReason: handoff.reorderDecisionReadiness === "blocked" ? "Reorder Decision 조건 미충족" : null,
    reorderDecisionObjectId: null,
    candidateDecisions: [],
  };
}

// ── Risk Assessment Builder ──
export function buildReorderRiskAssessment(state: ReorderDecisionState): ReorderRiskAssessment {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (state.coverageRiskStatus === "critical") blocking.push("커버리지 위험 — 즉시 재주문 필요");
  if (state.coverageRiskStatus === "low") warnings.push("커버리지 낮음 — 재주문 검토 필요");
  if (state.expiryRiskStatus === "critical") blocking.push("유효기한 임박 재고 — 대체 재주문 필요");
  if (state.expiryRiskStatus === "warning") warnings.push("유효기한 주의 재고 있음");
  return { shortageStatus: state.coverageRiskStatus === "critical" ? "critical" : state.coverageRiskStatus === "low" ? "warning" : "adequate", coverageRiskStatus: state.coverageRiskStatus, expiryRiskStatus: state.expiryRiskStatus, lotHealthRiskStatus: "healthy", pendingInboundOffset: "없음", blockingIssues: blocking, warnings };
}

// ── Decision Plan ──
export interface ReorderDecisionPlan { reorderCandidateItemIds: string[]; watchOnlyItemIds: string[]; blockedItemIds: string[]; followupRequiredItemIds: string[]; recommendedReorderQtySummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildReorderDecisionPlan(decisions: ItemReorderDecision[]): ReorderDecisionPlan {
  const reorder = decisions.filter(d => d.decisionType === "reorder_candidate");
  const watch = decisions.filter(d => d.decisionType === "watch_only");
  const blocked = decisions.filter(d => d.decisionType === "blocked_from_reorder");
  const followup = decisions.filter(d => d.decisionType === "requires_followup");
  return { reorderCandidateItemIds: reorder.map(d => d.itemId), watchOnlyItemIds: watch.map(d => d.itemId), blockedItemIds: blocked.map(d => d.itemId), followupRequiredItemIds: followup.map(d => d.itemId), recommendedReorderQtySummary: `${reorder.reduce((s, d) => s + d.reorderQty, 0)}개`, blockingIssues: blocked.length > 0 ? [`${blocked.length}개 차단됨`] : [], warnings: followup.length > 0 ? [`${followup.length}개 추가 확인 필요`] : [] };
}

// ── Validator ──
export interface ReorderDecisionValidation { canRecordReorderDecision: boolean; canOpenProcurementReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateReorderDecisionBeforeRecord(state: ReorderDecisionState): ReorderDecisionValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.reorderDecisionBlockedFlag) blocking.push(state.reorderDecisionBlockedReason || "차단됨");
  if (state.candidateDecisions.length === 0) blocking.push("품목별 결정 없음");
  const plan = buildReorderDecisionPlan(state.candidateDecisions);
  plan.blockingIssues.forEach(b => blocking.push(b));
  plan.warnings.forEach(w => warnings.push(w));
  const risk = buildReorderRiskAssessment(state);
  risk.blockingIssues.forEach(b => { if (!blocking.includes(b)) blocking.push(b); });
  risk.warnings.forEach(w => { if (!warnings.includes(w)) warnings.push(w); });
  const canRecord = blocking.length === 0;
  const canReentry = canRecord && plan.reorderCandidateItemIds.length > 0;
  return { canRecordReorderDecision: canRecord, canOpenProcurementReentry: canReentry, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : !canReentry ? "Reorder 후보 지정 후 진행" : "Procurement Re-entry로 보내기" };
}

// ── Decision Options ──
export interface ReorderDecisionOptions { canRecordDecision: boolean; canOpenProcurementReentry: boolean; canHold: boolean; canReturnStockRelease: boolean; decisionReasonSummary: string; }
export function buildReorderDecisionOptions(state: ReorderDecisionState): ReorderDecisionOptions {
  const v = validateReorderDecisionBeforeRecord(state);
  return { canRecordDecision: v.canRecordReorderDecision, canOpenProcurementReentry: v.canOpenProcurementReentry, canHold: state.candidateDecisions.some(d => d.decisionType === "watch_only"), canReturnStockRelease: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface ReorderDecisionObject { id: string; availableStockReleaseObjectId: string; releasableQtySummary: string; coverageRiskStatus: string; expiryRiskStatus: string; reorderCandidateQtySummary: string; watchCandidateQtySummary: string; procurementRouteSummary: string; recordedAt: string; recordedBy: string; }
export function buildReorderDecisionObject(state: ReorderDecisionState): ReorderDecisionObject {
  const plan = buildReorderDecisionPlan(state.candidateDecisions);
  return { id: `reorder_${Date.now().toString(36)}`, availableStockReleaseObjectId: state.availableStockReleaseObjectId, releasableQtySummary: state.releasableQtySummary, coverageRiskStatus: state.coverageRiskStatus, expiryRiskStatus: state.expiryRiskStatus, reorderCandidateQtySummary: plan.recommendedReorderQtySummary, watchCandidateQtySummary: `${plan.watchOnlyItemIds.length}개`, procurementRouteSummary: plan.reorderCandidateItemIds.length > 0 ? "소싱 재진입" : "Watch 유지", recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Procurement Re-entry Handoff ──
export interface ProcurementReentryHandoff { reorderDecisionObjectId: string; availableStockReleaseObjectId: string; reorderCandidateQtySummary: string; watchCandidateQtySummary: string; procurementRouteSummary: string; procurementReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildProcurementReentryHandoff(obj: ReorderDecisionObject): ProcurementReentryHandoff {
  return { reorderDecisionObjectId: obj.id, availableStockReleaseObjectId: obj.availableStockReleaseObjectId, reorderCandidateQtySummary: obj.reorderCandidateQtySummary, watchCandidateQtySummary: obj.watchCandidateQtySummary, procurementRouteSummary: obj.procurementRouteSummary, procurementReentryReadiness: obj.procurementRouteSummary.includes("소싱") ? "ready" : "pending" };
}
