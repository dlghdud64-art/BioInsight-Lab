/**
 * Send Execution Resolution v2 Engine — action → canonical mutation → audit
 *
 * 고정 규칙:
 * 1. SendExecutionGateV2 = entry truth, SendExecutionSessionV2 = execution truth.
 * 2. section resolution truth = SendExecutionSectionResolutionStateV2.
 * 3. ready gate truth = SendExecutionReadyGateStateV2.
 * 4. execution ready ≠ actual send ≠ dispatched.
 * 5. Batch 1: execute_supplier_send / mark_dispatched 전부 금지.
 * 6. return 후 자동 ready 금지 — dependency revisit 강제.
 * 7. mutation → recompute → reprojection 순서 강제.
 */

import type { SendExecSectionKey } from "./send-execution-workspace-v2";

// ── Session ──
export type ExecSessionStatus = "execution_open" | "execution_in_progress" | "execution_hold" | "returned_to_send_confirmation" | "returned_to_validation_or_draft" | "execution_ready_pending_actual_send" | "execution_locked";
export type ExecPhase = "final_readiness_resolution" | "payload_integrity_clearance" | "guard_and_audit_confirmation" | "ready_check" | "pending_actual_send";

export interface SendExecutionSessionV2 {
  executionSessionId: string; caseId: string; handoffPackageId: string; sendExecutionGateId: string; confirmationSessionId: string;
  sessionStatus: ExecSessionStatus; executionPhase: ExecPhase;
  openedAt: string; lastUpdatedAt: string; openedBy: string;
  activeSectionKey: SendExecSectionKey | null; operatorFocusOrder: SendExecSectionKey[];
  sectionResolutionStates: SendExecutionSectionResolutionStateV2[];
  readyGateState: SendExecutionReadyGateStateV2;
  returnHistory: ExecReturnRecord[]; reopenLinks: string[]; auditEventRefs: string[]; provenance: string;
}

// ── Section Resolution ──
export type ExecSectionResolutionStatus = "unreviewed" | "in_review" | "resolved_in_place" | "reviewed_with_warning" | "returned_to_send_confirmation" | "returned_to_validation_or_draft" | "blocked_unresolved" | "reviewed_complete";
export type ExecSectionResolutionMode = "in_place" | "warning_acknowledged" | "return_to_send_confirmation" | "return_to_validation_or_draft" | "guard_confirmation" | "audit_confirmation" | "not_applicable";

export interface SendExecutionSectionResolutionStateV2 {
  sectionKey: SendExecSectionKey; resolutionStatus: ExecSectionResolutionStatus; resolutionMode: ExecSectionResolutionMode;
  resolvedAt: string | null; resolvedBy: string | null; resolutionReason: string;
  remainingUnresolvedInputs: string[]; remainingWarnings: string[];
  requiresReturnToSendConfirmation: boolean; requiresReturnToValidationOrDraft: boolean; requiresRevisitAfterReturn: boolean;
  eligibleForExecutionReady: boolean; fieldGroupSnapshotRef: string; evidenceNote: string;
}

// ── Ready Gate ──
export type ExecReadyStatus = "not_ready" | "needs_review" | "ready_for_marking" | "ready_pending_actual_send";

export interface SendExecutionReadyGateStateV2 {
  readyStatus: ExecReadyStatus; requiredSectionsTotal: number; sectionsReadyCount: number;
  unresolvedSectionKeys: SendExecSectionKey[]; warningOnlySectionKeys: SendExecSectionKey[];
  readyBlockers: string[]; readyAllowed: boolean; readyReason: string;
  nextGateStatus: "locked" | "pending_actual_send_action"; actualSendEnablementStatus: "disabled"; dispatchStatus: "not_dispatched";
}

// ── Return Record ──
export interface ExecReturnRecord {
  returnReason: string; returnSectionKey: SendExecSectionKey; triggerConflictOrGap: string;
  returnTarget: "send_confirmation" | "validation_or_draft"; linkedUpstreamSectionIfAny: string | null;
  returnedAt: string; returnedBy: string; requiresRevisitAfterReturn: boolean; expectedReentryBasis: string;
}

// ── Actions ──
export type ExecAction = "open_execution_session" | "set_active_section" | "mark_section_in_review" | "resolve_execution_gap_in_place" | "acknowledge_execution_warning" | "mark_section_reviewed" | "return_section_to_send_confirmation_review" | "return_section_to_validation_or_draft" | "reopen_section_after_return" | "mark_exclusion_guard_rechecked" | "mark_audit_readiness_confirmed" | "run_execution_ready_check" | "mark_execution_ready";
export type ForbiddenExecAction = "execute_supplier_send" | "freeze_final_transport_payload" | "mark_dispatched" | "create_delivery_tracking_record" | "emit_supplier_send_receipt";

export interface ExecActionPayload { action: ExecAction; sectionKey?: SendExecSectionKey; reason?: string; returnTarget?: "send_confirmation" | "validation_or_draft"; actor: string; timestamp: string; }

// ── Mutation Result ──
export interface SendExecutionMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedExecutionSession: SendExecutionSessionV2; updatedWorkspaceStatusIfAny: string | null; recomputeRequired: boolean; emittedEvents: ExecAuditEvent[]; }

// ── Audit Events ──
export type ExecAuditEventType = "send_execution_session_opened" | "send_execution_section_review_started" | "send_execution_section_resolved_in_place" | "send_execution_section_warning_acknowledged" | "send_execution_section_returned_to_send_confirmation" | "send_execution_section_returned_to_validation_or_draft" | "send_execution_section_reopened_after_return" | "send_execution_exclusion_guard_rechecked" | "send_execution_audit_readiness_confirmed" | "send_execution_ready_check_run" | "send_execution_marked_ready_pending_actual_send" | "send_execution_mutation_rejected";

export interface ExecAuditEvent { type: ExecAuditEventType; caseId: string; executionSessionId: string; handoffPackageId: string; sendExecutionGateId: string; sectionKeyIfAny: SendExecSectionKey | null; actionKey: ExecAction | ForbiddenExecAction; reason: string; actor: string; timestamp: string; }

// ── Dependencies ──
const DEPS: Partial<Record<SendExecSectionKey, SendExecSectionKey[]>> = {
  recipient_execution_block: ["payload_integrity_execution_block", "reference_instruction_execution_block"],
  payload_integrity_execution_block: ["reference_instruction_execution_block", "execution_completion_gate_review"],
  reference_instruction_execution_block: ["exclusion_guard_execution_block", "execution_completion_gate_review"],
  exclusion_guard_execution_block: ["execution_audit_readiness_block", "execution_completion_gate_review"],
  execution_audit_readiness_block: ["execution_completion_gate_review"],
};
function getDeps(k: SendExecSectionKey): SendExecSectionKey[] { return DEPS[k] || []; }

// ── Ready Gate Recompute ──
function recomputeReadyGate(secs: SendExecutionSectionResolutionStateV2[]): SendExecutionReadyGateStateV2 {
  const total = secs.length; const ready = secs.filter(s => s.eligibleForExecutionReady).length;
  const unresolved = secs.filter(s => s.resolutionStatus === "blocked_unresolved" || s.resolutionStatus === "returned_to_send_confirmation" || s.resolutionStatus === "returned_to_validation_or_draft" || s.resolutionStatus === "unreviewed" || s.resolutionStatus === "in_review" || s.remainingUnresolvedInputs.length > 0).map(s => s.sectionKey);
  const warningOnly = secs.filter(s => s.resolutionStatus === "reviewed_with_warning" && s.remainingUnresolvedInputs.length === 0).map(s => s.sectionKey);
  const allowed = unresolved.length === 0;
  return { readyStatus: allowed ? "ready_for_marking" : "not_ready", requiredSectionsTotal: total, sectionsReadyCount: ready, unresolvedSectionKeys: unresolved, warningOnlySectionKeys: warningOnly, readyBlockers: unresolved.map(k => `Section ${k}: unresolved`), readyAllowed: allowed, readyReason: allowed ? "모든 section execution-ready eligible" : "미해소 section 존재", nextGateStatus: "locked", actualSendEnablementStatus: "disabled", dispatchStatus: "not_dispatched" };
}

// ── Initial Session ──
const ALL: SendExecSectionKey[] = ["recipient_execution_block", "payload_integrity_execution_block", "reference_instruction_execution_block", "exclusion_guard_execution_block", "execution_audit_readiness_block", "execution_completion_gate_review"];

export function createInitialExecutionSession(caseId: string, handoffPackageId: string, gateId: string, confirmationSessionId: string, actor: string): SendExecutionSessionV2 {
  const now = new Date().toISOString();
  const secs: SendExecutionSectionResolutionStateV2[] = ALL.map(k => ({ sectionKey: k, resolutionStatus: "unreviewed", resolutionMode: "not_applicable", resolvedAt: null, resolvedBy: null, resolutionReason: "", remainingUnresolvedInputs: [], remainingWarnings: [], requiresReturnToSendConfirmation: false, requiresReturnToValidationOrDraft: false, requiresRevisitAfterReturn: false, eligibleForExecutionReady: false, fieldGroupSnapshotRef: handoffPackageId, evidenceNote: "" }));
  return { executionSessionId: `sndexsn_${Date.now().toString(36)}`, caseId, handoffPackageId, sendExecutionGateId: gateId, confirmationSessionId, sessionStatus: "execution_open", executionPhase: "final_readiness_resolution", openedAt: now, lastUpdatedAt: now, openedBy: actor, activeSectionKey: null, operatorFocusOrder: [...ALL], sectionResolutionStates: secs, readyGateState: recomputeReadyGate(secs), returnHistory: [], reopenLinks: [], auditEventRefs: [], provenance: handoffPackageId };
}

// ── Apply Mutation ──
export function applySendExecutionMutation(session: SendExecutionSessionV2, payload: ExecActionPayload): SendExecutionMutationResultV2 {
  const now = payload.timestamp; const events: ExecAuditEvent[] = [];
  const makeEvent = (type: ExecAuditEventType, reason: string): ExecAuditEvent => ({ type, caseId: session.caseId, executionSessionId: session.executionSessionId, handoffPackageId: session.handoffPackageId, sendExecutionGateId: session.sendExecutionGateId, sectionKeyIfAny: payload.sectionKey ?? null, actionKey: payload.action, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): SendExecutionMutationResultV2 => { events.push(makeEvent("send_execution_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedExecutionSession: session, updatedWorkspaceStatusIfAny: null, recomputeRequired: false, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now, sectionResolutionStates: session.sectionResolutionStates.map(s => ({ ...s })) };
  const find = (k: SendExecSectionKey) => u.sectionResolutionStates.find(s => s.sectionKey === k);
  const markDeps = (k: SendExecSectionKey) => { for (const dk of getDeps(k)) { const d = find(dk); if (d && d.resolutionStatus !== "unreviewed") d.requiresRevisitAfterReturn = true; } };

  switch (payload.action) {
    case "open_execution_session": { u.sessionStatus = "execution_open"; u.executionPhase = "final_readiness_resolution"; events.push(makeEvent("send_execution_session_opened", "Session opened")); break; }
    case "set_active_section": { if (!payload.sectionKey) return reject("Section key 필수"); u.activeSectionKey = payload.sectionKey; break; }
    case "mark_section_in_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "in_review"; u.sessionStatus = "execution_in_progress"; events.push(makeEvent("send_execution_section_review_started", `${payload.sectionKey} review started`)); break; }
    case "resolve_execution_gap_in_place": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved inputs 남아 있음"); s.resolutionStatus = "resolved_in_place"; s.resolutionMode = "in_place"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.resolutionReason = payload.reason || "In-place"; s.eligibleForExecutionReady = true; s.requiresRevisitAfterReturn = false; markDeps(payload.sectionKey); events.push(makeEvent("send_execution_section_resolved_in_place", `${payload.sectionKey} resolved`)); break; }
    case "acknowledge_execution_warning": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved inputs 남아 있음"); s.resolutionStatus = "reviewed_with_warning"; s.resolutionMode = "warning_acknowledged"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForExecutionReady = true; events.push(makeEvent("send_execution_section_warning_acknowledged", `${payload.sectionKey} warning ack`)); break; }
    case "mark_section_reviewed": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved inputs 남아 있음"); if (s.resolutionStatus === "unreviewed") return reject("먼저 review 필요");
      if (payload.sectionKey === "execution_completion_gate_review") { const others = u.sectionResolutionStates.filter(x => x.sectionKey !== "execution_completion_gate_review"); if (!others.every(x => x.eligibleForExecutionReady)) return reject("다른 section 모두 ready eligible이어야 함"); }
      s.resolutionStatus = "reviewed_complete"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForExecutionReady = true; break; }
    case "return_section_to_send_confirmation_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_send_confirmation"; s.resolutionMode = "return_to_send_confirmation"; s.requiresRevisitAfterReturn = true; s.eligibleForExecutionReady = false; u.sessionStatus = "returned_to_send_confirmation"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to confirmation", returnSectionKey: payload.sectionKey, triggerConflictOrGap: s.remainingUnresolvedInputs.join("; ") || "conflict", returnTarget: "send_confirmation", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "confirmation resolution" }); events.push(makeEvent("send_execution_section_returned_to_send_confirmation", `${payload.sectionKey} → confirmation`)); break; }
    case "return_section_to_validation_or_draft": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_validation_or_draft"; s.resolutionMode = "return_to_validation_or_draft"; s.requiresRevisitAfterReturn = true; s.eligibleForExecutionReady = false; u.sessionStatus = "returned_to_validation_or_draft"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to validation/draft", returnSectionKey: payload.sectionKey, triggerConflictOrGap: s.remainingUnresolvedInputs.join("; ") || "basis conflict", returnTarget: "validation_or_draft", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "validation/draft resolution" }); events.push(makeEvent("send_execution_section_returned_to_validation_or_draft", `${payload.sectionKey} → validation/draft`)); break; }
    case "reopen_section_after_return": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "unreviewed"; s.resolutionMode = "not_applicable"; s.resolvedAt = null; s.resolvedBy = null; s.requiresRevisitAfterReturn = false; s.eligibleForExecutionReady = false; if (u.sessionStatus === "returned_to_send_confirmation" || u.sessionStatus === "returned_to_validation_or_draft") { u.sessionStatus = "execution_in_progress"; u.executionPhase = "final_readiness_resolution"; } events.push(makeEvent("send_execution_section_reopened_after_return", `${payload.sectionKey} reopened`)); break; }
    case "mark_exclusion_guard_rechecked": { const s = find("exclusion_guard_execution_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Contamination risk 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "guard_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.resolutionReason = "Exclusion guard rechecked"; s.eligibleForExecutionReady = true; s.evidenceNote = `Guard rechecked at ${now} by ${payload.actor}`; markDeps("exclusion_guard_execution_block"); events.push(makeEvent("send_execution_exclusion_guard_rechecked", "Exclusion guard rechecked")); break; }
    case "mark_audit_readiness_confirmed": { const s = find("execution_audit_readiness_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Audit gap 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "audit_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.resolutionReason = "Audit readiness confirmed"; s.eligibleForExecutionReady = true; s.evidenceNote = `Audit confirmed at ${now} by ${payload.actor}`; markDeps("execution_audit_readiness_block"); events.push(makeEvent("send_execution_audit_readiness_confirmed", "Audit readiness confirmed")); break; }
    case "run_execution_ready_check": { u.executionPhase = "ready_check"; u.readyGateState = recomputeReadyGate(u.sectionResolutionStates); events.push(makeEvent("send_execution_ready_check_run", `Ready: ${u.readyGateState.readyStatus}`)); break; }
    case "mark_execution_ready": { u.readyGateState = recomputeReadyGate(u.sectionResolutionStates); if (!u.readyGateState.readyAllowed) return reject(`Ready 불가: ${u.readyGateState.readyBlockers.join("; ")}`); u.sessionStatus = "execution_ready_pending_actual_send"; u.executionPhase = "pending_actual_send"; u.readyGateState.readyStatus = "ready_pending_actual_send"; u.readyGateState.readyReason = "Execution ready — actual send pending (Batch 1: send locked)"; u.readyGateState.nextGateStatus = "pending_actual_send_action"; events.push(makeEvent("send_execution_marked_ready_pending_actual_send", "Execution ready — pending actual send")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }

  u.readyGateState = recomputeReadyGate(u.sectionResolutionStates);
  return { applied: true, rejectedReasonIfAny: null, updatedExecutionSession: u, updatedWorkspaceStatusIfAny: u.sessionStatus === "returned_to_send_confirmation" || u.sessionStatus === "returned_to_validation_or_draft" ? "execution_hold" : null, recomputeRequired: true, emittedEvents: events };
}
