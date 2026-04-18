/**
 * Supplier Acknowledgment Workspace v2 — 공급사 수신/확인/회신 운영면
 *
 * tracking = 전달 상태 추적, ack = 상대방 의사 이벤트.
 * ack ≠ tracking. ack 이후 receiving preparation 체인으로 연결.
 *
 * TRUTH CONTRACT:
 * - reads: SentStateRecordV2, DeliveryTrackingRecordV2
 * - writes: SupplierAcknowledgmentRecordV2 (ackType, confirmedScope) — via captureSupplierAck
 * - center: ack capture + classification + receiving-ready 판단
 * - rail: delivery tracking evidence + send payload snapshot
 * - dock: capture ack / classify / confirm / route followup
 * - forbidden: ack 없이 receiving prep 진입, delivery truth 수정
 */

import type { SentStateRecordV2 } from "./actual-send-fired-transaction-v2-engine";
import type { DeliveryTrackingRecordV2 } from "./delivery-tracking-workspace-v2";
import type { SupplierAckHandoffGateV2 } from "./supplier-acknowledgment-handoff-gate-v2-engine";

export type SupplierAckWorkspaceStatus = "awaiting_ack" | "ack_received" | "ack_confirmed" | "ack_conditional" | "ack_partial" | "ack_declined" | "ack_unclear" | "ack_hold" | "ack_followup_required";
export type AckType = "confirmed" | "conditional" | "partial" | "declined" | "unclear" | "auto_reply_only" | "no_response";

export interface SupplierAcknowledgmentRecordV2 {
  ackRecordId: string; caseId: string; sentStateRecordId: string; trackingRecordId: string | null;
  ackType: AckType; ackReceivedAt: string | null; ackReceivedBy: string;
  ackContent: string; ackChannel: string;
  confirmedScope: string; conditionalTerms: string; partialScope: string; declineReason: string;
  followupRequired: boolean; followupReason: string;
  createdAt: string; createdBy: string;
  status: "pending" | "received" | "classified" | "confirmed" | "followup_routed" | "cancelled";
  nextDestination: string;
}

export interface SupplierAcknowledgmentWorkspaceStateV2 {
  workspaceId: string; caseId: string; sentStateRecordId: string; trackingRecordId: string | null;
  workspaceStatus: SupplierAckWorkspaceStatus;
  ackRecord: SupplierAcknowledgmentRecordV2 | null;
  canCaptureAck: boolean; canClassifyAck: boolean; canConfirmAck: boolean;
  canRouteFollowup: boolean; canProceedToReceivingPrep: boolean;
  operatorNote: string; generatedAt: string;
}

export function buildSupplierAckWorkspaceStateV2(gate: SupplierAckHandoffGateV2, record: SentStateRecordV2, trackingRecord: DeliveryTrackingRecordV2 | null): SupplierAcknowledgmentWorkspaceStateV2 {
  const canEntry = gate.canOpenSupplierAckWorkspace;
  return {
    workspaceId: `sackws_${Date.now().toString(36)}`, caseId: record.caseId, sentStateRecordId: record.sentStateRecordId, trackingRecordId: trackingRecord?.trackingRecordId ?? null,
    workspaceStatus: canEntry ? "awaiting_ack" : "ack_hold",
    ackRecord: null,
    canCaptureAck: canEntry, canClassifyAck: false, canConfirmAck: false,
    canRouteFollowup: false, canProceedToReceivingPrep: false,
    operatorNote: "", generatedAt: new Date().toISOString(),
  };
}

export function captureSupplierAck(caseId: string, sentStateRecordId: string, trackingRecordId: string | null, ackType: AckType, ackContent: string, ackChannel: string, actor: string): SupplierAcknowledgmentRecordV2 {
  const now = new Date().toISOString();
  const followupRequired = ackType !== "confirmed";
  const nextDest = ackType === "confirmed" ? "receiving_preparation" : "ack_followup";
  return { ackRecordId: `sackrc_${Date.now().toString(36)}`, caseId, sentStateRecordId, trackingRecordId, ackType, ackReceivedAt: now, ackReceivedBy: actor, ackContent, ackChannel, confirmedScope: ackType === "confirmed" ? "전체" : "", conditionalTerms: ackType === "conditional" ? ackContent : "", partialScope: ackType === "partial" ? ackContent : "", declineReason: ackType === "declined" ? ackContent : "", followupRequired, followupReason: followupRequired ? `Ack type: ${ackType}` : "", createdAt: now, createdBy: actor, status: "received", nextDestination: nextDest };
}

export type SupplierAckEventType = "supplier_ack_workspace_opened" | "supplier_ack_captured" | "supplier_ack_classified" | "supplier_ack_confirmed" | "supplier_ack_followup_routed" | "supplier_ack_receiving_prep_handoff_ready";
export interface SupplierAckEvent { type: SupplierAckEventType; caseId: string; sentStateRecordId: string; ackRecordId: string | null; ackType: AckType | null; reason: string; actor: string; timestamp: string; }
export function createSupplierAckEvent(type: SupplierAckEventType, caseId: string, sentStateRecordId: string, ackRecordId: string | null, ackType: AckType | null, reason: string, actor: string): SupplierAckEvent { return { type, caseId, sentStateRecordId, ackRecordId, ackType, reason, actor, timestamp: new Date().toISOString() }; }
