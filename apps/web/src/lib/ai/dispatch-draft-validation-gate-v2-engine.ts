/**
 * Dispatch Draft Validation Gate v2 Engine — assembly complete → validation pass/fail/rework
 *
 * 고정 규칙:
 * 1. DispatchDraftAssemblySessionV2 + CompletionGateState = 입력 source.
 * 2. assembly complete ≠ validation pass.
 * 3. validation pass ≠ send enablement.
 * 4. 10 validation rules 명시적 평가.
 * 5. fail → rework route 명시.
 * 6. Batch 1: send confirmation / final draft / dispatched 전부 금지.
 * 7. validation pass = "다음 send gate 계산 후보" 의미만.
 * 8. provenance + audit 강화.
 */

import type {
  DispatchDraftAssemblySessionV2,
  AssemblySessionStatus,
  DispatchDraftAssemblyCompletionGateStateV2,
  DispatchDraftSectionResolutionStateV2,
} from "./dispatch-draft-assembly-resolution-v2-engine";
import type { DraftAssemblySectionKey } from "./dispatch-draft-workspace-v2";

// ══════════════════════════════════════════════
// Gate Status / Phase
// ══════════════════════════════════════════════

export type DraftValidationGateStatus =
  | "not_ready_for_validation"
  | "validation_blocked"
  | "validation_in_review"
  | "validation_failed_rework_required"
  | "validation_passed_pending_send_gate"
  | "validation_locked_by_policy";

export type DraftValidationPhase = "precheck" | "rule_evaluation" | "result_compilation" | "pending_send_gate" | "policy_locked";

// ══════════════════════════════════════════════
// Validation Rule
// ══════════════════════════════════════════════

export type ValidationRuleKey =
  | "assembly_completion_confirmed"
  | "vendor_recipient_complete"
  | "dispatch_scope_consistent"
  | "mandatory_references_present"
  | "reference_visibility_consistent"
  | "instruction_visibility_consistent"
  | "internal_exclusion_guard_confirmed"
  | "no_open_return_to_preparation_dependency"
  | "no_unresolved_blocking_section"
  | "supplier_facing_contamination_not_detected";

export type ValidationRuleResultStatus = "pass" | "warning" | "fail" | "not_applicable" | "not_evaluated";
export type ValidationRuleSeverity = "hard_blocker" | "soft_blocker" | "warning" | "policy_lock";

export interface DispatchDraftValidationRuleResultV2 {
  ruleKey: ValidationRuleKey;
  label: string;
  resultStatus: ValidationRuleResultStatus;
  severity: ValidationRuleSeverity;
  reason: string;
  derivedFrom: string;
  reworkRouteIfAny: string | null;
}

// ══════════════════════════════════════════════
// Validation Candidate
// ══════════════════════════════════════════════

export type ValidationCandidateStatus = "not_candidate" | "candidate_blocked" | "candidate_needs_rework" | "candidate_ready_for_validation" | "candidate_policy_locked";

export interface DispatchDraftValidationCandidateV2 {
  candidateStatus: ValidationCandidateStatus;
  candidateReason: string;
  originAssemblyStatus: AssemblySessionStatus;
  completionStatus: string;
  fieldCompletenessSnapshot: string;
  scopeConsistencySnapshot: string;
  referenceVisibilitySnapshot: string;
  instructionVisibilitySnapshot: string;
  internalExclusionGuardSnapshot: string;
  contactReadinessSnapshot: string;
  canRunValidationRules: boolean;
  requiresReworkBeforeValidation: boolean;
  requiresPolicyReview: boolean;
}

// ══════════════════════════════════════════════
// Blocker / Warning Summary
// ══════════════════════════════════════════════

export interface DispatchDraftValidationBlockerSummaryV2 {
  blockers: string[];
  count: number;
  primaryBlocker: string | null;
}

export interface DispatchDraftValidationWarningSummaryV2 {
  warnings: string[];
  count: number;
  primaryWarning: string | null;
}

// ══════════════════════════════════════════════
// Action Gate
// ══════════════════════════════════════════════

export interface DispatchDraftValidationActionGateV2 {
  canRunValidation: boolean;
  canReopenDraftAssembly: boolean;
  canReturnToPreparationReview: boolean;
  canHoldForPolicyReview: boolean;
  canMarkValidationPassed: boolean;
  canMarkValidationFailedReworkRequired: boolean;
  // Batch 1 — explicitly forbidden
  canOpenSendConfirmationGate: false;
  canGenerateFinalVendorDispatchDraft: false;
  canSendToSupplier: false;
  canMarkDispatched: false;
  disabledActionReasons: Record<string, string>;
}

// ══════════════════════════════════════════════
// Rework Route
// ══════════════════════════════════════════════

export interface ValidationReworkRoute {
  reworkRouteKey: string;
  routeReason: string;
  sourceRuleKey: ValidationRuleKey;
  requiresPriorSurfaceReturn: boolean;
  reopenSectionKeys: DraftAssemblySectionKey[];
}

// ══════════════════════════════════════════════
// Provenance
// ══════════════════════════════════════════════

export interface DispatchDraftValidationProvenanceV2 {
  derivedFromAssemblySessionId: string;
  derivedFromCompletionGateVersion: string;
  derivedFromWorkspaceStateVersionIfAny: string;
  derivedFromRuleInputSnapshotRefs: string[];
  derivedAt: string;
  derivedByEngineVersion: string;
  policyLockBasis: string;
  reworkBasis: string;
}

// ══════════════════════════════════════════════
// Top-Level Validation Gate
// ══════════════════════════════════════════════

export interface DispatchDraftValidationGateV2 {
  validationGateId: string;
  caseId: string;
  handoffPackageId: string;
  draftEnablementGateId: string;
  assemblySessionId: string;
  gateStatus: DraftValidationGateStatus;
  validationPhase: DraftValidationPhase;
  candidateStatus: ValidationCandidateStatus;
  candidate: DispatchDraftValidationCandidateV2;
  ruleResults: DispatchDraftValidationRuleResultV2[];
  blockerSummary: DispatchDraftValidationBlockerSummaryV2;
  warningSummary: DispatchDraftValidationWarningSummaryV2;
  actionGate: DispatchDraftValidationActionGateV2;
  requiredValidationRules: ValidationRuleKey[];
  failedValidationRules: ValidationRuleKey[];
  warningValidationRules: ValidationRuleKey[];
  reworkRoutes: ValidationReworkRoute[];
  sendEnablementStatus: "disabled";
  nextSurfaceLabel: string;
  provenance: DispatchDraftValidationProvenanceV2;
  generatedAt: string;
}

// ══════════════════════════════════════════════
// Rule Evaluation
// ══════════════════════════════════════════════

const RULE_LABELS: Record<ValidationRuleKey, string> = {
  assembly_completion_confirmed: "Assembly 완료 확인",
  vendor_recipient_complete: "Vendor 수신자 완결성",
  dispatch_scope_consistent: "Dispatch scope 정합성",
  mandatory_references_present: "필수 reference 존재",
  reference_visibility_consistent: "Reference visibility 정합성",
  instruction_visibility_consistent: "Instruction visibility 정합성",
  internal_exclusion_guard_confirmed: "Internal exclusion guard 확인",
  no_open_return_to_preparation_dependency: "Return-to-preparation dependency 없음",
  no_unresolved_blocking_section: "미해소 blocking section 없음",
  supplier_facing_contamination_not_detected: "Supplier-facing contamination 미감지",
};

function evaluateRules(session: DispatchDraftAssemblySessionV2): DispatchDraftValidationRuleResultV2[] {
  const sections = session.sectionResolutionStates;
  const results: DispatchDraftValidationRuleResultV2[] = [];

  const findSec = (key: DraftAssemblySectionKey) => sections.find(s => s.sectionKey === key);

  // 1. Assembly completion
  results.push({
    ruleKey: "assembly_completion_confirmed", label: RULE_LABELS["assembly_completion_confirmed"],
    resultStatus: session.sessionStatus === "assembly_complete_pending_validation" ? "pass" : "fail",
    severity: "hard_blocker", reason: session.sessionStatus !== "assembly_complete_pending_validation" ? `Session status: ${session.sessionStatus}` : "",
    derivedFrom: "session.sessionStatus", reworkRouteIfAny: session.sessionStatus !== "assembly_complete_pending_validation" ? "draft_assembly_rework" : null,
  });

  // 2. Vendor recipient
  const vendor = findSec("vendor_recipient_block");
  results.push({
    ruleKey: "vendor_recipient_complete", label: RULE_LABELS["vendor_recipient_complete"],
    resultStatus: vendor?.eligibleForAssemblyCompletion ? "pass" : "fail",
    severity: "hard_blocker", reason: !vendor?.eligibleForAssemblyCompletion ? "Vendor recipient block 미완료" : "",
    derivedFrom: "vendor_recipient_block", reworkRouteIfAny: !vendor?.eligibleForAssemblyCompletion ? "draft_assembly_rework" : null,
  });

  // 3. Dispatch scope
  const scope = findSec("dispatch_scope_block");
  results.push({
    ruleKey: "dispatch_scope_consistent", label: RULE_LABELS["dispatch_scope_consistent"],
    resultStatus: scope?.eligibleForAssemblyCompletion ? "pass" : scope?.remainingWarnings.length ? "warning" : "fail",
    severity: scope?.eligibleForAssemblyCompletion ? "warning" : "hard_blocker",
    reason: !scope?.eligibleForAssemblyCompletion ? "Scope block 미완료" : scope?.remainingWarnings.length ? scope.remainingWarnings[0] : "",
    derivedFrom: "dispatch_scope_block", reworkRouteIfAny: !scope?.eligibleForAssemblyCompletion ? "draft_assembly_rework" : null,
  });

  // 4. Mandatory references
  const ref = findSec("reference_and_attachment_block");
  results.push({
    ruleKey: "mandatory_references_present", label: RULE_LABELS["mandatory_references_present"],
    resultStatus: ref?.remainingMissingInputs.length === 0 ? "pass" : "fail",
    severity: "soft_blocker", reason: ref?.remainingMissingInputs.length ? `Missing: ${ref.remainingMissingInputs.join(", ")}` : "",
    derivedFrom: "reference_and_attachment_block", reworkRouteIfAny: ref?.remainingMissingInputs.length ? "reference_visibility_rework" : null,
  });

  // 5. Reference visibility
  results.push({
    ruleKey: "reference_visibility_consistent", label: RULE_LABELS["reference_visibility_consistent"],
    resultStatus: ref?.eligibleForAssemblyCompletion ? "pass" : ref?.remainingWarnings.length ? "warning" : "fail",
    severity: "warning", reason: ref?.remainingWarnings.length ? ref.remainingWarnings[0] : "",
    derivedFrom: "reference_and_attachment_block", reworkRouteIfAny: null,
  });

  // 6. Instruction visibility
  const instr = findSec("instruction_block");
  results.push({
    ruleKey: "instruction_visibility_consistent", label: RULE_LABELS["instruction_visibility_consistent"],
    resultStatus: instr?.eligibleForAssemblyCompletion ? "pass" : instr?.remainingWarnings.length ? "warning" : "fail",
    severity: instr?.remainingMissingInputs.length ? "hard_blocker" : "warning",
    reason: instr?.remainingMissingInputs.length ? `Missing: ${instr.remainingMissingInputs.join(", ")}` : instr?.remainingWarnings.length ? instr.remainingWarnings[0] : "",
    derivedFrom: "instruction_block", reworkRouteIfAny: instr?.remainingMissingInputs.length ? "instruction_visibility_rework" : null,
  });

  // 7. Internal exclusion guard
  const guard = findSec("internal_exclusion_guard");
  const guardConfirmed = guard?.resolutionStatus === "reviewed_complete" && guard?.resolutionMode === "guard_recheck";
  results.push({
    ruleKey: "internal_exclusion_guard_confirmed", label: RULE_LABELS["internal_exclusion_guard_confirmed"],
    resultStatus: guardConfirmed ? "pass" : guard?.eligibleForAssemblyCompletion ? "warning" : "fail",
    severity: guardConfirmed ? "warning" : "hard_blocker",
    reason: !guard?.eligibleForAssemblyCompletion ? "Internal exclusion guard 미확인" : !guardConfirmed ? "Guard recheck 미완료" : "",
    derivedFrom: "internal_exclusion_guard", reworkRouteIfAny: !guard?.eligibleForAssemblyCompletion ? "internal_exclusion_recheck" : null,
  });

  // 8. No open return dependency
  const hasOpenReturn = sections.some(s => s.requiresRevisitAfterReturn);
  results.push({
    ruleKey: "no_open_return_to_preparation_dependency", label: RULE_LABELS["no_open_return_to_preparation_dependency"],
    resultStatus: !hasOpenReturn ? "pass" : "fail",
    severity: "hard_blocker", reason: hasOpenReturn ? "Return-to-preparation 재검토 미완료" : "",
    derivedFrom: "sectionResolutionStates", reworkRouteIfAny: hasOpenReturn ? "preparation_review_reopen" : null,
  });

  // 9. No unresolved blocking section
  const unresolvedBlocking = sections.filter(s => s.resolutionStatus === "blocked_unresolved" || s.resolutionStatus === "returned_to_preparation");
  results.push({
    ruleKey: "no_unresolved_blocking_section", label: RULE_LABELS["no_unresolved_blocking_section"],
    resultStatus: unresolvedBlocking.length === 0 ? "pass" : "fail",
    severity: "hard_blocker", reason: unresolvedBlocking.length > 0 ? `${unresolvedBlocking.length}건 blocking section` : "",
    derivedFrom: "sectionResolutionStates", reworkRouteIfAny: unresolvedBlocking.length > 0 ? "draft_assembly_rework" : null,
  });

  // 10. Supplier-facing contamination
  const contaminationRisk = guard?.remainingMissingInputs.some(m => m.toLowerCase().includes("contamination"));
  results.push({
    ruleKey: "supplier_facing_contamination_not_detected", label: RULE_LABELS["supplier_facing_contamination_not_detected"],
    resultStatus: !contaminationRisk ? "pass" : "fail",
    severity: "hard_blocker", reason: contaminationRisk ? "Supplier-facing contamination risk 감지" : "",
    derivedFrom: "internal_exclusion_guard", reworkRouteIfAny: contaminationRisk ? "internal_exclusion_recheck" : null,
  });

  return results;
}

// ══════════════════════════════════════════════
// Derivation Helpers
// ══════════════════════════════════════════════

function deriveCandidate(session: DispatchDraftAssemblySessionV2, rules: DispatchDraftValidationRuleResultV2[]): DispatchDraftValidationCandidateV2 {
  const isComplete = session.sessionStatus === "assembly_complete_pending_validation";
  const hasFail = rules.some(r => r.resultStatus === "fail");
  const hasWarning = rules.some(r => r.resultStatus === "warning");

  const status: ValidationCandidateStatus =
    !isComplete ? "not_candidate"
    : hasFail ? "candidate_needs_rework"
    : hasWarning ? "candidate_ready_for_validation"
    : "candidate_ready_for_validation";

  const sections = session.sectionResolutionStates;
  const findSnap = (key: DraftAssemblySectionKey) => sections.find(s => s.sectionKey === key)?.resolutionStatus || "unknown";

  return {
    candidateStatus: status,
    candidateReason: !isComplete ? "Assembly 미완료" : hasFail ? "Validation rule fail" : "Validation 가능",
    originAssemblyStatus: session.sessionStatus,
    completionStatus: session.completionGateState.completionStatus,
    fieldCompletenessSnapshot: `${sections.filter(s => s.eligibleForAssemblyCompletion).length}/${sections.length}`,
    scopeConsistencySnapshot: findSnap("dispatch_scope_block"),
    referenceVisibilitySnapshot: findSnap("reference_and_attachment_block"),
    instructionVisibilitySnapshot: findSnap("instruction_block"),
    internalExclusionGuardSnapshot: findSnap("internal_exclusion_guard"),
    contactReadinessSnapshot: findSnap("vendor_recipient_block"),
    canRunValidationRules: isComplete,
    requiresReworkBeforeValidation: hasFail,
    requiresPolicyReview: false,
  };
}

function deriveBlockerSummary(rules: DispatchDraftValidationRuleResultV2[]): DispatchDraftValidationBlockerSummaryV2 {
  const failed = rules.filter(r => r.resultStatus === "fail");
  const blockers = failed.map(r => r.reason || r.label);
  return { blockers, count: blockers.length, primaryBlocker: blockers[0] || null };
}

function deriveWarningSummary(rules: DispatchDraftValidationRuleResultV2[]): DispatchDraftValidationWarningSummaryV2 {
  const warned = rules.filter(r => r.resultStatus === "warning");
  const warnings = warned.map(r => r.reason || r.label);
  return { warnings, count: warnings.length, primaryWarning: warnings[0] || null };
}

function deriveReworkRoutes(rules: DispatchDraftValidationRuleResultV2[]): ValidationReworkRoute[] {
  const routes: ValidationReworkRoute[] = [];
  const seen = new Set<string>();

  for (const r of rules) {
    if (r.reworkRouteIfAny && !seen.has(r.reworkRouteIfAny)) {
      seen.add(r.reworkRouteIfAny);
      const requiresPrior = r.reworkRouteIfAny === "preparation_review_reopen" || r.reworkRouteIfAny === "internal_exclusion_recheck";
      routes.push({
        reworkRouteKey: r.reworkRouteIfAny,
        routeReason: r.reason,
        sourceRuleKey: r.ruleKey,
        requiresPriorSurfaceReturn: requiresPrior,
        reopenSectionKeys: [],
      });
    }
  }
  return routes;
}

function deriveActionGate(candidate: DispatchDraftValidationCandidateV2, hasFail: boolean): DispatchDraftValidationActionGateV2 {
  return {
    canRunValidation: candidate.canRunValidationRules,
    canReopenDraftAssembly: true,
    canReturnToPreparationReview: true,
    canHoldForPolicyReview: true,
    canMarkValidationPassed: candidate.candidateStatus === "candidate_ready_for_validation" && !hasFail,
    canMarkValidationFailedReworkRequired: hasFail,
    canOpenSendConfirmationGate: false as const,
    canGenerateFinalVendorDispatchDraft: false as const,
    canSendToSupplier: false as const,
    canMarkDispatched: false as const,
    disabledActionReasons: {
      open_send_confirmation_gate: "Batch 1 정책: send confirmation gate 진입 금지",
      generate_final_vendor_dispatch_draft: "Batch 1 정책: final vendor draft 생성 금지",
      send_to_supplier: "Batch 1 정책: supplier 발송 금지",
      mark_dispatched: "Batch 1 정책: dispatched 처리 금지",
    },
  };
}

function deriveGateStatus(candidate: DispatchDraftValidationCandidateV2, hasFail: boolean, hasWarning: boolean): DraftValidationGateStatus {
  if (candidate.candidateStatus === "not_candidate") return "not_ready_for_validation";
  if (candidate.candidateStatus === "candidate_blocked") return "validation_blocked";
  if (hasFail) return "validation_failed_rework_required";
  if (candidate.candidateStatus === "candidate_policy_locked") return "validation_locked_by_policy";
  return "validation_passed_pending_send_gate";
}

function derivePhase(gateStatus: DraftValidationGateStatus): DraftValidationPhase {
  switch (gateStatus) {
    case "not_ready_for_validation": return "precheck";
    case "validation_blocked": return "precheck";
    case "validation_in_review": return "rule_evaluation";
    case "validation_failed_rework_required": return "result_compilation";
    case "validation_passed_pending_send_gate": return "pending_send_gate";
    case "validation_locked_by_policy": return "policy_locked";
  }
}

// ══════════════════════════════════════════════
// Main Builder
// ══════════════════════════════════════════════

export function buildDispatchDraftValidationGateV2(session: DispatchDraftAssemblySessionV2): DispatchDraftValidationGateV2 {
  const now = new Date().toISOString();
  const rules = evaluateRules(session);
  const candidate = deriveCandidate(session, rules);
  const blockerSummary = deriveBlockerSummary(rules);
  const warningSummary = deriveWarningSummary(rules);
  const reworkRoutes = deriveReworkRoutes(rules);

  const hasFail = rules.some(r => r.resultStatus === "fail");
  const hasWarning = rules.some(r => r.resultStatus === "warning");
  const gateStatus = deriveGateStatus(candidate, hasFail, hasWarning);
  const phase = derivePhase(gateStatus);
  const actionGate = deriveActionGate(candidate, hasFail);

  const allRuleKeys = rules.map(r => r.ruleKey);
  const failedKeys = rules.filter(r => r.resultStatus === "fail").map(r => r.ruleKey);
  const warningKeys = rules.filter(r => r.resultStatus === "warning").map(r => r.ruleKey);

  const nextSurface = gateStatus === "validation_passed_pending_send_gate"
    ? "Send Confirmation Gate (Locked — Batch 1)"
    : "Validation 미통과 — rework 또는 hold 필요";

  const provenance: DispatchDraftValidationProvenanceV2 = {
    derivedFromAssemblySessionId: session.assemblySessionId,
    derivedFromCompletionGateVersion: session.completionGateState.completionStatus,
    derivedFromWorkspaceStateVersionIfAny: "",
    derivedFromRuleInputSnapshotRefs: session.sectionResolutionStates.map(s => `${s.sectionKey}:${s.resolutionStatus}`),
    derivedAt: now,
    derivedByEngineVersion: "v2-batch1",
    policyLockBasis: gateStatus === "validation_locked_by_policy" ? "Policy lock active" : "none",
    reworkBasis: reworkRoutes.length > 0 ? reworkRoutes.map(r => r.reworkRouteKey).join(", ") : "none",
  };

  return {
    validationGateId: `dftvgate_${Date.now().toString(36)}`,
    caseId: session.caseId,
    handoffPackageId: session.handoffPackageId,
    draftEnablementGateId: session.draftEnablementGateId,
    assemblySessionId: session.assemblySessionId,
    gateStatus,
    validationPhase: phase,
    candidateStatus: candidate.candidateStatus,
    candidate,
    ruleResults: rules,
    blockerSummary,
    warningSummary,
    actionGate,
    requiredValidationRules: allRuleKeys,
    failedValidationRules: failedKeys,
    warningValidationRules: warningKeys,
    reworkRoutes,
    sendEnablementStatus: "disabled",
    nextSurfaceLabel: nextSurface,
    provenance,
    generatedAt: now,
  };
}

// ══════════════════════════════════════════════
// Activity Events
// ══════════════════════════════════════════════

export type DraftValidationEventType =
  | "dispatch_draft_validation_gate_computed"
  | "dispatch_draft_validation_candidate_ready"
  | "dispatch_draft_validation_blocked"
  | "dispatch_draft_validation_failed_rework_required"
  | "dispatch_draft_validation_passed_pending_send_gate"
  | "dispatch_draft_validation_locked_by_policy"
  | "dispatch_draft_validation_reopened_for_rework";

export interface DraftValidationEvent {
  type: DraftValidationEventType;
  caseId: string;
  assemblySessionId: string;
  validationGateId: string;
  ruleKeyIfAny: ValidationRuleKey | null;
  actionOrComputeReason: string;
  actorOrSystem: string;
  timestamp: string;
}

export function createDraftValidationEvent(
  type: DraftValidationEventType,
  gate: DispatchDraftValidationGateV2,
  ruleKey: ValidationRuleKey | null,
  reason: string,
  actor: string,
): DraftValidationEvent {
  return {
    type, caseId: gate.caseId, assemblySessionId: gate.assemblySessionId,
    validationGateId: gate.validationGateId, ruleKeyIfAny: ruleKey,
    actionOrComputeReason: reason, actorOrSystem: actor, timestamp: new Date().toISOString(),
  };
}
