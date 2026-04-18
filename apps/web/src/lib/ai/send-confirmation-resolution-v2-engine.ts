/**
 * Send Confirmation Resolution v2 Engine — action → canonical mutation → audit
 *
 * 고정 규칙:
 * 1. SendConfirmationGateV2 = entry truth, SendConfirmationSessionV2 = execution truth.
 * 2. section resolution truth = SendConfirmationSectionResolutionStateV2.
 * 3. completion gate truth = SendConfirmationCompletionGateStateV2.
 * 4. confirmation complete ≠ send execution enablement.
 * 5. Batch 1: send execution / dispatched 전부 금지.
 * 6. return 후 자동 completion 금지 — dependency revisit 강제.
 * 7. mutation → recompute → reprojection 순서 강제.
 */

import type { SendConfirmationSectionKey } from "./send-confirmation-workspace-v2";

// ── Session ──
export type ConfirmationSessionStatus = "confirmation_open" | "confirmation_in_progress" | "confirmation_hold" | "returned_to_validation" | "returned_to_draft_assembly" | "confirmation_complete_pending_send_execution_gate" | "confirmation_locked";
export type ConfirmationPhase = "final_check_resolution" | "ambiguity_clearance" | "guard_confirmation" | "completion_check" | "pending_send_execution_gate";

export interface SendConfirmationSessionV2 {
  confirmationSessionId: string; caseId: string; handoffPackageId: string; sendConfirmationGateId: string; validationSessionId: string;
  sessionStatus: ConfirmationSessionStatus; confirmationPhase: ConfirmationPhase;
  openedAt: string; lastUpdatedAt: string; openedBy: string;
  activeSectionKey: SendConfirmationSectionKey | null; operatorFocusOrder: SendConfirmationSectionKey[];
  sectionResolutionStates: SendConfirmationSectionResolutionStateV2[];
  completionGateState: SendConfirmationCompletionGateStateV2;
  returnHistory: ConfirmationReturnRecord[]; reopenLinks: string[]; auditEventRefs: string[]; provenance: string;
}

// ── Section Resolution ──
export type ConfirmationSectionResolutionStatus = "unreviewed" | "in_review" | "resolved_in_place" | "confirmed_with_warning" | "returned_to_validation" | "returned_to_draft_assembly" | "blocked_unresolved" | "confirmed_complete";
export type ConfirmationSectionResolutionMode = "in_place" | "warning_acknowledged" | "return_to_validation" | "return_to_draft_assembly" | "guard_confirmation" | "not_applicable";

export interface SendConfirmationSectionResolutionStateV2 {
  sectionKey: SendConfirmationSectionKey; resolutionStatus: ConfirmationSectionResolutionStatus; resolutionMode: ConfirmationSectionResolutionMode;
  resolvedAt: string | null; resolvedBy: string | null; resolutionReason: string;
  remainingUnconfirmedInputs: string[]; remainingWarnings: string[];
  requiresReturnToValidation: boolean; requiresReturnToDraftAssembly: boolean; requiresRevisitAfterReturn: boolean;
  eligibleForConfirmationCompletion: boolean; fieldGroupSnapshotRef: string; evidenceNote: string;
}

// ── Completion Gate ──
export type ConfirmationCompletionStatus = "not_ready" | "needs_review" | "ready_for_completion" | "completed_pending_send_execution_gate";

export interface SendConfirmationCompletionGateStateV2 {
  completionStatus: ConfirmationCompletionStatus; requiredSectionsTotal: number; sectionsCompletionReady: number;
  unresolvedSectionKeys: SendConfirmationSectionKey[]; warningOnlySectionKeys: SendConfirmationSectionKey[];
  completionBlockers: string[]; completionAllowed: boolean; completionReason: string;
  nextGateStatus: "locked" | "pending_send_execution_gate_compute"; sendExecutionEnablementStatus: "disabled";
}

// ── Return Record ──
export interface ConfirmationReturnRecord {
  returnReason: string; returnSectionKey: SendConfirmationSectionKey; triggerConflictOrGap: string;
  returnTarget: "validation" | "draft_assembly"; linkedUpstreamSectionIfAny: string | null;
  returnedAt: string; returnedBy: string; requiresRevisitAfterReturn: boolean; expectedReentryBasis: string;
}

// ── Actions ──
export type ConfirmationAction = "open_confirmation_session" | "set_active_section" | "mark_section_in_review" | "resolve_confirmation_gap_in_place" | "acknowledge_confirmation_warning" | "mark_section_confirmed" | "return_section_to_validation_review" | "return_section_to_draft_assembly" | "reopen_section_after_return" | "mark_exclusion_guard_confirmed" | "run_confirmation_completion_check" | "mark_send_confirmation_complete";
export type ForbiddenConfirmationAction = "compute_send_execution_package" | "freeze_final_transport_payload" | "execute_supplier_send" | "mark_dispatched";

export interface ConfirmationActionPayload { action: ConfirmationAction; sectionKey?: SendConfirmationSectionKey; reason?: string; returnTarget?: "validation" | "draft_assembly"; actor: string; timestamp: string; }

// ── Mutation Result ──
export interface SendConfirmationMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedConfirmationSession: SendConfirmationSessionV2; updatedWorkspaceStatusIfAny: string | null; recomputeRequired: boolean; emittedEvents: ConfirmationAuditEvent[]; }

// ── Audit Events ──
export type ConfirmationAuditEventType = "send_confirmation_session_opened" | "send_confirmation_section_review_started" | "send_confirmation_section_resolved_in_place" | "send_confirmation_section_warning_acknowledged" | "send_confirmation_section_returned_to_validation" | "send_confirmation_section_returned_to_draft_assembly" | "send_confirmation_section_reopened_after_return" | "send_confirmation_exclusion_guard_confirmed" | "send_confirmation_completion_check_run" | "send_confirmation_marked_complete_pending_send_execution_gate" | "send_confirmation_mutation_rejected";

export interface ConfirmationAuditEvent { type: ConfirmationAuditEventType; caseId: string; confirmationSessionId: string; handoffPackageId: string; sendConfirmationGateId: string; sectionKeyIfAny: SendConfirmationSectionKey | null; actionKey: ConfirmationAction | ForbiddenConfirmationAction; reason: string; actor: string; timestamp: string; }

// ── Dependencies ──
const SECTION_DEPS: Partial<Record<SendConfirmationSectionKey, SendConfirmationSectionKey[]>> = {
  recipient_confirmation_block: ["scope_confirmation_block", "reference_visibility_confirmation_block"],
  scope_confirmation_block: ["instruction_confirmation_block", "confirmation_completion_gate_review"],
  reference_visibility_confirmation_block: ["instruction_confirmation_block", "confirmation_completion_gate_review"],
  instruction_confirmation_block: ["exclusion_guard_confirmation_block"],
  exclusion_guard_confirmation_block: ["confirmation_completion_gate_review"],
};

function getDeps(key: SendConfirmationSectionKey): SendConfirmationSectionKey[] { return SECTION_DEPS[key] || []; }

// ── Completion Recompute ──
function recomputeCompletion(sections: SendConfirmationSectionResolutionStateV2[]): SendConfirmationCompletionGateStateV2 {
  const total = sections.length;
  const ready = sections.filter(s => s.eligibleForConfirmationCompletion).length;
  const unresolved = sections.filter(s => s.resolutionStatus === "blocked_unresolved" || s.resolutionStatus === "returned_to_validation" || s.resolutionStatus === "returned_to_draft_assembly" || s.resolutionStatus === "unreviewed" || s.resolutionStatus === "in_review" || s.remainingUnconfirmedInputs.length > 0).map(s => s.sectionKey);
  const warningOnly = sections.filter(s => s.resolutionStatus === "confirmed_with_warning" && s.remainingUnconfirmedInputs.length === 0).map(s => s.sectionKey);
  const allowed = unresolved.length === 0;
  return { completionStatus: allowed ? "ready_for_completion" : "not_ready", requiredSectionsTotal: total, sectionsCompletionReady: ready, unresolvedSectionKeys: unresolved, warningOnlySectionKeys: warningOnly, completionBlockers: unresolved.map(k => `Section ${k}: unresolved`), completionAllowed: allowed, completionReason: allowed ? "모든 section completion eligible" : "미해소 section 존재", nextGateStatus: "locked", sendExecutionEnablementStatus: "disabled" };
}

// ── Initial Session ──
const ALL_SECTIONS: SendConfirmationSectionKey[] = ["recipient_confirmation_block", "scope_confirmation_block", "reference_visibility_confirmation_block", "instruction_confirmation_block", "exclusion_guard_confirmation_block", "confirmation_completion_gate_review"];

export function createInitialConfirmationSession(caseId: string, handoffPackageId: string, gateId: string, validationSessionId: string, actor: string): SendConfirmationSessionV2 {
  const now = new Date().toISOString();
  const secs: SendConfirmationSectionResolutionStateV2[] = ALL_SECTIONS.map(key => ({ sectionKey: key, resolutionStatus: "unreviewed", resolutionMode: "not_applicable", resolvedAt: null, resolvedBy: null, resolutionReason: "", remainingUnconfirmedInputs: [], remainingWarnings: [], requiresReturnToValidation: false, requiresReturnToDraftAssembly: false, requiresRevisitAfterReturn: false, eligibleForConfirmationCompletion: false, fieldGroupSnapshotRef: handoffPackageId, evidenceNote: "" }));
  return { confirmationSessionId: `sndcsn_${Date.now().toString(36)}`, caseId, handoffPackageId, sendConfirmationGateId: gateId, validationSessionId, sessionStatus: "confirmation_open", confirmationPhase: "final_check_resolution", openedAt: now, lastUpdatedAt: now, openedBy: actor, activeSectionKey: null, operatorFocusOrder: [...ALL_SECTIONS], sectionResolutionStates: secs, completionGateState: recomputeCompletion(secs), returnHistory: [], reopenLinks: [], auditEventRefs: [], provenance: handoffPackageId };
}

// ── Apply Mutation ──
export function applySendConfirmationMutation(session: SendConfirmationSessionV2, payload: ConfirmationActionPayload): SendConfirmationMutationResultV2 {
  const now = payload.timestamp; const events: ConfirmationAuditEvent[] = [];
  const makeEvent = (type: ConfirmationAuditEventType, reason: string): ConfirmationAuditEvent => ({ type, caseId: session.caseId, confirmationSessionId: session.confirmationSessionId, handoffPackageId: session.handoffPackageId, sendConfirmationGateId: session.sendConfirmationGateId, sectionKeyIfAny: payload.sectionKey ?? null, actionKey: payload.action, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): SendConfirmationMutationResultV2 => { events.push(makeEvent("send_confirmation_mutation_rejected", reason)); return { applied: false, rejectedReasonIfAny: reason, updatedConfirmationSession: session, updatedWorkspaceStatusIfAny: null, recomputeRequired: false, emittedEvents: events }; };

  let updated = { ...session, lastUpdatedAt: now, sectionResolutionStates: session.sectionResolutionStates.map(s => ({ ...s })) };
  const findSec = (key: SendConfirmationSectionKey) => updated.sectionResolutionStates.find(s => s.sectionKey === key);
  const markDepsForRevisit = (key: SendConfirmationSectionKey) => { for (const dk of getDeps(key)) { const d = findSec(dk); if (d && d.resolutionStatus !== "unreviewed") d.requiresRevisitAfterReturn = true; } };

  switch (payload.action) {
    case "open_confirmation_session": { updated.sessionStatus = "confirmation_open"; updated.confirmationPhase = "final_check_resolution"; events.push(makeEvent("send_confirmation_session_opened", "Session opened")); break; }
    case "set_active_section": { if (!payload.sectionKey) return reject("Section key 필수"); updated.activeSectionKey = payload.sectionKey; break; }
    case "mark_section_in_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = findSec(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "in_review"; updated.sessionStatus = "confirmation_in_progress"; events.push(makeEvent("send_confirmation_section_review_started", `${payload.sectionKey} review started`)); break; }
    case "resolve_confirmation_gap_in_place": { if (!payload.sectionKey) return reject("Section key 필수"); const s = findSec(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnconfirmedInputs.length > 0) return reject("Unconfirmed inputs 남아 있음"); s.resolutionStatus = "resolved_in_place"; s.resolutionMode = "in_place"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.resolutionReason = payload.reason || "In-place"; s.eligibleForConfirmationCompletion = true; s.requiresRevisitAfterReturn = false; markDepsForRevisit(payload.sectionKey); events.push(makeEvent("send_confirmation_section_resolved_in_place", `${payload.sectionKey} resolved`)); break; }
    case "acknowledge_confirmation_warning": { if (!payload.sectionKey) return reject("Section key 필수"); const s = findSec(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnconfirmedInputs.length > 0) return reject("Unconfirmed inputs 남아 있음"); s.resolutionStatus = "confirmed_with_warning"; s.resolutionMode = "warning_acknowledged"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForConfirmationCompletion = true; events.push(makeEvent("send_confirmation_section_warning_acknowledged", `${payload.sectionKey} warning ack`)); break; }
    case "mark_section_confirmed": { if (!payload.sectionKey) return reject("Section key 필수"); const s = findSec(payload.sectionKey); if (!s) return reject("Not found"); if (s.remainingUnconfirmedInputs.length > 0) return reject("Unconfirmed 남아 있음"); if (s.resolutionStatus === "unreviewed") return reject("먼저 review 필요");
      if (payload.sectionKey === "confirmation_completion_gate_review") { const others = updated.sectionResolutionStates.filter(x => x.sectionKey !== "confirmation_completion_gate_review"); if (!others.every(x => x.eligibleForConfirmationCompletion)) return reject("다른 section 모두 completion eligible이어야 함"); }
      s.resolutionStatus = "confirmed_complete"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.eligibleForConfirmationCompletion = true; break; }
    case "return_section_to_validation_review": { if (!payload.sectionKey) return reject("Section key 필수"); const s = findSec(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_validation"; s.resolutionMode = "return_to_validation"; s.requiresRevisitAfterReturn = true; s.eligibleForConfirmationCompletion = false; updated.sessionStatus = "returned_to_validation"; markDepsForRevisit(payload.sectionKey); updated.returnHistory.push({ returnReason: payload.reason || "Return to validation", returnSectionKey: payload.sectionKey, triggerConflictOrGap: s.remainingUnconfirmedInputs.join("; ") || "conflict", returnTarget: "validation", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "validation resolution" }); events.push(makeEvent("send_confirmation_section_returned_to_validation", `${payload.sectionKey} → validation`)); break; }
    case "return_section_to_draft_assembly": { if (!payload.sectionKey) return reject("Section key 필수"); const s = findSec(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "returned_to_draft_assembly"; s.resolutionMode = "return_to_draft_assembly"; s.requiresRevisitAfterReturn = true; s.eligibleForConfirmationCompletion = false; updated.sessionStatus = "returned_to_draft_assembly"; markDepsForRevisit(payload.sectionKey); updated.returnHistory.push({ returnReason: payload.reason || "Return to draft assembly", returnSectionKey: payload.sectionKey, triggerConflictOrGap: s.remainingUnconfirmedInputs.join("; ") || "mismatch", returnTarget: "draft_assembly", linkedUpstreamSectionIfAny: null, returnedAt: now, returnedBy: payload.actor, requiresRevisitAfterReturn: true, expectedReentryBasis: "draft assembly resolution" }); events.push(makeEvent("send_confirmation_section_returned_to_draft_assembly", `${payload.sectionKey} → draft assembly`)); break; }
    case "reopen_section_after_return": { if (!payload.sectionKey) return reject("Section key 필수"); const s = findSec(payload.sectionKey); if (!s) return reject("Not found"); s.resolutionStatus = "unreviewed"; s.resolutionMode = "not_applicable"; s.resolvedAt = null; s.resolvedBy = null; s.requiresRevisitAfterReturn = false; s.eligibleForConfirmationCompletion = false; if (updated.sessionStatus === "returned_to_validation" || updated.sessionStatus === "returned_to_draft_assembly") { updated.sessionStatus = "confirmation_in_progress"; updated.confirmationPhase = "final_check_resolution"; } events.push(makeEvent("send_confirmation_section_reopened_after_return", `${payload.sectionKey} reopened`)); break; }
    case "mark_exclusion_guard_confirmed": { const s = findSec("exclusion_guard_confirmation_block"); if (!s) return reject("Not found"); if (s.remainingUnconfirmedInputs.length > 0) return reject("Contamination risk 남아 있음"); s.resolutionStatus = "confirmed_complete"; s.resolutionMode = "guard_confirmation"; s.resolvedAt = now; s.resolvedBy = payload.actor; s.resolutionReason = "Exclusion guard confirmed"; s.eligibleForConfirmationCompletion = true; s.evidenceNote = `Guard confirmed at ${now} by ${payload.actor}`; markDepsForRevisit("exclusion_guard_confirmation_block"); events.push(makeEvent("send_confirmation_exclusion_guard_confirmed", "Exclusion guard confirmed")); break; }
    case "run_confirmation_completion_check": { updated.confirmationPhase = "completion_check"; updated.completionGateState = recomputeCompletion(updated.sectionResolutionStates); events.push(makeEvent("send_confirmation_completion_check_run", `Completion: ${updated.completionGateState.completionStatus}`)); break; }
    case "mark_send_confirmation_complete": { updated.completionGateState = recomputeCompletion(updated.sectionResolutionStates); if (!updated.completionGateState.completionAllowed) return reject(`Completion 불가: ${updated.completionGateState.completionBlockers.join("; ")}`); updated.sessionStatus = "confirmation_complete_pending_send_execution_gate"; updated.confirmationPhase = "pending_send_execution_gate"; updated.completionGateState.completionStatus = "completed_pending_send_execution_gate"; updated.completionGateState.completionReason = "Confirmation complete — send execution gate pending (Batch 1: send locked)"; updated.completionGateState.nextGateStatus = "pending_send_execution_gate_compute"; events.push(makeEvent("send_confirmation_marked_complete_pending_send_execution_gate", "Confirmation complete — pending send execution gate")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }

  updated.completionGateState = recomputeCompletion(updated.sectionResolutionStates);
  return { applied: true, rejectedReasonIfAny: null, updatedConfirmationSession: updated, updatedWorkspaceStatusIfAny: updated.sessionStatus === "returned_to_validation" || updated.sessionStatus === "returned_to_draft_assembly" ? "confirmation_hold" : null, recomputeRequired: true, emittedEvents: events };
}
