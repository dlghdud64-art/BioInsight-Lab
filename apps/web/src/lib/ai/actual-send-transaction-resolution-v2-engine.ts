/**
 * Actual Send Transaction Resolution v2 Engine — transaction action → canonical mutation → audit
 *
 * 고정 규칙: transaction ready ≠ sent ≠ dispatched. return 후 자동 ready 금지.
 * Batch 1: execute_actual_send_commit / mark_sent / mark_dispatched 전부 금지.
 */

import type { TransactionSectionKey } from "./actual-send-transaction-workspace-v2";

export type TransactionSessionStatus = "transaction_open" | "transaction_review_in_progress" | "transaction_hold" | "returned_to_actual_send_action" | "returned_to_execution_or_confirmation" | "transaction_ready_pending_commit" | "transaction_locked";
export type TransactionPhase = "final_transaction_resolution" | "payload_integrity_clearance" | "authorization_and_audit_confirmation" | "commit_readiness_check" | "pending_actual_send_commit";

export interface ActualSendTransactionSessionV2 {
  actualSendTransactionSessionId: string; caseId: string; handoffPackageId: string; actualSendTransactionGateId: string; actualSendActionSessionId: string;
  sessionStatus: TransactionSessionStatus; transactionPhase: TransactionPhase;
  openedAt: string; lastUpdatedAt: string; openedBy: string;
  activeSectionKey: TransactionSectionKey | null; operatorFocusOrder: TransactionSectionKey[];
  sectionResolutionStates: ActualSendTransactionSectionResolutionStateV2[];
  commitReadinessGateState: ActualSendTransactionCommitReadinessGateStateV2;
  returnHistory: TransactionReturnRecord[]; reopenLinks: string[]; auditEventRefs: string[]; provenance: string;
}

export type TransactionSectionResolutionStatus = "unreviewed" | "in_review" | "resolved_in_place" | "reviewed_with_warning" | "returned_to_actual_send_action" | "returned_to_execution_or_confirmation" | "blocked_unresolved" | "reviewed_complete";
export type TransactionSectionResolutionMode = "in_place" | "warning_acknowledged" | "return_to_actual_send_action" | "return_to_execution_or_confirmation" | "guard_confirmation" | "authorization_audit_confirmation" | "not_applicable";

export interface ActualSendTransactionSectionResolutionStateV2 {
  sectionKey: TransactionSectionKey; resolutionStatus: TransactionSectionResolutionStatus; resolutionMode: TransactionSectionResolutionMode;
  resolvedAt: string | null; resolvedBy: string | null; resolutionReason: string;
  remainingUnresolvedInputs: string[]; remainingWarnings: string[];
  requiresReturnToActualSendAction: boolean; requiresReturnToExecutionOrConfirmation: boolean; requiresRevisitAfterReturn: boolean;
  eligibleForCommitReadiness: boolean; fieldGroupSnapshotRef: string; evidenceNote: string;
}

export type CommitReadinessStatus = "not_ready" | "needs_review" | "ready_for_marking" | "transaction_ready_pending_commit";

export interface ActualSendTransactionCommitReadinessGateStateV2 {
  commitReadinessStatus: CommitReadinessStatus; requiredSectionsTotal: number; sectionsReadyCount: number;
  unresolvedSectionKeys: TransactionSectionKey[]; warningOnlySectionKeys: TransactionSectionKey[];
  commitReadinessBlockers: string[]; commitReadinessAllowed: boolean; commitReadinessReason: string;
  nextGateStatus: "locked" | "pending_actual_send_commit"; actualSendCommitEnablementStatus: "disabled"; actualSendStatus: "not_sent";
}

export interface TransactionReturnRecord { returnReason: string; returnSectionKey: TransactionSectionKey; triggerConflictOrGap: string; returnTarget: "actual_send_action" | "execution_or_confirmation"; linkedUpstreamSectionIfAny: string | null; returnedAt: string; returnedBy: string; requiresRevisitAfterReturn: boolean; expectedReentryBasis: string; }

export type TransactionAction = "open_actual_send_transaction_session" | "set_active_section" | "mark_section_in_review" | "resolve_transaction_gap_in_place" | "acknowledge_transaction_warning" | "mark_section_reviewed" | "return_section_to_actual_send_action_review" | "return_section_to_execution_or_confirmation" | "reopen_section_after_return" | "mark_exclusion_guard_transaction_rechecked" | "mark_actor_authorization_audit_confirmed" | "run_commit_readiness_check" | "mark_transaction_ready";
export type ForbiddenTransactionAction = "execute_actual_send_commit" | "mark_sent" | "mark_dispatched" | "create_delivery_tracking_record" | "freeze_transport_payload" | "emit_supplier_send_receipt";

export interface TransactionActionPayload { action: TransactionAction; sectionKey?: TransactionSectionKey; reason?: string; returnTarget?: "actual_send_action" | "execution_or_confirmation"; actor: string; timestamp: string; }

export interface ActualSendTransactionMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: ActualSendTransactionSessionV2; updatedWorkspaceStatusIfAny: string | null; recomputeRequired: boolean; emittedEvents: TransactionAuditEvent[]; }

export type TransactionAuditEventType = "actual_send_transaction_session_opened" | "actual_send_transaction_section_review_started" | "actual_send_transaction_section_resolved_in_place" | "actual_send_transaction_section_warning_acknowledged" | "actual_send_transaction_section_returned_to_actual_send_action" | "actual_send_transaction_section_returned_to_execution_or_confirmation" | "actual_send_transaction_section_reopened_after_return" | "actual_send_transaction_exclusion_guard_rechecked" | "actual_send_transaction_actor_authorization_audit_confirmed" | "actual_send_transaction_commit_readiness_check_run" | "actual_send_transaction_marked_ready_pending_commit" | "actual_send_transaction_mutation_rejected";

export interface TransactionAuditEvent { type: TransactionAuditEventType; caseId: string; sessionId: string; handoffPackageId: string; gateId: string; sectionKeyIfAny: TransactionSectionKey | null; actionKey: TransactionAction | ForbiddenTransactionAction; reason: string; actor: string; timestamp: string; }

const DEPS: Partial<Record<TransactionSectionKey, TransactionSectionKey[]>> = {
  recipient_transaction_block: ["payload_integrity_transaction_block", "reference_instruction_transaction_block"],
  payload_integrity_transaction_block: ["reference_instruction_transaction_block", "transaction_completion_gate_review"],
  reference_instruction_transaction_block: ["exclusion_guard_transaction_block", "transaction_completion_gate_review"],
  exclusion_guard_transaction_block: ["actor_authorization_audit_transaction_block", "transaction_completion_gate_review"],
  actor_authorization_audit_transaction_block: ["transaction_completion_gate_review"],
};
function getDeps(k: TransactionSectionKey): TransactionSectionKey[] { return DEPS[k] || []; }

function recomputeCommitReadiness(secs: ActualSendTransactionSectionResolutionStateV2[]): ActualSendTransactionCommitReadinessGateStateV2 {
  const total = secs.length; const ready = secs.filter(s => s.eligibleForCommitReadiness).length;
  const unresolved = secs.filter(s => s.resolutionStatus === "blocked_unresolved" || s.resolutionStatus === "returned_to_actual_send_action" || s.resolutionStatus === "returned_to_execution_or_confirmation" || s.resolutionStatus === "unreviewed" || s.resolutionStatus === "in_review" || s.remainingUnresolvedInputs.length > 0).map(s => s.sectionKey);
  const warningOnly = secs.filter(s => s.resolutionStatus === "reviewed_with_warning" && s.remainingUnresolvedInputs.length === 0).map(s => s.sectionKey);
  const allowed = unresolved.length === 0;
  return { commitReadinessStatus: allowed ? "ready_for_marking" : "not_ready", requiredSectionsTotal: total, sectionsReadyCount: ready, unresolvedSectionKeys: unresolved, warningOnlySectionKeys: warningOnly, commitReadinessBlockers: unresolved.map(k => `Section ${k}: unresolved`), commitReadinessAllowed: allowed, commitReadinessReason: allowed ? "모든 section commit-ready eligible" : "미해소 section 존재", nextGateStatus: "locked", actualSendCommitEnablementStatus: "disabled", actualSendStatus: "not_sent" };
}

const ALL: TransactionSectionKey[] = ["recipient_transaction_block", "payload_integrity_transaction_block", "reference_instruction_transaction_block", "exclusion_guard_transaction_block", "actor_authorization_audit_transaction_block", "transaction_completion_gate_review"];

export function createInitialTransactionSession(caseId: string, handoffPackageId: string, gateId: string, actionSessionId: string, actor: string): ActualSendTransactionSessionV2 {
  const now = new Date().toISOString();
  const secs: ActualSendTransactionSectionResolutionStateV2[] = ALL.map(k => ({ sectionKey: k, resolutionStatus: "unreviewed", resolutionMode: "not_applicable", resolvedAt: null, resolvedBy: null, resolutionReason: "", remainingUnresolvedInputs: [], remainingWarnings: [], requiresReturnToActualSendAction: false, requiresReturnToExecutionOrConfirmation: false, requiresRevisitAfterReturn: false, eligibleForCommitReadiness: false, fieldGroupSnapshotRef: handoffPackageId, evidenceNote: "" }));
  return { actualSendTransactionSessionId: `txnsn_${Date.now().toString(36)}`, caseId, handoffPackageId, actualSendTransactionGateId: gateId, actualSendActionSessionId: actionSessionId, sessionStatus: "transaction_open", transactionPhase: "final_transaction_resolution", openedAt: now, lastUpdatedAt: now, openedBy: actor, activeSectionKey: null, operatorFocusOrder: [...ALL], sectionResolutionStates: secs, commitReadinessGateState: recomputeCommitReadiness(secs), returnHistory: [], reopenLinks: [], auditEventRefs: [], provenance: handoffPackageId };
}

export function applyActualSendTransactionMutation(session: ActualSendTransactionSessionV2, payload: TransactionActionPayload): ActualSendTransactionMutationResultV2 {
  const now = payload.timestamp; const events: TransactionAuditEvent[] = [];
  const makeEvent = (type: TransactionAuditEventType, reason: string): TransactionAuditEvent => ({ type, caseId: session.caseId, sessionId: session.actualSendTransactionSessionId, handoffPackageId: session.handoffPackageId, gateId: session.actualSendTransactionGateId, sectionKeyIfAny: payload.sectionKey ?? null, actionKey: payload.action, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): ActualSendTransactionMutationResultV2 => { events.push(makeEvent("actual_send_transaction_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, updatedWorkspaceStatusIfAny: null, recomputeRequired: false, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now, sectionResolutionStates: session.sectionResolutionStates.map(s => ({ ...s })) };
  const find = (k: TransactionSectionKey) => u.sectionResolutionStates.find(s => s.sectionKey === k);
  const markDeps = (k: TransactionSectionKey) => { for (const dk of getDeps(k)) { const d = find(dk); if (d && d.resolutionStatus !== "unreviewed") d.requiresRevisitAfterReturn = true; } };

  switch (payload.action) {
    case "open_actual_send_transaction_session": { u.sessionStatus = "transaction_open"; u.transactionPhase = "final_transaction_resolution"; events.push(makeEvent("actual_send_transaction_session_opened", "Session opened")); break; }
    case "set_active_section": { if (!payload.sectionKey) return reject("Section key 필수"); u.activeSectionKey = payload.sectionKey; break; }
    case "mark_section_in_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "in_review"; u.sessionStatus = "transaction_review_in_progress"; events.push(makeEvent("actual_send_transaction_section_review_started", `${payload.sectionKey} review started`)); break; }
    case "resolve_transaction_gap_in_place": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "resolved_in_place"; s.resolutionMode = "in_place"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForCommitReadiness = true; s.requiresRevisitAfterReturn = false; markDeps(payload.sectionKey); events.push(makeEvent("actual_send_transaction_section_resolved_in_place", `${payload.sectionKey} resolved`)); break; }
    case "acknowledge_transaction_warning": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "reviewed_with_warning"; s.resolutionMode = "warning_acknowledged"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForCommitReadiness = true; events.push(makeEvent("actual_send_transaction_section_warning_acknowledged", `${payload.sectionKey} warning ack`)); break; }
    case "mark_section_reviewed": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); if (s.resolutionStatus === "unreviewed") return reject("먼저 review 필요");
      if (payload.sectionKey === "transaction_completion_gate_review") { const others = u.sectionResolutionStates.filter(x => x.sectionKey !== "transaction_completion_gate_review"); if (!others.every(x => x.eligibleForCommitReadiness)) return reject("다른 section 모두 commit-ready eligible이어야 함"); }
      s.resolutionStatus = "reviewed_complete"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForCommitReadiness = true; break; }
    case "return_section_to_actual_send_action_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_actual_send_action"; s.resolutionMode = "return_to_actual_send_action"; s.requiresRevisitAfterReturn = true; s.eligibleForCommitReadiness = false; u.sessionStatus = "returned_to_actual_send_action"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to action", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "conflict", returnTarget: "actual_send_action", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "action resolution" }); events.push(makeEvent("actual_send_transaction_section_returned_to_actual_send_action", `${payload.sectionKey} → action`)); break; }
    case "return_section_to_execution_or_confirmation": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_execution_or_confirmation"; s.resolutionMode = "return_to_execution_or_confirmation"; s.requiresRevisitAfterReturn = true; s.eligibleForCommitReadiness = false; u.sessionStatus = "returned_to_execution_or_confirmation"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to execution/confirmation", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "basis conflict", returnTarget: "execution_or_confirmation", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "execution/confirmation resolution" }); events.push(makeEvent("actual_send_transaction_section_returned_to_execution_or_confirmation", `${payload.sectionKey} → execution/confirmation`)); break; }
    case "reopen_section_after_return": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "unreviewed"; s.resolutionMode = "not_applicable"; s.resolvedAt = null; s.resolvedBy = null; s.requiresRevisitAfterReturn = false; s.eligibleForCommitReadiness = false; if (u.sessionStatus === "returned_to_actual_send_action" || u.sessionStatus === "returned_to_execution_or_confirmation") { u.sessionStatus = "transaction_review_in_progress"; u.transactionPhase = "final_transaction_resolution"; } events.push(makeEvent("actual_send_transaction_section_reopened_after_return", `${payload.sectionKey} reopened`)); break; }
    case "mark_exclusion_guard_transaction_rechecked": { const s = find("exclusion_guard_transaction_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Contamination risk 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "guard_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForCommitReadiness = true; s.evidenceNote = `Transaction guard rechecked at ${now}`; markDeps("exclusion_guard_transaction_block"); events.push(makeEvent("actual_send_transaction_exclusion_guard_rechecked", "Transaction exclusion guard rechecked")); break; }
    case "mark_actor_authorization_audit_confirmed": { const s = find("actor_authorization_audit_transaction_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Authorization/audit gap 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "authorization_audit_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForCommitReadiness = true; s.evidenceNote = `Authorization/audit confirmed at ${now}`; markDeps("actor_authorization_audit_transaction_block"); events.push(makeEvent("actual_send_transaction_actor_authorization_audit_confirmed", "Authorization/audit confirmed")); break; }
    case "run_commit_readiness_check": { u.transactionPhase = "commit_readiness_check"; u.commitReadinessGateState = recomputeCommitReadiness(u.sectionResolutionStates); events.push(makeEvent("actual_send_transaction_commit_readiness_check_run", `Commit readiness: ${u.commitReadinessGateState.commitReadinessStatus}`)); break; }
    case "mark_transaction_ready": { u.commitReadinessGateState = recomputeCommitReadiness(u.sectionResolutionStates); if (!u.commitReadinessGateState.commitReadinessAllowed) return reject(`Transaction ready 불가: ${u.commitReadinessGateState.commitReadinessBlockers.join("; ")}`); u.sessionStatus = "transaction_ready_pending_commit"; u.transactionPhase = "pending_actual_send_commit"; u.commitReadinessGateState.commitReadinessStatus = "transaction_ready_pending_commit"; u.commitReadinessGateState.commitReadinessReason = "Transaction ready — actual send commit pending (Batch 1: commit locked)"; u.commitReadinessGateState.nextGateStatus = "pending_actual_send_commit"; events.push(makeEvent("actual_send_transaction_marked_ready_pending_commit", "Transaction ready — pending commit")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }

  u.commitReadinessGateState = recomputeCommitReadiness(u.sectionResolutionStates);
  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, updatedWorkspaceStatusIfAny: u.sessionStatus === "returned_to_actual_send_action" || u.sessionStatus === "returned_to_execution_or_confirmation" ? "transaction_hold" : null, recomputeRequired: true, emittedEvents: events };
}
