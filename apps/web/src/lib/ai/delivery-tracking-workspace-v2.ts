/**
 * Delivery Tracking Workspace v2 — 외부 전달 상태 추적 운영면
 *
 * sent_state_committed → tracking 생성/관리/exception 처리.
 * tracking ≠ supplier ack. 전달 상태만 추적.
 *
 * TRUTH CONTRACT:
 * - reads: SentStateRecordV2 (sendTransactionId, firedPayloadSnapshot)
 * - writes: DeliveryTrackingRecordV2 (trackingId, deliveryStatus) — via resolution engine only
 * - center: delivery status tracking + exception triage
 * - rail: send transaction evidence + external provider reference
 * - dock: poll / mark delivered / mark failed / route exception / supplier ack handoff
 * - forbidden: sent truth 수정, supplier ack truth 선행 확정
 */

import type { SentStateRecordV2 } from "./actual-send-fired-transaction-v2-engine";
import type { DeliveryTrackingHandoffGateV2 } from "./delivery-tracking-handoff-gate-v2-engine";

export type TrackingWorkspaceStatus = "tracking_not_created" | "tracking_pending" | "tracking_active" | "tracking_delivered" | "tracking_failed" | "tracking_exception" | "tracking_hold";

export type DeliveryStatus = "not_tracked" | "in_transit" | "delivered" | "delivery_attempted" | "delivery_failed" | "returned_to_sender" | "exception";

export interface DeliveryTrackingRecordV2 {
  trackingRecordId: string; caseId: string; sentStateRecordId: string; sendTransactionId: string;
  trackingId: string; providerReference: string; sendChannel: string;
  externalMessageId: string; recipientAddress: string;
  deliveryStatus: DeliveryStatus;
  trackingCreatedAt: string; lastPolledAt: string; lastStatusChangeAt: string;
  deliveryAttemptCount: number; deliveryConfirmedAt: string | null;
  trackingException: string | null; trackingExceptionAt: string | null;
  missingTrackingRemediation: string;
  createdBy: string; status: "active" | "resolved" | "failed" | "cancelled";
  nextDestination: string;
}

export interface DeliveryTrackingWorkspaceStateV2 {
  workspaceId: string; caseId: string; handoffPackageId: string; sentStateRecordId: string;
  workspaceStatus: TrackingWorkspaceStatus;
  trackingRecord: DeliveryTrackingRecordV2 | null;
  deliveryStatus: DeliveryStatus;
  canCreateTracking: boolean; canPollStatus: boolean; canMarkDelivered: boolean; canMarkFailed: boolean; canRouteException: boolean;
  canProceedToSupplierAckHandoff: boolean;
  operatorNote: string; generatedAt: string;
}

export function buildDeliveryTrackingWorkspaceStateV2(gate: DeliveryTrackingHandoffGateV2, record: SentStateRecordV2): DeliveryTrackingWorkspaceStateV2 {
  const canEntry = gate.candidate.canOpenTrackingWorkspace;
  return {
    workspaceId: `trkws_${Date.now().toString(36)}`, caseId: record.caseId, handoffPackageId: record.handoffPackageId, sentStateRecordId: record.sentStateRecordId,
    workspaceStatus: canEntry ? "tracking_not_created" : "tracking_hold",
    trackingRecord: null, deliveryStatus: "not_tracked",
    canCreateTracking: canEntry, canPollStatus: false, canMarkDelivered: false, canMarkFailed: false, canRouteException: false,
    canProceedToSupplierAckHandoff: false,
    operatorNote: "", generatedAt: new Date().toISOString(),
  };
}

export function createDeliveryTrackingRecord(caseId: string, sentStateRecordId: string, sendTransactionId: string, channel: string, externalId: string, recipient: string, actor: string): DeliveryTrackingRecordV2 {
  const now = new Date().toISOString();
  return { trackingRecordId: `trkrc_${Date.now().toString(36)}`, caseId, sentStateRecordId, sendTransactionId, trackingId: `trk_${Date.now().toString(36)}`, providerReference: "", sendChannel: channel, externalMessageId: externalId, recipientAddress: recipient, deliveryStatus: "in_transit", trackingCreatedAt: now, lastPolledAt: now, lastStatusChangeAt: now, deliveryAttemptCount: 1, deliveryConfirmedAt: null, trackingException: null, trackingExceptionAt: null, missingTrackingRemediation: "", createdBy: actor, status: "active", nextDestination: "supplier_acknowledgment_handoff" };
}

export type TrackingEventType = "delivery_tracking_created" | "delivery_tracking_polled" | "delivery_tracking_status_changed" | "delivery_tracking_delivered" | "delivery_tracking_failed" | "delivery_tracking_exception_routed" | "delivery_tracking_supplier_ack_handoff_ready";
export interface TrackingEvent { type: TrackingEventType; caseId: string; sentStateRecordId: string; trackingRecordId: string | null; deliveryStatus: DeliveryStatus; reason: string; actor: string; timestamp: string; }
export function createTrackingEvent(type: TrackingEventType, caseId: string, sentStateRecordId: string, trackingRecordId: string | null, deliveryStatus: DeliveryStatus, reason: string, actor: string): TrackingEvent { return { type, caseId, sentStateRecordId, trackingRecordId, deliveryStatus, reason, actor, timestamp: new Date().toISOString() }; }
