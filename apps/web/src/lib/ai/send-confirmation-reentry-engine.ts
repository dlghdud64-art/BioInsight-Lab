/**
 * Send Confirmation Re-entry Engine — final resend confirmation + resend guard + dispatch re-execution event + sent tracking handoff
 */

import type { SendConfirmationReentryHandoff } from "./dispatch-preparation-reentry-engine";

// ── Status ──
export type SendConfirmationReentryStatus = "send_confirmation_reentry_open" | "send_confirmation_reentry_in_progress" | "dispatch_reexecution_recorded";
export type SendConfirmationReentrySubstatus = "awaiting_final_recipient_recheck" | "awaiting_final_payload_recheck" | "awaiting_attachment_recheck" | "send_confirmation_reentry_blocked" | "ready_for_sent_reentry_tracking";

// ── State ──
export interface SendConfirmationReentryState {
  sendConfirmationReentryStatus: SendConfirmationReentryStatus;
  substatus: SendConfirmationReentrySubstatus;
  sendConfirmationReentryOpenedAt: string;
  dispatchPreparationReentryObjectId: string;
  finalRecipientCount: number;
  attachmentBundleCount: number;
  channelRevalidationStatus: "confirmed" | "pending" | "changed";
  payloadFreshnessStatus: "fresh" | "stale" | "unknown";
  duplicateResendRiskFlag: boolean;
  priorSendOverlapCount: number;
  missingDecisionCount: number;
  sendConfirmationReentryBlockedFlag: boolean;
  sendConfirmationReentryBlockedReason: string | null;
  dispatchReexecutionEventId: string | null;
  // ── Fields ──
  finalRecipient: string;
  finalChannel: string;
  finalPayloadSummary: string;
}

export function createInitialSendConfirmationReentryState(handoff: SendConfirmationReentryHandoff): SendConfirmationReentryState {
  return {
    sendConfirmationReentryStatus: "send_confirmation_reentry_open",
    substatus: "awaiting_final_recipient_recheck",
    sendConfirmationReentryOpenedAt: new Date().toISOString(),
    dispatchPreparationReentryObjectId: handoff.dispatchPreparationReentryObjectId,
    finalRecipientCount: 0,
    attachmentBundleCount: 1,
    channelRevalidationStatus: "pending",
    payloadFreshnessStatus: "unknown",
    duplicateResendRiskFlag: false,
    priorSendOverlapCount: 0,
    missingDecisionCount: 2,
    sendConfirmationReentryBlockedFlag: handoff.sendConfirmationReentryReadiness === "blocked",
    sendConfirmationReentryBlockedReason: handoff.sendConfirmationReentryReadiness === "blocked" ? "Send Confirmation Re-entry 조건 미충족" : null,
    dispatchReexecutionEventId: null,
    finalRecipient: handoff.recipientRevalidationSummary !== "미지정" ? handoff.recipientRevalidationSummary : "",
    finalChannel: "email",
    finalPayloadSummary: handoff.outboundPayloadDeltaSummary,
  };
}

// ── Resend Guards ──
export interface ResendReentryGuards { duplicateResendRisk: boolean; unchangedPayloadRisk: boolean; alreadySentConflict: boolean; priorSendOverlapRequiresReview: boolean; recipientOverrideRequiresReview: boolean; stalePayloadFlag: boolean; blockingIssues: string[]; warnings: string[]; }
export function evaluateSendConfirmationReentryGuards(state: SendConfirmationReentryState): ResendReentryGuards {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (state.sendConfirmationReentryBlockedFlag) blocking.push(state.sendConfirmationReentryBlockedReason || "차단됨");
  if (state.duplicateResendRiskFlag) warnings.push("중복 재발송 위험");
  if (state.payloadFreshnessStatus === "stale") warnings.push("Stale payload");
  if (!state.finalRecipient) blocking.push("수신자 미지정");
  if (state.priorSendOverlapCount > 0) warnings.push("이전 발송 overlap");
  return { duplicateResendRisk: state.duplicateResendRiskFlag, unchangedPayloadRisk: false, alreadySentConflict: false, priorSendOverlapRequiresReview: state.priorSendOverlapCount > 0, recipientOverrideRequiresReview: false, stalePayloadFlag: state.payloadFreshnessStatus === "stale", blockingIssues: blocking, warnings };
}

// ── Validator ──
export interface SendConfirmationReentryValidation { canRecordDispatchReexecution: boolean; canOpenPoSentReentryTracking: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateSendConfirmationReentryBeforeRecord(state: SendConfirmationReentryState): SendConfirmationReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  const guards = evaluateSendConfirmationReentryGuards(state);
  guards.blockingIssues.forEach(b => blocking.push(b));
  guards.warnings.forEach(w => warnings.push(w));
  if (state.channelRevalidationStatus === "pending") { warnings.push("채널 미확인"); missing.push("채널 확인"); }
  if (state.dispatchReexecutionEventId) blocking.push("이미 재발송됨");
  const canRecord = blocking.length === 0;
  return { canRecordDispatchReexecution: canRecord, canOpenPoSentReentryTracking: canRecord, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : "PO Sent Re-entry Tracking으로 보내기" };
}

// ── Decision Options ──
export interface SendConfirmationReentryDecisionOptions { canRecordExecution: boolean; canOpenPoSentReentryTracking: boolean; canHold: boolean; canReturnDispatchPrepReentry: boolean; decisionReasonSummary: string; }
export function buildSendConfirmationReentryDecisionOptions(state: SendConfirmationReentryState): SendConfirmationReentryDecisionOptions {
  const v = validateSendConfirmationReentryBeforeRecord(state);
  return { canRecordExecution: v.canRecordDispatchReexecution, canOpenPoSentReentryTracking: v.canOpenPoSentReentryTracking, canHold: v.missingItems.length > 0, canReturnDispatchPrepReentry: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Event ──
export interface DispatchReexecutionEvent { id: string; dispatchPreparationReentryObjectId: string; finalRecipientSummary: string; finalChannelSummary: string; finalPayloadSummary: string; finalAttachmentBundleSummary: string; resendGuardSummary: string; sendCriticalBridgeSummary: string; recordedAt: string; recordedBy: string; }
export function buildDispatchReexecutionEvent(state: SendConfirmationReentryState): DispatchReexecutionEvent {
  return { id: `dispreexec_${Date.now().toString(36)}`, dispatchPreparationReentryObjectId: state.dispatchPreparationReentryObjectId, finalRecipientSummary: state.finalRecipient, finalChannelSummary: state.finalChannel, finalPayloadSummary: state.finalPayloadSummary, finalAttachmentBundleSummary: `${state.attachmentBundleCount}개`, resendGuardSummary: state.duplicateResendRiskFlag ? "중복 위험 있음" : "중복 위험 없음", sendCriticalBridgeSummary: "재발송 완료", recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── PO Sent Re-entry Tracking Handoff ──
export interface PoSentReentryTrackingHandoff { dispatchReexecutionEventId: string; finalRecipientSummary: string; finalPayloadSummary: string; finalAttachmentBundleSummary: string; resendGuardSummary: string; poSentReentryTrackingReadiness: "ready" | "pending" | "blocked"; }
export function buildPoSentReentryTrackingHandoff(event: DispatchReexecutionEvent): PoSentReentryTrackingHandoff {
  return { dispatchReexecutionEventId: event.id, finalRecipientSummary: event.finalRecipientSummary, finalPayloadSummary: event.finalPayloadSummary, finalAttachmentBundleSummary: event.finalAttachmentBundleSummary, resendGuardSummary: event.resendGuardSummary, poSentReentryTrackingReadiness: "ready" };
}
