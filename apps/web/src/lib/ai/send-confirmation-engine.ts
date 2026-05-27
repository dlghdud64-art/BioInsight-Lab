/**
 * Send Confirmation Engine — 발송 최종 확인 + execution event + PO sent handoff
 */

import type { SendConfirmationHandoff } from "./dispatch-preparation-engine";

// ── Status ──
export type SendConfirmationStatus = "send_confirmation_open" | "send_confirmation_in_progress" | "dispatch_executed_recorded";
export type SendConfirmationSubstatus = "awaiting_final_recipient_confirm" | "awaiting_payload_confirm" | "awaiting_attachment_confirm" | "send_confirmation_blocked" | "ready_for_dispatch_execute" | "sent_to_tracking_handoff_ready";

// ── State ──
export interface SendConfirmationState {
  sendConfirmationStatus: SendConfirmationStatus;
  substatus: SendConfirmationSubstatus;
  sendConfirmationOpenedAt: string;
  dispatchPreparationObjectId: string;
  poCreatedObjectId: string;
  primaryRecipient: string;
  sendChannel: string;
  outboundSummary: string;
  attachmentBundleSummary: string;
  payloadVersionId: string;
  missingFieldCount: number;
  sendBlockedFlag: boolean;
  sendBlockedReason: string | null;
  dispatchExecutionEventId: string | null;
}

export function createInitialSendConfirmationState(handoff: SendConfirmationHandoff): SendConfirmationState {
  return {
    sendConfirmationStatus: "send_confirmation_open",
    substatus: handoff.sendConfirmationReadiness === "ready" ? "ready_for_dispatch_execute" : "awaiting_final_recipient_confirm",
    sendConfirmationOpenedAt: new Date().toISOString(),
    dispatchPreparationObjectId: handoff.dispatchPreparationObjectId,
    poCreatedObjectId: handoff.poCreatedObjectId,
    primaryRecipient: handoff.primaryRecipient,
    sendChannel: handoff.sendChannel,
    outboundSummary: handoff.outboundSummary,
    attachmentBundleSummary: handoff.attachmentBundleSummary,
    payloadVersionId: `pv_${Date.now().toString(36)}`,
    missingFieldCount: 0,
    sendBlockedFlag: handoff.sendConfirmationReadiness === "blocked",
    sendBlockedReason: handoff.sendConfirmationReadiness === "blocked" ? "발송 조건 미충족" : null,
    dispatchExecutionEventId: null,
  };
}

// ── Execution Guards ──
export interface DispatchExecutionGuards { duplicateSendRisk: boolean; payloadStaleFlag: boolean; recipientOverrideRequiresReview: boolean; attachmentMismatchFlag: boolean; alreadySentConflict: boolean; blockingIssues: string[]; warnings: string[]; }
export function evaluateDispatchExecutionGuards(state: SendConfirmationState): DispatchExecutionGuards {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (state.sendBlockedFlag) blocking.push(state.sendBlockedReason || "차단됨");
  if (!state.primaryRecipient) blocking.push("수신자 미지정");
  if (!state.outboundSummary && !state.attachmentBundleSummary) blocking.push("발송 내용 없음");
  return { duplicateSendRisk: false, payloadStaleFlag: false, recipientOverrideRequiresReview: false, attachmentMismatchFlag: false, alreadySentConflict: !!state.dispatchExecutionEventId, blockingIssues: blocking, warnings };
}

// ── Validator ──
export interface SendExecutionValidation { canRecordDispatchExecution: boolean; canOpenPoSentDetail: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateDispatchExecutionBeforeRecord(state: SendConfirmationState): SendExecutionValidation {
  const guards = evaluateDispatchExecutionGuards(state);
  const blocking = [...guards.blockingIssues];
  const warnings = [...guards.warnings];
  const missing: string[] = [];
  if (!state.primaryRecipient) missing.push("수신자");
  if (!state.sendChannel) missing.push("발송 채널");
  if (guards.alreadySentConflict) blocking.push("이미 발송된 PO입니다");
  const canRecord = blocking.length === 0;
  return { canRecordDispatchExecution: canRecord, canOpenPoSentDetail: canRecord, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : "발송 실행" };
}

// ── Canonical Dispatch Execution Event ──
export interface DispatchExecutionEvent { id: string; dispatchPreparationObjectId: string; poCreatedObjectId: string; finalPrimaryRecipient: string; finalSendChannel: string; finalOutboundSummary: string; finalAttachmentBundleSummary: string; executionReadinessSummary: string; executedAt: string; executedBy: string; }
export function buildDispatchExecutionEvent(state: SendConfirmationState): DispatchExecutionEvent {
  return {
    id: `dispexec_${Date.now().toString(36)}`,
    dispatchPreparationObjectId: state.dispatchPreparationObjectId,
    poCreatedObjectId: state.poCreatedObjectId,
    finalPrimaryRecipient: state.primaryRecipient,
    finalSendChannel: state.sendChannel,
    finalOutboundSummary: state.outboundSummary,
    finalAttachmentBundleSummary: state.attachmentBundleSummary,
    executionReadinessSummary: "발송 완료",
    executedAt: new Date().toISOString(),
    executedBy: "operator",
  };
}

// ── PO Sent Detail Handoff ──
export interface PoSentDetailHandoff { dispatchExecutionEventId: string; dispatchPreparationObjectId: string; poCreatedObjectId: string; finalPrimaryRecipient: string; finalSendChannel: string; finalAttachmentBundleSummary: string; poSentReadiness: "sent" | "pending"; }
export function buildPoSentDetailHandoff(event: DispatchExecutionEvent): PoSentDetailHandoff {
  return { dispatchExecutionEventId: event.id, dispatchPreparationObjectId: event.dispatchPreparationObjectId, poCreatedObjectId: event.poCreatedObjectId, finalPrimaryRecipient: event.finalPrimaryRecipient, finalSendChannel: event.finalSendChannel, finalAttachmentBundleSummary: event.finalAttachmentBundleSummary, poSentReadiness: "sent" };
}
