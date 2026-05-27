/**
 * Dispatch Preparation Review Resolution v2 Engine — action → canonical mutation → audit
 *
 * 고정 규칙:
 * 1. source package truth = DispatchPreparationHandoffPackageV2
 * 2. case status truth = DispatchPreparationCaseV2
 * 3. review execution truth = DispatchPreparationReviewSessionV2
 * 4. section resolution truth = DispatchPreparationSectionResolutionStateV2
 * 5. workbench/center = projection of above truths
 * 6. completion ≠ send enablement. completion = review complete only.
 * 7. Batch 1: draft/send/dispatched mutation 전부 금지.
 * 8. mutation → recompute → reprojection 순서 강제.
 */

import type { DispatchPrepSectionKey } from "./dispatch-preparation-workbench-v2-engine";
import type { DecisionSectionKey, CenterWorkWindowTransitionEvent } from "./dispatch-preparation-center-work-window-v2";

// ══════════════════════════════════════════════
// Review Session
// ══════════════════════════════════════════════

export type ReviewSessionStatus = "review_open" | "review_in_progress" | "correction_routed" | "returned_to_prior_stage" | "review_complete_pending_next_gate" | "review_locked";

export type ReviewPhase = "blocker_resolution" | "section_review" | "completion_check" | "pending_next_gate";

export interface DispatchPreparationReviewSessionV2 {
  reviewSessionId: string;
  caseId: string;
  handoffPackageId: string;
  sessionStatus: ReviewSessionStatus;
  reviewPhase: ReviewPhase;
  openedAt: string;
  lastUpdatedAt: string;
  openedBy: string;
  activeSectionKey: DecisionSectionKey | null;
  operatorFocusOrder: DecisionSectionKey[];
  sectionResolutionStates: DispatchPreparationSectionResolutionStateV2[];
  completionGateState: DispatchPreparationCompletionGateStateV2;
  correctionHistory: CorrectionRouteRecord[];
  returnHistory: ReturnRecord[];
  auditEventRefs: string[];
  provenance: string;
}

// ══════════════════════════════════════════════
// Section Resolution State
// ══════════════════════════════════════════════

export type SectionResolutionStatus = "unreviewed" | "in_review" | "resolved_in_place" | "routed_to_correction" | "returned_to_prior_stage" | "reviewed_with_warning" | "blocked_unresolved";

export type SectionResolutionMode = "in_place" | "correction_route" | "prior_stage_return" | "warning_acknowledged" | "not_applicable";

export interface DispatchPreparationSectionResolutionStateV2 {
  sectionKey: DecisionSectionKey;
  resolutionStatus: SectionResolutionStatus;
  resolutionMode: SectionResolutionMode;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionReason: string;
  remainingBlockers: string[];
  remainingWarnings: string[];
  correctionRouteIfAny: string | null;
  requiresRevisitAfterReturn: boolean;
  eligibleForCompletion: boolean;
  evidenceNote: string;
  sourceSnapshotRef: string;
}

// ══════════════════════════════════════════════
// Completion Gate State
// ══════════════════════════════════════════════

export type CompletionStatus = "not_ready" | "needs_review" | "ready_for_completion" | "completed_pending_next_gate";
export type NextGateStatus = "locked" | "pending_enablement";
export type SendEnablementStatus = "disabled";

export interface DispatchPreparationCompletionGateStateV2 {
  completionStatus: CompletionStatus;
  requiredSectionsTotal: number;
  sectionsCompletionReady: number;
  unresolvedBlockerSections: DecisionSectionKey[];
  warningOnlySections: DecisionSectionKey[];
  completionBlockers: string[];
  completionAllowed: boolean;
  completionReason: string;
  nextGateStatus: NextGateStatus;
  sendEnablementStatus: SendEnablementStatus;
}

// ══════════════════════════════════════════════
// Correction / Return Records
// ══════════════════════════════════════════════

export interface CorrectionRouteRecord {
  routeKey: string;
  triggerSectionKey: DecisionSectionKey;
  triggerReason: string;
  routedAt: string;
  routedBy: string;
  requiresCaseStatusChange: boolean;
  expectedReturnGate: string;
  reopenRequirements: DecisionSectionKey[];
}

export interface ReturnRecord {
  returnedAt: string;
  returnedBy: string;
  returnReason: string;
  targetStage: string;
  affectedSections: DecisionSectionKey[];
}

// ══════════════════════════════════════════════
// Action Types
// ══════════════════════════════════════════════

export type ReviewAction =
  | "open_review_session"
  | "set_active_section"
  | "mark_section_in_review"
  | "resolve_section_in_place"
  | "acknowledge_section_warning"
  | "route_section_to_correction"
  | "return_case_to_prior_stage"
  | "reopen_section_after_return"
  | "mark_section_reviewed"
  | "run_completion_eligibility_check"
  | "mark_preparation_review_complete";

export type ForbiddenAction = "generate_dispatch_draft" | "send_to_supplier" | "mark_dispatched" | "finalize_attachment_visibility_for_send";

export interface ReviewActionPayload {
  action: ReviewAction;
  sectionKey?: DecisionSectionKey;
  reason?: string;
  actor: string;
  timestamp: string;
  correctionRouteKey?: string;
  returnTarget?: string;
}

// ══════════════════════════════════════════════
// Mutation Result
// ══════════════════════════════════════════════

export interface DispatchPreparationMutationResultV2 {
  applied: boolean;
  rejectedReasonIfAny: string | null;
  updatedReviewSession: DispatchPreparationReviewSessionV2;
  updatedCaseStatusIfAny: string | null;
  recomputeRequired: boolean;
  emittedEvents: ReviewAuditEvent[];
}

// ══════════════════════════════════════════════
// Audit Events
// ══════════════════════════════════════════════

export type ReviewAuditEventType =
  | "dispatch_prep_review_session_opened"
  | "dispatch_prep_section_review_started"
  | "dispatch_prep_section_resolved_in_place"
  | "dispatch_prep_section_warning_acknowledged"
  | "dispatch_prep_section_routed_to_correction"
  | "dispatch_prep_case_returned_to_prior_stage"
  | "dispatch_prep_section_reopened_after_return"
  | "dispatch_prep_completion_check_run"
  | "dispatch_prep_review_marked_complete_pending_next_gate"
  | "dispatch_prep_mutation_rejected";

export interface ReviewAuditEvent {
  type: ReviewAuditEventType;
  caseId: string;
  reviewSessionId: string;
  handoffPackageId: string;
  sectionKeyIfAny: DecisionSectionKey | null;
  actionKey: ReviewAction | ForbiddenAction;
  reason: string;
  actor: string;
  timestamp: string;
}

// ══════════════════════════════════════════════
// Section Dependencies
// ══════════════════════════════════════════════

const SECTION_DEPENDENCIES: Record<DecisionSectionKey, DecisionSectionKey[]> = {
  vendor_contact: ["reference_visibility"],
  internal_separation: ["reference_visibility", "completion_gate_review"],
  reference_visibility: ["completion_gate_review"],
  shipment_and_receiving_instruction: ["prep_intake"],
  prep_intake: [],
  completion_gate_review: [],
};

function getDependentSections(sectionKey: DecisionSectionKey): DecisionSectionKey[] {
  return SECTION_DEPENDENCIES[sectionKey] || [];
}

// ══════════════════════════════════════════════
// Completion Gate Recompute
// ══════════════════════════════════════════════

function recomputeCompletionGate(sections: DispatchPreparationSectionResolutionStateV2[]): DispatchPreparationCompletionGateStateV2 {
  const total = sections.length;
  const completionReady = sections.filter(s => s.eligibleForCompletion).length;
  const unresolvedBlockers = sections.filter(s => s.resolutionStatus === "blocked_unresolved" || s.remainingBlockers.length > 0).map(s => s.sectionKey);
  const warningOnly = sections.filter(s => s.resolutionStatus === "reviewed_with_warning" && s.remainingBlockers.length === 0).map(s => s.sectionKey);
  const blockers = unresolvedBlockers.map(k => `Section ${k}: unresolved blocker`);

  const completionAllowed = unresolvedBlockers.length === 0 && sections.every(s => s.resolutionStatus !== "unreviewed" && s.resolutionStatus !== "in_review");

  const completionStatus: CompletionStatus =
    completionAllowed ? "ready_for_completion"
    : unresolvedBlockers.length > 0 ? "not_ready"
    : "needs_review";

  return {
    completionStatus,
    requiredSectionsTotal: total,
    sectionsCompletionReady: completionReady,
    unresolvedBlockerSections: unresolvedBlockers,
    warningOnlySections: warningOnly,
    completionBlockers: blockers,
    completionAllowed,
    completionReason: completionAllowed ? "모든 required section 해소됨 — review complete 가능" : "미해소 blocker 또는 미검토 section 존재",
    nextGateStatus: "locked",
    sendEnablementStatus: "disabled",
  };
}

// ══════════════════════════════════════════════
// Initial Session Builder
// ══════════════════════════════════════════════

const ALL_SECTIONS: DecisionSectionKey[] = ["vendor_contact", "internal_separation", "reference_visibility", "shipment_and_receiving_instruction", "prep_intake", "completion_gate_review"];

export function createInitialReviewSession(caseId: string, handoffPackageId: string, actor: string): DispatchPreparationReviewSessionV2 {
  const now = new Date().toISOString();

  const sectionStates: DispatchPreparationSectionResolutionStateV2[] = ALL_SECTIONS.map(key => ({
    sectionKey: key,
    resolutionStatus: "unreviewed",
    resolutionMode: "not_applicable",
    resolvedAt: null,
    resolvedBy: null,
    resolutionReason: "",
    remainingBlockers: [],
    remainingWarnings: [],
    correctionRouteIfAny: null,
    requiresRevisitAfterReturn: false,
    eligibleForCompletion: false,
    evidenceNote: "",
    sourceSnapshotRef: handoffPackageId,
  }));

  const completionGate = recomputeCompletionGate(sectionStates);

  return {
    reviewSessionId: `dsprvsn_${Date.now().toString(36)}`,
    caseId,
    handoffPackageId,
    sessionStatus: "review_open",
    reviewPhase: "blocker_resolution",
    openedAt: now,
    lastUpdatedAt: now,
    openedBy: actor,
    activeSectionKey: null,
    operatorFocusOrder: [...ALL_SECTIONS],
    sectionResolutionStates: sectionStates,
    completionGateState: completionGate,
    correctionHistory: [],
    returnHistory: [],
    auditEventRefs: [],
    provenance: handoffPackageId,
  };
}

// ══════════════════════════════════════════════
// Apply Mutation
// ══════════════════════════════════════════════

export function applyReviewMutation(
  session: DispatchPreparationReviewSessionV2,
  payload: ReviewActionPayload,
): DispatchPreparationMutationResultV2 {
  const now = payload.timestamp;
  const events: ReviewAuditEvent[] = [];

  const makeEvent = (type: ReviewAuditEventType, reason: string): ReviewAuditEvent => ({
    type, caseId: session.caseId, reviewSessionId: session.reviewSessionId, handoffPackageId: session.handoffPackageId,
    sectionKeyIfAny: payload.sectionKey ?? null, actionKey: payload.action, reason, actor: payload.actor, timestamp: now,
  });

  const reject = (reason: string): DispatchPreparationMutationResultV2 => {
    events.push(makeEvent("dispatch_prep_mutation_rejected", reason));
    return { applied: false, rejectedReasonIfAny: reason, updatedReviewSession: session, updatedCaseStatusIfAny: null, recomputeRequired: false, emittedEvents: events };
  };

  let updated = { ...session, lastUpdatedAt: now, sectionResolutionStates: [...session.sectionResolutionStates.map(s => ({ ...s }))] };

  const findSection = (key: DecisionSectionKey) => updated.sectionResolutionStates.find(s => s.sectionKey === key);
  const markDependentsForRevisit = (key: DecisionSectionKey) => {
    for (const depKey of getDependentSections(key)) {
      const dep = findSection(depKey);
      if (dep && dep.resolutionStatus !== "unreviewed") {
        dep.requiresRevisitAfterReturn = true;
      }
    }
  };

  switch (payload.action) {
    case "open_review_session": {
      updated.sessionStatus = "review_open";
      updated.reviewPhase = "blocker_resolution";
      events.push(makeEvent("dispatch_prep_review_session_opened", "Review session opened"));
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
      updated.sessionStatus = "review_in_progress";
      updated.reviewPhase = "section_review";
      events.push(makeEvent("dispatch_prep_section_review_started", `Section ${payload.sectionKey} review started`));
      break;
    }

    case "resolve_section_in_place": {
      if (!payload.sectionKey) return reject("Section key 필수");
      const sec = findSection(payload.sectionKey);
      if (!sec) return reject("Section not found");
      if (sec.remainingBlockers.length > 0) return reject("Blocker가 남아 있어 in-place resolve 불가");
      sec.resolutionStatus = "resolved_in_place";
      sec.resolutionMode = "in_place";
      sec.resolvedAt = now;
      sec.resolvedBy = payload.actor;
      sec.resolutionReason = payload.reason || "In-place resolution";
      sec.eligibleForCompletion = true;
      sec.requiresRevisitAfterReturn = false;
      markDependentsForRevisit(payload.sectionKey);
      events.push(makeEvent("dispatch_prep_section_resolved_in_place", `Section ${payload.sectionKey} resolved in place`));
      break;
    }

    case "acknowledge_section_warning": {
      if (!payload.sectionKey) return reject("Section key 필수");
      const sec = findSection(payload.sectionKey);
      if (!sec) return reject("Section not found");
      if (sec.remainingBlockers.length > 0) return reject("Blocker가 남아 있어 warning acknowledgement 불가");
      sec.resolutionStatus = "reviewed_with_warning";
      sec.resolutionMode = "warning_acknowledged";
      sec.resolvedAt = now;
      sec.resolvedBy = payload.actor;
      sec.resolutionReason = payload.reason || "Warning acknowledged";
      sec.eligibleForCompletion = true;
      events.push(makeEvent("dispatch_prep_section_warning_acknowledged", `Section ${payload.sectionKey} warning acknowledged`));
      break;
    }

    case "route_section_to_correction": {
      if (!payload.sectionKey) return reject("Section key 필수");
      if (!payload.correctionRouteKey) return reject("Correction route key 필수");
      const sec = findSection(payload.sectionKey);
      if (!sec) return reject("Section not found");
      sec.resolutionStatus = "routed_to_correction";
      sec.resolutionMode = "correction_route";
      sec.correctionRouteIfAny = payload.correctionRouteKey;
      sec.requiresRevisitAfterReturn = true;
      sec.eligibleForCompletion = false;
      updated.sessionStatus = "correction_routed";
      markDependentsForRevisit(payload.sectionKey);
      updated.correctionHistory.push({
        routeKey: payload.correctionRouteKey,
        triggerSectionKey: payload.sectionKey,
        triggerReason: payload.reason || "Correction required",
        routedAt: now,
        routedBy: payload.actor,
        requiresCaseStatusChange: true,
        expectedReturnGate: "dispatch_preparation_handoff_gate",
        reopenRequirements: [payload.sectionKey, ...getDependentSections(payload.sectionKey)],
      });
      events.push(makeEvent("dispatch_prep_section_routed_to_correction", `Section ${payload.sectionKey} routed to ${payload.correctionRouteKey}`));
      break;
    }

    case "return_case_to_prior_stage": {
      if (!payload.returnTarget) return reject("Return target 필수");
      updated.sessionStatus = "returned_to_prior_stage";
      updated.reviewPhase = "blocker_resolution";
      const affectedSections = ALL_SECTIONS.filter(k => {
        const s = findSection(k);
        return s && s.resolutionStatus !== "unreviewed";
      });
      updated.returnHistory.push({
        returnedAt: now,
        returnedBy: payload.actor,
        returnReason: payload.reason || "Prior stage return",
        targetStage: payload.returnTarget,
        affectedSections,
      });
      events.push(makeEvent("dispatch_prep_case_returned_to_prior_stage", `Case returned to ${payload.returnTarget}`));
      break;
    }

    case "reopen_section_after_return": {
      if (!payload.sectionKey) return reject("Section key 필수");
      const sec = findSection(payload.sectionKey);
      if (!sec) return reject("Section not found");
      sec.resolutionStatus = "unreviewed";
      sec.resolutionMode = "not_applicable";
      sec.resolvedAt = null;
      sec.resolvedBy = null;
      sec.requiresRevisitAfterReturn = false;
      sec.eligibleForCompletion = false;
      if (updated.sessionStatus === "returned_to_prior_stage" || updated.sessionStatus === "correction_routed") {
        updated.sessionStatus = "review_in_progress";
        updated.reviewPhase = "section_review";
      }
      events.push(makeEvent("dispatch_prep_section_reopened_after_return", `Section ${payload.sectionKey} reopened after return`));
      break;
    }

    case "mark_section_reviewed": {
      if (!payload.sectionKey) return reject("Section key 필수");
      const sec = findSection(payload.sectionKey);
      if (!sec) return reject("Section not found");
      if (sec.remainingBlockers.length > 0) return reject("Blocker가 남아 있어 reviewed 처리 불가");
      if (sec.resolutionStatus === "unreviewed") return reject("먼저 review 시작 필요");
      sec.eligibleForCompletion = true;
      if (sec.resolutionStatus === "in_review") {
        sec.resolutionStatus = sec.remainingWarnings.length > 0 ? "reviewed_with_warning" : "resolved_in_place";
        sec.resolutionMode = sec.remainingWarnings.length > 0 ? "warning_acknowledged" : "in_place";
        sec.resolvedAt = now;
        sec.resolvedBy = payload.actor;
      }
      break;
    }

    case "run_completion_eligibility_check": {
      updated.reviewPhase = "completion_check";
      updated.completionGateState = recomputeCompletionGate(updated.sectionResolutionStates);
      events.push(makeEvent("dispatch_prep_completion_check_run", `Completion eligibility: ${updated.completionGateState.completionStatus}`));
      break;
    }

    case "mark_preparation_review_complete": {
      updated.completionGateState = recomputeCompletionGate(updated.sectionResolutionStates);
      if (!updated.completionGateState.completionAllowed) {
        return reject(`Completion 불가: ${updated.completionGateState.completionBlockers.join("; ")}`);
      }
      updated.sessionStatus = "review_complete_pending_next_gate";
      updated.reviewPhase = "pending_next_gate";
      updated.completionGateState.completionStatus = "completed_pending_next_gate";
      updated.completionGateState.completionReason = "Preparation review complete — dispatch drafting remains locked (Batch 1)";
      events.push(makeEvent("dispatch_prep_review_marked_complete_pending_next_gate", "Review marked complete — pending next gate"));
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
    updatedReviewSession: updated,
    updatedCaseStatusIfAny: updated.sessionStatus === "correction_routed" ? "on_hold" : updated.sessionStatus === "returned_to_prior_stage" ? "on_hold" : null,
    recomputeRequired: true,
    emittedEvents: events,
  };
}
