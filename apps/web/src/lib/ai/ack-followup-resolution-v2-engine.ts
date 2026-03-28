/**
 * Ack Followup Resolution v2 — followup action → response classification → routing
 * followup 결과 → receiving_preparation_handoff 또는 exception_recovery.
 */

import type { AckFollowupWorkspaceStateV2, FollowupWorkspaceStatus } from "./ack-followup-workspace-v2";
import type { AckClassification } from "./supplier-acknowledgment-resolution-v2-engine";

export type FollowupSessionStatus = "followup_open" | "followup_draft_in_progress" | "followup_sent" | "followup_response_pending" | "followup_response_received" | "followup_classified" | "followup_resolved_confirmed_ready" | "followup_resolved_exception" | "followup_hold" | "followup_timeout";

export interface AckFollowupSessionV2 { followupSessionId: string; caseId: string; sentStateRecordId: string; ackResolutionSessionId: string; sessionStatus: FollowupSessionStatus; followupContent: string; followupSentAt: string | null; responseContent: string; responseReceivedAt: string | null; responseClassification: AckClassification | null; receivingReadyAfterFollowup: boolean; nextTarget: "receiving_preparation_handoff" | "exception_recovery" | "retry_followup" | "hold"; retryCount: number; openedAt: string; lastUpdatedAt: string; openedBy: string; auditEventRefs: string[]; }

export type FollowupAction = "open_followup_session" | "draft_followup" | "send_followup" | "record_response" | "classify_response" | "resolve_as_confirmed_ready" | "resolve_as_exception" | "retry_followup" | "hold_followup" | "mark_timeout";
export interface FollowupActionPayload { action: FollowupAction; content?: string; responseClassification?: AckClassification; reason?: string; actor: string; timestamp: string; }
export interface AckFollowupMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: AckFollowupSessionV2; emittedEvents: FollowupEvent[]; }

export type FollowupEventType = "followup_session_opened" | "followup_drafted" | "followup_sent" | "followup_response_recorded" | "followup_response_classified" | "followup_resolved_confirmed_ready" | "followup_resolved_exception" | "followup_retried" | "followup_held" | "followup_timeout" | "followup_mutation_rejected";
export interface FollowupEvent { type: FollowupEventType; caseId: string; followupSessionId: string; reason: string; actor: string; timestamp: string; }

export function createInitialFollowupSession(caseId: string, sentStateRecordId: string, ackResolutionSessionId: string, actor: string): AckFollowupSessionV2 {
  const now = new Date().toISOString();
  return { followupSessionId: `fllwsn_${Date.now().toString(36)}`, caseId, sentStateRecordId, ackResolutionSessionId, sessionStatus: "followup_open", followupContent: "", followupSentAt: null, responseContent: "", responseReceivedAt: null, responseClassification: null, receivingReadyAfterFollowup: false, nextTarget: "hold", retryCount: 0, openedAt: now, lastUpdatedAt: now, openedBy: actor, auditEventRefs: [] };
}

export function applyAckFollowupMutation(session: AckFollowupSessionV2, payload: FollowupActionPayload): AckFollowupMutationResultV2 {
  const now = payload.timestamp; const events: FollowupEvent[] = [];
  const makeEvent = (type: FollowupEventType, reason: string): FollowupEvent => ({ type, caseId: session.caseId, followupSessionId: session.followupSessionId, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): AckFollowupMutationResultV2 => { events.push(makeEvent("followup_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now };

  switch (payload.action) {
    case "open_followup_session": { u.sessionStatus = "followup_open"; events.push(makeEvent("followup_session_opened", "Opened")); break; }
    case "draft_followup": { if (!payload.content) return reject("Content 필수"); u.followupContent = payload.content; u.sessionStatus = "followup_draft_in_progress"; events.push(makeEvent("followup_drafted", "Draft created")); break; }
    case "send_followup": { if (!u.followupContent) return reject("Draft 없이 전송 불가"); u.followupSentAt = now; u.sessionStatus = "followup_sent"; events.push(makeEvent("followup_sent", "Followup sent")); break; }
    case "record_response": { if (!payload.content) return reject("Response content 필수"); u.responseContent = payload.content; u.responseReceivedAt = now; u.sessionStatus = "followup_response_received"; events.push(makeEvent("followup_response_recorded", "Response recorded")); break; }
    case "classify_response": { if (!payload.responseClassification) return reject("Classification 필수"); u.responseClassification = payload.responseClassification; u.sessionStatus = "followup_classified"; u.receivingReadyAfterFollowup = payload.responseClassification === "ack_confirmed_ready"; u.nextTarget = u.receivingReadyAfterFollowup ? "receiving_preparation_handoff" : payload.responseClassification === "ack_declined" ? "exception_recovery" : "retry_followup"; events.push(makeEvent("followup_response_classified", `Classified: ${payload.responseClassification}`)); break; }
    case "resolve_as_confirmed_ready": { if (!u.receivingReadyAfterFollowup) return reject("Receiving not ready after followup"); u.sessionStatus = "followup_resolved_confirmed_ready"; u.nextTarget = "receiving_preparation_handoff"; events.push(makeEvent("followup_resolved_confirmed_ready", "Resolved — receiving handoff ready")); break; }
    case "resolve_as_exception": { u.sessionStatus = "followup_resolved_exception"; u.nextTarget = "exception_recovery"; events.push(makeEvent("followup_resolved_exception", payload.reason || "Exception")); break; }
    case "retry_followup": { u.sessionStatus = "followup_open"; u.followupContent = ""; u.followupSentAt = null; u.responseContent = ""; u.responseReceivedAt = null; u.responseClassification = null; u.receivingReadyAfterFollowup = false; u.retryCount += 1; u.nextTarget = "hold"; events.push(makeEvent("followup_retried", `Retry #${u.retryCount}`)); break; }
    case "hold_followup": { u.sessionStatus = "followup_hold"; u.nextTarget = "hold"; events.push(makeEvent("followup_held", payload.reason || "Hold")); break; }
    case "mark_timeout": { u.sessionStatus = "followup_timeout"; u.nextTarget = "exception_recovery"; events.push(makeEvent("followup_timeout", "Timeout")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }
  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, emittedEvents: events };
}
