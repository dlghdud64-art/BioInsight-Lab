/**
 * Supplier Acknowledgment Resolution v2 Engine — ack action → classification → routing
 *
 * ack_confirmed ≠ receiving_ready. confirmed + receiving-ready일 때만 receiving prep handoff.
 * 7 ack classifications: confirmed_ready / confirmed_pending_detail / partial / conditional / unclear / declined / timeout.
 *
 * 분기:
 * A. confirmed + receiving-ready → receiving_preparation_handoff
 * B. confirmed + NOT receiving-ready → ack_followup
 * C. non-confirmed → ack_followup
 * D. hard issue → exception/recovery
 */

import type { SupplierAcknowledgmentRecordV2, AckType, SupplierAckWorkspaceStatus } from "./supplier-acknowledgment-workspace-v2";

// ── Ack Classification (refined) ──
export type AckClassification = "ack_confirmed_ready" | "ack_confirmed_pending_detail" | "ack_partial" | "ack_conditional" | "ack_unclear" | "ack_declined" | "ack_no_response_timeout";

// ── Receiving Readiness Check ──
export interface ReceivingReadinessCheckV2 {
  supplierAcceptedFull: boolean;
  etaOrShipmentTimingAvailable: boolean;
  lineItemScopeConfirmed: boolean;
  deliveryReferenceAvailable: boolean;
  noSubstitutionPending: boolean;
  noSplitShipmentUnresolved: boolean;
  quantityPackConfirmed: boolean;
}

// ── Ack Resolution Session ──
export type AckResolutionSessionStatus = "classification_pending" | "classified" | "followup_required" | "receiving_handoff_ready" | "exception_routed" | "resolved" | "hold";

export interface SupplierAckResolutionSessionV2 {
  ackResolutionSessionId: string; caseId: string; sentStateRecordId: string; ackRecordId: string;
  sessionStatus: AckResolutionSessionStatus;
  ackClassification: AckClassification;
  receivingReadinessCheck: ReceivingReadinessCheckV2;
  receivingReady: boolean;
  followupRequired: boolean; followupReason: string;
  exceptionRequired: boolean; exceptionReason: string;
  acceptedLineSet: string[]; changedLineSet: string[]; rejectedLineSet: string[];
  supplierResponseSnapshot: string;
  nextHandoffTarget: "receiving_preparation_handoff" | "ack_followup" | "exception_recovery" | "hold";
  operatorNote: string;
  openedAt: string; lastUpdatedAt: string; openedBy: string;
  auditEventRefs: string[];
}

// ── Actions ──
export type AckResolutionAction = "open_ack_resolution_session" | "classify_ack" | "run_receiving_readiness_check" | "mark_receiving_handoff_ready" | "route_to_followup" | "route_to_exception" | "hold_ack_resolution" | "resolve_ack";
export type ForbiddenAckAction = "auto_create_receiving_preparation" | "auto_advance_to_stock_release" | "modify_sent_state_record";

export interface AckResolutionActionPayload { action: AckResolutionAction; ackClassification?: AckClassification; receivingReadinessOverride?: Partial<ReceivingReadinessCheckV2>; followupReason?: string; exceptionReason?: string; reason?: string; actor: string; timestamp: string; }

export interface SupplierAckResolutionMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: SupplierAckResolutionSessionV2; emittedEvents: AckResolutionEvent[]; }

// ── Audit Events ──
export type AckResolutionEventType = "ack_resolution_session_opened" | "ack_classified" | "ack_receiving_readiness_checked" | "ack_receiving_handoff_ready" | "ack_followup_routed" | "ack_exception_routed" | "ack_resolution_held" | "ack_resolved" | "ack_resolution_mutation_rejected";

export interface AckResolutionEvent { type: AckResolutionEventType; caseId: string; ackResolutionSessionId: string; ackRecordId: string; ackClassification: AckClassification | null; receivingReady: boolean; nextTarget: string; reason: string; actor: string; timestamp: string; }

// ── Classification Logic ──
function classifyAck(ackRecord: SupplierAcknowledgmentRecordV2): AckClassification {
  switch (ackRecord.ackType) {
    case "confirmed": return "ack_confirmed_ready"; // will be refined by readiness check
    case "conditional": return "ack_conditional";
    case "partial": return "ack_partial";
    case "declined": return "ack_declined";
    case "unclear": return "ack_unclear";
    case "auto_reply_only": return "ack_unclear";
    case "no_response": return "ack_no_response_timeout";
    default: return "ack_unclear";
  }
}

function deriveReceivingReadiness(ackRecord: SupplierAcknowledgmentRecordV2): ReceivingReadinessCheckV2 {
  const isConfirmed = ackRecord.ackType === "confirmed";
  return {
    supplierAcceptedFull: isConfirmed && ackRecord.confirmedScope === "전체",
    etaOrShipmentTimingAvailable: false, // to be filled by operator
    lineItemScopeConfirmed: isConfirmed && !!ackRecord.confirmedScope,
    deliveryReferenceAvailable: false,
    noSubstitutionPending: true,
    noSplitShipmentUnresolved: true,
    quantityPackConfirmed: isConfirmed,
  };
}

function isReceivingReady(check: ReceivingReadinessCheckV2): boolean {
  return check.supplierAcceptedFull && check.etaOrShipmentTimingAvailable && check.lineItemScopeConfirmed && check.deliveryReferenceAvailable && check.noSubstitutionPending && check.noSplitShipmentUnresolved && check.quantityPackConfirmed;
}

// ── Initial Session ──
export function createInitialAckResolutionSession(caseId: string, sentStateRecordId: string, ackRecord: SupplierAcknowledgmentRecordV2, actor: string): SupplierAckResolutionSessionV2 {
  const now = new Date().toISOString();
  const classification = classifyAck(ackRecord);
  const readinessCheck = deriveReceivingReadiness(ackRecord);
  const receivingReady = classification === "ack_confirmed_ready" && isReceivingReady(readinessCheck);
  const followupRequired = !receivingReady && classification !== "ack_declined";

  return { ackResolutionSessionId: `ackres_${Date.now().toString(36)}`, caseId, sentStateRecordId, ackRecordId: ackRecord.ackRecordId, sessionStatus: "classification_pending", ackClassification: classification, receivingReadinessCheck: readinessCheck, receivingReady, followupRequired, followupReason: followupRequired ? `Classification: ${classification}, receiving not ready` : "", exceptionRequired: classification === "ack_declined", exceptionReason: classification === "ack_declined" ? "Supplier declined" : "", acceptedLineSet: [], changedLineSet: [], rejectedLineSet: [], supplierResponseSnapshot: ackRecord.ackContent, nextHandoffTarget: receivingReady ? "receiving_preparation_handoff" : followupRequired ? "ack_followup" : "hold", operatorNote: "", openedAt: now, lastUpdatedAt: now, openedBy: actor, auditEventRefs: [] };
}

// ── Apply Mutation ──
export function applyAckResolutionMutation(session: SupplierAckResolutionSessionV2, payload: AckResolutionActionPayload): SupplierAckResolutionMutationResultV2 {
  const now = payload.timestamp; const events: AckResolutionEvent[] = [];
  const makeEvent = (type: AckResolutionEventType, reason: string): AckResolutionEvent => ({ type, caseId: session.caseId, ackResolutionSessionId: session.ackResolutionSessionId, ackRecordId: session.ackRecordId, ackClassification: session.ackClassification, receivingReady: session.receivingReady, nextTarget: session.nextHandoffTarget, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): SupplierAckResolutionMutationResultV2 => { events.push(makeEvent("ack_resolution_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now };

  switch (payload.action) {
    case "open_ack_resolution_session": { u.sessionStatus = "classification_pending"; events.push(makeEvent("ack_resolution_session_opened", "Session opened")); break; }

    case "classify_ack": {
      if (!payload.ackClassification) return reject("Ack classification 필수");
      u.ackClassification = payload.ackClassification;
      u.sessionStatus = "classified";
      // Refine: confirmed_ready only if readiness check passes
      if (payload.ackClassification === "ack_confirmed_ready" && !isReceivingReady(u.receivingReadinessCheck)) {
        u.ackClassification = "ack_confirmed_pending_detail";
      }
      u.followupRequired = u.ackClassification !== "ack_confirmed_ready";
      u.exceptionRequired = u.ackClassification === "ack_declined";
      u.nextHandoffTarget = u.ackClassification === "ack_confirmed_ready" ? "receiving_preparation_handoff" : u.exceptionRequired ? "exception_recovery" : "ack_followup";
      events.push(makeEvent("ack_classified", `Classified: ${u.ackClassification}`));
      break;
    }

    case "run_receiving_readiness_check": {
      if (payload.receivingReadinessOverride) {
        u.receivingReadinessCheck = { ...u.receivingReadinessCheck, ...payload.receivingReadinessOverride };
      }
      u.receivingReady = isReceivingReady(u.receivingReadinessCheck);
      if (u.ackClassification === "ack_confirmed_pending_detail" && u.receivingReady) {
        u.ackClassification = "ack_confirmed_ready";
        u.nextHandoffTarget = "receiving_preparation_handoff";
        u.followupRequired = false;
      } else if (u.ackClassification === "ack_confirmed_ready" && !u.receivingReady) {
        u.ackClassification = "ack_confirmed_pending_detail";
        u.nextHandoffTarget = "ack_followup";
        u.followupRequired = true;
      }
      events.push(makeEvent("ack_receiving_readiness_checked", `Receiving ready: ${u.receivingReady}`));
      break;
    }

    case "mark_receiving_handoff_ready": {
      if (!u.receivingReady) return reject("Receiving not ready — confirmed + receiving-ready일 때만 handoff 가능");
      if (u.ackClassification !== "ack_confirmed_ready") return reject("Ack classification이 confirmed_ready가 아님");
      u.sessionStatus = "receiving_handoff_ready";
      u.nextHandoffTarget = "receiving_preparation_handoff";
      events.push(makeEvent("ack_receiving_handoff_ready", "Receiving handoff ready"));
      break;
    }

    case "route_to_followup": {
      u.sessionStatus = "followup_required";
      u.nextHandoffTarget = "ack_followup";
      u.followupReason = payload.followupReason || u.followupReason || "Followup required";
      events.push(makeEvent("ack_followup_routed", u.followupReason));
      break;
    }

    case "route_to_exception": {
      u.sessionStatus = "exception_routed";
      u.nextHandoffTarget = "exception_recovery";
      u.exceptionReason = payload.exceptionReason || "Exception routed";
      events.push(makeEvent("ack_exception_routed", u.exceptionReason));
      break;
    }

    case "hold_ack_resolution": { u.sessionStatus = "hold"; u.nextHandoffTarget = "hold"; events.push(makeEvent("ack_resolution_held", payload.reason || "Hold")); break; }
    case "resolve_ack": { u.sessionStatus = "resolved"; events.push(makeEvent("ack_resolved", payload.reason || "Resolved")); break; }

    default: return reject(`Unknown action: ${payload.action}`);
  }

  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, emittedEvents: events };
}
