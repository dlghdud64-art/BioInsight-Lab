/**
 * PO Created Re-entry Engine — regenerated PO review + prior created overlap + dispatch bridge + dispatch prep re-entry handoff
 */

import type { PoCreatedReentryHandoff } from "./po-conversion-reentry-engine";

// ── Status ──
export type PoCreatedReentryStatus = "po_created_reentry_open" | "po_created_reentry_in_progress" | "po_created_reentry_recorded";
export type PoCreatedReentrySubstatus = "awaiting_regenerated_identity_review" | "awaiting_created_delta_review" | "awaiting_prior_created_overlap_resolution" | "po_created_reentry_blocked" | "ready_for_dispatch_preparation_reentry";

// ── State ──
export interface PoCreatedReentryState {
  poCreatedReentryStatus: PoCreatedReentryStatus;
  substatus: PoCreatedReentrySubstatus;
  poCreatedReentryOpenedAt: string;
  poConversionReentryDraftObjectId: string;
  approvedCandidateIds: string[];
  regeneratedPoId: string;
  previousCreatedOverlapCount: number;
  createdHeaderDeltaStatus: "reviewed" | "pending" | "blocked";
  createdLineDeltaStatus: "reviewed" | "pending" | "blocked";
  operationalCarryForwardStatus: "reviewed" | "pending" | "blocked";
  sendCriticalReadinessStatus: "ready" | "incomplete" | "blocked";
  missingDecisionCount: number;
  poCreatedReentryBlockedFlag: boolean;
  poCreatedReentryBlockedReason: string | null;
  poCreatedReentryObjectId: string | null;
}

export function createInitialPoCreatedReentryState(handoff: PoCreatedReentryHandoff): PoCreatedReentryState {
  return {
    poCreatedReentryStatus: "po_created_reentry_open",
    substatus: "awaiting_regenerated_identity_review",
    poCreatedReentryOpenedAt: new Date().toISOString(),
    poConversionReentryDraftObjectId: handoff.poConversionReentryDraftObjectId,
    approvedCandidateIds: handoff.approvedCandidateIds,
    regeneratedPoId: `PO-RE-${Date.now().toString(36).toUpperCase()}`,
    previousCreatedOverlapCount: 0,
    createdHeaderDeltaStatus: "pending",
    createdLineDeltaStatus: "pending",
    operationalCarryForwardStatus: "pending",
    sendCriticalReadinessStatus: "incomplete",
    missingDecisionCount: 3,
    poCreatedReentryBlockedFlag: handoff.poCreatedReentryReadiness === "blocked",
    poCreatedReentryBlockedReason: handoff.poCreatedReentryReadiness === "blocked" ? "PO Created Re-entry 조건 미충족" : null,
    poCreatedReentryObjectId: null,
  };
}

// ── Validator ──
export interface PoCreatedReentryValidation { canRecordPoCreatedReentry: boolean; canOpenDispatchPreparationReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validatePoCreatedReentryBeforeRecord(state: PoCreatedReentryState): PoCreatedReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.poCreatedReentryBlockedFlag) blocking.push(state.poCreatedReentryBlockedReason || "차단됨");
  if (state.approvedCandidateIds.length === 0) blocking.push("승인 후보 없음");
  if (state.createdHeaderDeltaStatus === "blocked") blocking.push("Header delta 차단");
  if (state.createdHeaderDeltaStatus === "pending") { warnings.push("Header delta 미검토"); missing.push("Header 검토"); }
  if (state.createdLineDeltaStatus === "pending") { warnings.push("Line delta 미검토"); missing.push("Line 검토"); }
  if (state.operationalCarryForwardStatus === "pending") { warnings.push("Operational carry-forward 미검토"); missing.push("Operational 검토"); }
  if (state.previousCreatedOverlapCount > 0) warnings.push("이전 created overlap 있음");
  const canRecord = blocking.length === 0;
  const canDispatch = canRecord && state.sendCriticalReadinessStatus === "ready";
  return { canRecordPoCreatedReentry: canRecord, canOpenDispatchPreparationReentry: canDispatch, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : !canDispatch ? "Send-critical 필드 완료 후 진행" : "Dispatch Preparation Re-entry로 보내기" };
}

// ── Decision Options ──
export interface PoCreatedReentryDecisionOptions { canRecordCreated: boolean; canOpenDispatchPreparationReentry: boolean; canHold: boolean; canReturnPoConversionReentry: boolean; decisionReasonSummary: string; }
export function buildPoCreatedReentryDecisionOptions(state: PoCreatedReentryState): PoCreatedReentryDecisionOptions {
  const v = validatePoCreatedReentryBeforeRecord(state);
  return { canRecordCreated: v.canRecordPoCreatedReentry, canOpenDispatchPreparationReentry: v.canOpenDispatchPreparationReentry, canHold: v.missingItems.length > 0, canReturnPoConversionReentry: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface PoCreatedReentryObject { id: string; poConversionReentryDraftObjectId: string; approvedCandidateIds: string[]; regeneratedPoIdentitySummary: string; createdHeaderDeltaSummary: string; createdLineDeltaSummary: string; createdOperationalDeltaSummary: string; previousCreatedOverlapSummary: string; sendCriticalBridgeSummary: string; recordedAt: string; recordedBy: string; }
export function buildPoCreatedReentryObject(state: PoCreatedReentryState): PoCreatedReentryObject {
  return { id: `pocreatedre_${Date.now().toString(36)}`, poConversionReentryDraftObjectId: state.poConversionReentryDraftObjectId, approvedCandidateIds: state.approvedCandidateIds, regeneratedPoIdentitySummary: state.regeneratedPoId, createdHeaderDeltaSummary: state.createdHeaderDeltaStatus, createdLineDeltaSummary: state.createdLineDeltaStatus, createdOperationalDeltaSummary: state.operationalCarryForwardStatus, previousCreatedOverlapSummary: state.previousCreatedOverlapCount > 0 ? "충돌 있음" : "충돌 없음", sendCriticalBridgeSummary: state.sendCriticalReadinessStatus, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Dispatch Preparation Re-entry Handoff ──
export interface DispatchPreparationReentryHandoff { poCreatedReentryObjectId: string; approvedCandidateIds: string[]; createdLineDeltaSummary: string; createdOperationalDeltaSummary: string; sendCriticalBridgeSummary: string; dispatchPreparationReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildDispatchPreparationReentryHandoff(obj: PoCreatedReentryObject): DispatchPreparationReentryHandoff {
  return { poCreatedReentryObjectId: obj.id, approvedCandidateIds: obj.approvedCandidateIds, createdLineDeltaSummary: obj.createdLineDeltaSummary, createdOperationalDeltaSummary: obj.createdOperationalDeltaSummary, sendCriticalBridgeSummary: obj.sendCriticalBridgeSummary, dispatchPreparationReentryReadiness: obj.sendCriticalBridgeSummary === "ready" ? "ready" : "pending" };
}
