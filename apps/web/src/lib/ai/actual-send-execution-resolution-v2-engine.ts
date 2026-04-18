/**
 * Actual Send Execution Resolution v2 Engine — execution action → canonical mutation → audit
 *
 * 고정 규칙: execution ready ≠ sent ≠ dispatched. return 후 자동 ready 금지.
 * Batch 1: execute_actual_send_run / mark_sent / mark_dispatched 전부 금지.
 * Final irreversible execution boundary mutation spine.
 */

import type { FinalExecSectionKey } from "./actual-send-execution-workspace-v2";

export type FinalExecSessionStatus = "execution_open" | "execution_review_in_progress" | "execution_hold" | "returned_to_actual_send_commit" | "returned_to_transaction_or_action" | "execution_ready_pending_run" | "execution_locked";
export type FinalExecPhase = "final_execution_resolution" | "payload_integrity_clearance" | "authorization_and_audit_confirmation" | "run_readiness_check" | "pending_actual_send_run";

export interface ActualSendExecutionSessionV2 {
  actualSendExecutionSessionId: string; caseId: string; handoffPackageId: string; actualSendExecutionGateId: string; actualSendCommitSessionId: string;
  sessionStatus: FinalExecSessionStatus; executionPhase: FinalExecPhase;
  openedAt: string; lastUpdatedAt: string; openedBy: string;
  activeSectionKey: FinalExecSectionKey | null; operatorFocusOrder: FinalExecSectionKey[];
  sectionResolutionStates: ActualSendExecutionSectionResolutionStateV2[];
  runReadinessGateState: ActualSendExecutionRunReadinessGateStateV2;
  returnHistory: FinalExecReturnRecord[]; reopenLinks: string[]; auditEventRefs: string[]; provenance: string;
}

export type FinalExecSectionResolutionStatus = "unreviewed" | "in_review" | "resolved_in_place" | "reviewed_with_warning" | "returned_to_actual_send_commit" | "returned_to_transaction_or_action" | "blocked_unresolved" | "reviewed_complete";
export type FinalExecSectionResolutionMode = "in_place" | "warning_acknowledged" | "return_to_actual_send_commit" | "return_to_transaction_or_action" | "guard_confirmation" | "authorization_audit_confirmation" | "not_applicable";

export interface ActualSendExecutionSectionResolutionStateV2 {
  sectionKey: FinalExecSectionKey; resolutionStatus: FinalExecSectionResolutionStatus; resolutionMode: FinalExecSectionResolutionMode;
  resolvedAt: string | null; resolvedBy: string | null; resolutionReason: string;
  remainingUnresolvedInputs: string[]; remainingWarnings: string[];
  requiresReturnToActualSendCommit: boolean; requiresReturnToTransactionOrAction: boolean; requiresRevisitAfterReturn: boolean;
  eligibleForRunReadiness: boolean; fieldGroupSnapshotRef: string; evidenceNote: string;
}

export type RunReadinessStatus = "not_ready" | "needs_review" | "ready_for_marking" | "execution_ready_pending_run";

export interface ActualSendExecutionRunReadinessGateStateV2 {
  runReadinessStatus: RunReadinessStatus; requiredSectionsTotal: number; sectionsReadyCount: number;
  unresolvedSectionKeys: FinalExecSectionKey[]; warningOnlySectionKeys: FinalExecSectionKey[];
  runReadinessBlockers: string[]; runReadinessAllowed: boolean; runReadinessReason: string;
  nextGateStatus: "locked" | "pending_actual_send_run"; actualSendRunEnablementStatus: "disabled"; actualSendStatus: "not_sent";
}

export interface FinalExecReturnRecord { returnReason: string; returnSectionKey: FinalExecSectionKey; triggerConflictOrGap: string; returnTarget: "actual_send_commit" | "transaction_or_action"; linkedUpstreamSectionIfAny: string | null; returnedAt: string; returnedBy: string; requiresRevisitAfterReturn: boolean; expectedReentryBasis: string; }

export type FinalExecAction = "open_actual_send_execution_session" | "set_active_section" | "mark_section_in_review" | "resolve_execution_gap_in_place" | "acknowledge_execution_warning" | "mark_section_reviewed" | "return_section_to_actual_send_commit_review" | "return_section_to_transaction_or_action" | "reopen_section_after_return" | "mark_exclusion_guard_execution_rechecked" | "mark_actor_authorization_audit_confirmed" | "run_execution_readiness_check" | "mark_execution_ready";
export type ForbiddenFinalExecAction = "execute_actual_send_run" | "mark_sent" | "mark_dispatched" | "create_delivery_tracking_record" | "freeze_transport_payload" | "emit_supplier_send_receipt";

export interface FinalExecActionPayload { action: FinalExecAction; sectionKey?: FinalExecSectionKey; reason?: string; returnTarget?: "actual_send_commit" | "transaction_or_action"; actor: string; timestamp: string; }

export interface ActualSendExecutionMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: ActualSendExecutionSessionV2; updatedWorkspaceStatusIfAny: string | null; recomputeRequired: boolean; emittedEvents: FinalExecAuditEvent[]; }

export type FinalExecAuditEventType = "actual_send_execution_session_opened" | "actual_send_execution_section_review_started" | "actual_send_execution_section_resolved_in_place" | "actual_send_execution_section_warning_acknowledged" | "actual_send_execution_section_returned_to_actual_send_commit" | "actual_send_execution_section_returned_to_transaction_or_action" | "actual_send_execution_section_reopened_after_return" | "actual_send_execution_exclusion_guard_rechecked" | "actual_send_execution_actor_authorization_audit_confirmed" | "actual_send_execution_run_readiness_check_run" | "actual_send_execution_marked_ready_pending_run" | "actual_send_execution_mutation_rejected";

export interface FinalExecAuditEvent { type: FinalExecAuditEventType; caseId: string; sessionId: string; handoffPackageId: string; gateId: string; sectionKeyIfAny: FinalExecSectionKey | null; actionKey: FinalExecAction | ForbiddenFinalExecAction; reason: string; actor: string; timestamp: string; }

const DEPS: Partial<Record<FinalExecSectionKey, FinalExecSectionKey[]>> = {
  recipient_execution_final_block: ["payload_integrity_execution_final_block", "reference_instruction_execution_final_block"],
  payload_integrity_execution_final_block: ["reference_instruction_execution_final_block", "execution_completion_gate_review"],
  reference_instruction_execution_final_block: ["exclusion_guard_execution_final_block", "execution_completion_gate_review"],
  exclusion_guard_execution_final_block: ["actor_authorization_audit_execution_final_block", "execution_completion_gate_review"],
  actor_authorization_audit_execution_final_block: ["execution_completion_gate_review"],
};
function getDeps(k: FinalExecSectionKey): FinalExecSectionKey[] { return DEPS[k] || []; }

function recomputeRunReadiness(secs: ActualSendExecutionSectionResolutionStateV2[]): ActualSendExecutionRunReadinessGateStateV2 {
  const total = secs.length; const ready = secs.filter(s => s.eligibleForRunReadiness).length;
  const unresolved = secs.filter(s => s.resolutionStatus === "blocked_unresolved" || s.resolutionStatus === "returned_to_actual_send_commit" || s.resolutionStatus === "returned_to_transaction_or_action" || s.resolutionStatus === "unreviewed" || s.resolutionStatus === "in_review" || s.remainingUnresolvedInputs.length > 0).map(s => s.sectionKey);
  const warningOnly = secs.filter(s => s.resolutionStatus === "reviewed_with_warning" && s.remainingUnresolvedInputs.length === 0).map(s => s.sectionKey);
  const allowed = unresolved.length === 0;
  return { runReadinessStatus: allowed ? "ready_for_marking" : "not_ready", requiredSectionsTotal: total, sectionsReadyCount: ready, unresolvedSectionKeys: unresolved, warningOnlySectionKeys: warningOnly, runReadinessBlockers: unresolved.map(k => `Section ${k}: unresolved`), runReadinessAllowed: allowed, runReadinessReason: allowed ? "모든 section run-ready eligible" : "미해소 section 존재", nextGateStatus: "locked", actualSendRunEnablementStatus: "disabled", actualSendStatus: "not_sent" };
}

const ALL: FinalExecSectionKey[] = ["recipient_execution_final_block", "payload_integrity_execution_final_block", "reference_instruction_execution_final_block", "exclusion_guard_execution_final_block", "actor_authorization_audit_execution_final_block", "execution_completion_gate_review"];

export function createInitialFinalExecSession(caseId: string, handoffPackageId: string, gateId: string, commitSessionId: string, actor: string): ActualSendExecutionSessionV2 {
  const now = new Date().toISOString();
  const secs: ActualSendExecutionSectionResolutionStateV2[] = ALL.map(k => ({ sectionKey: k, resolutionStatus: "unreviewed", resolutionMode: "not_applicable", resolvedAt: null, resolvedBy: null, resolutionReason: "", remainingUnresolvedInputs: [], remainingWarnings: [], requiresReturnToActualSendCommit: false, requiresReturnToTransactionOrAction: false, requiresRevisitAfterReturn: false, eligibleForRunReadiness: false, fieldGroupSnapshotRef: handoffPackageId, evidenceNote: "" }));
  return { actualSendExecutionSessionId: `fnlexsn_${Date.now().toString(36)}`, caseId, handoffPackageId, actualSendExecutionGateId: gateId, actualSendCommitSessionId: commitSessionId, sessionStatus: "execution_open", executionPhase: "final_execution_resolution", openedAt: now, lastUpdatedAt: now, openedBy: actor, activeSectionKey: null, operatorFocusOrder: [...ALL], sectionResolutionStates: secs, runReadinessGateState: recomputeRunReadiness(secs), returnHistory: [], reopenLinks: [], auditEventRefs: [], provenance: handoffPackageId };
}

export function applyActualSendExecutionFinalMutation(session: ActualSendExecutionSessionV2, payload: FinalExecActionPayload): ActualSendExecutionMutationResultV2 {
  const now = payload.timestamp; const events: FinalExecAuditEvent[] = [];
  const makeEvent = (type: FinalExecAuditEventType, reason: string): FinalExecAuditEvent => ({ type, caseId: session.caseId, sessionId: session.actualSendExecutionSessionId, handoffPackageId: session.handoffPackageId, gateId: session.actualSendExecutionGateId, sectionKeyIfAny: payload.sectionKey ?? null, actionKey: payload.action, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): ActualSendExecutionMutationResultV2 => { events.push(makeEvent("actual_send_execution_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, updatedWorkspaceStatusIfAny: null, recomputeRequired: false, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now, sectionResolutionStates: session.sectionResolutionStates.map(s => ({ ...s })) };
  const find = (k: FinalExecSectionKey) => u.sectionResolutionStates.find(s => s.sectionKey === k);
  const markDeps = (k: FinalExecSectionKey) => { for (const dk of getDeps(k)) { const d = find(dk); if (d && d.resolutionStatus !== "unreviewed") d.requiresRevisitAfterReturn = true; } };

  switch (payload.action) {
    case "open_actual_send_execution_session": { u.sessionStatus = "execution_open"; u.executionPhase = "final_execution_resolution"; events.push(makeEvent("actual_send_execution_session_opened", "Session opened")); break; }
    case "set_active_section": { if (!payload.sectionKey) return reject("Section key 필수"); u.activeSectionKey = payload.sectionKey; break; }
    case "mark_section_in_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "in_review"; u.sessionStatus = "execution_review_in_progress"; events.push(makeEvent("actual_send_execution_section_review_started", `${payload.sectionKey} review started`)); break; }
    case "resolve_execution_gap_in_place": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "resolved_in_place"; s.resolutionMode = "in_place"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForRunReadiness = true; s.requiresRevisitAfterReturn = false; markDeps(payload.sectionKey); events.push(makeEvent("actual_send_execution_section_resolved_in_place", `${payload.sectionKey} resolved`)); break; }
    case "acknowledge_execution_warning": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "reviewed_with_warning"; s.resolutionMode = "warning_acknowledged"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForRunReadiness = true; events.push(makeEvent("actual_send_execution_section_warning_acknowledged", `${payload.sectionKey} warning ack`)); break; }
    case "mark_section_reviewed": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); if (s.resolutionStatus === "unreviewed") return reject("먼저 review 필요");
      if (payload.sectionKey === "execution_completion_gate_review") { const others = u.sectionResolutionStates.filter(x => x.sectionKey !== "execution_completion_gate_review"); if (!others.every(x => x.eligibleForRunReadiness)) return reject("다른 section 모두 run-ready eligible이어야 함"); }
      s.resolutionStatus = "reviewed_complete"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForRunReadiness = true; break; }
    case "return_section_to_actual_send_commit_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_actual_send_commit"; s.resolutionMode = "return_to_actual_send_commit"; s.requiresRevisitAfterReturn = true; s.eligibleForRunReadiness = false; u.sessionStatus = "returned_to_actual_send_commit"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to commit", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "conflict", returnTarget: "actual_send_commit", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "commit resolution" }); events.push(makeEvent("actual_send_execution_section_returned_to_actual_send_commit", `${payload.sectionKey} → commit`)); break; }
    case "return_section_to_transaction_or_action": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_transaction_or_action"; s.resolutionMode = "return_to_transaction_or_action"; s.requiresRevisitAfterReturn = true; s.eligibleForRunReadiness = false; u.sessionStatus = "returned_to_transaction_or_action"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to transaction/action", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "basis conflict", returnTarget: "transaction_or_action", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "transaction/action resolution" }); events.push(makeEvent("actual_send_execution_section_returned_to_transaction_or_action", `${payload.sectionKey} → transaction/action`)); break; }
    case "reopen_section_after_return": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "unreviewed"; s.resolutionMode = "not_applicable"; s.resolvedAt = null; s.resolvedBy = null; s.requiresRevisitAfterReturn = false; s.eligibleForRunReadiness = false; if (u.sessionStatus === "returned_to_actual_send_commit" || u.sessionStatus === "returned_to_transaction_or_action") { u.sessionStatus = "execution_review_in_progress"; u.executionPhase = "final_execution_resolution"; } events.push(makeEvent("actual_send_execution_section_reopened_after_return", `${payload.sectionKey} reopened`)); break; }
    case "mark_exclusion_guard_execution_rechecked": { const s = find("exclusion_guard_execution_final_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Contamination risk 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "guard_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForRunReadiness = true; s.evidenceNote = `Final execution guard rechecked at ${now}`; markDeps("exclusion_guard_execution_final_block"); events.push(makeEvent("actual_send_execution_exclusion_guard_rechecked", "Final execution exclusion guard rechecked")); break; }
    case "mark_actor_authorization_audit_confirmed": { const s = find("actor_authorization_audit_execution_final_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Authorization/audit gap 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "authorization_audit_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForRunReadiness = true; s.evidenceNote = `Final authorization/audit confirmed at ${now}`; markDeps("actor_authorization_audit_execution_final_block"); events.push(makeEvent("actual_send_execution_actor_authorization_audit_confirmed", "Final authorization/audit confirmed")); break; }
    case "run_execution_readiness_check": { u.executionPhase = "run_readiness_check"; u.runReadinessGateState = recomputeRunReadiness(u.sectionResolutionStates); events.push(makeEvent("actual_send_execution_run_readiness_check_run", `Run readiness: ${u.runReadinessGateState.runReadinessStatus}`)); break; }
    case "mark_execution_ready": { u.runReadinessGateState = recomputeRunReadiness(u.sectionResolutionStates); if (!u.runReadinessGateState.runReadinessAllowed) return reject(`Execution ready 불가: ${u.runReadinessGateState.runReadinessBlockers.join("; ")}`); u.sessionStatus = "execution_ready_pending_run"; u.executionPhase = "pending_actual_send_run"; u.runReadinessGateState.runReadinessStatus = "execution_ready_pending_run"; u.runReadinessGateState.runReadinessReason = "Execution ready — actual send run pending (Batch 1: run locked)"; u.runReadinessGateState.nextGateStatus = "pending_actual_send_run"; events.push(makeEvent("actual_send_execution_marked_ready_pending_run", "Execution ready — pending run")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }

  u.runReadinessGateState = recomputeRunReadiness(u.sectionResolutionStates);
  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, updatedWorkspaceStatusIfAny: u.sessionStatus === "returned_to_actual_send_commit" || u.sessionStatus === "returned_to_transaction_or_action" ? "execution_hold" : null, recomputeRequired: true, emittedEvents: events };
}
