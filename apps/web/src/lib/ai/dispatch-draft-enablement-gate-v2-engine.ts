/**
 * Dispatch Draft Enablement Gate v2 Engine — preparation review → draft entry eligibility
 *
 * 고정 규칙:
 * 1. DispatchPreparationReviewSessionV2 + CompletionGateStateV2 = 입력 source.
 * 2. preparation review complete ≠ draft entry eligible.
 * 3. draft entry eligible ≠ send enablement.
 * 4. correction/reopen/dependency revalidation 이력이 gate 판정에 반영.
 * 5. precondition 8종 명시적 판정.
 * 6. Batch 1: send/dispatched/vendor_draft 전부 금지.
 * 7. candidate readiness와 policy lock 분리.
 * 8. provenance + audit 강화.
 */

import type {
  DispatchPreparationReviewSessionV2,
  ReviewSessionStatus,
  DispatchPreparationCompletionGateStateV2,
  DispatchPreparationSectionResolutionStateV2,
} from "./dispatch-preparation-review-resolution-v2-engine";
import type { DecisionSectionKey } from "./dispatch-preparation-center-work-window-v2";

// ══════════════════════════════════════════════
// Gate Status / Phase
// ══════════════════════════════════════════════

export type DraftEnablementGateStatus =
  | "not_eligible"
  | "review_dependency_open"
  | "correction_dependency_open"
  | "eligible_for_draft_entry"
  | "draft_entry_locked_by_policy"
  | "draft_entry_opened";

export type DraftEnablementGatePhase = "precheck" | "eligibility_review" | "entry_pending" | "entry_enabled" | "entry_open" | "policy_locked";

// ══════════════════════════════════════════════
// Precondition
// ══════════════════════════════════════════════

export type PreconditionKey =
  | "preparation_review_completion"
  | "no_unresolved_blocker_sections"
  | "no_open_correction_routes"
  | "no_revisit_after_return_pending"
  | "vendor_contact_readiness"
  | "internal_separation_resolved"
  | "mandatory_reference_completeness"
  | "instruction_critical_gaps_closed";

export type PreconditionBlockingLevel = "hard_blocker" | "soft_blocker" | "policy_lock" | "warning";

export interface DraftEntryPrecondition {
  preconditionKey: PreconditionKey;
  label: string;
  status: "satisfied" | "unsatisfied";
  reasonIfUnsatisfied: string;
  derivedFrom: string;
  blockingLevel: PreconditionBlockingLevel;
}

// ══════════════════════════════════════════════
// Entry Candidate
// ══════════════════════════════════════════════

export type EntryCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_entry" | "candidate_entry_locked";

export interface DispatchDraftEntryCandidateV2 {
  candidateStatus: EntryCandidateStatus;
  candidateReason: string;
  originReviewStatus: ReviewSessionStatus;
  completionStatus: string;
  requiredResolutionSnapshot: string;
  visibilityReadinessSnapshot: string;
  instructionReadinessSnapshot: string;
  internalSeparationSnapshot: string;
  contactReferenceSnapshot: string;
  canOpenDraftWorkspace: boolean;
  canOnlyPreviewCandidate: boolean;
  requiresAdditionalGateReview: boolean;
}

// ══════════════════════════════════════════════
// Blocker / Warning Summary
// ══════════════════════════════════════════════

export interface DispatchDraftEntryBlockerSummaryV2 {
  blockers: string[];
  count: number;
  primaryBlocker: string | null;
}

export interface DispatchDraftEntryWarningSummaryV2 {
  warnings: string[];
  count: number;
  primaryWarning: string | null;
}

// ══════════════════════════════════════════════
// Action Gate
// ══════════════════════════════════════════════

export interface DispatchDraftEntryActionGateV2 {
  canOpenDraftWorkspace: boolean;
  canPreviewDraftEntryCandidate: boolean;
  canReturnToPreparationReview: boolean;
  canReopenSectionReview: boolean;
  canRouteBackToCorrection: boolean;
  canHoldForPolicyReview: boolean;
  // Batch 1 — explicitly forbidden
  canGenerateVendorDraft: false;
  canSendToSupplier: false;
  canMarkDispatched: false;
  disabledActionReasons: Record<string, string>;
}

// ══════════════════════════════════════════════
// Provenance
// ══════════════════════════════════════════════

export interface DispatchDraftEntryProvenanceV2 {
  derivedFromReviewSessionId: string;
  derivedFromCompletionGateVersion: string;
  derivedFromSectionResolutionSnapshotIds: string[];
  derivedAt: string;
  derivedByEngineVersion: string;
  policyLockBasis: string;
  dependencyRecheckBasis: string;
}

// ══════════════════════════════════════════════
// Top-Level Gate
// ══════════════════════════════════════════════

export interface DispatchDraftEnablementGateV2 {
  draftEnablementGateId: string;
  caseId: string;
  handoffPackageId: string;
  reviewSessionId: string;
  gateStatus: DraftEnablementGateStatus;
  gatePhase: DraftEnablementGatePhase;
  entryCandidateStatus: EntryCandidateStatus;
  entryCandidate: DispatchDraftEntryCandidateV2;
  entryBlockerSummary: DispatchDraftEntryBlockerSummaryV2;
  entryWarningSummary: DispatchDraftEntryWarningSummaryV2;
  entryActionGate: DispatchDraftEntryActionGateV2;
  requiredPreconditions: DraftEntryPrecondition[];
  unsatisfiedPreconditions: DraftEntryPrecondition[];
  sendEnablementStatus: "disabled";
  nextSurfaceLabel: string;
  hasPriorCorrectionHistory: boolean;
  hasReopenedSectionPending: boolean;
  requiresDependencyRevalidation: boolean;
  lastReturnGate: string | null;
  lastCorrectionRoute: string | null;
  provenance: DispatchDraftEntryProvenanceV2;
  generatedAt: string;
}

// ══════════════════════════════════════════════
// Precondition Derivation
// ══════════════════════════════════════════════

function derivePreconditions(session: DispatchPreparationReviewSessionV2): DraftEntryPrecondition[] {
  const preconditions: DraftEntryPrecondition[] = [];
  const sections = session.sectionResolutionStates;
  const completion = session.completionGateState;

  // 1. Preparation review completion
  preconditions.push({
    preconditionKey: "preparation_review_completion",
    label: "Preparation review 완료",
    status: session.sessionStatus === "review_complete_pending_next_gate" ? "satisfied" : "unsatisfied",
    reasonIfUnsatisfied: session.sessionStatus !== "review_complete_pending_next_gate" ? `Session status: ${session.sessionStatus}` : "",
    derivedFrom: "session.sessionStatus",
    blockingLevel: "hard_blocker",
  });

  // 2. No unresolved blocker sections
  const unresolvedBlockers = sections.filter(s => s.resolutionStatus === "blocked_unresolved" || s.remainingBlockers.length > 0);
  preconditions.push({
    preconditionKey: "no_unresolved_blocker_sections",
    label: "미해소 blocker section 없음",
    status: unresolvedBlockers.length === 0 ? "satisfied" : "unsatisfied",
    reasonIfUnsatisfied: unresolvedBlockers.length > 0 ? `${unresolvedBlockers.length}건 blocker section 미해소` : "",
    derivedFrom: "sectionResolutionStates",
    blockingLevel: "hard_blocker",
  });

  // 3. No open correction routes
  const openCorrections = sections.filter(s => s.resolutionStatus === "routed_to_correction");
  preconditions.push({
    preconditionKey: "no_open_correction_routes",
    label: "미완료 correction route 없음",
    status: openCorrections.length === 0 ? "satisfied" : "unsatisfied",
    reasonIfUnsatisfied: openCorrections.length > 0 ? `${openCorrections.length}건 correction route 열려 있음` : "",
    derivedFrom: "sectionResolutionStates",
    blockingLevel: "hard_blocker",
  });

  // 4. No revisit-after-return pending
  const revisitPending = sections.filter(s => s.requiresRevisitAfterReturn);
  preconditions.push({
    preconditionKey: "no_revisit_after_return_pending",
    label: "Return 후 재검토 대기 없음",
    status: revisitPending.length === 0 ? "satisfied" : "unsatisfied",
    reasonIfUnsatisfied: revisitPending.length > 0 ? `${revisitPending.length}건 section 재검토 필요` : "",
    derivedFrom: "sectionResolutionStates",
    blockingLevel: "hard_blocker",
  });

  // 5. Vendor contact readiness
  const vendorSection = sections.find(s => s.sectionKey === "vendor_contact");
  const vendorOk = vendorSection && (vendorSection.resolutionStatus === "resolved_in_place" || vendorSection.resolutionStatus === "reviewed_with_warning");
  preconditions.push({
    preconditionKey: "vendor_contact_readiness",
    label: "Vendor contact 준비 확인",
    status: vendorOk ? "satisfied" : "unsatisfied",
    reasonIfUnsatisfied: !vendorOk ? "Vendor contact section 미해소" : "",
    derivedFrom: "vendor_contact section",
    blockingLevel: "hard_blocker",
  });

  // 6. Internal separation resolved
  const internalSection = sections.find(s => s.sectionKey === "internal_separation");
  const internalOk = internalSection && (internalSection.resolutionStatus === "resolved_in_place" || internalSection.resolutionStatus === "reviewed_with_warning");
  preconditions.push({
    preconditionKey: "internal_separation_resolved",
    label: "Internal-only 분리 확인",
    status: internalOk ? "satisfied" : "unsatisfied",
    reasonIfUnsatisfied: !internalOk ? "Internal separation section 미해소" : "",
    derivedFrom: "internal_separation section",
    blockingLevel: "hard_blocker",
  });

  // 7. Mandatory reference completeness
  const refSection = sections.find(s => s.sectionKey === "reference_visibility");
  const refOk = refSection && refSection.remainingBlockers.length === 0;
  preconditions.push({
    preconditionKey: "mandatory_reference_completeness",
    label: "필수 reference 완결성 확인",
    status: refOk ? "satisfied" : "unsatisfied",
    reasonIfUnsatisfied: !refOk ? "Reference visibility blocker 존재" : "",
    derivedFrom: "reference_visibility section",
    blockingLevel: "soft_blocker",
  });

  // 8. Instruction critical gaps closed
  const instrSection = sections.find(s => s.sectionKey === "shipment_and_receiving_instruction");
  const instrOk = instrSection && instrSection.remainingBlockers.length === 0;
  preconditions.push({
    preconditionKey: "instruction_critical_gaps_closed",
    label: "Ship-to/receiving critical gap 해소",
    status: instrOk ? "satisfied" : "unsatisfied",
    reasonIfUnsatisfied: !instrOk ? "Instruction section blocker 존재" : "",
    derivedFrom: "shipment_and_receiving_instruction section",
    blockingLevel: "soft_blocker",
  });

  return preconditions;
}

// ══════════════════════════════════════════════
// Blocker / Warning Derivation
// ══════════════════════════════════════════════

function deriveBlockerSummary(preconditions: DraftEntryPrecondition[]): DispatchDraftEntryBlockerSummaryV2 {
  const unsatisfied = preconditions.filter(p => p.status === "unsatisfied" && (p.blockingLevel === "hard_blocker" || p.blockingLevel === "soft_blocker"));
  const blockers = unsatisfied.map(p => p.reasonIfUnsatisfied);
  return { blockers, count: blockers.length, primaryBlocker: blockers[0] || null };
}

function deriveWarningSummary(preconditions: DraftEntryPrecondition[], sections: DispatchPreparationSectionResolutionStateV2[]): DispatchDraftEntryWarningSummaryV2 {
  const warnings: string[] = [];
  const warningPreconditions = preconditions.filter(p => p.status === "unsatisfied" && p.blockingLevel === "warning");
  warnings.push(...warningPreconditions.map(p => p.reasonIfUnsatisfied));

  const warningSections = sections.filter(s => s.resolutionStatus === "reviewed_with_warning");
  if (warningSections.length > 0) warnings.push(`${warningSections.length}건 section warning acknowledged 상태`);

  const visibilityWarn = sections.filter(s => s.remainingWarnings.length > 0 && s.remainingBlockers.length === 0);
  if (visibilityWarn.length > 0) warnings.push("Visibility/reference caution 존재");

  return { warnings, count: warnings.length, primaryWarning: warnings[0] || null };
}

// ══════════════════════════════════════════════
// Candidate Derivation
// ══════════════════════════════════════════════

function deriveEntryCandidate(
  session: DispatchPreparationReviewSessionV2,
  blockerSummary: DispatchDraftEntryBlockerSummaryV2,
  warningSummary: DispatchDraftEntryWarningSummaryV2,
): DispatchDraftEntryCandidateV2 {
  const hasBlockers = blockerSummary.count > 0;
  const hasWarnings = warningSummary.count > 0;
  const isComplete = session.sessionStatus === "review_complete_pending_next_gate";

  const candidateStatus: EntryCandidateStatus =
    !isComplete ? "not_candidate"
    : hasBlockers ? "candidate_with_blockers"
    : hasWarnings ? "candidate_with_warnings"
    : "candidate_ready_for_entry";

  const canOpen = candidateStatus === "candidate_ready_for_entry";

  return {
    candidateStatus,
    candidateReason: hasBlockers ? blockerSummary.primaryBlocker! : hasWarnings ? `Warning: ${warningSummary.primaryWarning}` : isComplete ? "Draft entry 가능" : "Review 미완료",
    originReviewStatus: session.sessionStatus,
    completionStatus: session.completionGateState.completionStatus,
    requiredResolutionSnapshot: `${session.sectionResolutionStates.filter(s => s.eligibleForCompletion).length}/${session.sectionResolutionStates.length} sections resolved`,
    visibilityReadinessSnapshot: session.sectionResolutionStates.find(s => s.sectionKey === "reference_visibility")?.resolutionStatus || "unknown",
    instructionReadinessSnapshot: session.sectionResolutionStates.find(s => s.sectionKey === "shipment_and_receiving_instruction")?.resolutionStatus || "unknown",
    internalSeparationSnapshot: session.sectionResolutionStates.find(s => s.sectionKey === "internal_separation")?.resolutionStatus || "unknown",
    contactReferenceSnapshot: session.sectionResolutionStates.find(s => s.sectionKey === "vendor_contact")?.resolutionStatus || "unknown",
    canOpenDraftWorkspace: canOpen,
    canOnlyPreviewCandidate: !canOpen && isComplete,
    requiresAdditionalGateReview: hasBlockers || hasWarnings,
  };
}

// ══════════════════════════════════════════════
// Action Gate Derivation
// ══════════════════════════════════════════════

function deriveActionGate(candidate: DispatchDraftEntryCandidateV2, hasCorrection: boolean): DispatchDraftEntryActionGateV2 {
  return {
    canOpenDraftWorkspace: candidate.canOpenDraftWorkspace,
    canPreviewDraftEntryCandidate: candidate.candidateStatus !== "not_candidate",
    canReturnToPreparationReview: true,
    canReopenSectionReview: true,
    canRouteBackToCorrection: hasCorrection,
    canHoldForPolicyReview: true,
    canGenerateVendorDraft: false as const,
    canSendToSupplier: false as const,
    canMarkDispatched: false as const,
    disabledActionReasons: {
      generate_vendor_draft: "Batch 1 정책: vendor draft 생성 금지",
      send_to_supplier: "Batch 1 정책: supplier 발송 금지",
      mark_dispatched: "Batch 1 정책: dispatched 처리 금지",
    },
  };
}

// ══════════════════════════════════════════════
// Gate Status Derivation
// ══════════════════════════════════════════════

function deriveGateStatus(session: DispatchPreparationReviewSessionV2, candidate: DispatchDraftEntryCandidateV2, hasOpenCorrection: boolean, hasRevisitPending: boolean): DraftEnablementGateStatus {
  if (session.sessionStatus !== "review_complete_pending_next_gate") return "not_eligible";
  if (hasOpenCorrection) return "correction_dependency_open";
  if (hasRevisitPending) return "review_dependency_open";
  if (candidate.candidateStatus === "candidate_ready_for_entry") return "eligible_for_draft_entry";
  if (candidate.candidateStatus === "candidate_with_warnings" || candidate.candidateStatus === "candidate_with_blockers") return "draft_entry_locked_by_policy";
  return "not_eligible";
}

function deriveGatePhase(gateStatus: DraftEnablementGateStatus): DraftEnablementGatePhase {
  switch (gateStatus) {
    case "not_eligible": return "precheck";
    case "review_dependency_open": return "precheck";
    case "correction_dependency_open": return "precheck";
    case "eligible_for_draft_entry": return "entry_enabled";
    case "draft_entry_locked_by_policy": return "policy_locked";
    case "draft_entry_opened": return "entry_open";
  }
}

// ══════════════════════════════════════════════
// Main Builder
// ══════════════════════════════════════════════

export function buildDispatchDraftEnablementGateV2(session: DispatchPreparationReviewSessionV2): DispatchDraftEnablementGateV2 {
  const now = new Date().toISOString();
  const sections = session.sectionResolutionStates;

  // Preconditions
  const preconditions = derivePreconditions(session);
  const unsatisfied = preconditions.filter(p => p.status === "unsatisfied");

  // Blocker / Warning
  const blockerSummary = deriveBlockerSummary(preconditions);
  const warningSummary = deriveWarningSummary(preconditions, sections);

  // Candidate
  const candidate = deriveEntryCandidate(session, blockerSummary, warningSummary);

  // Correction / Return
  const hasOpenCorrection = sections.some(s => s.resolutionStatus === "routed_to_correction");
  const hasRevisitPending = sections.some(s => s.requiresRevisitAfterReturn);
  const hasPriorCorrectionHistory = session.correctionHistory.length > 0;
  const requiresDepRevalidation = hasRevisitPending || (hasPriorCorrectionHistory && sections.some(s => s.requiresRevisitAfterReturn));

  // Gate status
  const gateStatus = deriveGateStatus(session, candidate, hasOpenCorrection, hasRevisitPending);
  const gatePhase = deriveGatePhase(gateStatus);

  // Action gate
  const actionGate = deriveActionGate(candidate, hasOpenCorrection);

  // Next surface
  const nextSurfaceLabel = candidate.canOpenDraftWorkspace
    ? "Dispatch Draft Workspace (Entry Enabled)"
    : "Dispatch Draft Workspace (Locked Preview Only)";

  // Provenance
  const provenance: DispatchDraftEntryProvenanceV2 = {
    derivedFromReviewSessionId: session.reviewSessionId,
    derivedFromCompletionGateVersion: session.completionGateState.completionStatus,
    derivedFromSectionResolutionSnapshotIds: sections.map(s => `${s.sectionKey}:${s.resolutionStatus}`),
    derivedAt: now,
    derivedByEngineVersion: "v2-batch1",
    policyLockBasis: gateStatus === "draft_entry_locked_by_policy" ? "Batch 1 정책 또는 unsatisfied precondition" : "none",
    dependencyRecheckBasis: requiresDepRevalidation ? "Prior correction + revisit pending" : "none",
  };

  return {
    draftEnablementGateId: `dftegate_${Date.now().toString(36)}`,
    caseId: session.caseId,
    handoffPackageId: session.handoffPackageId,
    reviewSessionId: session.reviewSessionId,
    gateStatus,
    gatePhase,
    entryCandidateStatus: candidate.candidateStatus,
    entryCandidate: candidate,
    entryBlockerSummary: blockerSummary,
    entryWarningSummary: warningSummary,
    entryActionGate: actionGate,
    requiredPreconditions: preconditions,
    unsatisfiedPreconditions: unsatisfied,
    sendEnablementStatus: "disabled",
    nextSurfaceLabel,
    hasPriorCorrectionHistory,
    hasReopenedSectionPending: hasRevisitPending,
    requiresDependencyRevalidation: requiresDepRevalidation,
    lastReturnGate: session.returnHistory.length > 0 ? session.returnHistory[session.returnHistory.length - 1].targetStage : null,
    lastCorrectionRoute: session.correctionHistory.length > 0 ? session.correctionHistory[session.correctionHistory.length - 1].routeKey : null,
    provenance,
    generatedAt: now,
  };
}

// ══════════════════════════════════════════════
// Activity Events
// ══════════════════════════════════════════════

export type DraftEnablementEventType =
  | "dispatch_draft_entry_gate_computed"
  | "dispatch_draft_entry_eligibility_confirmed"
  | "dispatch_draft_entry_blocked"
  | "dispatch_draft_entry_locked_by_policy"
  | "dispatch_draft_entry_enabled"
  | "dispatch_draft_entry_preview_opened"
  | "dispatch_draft_entry_returned_to_preparation_review";

export interface DraftEnablementEvent {
  type: DraftEnablementEventType;
  caseId: string;
  reviewSessionId: string;
  draftEnablementGateId: string;
  actionOrComputeReason: string;
  actorOrSystem: string;
  timestamp: string;
}

export function createDraftEnablementEvent(
  type: DraftEnablementEventType,
  gate: DispatchDraftEnablementGateV2,
  reason: string,
  actor: string,
): DraftEnablementEvent {
  return {
    type,
    caseId: gate.caseId,
    reviewSessionId: gate.reviewSessionId,
    draftEnablementGateId: gate.draftEnablementGateId,
    actionOrComputeReason: reason,
    actorOrSystem: actor,
    timestamp: new Date().toISOString(),
  };
}
