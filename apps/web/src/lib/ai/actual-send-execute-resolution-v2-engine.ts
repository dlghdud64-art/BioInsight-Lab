/**
 * Actual Send Execute Resolution v2 Engine — execute action → canonical mutation → audit
 *
 * 고정 규칙: execute ready ≠ sent ≠ dispatched. return 후 자동 ready 금지.
 * Batch 1: fire/mark_sent/mark_dispatched 전부 금지.
 * Dispatch v2 chain absolute terminal mutation spine.
 */

import type { ExecuteSectionKey } from "./actual-send-execute-workspace-v2";

export type ExecuteSessionStatus = "execute_open" | "execute_review_in_progress" | "execute_hold" | "returned_to_actual_send_run" | "returned_to_execution_or_commit" | "execute_ready_pending_fire" | "execute_locked";
export type ExecutePhase = "final_execute_resolution" | "payload_integrity_clearance" | "authorization_and_audit_confirmation" | "fire_readiness_check" | "pending_actual_send_fire";

export interface ActualSendExecuteSessionV2 {
  actualSendExecuteSessionId: string; caseId: string; handoffPackageId: string; actualSendExecuteGateId: string; actualSendRunSessionId: string;
  sessionStatus: ExecuteSessionStatus; executePhase: ExecutePhase;
  openedAt: string; lastUpdatedAt: string; openedBy: string;
  activeSectionKey: ExecuteSectionKey | null; operatorFocusOrder: ExecuteSectionKey[];
  sectionResolutionStates: ActualSendExecuteSectionResolutionStateV2[];
  fireReadinessGateState: ActualSendExecuteFireReadinessGateStateV2;
  returnHistory: ExecuteReturnRecord[]; reopenLinks: string[]; auditEventRefs: string[]; provenance: string;
}

export type ExecuteSectionResolutionStatus = "unreviewed" | "in_review" | "resolved_in_place" | "reviewed_with_warning" | "returned_to_actual_send_run" | "returned_to_execution_or_commit" | "blocked_unresolved" | "reviewed_complete";
export type ExecuteSectionResolutionMode = "in_place" | "warning_acknowledged" | "return_to_actual_send_run" | "return_to_execution_or_commit" | "guard_confirmation" | "authorization_audit_confirmation" | "not_applicable";

export interface ActualSendExecuteSectionResolutionStateV2 {
  sectionKey: ExecuteSectionKey; resolutionStatus: ExecuteSectionResolutionStatus; resolutionMode: ExecuteSectionResolutionMode;
  resolvedAt: string | null; resolvedBy: string | null; resolutionReason: string;
  remainingUnresolvedInputs: string[]; remainingWarnings: string[];
  requiresReturnToActualSendRun: boolean; requiresReturnToExecutionOrCommit: boolean; requiresRevisitAfterReturn: boolean;
  eligibleForFireReadiness: boolean; fieldGroupSnapshotRef: string; evidenceNote: string;
}

export type FireReadyStatus = "not_ready" | "needs_review" | "ready_for_marking" | "execute_ready_pending_fire";

export interface ActualSendExecuteFireReadinessGateStateV2 {
  fireReadinessStatus: FireReadyStatus; requiredSectionsTotal: number; sectionsReadyCount: number;
  unresolvedSectionKeys: ExecuteSectionKey[]; warningOnlySectionKeys: ExecuteSectionKey[];
  fireReadinessBlockers: string[]; fireReadinessAllowed: boolean; fireReadinessReason: string;
  nextGateStatus: "locked" | "pending_actual_send_fire"; actualSendFireEnablementStatus: "disabled"; actualSendStatus: "not_sent";
}

export interface ExecuteReturnRecord { returnReason: string; returnSectionKey: ExecuteSectionKey; triggerConflictOrGap: string; returnTarget: "actual_send_run" | "execution_or_commit"; linkedUpstreamSectionIfAny: string | null; returnedAt: string; returnedBy: string; requiresRevisitAfterReturn: boolean; expectedReentryBasis: string; }

export type ExecuteAction = "open_actual_send_execute_session" | "set_active_section" | "mark_section_in_review" | "resolve_execute_gap_in_place" | "acknowledge_execute_warning" | "mark_section_reviewed" | "return_section_to_actual_send_run_review" | "return_section_to_execution_or_commit" | "reopen_section_after_return" | "mark_exclusion_guard_execute_rechecked" | "mark_actor_authorization_audit_confirmed" | "run_fire_readiness_check" | "mark_execute_ready";
export type ForbiddenExecuteAction = "execute_actual_send_fire" | "mark_sent" | "mark_dispatched" | "create_delivery_tracking_record" | "freeze_transport_payload" | "emit_supplier_send_receipt";

export interface ExecuteActionPayload { action: ExecuteAction; sectionKey?: ExecuteSectionKey; reason?: string; returnTarget?: "actual_send_run" | "execution_or_commit"; actor: string; timestamp: string; }

export interface ActualSendExecuteMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: ActualSendExecuteSessionV2; updatedWorkspaceStatusIfAny: string | null; recomputeRequired: boolean; emittedEvents: ExecuteAuditEvent[]; }

export type ExecuteAuditEventType = "actual_send_execute_session_opened" | "actual_send_execute_section_review_started" | "actual_send_execute_section_resolved_in_place" | "actual_send_execute_section_warning_acknowledged" | "actual_send_execute_section_returned_to_actual_send_run" | "actual_send_execute_section_returned_to_execution_or_commit" | "actual_send_execute_section_reopened_after_return" | "actual_send_execute_exclusion_guard_rechecked" | "actual_send_execute_actor_authorization_audit_confirmed" | "actual_send_execute_fire_readiness_check_run" | "actual_send_execute_marked_ready_pending_fire" | "actual_send_execute_mutation_rejected";

export interface ExecuteAuditEvent { type: ExecuteAuditEventType; caseId: string; sessionId: string; handoffPackageId: string; gateId: string; sectionKeyIfAny: ExecuteSectionKey | null; actionKey: ExecuteAction | ForbiddenExecuteAction; reason: string; actor: string; timestamp: string; }

const DEPS: Partial<Record<ExecuteSectionKey, ExecuteSectionKey[]>> = {
  recipient_execute_final_block: ["payload_integrity_execute_final_block", "reference_instruction_execute_final_block"],
  payload_integrity_execute_final_block: ["reference_instruction_execute_final_block", "execute_completion_gate_review"],
  reference_instruction_execute_final_block: ["exclusion_guard_execute_final_block", "execute_completion_gate_review"],
  exclusion_guard_execute_final_block: ["actor_authorization_audit_execute_final_block", "execute_completion_gate_review"],
  actor_authorization_audit_execute_final_block: ["execute_completion_gate_review"],
};
function getDeps(k: ExecuteSectionKey): ExecuteSectionKey[] { return DEPS[k] || []; }

function recomputeFireReadiness(secs: ActualSendExecuteSectionResolutionStateV2[]): ActualSendExecuteFireReadinessGateStateV2 {
  const total = secs.length; const ready = secs.filter(s => s.eligibleForFireReadiness).length;
  const unresolved = secs.filter(s => s.resolutionStatus === "blocked_unresolved" || s.resolutionStatus === "returned_to_actual_send_run" || s.resolutionStatus === "returned_to_execution_or_commit" || s.resolutionStatus === "unreviewed" || s.resolutionStatus === "in_review" || s.remainingUnresolvedInputs.length > 0).map(s => s.sectionKey);
  const warningOnly = secs.filter(s => s.resolutionStatus === "reviewed_with_warning" && s.remainingUnresolvedInputs.length === 0).map(s => s.sectionKey);
  const allowed = unresolved.length === 0;
  return { fireReadinessStatus: allowed ? "ready_for_marking" : "not_ready", requiredSectionsTotal: total, sectionsReadyCount: ready, unresolvedSectionKeys: unresolved, warningOnlySectionKeys: warningOnly, fireReadinessBlockers: unresolved.map(k => `Section ${k}: unresolved`), fireReadinessAllowed: allowed, fireReadinessReason: allowed ? "모든 section fire-ready eligible" : "미해소 section 존재", nextGateStatus: "locked", actualSendFireEnablementStatus: "disabled", actualSendStatus: "not_sent" };
}

const ALL: ExecuteSectionKey[] = ["recipient_execute_final_block", "payload_integrity_execute_final_block", "reference_instruction_execute_final_block", "exclusion_guard_execute_final_block", "actor_authorization_audit_execute_final_block", "execute_completion_gate_review"];

export function createInitialExecuteSession(caseId: string, handoffPackageId: string, gateId: string, runSessionId: string, actor: string): ActualSendExecuteSessionV2 {
  const now = new Date().toISOString();
  const secs: ActualSendExecuteSectionResolutionStateV2[] = ALL.map(k => ({ sectionKey: k, resolutionStatus: "unreviewed", resolutionMode: "not_applicable", resolvedAt: null, resolvedBy: null, resolutionReason: "", remainingUnresolvedInputs: [], remainingWarnings: [], requiresReturnToActualSendRun: false, requiresReturnToExecutionOrCommit: false, requiresRevisitAfterReturn: false, eligibleForFireReadiness: false, fieldGroupSnapshotRef: handoffPackageId, evidenceNote: "" }));
  return { actualSendExecuteSessionId: `execsn_${Date.now().toString(36)}`, caseId, handoffPackageId, actualSendExecuteGateId: gateId, actualSendRunSessionId: runSessionId, sessionStatus: "execute_open", executePhase: "final_execute_resolution", openedAt: now, lastUpdatedAt: now, openedBy: actor, activeSectionKey: null, operatorFocusOrder: [...ALL], sectionResolutionStates: secs, fireReadinessGateState: recomputeFireReadiness(secs), returnHistory: [], reopenLinks: [], auditEventRefs: [], provenance: handoffPackageId };
}

export function applyActualSendExecuteMutation(session: ActualSendExecuteSessionV2, payload: ExecuteActionPayload): ActualSendExecuteMutationResultV2 {
  const now = payload.timestamp; const events: ExecuteAuditEvent[] = [];
  const makeEvent = (type: ExecuteAuditEventType, reason: string): ExecuteAuditEvent => ({ type, caseId: session.caseId, sessionId: session.actualSendExecuteSessionId, handoffPackageId: session.handoffPackageId, gateId: session.actualSendExecuteGateId, sectionKeyIfAny: payload.sectionKey ?? null, actionKey: payload.action, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): ActualSendExecuteMutationResultV2 => { events.push(makeEvent("actual_send_execute_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, updatedWorkspaceStatusIfAny: null, recomputeRequired: false, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now, sectionResolutionStates: session.sectionResolutionStates.map(s => ({ ...s })) };
  const find = (k: ExecuteSectionKey) => u.sectionResolutionStates.find(s => s.sectionKey === k);
  const markDeps = (k: ExecuteSectionKey) => { for (const dk of getDeps(k)) { const d = find(dk); if (d && d.resolutionStatus !== "unreviewed") d.requiresRevisitAfterReturn = true; } };

  switch (payload.action) {
    case "open_actual_send_execute_session": { u.sessionStatus = "execute_open"; u.executePhase = "final_execute_resolution"; events.push(makeEvent("actual_send_execute_session_opened", "Session opened")); break; }
    case "set_active_section": { if (!payload.sectionKey) return reject("Section key 필수"); u.activeSectionKey = payload.sectionKey; break; }
    case "mark_section_in_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "in_review"; u.sessionStatus = "execute_review_in_progress"; events.push(makeEvent("actual_send_execute_section_review_started", `${payload.sectionKey} review started`)); break; }
    case "resolve_execute_gap_in_place": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "resolved_in_place"; s.resolutionMode = "in_place"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForFireReadiness = true; s.requiresRevisitAfterReturn = false; markDeps(payload.sectionKey); events.push(makeEvent("actual_send_execute_section_resolved_in_place", `${payload.sectionKey} resolved`)); break; }
    case "acknowledge_execute_warning": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "reviewed_with_warning"; s.resolutionMode = "warning_acknowledged"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForFireReadiness = true; events.push(makeEvent("actual_send_execute_section_warning_acknowledged", `${payload.sectionKey} warning ack`)); break; }
    case "mark_section_reviewed": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); if (s.resolutionStatus === "unreviewed") return reject("먼저 review 필요");
      if (payload.sectionKey === "execute_completion_gate_review") { const others = u.sectionResolutionStates.filter(x => x.sectionKey !== "execute_completion_gate_review"); if (!others.every(x => x.eligibleForFireReadiness)) return reject("다른 section 모두 fire-ready eligible이어야 함"); }
      s.resolutionStatus = "reviewed_complete"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForFireReadiness = true; break; }
    case "return_section_to_actual_send_run_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_actual_send_run"; s.resolutionMode = "return_to_actual_send_run"; s.requiresRevisitAfterReturn = true; s.eligibleForFireReadiness = false; u.sessionStatus = "returned_to_actual_send_run"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to run", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "conflict", returnTarget: "actual_send_run", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "run resolution" }); events.push(makeEvent("actual_send_execute_section_returned_to_actual_send_run", `${payload.sectionKey} → run`)); break; }
    case "return_section_to_execution_or_commit": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_execution_or_commit"; s.resolutionMode = "return_to_execution_or_commit"; s.requiresRevisitAfterReturn = true; s.eligibleForFireReadiness = false; u.sessionStatus = "returned_to_execution_or_commit"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to execution/commit", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "basis conflict", returnTarget: "execution_or_commit", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "execution/commit resolution" }); events.push(makeEvent("actual_send_execute_section_returned_to_execution_or_commit", `${payload.sectionKey} → execution/commit`)); break; }
    case "reopen_section_after_return": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "unreviewed"; s.resolutionMode = "not_applicable"; s.resolvedAt = null; s.resolvedBy = null; s.requiresRevisitAfterReturn = false; s.eligibleForFireReadiness = false; if (u.sessionStatus === "returned_to_actual_send_run" || u.sessionStatus === "returned_to_execution_or_commit") { u.sessionStatus = "execute_review_in_progress"; u.executePhase = "final_execute_resolution"; } events.push(makeEvent("actual_send_execute_section_reopened_after_return", `${payload.sectionKey} reopened`)); break; }
    case "mark_exclusion_guard_execute_rechecked": { const s = find("exclusion_guard_execute_final_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Contamination risk 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "guard_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForFireReadiness = true; s.evidenceNote = `Execute guard rechecked at ${now}`; markDeps("exclusion_guard_execute_final_block"); events.push(makeEvent("actual_send_execute_exclusion_guard_rechecked", "Execute exclusion guard rechecked")); break; }
    case "mark_actor_authorization_audit_confirmed": { const s = find("actor_authorization_audit_execute_final_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Authorization/audit gap 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "authorization_audit_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForFireReadiness = true; s.evidenceNote = `Execute authorization/audit confirmed at ${now}`; markDeps("actor_authorization_audit_execute_final_block"); events.push(makeEvent("actual_send_execute_actor_authorization_audit_confirmed", "Execute authorization/audit confirmed")); break; }
    case "run_fire_readiness_check": { u.executePhase = "fire_readiness_check"; u.fireReadinessGateState = recomputeFireReadiness(u.sectionResolutionStates); events.push(makeEvent("actual_send_execute_fire_readiness_check_run", `Fire readiness: ${u.fireReadinessGateState.fireReadinessStatus}`)); break; }
    case "mark_execute_ready": { u.fireReadinessGateState = recomputeFireReadiness(u.sectionResolutionStates); if (!u.fireReadinessGateState.fireReadinessAllowed) return reject(`Execute ready 불가: ${u.fireReadinessGateState.fireReadinessBlockers.join("; ")}`); u.sessionStatus = "execute_ready_pending_fire"; u.executePhase = "pending_actual_send_fire"; u.fireReadinessGateState.fireReadinessStatus = "execute_ready_pending_fire"; u.fireReadinessGateState.fireReadinessReason = "Execute ready — actual send fire pending (Batch 1: fire locked)"; u.fireReadinessGateState.nextGateStatus = "pending_actual_send_fire"; events.push(makeEvent("actual_send_execute_marked_ready_pending_fire", "Execute ready — pending fire")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }

  u.fireReadinessGateState = recomputeFireReadiness(u.sectionResolutionStates);
  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, updatedWorkspaceStatusIfAny: u.sessionStatus === "returned_to_actual_send_run" || u.sessionStatus === "returned_to_execution_or_commit" ? "execute_hold" : null, recomputeRequired: true, emittedEvents: events };
}
