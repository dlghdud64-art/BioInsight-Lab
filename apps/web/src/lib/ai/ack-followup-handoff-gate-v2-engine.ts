/**
 * Ack Followup Handoff Gate v2 Engine — non-confirmed / pending detail → followup entry
 *
 * confirmed_ready가 아닌 모든 ack classification을 followup 운영 큐로 분기.
 * followup 결과 → receiving_preparation_handoff 또는 exception_recovery.
 */

import type { SupplierAckResolutionSessionV2, AckClassification } from "./supplier-acknowledgment-resolution-v2-engine";

export type AckFollowupGateStatus = "not_eligible" | "followup_required" | "followup_entry_enabled" | "followup_locked_by_policy" | "exception_route_required";

export type FollowupType = "detail_request" | "eta_request" | "shipment_reference_request" | "change_confirmation" | "partial_acceptance_review" | "decline_handling" | "timeout_chase" | "substitute_reconfirmation" | "general_clarification";

export interface AckFollowupHandoffGateV2 {
  ackFollowupHandoffGateId: string; caseId: string; sentStateRecordId: string; ackResolutionSessionId: string;
  gateStatus: AckFollowupGateStatus;
  ackClassification: AckClassification;
  followupRequired: boolean; followupReason: string;
  recommendedFollowupType: FollowupType;
  canOpenFollowupWorkspace: boolean;
  exceptionRequired: boolean; exceptionReason: string;
  nextSurfaceLabel: string; generatedAt: string;
}

function deriveFollowupType(classification: AckClassification): FollowupType {
  switch (classification) {
    case "ack_confirmed_pending_detail": return "detail_request";
    case "ack_partial": return "partial_acceptance_review";
    case "ack_conditional": return "change_confirmation";
    case "ack_unclear": return "general_clarification";
    case "ack_declined": return "decline_handling";
    case "ack_no_response_timeout": return "timeout_chase";
    default: return "general_clarification";
  }
}

export function buildAckFollowupHandoffGateV2(ackSession: SupplierAckResolutionSessionV2): AckFollowupHandoffGateV2 {
  const isConfirmedReady = ackSession.ackClassification === "ack_confirmed_ready";
  const isDeclined = ackSession.ackClassification === "ack_declined";
  const followupRequired = !isConfirmedReady;
  const exceptionRequired = isDeclined;

  const gateStatus: AckFollowupGateStatus =
    isConfirmedReady ? "not_eligible"
    : exceptionRequired ? "exception_route_required"
    : followupRequired ? "followup_entry_enabled"
    : "not_eligible";

  const canOpen = followupRequired && !exceptionRequired;

  return {
    ackFollowupHandoffGateId: `ackfgate_${Date.now().toString(36)}`,
    caseId: ackSession.caseId, sentStateRecordId: ackSession.sentStateRecordId, ackResolutionSessionId: ackSession.ackResolutionSessionId,
    gateStatus, ackClassification: ackSession.ackClassification,
    followupRequired, followupReason: ackSession.followupReason,
    recommendedFollowupType: deriveFollowupType(ackSession.ackClassification),
    canOpenFollowupWorkspace: canOpen,
    exceptionRequired, exceptionReason: ackSession.exceptionReason,
    nextSurfaceLabel: exceptionRequired ? "Exception / Recovery" : canOpen ? "Ack Followup Workspace (Entry Enabled)" : "N/A — confirmed ready",
    generatedAt: new Date().toISOString(),
  };
}

export type AckFollowupGateEventType = "ack_followup_gate_computed" | "ack_followup_entry_enabled" | "ack_followup_exception_route_required" | "ack_followup_not_eligible";
export interface AckFollowupGateEvent { type: AckFollowupGateEventType; caseId: string; ackResolutionSessionId: string; gateId: string; ackClassification: AckClassification; reason: string; actor: string; timestamp: string; }
export function createAckFollowupGateEvent(type: AckFollowupGateEventType, gate: AckFollowupHandoffGateV2, reason: string, actor: string): AckFollowupGateEvent { return { type, caseId: gate.caseId, ackResolutionSessionId: gate.ackResolutionSessionId, gateId: gate.ackFollowupHandoffGateId, ackClassification: gate.ackClassification, reason, actor, timestamp: new Date().toISOString() }; }
