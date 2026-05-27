/**
 * Dispatch Preparation Re-entry Engine — recipient/payload/attachment revalidation + send confirmation re-entry handoff
 */

import type { DispatchPreparationReentryHandoff } from "./po-created-reentry-engine";

// ── Status ──
export type DispatchPrepReentryStatus = "dispatch_preparation_reentry_open" | "dispatch_preparation_reentry_in_progress" | "dispatch_preparation_reentry_recorded";
export type DispatchPrepReentrySubstatus = "awaiting_recipient_revalidation" | "awaiting_payload_delta_review" | "awaiting_attachment_revalidation" | "dispatch_preparation_reentry_blocked" | "ready_for_send_confirmation_reentry";

// ── State ──
export interface DispatchPreparationReentryState {
  dispatchPreparationReentryStatus: DispatchPrepReentryStatus;
  substatus: DispatchPrepReentrySubstatus;
  dispatchPreparationReentryOpenedAt: string;
  poCreatedReentryObjectId: string;
  recipientCount: number;
  channelStatus: "confirmed" | "pending" | "changed";
  attachmentBundleCount: number;
  payloadDeltaStatus: "reviewed" | "pending" | "stale";
  priorDispatchOverlapCount: number;
  sendCriticalFieldStatus: "ready" | "incomplete" | "blocked";
  missingDecisionCount: number;
  dispatchPreparationReentryBlockedFlag: boolean;
  dispatchPreparationReentryBlockedReason: string | null;
  dispatchPreparationReentryObjectId: string | null;
  // ── Fields ──
  primaryRecipient: string;
  sendChannel: string;
  supplierFacingNote: string;
}

export function createInitialDispatchPrepReentryState(handoff: DispatchPreparationReentryHandoff): DispatchPreparationReentryState {
  return {
    dispatchPreparationReentryStatus: "dispatch_preparation_reentry_open",
    substatus: "awaiting_recipient_revalidation",
    dispatchPreparationReentryOpenedAt: new Date().toISOString(),
    poCreatedReentryObjectId: handoff.poCreatedReentryObjectId,
    recipientCount: 0,
    channelStatus: "pending",
    attachmentBundleCount: 1,
    payloadDeltaStatus: "pending",
    priorDispatchOverlapCount: 0,
    sendCriticalFieldStatus: "incomplete",
    missingDecisionCount: 3,
    dispatchPreparationReentryBlockedFlag: handoff.dispatchPreparationReentryReadiness === "blocked",
    dispatchPreparationReentryBlockedReason: handoff.dispatchPreparationReentryReadiness === "blocked" ? "Dispatch Prep Re-entry 조건 미충족" : null,
    dispatchPreparationReentryObjectId: null,
    primaryRecipient: "", sendChannel: "email", supplierFacingNote: "",
  };
}

// ── Validator ──
export interface DispatchPrepReentryValidation { canRecordDispatchPreparationReentry: boolean; canOpenSendConfirmationReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateDispatchPrepReentryBeforeRecord(state: DispatchPreparationReentryState): DispatchPrepReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.dispatchPreparationReentryBlockedFlag) blocking.push(state.dispatchPreparationReentryBlockedReason || "차단됨");
  if (!state.primaryRecipient) { warnings.push("수신자 미지정"); missing.push("수신자"); }
  if (state.payloadDeltaStatus === "stale") blocking.push("Stale payload");
  if (state.payloadDeltaStatus === "pending") { warnings.push("Payload delta 미검토"); missing.push("Payload 검토"); }
  if (state.priorDispatchOverlapCount > 0) warnings.push("이전 dispatch overlap 있음");
  const canRecord = blocking.length === 0;
  const canSend = canRecord && state.sendCriticalFieldStatus === "ready";
  return { canRecordDispatchPreparationReentry: canRecord, canOpenSendConfirmationReentry: canSend, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : !canSend ? "Send-critical 필드 완료 후 진행" : "Send Confirmation Re-entry로 보내기" };
}

// ── Decision Options ──
export interface DispatchPrepReentryDecisionOptions { canRecordPreparation: boolean; canOpenSendConfirmationReentry: boolean; canHold: boolean; canReturnPoCreatedReentry: boolean; decisionReasonSummary: string; }
export function buildDispatchPrepReentryDecisionOptions(state: DispatchPreparationReentryState): DispatchPrepReentryDecisionOptions {
  const v = validateDispatchPrepReentryBeforeRecord(state);
  return { canRecordPreparation: v.canRecordDispatchPreparationReentry, canOpenSendConfirmationReentry: v.canOpenSendConfirmationReentry, canHold: v.missingItems.length > 0, canReturnPoCreatedReentry: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface DispatchPreparationReentryObject { id: string; poCreatedReentryObjectId: string; recipientRevalidationSummary: string; channelRevalidationSummary: string; outboundPayloadDeltaSummary: string; attachmentBundleRevalidationSummary: string; priorDispatchOverlapSummary: string; sendCriticalBridgeSummary: string; recordedAt: string; recordedBy: string; }
export function buildDispatchPreparationReentryObject(state: DispatchPreparationReentryState): DispatchPreparationReentryObject {
  return { id: `dispprepreentry_${Date.now().toString(36)}`, poCreatedReentryObjectId: state.poCreatedReentryObjectId, recipientRevalidationSummary: state.primaryRecipient || "미지정", channelRevalidationSummary: state.sendChannel, outboundPayloadDeltaSummary: state.payloadDeltaStatus, attachmentBundleRevalidationSummary: `${state.attachmentBundleCount}개`, priorDispatchOverlapSummary: state.priorDispatchOverlapCount > 0 ? "충돌 있음" : "충돌 없음", sendCriticalBridgeSummary: state.sendCriticalFieldStatus, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Send Confirmation Re-entry Handoff ──
export interface SendConfirmationReentryHandoff { dispatchPreparationReentryObjectId: string; recipientRevalidationSummary: string; outboundPayloadDeltaSummary: string; attachmentBundleRevalidationSummary: string; sendCriticalBridgeSummary: string; sendConfirmationReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildSendConfirmationReentryHandoff(obj: DispatchPreparationReentryObject): SendConfirmationReentryHandoff {
  return { dispatchPreparationReentryObjectId: obj.id, recipientRevalidationSummary: obj.recipientRevalidationSummary, outboundPayloadDeltaSummary: obj.outboundPayloadDeltaSummary, attachmentBundleRevalidationSummary: obj.attachmentBundleRevalidationSummary, sendCriticalBridgeSummary: obj.sendCriticalBridgeSummary, sendConfirmationReentryReadiness: obj.sendCriticalBridgeSummary === "ready" ? "ready" : "pending" };
}
