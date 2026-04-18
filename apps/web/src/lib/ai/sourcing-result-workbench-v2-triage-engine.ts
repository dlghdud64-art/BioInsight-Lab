/**
 * Sourcing Search Result Workbench v2 Triage Engine — candidate triage → review object
 *
 * 고정 규칙:
 * 1. sourcingResultTriageSessionV2 = 단일 입력 source.
 * 2. ready_for_result_triage ≠ compare ready. triage decision 이후에만 review object 생성.
 * 3. Exact / Equivalent / Substitute / Excluded lane 구조 유지 — flat collapse 금지.
 * 4. compare decision / request submission은 이 단계에서 금지.
 * 5. compare-ready / request-direct / substitute-hold / excluded 4분류 triage action.
 * 6. canonical sourcingResultReviewObjectV2 = downstream compare/request의 단일 intake.
 * 7. triage → canonical review object → downstream handoff 순서 강제.
 */

import type { SearchResultCandidate } from "./sourcing-search-reopen-execution-engine";
import type { SourcingResultTriageSessionV2, LaneVisibility, CompareEligiblePreview, ResultIntakePrecheckFlag } from "./sourcing-result-workbench-v2-intake-engine";

// ── Triage Status ──
export type ResultTriageStatus = "blocked" | "warning" | "ready" | "in_progress" | "completed" | "failed";

// ── Triage Action ──
export type TriageAction = "promote_to_compare" | "hold_for_substitute_review" | "route_to_request_direct" | "exclude_from_flow" | "keep_in_triage";

// ── Candidate Classification ──
export type TriageCandidateClassification = "exact_comparable" | "equivalent_comparable" | "substitute_hold" | "request_direct_candidate" | "excluded_candidate" | "blocked_candidate";

// ── Rationale Code ──
export type TriageRationaleCode =
  | "best_exact_match"
  | "strong_equivalent"
  | "price_competitive"
  | "lead_time_favorable"
  | "vendor_reliability"
  | "spec_compliance"
  | "substitute_acceptable"
  | "sole_source_direct"
  | "urgency_bypass"
  | "policy_exclusion"
  | "quality_exclusion"
  | "duplicate_exclusion"
  | "normalization_exclusion"
  | "operator_judgment";

// ── Per-Candidate Triage Decision ──
export interface CandidateTriageDecision {
  candidateId: string;
  laneType: "exact" | "equivalent" | "substitute";
  classification: TriageCandidateClassification;
  triageAction: TriageAction;
  compareEligible: boolean;
  requestDirectEligible: boolean;
  holdFlag: boolean;
  excludeFlag: boolean;
  rationaleCodes: TriageRationaleCode[];
  operatorNote: string;
}

// ── State ──
export interface SourcingResultTriageState {
  triageStatus: ResultTriageStatus;
  sourcingResultTriageSessionV2Id: string;
  sourceResultSetV2Id: string;
  sourceSearchRunId: string;
  poRecordId: string;
  searchScope: string;
  searchQtyByLine: string;
  laneVisibility: LaneVisibility;
  candidateDecisions: CandidateTriageDecision[];
  operatorTriageNote: string;
  blockerCount: number;
  warningCount: number;
  reviewObjectId: string | null;
}

export function createInitialResultTriageState(triageSession: SourcingResultTriageSessionV2): SourcingResultTriageState {
  return {
    triageStatus: "in_progress",
    sourcingResultTriageSessionV2Id: triageSession.id,
    sourceResultSetV2Id: triageSession.sourceResultSetV2Id,
    sourceSearchRunId: triageSession.sourceSearchRunId,
    poRecordId: triageSession.poRecordId,
    searchScope: triageSession.searchScope,
    searchQtyByLine: triageSession.searchQtyByLine,
    laneVisibility: triageSession.laneVisibility,
    candidateDecisions: [],
    operatorTriageNote: "",
    blockerCount: 0,
    warningCount: 0,
    reviewObjectId: null,
  };
}

// ── Triage Readiness ──
export interface ResultTriageReadinessResult {
  status: ResultTriageStatus;
  blockers: string[];
  warnings: string[];
  canComplete: boolean;
}

export function evaluateResultTriageReadiness(
  state: SourcingResultTriageState,
  triageSession: SourcingResultTriageSessionV2,
): ResultTriageReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.sourcingResultTriageSessionV2Id) blockers.push("Triage session lineage 없음");
  if (!state.sourceResultSetV2Id) blockers.push("Result set lineage 없음");

  // Candidate coverage
  const totalSessionCandidates =
    triageSession.exactCandidates.length +
    triageSession.equivalentCandidates.length +
    triageSession.substituteCandidates.length;

  const decidedCandidateIds = new Set(state.candidateDecisions.map(d => d.candidateId));
  const undecided = totalSessionCandidates - decidedCandidateIds.size;

  if (state.candidateDecisions.length === 0) {
    blockers.push("Triage decision이 하나도 없습니다");
  } else if (undecided > 0) {
    blockers.push(`${undecided}건 candidate triage 미완료`);
  }

  // Classification integrity
  const compareReady = state.candidateDecisions.filter(d => d.triageAction === "promote_to_compare");
  const requestDirect = state.candidateDecisions.filter(d => d.triageAction === "route_to_request_direct");
  const substituteHold = state.candidateDecisions.filter(d => d.triageAction === "hold_for_substitute_review");
  const excluded = state.candidateDecisions.filter(d => d.triageAction === "exclude_from_flow");
  const keepInTriage = state.candidateDecisions.filter(d => d.triageAction === "keep_in_triage");

  if (keepInTriage.length > 0) {
    blockers.push(`${keepInTriage.length}건 candidate가 아직 triage 미확정`);
  }

  // Compare-ready guard
  if (compareReady.length === 0 && requestDirect.length === 0) {
    blockers.push("Compare 후보도 request-direct 후보도 없습니다");
  }

  // Substitute lane guard
  const substitutePromoted = state.candidateDecisions.filter(
    d => d.laneType === "substitute" && d.triageAction === "promote_to_compare"
  );
  if (substitutePromoted.length > 0) {
    warnings.push(`${substitutePromoted.length}건 substitute candidate가 compare로 승격됨 — 정책 확인 필요`);
  }

  // Request-direct + compare overlap guard
  const dualRoute = state.candidateDecisions.filter(d => d.compareEligible && d.requestDirectEligible);
  if (dualRoute.length > 0) {
    blockers.push(`${dualRoute.length}건 candidate가 compare와 request-direct에 동시 배정됨`);
  }

  // Excluded contamination guard
  const excludedInCompare = state.candidateDecisions.filter(d => d.excludeFlag && d.triageAction === "promote_to_compare");
  if (excludedInCompare.length > 0) {
    blockers.push(`${excludedInCompare.length}건 excluded candidate가 compare lane에 포함됨`);
  }

  // Rationale guard
  const noRationale = state.candidateDecisions.filter(
    d => d.triageAction !== "keep_in_triage" && d.rationaleCodes.length === 0
  );
  if (noRationale.length > 0) {
    warnings.push(`${noRationale.length}건 triage decision에 rationale이 없음`);
  }

  // Lane balance warning
  if (compareReady.length > 0) {
    const exactCompare = compareReady.filter(d => d.laneType === "exact").length;
    const eqCompare = compareReady.filter(d => d.laneType === "equivalent").length;
    if (exactCompare === 0 && eqCompare > 0) warnings.push("Compare 후보에 exact match가 없고 equivalent만 존재");
  }

  const status: ResultTriageStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "completed";

  // Batch 1: warning에서도 completion 금지 (보수적)
  return { status, blockers, warnings, canComplete: status === "completed" };
}

// ── Review Object Status ──
export type ReviewObjectStatus = "compare_ready" | "request_direct_ready" | "mixed_route_ready" | "held_for_followup" | "blocked" | "cancelled";

// ── Lane Provenance ──
export interface LaneProvenance {
  candidateId: string;
  originalLane: "exact" | "equivalent" | "substitute";
  triageAction: TriageAction;
  classification: TriageCandidateClassification;
}

// ── Canonical Sourcing Result Review Object V2 ──
export interface SourcingResultReviewObjectV2 {
  id: string;
  sourceTriageSessionV2Id: string;
  sourceResultSetV2Id: string;
  sourceSearchRunId: string;
  poRecordId: string;
  compareReadyCandidates: SearchResultCandidate[];
  requestDirectCandidates: SearchResultCandidate[];
  substituteHoldCandidates: SearchResultCandidate[];
  excludedCandidates: SearchResultCandidate[];
  mixedRoute: boolean;
  laneProvenanceByCandidate: LaneProvenance[];
  triageRationaleSummary: string;
  operatorTriageNote: string;
  createdAt: string;
  createdBy: string;
  status: ReviewObjectStatus;
  nextDestination: string;
}

export function buildSourcingResultReviewObjectV2(
  state: SourcingResultTriageState,
  triageSession: SourcingResultTriageSessionV2,
): SourcingResultReviewObjectV2 | null {
  const readiness = evaluateResultTriageReadiness(state, triageSession);
  if (!readiness.canComplete) return null;

  const allCandidates = [
    ...triageSession.exactCandidates,
    ...triageSession.equivalentCandidates,
    ...triageSession.substituteCandidates,
  ];

  const candidateMap = new Map(allCandidates.map(c => [c.candidateId, c]));

  const compareReady: SearchResultCandidate[] = [];
  const requestDirect: SearchResultCandidate[] = [];
  const substituteHold: SearchResultCandidate[] = [];
  const excluded: SearchResultCandidate[] = [];
  const provenance: LaneProvenance[] = [];

  for (const d of state.candidateDecisions) {
    const candidate = candidateMap.get(d.candidateId);
    if (!candidate) continue;

    provenance.push({
      candidateId: d.candidateId,
      originalLane: d.laneType,
      triageAction: d.triageAction,
      classification: d.classification,
    });

    switch (d.triageAction) {
      case "promote_to_compare":
        compareReady.push(candidate);
        break;
      case "route_to_request_direct":
        requestDirect.push(candidate);
        break;
      case "hold_for_substitute_review":
        substituteHold.push(candidate);
        break;
      case "exclude_from_flow":
        excluded.push(candidate);
        break;
    }
  }

  // Add session-level excluded
  excluded.push(...triageSession.excludedCandidates);

  const hasCompare = compareReady.length > 0;
  const hasRequestDirect = requestDirect.length > 0;
  const mixedRoute = hasCompare && hasRequestDirect;

  const status: ReviewObjectStatus =
    mixedRoute ? "mixed_route_ready"
    : hasCompare ? "compare_ready"
    : hasRequestDirect ? "request_direct_ready"
    : substituteHold.length > 0 ? "held_for_followup"
    : "blocked";

  const nextDest =
    status === "compare_ready" ? "compare_reopen_v2"
    : status === "request_direct_ready" ? "request_direct"
    : status === "mixed_route_ready" ? "mixed_route_handoff"
    : status === "held_for_followup" ? "substitute_followup"
    : "triage_correction";

  const rationaleSummary = state.candidateDecisions
    .filter(d => d.rationaleCodes.length > 0)
    .map(d => `${d.candidateId}: ${d.rationaleCodes.join(", ")}`)
    .join("; ");

  return {
    id: `srchrevv2_${Date.now().toString(36)}`,
    sourceTriageSessionV2Id: state.sourcingResultTriageSessionV2Id,
    sourceResultSetV2Id: state.sourceResultSetV2Id,
    sourceSearchRunId: state.sourceSearchRunId,
    poRecordId: state.poRecordId,
    compareReadyCandidates: compareReady,
    requestDirectCandidates: requestDirect,
    substituteHoldCandidates: substituteHold,
    excludedCandidates: excluded,
    mixedRoute,
    laneProvenanceByCandidate: provenance,
    triageRationaleSummary: rationaleSummary,
    operatorTriageNote: state.operatorTriageNote,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status,
    nextDestination: nextDest,
  };
}

// ── Activity Events ──
export type ResultTriageEventType =
  | "sourcing_result_triage_opened"
  | "sourcing_result_triage_saved"
  | "sourcing_result_triage_hold_set"
  | "sourcing_result_triage_blocker_detected"
  | "sourcing_result_triage_warning_detected"
  | "sourcing_result_triage_completed"
  | "sourcing_result_review_object_v2_created"
  | "compare_route_handoff_ready"
  | "request_direct_route_handoff_ready";

export interface ResultTriageEvent {
  type: ResultTriageEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  triageSessionV2Id: string;
  reviewObjectV2Id: string | null;
  changedFields: string[];
  destination: string;
}

export function createResultTriageEvent(
  type: ResultTriageEventType,
  state: SourcingResultTriageState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): ResultTriageEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    triageSessionV2Id: state.sourcingResultTriageSessionV2Id,
    reviewObjectV2Id: state.reviewObjectId,
    changedFields,
    destination,
  };
}
