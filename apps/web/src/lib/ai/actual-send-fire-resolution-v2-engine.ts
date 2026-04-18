/**
 * Actual Send Fire Resolution v2 Engine — fire action → canonical mutation → audit
 *
 * Batch 1 ABSOLUTE TERMINAL mutation spine.
 * fire_ready_pending_ignition = Batch 1 chain endpoint.
 * Batch 2: actual ignition → sent → dispatched → tracking.
 */

import type { FireSectionKey } from "./actual-send-fire-workspace-v2";

export type FireSessionStatus = "fire_open" | "fire_review_in_progress" | "fire_hold" | "returned_to_actual_send_execute" | "returned_to_run_or_commit" | "fire_ready_pending_ignition" | "fire_locked";
export type FirePhase = "final_fire_resolution" | "payload_integrity_clearance" | "authorization_and_audit_confirmation" | "ignition_readiness_check" | "pending_actual_send_ignition";

export interface ActualSendFireSessionV2 {
  actualSendFireSessionId: string; caseId: string; handoffPackageId: string; actualSendFireGateId: string; actualSendExecuteSessionId: string;
  sessionStatus: FireSessionStatus; firePhase: FirePhase;
  openedAt: string; lastUpdatedAt: string; openedBy: string;
  activeSectionKey: FireSectionKey | null; operatorFocusOrder: FireSectionKey[];
  sectionResolutionStates: ActualSendFireSectionResolutionStateV2[];
  ignitionReadinessGateState: ActualSendFireIgnitionReadinessGateStateV2;
  returnHistory: FireReturnRecord[]; reopenLinks: string[]; auditEventRefs: string[]; provenance: string;
}

export type FireSectionResolutionStatus = "unreviewed" | "in_review" | "resolved_in_place" | "reviewed_with_warning" | "returned_to_actual_send_execute" | "returned_to_run_or_commit" | "blocked_unresolved" | "reviewed_complete";
export type FireSectionResolutionMode = "in_place" | "warning_acknowledged" | "return_to_actual_send_execute" | "return_to_run_or_commit" | "guard_confirmation" | "authorization_audit_confirmation" | "not_applicable";

export interface ActualSendFireSectionResolutionStateV2 {
  sectionKey: FireSectionKey; resolutionStatus: FireSectionResolutionStatus; resolutionMode: FireSectionResolutionMode;
  resolvedAt: string | null; resolvedBy: string | null; resolutionReason: string;
  remainingUnresolvedInputs: string[]; remainingWarnings: string[];
  requiresReturnToActualSendExecute: boolean; requiresReturnToRunOrCommit: boolean; requiresRevisitAfterReturn: boolean;
  eligibleForIgnitionReadiness: boolean; fieldGroupSnapshotRef: string; evidenceNote: string;
}

export type IgnitionReadyStatus = "not_ready" | "needs_review" | "ready_for_marking" | "fire_ready_pending_ignition";

export interface ActualSendFireIgnitionReadinessGateStateV2 {
  ignitionReadinessStatus: IgnitionReadyStatus; requiredSectionsTotal: number; sectionsReadyCount: number;
  unresolvedSectionKeys: FireSectionKey[]; warningOnlySectionKeys: FireSectionKey[];
  ignitionReadinessBlockers: string[]; ignitionReadinessAllowed: boolean; ignitionReadinessReason: string;
  nextGateStatus: "locked" | "batch1_terminal"; actualSendIgnitionEnablementStatus: "disabled_batch1_terminal"; actualSendStatus: "not_sent";
}

export interface FireReturnRecord { returnReason: string; returnSectionKey: FireSectionKey; triggerConflictOrGap: string; returnTarget: "actual_send_execute" | "run_or_commit"; linkedUpstreamSectionIfAny: string | null; returnedAt: string; returnedBy: string; requiresRevisitAfterReturn: boolean; expectedReentryBasis: string; }

export type FireAction = "open_actual_send_fire_session" | "set_active_section" | "mark_section_in_review" | "resolve_fire_gap_in_place" | "acknowledge_fire_warning" | "mark_section_reviewed" | "return_section_to_actual_send_execute_review" | "return_section_to_run_or_commit" | "reopen_section_after_return" | "mark_exclusion_guard_fire_rechecked" | "mark_actor_authorization_audit_confirmed" | "run_ignition_readiness_check" | "mark_fire_ready";
export type ForbiddenFireAction = "execute_actual_send_ignition" | "mark_sent" | "mark_dispatched" | "create_delivery_tracking_record" | "freeze_transport_payload" | "emit_supplier_send_receipt";

export interface FireActionPayload { action: FireAction; sectionKey?: FireSectionKey; reason?: string; returnTarget?: "actual_send_execute" | "run_or_commit"; actor: string; timestamp: string; }
export interface ActualSendFireMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: ActualSendFireSessionV2; updatedWorkspaceStatusIfAny: string | null; recomputeRequired: boolean; emittedEvents: FireAuditEvent[]; }

export type FireAuditEventType = "actual_send_fire_session_opened" | "actual_send_fire_section_review_started" | "actual_send_fire_section_resolved_in_place" | "actual_send_fire_section_warning_acknowledged" | "actual_send_fire_section_returned_to_actual_send_execute" | "actual_send_fire_section_returned_to_run_or_commit" | "actual_send_fire_section_reopened_after_return" | "actual_send_fire_exclusion_guard_rechecked" | "actual_send_fire_actor_authorization_audit_confirmed" | "actual_send_fire_ignition_readiness_check_run" | "actual_send_fire_marked_ready_pending_ignition" | "actual_send_fire_mutation_rejected";

export interface FireAuditEvent { type: FireAuditEventType; caseId: string; sessionId: string; handoffPackageId: string; gateId: string; sectionKeyIfAny: FireSectionKey | null; actionKey: FireAction | ForbiddenFireAction; reason: string; actor: string; timestamp: string; }

const DEPS: Partial<Record<FireSectionKey, FireSectionKey[]>> = {
  recipient_fire_final_block: ["payload_integrity_fire_final_block", "reference_instruction_fire_final_block"],
  payload_integrity_fire_final_block: ["reference_instruction_fire_final_block", "fire_completion_gate_review"],
  reference_instruction_fire_final_block: ["exclusion_guard_fire_final_block", "fire_completion_gate_review"],
  exclusion_guard_fire_final_block: ["actor_authorization_audit_fire_final_block", "fire_completion_gate_review"],
  actor_authorization_audit_fire_final_block: ["fire_completion_gate_review"],
};
function getDeps(k: FireSectionKey): FireSectionKey[] { return DEPS[k] || []; }

function recomputeIgnitionReadiness(secs: ActualSendFireSectionResolutionStateV2[]): ActualSendFireIgnitionReadinessGateStateV2 {
  const total = secs.length; const ready = secs.filter(s => s.eligibleForIgnitionReadiness).length;
  const unresolved = secs.filter(s => s.resolutionStatus === "blocked_unresolved" || s.resolutionStatus === "returned_to_actual_send_execute" || s.resolutionStatus === "returned_to_run_or_commit" || s.resolutionStatus === "unreviewed" || s.resolutionStatus === "in_review" || s.remainingUnresolvedInputs.length > 0).map(s => s.sectionKey);
  const warningOnly = secs.filter(s => s.resolutionStatus === "reviewed_with_warning" && s.remainingUnresolvedInputs.length === 0).map(s => s.sectionKey);
  const allowed = unresolved.length === 0;
  return { ignitionReadinessStatus: allowed ? "ready_for_marking" : "not_ready", requiredSectionsTotal: total, sectionsReadyCount: ready, unresolvedSectionKeys: unresolved, warningOnlySectionKeys: warningOnly, ignitionReadinessBlockers: unresolved.map(k => `Section ${k}: unresolved`), ignitionReadinessAllowed: allowed, ignitionReadinessReason: allowed ? "모든 section ignition-ready — Batch 1 terminal reached" : "미해소 section 존재", nextGateStatus: "batch1_terminal", actualSendIgnitionEnablementStatus: "disabled_batch1_terminal", actualSendStatus: "not_sent" };
}

const ALL: FireSectionKey[] = ["recipient_fire_final_block", "payload_integrity_fire_final_block", "reference_instruction_fire_final_block", "exclusion_guard_fire_final_block", "actor_authorization_audit_fire_final_block", "fire_completion_gate_review"];

export function createInitialFireSession(caseId: string, handoffPackageId: string, gateId: string, executeSessionId: string, actor: string): ActualSendFireSessionV2 {
  const now = new Date().toISOString();
  const secs: ActualSendFireSectionResolutionStateV2[] = ALL.map(k => ({ sectionKey: k, resolutionStatus: "unreviewed", resolutionMode: "not_applicable", resolvedAt: null, resolvedBy: null, resolutionReason: "", remainingUnresolvedInputs: [], remainingWarnings: [], requiresReturnToActualSendExecute: false, requiresReturnToRunOrCommit: false, requiresRevisitAfterReturn: false, eligibleForIgnitionReadiness: false, fieldGroupSnapshotRef: handoffPackageId, evidenceNote: "" }));
  return { actualSendFireSessionId: `firesn_${Date.now().toString(36)}`, caseId, handoffPackageId, actualSendFireGateId: gateId, actualSendExecuteSessionId: executeSessionId, sessionStatus: "fire_open", firePhase: "final_fire_resolution", openedAt: now, lastUpdatedAt: now, openedBy: actor, activeSectionKey: null, operatorFocusOrder: [...ALL], sectionResolutionStates: secs, ignitionReadinessGateState: recomputeIgnitionReadiness(secs), returnHistory: [], reopenLinks: [], auditEventRefs: [], provenance: handoffPackageId };
}

export function applyActualSendFireMutation(session: ActualSendFireSessionV2, payload: FireActionPayload): ActualSendFireMutationResultV2 {
  const now = payload.timestamp; const events: FireAuditEvent[] = [];
  const makeEvent = (type: FireAuditEventType, reason: string): FireAuditEvent => ({ type, caseId: session.caseId, sessionId: session.actualSendFireSessionId, handoffPackageId: session.handoffPackageId, gateId: session.actualSendFireGateId, sectionKeyIfAny: payload.sectionKey ?? null, actionKey: payload.action, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): ActualSendFireMutationResultV2 => { events.push(makeEvent("actual_send_fire_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, updatedWorkspaceStatusIfAny: null, recomputeRequired: false, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now, sectionResolutionStates: session.sectionResolutionStates.map(s => ({ ...s })) };
  const find = (k: FireSectionKey) => u.sectionResolutionStates.find(s => s.sectionKey === k);
  const markDeps = (k: FireSectionKey) => { for (const dk of getDeps(k)) { const d = find(dk); if (d && d.resolutionStatus !== "unreviewed") d.requiresRevisitAfterReturn = true; } };

  switch (payload.action) {
    case "open_actual_send_fire_session": { u.sessionStatus = "fire_open"; u.firePhase = "final_fire_resolution"; events.push(makeEvent("actual_send_fire_session_opened", "Session opened")); break; }
    case "set_active_section": { if (!payload.sectionKey) return reject("Section key 필수"); u.activeSectionKey = payload.sectionKey; break; }
    case "mark_section_in_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "in_review"; u.sessionStatus = "fire_review_in_progress"; events.push(makeEvent("actual_send_fire_section_review_started", `${payload.sectionKey} review started`)); break; }
    case "resolve_fire_gap_in_place": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "resolved_in_place"; s.resolutionMode = "in_place"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForIgnitionReadiness = true; s.requiresRevisitAfterReturn = false; markDeps(payload.sectionKey); events.push(makeEvent("actual_send_fire_section_resolved_in_place", `${payload.sectionKey} resolved`)); break; }
    case "acknowledge_fire_warning": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "reviewed_with_warning"; s.resolutionMode = "warning_acknowledged"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForIgnitionReadiness = true; events.push(makeEvent("actual_send_fire_section_warning_acknowledged", `${payload.sectionKey} warning ack`)); break; }
    case "mark_section_reviewed": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); if (s.resolutionStatus === "unreviewed") return reject("먼저 review 필요");
      if (payload.sectionKey === "fire_completion_gate_review") { const others = u.sectionResolutionStates.filter(x => x.sectionKey !== "fire_completion_gate_review"); if (!others.every(x => x.eligibleForIgnitionReadiness)) return reject("다른 section 모두 ignition-ready eligible이어야 함"); }
      s.resolutionStatus = "reviewed_complete"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForIgnitionReadiness = true; break; }
    case "return_section_to_actual_send_execute_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_actual_send_execute"; s.resolutionMode = "return_to_actual_send_execute"; s.requiresRevisitAfterReturn = true; s.eligibleForIgnitionReadiness = false; u.sessionStatus = "returned_to_actual_send_execute"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to execute", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "conflict", returnTarget: "actual_send_execute", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "execute resolution" }); events.push(makeEvent("actual_send_fire_section_returned_to_actual_send_execute", `${payload.sectionKey} → execute`)); break; }
    case "return_section_to_run_or_commit": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_run_or_commit"; s.resolutionMode = "return_to_run_or_commit"; s.requiresRevisitAfterReturn = true; s.eligibleForIgnitionReadiness = false; u.sessionStatus = "returned_to_run_or_commit"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to run/commit", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "basis conflict", returnTarget: "run_or_commit", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "run/commit resolution" }); events.push(makeEvent("actual_send_fire_section_returned_to_run_or_commit", `${payload.sectionKey} → run/commit`)); break; }
    case "reopen_section_after_return": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "unreviewed"; s.resolutionMode = "not_applicable"; s.resolvedAt = null; s.resolvedBy = null; s.requiresRevisitAfterReturn = false; s.eligibleForIgnitionReadiness = false; if (u.sessionStatus === "returned_to_actual_send_execute" || u.sessionStatus === "returned_to_run_or_commit") { u.sessionStatus = "fire_review_in_progress"; u.firePhase = "final_fire_resolution"; } events.push(makeEvent("actual_send_fire_section_reopened_after_return", `${payload.sectionKey} reopened`)); break; }
    case "mark_exclusion_guard_fire_rechecked": { const s = find("exclusion_guard_fire_final_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Contamination risk 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "guard_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForIgnitionReadiness = true; s.evidenceNote = `Fire guard rechecked at ${now}`; markDeps("exclusion_guard_fire_final_block"); events.push(makeEvent("actual_send_fire_exclusion_guard_rechecked", "Fire exclusion guard rechecked")); break; }
    case "mark_actor_authorization_audit_confirmed": { const s = find("actor_authorization_audit_fire_final_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Authorization/audit gap 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "authorization_audit_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForIgnitionReadiness = true; s.evidenceNote = `Fire authorization/audit confirmed at ${now}`; markDeps("actor_authorization_audit_fire_final_block"); events.push(makeEvent("actual_send_fire_actor_authorization_audit_confirmed", "Fire authorization/audit confirmed")); break; }
    case "run_ignition_readiness_check": { u.firePhase = "ignition_readiness_check"; u.ignitionReadinessGateState = recomputeIgnitionReadiness(u.sectionResolutionStates); events.push(makeEvent("actual_send_fire_ignition_readiness_check_run", `Ignition readiness: ${u.ignitionReadinessGateState.ignitionReadinessStatus}`)); break; }
    case "mark_fire_ready": { u.ignitionReadinessGateState = recomputeIgnitionReadiness(u.sectionResolutionStates); if (!u.ignitionReadinessGateState.ignitionReadinessAllowed) return reject(`Fire ready 불가: ${u.ignitionReadinessGateState.ignitionReadinessBlockers.join("; ")}`); u.sessionStatus = "fire_ready_pending_ignition"; u.firePhase = "pending_actual_send_ignition"; u.ignitionReadinessGateState.ignitionReadinessStatus = "fire_ready_pending_ignition"; u.ignitionReadinessGateState.ignitionReadinessReason = "Fire ready — Batch 1 terminal reached. Actual send ignition pending Batch 2."; u.ignitionReadinessGateState.nextGateStatus = "batch1_terminal"; events.push(makeEvent("actual_send_fire_marked_ready_pending_ignition", "Fire ready — Batch 1 terminal reached")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }

  u.ignitionReadinessGateState = recomputeIgnitionReadiness(u.sectionResolutionStates);
  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, updatedWorkspaceStatusIfAny: u.sessionStatus === "returned_to_actual_send_execute" || u.sessionStatus === "returned_to_run_or_commit" ? "fire_hold" : null, recomputeRequired: true, emittedEvents: events };
}
