/**
 * Send Confirmation Gate v2 Engine — validation passed → send confirmation entry eligibility
 *
 * 고정 규칙:
 * 1. DispatchDraftValidationSessionV2 + OutcomeState = 입력 source.
 * 2. validation passed ≠ send confirmation entry eligible.
 * 3. send confirmation entry ≠ send execution.
 * 4. rework/reopen/dependency revalidation 이력이 gate 판정에 반영.
 * 5. precondition 10종 명시적 판정.
 * 6. Batch 1: send execution / mark dispatched 전부 금지.
 * 7. candidate readiness와 policy lock 분리.
 * 8. provenance + audit 강화.
 */

import type {
  DispatchDraftValidationSessionV2,
  ValidationSessionStatus,
  DispatchDraftValidationOutcomeStateV2,
  DispatchDraftValidationRuleResolutionStateV2,
  ValidationReworkRecord,
} from "./dispatch-draft-validation-resolution-v2-engine";
import type { ValidationRuleKey } from "./dispatch-draft-validation-gate-v2-engine";

// ══════════════════════════════════════════════
// Gate Status / Phase
// ══════════════════════════════════════════════

export type SendConfirmationGateStatus =
  | "not_eligible"
  | "validation_dependency_open"
  | "rework_dependency_open"
  | "eligible_for_send_confirmation_entry"
  | "send_confirmation_locked_by_policy"
  | "send_confirmation_entry_opened";

export type SendConfirmationGatePhase = "precheck" | "eligibility_review" | "entry_pending" | "entry_enabled" | "entry_open" | "policy_locked";

// ══════════════════════════════════════════════
// Precondition
// ══════════════════════════════════════════════

export type SendConfirmationPreconditionKey =
  | "validation_outcome_passed"
  | "no_failed_validation_rules"
  | "no_open_rework_route"
  | "no_revalidation_after_rework_pending"
  | "vendor_recipient_readiness"
  | "dispatch_scope_consistency"
  | "mandatory_reference_completeness"
  | "instruction_visibility_consistency"
  | "internal_exclusion_guard_confirmed"
  | "supplier_facing_contamination_not_detected";

export type SendPreconditionBlockingLevel = "hard_blocker" | "soft_blocker" | "policy_lock" | "warning";

export interface SendConfirmationPreconditionResultV2 {
  preconditionKey: SendConfirmationPreconditionKey;
  label: string;
  status: "satisfied" | "unsatisfied";
  reasonIfUnsatisfied: string;
  derivedFrom: string;
  blockingLevel: SendPreconditionBlockingLevel;
}

// ══════════════════════════════════════════════
// Entry Candidate
// ══════════════════════════════════════════════

export type SendEntryCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_entry" | "candidate_entry_locked";

export interface SendConfirmationEntryCandidateV2 {
  candidateStatus: SendEntryCandidateStatus;
  candidateReason: string;
  originValidationStatus: ValidationSessionStatus;
  validationOutcomeStatus: string;
  supplierPayloadReadinessSnapshot: string;
  referenceVisibilitySnapshot: string;
  instructionVisibilitySnapshot: string;
  internalExclusionSnapshot: string;
  contactReadinessSnapshot: string;
  scopeConsistencySnapshot: string;
  canOpenSendConfirmationWorkspace: boolean;
  canOnlyPreviewCandidate: boolean;
  requiresAdditionalGateReview: boolean;
}

// ══════════════════════════════════════════════
// Blocker / Warning Summary
// ══════════════════════════════════════════════

export interface SendConfirmationBlockerSummaryV2 {
  blockers: string[];
  count: number;
  primaryBlocker: string | null;
}

export interface SendConfirmationWarningSummaryV2 {
  warnings: string[];
  count: number;
  primaryWarning: string | null;
}

// ══════════════════════════════════════════════
// Action Gate
// ══════════════════════════════════════════════

export interface SendConfirmationActionGateV2 {
  canOpenSendConfirmationWorkspace: boolean;
  canPreviewSendConfirmationCandidate: boolean;
  canReturnToValidationReview: boolean;
  canReopenValidationRuleReview: boolean;
  canRouteBackToRework: boolean;
  canHoldForPolicyReview: boolean;
  canPrepareSendConfirmationSession: boolean;
  // Batch 1 — explicitly forbidden
  canExecuteSupplierSend: false;
  canMarkDispatched: false;
  disabledActionReasons: Record<string, string>;
}

// ══════════════════════════════════════════════
// Provenance
// ══════════════════════════════════════════════

export interface SendConfirmationProvenanceV2 {
  derivedFromValidationSessionId: string;
  derivedFromValidationGateVersion: string;
  derivedFromValidationOutcomeSnapshotId: string;
  derivedFromRuleResolutionSnapshotIds: string[];
  derivedAt: string;
  derivedByEngineVersion: string;
  policyLockBasis: string;
  dependencyRecheckBasis: string;
}

// ══════════════════════════════════════════════
// Top-Level Gate
// ══════════════════════════════════════════════

export interface SendConfirmationGateV2 {
  sendConfirmationGateId: string;
  caseId: string;
  handoffPackageId: string;
  validationGateId: string;
  validationSessionId: string;
  gateStatus: SendConfirmationGateStatus;
  gatePhase: SendConfirmationGatePhase;
  entryCandidateStatus: SendEntryCandidateStatus;
  entryCandidate: SendConfirmationEntryCandidateV2;
  blockerSummary: SendConfirmationBlockerSummaryV2;
  warningSummary: SendConfirmationWarningSummaryV2;
  actionGate: SendConfirmationActionGateV2;
  requiredPreconditions: SendConfirmationPreconditionResultV2[];
  unsatisfiedPreconditions: SendConfirmationPreconditionResultV2[];
  sendExecutionStatus: "disabled";
  nextSurfaceLabel: string;
  hasPriorReworkHistory: boolean;
  hasReopenedRulePending: boolean;
  requiresDependencyRevalidation: boolean;
  lastReworkRoute: string | null;
  lastValidationOutcomeStatus: string;
  provenance: SendConfirmationProvenanceV2;
  generatedAt: string;
}

// ══════════════════════════════════════════════
// Precondition Derivation
// ══════════════════════════════════════════════

function derivePreconditions(session: DispatchDraftValidationSessionV2): SendConfirmationPreconditionResultV2[] {
  const preconditions: SendConfirmationPreconditionResultV2[] = [];
  const rules = session.ruleResolutionStates;
  const outcome = session.outcomeState;

  // 1. Validation outcome passed
  preconditions.push({
    preconditionKey: "validation_outcome_passed",
    label: "Validation outcome passed",
    status: session.sessionStatus === "validation_passed_pending_send_gate" ? "satisfied" : "unsatisfied",
    reasonIfUnsatisfied: session.sessionStatus !== "validation_passed_pending_send_gate" ? `Session status: ${session.sessionStatus}` : "",
    derivedFrom: "session.sessionStatus",
    blockingLevel: "hard_blocker",
  });

  // 2. No failed validation rules
  const failedRules = rules.filter(r => r.resolutionStatus === "rework_required" || r.resolutionStatus === "blocked_unresolved");
  preconditions.push({
    preconditionKey: "no_failed_validation_rules",
    label: "미해소 failed validation rule 없음",
    status: failedRules.length === 0 ? "satisfied" : "unsatisfied",
    reasonIfUnsatisfied: failedRules.length > 0 ? `${failedRules.length}건 failed rule 미해소` : "",
    derivedFrom: "ruleResolutionStates",
    blockingLevel: "hard_blocker",
  });

  // 3. No open rework route
  const openRework = rules.filter(r => r.reworkRouteIfAny && r.resolutionStatus === "rework_required");
  preconditions.push({
    preconditionKey: "no_open_rework_route",
    label: "미완료 rework route 없음",
    status: openRework.length === 0 ? "satisfied" : "unsatisfied",
    reasonIfUnsatisfied: openRework.length > 0 ? `${openRework.length}건 rework route 열려 있음` : "",
    derivedFrom: "ruleResolutionStates",
    blockingLevel: "hard_blocker",
  });

  // 4. No revalidation after rework pending
  const revalidationPending = rules.filter(r => r.requiresRevalidationAfterRework);
  preconditions.push({
    preconditionKey: "no_revalidation_after_rework_pending",
    label: "Rework 후 재검증 대기 없음",
    status: revalidationPending.length === 0 ? "satisfied" : "unsatisfied",
    reasonIfUnsatisfied: revalidationPending.length > 0 ? `${revalidationPending.length}건 rule 재검증 필요` : "",
    derivedFrom: "ruleResolutionStates",
    blockingLevel: "hard_blocker",
  });

  // Rule-specific preconditions (5-10)
  const ruleChecks: { key: SendConfirmationPreconditionKey; ruleKey: ValidationRuleKey; label: string; level: SendPreconditionBlockingLevel }[] = [
    { key: "vendor_recipient_readiness", ruleKey: "vendor_recipient_complete", label: "Vendor recipient 준비 확인", level: "hard_blocker" },
    { key: "dispatch_scope_consistency", ruleKey: "dispatch_scope_consistent", label: "Dispatch scope 정합성 확인", level: "hard_blocker" },
    { key: "mandatory_reference_completeness", ruleKey: "mandatory_references_present", label: "필수 reference 완결성 확인", level: "soft_blocker" },
    { key: "instruction_visibility_consistency", ruleKey: "instruction_visibility_consistent", label: "Instruction visibility 정합성 확인", level: "soft_blocker" },
    { key: "internal_exclusion_guard_confirmed", ruleKey: "internal_exclusion_guard_confirmed", label: "Internal exclusion guard 확인", level: "hard_blocker" },
    { key: "supplier_facing_contamination_not_detected", ruleKey: "supplier_facing_contamination_not_detected", label: "Supplier-facing contamination 미감지", level: "hard_blocker" },
  ];

  for (const check of ruleChecks) {
    const rule = rules.find(r => r.ruleKey === check.ruleKey);
    const ok = rule && rule.eligibleForValidationPass;
    preconditions.push({
      preconditionKey: check.key,
      label: check.label,
      status: ok ? "satisfied" : "unsatisfied",
      reasonIfUnsatisfied: !ok ? `Rule ${check.ruleKey} 미해소` : "",
      derivedFrom: `rule:${check.ruleKey}`,
      blockingLevel: check.level,
    });
  }

  return preconditions;
}

// ══════════════════════════════════════════════
// Blocker / Warning Derivation
// ══════════════════════════════════════════════

function deriveBlockerSummary(preconditions: SendConfirmationPreconditionResultV2[]): SendConfirmationBlockerSummaryV2 {
  const unsatisfied = preconditions.filter(p => p.status === "unsatisfied" && (p.blockingLevel === "hard_blocker" || p.blockingLevel === "soft_blocker"));
  const blockers = unsatisfied.map(p => p.reasonIfUnsatisfied);
  return { blockers, count: blockers.length, primaryBlocker: blockers[0] || null };
}

function deriveWarningSummary(preconditions: SendConfirmationPreconditionResultV2[], rules: DispatchDraftValidationRuleResolutionStateV2[]): SendConfirmationWarningSummaryV2 {
  const warnings: string[] = [];
  const warningPreconditions = preconditions.filter(p => p.status === "unsatisfied" && p.blockingLevel === "warning");
  warnings.push(...warningPreconditions.map(p => p.reasonIfUnsatisfied));

  const warningRules = rules.filter(r => r.resolutionStatus === "accepted_warning");
  if (warningRules.length > 0) warnings.push(`${warningRules.length}건 validation rule warning acknowledged`);

  return { warnings, count: warnings.length, primaryWarning: warnings[0] || null };
}

// ══════════════════════════════════════════════
// Candidate Derivation
// ══════════════════════════════════════════════

function deriveEntryCandidate(
  session: DispatchDraftValidationSessionV2,
  blockerSummary: SendConfirmationBlockerSummaryV2,
  warningSummary: SendConfirmationWarningSummaryV2,
): SendConfirmationEntryCandidateV2 {
  const isPassed = session.sessionStatus === "validation_passed_pending_send_gate";
  const hasBlockers = blockerSummary.count > 0;
  const hasWarnings = warningSummary.count > 0;

  const status: SendEntryCandidateStatus =
    !isPassed ? "not_candidate"
    : hasBlockers ? "candidate_with_blockers"
    : hasWarnings ? "candidate_with_warnings"
    : "candidate_ready_for_entry";

  const canOpen = status === "candidate_ready_for_entry";
  const rules = session.ruleResolutionStates;
  const findSnap = (key: ValidationRuleKey) => rules.find(r => r.ruleKey === key)?.resolutionStatus || "unknown";

  return {
    candidateStatus: status,
    candidateReason: hasBlockers ? blockerSummary.primaryBlocker! : hasWarnings ? `Warning: ${warningSummary.primaryWarning}` : isPassed ? "Send confirmation entry 가능" : "Validation 미통과",
    originValidationStatus: session.sessionStatus,
    validationOutcomeStatus: session.outcomeState.outcomeStatus,
    supplierPayloadReadinessSnapshot: `${rules.filter(r => r.eligibleForValidationPass).length}/${rules.length} rules passed`,
    referenceVisibilitySnapshot: findSnap("reference_visibility_consistent"),
    instructionVisibilitySnapshot: findSnap("instruction_visibility_consistent"),
    internalExclusionSnapshot: findSnap("internal_exclusion_guard_confirmed"),
    contactReadinessSnapshot: findSnap("vendor_recipient_complete"),
    scopeConsistencySnapshot: findSnap("dispatch_scope_consistent"),
    canOpenSendConfirmationWorkspace: canOpen,
    canOnlyPreviewCandidate: !canOpen && isPassed,
    requiresAdditionalGateReview: hasBlockers || hasWarnings,
  };
}

// ══════════════════════════════════════════════
// Action Gate Derivation
// ══════════════════════════════════════════════

function deriveActionGate(candidate: SendConfirmationEntryCandidateV2, hasRework: boolean): SendConfirmationActionGateV2 {
  return {
    canOpenSendConfirmationWorkspace: candidate.canOpenSendConfirmationWorkspace,
    canPreviewSendConfirmationCandidate: candidate.candidateStatus !== "not_candidate",
    canReturnToValidationReview: true,
    canReopenValidationRuleReview: true,
    canRouteBackToRework: hasRework,
    canHoldForPolicyReview: true,
    canPrepareSendConfirmationSession: candidate.canOpenSendConfirmationWorkspace,
    canExecuteSupplierSend: false as const,
    canMarkDispatched: false as const,
    disabledActionReasons: {
      execute_supplier_send: "Batch 1 정책: supplier 발송 실행 금지",
      mark_dispatched: "Batch 1 정책: dispatched 처리 금지",
    },
  };
}

// ══════════════════════════════════════════════
// Gate Status Derivation
// ══════════════════════════════════════════════

function deriveGateStatus(
  session: DispatchDraftValidationSessionV2,
  candidate: SendConfirmationEntryCandidateV2,
  hasOpenRework: boolean,
  hasRevalidationPending: boolean,
): SendConfirmationGateStatus {
  if (session.sessionStatus !== "validation_passed_pending_send_gate") return "not_eligible";
  if (hasOpenRework) return "rework_dependency_open";
  if (hasRevalidationPending) return "validation_dependency_open";
  if (candidate.candidateStatus === "candidate_ready_for_entry") return "eligible_for_send_confirmation_entry";
  if (candidate.candidateStatus === "candidate_with_warnings" || candidate.candidateStatus === "candidate_with_blockers") return "send_confirmation_locked_by_policy";
  return "not_eligible";
}

function deriveGatePhase(gateStatus: SendConfirmationGateStatus): SendConfirmationGatePhase {
  switch (gateStatus) {
    case "not_eligible": return "precheck";
    case "validation_dependency_open": return "precheck";
    case "rework_dependency_open": return "precheck";
    case "eligible_for_send_confirmation_entry": return "entry_enabled";
    case "send_confirmation_locked_by_policy": return "policy_locked";
    case "send_confirmation_entry_opened": return "entry_open";
  }
}

// ══════════════════════════════════════════════
// Main Builder
// ══════════════════════════════════════════════

export function buildSendConfirmationGateV2(session: DispatchDraftValidationSessionV2): SendConfirmationGateV2 {
  const now = new Date().toISOString();
  const rules = session.ruleResolutionStates;

  // Preconditions
  const preconditions = derivePreconditions(session);
  const unsatisfied = preconditions.filter(p => p.status === "unsatisfied");

  // Blocker / Warning
  const blockerSummary = deriveBlockerSummary(preconditions);
  const warningSummary = deriveWarningSummary(preconditions, rules);

  // Candidate
  const candidate = deriveEntryCandidate(session, blockerSummary, warningSummary);

  // Rework / Revalidation
  const hasOpenRework = rules.some(r => r.resolutionStatus === "rework_required" && r.reworkRouteIfAny);
  const hasRevalidationPending = rules.some(r => r.requiresRevalidationAfterRework);
  const hasPriorReworkHistory = session.reworkHistory.length > 0;
  const hasReopenedRulePending = rules.some(r => r.requiresRevalidationAfterRework);
  const requiresDepRevalidation = hasRevalidationPending || (hasPriorReworkHistory && hasReopenedRulePending);

  // Gate status
  const gateStatus = deriveGateStatus(session, candidate, hasOpenRework, hasRevalidationPending);
  const gatePhase = deriveGatePhase(gateStatus);

  // Action gate
  const actionGate = deriveActionGate(candidate, hasOpenRework);

  // Next surface
  const nextSurfaceLabel = candidate.canOpenSendConfirmationWorkspace
    ? "Send Confirmation Workspace (Entry Enabled)"
    : "Send Confirmation Workspace (Locked Preview Only)";

  // Provenance
  const provenance: SendConfirmationProvenanceV2 = {
    derivedFromValidationSessionId: session.validationSessionId,
    derivedFromValidationGateVersion: session.validationGateId,
    derivedFromValidationOutcomeSnapshotId: session.outcomeState.outcomeStatus,
    derivedFromRuleResolutionSnapshotIds: rules.map(r => `${r.ruleKey}:${r.resolutionStatus}`),
    derivedAt: now,
    derivedByEngineVersion: "v2-batch1",
    policyLockBasis: gateStatus === "send_confirmation_locked_by_policy" ? "Batch 1 정책 또는 unsatisfied precondition" : "none",
    dependencyRecheckBasis: requiresDepRevalidation ? "Prior rework + revalidation pending" : "none",
  };

  return {
    sendConfirmationGateId: `sndcgate_${Date.now().toString(36)}`,
    caseId: session.caseId,
    handoffPackageId: session.handoffPackageId,
    validationGateId: session.validationGateId,
    validationSessionId: session.validationSessionId,
    gateStatus,
    gatePhase,
    entryCandidateStatus: candidate.candidateStatus,
    entryCandidate: candidate,
    blockerSummary,
    warningSummary,
    actionGate,
    requiredPreconditions: preconditions,
    unsatisfiedPreconditions: unsatisfied,
    sendExecutionStatus: "disabled",
    nextSurfaceLabel,
    hasPriorReworkHistory,
    hasReopenedRulePending,
    requiresDependencyRevalidation: requiresDepRevalidation,
    lastReworkRoute: session.reworkHistory.length > 0 ? session.reworkHistory[session.reworkHistory.length - 1].routeKey : null,
    lastValidationOutcomeStatus: session.outcomeState.outcomeStatus,
    provenance,
    generatedAt: now,
  };
}

// ══════════════════════════════════════════════
// Activity Events
// ══════════════════════════════════════════════

export type SendConfirmationGateEventType =
  | "send_confirmation_entry_gate_computed"
  | "send_confirmation_entry_eligibility_confirmed"
  | "send_confirmation_entry_blocked"
  | "send_confirmation_entry_locked_by_policy"
  | "send_confirmation_entry_enabled"
  | "send_confirmation_entry_preview_opened"
  | "send_confirmation_entry_returned_to_validation_review";

export interface SendConfirmationGateEvent {
  type: SendConfirmationGateEventType;
  caseId: string;
  validationSessionId: string;
  sendConfirmationGateId: string;
  actionOrComputeReason: string;
  actorOrSystem: string;
  timestamp: string;
}

export function createSendConfirmationGateEvent(
  type: SendConfirmationGateEventType,
  gate: SendConfirmationGateV2,
  reason: string,
  actor: string,
): SendConfirmationGateEvent {
  return {
    type,
    caseId: gate.caseId,
    validationSessionId: gate.validationSessionId,
    sendConfirmationGateId: gate.sendConfirmationGateId,
    actionOrComputeReason: reason,
    actorOrSystem: actor,
    timestamp: new Date().toISOString(),
  };
}
