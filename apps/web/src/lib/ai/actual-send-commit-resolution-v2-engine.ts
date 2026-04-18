/**
 * Actual Send Commit Resolution v2 Engine — commit action → canonical mutation → audit
 *
 * 고정 규칙: commit ready ≠ sent ≠ dispatched. return 후 자동 ready 금지.
 * Batch 1: execute_actual_send_execution / mark_sent / mark_dispatched 전부 금지.
 */

import type { CommitSectionKey } from "./actual-send-commit-workspace-v2";

export type CommitSessionStatus = "commit_open" | "commit_review_in_progress" | "commit_hold" | "returned_to_actual_send_transaction" | "returned_to_action_or_execution" | "commit_ready_pending_execution" | "commit_locked";
export type CommitPhase = "final_commit_resolution" | "payload_integrity_clearance" | "authorization_and_audit_confirmation" | "execution_readiness_check" | "pending_actual_send_execution";

export interface ActualSendCommitSessionV2 {
  actualSendCommitSessionId: string; caseId: string; handoffPackageId: string; actualSendCommitGateId: string; actualSendTransactionSessionId: string;
  sessionStatus: CommitSessionStatus; commitPhase: CommitPhase;
  openedAt: string; lastUpdatedAt: string; openedBy: string;
  activeSectionKey: CommitSectionKey | null; operatorFocusOrder: CommitSectionKey[];
  sectionResolutionStates: ActualSendCommitSectionResolutionStateV2[];
  executionReadinessGateState: ActualSendCommitExecutionReadinessGateStateV2;
  returnHistory: CommitReturnRecord[]; reopenLinks: string[]; auditEventRefs: string[]; provenance: string;
}

export type CommitSectionResolutionStatus = "unreviewed" | "in_review" | "resolved_in_place" | "reviewed_with_warning" | "returned_to_actual_send_transaction" | "returned_to_action_or_execution" | "blocked_unresolved" | "reviewed_complete";
export type CommitSectionResolutionMode = "in_place" | "warning_acknowledged" | "return_to_actual_send_transaction" | "return_to_action_or_execution" | "guard_confirmation" | "authorization_audit_confirmation" | "not_applicable";

export interface ActualSendCommitSectionResolutionStateV2 {
  sectionKey: CommitSectionKey; resolutionStatus: CommitSectionResolutionStatus; resolutionMode: CommitSectionResolutionMode;
  resolvedAt: string | null; resolvedBy: string | null; resolutionReason: string;
  remainingUnresolvedInputs: string[]; remainingWarnings: string[];
  requiresReturnToActualSendTransaction: boolean; requiresReturnToActionOrExecution: boolean; requiresRevisitAfterReturn: boolean;
  eligibleForExecutionReadiness: boolean; fieldGroupSnapshotRef: string; evidenceNote: string;
}

export type ExecReadyStatus = "not_ready" | "needs_review" | "ready_for_marking" | "commit_ready_pending_execution";

export interface ActualSendCommitExecutionReadinessGateStateV2 {
  executionReadinessStatus: ExecReadyStatus; requiredSectionsTotal: number; sectionsReadyCount: number;
  unresolvedSectionKeys: CommitSectionKey[]; warningOnlySectionKeys: CommitSectionKey[];
  executionReadinessBlockers: string[]; executionReadinessAllowed: boolean; executionReadinessReason: string;
  nextGateStatus: "locked" | "pending_actual_send_execution"; actualSendExecutionEnablementStatus: "disabled"; actualSendStatus: "not_sent";
}

export interface CommitReturnRecord { returnReason: string; returnSectionKey: CommitSectionKey; triggerConflictOrGap: string; returnTarget: "actual_send_transaction" | "action_or_execution"; linkedUpstreamSectionIfAny: string | null; returnedAt: string; returnedBy: string; requiresRevisitAfterReturn: boolean; expectedReentryBasis: string; }

export type CommitAction = "open_actual_send_commit_session" | "set_active_section" | "mark_section_in_review" | "resolve_commit_gap_in_place" | "acknowledge_commit_warning" | "mark_section_reviewed" | "return_section_to_actual_send_transaction_review" | "return_section_to_action_or_execution" | "reopen_section_after_return" | "mark_exclusion_guard_commit_rechecked" | "mark_actor_authorization_audit_confirmed" | "run_execution_readiness_check" | "mark_commit_ready";
export type ForbiddenCommitAction = "execute_actual_send_execution" | "mark_sent" | "mark_dispatched" | "create_delivery_tracking_record" | "freeze_transport_payload" | "emit_supplier_send_receipt";

export interface CommitActionPayload { action: CommitAction; sectionKey?: CommitSectionKey; reason?: string; returnTarget?: "actual_send_transaction" | "action_or_execution"; actor: string; timestamp: string; }

export interface ActualSendCommitMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: ActualSendCommitSessionV2; updatedWorkspaceStatusIfAny: string | null; recomputeRequired: boolean; emittedEvents: CommitAuditEvent[]; }

export type CommitAuditEventType = "actual_send_commit_session_opened" | "actual_send_commit_section_review_started" | "actual_send_commit_section_resolved_in_place" | "actual_send_commit_section_warning_acknowledged" | "actual_send_commit_section_returned_to_actual_send_transaction" | "actual_send_commit_section_returned_to_action_or_execution" | "actual_send_commit_section_reopened_after_return" | "actual_send_commit_exclusion_guard_rechecked" | "actual_send_commit_actor_authorization_audit_confirmed" | "actual_send_commit_execution_readiness_check_run" | "actual_send_commit_marked_ready_pending_execution" | "actual_send_commit_mutation_rejected";

export interface CommitAuditEvent { type: CommitAuditEventType; caseId: string; sessionId: string; handoffPackageId: string; gateId: string; sectionKeyIfAny: CommitSectionKey | null; actionKey: CommitAction | ForbiddenCommitAction; reason: string; actor: string; timestamp: string; }

const DEPS: Partial<Record<CommitSectionKey, CommitSectionKey[]>> = {
  recipient_commit_block: ["payload_integrity_commit_block", "reference_instruction_commit_block"],
  payload_integrity_commit_block: ["reference_instruction_commit_block", "commit_completion_gate_review"],
  reference_instruction_commit_block: ["exclusion_guard_commit_block", "commit_completion_gate_review"],
  exclusion_guard_commit_block: ["actor_authorization_audit_commit_block", "commit_completion_gate_review"],
  actor_authorization_audit_commit_block: ["commit_completion_gate_review"],
};
function getDeps(k: CommitSectionKey): CommitSectionKey[] { return DEPS[k] || []; }

function recomputeExecReadiness(secs: ActualSendCommitSectionResolutionStateV2[]): ActualSendCommitExecutionReadinessGateStateV2 {
  const total = secs.length; const ready = secs.filter(s => s.eligibleForExecutionReadiness).length;
  const unresolved = secs.filter(s => s.resolutionStatus === "blocked_unresolved" || s.resolutionStatus === "returned_to_actual_send_transaction" || s.resolutionStatus === "returned_to_action_or_execution" || s.resolutionStatus === "unreviewed" || s.resolutionStatus === "in_review" || s.remainingUnresolvedInputs.length > 0).map(s => s.sectionKey);
  const warningOnly = secs.filter(s => s.resolutionStatus === "reviewed_with_warning" && s.remainingUnresolvedInputs.length === 0).map(s => s.sectionKey);
  const allowed = unresolved.length === 0;
  return { executionReadinessStatus: allowed ? "ready_for_marking" : "not_ready", requiredSectionsTotal: total, sectionsReadyCount: ready, unresolvedSectionKeys: unresolved, warningOnlySectionKeys: warningOnly, executionReadinessBlockers: unresolved.map(k => `Section ${k}: unresolved`), executionReadinessAllowed: allowed, executionReadinessReason: allowed ? "모든 section execution-ready eligible" : "미해소 section 존재", nextGateStatus: "locked", actualSendExecutionEnablementStatus: "disabled", actualSendStatus: "not_sent" };
}

const ALL: CommitSectionKey[] = ["recipient_commit_block", "payload_integrity_commit_block", "reference_instruction_commit_block", "exclusion_guard_commit_block", "actor_authorization_audit_commit_block", "commit_completion_gate_review"];

export function createInitialCommitSession(caseId: string, handoffPackageId: string, gateId: string, transactionSessionId: string, actor: string): ActualSendCommitSessionV2 {
  const now = new Date().toISOString();
  const secs: ActualSendCommitSectionResolutionStateV2[] = ALL.map(k => ({ sectionKey: k, resolutionStatus: "unreviewed", resolutionMode: "not_applicable", resolvedAt: null, resolvedBy: null, resolutionReason: "", remainingUnresolvedInputs: [], remainingWarnings: [], requiresReturnToActualSendTransaction: false, requiresReturnToActionOrExecution: false, requiresRevisitAfterReturn: false, eligibleForExecutionReadiness: false, fieldGroupSnapshotRef: handoffPackageId, evidenceNote: "" }));
  return { actualSendCommitSessionId: `cmtsn_${Date.now().toString(36)}`, caseId, handoffPackageId, actualSendCommitGateId: gateId, actualSendTransactionSessionId: transactionSessionId, sessionStatus: "commit_open", commitPhase: "final_commit_resolution", openedAt: now, lastUpdatedAt: now, openedBy: actor, activeSectionKey: null, operatorFocusOrder: [...ALL], sectionResolutionStates: secs, executionReadinessGateState: recomputeExecReadiness(secs), returnHistory: [], reopenLinks: [], auditEventRefs: [], provenance: handoffPackageId };
}

export function applyActualSendCommitMutation(session: ActualSendCommitSessionV2, payload: CommitActionPayload): ActualSendCommitMutationResultV2 {
  const now = payload.timestamp; const events: CommitAuditEvent[] = [];
  const makeEvent = (type: CommitAuditEventType, reason: string): CommitAuditEvent => ({ type, caseId: session.caseId, sessionId: session.actualSendCommitSessionId, handoffPackageId: session.handoffPackageId, gateId: session.actualSendCommitGateId, sectionKeyIfAny: payload.sectionKey ?? null, actionKey: payload.action, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): ActualSendCommitMutationResultV2 => { events.push(makeEvent("actual_send_commit_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, updatedWorkspaceStatusIfAny: null, recomputeRequired: false, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now, sectionResolutionStates: session.sectionResolutionStates.map(s => ({ ...s })) };
  const find = (k: CommitSectionKey) => u.sectionResolutionStates.find(s => s.sectionKey === k);
  const markDeps = (k: CommitSectionKey) => { for (const dk of getDeps(k)) { const d = find(dk); if (d && d.resolutionStatus !== "unreviewed") d.requiresRevisitAfterReturn = true; } };

  switch (payload.action) {
    case "open_actual_send_commit_session": { u.sessionStatus = "commit_open"; u.commitPhase = "final_commit_resolution"; events.push(makeEvent("actual_send_commit_session_opened", "Session opened")); break; }
    case "set_active_section": { if (!payload.sectionKey) return reject("Section key 필수"); u.activeSectionKey = payload.sectionKey; break; }
    case "mark_section_in_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "in_review"; u.sessionStatus = "commit_review_in_progress"; events.push(makeEvent("actual_send_commit_section_review_started", `${payload.sectionKey} review started`)); break; }
    case "resolve_commit_gap_in_place": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "resolved_in_place"; s.resolutionMode = "in_place"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForExecutionReadiness = true; s.requiresRevisitAfterReturn = false; markDeps(payload.sectionKey); events.push(makeEvent("actual_send_commit_section_resolved_in_place", `${payload.sectionKey} resolved`)); break; }
    case "acknowledge_commit_warning": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "reviewed_with_warning"; s.resolutionMode = "warning_acknowledged"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForExecutionReadiness = true; events.push(makeEvent("actual_send_commit_section_warning_acknowledged", `${payload.sectionKey} warning ack`)); break; }
    case "mark_section_reviewed": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); if (s.resolutionStatus === "unreviewed") return reject("먼저 review 필요");
      if (payload.sectionKey === "commit_completion_gate_review") { const others = u.sectionResolutionStates.filter(x => x.sectionKey !== "commit_completion_gate_review"); if (!others.every(x => x.eligibleForExecutionReadiness)) return reject("다른 section 모두 execution-ready eligible이어야 함"); }
      s.resolutionStatus = "reviewed_complete"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForExecutionReadiness = true; break; }
    case "return_section_to_actual_send_transaction_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_actual_send_transaction"; s.resolutionMode = "return_to_actual_send_transaction"; s.requiresRevisitAfterReturn = true; s.eligibleForExecutionReadiness = false; u.sessionStatus = "returned_to_actual_send_transaction"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to transaction", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "conflict", returnTarget: "actual_send_transaction", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "transaction resolution" }); events.push(makeEvent("actual_send_commit_section_returned_to_actual_send_transaction", `${payload.sectionKey} → transaction`)); break; }
    case "return_section_to_action_or_execution": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_action_or_execution"; s.resolutionMode = "return_to_action_or_execution"; s.requiresRevisitAfterReturn = true; s.eligibleForExecutionReadiness = false; u.sessionStatus = "returned_to_action_or_execution"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to action/execution", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "basis conflict", returnTarget: "action_or_execution", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "action/execution resolution" }); events.push(makeEvent("actual_send_commit_section_returned_to_action_or_execution", `${payload.sectionKey} → action/execution`)); break; }
    case "reopen_section_after_return": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "unreviewed"; s.resolutionMode = "not_applicable"; s.resolvedAt = null; s.resolvedBy = null; s.requiresRevisitAfterReturn = false; s.eligibleForExecutionReadiness = false; if (u.sessionStatus === "returned_to_actual_send_transaction" || u.sessionStatus === "returned_to_action_or_execution") { u.sessionStatus = "commit_review_in_progress"; u.commitPhase = "final_commit_resolution"; } events.push(makeEvent("actual_send_commit_section_reopened_after_return", `${payload.sectionKey} reopened`)); break; }
    case "mark_exclusion_guard_commit_rechecked": { const s = find("exclusion_guard_commit_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Contamination risk 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "guard_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForExecutionReadiness = true; s.evidenceNote = `Commit guard rechecked at ${now}`; markDeps("exclusion_guard_commit_block"); events.push(makeEvent("actual_send_commit_exclusion_guard_rechecked", "Commit exclusion guard rechecked")); break; }
    case "mark_actor_authorization_audit_confirmed": { const s = find("actor_authorization_audit_commit_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Authorization/audit gap 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "authorization_audit_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForExecutionReadiness = true; s.evidenceNote = `Authorization/audit confirmed at ${now}`; markDeps("actor_authorization_audit_commit_block"); events.push(makeEvent("actual_send_commit_actor_authorization_audit_confirmed", "Authorization/audit confirmed")); break; }
    case "run_execution_readiness_check": { u.commitPhase = "execution_readiness_check"; u.executionReadinessGateState = recomputeExecReadiness(u.sectionResolutionStates); events.push(makeEvent("actual_send_commit_execution_readiness_check_run", `Execution readiness: ${u.executionReadinessGateState.executionReadinessStatus}`)); break; }
    case "mark_commit_ready": { u.executionReadinessGateState = recomputeExecReadiness(u.sectionResolutionStates); if (!u.executionReadinessGateState.executionReadinessAllowed) return reject(`Commit ready 불가: ${u.executionReadinessGateState.executionReadinessBlockers.join("; ")}`); u.sessionStatus = "commit_ready_pending_execution"; u.commitPhase = "pending_actual_send_execution"; u.executionReadinessGateState.executionReadinessStatus = "commit_ready_pending_execution"; u.executionReadinessGateState.executionReadinessReason = "Commit ready — actual send execution pending (Batch 1: execution locked)"; u.executionReadinessGateState.nextGateStatus = "pending_actual_send_execution"; events.push(makeEvent("actual_send_commit_marked_ready_pending_execution", "Commit ready — pending execution")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }

  u.executionReadinessGateState = recomputeExecReadiness(u.sectionResolutionStates);
  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, updatedWorkspaceStatusIfAny: u.sessionStatus === "returned_to_actual_send_transaction" || u.sessionStatus === "returned_to_action_or_execution" ? "commit_hold" : null, recomputeRequired: true, emittedEvents: events };
}
