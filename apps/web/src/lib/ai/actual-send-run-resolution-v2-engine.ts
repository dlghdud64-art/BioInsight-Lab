/**
 * Actual Send Run Resolution v2 Engine — run action → canonical mutation → audit
 *
 * 고정 규칙: run ready ≠ sent ≠ dispatched. return 후 자동 ready 금지.
 * Batch 1: execute_actual_send / mark_sent / mark_dispatched 전부 금지.
 * Dispatch v2 chain terminal mutation spine.
 */

import type { RunSectionKey } from "./actual-send-run-workspace-v2";

export type RunSessionStatus = "run_open" | "run_review_in_progress" | "run_hold" | "returned_to_actual_send_execution" | "returned_to_commit_or_transaction" | "run_ready_pending_execute" | "run_locked";
export type RunPhase = "final_run_resolution" | "payload_integrity_clearance" | "authorization_and_audit_confirmation" | "run_readiness_check" | "pending_actual_send_execute";

export interface ActualSendRunSessionV2 {
  actualSendRunSessionId: string; caseId: string; handoffPackageId: string; actualSendRunGateId: string; actualSendExecutionSessionId: string;
  sessionStatus: RunSessionStatus; runPhase: RunPhase;
  openedAt: string; lastUpdatedAt: string; openedBy: string;
  activeSectionKey: RunSectionKey | null; operatorFocusOrder: RunSectionKey[];
  sectionResolutionStates: ActualSendRunSectionResolutionStateV2[];
  runReadinessGateState: ActualSendRunReadinessGateStateV2;
  returnHistory: RunReturnRecord[]; reopenLinks: string[]; auditEventRefs: string[]; provenance: string;
}

export type RunSectionResolutionStatus = "unreviewed" | "in_review" | "resolved_in_place" | "reviewed_with_warning" | "returned_to_actual_send_execution" | "returned_to_commit_or_transaction" | "blocked_unresolved" | "reviewed_complete";
export type RunSectionResolutionMode = "in_place" | "warning_acknowledged" | "return_to_actual_send_execution" | "return_to_commit_or_transaction" | "guard_confirmation" | "authorization_audit_confirmation" | "not_applicable";

export interface ActualSendRunSectionResolutionStateV2 {
  sectionKey: RunSectionKey; resolutionStatus: RunSectionResolutionStatus; resolutionMode: RunSectionResolutionMode;
  resolvedAt: string | null; resolvedBy: string | null; resolutionReason: string;
  remainingUnresolvedInputs: string[]; remainingWarnings: string[];
  requiresReturnToActualSendExecution: boolean; requiresReturnToCommitOrTransaction: boolean; requiresRevisitAfterReturn: boolean;
  eligibleForRunReadiness: boolean; fieldGroupSnapshotRef: string; evidenceNote: string;
}

export type RunReadyStatus = "not_ready" | "needs_review" | "ready_for_marking" | "run_ready_pending_execute";

export interface ActualSendRunReadinessGateStateV2 {
  runReadinessStatus: RunReadyStatus; requiredSectionsTotal: number; sectionsReadyCount: number;
  unresolvedSectionKeys: RunSectionKey[]; warningOnlySectionKeys: RunSectionKey[];
  runReadinessBlockers: string[]; runReadinessAllowed: boolean; runReadinessReason: string;
  nextGateStatus: "locked" | "pending_actual_send_execute"; actualSendExecuteEnablementStatus: "disabled"; actualSendStatus: "not_sent";
}

export interface RunReturnRecord { returnReason: string; returnSectionKey: RunSectionKey; triggerConflictOrGap: string; returnTarget: "actual_send_execution" | "commit_or_transaction"; linkedUpstreamSectionIfAny: string | null; returnedAt: string; returnedBy: string; requiresRevisitAfterReturn: boolean; expectedReentryBasis: string; }

export type RunAction = "open_actual_send_run_session" | "set_active_section" | "mark_section_in_review" | "resolve_run_gap_in_place" | "acknowledge_run_warning" | "mark_section_reviewed" | "return_section_to_actual_send_execution_review" | "return_section_to_commit_or_transaction" | "reopen_section_after_return" | "mark_exclusion_guard_run_rechecked" | "mark_actor_authorization_audit_confirmed" | "run_run_readiness_check" | "mark_run_ready";
export type ForbiddenRunAction = "execute_actual_send_execute" | "mark_sent" | "mark_dispatched" | "create_delivery_tracking_record" | "freeze_transport_payload" | "emit_supplier_send_receipt";

export interface RunActionPayload { action: RunAction; sectionKey?: RunSectionKey; reason?: string; returnTarget?: "actual_send_execution" | "commit_or_transaction"; actor: string; timestamp: string; }

export interface ActualSendRunMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: ActualSendRunSessionV2; updatedWorkspaceStatusIfAny: string | null; recomputeRequired: boolean; emittedEvents: RunAuditEvent[]; }

export type RunAuditEventType = "actual_send_run_session_opened" | "actual_send_run_section_review_started" | "actual_send_run_section_resolved_in_place" | "actual_send_run_section_warning_acknowledged" | "actual_send_run_section_returned_to_actual_send_execution" | "actual_send_run_section_returned_to_commit_or_transaction" | "actual_send_run_section_reopened_after_return" | "actual_send_run_exclusion_guard_rechecked" | "actual_send_run_actor_authorization_audit_confirmed" | "actual_send_run_readiness_check_run" | "actual_send_run_marked_ready_pending_execute" | "actual_send_run_mutation_rejected";

export interface RunAuditEvent { type: RunAuditEventType; caseId: string; sessionId: string; handoffPackageId: string; gateId: string; sectionKeyIfAny: RunSectionKey | null; actionKey: RunAction | ForbiddenRunAction; reason: string; actor: string; timestamp: string; }

const DEPS: Partial<Record<RunSectionKey, RunSectionKey[]>> = {
  recipient_run_final_block: ["payload_integrity_run_final_block", "reference_instruction_run_final_block"],
  payload_integrity_run_final_block: ["reference_instruction_run_final_block", "run_completion_gate_review"],
  reference_instruction_run_final_block: ["exclusion_guard_run_final_block", "run_completion_gate_review"],
  exclusion_guard_run_final_block: ["actor_authorization_audit_run_final_block", "run_completion_gate_review"],
  actor_authorization_audit_run_final_block: ["run_completion_gate_review"],
};
function getDeps(k: RunSectionKey): RunSectionKey[] { return DEPS[k] || []; }

function recomputeRunReadiness(secs: ActualSendRunSectionResolutionStateV2[]): ActualSendRunReadinessGateStateV2 {
  const total = secs.length; const ready = secs.filter(s => s.eligibleForRunReadiness).length;
  const unresolved = secs.filter(s => s.resolutionStatus === "blocked_unresolved" || s.resolutionStatus === "returned_to_actual_send_execution" || s.resolutionStatus === "returned_to_commit_or_transaction" || s.resolutionStatus === "unreviewed" || s.resolutionStatus === "in_review" || s.remainingUnresolvedInputs.length > 0).map(s => s.sectionKey);
  const warningOnly = secs.filter(s => s.resolutionStatus === "reviewed_with_warning" && s.remainingUnresolvedInputs.length === 0).map(s => s.sectionKey);
  const allowed = unresolved.length === 0;
  return { runReadinessStatus: allowed ? "ready_for_marking" : "not_ready", requiredSectionsTotal: total, sectionsReadyCount: ready, unresolvedSectionKeys: unresolved, warningOnlySectionKeys: warningOnly, runReadinessBlockers: unresolved.map(k => `Section ${k}: unresolved`), runReadinessAllowed: allowed, runReadinessReason: allowed ? "모든 section run-ready eligible" : "미해소 section 존재", nextGateStatus: "locked", actualSendExecuteEnablementStatus: "disabled", actualSendStatus: "not_sent" };
}

const ALL: RunSectionKey[] = ["recipient_run_final_block", "payload_integrity_run_final_block", "reference_instruction_run_final_block", "exclusion_guard_run_final_block", "actor_authorization_audit_run_final_block", "run_completion_gate_review"];

export function createInitialRunSession(caseId: string, handoffPackageId: string, gateId: string, executionSessionId: string, actor: string): ActualSendRunSessionV2 {
  const now = new Date().toISOString();
  const secs: ActualSendRunSectionResolutionStateV2[] = ALL.map(k => ({ sectionKey: k, resolutionStatus: "unreviewed", resolutionMode: "not_applicable", resolvedAt: null, resolvedBy: null, resolutionReason: "", remainingUnresolvedInputs: [], remainingWarnings: [], requiresReturnToActualSendExecution: false, requiresReturnToCommitOrTransaction: false, requiresRevisitAfterReturn: false, eligibleForRunReadiness: false, fieldGroupSnapshotRef: handoffPackageId, evidenceNote: "" }));
  return { actualSendRunSessionId: `runsn_${Date.now().toString(36)}`, caseId, handoffPackageId, actualSendRunGateId: gateId, actualSendExecutionSessionId: executionSessionId, sessionStatus: "run_open", runPhase: "final_run_resolution", openedAt: now, lastUpdatedAt: now, openedBy: actor, activeSectionKey: null, operatorFocusOrder: [...ALL], sectionResolutionStates: secs, runReadinessGateState: recomputeRunReadiness(secs), returnHistory: [], reopenLinks: [], auditEventRefs: [], provenance: handoffPackageId };
}

export function applyActualSendRunMutation(session: ActualSendRunSessionV2, payload: RunActionPayload): ActualSendRunMutationResultV2 {
  const now = payload.timestamp; const events: RunAuditEvent[] = [];
  const makeEvent = (type: RunAuditEventType, reason: string): RunAuditEvent => ({ type, caseId: session.caseId, sessionId: session.actualSendRunSessionId, handoffPackageId: session.handoffPackageId, gateId: session.actualSendRunGateId, sectionKeyIfAny: payload.sectionKey ?? null, actionKey: payload.action, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): ActualSendRunMutationResultV2 => { events.push(makeEvent("actual_send_run_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, updatedWorkspaceStatusIfAny: null, recomputeRequired: false, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now, sectionResolutionStates: session.sectionResolutionStates.map(s => ({ ...s })) };
  const find = (k: RunSectionKey) => u.sectionResolutionStates.find(s => s.sectionKey === k);
  const markDeps = (k: RunSectionKey) => { for (const dk of getDeps(k)) { const d = find(dk); if (d && d.resolutionStatus !== "unreviewed") d.requiresRevisitAfterReturn = true; } };

  switch (payload.action) {
    case "open_actual_send_run_session": { u.sessionStatus = "run_open"; u.runPhase = "final_run_resolution"; events.push(makeEvent("actual_send_run_session_opened", "Session opened")); break; }
    case "set_active_section": { if (!payload.sectionKey) return reject("Section key 필수"); u.activeSectionKey = payload.sectionKey; break; }
    case "mark_section_in_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "in_review"; u.sessionStatus = "run_review_in_progress"; events.push(makeEvent("actual_send_run_section_review_started", `${payload.sectionKey} review started`)); break; }
    case "resolve_run_gap_in_place": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "resolved_in_place"; s.resolutionMode = "in_place"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForRunReadiness = true; s.requiresRevisitAfterReturn = false; markDeps(payload.sectionKey); events.push(makeEvent("actual_send_run_section_resolved_in_place", `${payload.sectionKey} resolved`)); break; }
    case "acknowledge_run_warning": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "reviewed_with_warning"; s.resolutionMode = "warning_acknowledged"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForRunReadiness = true; events.push(makeEvent("actual_send_run_section_warning_acknowledged", `${payload.sectionKey} warning ack`)); break; }
    case "mark_section_reviewed": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); if (s.resolutionStatus === "unreviewed") return reject("먼저 review 필요");
      if (payload.sectionKey === "run_completion_gate_review") { const others = u.sectionResolutionStates.filter(x => x.sectionKey !== "run_completion_gate_review"); if (!others.every(x => x.eligibleForRunReadiness)) return reject("다른 section 모두 run-ready eligible이어야 함"); }
      s.resolutionStatus = "reviewed_complete"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForRunReadiness = true; break; }
    case "return_section_to_actual_send_execution_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_actual_send_execution"; s.resolutionMode = "return_to_actual_send_execution"; s.requiresRevisitAfterReturn = true; s.eligibleForRunReadiness = false; u.sessionStatus = "returned_to_actual_send_execution"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to execution", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "conflict", returnTarget: "actual_send_execution", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "execution resolution" }); events.push(makeEvent("actual_send_run_section_returned_to_actual_send_execution", `${payload.sectionKey} → execution`)); break; }
    case "return_section_to_commit_or_transaction": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_commit_or_transaction"; s.resolutionMode = "return_to_commit_or_transaction"; s.requiresRevisitAfterReturn = true; s.eligibleForRunReadiness = false; u.sessionStatus = "returned_to_commit_or_transaction"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to commit/transaction", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "basis conflict", returnTarget: "commit_or_transaction", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "commit/transaction resolution" }); events.push(makeEvent("actual_send_run_section_returned_to_commit_or_transaction", `${payload.sectionKey} → commit/transaction`)); break; }
    case "reopen_section_after_return": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "unreviewed"; s.resolutionMode = "not_applicable"; s.resolvedAt = null; s.resolvedBy = null; s.requiresRevisitAfterReturn = false; s.eligibleForRunReadiness = false; if (u.sessionStatus === "returned_to_actual_send_execution" || u.sessionStatus === "returned_to_commit_or_transaction") { u.sessionStatus = "run_review_in_progress"; u.runPhase = "final_run_resolution"; } events.push(makeEvent("actual_send_run_section_reopened_after_return", `${payload.sectionKey} reopened`)); break; }
    case "mark_exclusion_guard_run_rechecked": { const s = find("exclusion_guard_run_final_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Contamination risk 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "guard_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForRunReadiness = true; s.evidenceNote = `Final run guard rechecked at ${now}`; markDeps("exclusion_guard_run_final_block"); events.push(makeEvent("actual_send_run_exclusion_guard_rechecked", "Final run exclusion guard rechecked")); break; }
    case "mark_actor_authorization_audit_confirmed": { const s = find("actor_authorization_audit_run_final_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Authorization/audit gap 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "authorization_audit_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForRunReadiness = true; s.evidenceNote = `Final authorization/audit confirmed at ${now}`; markDeps("actor_authorization_audit_run_final_block"); events.push(makeEvent("actual_send_run_actor_authorization_audit_confirmed", "Final authorization/audit confirmed")); break; }
    case "run_run_readiness_check": { u.runPhase = "run_readiness_check"; u.runReadinessGateState = recomputeRunReadiness(u.sectionResolutionStates); events.push(makeEvent("actual_send_run_readiness_check_run", `Run readiness: ${u.runReadinessGateState.runReadinessStatus}`)); break; }
    case "mark_run_ready": { u.runReadinessGateState = recomputeRunReadiness(u.sectionResolutionStates); if (!u.runReadinessGateState.runReadinessAllowed) return reject(`Run ready 불가: ${u.runReadinessGateState.runReadinessBlockers.join("; ")}`); u.sessionStatus = "run_ready_pending_execute"; u.runPhase = "pending_actual_send_execute"; u.runReadinessGateState.runReadinessStatus = "run_ready_pending_execute"; u.runReadinessGateState.runReadinessReason = "Run ready — actual send execute pending (Batch 1: execute locked)"; u.runReadinessGateState.nextGateStatus = "pending_actual_send_execute"; events.push(makeEvent("actual_send_run_marked_ready_pending_execute", "Run ready — pending execute")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }

  u.runReadinessGateState = recomputeRunReadiness(u.sectionResolutionStates);
  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, updatedWorkspaceStatusIfAny: u.sessionStatus === "returned_to_actual_send_execution" || u.sessionStatus === "returned_to_commit_or_transaction" ? "run_hold" : null, recomputeRequired: true, emittedEvents: events };
}
