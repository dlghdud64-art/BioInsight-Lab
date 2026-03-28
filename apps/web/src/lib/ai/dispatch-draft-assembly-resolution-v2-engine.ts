/**
 * Dispatch Draft Assembly Resolution v2 Engine — action → canonical mutation → audit
 *
 * 고정 규칙:
 * 1. DispatchDraftEnablementGateV2 + upstream truths = source.
 * 2. assembly session truth = DispatchDraftAssemblySessionV2 (별도 canonical object).
 * 3. section resolution truth = DispatchDraftSectionResolutionStateV2.
 * 4. workspace/dock/preview = projection of above truths.
 * 5. assembly complete ≠ validation ready ≠ send ready.
 * 6. Batch 1: final draft generation / send / dispatched 전부 금지.
 * 7. mutation → recompute → reprojection 순서 강제.
 * 8. return-to-preparation 이후 자동 completion 금지.
 */

import type { DraftAssemblySectionKey } from "./dispatch-draft-workspace-v2";

// ══════════════════════════════════════════════
// Assembly Session
// ══════════════════════════════════════════════

export type AssemblySessionStatus = "assembly_open" | "assembly_in_progress" | "assembly_hold" | "returned_to_preparation" | "assembly_complete_pending_validation" | "assembly_locked";

export type AssemblyPhase = "input_resolution" | "field_review" | "completion_check" | "pending_validation";

export interface DispatchDraftAssemblySessionV2 {
  assemblySessionId: string;
  caseId: string;
  handoffPackageId: string;
  draftEnablementGateId: string;
  sessionStatus: AssemblySessionStatus;
  assemblyPhase: AssemblyPhase;
  openedAt: string;
  lastUpdatedAt: string;
  openedBy: string;
  activeSectionKey: DraftAssemblySectionKey | null;
  operatorFocusOrder: DraftAssemblySectionKey[];
  sectionResolutionStates: DispatchDraftSectionResolutionStateV2[];
  completionGateState: DispatchDraftAssemblyCompletionGateStateV2;
  returnHistory: DraftReturnRecord[];
  preparationReopenLinks: string[];
  auditEventRefs: string[];
  provenance: string;
}

// ══════════════════════════════════════════════
// Section Resolution State
// ══════════════════════════════════════════════

export type DraftSectionResolutionStatus = "unreviewed" | "in_review" | "resolved_in_place" | "reviewed_with_warning" | "returned_to_preparation" | "blocked_unresolved" | "reviewed_complete";

export type DraftSectionResolutionMode = "in_place" | "warning_acknowledged" | "return_to_preparation" | "guard_recheck" | "not_applicable";

export interface DispatchDraftSectionResolutionStateV2 {
  sectionKey: DraftAssemblySectionKey;
  resolutionStatus: DraftSectionResolutionStatus;
  resolutionMode: DraftSectionResolutionMode;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionReason: string;
  remainingMissingInputs: string[];
  remainingWarnings: string[];
  requiresReturnToPreparation: boolean;
  requiresRevisitAfterReturn: boolean;
  eligibleForAssemblyCompletion: boolean;
  fieldGroupSnapshotRef: string;
  evidenceNote: string;
}

// ══════════════════════════════════════════════
// Completion Gate State
// ══════════════════════════════════════════════

export type DraftCompletionStatus = "not_ready" | "needs_review" | "ready_for_completion" | "completed_pending_validation";
export type DraftNextGateStatus = "locked" | "pending_validation_gate";
export type DraftValidationEnablementStatus = "disabled" | "pending_gate_compute";
export type DraftSendEnablementStatus = "disabled";

export interface DispatchDraftAssemblyCompletionGateStateV2 {
  completionStatus: DraftCompletionStatus;
  requiredSectionsTotal: number;
  sectionsCompletionReady: number;
  unresolvedSectionKeys: DraftAssemblySectionKey[];
  warningOnlySectionKeys: DraftAssemblySectionKey[];
  completionBlockers: string[];
  completionAllowed: boolean;
  completionReason: string;
  nextGateStatus: DraftNextGateStatus;
  validationEnablementStatus: DraftValidationEnablementStatus;
  sendEnablementStatus: DraftSendEnablementStatus;
}

// ══════════════════════════════════════════════
// Return Record
// ══════════════════════════════════════════════

export interface DraftReturnRecord {
  returnReason: string;
  returnSectionKey: DraftAssemblySectionKey;
  triggerMissingOrConflict: string;
  linkedPreparationSectionIfAny: string | null;
  returnedAt: string;
  returnedBy: string;
  requiresRevisitAfterReturn: boolean;
  expectedReentryBasis: string;
}

// ══════════════════════════════════════════════
// Action Types
// ══════════════════════════════════════════════

export type DraftAssemblyAction =
  | "open_assembly_session"
  | "set_active_section"
  | "mark_section_in_review"
  | "resolve_section_inputs_in_place"
  | "acknowledge_section_warning"
  | "mark_section_reviewed"
  | "return_section_to_preparation_review"
  | "reopen_section_after_preparation_return"
  | "mark_internal_exclusion_guard_checked"
  | "run_assembly_completion_check"
  | "mark_draft_assembly_complete";

export type ForbiddenDraftAction = "generate_final_vendor_dispatch_draft" | "freeze_vendor_send_payload" | "send_to_supplier" | "mark_dispatched" | "finalize_attachment_send_package";

export interface DraftAssemblyActionPayload {
  action: DraftAssemblyAction;
  sectionKey?: DraftAssemblySectionKey;
  reason?: string;
  actor: string;
  timestamp: string;
}

// ══════════════════════════════════════════════
// Mutation Result
// ══════════════════════════════════════════════

export interface DispatchDraftAssemblyMutationResultV2 {
  applied: boolean;
  rejectedReasonIfAny: string | null;
  updatedAssemblySession: DispatchDraftAssemblySessionV2;
  updatedWorkspaceStatusIfAny: string | null;
  recomputeRequired: boolean;
  emittedEvents: DraftAssemblyAuditEvent[];
}

// ══════════════════════════════════════════════
// Audit Events
// ══════════════════════════════════════════════

export type DraftAssemblyAuditEventType =
  | "dispatch_draft_assembly_session_opened"
  | "dispatch_draft_section_review_started"
  | "dispatch_draft_section_resolved_in_place"
  | "dispatch_draft_section_warning_acknowledged"
  | "dispatch_draft_section_returned_to_preparation"
  | "dispatch_draft_section_reopened_after_preparation_return"
  | "dispatch_draft_internal_exclusion_guard_checked"
  | "dispatch_draft_assembly_completion_check_run"
  | "dispatch_draft_assembly_marked_complete_pending_validation"
  | "dispatch_draft_assembly_mutation_rejected";

export interface DraftAssemblyAuditEvent {
  type: DraftAssemblyAuditEventType;
  caseId: string;
  assemblySessionId: string;
  handoffPackageId: string;
  draftEnablementGateId: string;
  sectionKeyIfAny: DraftAssemblySectionKey | null;
  actionKey: DraftAssemblyAction | ForbiddenDraftAction;
  reason: string;
  actor: string;
  timestamp: string;
}

// ══════════════════════════════════════════════
// Section Dependencies
// ══════════════════════════════════════════════

const SECTION_DEPENDENCIES: Record<DraftAssemblySectionKey, DraftAssemblySectionKey[]> = {
  vendor_recipient_block: ["reference_and_attachment_block"],
  dispatch_scope_block: ["instruction_block", "draft_completion_gate_review"],
  reference_and_attachment_block: ["draft_completion_gate_review"],
  instruction_block: ["internal_exclusion_guard"],
  internal_exclusion_guard: ["draft_completion_gate_review"],
  draft_completion_gate_review: [],
};

function getDependentSections(key: DraftAssemblySectionKey): DraftAssemblySectionKey[] {
  return SECTION_DEPENDENCIES[key] || [];
}

// ══════════════════════════════════════════════
// Completion Gate Recompute
// ══════════════════════════════════════════════

function recomputeCompletionGate(sections: DispatchDraftSectionResolutionStateV2[]): DispatchDraftAssemblyCompletionGateStateV2 {
  const total = sections.length;
  const ready = sections.filter(s => s.eligibleForAssemblyCompletion).length;
  const unresolved = sections.filter(s => s.resolutionStatus === "blocked_unresolved" || s.remainingMissingInputs.length > 0 || s.resolutionStatus === "unreviewed" || s.resolutionStatus === "in_review" || s.resolutionStatus === "returned_to_preparation").map(s => s.sectionKey);
  const warningOnly = sections.filter(s => s.resolutionStatus === "reviewed_with_warning" && s.remainingMissingInputs.length === 0).map(s => s.sectionKey);
  const blockers = unresolved.map(k => `Section ${k}: unresolved`);

  const allowed = unresolved.length === 0;

  return {
    completionStatus: allowed ? "ready_for_completion" : "not_ready",
    requiredSectionsTotal: total,
    sectionsCompletionReady: ready,
    unresolvedSectionKeys: unresolved,
    warningOnlySectionKeys: warningOnly,
    completionBlockers: blockers,
    completionAllowed: allowed,
    completionReason: allowed ? "모든 section completion eligible — assembly complete 가능" : "미해소 section 존재",
    nextGateStatus: "locked",
    validationEnablementStatus: "disabled",
    sendEnablementStatus: "disabled",
  };
}

// ══════════════════════════════════════════════
// Initial Session Builder
// ══════════════════════════════════════════════

const ALL_SECTIONS: DraftAssemblySectionKey[] = ["vendor_recipient_block", "dispatch_scope_block", "reference_and_attachment_block", "instruction_block", "internal_exclusion_guard", "draft_completion_gate_review"];

export function createInitialDraftAssemblySession(caseId: string, handoffPackageId: string, gateId: string, actor: string): DispatchDraftAssemblySessionV2 {
  const now = new Date().toISOString();

  const sectionStates: DispatchDraftSectionResolutionStateV2[] = ALL_SECTIONS.map(key => ({
    sectionKey: key,
    resolutionStatus: "unreviewed",
    resolutionMode: "not_applicable",
    resolvedAt: null,
    resolvedBy: null,
    resolutionReason: "",
    remainingMissingInputs: [],
    remainingWarnings: [],
    requiresReturnToPreparation: false,
    requiresRevisitAfterReturn: false,
    eligibleForAssemblyCompletion: false,
    fieldGroupSnapshotRef: handoffPackageId,
    evidenceNote: "",
  }));

  return {
    assemblySessionId: `dftasmsn_${Date.now().toString(36)}`,
    caseId,
    handoffPackageId,
    draftEnablementGateId: gateId,
    sessionStatus: "assembly_open",
    assemblyPhase: "input_resolution",
    openedAt: now,
    lastUpdatedAt: now,
    openedBy: actor,
    activeSectionKey: null,
    operatorFocusOrder: [...ALL_SECTIONS],
    sectionResolutionStates: sectionStates,
    completionGateState: recomputeCompletionGate(sectionStates),
    returnHistory: [],
    preparationReopenLinks: [],
    auditEventRefs: [],
    provenance: handoffPackageId,
  };
}

// ══════════════════════════════════════════════
// Apply Mutation
// ══════════════════════════════════════════════

export function applyDraftAssemblyMutation(
  session: DispatchDraftAssemblySessionV2,
  payload: DraftAssemblyActionPayload,
): DispatchDraftAssemblyMutationResultV2 {
  const now = payload.timestamp;
  const events: DraftAssemblyAuditEvent[] = [];

  const makeEvent = (type: DraftAssemblyAuditEventType, reason: string): DraftAssemblyAuditEvent => ({
    type, caseId: session.caseId, assemblySessionId: session.assemblySessionId, handoffPackageId: session.handoffPackageId,
    draftEnablementGateId: session.draftEnablementGateId, sectionKeyIfAny: payload.sectionKey ?? null,
    actionKey: payload.action, reason, actor: payload.actor, timestamp: now,
  });

  const reject = (reason: string): DispatchDraftAssemblyMutationResultV2 => {
    events.push(makeEvent("dispatch_draft_assembly_mutation_rejected", reason));
    return { applied: false, rejectedReasonIfAny: reason, updatedAssemblySession: session, updatedWorkspaceStatusIfAny: null, recomputeRequired: false, emittedEvents: events };
  };

  let updated = { ...session, lastUpdatedAt: now, sectionResolutionStates: session.sectionResolutionStates.map(s => ({ ...s })) };

  const findSection = (key: DraftAssemblySectionKey) => updated.sectionResolutionStates.find(s => s.sectionKey === key);
  const markDependentsForRevisit = (key: DraftAssemblySectionKey) => {
    for (const depKey of getDependentSections(key)) {
      const dep = findSection(depKey);
      if (dep && dep.resolutionStatus !== "unreviewed") dep.requiresRevisitAfterReturn = true;
    }
  };

  switch (payload.action) {
    case "open_assembly_session": {
      updated.sessionStatus = "assembly_open";
      updated.assemblyPhase = "input_resolution";
      events.push(makeEvent("dispatch_draft_assembly_session_opened", "Assembly session opened"));
      break;
    }

    case "set_active_section": {
      if (!payload.sectionKey) return reject("Section key 필수");
      updated.activeSectionKey = payload.sectionKey;
      break;
    }

    case "mark_section_in_review": {
      if (!payload.sectionKey) return reject("Section key 필수");
      const sec = findSection(payload.sectionKey);
      if (!sec) return reject("Section not found");
      sec.resolutionStatus = "in_review";
      updated.sessionStatus = "assembly_in_progress";
      updated.assemblyPhase = "field_review";
      events.push(makeEvent("dispatch_draft_section_review_started", `Section ${payload.sectionKey} review started`));
      break;
    }

    case "resolve_section_inputs_in_place": {
      if (!payload.sectionKey) return reject("Section key 필수");
      const sec = findSection(payload.sectionKey);
      if (!sec) return reject("Section not found");
      if (sec.remainingMissingInputs.length > 0) return reject("Missing inputs 남아 있어 in-place resolve 불가");
      sec.resolutionStatus = "resolved_in_place";
      sec.resolutionMode = "in_place";
      sec.resolvedAt = now;
      sec.resolvedBy = payload.actor;
      sec.resolutionReason = payload.reason || "In-place resolution";
      sec.eligibleForAssemblyCompletion = true;
      sec.requiresRevisitAfterReturn = false;
      markDependentsForRevisit(payload.sectionKey);
      events.push(makeEvent("dispatch_draft_section_resolved_in_place", `Section ${payload.sectionKey} resolved in place`));
      break;
    }

    case "acknowledge_section_warning": {
      if (!payload.sectionKey) return reject("Section key 필수");
      const sec = findSection(payload.sectionKey);
      if (!sec) return reject("Section not found");
      if (sec.remainingMissingInputs.length > 0) return reject("Missing inputs 남아 있어 warning acknowledgement 불가");
      sec.resolutionStatus = "reviewed_with_warning";
      sec.resolutionMode = "warning_acknowledged";
      sec.resolvedAt = now;
      sec.resolvedBy = payload.actor;
      sec.resolutionReason = payload.reason || "Warning acknowledged";
      sec.eligibleForAssemblyCompletion = true;
      events.push(makeEvent("dispatch_draft_section_warning_acknowledged", `Section ${payload.sectionKey} warning acknowledged`));
      break;
    }

    case "mark_section_reviewed": {
      if (!payload.sectionKey) return reject("Section key 필수");
      const sec = findSection(payload.sectionKey);
      if (!sec) return reject("Section not found");
      if (sec.remainingMissingInputs.length > 0) return reject("Missing inputs 남아 있어 reviewed 처리 불가");
      if (sec.resolutionStatus === "unreviewed") return reject("먼저 review 시작 필요");

      // draft_completion_gate_review는 다른 section 모두 eligible일 때만
      if (payload.sectionKey === "draft_completion_gate_review") {
        const otherSections = updated.sectionResolutionStates.filter(s => s.sectionKey !== "draft_completion_gate_review");
        const allEligible = otherSections.every(s => s.eligibleForAssemblyCompletion);
        if (!allEligible) return reject("다른 section이 모두 completion eligible이어야 completion gate review 가능");
      }

      sec.resolutionStatus = "reviewed_complete";
      sec.resolvedAt = now;
      sec.resolvedBy = payload.actor;
      sec.eligibleForAssemblyCompletion = true;
      break;
    }

    case "return_section_to_preparation_review": {
      if (!payload.sectionKey) return reject("Section key 필수");
      const sec = findSection(payload.sectionKey);
      if (!sec) return reject("Section not found");
      sec.resolutionStatus = "returned_to_preparation";
      sec.resolutionMode = "return_to_preparation";
      sec.requiresRevisitAfterReturn = true;
      sec.eligibleForAssemblyCompletion = false;
      updated.sessionStatus = "returned_to_preparation";
      updated.assemblyPhase = "input_resolution";
      markDependentsForRevisit(payload.sectionKey);
      updated.returnHistory.push({
        returnReason: payload.reason || "Return to preparation required",
        returnSectionKey: payload.sectionKey,
        triggerMissingOrConflict: sec.remainingMissingInputs.join("; ") || "conflict detected",
        linkedPreparationSectionIfAny: null,
        returnedAt: now,
        returnedBy: payload.actor,
        requiresRevisitAfterReturn: true,
        expectedReentryBasis: "preparation resolution",
      });
      events.push(makeEvent("dispatch_draft_section_returned_to_preparation", `Section ${payload.sectionKey} returned to preparation`));
      break;
    }

    case "reopen_section_after_preparation_return": {
      if (!payload.sectionKey) return reject("Section key 필수");
      const sec = findSection(payload.sectionKey);
      if (!sec) return reject("Section not found");
      sec.resolutionStatus = "unreviewed";
      sec.resolutionMode = "not_applicable";
      sec.resolvedAt = null;
      sec.resolvedBy = null;
      sec.requiresRevisitAfterReturn = false;
      sec.eligibleForAssemblyCompletion = false;
      if (updated.sessionStatus === "returned_to_preparation") {
        updated.sessionStatus = "assembly_in_progress";
        updated.assemblyPhase = "input_resolution";
      }
      events.push(makeEvent("dispatch_draft_section_reopened_after_preparation_return", `Section ${payload.sectionKey} reopened`));
      break;
    }

    case "mark_internal_exclusion_guard_checked": {
      const sec = findSection("internal_exclusion_guard");
      if (!sec) return reject("Internal exclusion guard section not found");
      if (sec.remainingMissingInputs.length > 0) return reject("Contamination risk 남아 있어 guard check 불가");
      sec.resolutionStatus = "reviewed_complete";
      sec.resolutionMode = "guard_recheck";
      sec.resolvedAt = now;
      sec.resolvedBy = payload.actor;
      sec.resolutionReason = "Internal exclusion guard checked";
      sec.eligibleForAssemblyCompletion = true;
      sec.evidenceNote = `Guard checked at ${now} by ${payload.actor}`;
      markDependentsForRevisit("internal_exclusion_guard");
      events.push(makeEvent("dispatch_draft_internal_exclusion_guard_checked", "Internal exclusion guard checked"));
      break;
    }

    case "run_assembly_completion_check": {
      updated.assemblyPhase = "completion_check";
      updated.completionGateState = recomputeCompletionGate(updated.sectionResolutionStates);
      events.push(makeEvent("dispatch_draft_assembly_completion_check_run", `Completion: ${updated.completionGateState.completionStatus}`));
      break;
    }

    case "mark_draft_assembly_complete": {
      updated.completionGateState = recomputeCompletionGate(updated.sectionResolutionStates);
      if (!updated.completionGateState.completionAllowed) {
        return reject(`Assembly complete 불가: ${updated.completionGateState.completionBlockers.join("; ")}`);
      }
      updated.sessionStatus = "assembly_complete_pending_validation";
      updated.assemblyPhase = "pending_validation";
      updated.completionGateState.completionStatus = "completed_pending_validation";
      updated.completionGateState.completionReason = "Draft assembly complete — validation gate pending (Batch 1: send locked)";
      updated.completionGateState.nextGateStatus = "pending_validation_gate";
      events.push(makeEvent("dispatch_draft_assembly_marked_complete_pending_validation", "Assembly marked complete — pending validation"));
      break;
    }

    default:
      return reject(`Unknown action: ${payload.action}`);
  }

  // Recompute completion gate after every mutation
  updated.completionGateState = recomputeCompletionGate(updated.sectionResolutionStates);

  return {
    applied: true,
    rejectedReasonIfAny: null,
    updatedAssemblySession: updated,
    updatedWorkspaceStatusIfAny: updated.sessionStatus === "returned_to_preparation" ? "assembly_hold" : null,
    recomputeRequired: true,
    emittedEvents: events,
  };
}
