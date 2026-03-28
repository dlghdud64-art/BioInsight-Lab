/**
 * Receiving Preparation Resolution v2 — prep action → readiness mutation → audit
 */

import type { ReceivingPrepWorkspaceStateV2, ReceivingPrepWorkspaceStatus } from "./receiving-preparation-workspace-v2";
import type { CanonicalProcurementLineRef } from "./supplier-acknowledgment-resolution-v2-engine";

export type ReceivingPrepSessionStatus = "prep_open" | "prep_in_progress" | "prep_hold" | "prep_ready_for_execution" | "prep_blocked";
export interface ReceivingPrepSessionV2 { prepSessionId: string; caseId: string; sentStateRecordId: string; ackResolutionSessionId: string; sessionStatus: ReceivingPrepSessionStatus; /** P1 FIX: typed line reference — expectedQty 전파. */ receivingExpectedLineSet: CanonicalProcurementLineRef[]; shipmentReferenceSet: string[]; etaWindow: string; missingInputs: string[]; warnings: string[]; executionAllowed: boolean; openedAt: string; lastUpdatedAt: string; openedBy: string; auditEventRefs: string[]; }

export type PrepAction = "open_prep_session" | "update_eta" | "update_shipment_reference" | "resolve_missing_input" | "acknowledge_warning" | "mark_prep_ready" | "hold_prep";
export interface PrepActionPayload { action: PrepAction; value?: string; inputKey?: string; reason?: string; actor: string; timestamp: string; }
export interface ReceivingPrepMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: ReceivingPrepSessionV2; emittedEvents: PrepEvent[]; }

export type PrepEventType = "receiving_prep_session_opened" | "receiving_prep_eta_updated" | "receiving_prep_reference_updated" | "receiving_prep_input_resolved" | "receiving_prep_warning_acknowledged" | "receiving_prep_marked_ready" | "receiving_prep_held" | "receiving_prep_mutation_rejected";
export interface PrepEvent { type: PrepEventType; caseId: string; prepSessionId: string; reason: string; actor: string; timestamp: string; }

export function createInitialPrepSession(caseId: string, sentStateRecordId: string, ackResolutionSessionId: string, expectedLines: CanonicalProcurementLineRef[], actor: string): ReceivingPrepSessionV2 {
  const now = new Date().toISOString();
  return { prepSessionId: `prepsn_${Date.now().toString(36)}`, caseId, sentStateRecordId, ackResolutionSessionId, sessionStatus: "prep_open", receivingExpectedLineSet: expectedLines, shipmentReferenceSet: [], etaWindow: "", missingInputs: ["ETA/출고 시점", "배송 참조번호"], warnings: [], executionAllowed: false, openedAt: now, lastUpdatedAt: now, openedBy: actor, auditEventRefs: [] };
}

export function applyReceivingPrepMutation(session: ReceivingPrepSessionV2, payload: PrepActionPayload): ReceivingPrepMutationResultV2 {
  const now = payload.timestamp; const events: PrepEvent[] = [];
  const makeEvent = (type: PrepEventType, reason: string): PrepEvent => ({ type, caseId: session.caseId, prepSessionId: session.prepSessionId, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): ReceivingPrepMutationResultV2 => { events.push(makeEvent("receiving_prep_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now, missingInputs: [...session.missingInputs], warnings: [...session.warnings], shipmentReferenceSet: [...session.shipmentReferenceSet] };

  switch (payload.action) {
    case "open_prep_session": { u.sessionStatus = "prep_open"; events.push(makeEvent("receiving_prep_session_opened", "Opened")); break; }
    case "update_eta": { if (!payload.value) return reject("ETA 값 필수"); u.etaWindow = payload.value; u.missingInputs = u.missingInputs.filter(i => i !== "ETA/출고 시점"); u.sessionStatus = "prep_in_progress"; events.push(makeEvent("receiving_prep_eta_updated", payload.value)); break; }
    case "update_shipment_reference": { if (!payload.value) return reject("Reference 값 필수"); u.shipmentReferenceSet.push(payload.value); u.missingInputs = u.missingInputs.filter(i => i !== "배송 참조번호"); events.push(makeEvent("receiving_prep_reference_updated", payload.value)); break; }
    case "resolve_missing_input": { if (!payload.inputKey) return reject("Input key 필수"); u.missingInputs = u.missingInputs.filter(i => i !== payload.inputKey); events.push(makeEvent("receiving_prep_input_resolved", payload.inputKey)); break; }
    case "acknowledge_warning": { if (!payload.inputKey) return reject("Warning key 필수"); u.warnings = u.warnings.filter(w => w !== payload.inputKey); events.push(makeEvent("receiving_prep_warning_acknowledged", payload.inputKey)); break; }
    case "mark_prep_ready": { if (u.missingInputs.length > 0) return reject(`Missing inputs: ${u.missingInputs.join(", ")}`); u.sessionStatus = "prep_ready_for_execution"; u.executionAllowed = true; events.push(makeEvent("receiving_prep_marked_ready", "Prep ready")); break; }
    case "hold_prep": { u.sessionStatus = "prep_hold"; events.push(makeEvent("receiving_prep_held", payload.reason || "Hold")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }
  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, emittedEvents: events };
}
