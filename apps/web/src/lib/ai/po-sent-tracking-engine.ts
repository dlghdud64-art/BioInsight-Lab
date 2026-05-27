/**
 * PO Sent Tracking Engine — 발송 추적 + supplier acknowledgment + follow-up + next-step readiness
 */

import type { PoSentDetailHandoff } from "./send-confirmation-engine";

// ── Status ──
export type PoSentTrackingStatus = "po_sent_open" | "po_sent_tracking_in_progress" | "supplier_acknowledgment_recorded";
export type PoSentTrackingSubstatus = "awaiting_supplier_acknowledgment" | "acknowledgment_partially_received" | "followup_required" | "sent_tracking_blocked" | "ready_for_supplier_confirmation" | "ready_for_receiving_preparation";

// ── Acknowledgment Status ──
export type AcknowledgmentStatus = "no_response" | "acknowledgment_received" | "partial_acknowledgment" | "clarification_required" | "issue_raised" | "resend_suggested";

// ── State ──
export interface PoSentTrackingState {
  poSentTrackingStatus: PoSentTrackingStatus;
  substatus: PoSentTrackingSubstatus;
  poSentOpenedAt: string;
  dispatchExecutionEventId: string;
  poCreatedObjectId: string;
  primaryRecipient: string;
  sentChannel: string;
  acknowledgmentStatus: AcknowledgmentStatus;
  followupRequiredFlag: boolean;
  followupReasonSummary: string;
  missingResponseCount: number;
  sentTrackingBlockedFlag: boolean;
  sentTrackingBlockedReason: string | null;
  supplierAcknowledgmentObjectId: string | null;
}

export function createInitialPoSentTrackingState(handoff: PoSentDetailHandoff): PoSentTrackingState {
  return {
    poSentTrackingStatus: "po_sent_open",
    substatus: "awaiting_supplier_acknowledgment",
    poSentOpenedAt: new Date().toISOString(),
    dispatchExecutionEventId: handoff.dispatchExecutionEventId,
    poCreatedObjectId: handoff.poCreatedObjectId,
    primaryRecipient: handoff.finalPrimaryRecipient,
    sentChannel: handoff.finalSendChannel,
    acknowledgmentStatus: "no_response",
    followupRequiredFlag: false,
    followupReasonSummary: "",
    missingResponseCount: 1,
    sentTrackingBlockedFlag: false,
    sentTrackingBlockedReason: null,
    supplierAcknowledgmentObjectId: null,
  };
}

// ── Acknowledgment Evaluator ──
export interface AcknowledgmentEvaluation { acknowledgmentStatus: AcknowledgmentStatus; followupRequired: boolean; followupReasonCodes: string[]; clarificationRequired: boolean; resendSuggested: boolean; blockingIssues: string[]; warnings: string[]; }
export function evaluateSupplierAcknowledgmentState(state: PoSentTrackingState): AcknowledgmentEvaluation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (state.acknowledgmentStatus === "no_response") { warnings.push("공급사 응답 없음"); }
  if (state.acknowledgmentStatus === "partial_acknowledgment") { warnings.push("부분 확인만 수신됨"); }
  if (state.acknowledgmentStatus === "issue_raised") { blocking.push("공급사 이슈 제기됨"); }
  return { acknowledgmentStatus: state.acknowledgmentStatus, followupRequired: state.acknowledgmentStatus === "no_response" || state.acknowledgmentStatus === "partial_acknowledgment", followupReasonCodes: state.acknowledgmentStatus === "no_response" ? ["no_response"] : [], clarificationRequired: state.acknowledgmentStatus === "clarification_required", resendSuggested: state.acknowledgmentStatus === "resend_suggested", blockingIssues: blocking, warnings };
}

// ── Next Step Readiness ──
export interface SentNextStepReadiness { canOpenSupplierConfirmation: boolean; canOpenReceivingPreparation: boolean; requiresFollowupFirst: boolean; requiresClarificationFirst: boolean; recommendedNextAction: string; }
export function evaluateSentNextStepReadiness(state: PoSentTrackingState): SentNextStepReadiness {
  const isAcked = state.acknowledgmentStatus === "acknowledgment_received";
  const noResponse = state.acknowledgmentStatus === "no_response";
  return { canOpenSupplierConfirmation: isAcked || state.acknowledgmentStatus === "partial_acknowledgment", canOpenReceivingPreparation: isAcked, requiresFollowupFirst: noResponse, requiresClarificationFirst: state.acknowledgmentStatus === "clarification_required", recommendedNextAction: noResponse ? "Follow-up 필요" : isAcked ? "Supplier Confirmation으로 진행" : "Acknowledgment 상태 확인" };
}

// ── Validator ──
export interface AcknowledgmentValidation { canRecordAcknowledgment: boolean; canOpenSupplierConfirmation: boolean; canOpenReceivingPreparation: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateSupplierAcknowledgmentBeforeRecord(state: PoSentTrackingState): AcknowledgmentValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (!state.dispatchExecutionEventId) blocking.push("발송 실행 이벤트 없음");
  if (state.sentTrackingBlockedFlag) blocking.push(state.sentTrackingBlockedReason || "차단됨");
  if (state.acknowledgmentStatus === "no_response") warnings.push("아직 공급사 응답 없음");
  const nextStep = evaluateSentNextStepReadiness(state);
  return { canRecordAcknowledgment: blocking.length === 0, canOpenSupplierConfirmation: nextStep.canOpenSupplierConfirmation && blocking.length === 0, canOpenReceivingPreparation: nextStep.canOpenReceivingPreparation && blocking.length === 0, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : nextStep.recommendedNextAction };
}

// ── Canonical Supplier Acknowledgment Object ──
export interface SupplierAcknowledgmentObject { id: string; dispatchExecutionEventId: string; poCreatedObjectId: string; finalPrimaryRecipient: string; finalSendChannel: string; acknowledgmentStatus: AcknowledgmentStatus; followupRequiredFlag: boolean; followupReasonSummary: string; responseSummary: string; recordedAt: string; recordedBy: string; }
export function buildSupplierAcknowledgmentObject(state: PoSentTrackingState): SupplierAcknowledgmentObject {
  return { id: `sack_${Date.now().toString(36)}`, dispatchExecutionEventId: state.dispatchExecutionEventId, poCreatedObjectId: state.poCreatedObjectId, finalPrimaryRecipient: state.primaryRecipient, finalSendChannel: state.sentChannel, acknowledgmentStatus: state.acknowledgmentStatus, followupRequiredFlag: state.followupRequiredFlag, followupReasonSummary: state.followupReasonSummary, responseSummary: state.acknowledgmentStatus === "acknowledgment_received" ? "공급사 확인 완료" : state.acknowledgmentStatus === "no_response" ? "응답 없음" : "확인 진행 중", recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Handoffs ──
export interface SupplierConfirmationHandoff { supplierAcknowledgmentObjectId: string; dispatchExecutionEventId: string; acknowledgmentStatus: AcknowledgmentStatus; followupRequiredFlag: boolean; responseSummary: string; supplierConfirmationReadiness: "ready" | "pending" | "blocked"; }
export function buildSupplierConfirmationHandoff(obj: SupplierAcknowledgmentObject): SupplierConfirmationHandoff {
  return { supplierAcknowledgmentObjectId: obj.id, dispatchExecutionEventId: obj.dispatchExecutionEventId, acknowledgmentStatus: obj.acknowledgmentStatus, followupRequiredFlag: obj.followupRequiredFlag, responseSummary: obj.responseSummary, supplierConfirmationReadiness: obj.acknowledgmentStatus === "acknowledgment_received" ? "ready" : "pending" };
}

export interface ReceivingPreparationHandoff { supplierAcknowledgmentObjectId: string; dispatchExecutionEventId: string; responseSummary: string; receivingPreparationReadiness: "ready" | "pending" | "blocked"; }
export function buildReceivingPreparationHandoff(obj: SupplierAcknowledgmentObject): ReceivingPreparationHandoff {
  return { supplierAcknowledgmentObjectId: obj.id, dispatchExecutionEventId: obj.dispatchExecutionEventId, responseSummary: obj.responseSummary, receivingPreparationReadiness: obj.acknowledgmentStatus === "acknowledgment_received" ? "ready" : "blocked" };
}
