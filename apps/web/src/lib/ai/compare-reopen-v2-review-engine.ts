/**
 * Compare Reopen v2 Review Engine — actual compare decision + shortlist/exclude/hold/rationale
 *
 * 고정 규칙:
 * 1. compareReviewSessionV2 = 단일 입력 source.
 * 2. ready_for_compare_review ≠ shortlist_ready. review decision 이후에만 snapshot 생성.
 * 3. delta-first axis 기준 전개 필수 — flat spec table 회귀 금지.
 * 4. exact/equivalent provenance review 후에도 유지.
 * 5. shortlist / exclude / hold / rationale 4분류 구조적 분리.
 * 6. canonical compareDecisionSnapshotV2 = downstream approval gate의 단일 intake.
 * 7. approval handoff / request-side downstream 직접 실행 금지.
 * 8. review → decision snapshot → approval gate 순서 강제.
 */

import type { CompareReviewSessionV2, CompareReviewSessionStatus } from "./compare-reopen-v2-hydration-engine";
import type { CompareGroup, DeltaFirstAxis } from "./compare-reopen-v2-handoff-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";
import type { SearchResultCandidate } from "./sourcing-search-reopen-execution-engine";

// ── Review Status ──
export type CompareReviewStatus = "blocked" | "warning" | "ready" | "in_progress" | "completed" | "failed";

// ── Review Action ──
export type CompareReviewAction = "shortlist_candidate" | "exclude_candidate" | "hold_candidate" | "keep_under_review";

// ── Rationale Code ──
export type CompareRationaleCode =
  | "price_advantage"
  | "lead_time_advantage"
  | "availability_advantage"
  | "preferred_vendor"
  | "pack_fit"
  | "policy_fit"
  | "reliability_signal"
  | "spec_alignment"
  | "cost_risk"
  | "lead_time_risk"
  | "availability_risk"
  | "vendor_risk"
  | "policy_exclusion"
  | "spec_mismatch"
  | "operator_judgment";

// ── Per-Candidate Review Decision ──
export interface CompareReviewDecision {
  candidateId: string;
  compareGroupId: string;
  provenance: "exact" | "equivalent";
  reviewAction: CompareReviewAction;
  shortlistFlag: boolean;
  excludeFlag: boolean;
  holdFlag: boolean;
  rationaleCodes: CompareRationaleCode[];
  operatorNote: string;
}

// ── State ──
export interface CompareReopenV2ReviewState {
  reviewStatus: CompareReviewStatus;
  compareReviewSessionV2Id: string;
  sourceHandoffPackageV2Id: string;
  sourceReviewObjectV2Id: string;
  poRecordId: string;
  compareGroups: CompareGroup[];
  deltaFirstAxis: DeltaFirstAxis[];
  exactComparableIds: string[];
  equivalentComparableIds: string[];
  requestDirectExcludedIds: string[];
  substituteHoldExcludedIds: string[];
  candidateDecisions: CompareReviewDecision[];
  operatorReviewNote: string;
  blockerCount: number;
  warningCount: number;
  decisionSnapshotId: string | null;
}

export function createInitialCompareReviewState(session: CompareReviewSessionV2): CompareReopenV2ReviewState {
  return {
    reviewStatus: "in_progress",
    compareReviewSessionV2Id: session.id,
    sourceHandoffPackageV2Id: session.sourceHandoffPackageV2Id,
    sourceReviewObjectV2Id: "",
    poRecordId: session.poRecordId,
    compareGroups: session.compareGroups,
    deltaFirstAxis: session.deltaFirstAxis,
    exactComparableIds: session.exactComparableIds,
    equivalentComparableIds: session.equivalentComparableIds,
    requestDirectExcludedIds: session.requestDirectExcludedIds,
    substituteHoldExcludedIds: session.substituteHoldExcludedIds,
    candidateDecisions: [],
    operatorReviewNote: "",
    blockerCount: 0,
    warningCount: 0,
    decisionSnapshotId: null,
  };
}

// ── Review Readiness ──
export interface CompareReviewReadinessResult {
  status: CompareReviewStatus;
  blockers: string[];
  warnings: string[];
  canComplete: boolean;
}

export function evaluateCompareReviewReadiness(
  state: CompareReopenV2ReviewState,
  session: CompareReviewSessionV2,
): CompareReviewReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.compareReviewSessionV2Id) blockers.push("Compare review session lineage 없음");

  // Candidate coverage
  const totalSessionCandidates = session.compareCandidateIds.length;
  const decidedIds = new Set(state.candidateDecisions.map(d => d.candidateId));
  const undecided = totalSessionCandidates - decidedIds.size;

  if (state.candidateDecisions.length === 0) {
    blockers.push("Review decision이 하나도 없습니다");
  } else if (undecided > 0) {
    blockers.push(`${undecided}건 candidate review 미완료`);
  }

  // Shortlist integrity
  const shortlisted = state.candidateDecisions.filter(d => d.reviewAction === "shortlist_candidate");
  const excluded = state.candidateDecisions.filter(d => d.reviewAction === "exclude_candidate");
  const held = state.candidateDecisions.filter(d => d.reviewAction === "hold_candidate");
  const underReview = state.candidateDecisions.filter(d => d.reviewAction === "keep_under_review");

  if (underReview.length > 0) {
    blockers.push(`${underReview.length}건 candidate가 아직 review 미확정`);
  }

  if (shortlisted.length === 0) {
    blockers.push("Shortlist 후보가 없습니다");
  }

  // Rationale completeness
  const noRationale = state.candidateDecisions.filter(
    d => d.reviewAction !== "keep_under_review" && d.rationaleCodes.length === 0
  );
  if (noRationale.length > 0) {
    blockers.push(`${noRationale.length}건 review decision에 rationale이 없음`);
  }

  // Excluded contamination guard
  const shortlistExcludedOverlap = state.candidateDecisions.filter(d => d.shortlistFlag && d.excludeFlag);
  if (shortlistExcludedOverlap.length > 0) {
    blockers.push(`${shortlistExcludedOverlap.length}건 candidate가 shortlist와 exclude에 동시 배정`);
  }

  // Hold + shortlist overlap guard
  const shortlistHoldOverlap = state.candidateDecisions.filter(d => d.shortlistFlag && d.holdFlag);
  if (shortlistHoldOverlap.length > 0) {
    blockers.push(`${shortlistHoldOverlap.length}건 candidate가 shortlist와 hold에 동시 배정`);
  }

  // Provenance integrity
  for (const d of state.candidateDecisions) {
    const isExact = state.exactComparableIds.includes(d.candidateId);
    const isEquivalent = state.equivalentComparableIds.includes(d.candidateId);
    if (isExact && d.provenance !== "exact") {
      warnings.push(`Candidate ${d.candidateId}: exact provenance 불일치`);
    }
    if (isEquivalent && d.provenance !== "equivalent") {
      warnings.push(`Candidate ${d.candidateId}: equivalent provenance 불일치`);
    }
  }

  // Delta-first guard
  if (state.deltaFirstAxis.length === 0) {
    blockers.push("Delta-first 비교 축 없음");
  }

  // Compare group guard
  if (state.compareGroups.length === 0) {
    blockers.push("Compare group 없음");
  }

  // Lane balance
  const exactShortlisted = shortlisted.filter(d => d.provenance === "exact").length;
  const eqShortlisted = shortlisted.filter(d => d.provenance === "equivalent").length;
  if (exactShortlisted === 0 && eqShortlisted > 0) {
    warnings.push("Shortlist에 exact match가 없고 equivalent만 존재");
  }

  const status: CompareReviewStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "completed";

  // Batch 1: warning에서도 completion 금지 (보수적)
  return { status, blockers, warnings, canComplete: status === "completed" };
}

// ── Decision Snapshot Status ──
export type DecisionSnapshotStatus = "shortlist_ready" | "mixed_decision_ready" | "held_for_followup" | "blocked" | "cancelled";

// ── Rationale Summary ──
export interface CandidateRationale {
  candidateId: string;
  provenance: "exact" | "equivalent";
  action: CompareReviewAction;
  rationaleCodes: CompareRationaleCode[];
  operatorNote: string;
}

// ── Canonical Compare Decision Snapshot V2 ──
export interface CompareDecisionSnapshotV2 {
  id: string;
  sourceCompareReviewSessionV2Id: string;
  sourceCompareReopenHandoffPackageV2Id: string;
  sourceSourcingResultReviewObjectV2Id: string;
  poRecordId: string;
  compareGroups: CompareGroup[];
  shortlistCandidateIds: string[];
  excludedCandidateIds: string[];
  heldCandidateIds: string[];
  provenanceByCandidate: LaneProvenance[];
  deltaFirstAxis: DeltaFirstAxis[];
  rationaleByCandidate: CandidateRationale[];
  operatorReviewNote: string;
  createdAt: string;
  createdBy: string;
  status: DecisionSnapshotStatus;
  nextDestination: string;
}

export function buildCompareDecisionSnapshotV2(
  state: CompareReopenV2ReviewState,
  session: CompareReviewSessionV2,
): CompareDecisionSnapshotV2 | null {
  const readiness = evaluateCompareReviewReadiness(state, session);
  if (!readiness.canComplete) return null;

  const shortlistIds = state.candidateDecisions.filter(d => d.shortlistFlag).map(d => d.candidateId);
  const excludedIds = state.candidateDecisions.filter(d => d.excludeFlag).map(d => d.candidateId);
  const heldIds = state.candidateDecisions.filter(d => d.holdFlag).map(d => d.candidateId);

  const provenanceByCandidate: LaneProvenance[] = state.candidateDecisions.map(d => ({
    candidateId: d.candidateId,
    originalLane: d.provenance,
    triageAction: d.reviewAction === "shortlist_candidate" ? "promote_to_compare" : d.reviewAction === "exclude_candidate" ? "exclude_from_flow" : "hold_for_substitute_review",
    classification: d.provenance === "exact" ? "exact_comparable" : "equivalent_comparable",
  }));

  const rationaleByCandidate: CandidateRationale[] = state.candidateDecisions
    .filter(d => d.rationaleCodes.length > 0)
    .map(d => ({
      candidateId: d.candidateId,
      provenance: d.provenance,
      action: d.reviewAction,
      rationaleCodes: d.rationaleCodes,
      operatorNote: d.operatorNote,
    }));

  const hasHeld = heldIds.length > 0;
  const hasShortlist = shortlistIds.length > 0;

  const status: DecisionSnapshotStatus =
    !hasShortlist ? "blocked"
    : hasHeld ? "mixed_decision_ready"
    : "shortlist_ready";

  const nextDest =
    status === "shortlist_ready" ? "approval_handoff_gate"
    : status === "mixed_decision_ready" ? "approval_handoff_gate"
    : "compare_review_correction";

  return {
    id: `cmpdecv2_${Date.now().toString(36)}`,
    sourceCompareReviewSessionV2Id: state.compareReviewSessionV2Id,
    sourceCompareReopenHandoffPackageV2Id: state.sourceHandoffPackageV2Id,
    sourceSourcingResultReviewObjectV2Id: state.sourceReviewObjectV2Id,
    poRecordId: state.poRecordId,
    compareGroups: state.compareGroups,
    shortlistCandidateIds: shortlistIds,
    excludedCandidateIds: excludedIds,
    heldCandidateIds: heldIds,
    provenanceByCandidate,
    deltaFirstAxis: state.deltaFirstAxis,
    rationaleByCandidate,
    operatorReviewNote: state.operatorReviewNote,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status,
    nextDestination: nextDest,
  };
}

// ── Activity Events ──
export type CompareReviewEventType =
  | "compare_review_opened"
  | "compare_review_saved"
  | "compare_review_hold_set"
  | "compare_review_blocker_detected"
  | "compare_review_warning_detected"
  | "compare_review_completed"
  | "compare_decision_snapshot_v2_created"
  | "compare_ready_for_approval_gate";

export interface CompareReviewEvent {
  type: CompareReviewEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  compareReviewSessionV2Id: string;
  decisionSnapshotV2Id: string | null;
  changedFields: string[];
  destination: string;
}

export function createCompareReviewEvent(
  type: CompareReviewEventType,
  state: CompareReopenV2ReviewState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): CompareReviewEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    compareReviewSessionV2Id: state.compareReviewSessionV2Id,
    decisionSnapshotV2Id: state.decisionSnapshotId,
    changedFields,
    destination,
  };
}
