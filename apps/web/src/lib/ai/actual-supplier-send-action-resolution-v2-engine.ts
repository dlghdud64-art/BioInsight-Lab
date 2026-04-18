/**
 * Actual Supplier Send Action Resolution v2 Engine — arming action → canonical mutation → audit
 *
 * 고정 규칙:
 * 1. ActualSupplierSendActionSessionV2 = execution truth.
 * 2. section resolution + arming gate = canonical truth.
 * 3. arming complete ≠ actual send ≠ dispatched.
 * 4. Batch 1: execute_actual_send / mark_dispatched 전부 금지.
 * 5. return 후 자동 arming 금지 — dependency revisit 강제.
 * 6. mutation → recompute → reprojection 순서 강제.
 */

import type { ArmingSectionKey } from "./actual-supplier-send-action-workspace-v2";

// ── Session ──
export type ArmingSessionStatus = "arming_open" | "arming_in_progress" | "arming_hold" | "returned_to_send_execution" | "returned_to_confirmation_or_validation" | "arming_complete_pending_actual_send_transaction" | "arming_locked";
export type ArmingPhase = "final_arming_resolution" | "payload_integrity_clearance" | "guard_and_actor_audit_confirmation" | "arming_check" | "pending_actual_send_transaction";

export interface ActualSupplierSendActionSessionV2 {
  actualSendActionSessionId: string; caseId: string; handoffPackageId: string; actualSendActionGateId: string; executionSessionId: string;
  sessionStatus: ArmingSessionStatus; armingPhase: ArmingPhase;
  openedAt: string; lastUpdatedAt: string; openedBy: string;
  activeSectionKey: ArmingSectionKey | null; operatorFocusOrder: ArmingSectionKey[];
  sectionResolutionStates: ActualSupplierSendActionSectionResolutionStateV2[];
  armingGateState: ActualSupplierSendActionArmingGateStateV2;
  returnHistory: ArmingReturnRecord[]; reopenLinks: string[]; auditEventRefs: string[]; provenance: string;
}

// ── Section Resolution ──
export type ArmingSectionResolutionStatus = "unreviewed" | "in_review" | "resolved_in_place" | "reviewed_with_warning" | "returned_to_send_execution" | "returned_to_confirmation_or_validation" | "blocked_unresolved" | "reviewed_complete";
export type ArmingSectionResolutionMode = "in_place" | "warning_acknowledged" | "return_to_send_execution" | "return_to_confirmation_or_validation" | "guard_confirmation" | "actor_audit_confirmation" | "not_applicable";

export interface ActualSupplierSendActionSectionResolutionStateV2 {
  sectionKey: ArmingSectionKey; resolutionStatus: ArmingSectionResolutionStatus; resolutionMode: ArmingSectionResolutionMode;
  resolvedAt: string | null; resolvedBy: string | null; resolutionReason: string;
  remainingUnresolvedInputs: string[]; remainingWarnings: string[];
  requiresReturnToSendExecution: boolean; requiresReturnToConfirmationOrValidation: boolean; requiresRevisitAfterReturn: boolean;
  eligibleForArmingCompletion: boolean; fieldGroupSnapshotRef: string; evidenceNote: string;
}

// ── Arming Gate ──
export type ArmingGateReadyStatus = "not_ready" | "needs_review" | "ready_for_marking" | "arming_complete_pending_actual_send_transaction";

export interface ActualSupplierSendActionArmingGateStateV2 {
  armingStatus: ArmingGateReadyStatus; requiredSectionsTotal: number; sectionsReadyCount: number;
  unresolvedSectionKeys: ArmingSectionKey[]; warningOnlySectionKeys: ArmingSectionKey[];
  armingBlockers: string[]; armingAllowed: boolean; armingReason: string;
  nextGateStatus: "locked" | "pending_actual_send_transaction"; actualSendTransactionEnablementStatus: "disabled"; actualSendStatus: "not_sent";
}

// ── Return Record ──
export interface ArmingReturnRecord { returnReason: string; returnSectionKey: ArmingSectionKey; triggerConflictOrGap: string; returnTarget: "send_execution" | "confirmation_or_validation"; linkedUpstreamSectionIfAny: string | null; returnedAt: string; returnedBy: string; requiresRevisitAfterReturn: boolean; expectedReentryBasis: string; }

// ── Actions ──
export type ArmingAction = "open_actual_send_action_session" | "set_active_section" | "mark_section_in_review" | "resolve_arming_gap_in_place" | "acknowledge_arming_warning" | "mark_section_reviewed" | "return_section_to_send_execution_review" | "return_section_to_confirmation_or_validation" | "reopen_section_after_return" | "mark_exclusion_guard_final_rechecked" | "mark_actor_audit_basis_confirmed" | "run_arming_completion_check" | "mark_actual_send_action_arming_complete";
export type ForbiddenArmingAction = "execute_actual_send_transaction" | "freeze_transport_payload" | "mark_dispatched" | "create_delivery_tracking_record" | "emit_supplier_send_receipt";

export interface ArmingActionPayload { action: ArmingAction; sectionKey?: ArmingSectionKey; reason?: string; returnTarget?: "send_execution" | "confirmation_or_validation"; actor: string; timestamp: string; }

// ── Mutation Result ──
export interface ActualSupplierSendActionMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: ActualSupplierSendActionSessionV2; updatedWorkspaceStatusIfAny: string | null; recomputeRequired: boolean; emittedEvents: ArmingAuditEvent[]; }

// ── Audit Events ──
export type ArmingAuditEventType = "actual_supplier_send_action_session_opened" | "actual_supplier_send_action_section_review_started" | "actual_supplier_send_action_section_resolved_in_place" | "actual_supplier_send_action_section_warning_acknowledged" | "actual_supplier_send_action_section_returned_to_send_execution" | "actual_supplier_send_action_section_returned_to_confirmation_or_validation" | "actual_supplier_send_action_section_reopened_after_return" | "actual_supplier_send_action_exclusion_guard_rechecked" | "actual_supplier_send_action_actor_audit_basis_confirmed" | "actual_supplier_send_action_arming_check_run" | "actual_supplier_send_action_marked_complete_pending_transaction" | "actual_supplier_send_action_mutation_rejected";

export interface ArmingAuditEvent { type: ArmingAuditEventType; caseId: string; sessionId: string; handoffPackageId: string; gateId: string; sectionKeyIfAny: ArmingSectionKey | null; actionKey: ArmingAction | ForbiddenArmingAction; reason: string; actor: string; timestamp: string; }

// ── Dependencies ──
const DEPS: Partial<Record<ArmingSectionKey, ArmingSectionKey[]>> = {
  recipient_final_arming_block: ["payload_integrity_final_arming_block", "reference_instruction_final_arming_block"],
  payload_integrity_final_arming_block: ["reference_instruction_final_arming_block", "arming_completion_gate_review"],
  reference_instruction_final_arming_block: ["exclusion_guard_final_arming_block", "arming_completion_gate_review"],
  exclusion_guard_final_arming_block: ["actor_and_audit_final_arming_block", "arming_completion_gate_review"],
  actor_and_audit_final_arming_block: ["arming_completion_gate_review"],
};
function getDeps(k: ArmingSectionKey): ArmingSectionKey[] { return DEPS[k] || []; }

// ── Arming Gate Recompute ──
function recomputeArmingGate(secs: ActualSupplierSendActionSectionResolutionStateV2[]): ActualSupplierSendActionArmingGateStateV2 {
  const total = secs.length; const ready = secs.filter(s => s.eligibleForArmingCompletion).length;
  const unresolved = secs.filter(s => s.resolutionStatus === "blocked_unresolved" || s.resolutionStatus === "returned_to_send_execution" || s.resolutionStatus === "returned_to_confirmation_or_validation" || s.resolutionStatus === "unreviewed" || s.resolutionStatus === "in_review" || s.remainingUnresolvedInputs.length > 0).map(s => s.sectionKey);
  const warningOnly = secs.filter(s => s.resolutionStatus === "reviewed_with_warning" && s.remainingUnresolvedInputs.length === 0).map(s => s.sectionKey);
  const allowed = unresolved.length === 0;
  return { armingStatus: allowed ? "ready_for_marking" : "not_ready", requiredSectionsTotal: total, sectionsReadyCount: ready, unresolvedSectionKeys: unresolved, warningOnlySectionKeys: warningOnly, armingBlockers: unresolved.map(k => `Section ${k}: unresolved`), armingAllowed: allowed, armingReason: allowed ? "모든 section arming-ready eligible" : "미해소 section 존재", nextGateStatus: "locked", actualSendTransactionEnablementStatus: "disabled", actualSendStatus: "not_sent" };
}

// ── Initial Session ──
const ALL: ArmingSectionKey[] = ["recipient_final_arming_block", "payload_integrity_final_arming_block", "reference_instruction_final_arming_block", "exclusion_guard_final_arming_block", "actor_and_audit_final_arming_block", "arming_completion_gate_review"];

export function createInitialArmingSession(caseId: string, handoffPackageId: string, gateId: string, executionSessionId: string, actor: string): ActualSupplierSendActionSessionV2 {
  const now = new Date().toISOString();
  const secs: ActualSupplierSendActionSectionResolutionStateV2[] = ALL.map(k => ({ sectionKey: k, resolutionStatus: "unreviewed", resolutionMode: "not_applicable", resolvedAt: null, resolvedBy: null, resolutionReason: "", remainingUnresolvedInputs: [], remainingWarnings: [], requiresReturnToSendExecution: false, requiresReturnToConfirmationOrValidation: false, requiresRevisitAfterReturn: false, eligibleForArmingCompletion: false, fieldGroupSnapshotRef: handoffPackageId, evidenceNote: "" }));
  return { actualSendActionSessionId: `actsndses_${Date.now().toString(36)}`, caseId, handoffPackageId, actualSendActionGateId: gateId, executionSessionId, sessionStatus: "arming_open", armingPhase: "final_arming_resolution", openedAt: now, lastUpdatedAt: now, openedBy: actor, activeSectionKey: null, operatorFocusOrder: [...ALL], sectionResolutionStates: secs, armingGateState: recomputeArmingGate(secs), returnHistory: [], reopenLinks: [], auditEventRefs: [], provenance: handoffPackageId };
}

// ── Apply Mutation ──
export function applyActualSendActionMutation(session: ActualSupplierSendActionSessionV2, payload: ArmingActionPayload): ActualSupplierSendActionMutationResultV2 {
  const now = payload.timestamp; const events: ArmingAuditEvent[] = [];
  const makeEvent = (type: ArmingAuditEventType, reason: string): ArmingAuditEvent => ({ type, caseId: session.caseId, sessionId: session.actualSendActionSessionId, handoffPackageId: session.handoffPackageId, gateId: session.actualSendActionGateId, sectionKeyIfAny: payload.sectionKey ?? null, actionKey: payload.action, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): ActualSupplierSendActionMutationResultV2 => { events.push(makeEvent("actual_supplier_send_action_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, updatedWorkspaceStatusIfAny: null, recomputeRequired: false, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now, sectionResolutionStates: session.sectionResolutionStates.map(s => ({ ...s })) };
  const find = (k: ArmingSectionKey) => u.sectionResolutionStates.find(s => s.sectionKey === k);
  const markDeps = (k: ArmingSectionKey) => { for (const dk of getDeps(k)) { const d = find(dk); if (d && d.resolutionStatus !== "unreviewed") d.requiresRevisitAfterReturn = true; } };

  switch (payload.action) {
    case "open_actual_send_action_session": { u.sessionStatus = "arming_open"; u.armingPhase = "final_arming_resolution"; events.push(makeEvent("actual_supplier_send_action_session_opened", "Session opened")); break; }
    case "set_active_section": { if (!payload.sectionKey) return reject("Section key 필수"); u.activeSectionKey = payload.sectionKey; break; }
    case "mark_section_in_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "in_review"; u.sessionStatus = "arming_in_progress"; events.push(makeEvent("actual_supplier_send_action_section_review_started", `${payload.sectionKey} review started`)); break; }
    case "resolve_arming_gap_in_place": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "resolved_in_place"; s.resolutionMode = "in_place"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForArmingCompletion = true; s.requiresRevisitAfterReturn = false; markDeps(payload.sectionKey); events.push(makeEvent("actual_supplier_send_action_section_resolved_in_place", `${payload.sectionKey} resolved`)); break; }
    case "acknowledge_arming_warning": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); s.resolutionStatus = "reviewed_with_warning"; s.resolutionMode = "warning_acknowledged"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForArmingCompletion = true; events.push(makeEvent("actual_supplier_send_action_section_warning_acknowledged", `${payload.sectionKey} warning ack`)); break; }
    case "mark_section_reviewed": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Unresolved 남아 있음"); if (s.resolutionStatus === "unreviewed") return reject("먼저 review 필요");
      if (payload.sectionKey === "arming_completion_gate_review") { const others = u.sectionResolutionStates.filter(x => x.sectionKey !== "arming_completion_gate_review"); if (!others.every(x => x.eligibleForArmingCompletion)) return reject("다른 section 모두 arming eligible이어야 함"); }
      s.resolutionStatus = "reviewed_complete"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForArmingCompletion = true; break; }
    case "return_section_to_send_execution_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_send_execution"; s.resolutionMode = "return_to_send_execution"; s.requiresRevisitAfterReturn = true; s.eligibleForArmingCompletion = false; u.sessionStatus = "returned_to_send_execution"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to execution", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "conflict", returnTarget: "send_execution", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "execution resolution" }); events.push(makeEvent("actual_supplier_send_action_section_returned_to_send_execution", `${payload.sectionKey} → execution`)); break; }
    case "return_section_to_confirmation_or_validation": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_confirmation_or_validation"; s.resolutionMode = "return_to_confirmation_or_validation"; s.requiresRevisitAfterReturn = true; s.eligibleForArmingCompletion = false; u.sessionStatus = "returned_to_confirmation_or_validation"; markDeps(payload.sectionKey); u.returnHistory.push({ returnReason: payload.reason || "Return to confirmation/validation", returnSectionKey: payload.sectionKey, triggerConflictOrGap: "basis conflict", returnTarget: "confirmation_or_validation", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "confirmation/validation resolution" }); events.push(makeEvent("actual_supplier_send_action_section_returned_to_confirmation_or_validation", `${payload.sectionKey} → confirmation/validation`)); break; }
    case "reopen_section_after_return": { if (!payload.sectionKey) return reject("Section key 필수"); const s = find(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "unreviewed"; s.resolutionMode = "not_applicable"; s.resolvedAt = null; s.resolvedBy = null; s.requiresRevisitAfterReturn = false; s.eligibleForArmingCompletion = false; if (u.sessionStatus === "returned_to_send_execution" || u.sessionStatus === "returned_to_confirmation_or_validation") { u.sessionStatus = "arming_in_progress"; u.armingPhase = "final_arming_resolution"; } events.push(makeEvent("actual_supplier_send_action_section_reopened_after_return", `${payload.sectionKey} reopened`)); break; }
    case "mark_exclusion_guard_final_rechecked": { const s = find("exclusion_guard_final_arming_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Contamination risk 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "guard_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForArmingCompletion = true; s.evidenceNote = `Final guard rechecked at ${now}`; markDeps("exclusion_guard_final_arming_block"); events.push(makeEvent("actual_supplier_send_action_exclusion_guard_rechecked", "Final exclusion guard rechecked")); break; }
    case "mark_actor_audit_basis_confirmed": { const s = find("actor_and_audit_final_arming_block"); if (!s) return reject("Not found"); if (s.remainingUnresolvedInputs.length > 0) return reject("Audit gap 남아 있음"); s.resolutionStatus = "reviewed_complete"; s.resolutionMode = "actor_audit_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForArmingCompletion = true; s.evidenceNote = `Actor/audit confirmed at ${now}`; markDeps("actor_and_audit_final_arming_block"); events.push(makeEvent("actual_supplier_send_action_actor_audit_basis_confirmed", "Actor/audit basis confirmed")); break; }
    case "run_arming_completion_check": { u.armingPhase = "arming_check"; u.armingGateState = recomputeArmingGate(u.sectionResolutionStates); events.push(makeEvent("actual_supplier_send_action_arming_check_run", `Arming: ${u.armingGateState.armingStatus}`)); break; }
    case "mark_actual_send_action_arming_complete": { u.armingGateState = recomputeArmingGate(u.sectionResolutionStates); if (!u.armingGateState.armingAllowed) return reject(`Arming 불가: ${u.armingGateState.armingBlockers.join("; ")}`); u.sessionStatus = "arming_complete_pending_actual_send_transaction"; u.armingPhase = "pending_actual_send_transaction"; u.armingGateState.armingStatus = "arming_complete_pending_actual_send_transaction"; u.armingGateState.armingReason = "Arming complete — actual send transaction pending (Batch 1: send locked)"; u.armingGateState.nextGateStatus = "pending_actual_send_transaction"; events.push(makeEvent("actual_supplier_send_action_marked_complete_pending_transaction", "Arming complete — pending transaction")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }

  u.armingGateState = recomputeArmingGate(u.sectionResolutionStates);
  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, updatedWorkspaceStatusIfAny: u.sessionStatus === "returned_to_send_execution" || u.sessionStatus === "returned_to_confirmation_or_validation" ? "arming_hold" : null, recomputeRequired: true, emittedEvents: events };
}
