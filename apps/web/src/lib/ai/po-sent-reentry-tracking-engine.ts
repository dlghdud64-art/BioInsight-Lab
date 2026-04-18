/**
 * PO Sent Re-entry Tracking Engine — prior sent reconciliation + acknowledgment reclassification + supplier confirmation re-entry handoff
 */

import type { PoSentReentryTrackingHandoff } from "./send-confirmation-reentry-engine";

// ── Status ──
export type PoSentReentryStatus = "po_sent_reentry_open" | "po_sent_reentry_tracking_in_progress" | "supplier_acknowledgment_reentry_recorded";
export type PoSentReentrySubstatus = "awaiting_resent_acknowledgment" | "awaiting_prior_acknowledgment_reconciliation" | "awaiting_followup_reclassification" | "po_sent_reentry_blocked" | "ready_for_supplier_confirmation_reentry";

// ── Acknowledgment Re-entry Status ──
export type AckReentryStatus = "no_response" | "acknowledged" | "partial" | "clarification_required" | "issue_raised";

// ── State ──
export interface PoSentReentryTrackingState {
  poSentReentryStatus: PoSentReentryStatus;
  substatus: PoSentReentrySubstatus;
  poSentReentryOpenedAt: string;
  dispatchReexecutionEventId: string;
  priorSentOverlapCount: number;
  priorAcknowledgmentConflictCount: number;
  acknowledgmentReentryStatus: AckReentryStatus;
  followupRequiredFlag: boolean;
  clarificationRequiredFlag: boolean;
  responseFreshnessStatus: "fresh" | "stale" | "unknown";
  missingDecisionCount: number;
  poSentReentryBlockedFlag: boolean;
  poSentReentryBlockedReason: string | null;
  supplierAcknowledgmentReentryObjectId: string | null;
}

export function createInitialPoSentReentryTrackingState(handoff: PoSentReentryTrackingHandoff): PoSentReentryTrackingState {
  return {
    poSentReentryStatus: "po_sent_reentry_open",
    substatus: "awaiting_resent_acknowledgment",
    poSentReentryOpenedAt: new Date().toISOString(),
    dispatchReexecutionEventId: handoff.dispatchReexecutionEventId,
    priorSentOverlapCount: 0,
    priorAcknowledgmentConflictCount: 0,
    acknowledgmentReentryStatus: "no_response",
    followupRequiredFlag: false,
    clarificationRequiredFlag: false,
    responseFreshnessStatus: "unknown",
    missingDecisionCount: 1,
    poSentReentryBlockedFlag: handoff.poSentReentryTrackingReadiness === "blocked",
    poSentReentryBlockedReason: handoff.poSentReentryTrackingReadiness === "blocked" ? "Sent Re-entry 조건 미충족" : null,
    supplierAcknowledgmentReentryObjectId: null,
  };
}

// ── Validator ──
export interface PoSentReentryValidation { canRecordSupplierAcknowledgmentReentry: boolean; canOpenSupplierConfirmationReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateSupplierAcknowledgmentReentryBeforeRecord(state: PoSentReentryTrackingState): PoSentReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.poSentReentryBlockedFlag) blocking.push(state.poSentReentryBlockedReason || "차단됨");
  if (state.acknowledgmentReentryStatus === "no_response") { warnings.push("공급사 응답 없음"); missing.push("Acknowledgment"); }
  if (state.priorAcknowledgmentConflictCount > 0) warnings.push("이전 acknowledgment 충돌");
  if (state.clarificationRequiredFlag) warnings.push("Clarification 필요");
  if (state.followupRequiredFlag) warnings.push("Follow-up 필요");
  const canRecord = blocking.length === 0;
  const canConfirm = canRecord && (state.acknowledgmentReentryStatus === "acknowledged" || state.acknowledgmentReentryStatus === "partial");
  return { canRecordSupplierAcknowledgmentReentry: canRecord, canOpenSupplierConfirmationReentry: canConfirm, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : canConfirm ? "Supplier Confirmation Re-entry로 보내기" : "응답 대기 또는 Follow-up" };
}

// ── Decision Options ──
export interface SentReentryDecisionOptions { canRecordAcknowledgmentReentry: boolean; canOpenSupplierConfirmationReentry: boolean; canHold: boolean; canReturnSendConfirmationReentry: boolean; decisionReasonSummary: string; }
export function buildSentReentryDecisionOptions(state: PoSentReentryTrackingState): SentReentryDecisionOptions {
  const v = validateSupplierAcknowledgmentReentryBeforeRecord(state);
  return { canRecordAcknowledgmentReentry: v.canRecordSupplierAcknowledgmentReentry, canOpenSupplierConfirmationReentry: v.canOpenSupplierConfirmationReentry, canHold: state.acknowledgmentReentryStatus === "no_response", canReturnSendConfirmationReentry: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface SupplierAcknowledgmentReentryObject { id: string; dispatchReexecutionEventId: string; priorSentReconciliationSummary: string; acknowledgmentReentryStatus: AckReentryStatus; followupRequiredSummary: string; clarificationRequiredSummary: string; responseFreshnessSummary: string; resendTrackingSummary: string; recordedAt: string; recordedBy: string; }
export function buildSupplierAcknowledgmentReentryObject(state: PoSentReentryTrackingState): SupplierAcknowledgmentReentryObject {
  return { id: `sackre_${Date.now().toString(36)}`, dispatchReexecutionEventId: state.dispatchReexecutionEventId, priorSentReconciliationSummary: state.priorSentOverlapCount > 0 ? `${state.priorSentOverlapCount}개 overlap` : "충돌 없음", acknowledgmentReentryStatus: state.acknowledgmentReentryStatus, followupRequiredSummary: state.followupRequiredFlag ? "Follow-up 필요" : "불필요", clarificationRequiredSummary: state.clarificationRequiredFlag ? "Clarification 필요" : "불필요", responseFreshnessSummary: state.responseFreshnessStatus, resendTrackingSummary: state.acknowledgmentReentryStatus === "acknowledged" ? "확인 완료" : state.acknowledgmentReentryStatus === "no_response" ? "응답 없음" : "진행 중", recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Supplier Confirmation Re-entry Handoff ──
export interface SupplierConfirmationReentryHandoff { supplierAcknowledgmentReentryObjectId: string; acknowledgmentReentryStatus: AckReentryStatus; followupRequiredSummary: string; clarificationRequiredSummary: string; responseFreshnessSummary: string; supplierConfirmationReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildSupplierConfirmationReentryHandoff(obj: SupplierAcknowledgmentReentryObject): SupplierConfirmationReentryHandoff {
  const isReady = obj.acknowledgmentReentryStatus === "acknowledged" || obj.acknowledgmentReentryStatus === "partial";
  return { supplierAcknowledgmentReentryObjectId: obj.id, acknowledgmentReentryStatus: obj.acknowledgmentReentryStatus, followupRequiredSummary: obj.followupRequiredSummary, clarificationRequiredSummary: obj.clarificationRequiredSummary, responseFreshnessSummary: obj.responseFreshnessSummary, supplierConfirmationReentryReadiness: isReady ? "ready" : "pending" };
}
