/**
 * Delivery Tracking Resolution v2 Engine — tracking action → canonical mutation → audit
 *
 * delivery status를 canonical하게 정리해야 supplier ack로 넘길지, recovery로 보낼지 판단 안정.
 * tracking ≠ supplier ack. 외부 전달 상태만 추적/분류.
 */

import type { DeliveryTrackingRecordV2, DeliveryStatus, TrackingWorkspaceStatus } from "./delivery-tracking-workspace-v2";

// ── Tracking Session ──
export type TrackingSessionStatus = "tracking_open" | "tracking_polling" | "tracking_delivered" | "tracking_failed" | "tracking_exception" | "tracking_hold" | "tracking_resolved" | "supplier_ack_handoff_ready";
export type TrackingPhase = "initial_tracking" | "status_polling" | "delivery_confirmation" | "failure_triage" | "exception_handling" | "ack_handoff_readiness";

export interface DeliveryTrackingSessionV2 {
  trackingSessionId: string; caseId: string; sentStateRecordId: string; trackingRecordId: string;
  sessionStatus: TrackingSessionStatus; trackingPhase: TrackingPhase;
  currentDeliveryStatus: DeliveryStatus; previousDeliveryStatus: DeliveryStatus | null;
  pollCount: number; lastPollResult: string; lastPollAt: string;
  deliveryConfirmedAt: string | null; deliveryFailedAt: string | null;
  exceptionType: TrackingExceptionType | null; exceptionDetail: string;
  canProceedToSupplierAckHandoff: boolean; canRetryDelivery: boolean; canRouteException: boolean;
  openedAt: string; lastUpdatedAt: string; openedBy: string;
  auditEventRefs: string[]; provenance: string;
}

// ── Exception Type ──
export type TrackingExceptionType = "bounce" | "rejected_by_recipient" | "address_not_found" | "channel_timeout" | "provider_error" | "partial_delivery" | "unknown_status" | "stale_tracking";

// ── Actions ──
export type TrackingAction = "open_tracking_session" | "poll_delivery_status" | "mark_delivered" | "mark_delivery_failed" | "route_tracking_exception" | "hold_tracking" | "resolve_tracking" | "mark_supplier_ack_handoff_ready";
export type ForbiddenTrackingAction = "modify_sent_state_record" | "modify_fired_payload" | "auto_create_supplier_ack";

export interface TrackingActionPayload { action: TrackingAction; newDeliveryStatus?: DeliveryStatus; exceptionType?: TrackingExceptionType; exceptionDetail?: string; reason?: string; actor: string; timestamp: string; }

export interface DeliveryTrackingMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: DeliveryTrackingSessionV2; updatedTrackingRecord: DeliveryTrackingRecordV2 | null; emittedEvents: TrackingResolutionEvent[]; }

// ── Audit Events ──
export type TrackingResolutionEventType = "tracking_session_opened" | "tracking_status_polled" | "tracking_delivered_confirmed" | "tracking_delivery_failed" | "tracking_exception_routed" | "tracking_held" | "tracking_resolved" | "tracking_supplier_ack_handoff_ready" | "tracking_mutation_rejected";

export interface TrackingResolutionEvent { type: TrackingResolutionEventType; caseId: string; trackingSessionId: string; trackingRecordId: string; deliveryStatus: DeliveryStatus; reason: string; actor: string; timestamp: string; }

// ── Initial Session ──
export function createInitialTrackingSession(caseId: string, sentStateRecordId: string, trackingRecord: DeliveryTrackingRecordV2, actor: string): DeliveryTrackingSessionV2 {
  const now = new Date().toISOString();
  return { trackingSessionId: `trksn_${Date.now().toString(36)}`, caseId, sentStateRecordId, trackingRecordId: trackingRecord.trackingRecordId, sessionStatus: "tracking_open", trackingPhase: "initial_tracking", currentDeliveryStatus: trackingRecord.deliveryStatus, previousDeliveryStatus: null, pollCount: 0, lastPollResult: "", lastPollAt: now, deliveryConfirmedAt: null, deliveryFailedAt: null, exceptionType: null, exceptionDetail: "", canProceedToSupplierAckHandoff: false, canRetryDelivery: false, canRouteException: false, openedAt: now, lastUpdatedAt: now, openedBy: actor, auditEventRefs: [], provenance: sentStateRecordId };
}

// ── Apply Mutation ──
export function applyDeliveryTrackingMutation(session: DeliveryTrackingSessionV2, trackingRecord: DeliveryTrackingRecordV2, payload: TrackingActionPayload): DeliveryTrackingMutationResultV2 {
  const now = payload.timestamp; const events: TrackingResolutionEvent[] = [];
  const makeEvent = (type: TrackingResolutionEventType, reason: string): TrackingResolutionEvent => ({ type, caseId: session.caseId, trackingSessionId: session.trackingSessionId, trackingRecordId: session.trackingRecordId, deliveryStatus: session.currentDeliveryStatus, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): DeliveryTrackingMutationResultV2 => { events.push(makeEvent("tracking_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, updatedTrackingRecord: null, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now };
  let updatedRecord: DeliveryTrackingRecordV2 | null = null;

  switch (payload.action) {
    case "open_tracking_session": { u.sessionStatus = "tracking_open"; u.trackingPhase = "initial_tracking"; events.push(makeEvent("tracking_session_opened", "Session opened")); break; }

    case "poll_delivery_status": {
      if (!payload.newDeliveryStatus) return reject("New delivery status 필수");
      u.previousDeliveryStatus = u.currentDeliveryStatus;
      u.currentDeliveryStatus = payload.newDeliveryStatus;
      u.pollCount += 1; u.lastPollResult = payload.newDeliveryStatus; u.lastPollAt = now;
      u.sessionStatus = "tracking_polling"; u.trackingPhase = "status_polling";
      updatedRecord = { ...trackingRecord, deliveryStatus: payload.newDeliveryStatus, lastPolledAt: now, lastStatusChangeAt: now };
      events.push(makeEvent("tracking_status_polled", `Status → ${payload.newDeliveryStatus}`));
      break;
    }

    case "mark_delivered": {
      u.currentDeliveryStatus = "delivered"; u.sessionStatus = "tracking_delivered"; u.trackingPhase = "delivery_confirmation";
      u.deliveryConfirmedAt = now;
      u.canProceedToSupplierAckHandoff = true; u.canRetryDelivery = false;
      updatedRecord = { ...trackingRecord, deliveryStatus: "delivered", deliveryConfirmedAt: now, lastStatusChangeAt: now };
      events.push(makeEvent("tracking_delivered_confirmed", "Delivery confirmed"));
      break;
    }

    case "mark_delivery_failed": {
      u.currentDeliveryStatus = "delivery_failed"; u.sessionStatus = "tracking_failed"; u.trackingPhase = "failure_triage";
      u.deliveryFailedAt = now;
      u.canRetryDelivery = true; u.canRouteException = true; u.canProceedToSupplierAckHandoff = false;
      updatedRecord = { ...trackingRecord, deliveryStatus: "delivery_failed", lastStatusChangeAt: now };
      events.push(makeEvent("tracking_delivery_failed", "Delivery failed"));
      break;
    }

    case "route_tracking_exception": {
      if (!payload.exceptionType) return reject("Exception type 필수");
      u.sessionStatus = "tracking_exception"; u.trackingPhase = "exception_handling";
      u.exceptionType = payload.exceptionType; u.exceptionDetail = payload.exceptionDetail || "";
      u.canRouteException = false; u.canProceedToSupplierAckHandoff = false;
      updatedRecord = { ...trackingRecord, trackingException: payload.exceptionType, trackingExceptionAt: now };
      events.push(makeEvent("tracking_exception_routed", `Exception: ${payload.exceptionType}`));
      break;
    }

    case "hold_tracking": { u.sessionStatus = "tracking_hold"; events.push(makeEvent("tracking_held", payload.reason || "Hold")); break; }

    case "resolve_tracking": {
      u.sessionStatus = "tracking_resolved"; u.trackingPhase = "ack_handoff_readiness";
      const deliverable = u.currentDeliveryStatus === "delivered" || u.currentDeliveryStatus === "in_transit";
      u.canProceedToSupplierAckHandoff = deliverable;
      events.push(makeEvent("tracking_resolved", "Tracking resolved"));
      break;
    }

    case "mark_supplier_ack_handoff_ready": {
      if (!u.canProceedToSupplierAckHandoff) return reject("Supplier ack handoff 불가 상태");
      u.sessionStatus = "supplier_ack_handoff_ready"; u.trackingPhase = "ack_handoff_readiness";
      events.push(makeEvent("tracking_supplier_ack_handoff_ready", "Supplier ack handoff ready"));
      break;
    }

    default: return reject(`Unknown action: ${payload.action}`);
  }

  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, updatedTrackingRecord: updatedRecord, emittedEvents: events };
}
