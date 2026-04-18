/**
 * Dispatch Draft Validation Resolution v2 Engine — action → canonical mutation → audit
 *
 * 고정 규칙:
 * 1. DispatchDraftValidationGateV2 = compute truth, ValidationSessionV2 = execution truth.
 * 2. rule resolution truth = DispatchDraftValidationRuleResolutionStateV2.
 * 3. validation outcome truth = DispatchDraftValidationOutcomeStateV2.
 * 4. validation pass ≠ send gate open ≠ send enablement.
 * 5. Batch 1: send confirmation / final draft / dispatched 전부 금지.
 * 6. rework 후 자동 pass 금지 — dependency revalidation 강제.
 * 7. mutation → recompute → reprojection 순서 강제.
 */

import type { ValidationRuleKey, DraftValidationGateStatus } from "./dispatch-draft-validation-gate-v2-engine";

// ══════════════════════════════════════════════
// Validation Session
// ══════════════════════════════════════════════

export type ValidationSessionStatus = "validation_open" | "validation_in_review" | "rework_routed" | "validation_failed_rework_required" | "validation_passed_pending_send_gate" | "validation_locked";

export type ValidationSessionPhase = "rule_review" | "warning_adjudication" | "rework_routing" | "outcome_check" | "pending_send_gate";

export interface DispatchDraftValidationSessionV2 {
  validationSessionId: string;
  validationGateId: string;
  caseId: string;
  handoffPackageId: string;
  assemblySessionId: string;
  sessionStatus: ValidationSessionStatus;
  validationPhase: ValidationSessionPhase;
  openedAt: string;
  lastUpdatedAt: string;
  openedBy: string;
  activeRuleKey: ValidationRuleKey | null;
  ruleResolutionStates: DispatchDraftValidationRuleResolutionStateV2[];
  outcomeState: DispatchDraftValidationOutcomeStateV2;
  reworkHistory: ValidationReworkRecord[];
  reopenHistory: ValidationReopenRecord[];
  auditEventRefs: string[];
  provenance: string;
}

// ══════════════════════════════════════════════
// Rule Resolution State
// ══════════════════════════════════════════════

export type RuleResolutionStatus = "unreviewed" | "in_review" | "accepted_pass" | "accepted_warning" | "rework_required" | "blocked_unresolved" | "reviewed_complete";

export type RuleResolutionMode = "pass_accept" | "warning_acknowledged" | "route_to_rework" | "policy_hold" | "not_applicable";

export interface DispatchDraftValidationRuleResolutionStateV2 {
  ruleKey: ValidationRuleKey;
  computedResultStatus: string;
  resolutionStatus: RuleResolutionStatus;
  resolutionMode: RuleResolutionMode;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionReason: string;
  reworkRouteIfAny: string | null;
  requiresRevalidationAfterRework: boolean;
  eligibleForValidationPass: boolean;
  remainingIssueSummary: string;
  sourceSnapshotRef: string;
  evidenceNote: string;
}

// ══════════════════════════════════════════════
// Validation Outcome State
// ══════════════════════════════════════════════

export type ValidationOutcomeStatus = "not_ready" | "needs_rule_review" | "rework_required" | "ready_for_pass_decision" | "passed_pending_send_gate";
export type ValidationNextGateStatus = "locked" | "pending_send_gate_compute";
export type ValidationPolicyHoldStatus = "off" | "active";

export interface DispatchDraftValidationOutcomeStateV2 {
  outcomeStatus: ValidationOutcomeStatus;
  requiredRulesTotal: number;
  rulesPassReady: number;
  failedRuleKeys: ValidationRuleKey[];
  warningRuleKeys: ValidationRuleKey[];
  reworkOpenRuleKeys: ValidationRuleKey[];
  outcomeAllowed: boolean;
  outcomeReason: string;
  nextGateStatus: ValidationNextGateStatus;
  sendEnablementStatus: "disabled";
  policyHoldStatus: ValidationPolicyHoldStatus;
}

// ══════════════════════════════════════════════
// Rework / Reopen Records
// ══════════════════════════════════════════════

export interface ValidationReworkRecord {
  routeKey: string;
  triggerRuleKey: ValidationRuleKey;
  triggerReason: string;
  routedAt: string;
  routedBy: string;
  requiresPriorSurfaceReturn: boolean;
  expectedReentrySurface: string;
  revalidationRequirements: ValidationRuleKey[];
}

export interface ValidationReopenRecord {
  ruleKey: ValidationRuleKey;
  reopenedAt: string;
  reopenedBy: string;
  reopenReason: string;
}

// ══════════════════════════════════════════════
// Action Types
// ══════════════════════════════════════════════

export type ValidationAction =
  | "open_validation_session"
  | "set_active_rule"
  | "mark_rule_in_review"
  | "accept_pass_rule"
  | "acknowledge_warning_rule"
  | "route_rule_to_rework"
  | "reopen_rule_after_rework"
  | "run_validation_outcome_check"
  | "mark_validation_failed_rework_required"
  | "mark_validation_passed_pending_send_gate"
  | "hold_validation_for_policy_review";

export type ForbiddenValidationAction = "open_send_confirmation_gate" | "generate_final_vendor_dispatch_draft" | "freeze_send_package" | "send_to_supplier" | "mark_dispatched";

export interface ValidationActionPayload {
  action: ValidationAction;
  ruleKey?: ValidationRuleKey;
  reason?: string;
  reworkRouteKey?: string;
  actor: string;
  timestamp: string;
}

// ══════════════════════════════════════════════
// Mutation Result
// ══════════════════════════════════════════════

export interface DispatchDraftValidationMutationResultV2 {
  applied: boolean;
  rejectedReasonIfAny: string | null;
  updatedValidationSession: DispatchDraftValidationSessionV2;
  updatedValidationGateIfAny: string | null;
  recomputeRequired: boolean;
  emittedEvents: ValidationAuditEvent[];
}

// ══════════════════════════════════════════════
// Audit Events
// ══════════════════════════════════════════════

export type ValidationAuditEventType =
  | "dispatch_draft_validation_session_opened"
  | "dispatch_draft_validation_rule_review_started"
  | "dispatch_draft_validation_rule_pass_accepted"
  | "dispatch_draft_validation_rule_warning_acknowledged"
  | "dispatch_draft_validation_rule_routed_to_rework"
  | "dispatch_draft_validation_rule_reopened_after_rework"
  | "dispatch_draft_validation_outcome_check_run"
  | "dispatch_draft_validation_marked_failed_rework_required"
  | "dispatch_draft_validation_marked_passed_pending_send_gate"
  | "dispatch_draft_validation_mutation_rejected";

export interface ValidationAuditEvent {
  type: ValidationAuditEventType;
  caseId: string;
  validationSessionId: string;
  validationGateId: string;
  assemblySessionId: string;
  ruleKeyIfAny: ValidationRuleKey | null;
  actionKey: ValidationAction | ForbiddenValidationAction;
  reason: string;
  actor: string;
  timestamp: string;
}

// ══════════════════════════════════════════════
// Rule Dependencies
// ══════════════════════════════════════════════

const RULE_DEPENDENCIES: Partial<Record<ValidationRuleKey, ValidationRuleKey[]>> = {
  vendor_recipient_complete: ["dispatch_scope_consistent", "mandatory_references_present"],
  mandatory_references_present: ["reference_visibility_consistent"],
  instruction_visibility_consistent: ["supplier_facing_contamination_not_detected"],
  internal_exclusion_guard_confirmed: ["supplier_facing_contamination_not_detected"],
  no_open_return_to_preparation_dependency: [],
};

function getDependentRules(ruleKey: ValidationRuleKey): ValidationRuleKey[] {
  return RULE_DEPENDENCIES[ruleKey] || [];
}

// ══════════════════════════════════════════════
// Outcome Recompute
// ══════════════════════════════════════════════

function recomputeOutcome(rules: DispatchDraftValidationRuleResolutionStateV2[]): DispatchDraftValidationOutcomeStateV2 {
  const total = rules.length;
  const passReady = rules.filter(r => r.eligibleForValidationPass).length;
  const failed = rules.filter(r => r.resolutionStatus === "rework_required" || r.resolutionStatus === "blocked_unresolved").map(r => r.ruleKey);
  const warnings = rules.filter(r => r.resolutionStatus === "accepted_warning").map(r => r.ruleKey);
  const reworkOpen = rules.filter(r => r.requiresRevalidationAfterRework).map(r => r.ruleKey);
  const unreviewed = rules.filter(r => r.resolutionStatus === "unreviewed" || r.resolutionStatus === "in_review");

  const allowed = failed.length === 0 && reworkOpen.length === 0 && unreviewed.length === 0;

  const status: ValidationOutcomeStatus =
    failed.length > 0 ? "rework_required"
    : reworkOpen.length > 0 ? "rework_required"
    : unreviewed.length > 0 ? "needs_rule_review"
    : allowed ? "ready_for_pass_decision"
    : "not_ready";

  return {
    outcomeStatus: status,
    requiredRulesTotal: total,
    rulesPassReady: passReady,
    failedRuleKeys: failed,
    warningRuleKeys: warnings,
    reworkOpenRuleKeys: reworkOpen,
    outcomeAllowed: allowed,
    outcomeReason: allowed ? "모든 rule pass/warning acknowledged — validation pass 가능" : "미해소 rule 존재",
    nextGateStatus: "locked",
    sendEnablementStatus: "disabled",
    policyHoldStatus: "off",
  };
}

// ══════════════════════════════════════════════
// Initial Session Builder
// ══════════════════════════════════════════════

import type { DispatchDraftValidationGateV2 } from "./dispatch-draft-validation-gate-v2-engine";

export function createInitialValidationSession(gate: DispatchDraftValidationGateV2, actor: string): DispatchDraftValidationSessionV2 {
  const now = new Date().toISOString();

  const ruleStates: DispatchDraftValidationRuleResolutionStateV2[] = gate.ruleResults.map(r => ({
    ruleKey: r.ruleKey,
    computedResultStatus: r.resultStatus,
    resolutionStatus: "unreviewed",
    resolutionMode: "not_applicable",
    resolvedAt: null,
    resolvedBy: null,
    resolutionReason: "",
    reworkRouteIfAny: r.reworkRouteIfAny,
    requiresRevalidationAfterRework: false,
    eligibleForValidationPass: false,
    remainingIssueSummary: r.reason,
    sourceSnapshotRef: gate.validationGateId,
    evidenceNote: "",
  }));

  return {
    validationSessionId: `dftvalsn_${Date.now().toString(36)}`,
    validationGateId: gate.validationGateId,
    caseId: gate.caseId,
    handoffPackageId: gate.handoffPackageId,
    assemblySessionId: gate.assemblySessionId,
    sessionStatus: "validation_open",
    validationPhase: "rule_review",
    openedAt: now,
    lastUpdatedAt: now,
    openedBy: actor,
    activeRuleKey: null,
    ruleResolutionStates: ruleStates,
    outcomeState: recomputeOutcome(ruleStates),
    reworkHistory: [],
    reopenHistory: [],
    auditEventRefs: [],
    provenance: gate.validationGateId,
  };
}

// ══════════════════════════════════════════════
// Apply Mutation
// ══════════════════════════════════════════════

export function applyValidationMutation(
  session: DispatchDraftValidationSessionV2,
  payload: ValidationActionPayload,
): DispatchDraftValidationMutationResultV2 {
  const now = payload.timestamp;
  const events: ValidationAuditEvent[] = [];

  const makeEvent = (type: ValidationAuditEventType, reason: string): ValidationAuditEvent => ({
    type, caseId: session.caseId, validationSessionId: session.validationSessionId,
    validationGateId: session.validationGateId, assemblySessionId: session.assemblySessionId,
    ruleKeyIfAny: payload.ruleKey ?? null, actionKey: payload.action, reason, actor: payload.actor, timestamp: now,
  });

  const reject = (reason: string): DispatchDraftValidationMutationResultV2 => {
    events.push(makeEvent("dispatch_draft_validation_mutation_rejected", reason));
    return { applied: false, rejectedReasonIfAny: reason, updatedValidationSession: session, updatedValidationGateIfAny: null, recomputeRequired: false, emittedEvents: events };
  };

  let updated = { ...session, lastUpdatedAt: now, ruleResolutionStates: session.ruleResolutionStates.map(r => ({ ...r })) };

  const findRule = (key: ValidationRuleKey) => updated.ruleResolutionStates.find(r => r.ruleKey === key);
  const markDependentsForRevalidation = (key: ValidationRuleKey) => {
    for (const depKey of getDependentRules(key)) {
      const dep = findRule(depKey);
      if (dep && dep.resolutionStatus !== "unreviewed") dep.requiresRevalidationAfterRework = true;
    }
  };

  switch (payload.action) {
    case "open_validation_session": {
      updated.sessionStatus = "validation_open";
      updated.validationPhase = "rule_review";
      events.push(makeEvent("dispatch_draft_validation_session_opened", "Validation session opened"));
      break;
    }

    case "set_active_rule": {
      if (!payload.ruleKey) return reject("Rule key 필수");
      updated.activeRuleKey = payload.ruleKey;
      break;
    }

    case "mark_rule_in_review": {
      if (!payload.ruleKey) return reject("Rule key 필수");
      const rule = findRule(payload.ruleKey);
      if (!rule) return reject("Rule not found");
      rule.resolutionStatus = "in_review";
      updated.sessionStatus = "validation_in_review";
      updated.validationPhase = "rule_review";
      events.push(makeEvent("dispatch_draft_validation_rule_review_started", `Rule ${payload.ruleKey} review started`));
      break;
    }

    case "accept_pass_rule": {
      if (!payload.ruleKey) return reject("Rule key 필수");
      const rule = findRule(payload.ruleKey);
      if (!rule) return reject("Rule not found");
      if (rule.computedResultStatus === "fail") return reject("Computed fail인 rule을 pass로 accept 불가");
      rule.resolutionStatus = "accepted_pass";
      rule.resolutionMode = "pass_accept";
      rule.resolvedAt = now;
      rule.resolvedBy = payload.actor;
      rule.resolutionReason = payload.reason || "Pass accepted";
      rule.eligibleForValidationPass = true;
      rule.requiresRevalidationAfterRework = false;
      events.push(makeEvent("dispatch_draft_validation_rule_pass_accepted", `Rule ${payload.ruleKey} pass accepted`));
      break;
    }

    case "acknowledge_warning_rule": {
      if (!payload.ruleKey) return reject("Rule key 필수");
      const rule = findRule(payload.ruleKey);
      if (!rule) return reject("Rule not found");
      if (rule.computedResultStatus === "fail") return reject("Computed fail인 rule을 warning acknowledged 불가");
      rule.resolutionStatus = "accepted_warning";
      rule.resolutionMode = "warning_acknowledged";
      rule.resolvedAt = now;
      rule.resolvedBy = payload.actor;
      rule.resolutionReason = payload.reason || "Warning acknowledged";
      rule.eligibleForValidationPass = true;
      events.push(makeEvent("dispatch_draft_validation_rule_warning_acknowledged", `Rule ${payload.ruleKey} warning acknowledged`));
      break;
    }

    case "route_rule_to_rework": {
      if (!payload.ruleKey) return reject("Rule key 필수");
      if (!payload.reworkRouteKey) return reject("Rework route key 필수");
      const rule = findRule(payload.ruleKey);
      if (!rule) return reject("Rule not found");
      rule.resolutionStatus = "rework_required";
      rule.resolutionMode = "route_to_rework";
      rule.reworkRouteIfAny = payload.reworkRouteKey;
      rule.requiresRevalidationAfterRework = true;
      rule.eligibleForValidationPass = false;
      updated.sessionStatus = "rework_routed";
      updated.validationPhase = "rework_routing";
      markDependentsForRevalidation(payload.ruleKey);
      const requiresPrior = payload.reworkRouteKey === "preparation_review_reopen" || payload.reworkRouteKey === "internal_exclusion_recheck";
      updated.reworkHistory.push({
        routeKey: payload.reworkRouteKey,
        triggerRuleKey: payload.ruleKey,
        triggerReason: payload.reason || "Rework required",
        routedAt: now,
        routedBy: payload.actor,
        requiresPriorSurfaceReturn: requiresPrior,
        expectedReentrySurface: requiresPrior ? "preparation_review" : "draft_assembly",
        revalidationRequirements: [payload.ruleKey, ...getDependentRules(payload.ruleKey)],
      });
      events.push(makeEvent("dispatch_draft_validation_rule_routed_to_rework", `Rule ${payload.ruleKey} routed to ${payload.reworkRouteKey}`));
      break;
    }

    case "reopen_rule_after_rework": {
      if (!payload.ruleKey) return reject("Rule key 필수");
      const rule = findRule(payload.ruleKey);
      if (!rule) return reject("Rule not found");
      rule.resolutionStatus = "unreviewed";
      rule.resolutionMode = "not_applicable";
      rule.resolvedAt = null;
      rule.resolvedBy = null;
      rule.requiresRevalidationAfterRework = false;
      rule.eligibleForValidationPass = false;
      if (updated.sessionStatus === "rework_routed") {
        updated.sessionStatus = "validation_in_review";
        updated.validationPhase = "rule_review";
      }
      updated.reopenHistory.push({ ruleKey: payload.ruleKey, reopenedAt: now, reopenedBy: payload.actor, reopenReason: payload.reason || "Reopened after rework" });
      events.push(makeEvent("dispatch_draft_validation_rule_reopened_after_rework", `Rule ${payload.ruleKey} reopened`));
      break;
    }

    case "run_validation_outcome_check": {
      updated.validationPhase = "outcome_check";
      updated.outcomeState = recomputeOutcome(updated.ruleResolutionStates);
      events.push(makeEvent("dispatch_draft_validation_outcome_check_run", `Outcome: ${updated.outcomeState.outcomeStatus}`));
      break;
    }

    case "mark_validation_failed_rework_required": {
      updated.sessionStatus = "validation_failed_rework_required";
      updated.validationPhase = "rework_routing";
      events.push(makeEvent("dispatch_draft_validation_marked_failed_rework_required", "Validation marked failed — rework required"));
      break;
    }

    case "mark_validation_passed_pending_send_gate": {
      updated.outcomeState = recomputeOutcome(updated.ruleResolutionStates);
      if (!updated.outcomeState.outcomeAllowed) {
        return reject(`Validation pass 불가: failed=${updated.outcomeState.failedRuleKeys.join(",")}, rework=${updated.outcomeState.reworkOpenRuleKeys.join(",")}`);
      }
      updated.sessionStatus = "validation_passed_pending_send_gate";
      updated.validationPhase = "pending_send_gate";
      updated.outcomeState.outcomeStatus = "passed_pending_send_gate";
      updated.outcomeState.outcomeReason = "Validation passed — send gate pending (Batch 1: send locked)";
      updated.outcomeState.nextGateStatus = "pending_send_gate_compute";
      events.push(makeEvent("dispatch_draft_validation_marked_passed_pending_send_gate", "Validation passed — pending send gate"));
      break;
    }

    case "hold_validation_for_policy_review": {
      updated.sessionStatus = "validation_locked";
      updated.outcomeState.policyHoldStatus = "active";
      break;
    }

    default:
      return reject(`Unknown action: ${payload.action}`);
  }

  // Recompute outcome after every mutation
  updated.outcomeState = recomputeOutcome(updated.ruleResolutionStates);

  return {
    applied: true,
    rejectedReasonIfAny: null,
    updatedValidationSession: updated,
    updatedValidationGateIfAny: null,
    recomputeRequired: true,
    emittedEvents: events,
  };
}
