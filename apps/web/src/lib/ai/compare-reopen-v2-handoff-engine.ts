/**
 * Compare Reopen v2 Handoff Engine — review object → compare handoff package
 *
 * 고정 규칙:
 * 1. sourcingResultReviewObjectV2 = 단일 입력 source.
 * 2. compare_ready ≠ compare review started. handoff ready 이후에만 넘기기.
 * 3. scope/group/delta/route/context 5개 readiness 축 분리 평가.
 * 4. request-direct / substitute-hold / excluded는 compare scope에서 명시적 제외.
 * 5. delta-first compare axis를 upstream에서 잠금 — compare가 다시 기준 선택면 금지.
 * 6. canonical compareReopenHandoffPackageV2 = Compare Reopen v2의 단일 intake source.
 * 7. actual compare review / shortlist / exclude decision은 이 단계에서 금지.
 */

import type { SourcingResultReviewObjectV2, ReviewObjectStatus, LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";
import type { SearchResultCandidate } from "./sourcing-search-reopen-execution-engine";

// ── Handoff Status ──
export type CompareReopenHandoffStatus = "not_started" | "blocked" | "warning" | "ready" | "handed_off";

// ── Readiness Axis ──
export type CompareHandoffAxis = "scope_compare_ready" | "group_compare_ready" | "delta_compare_ready" | "route_compare_ready" | "context_compare_ready";
export type CompareHandoffAxisStatus = "ok" | "warning" | "blocked";

export interface CompareHandoffAxisResult {
  axis: CompareHandoffAxis;
  status: CompareHandoffAxisStatus;
  detail: string;
}

// ── Delta-First Compare Axis ──
export type DeltaFirstAxis = "price" | "lead_time" | "availability" | "pack_size" | "vendor_reliability" | "policy_fit";

// ── Compare Group ──
export interface CompareGroup {
  groupId: string;
  candidateIds: string[];
  groupBasis: string;
}

// ── Exception Flag ──
export type CompareHandoffExceptionFlag =
  | "scope_empty"
  | "group_unassigned"
  | "delta_axis_missing"
  | "request_direct_contamination"
  | "substitute_hold_contamination"
  | "excluded_contamination"
  | "mixed_route_unsplit"
  | "prior_context_bias"
  | "category_mismatch_in_group";

// ── Handoff Decision ──
export interface CompareReopenHandoffDecision {
  compareScope: string;
  compareCandidateIds: string[];
  compareGroups: CompareGroup[];
  exactComparableIds: string[];
  equivalentComparableIds: string[];
  deltaFirstAxis: DeltaFirstAxis[];
  requestDirectExcludedIds: string[];
  substituteHoldExcludedIds: string[];
  priorVendorReferenceVisible: boolean;
  priorQuoteReferenceVisible: boolean;
  operatorNote: string;
  exceptionFlags: CompareHandoffExceptionFlag[];
}

// ── State ──
export interface CompareReopenV2HandoffState {
  handoffStatus: CompareReopenHandoffStatus;
  sourcingResultReviewObjectV2Id: string;
  sourceTriageSessionV2Id: string;
  sourceResultSetV2Id: string;
  sourceSearchRunId: string;
  poRecordId: string;
  reviewObjectStatus: ReviewObjectStatus;
  compareReadyCandidateCount: number;
  requestDirectCandidateCount: number;
  substituteHoldCandidateCount: number;
  excludedCandidateCount: number;
  mixedRoute: boolean;
  laneProvenance: LaneProvenance[];
  axisResults: CompareHandoffAxisResult[];
  decision: CompareReopenHandoffDecision | null;
  blockerCount: number;
  warningCount: number;
  handoffPackageId: string | null;
  compareReopenCaseId: string | null;
}

export function createInitialCompareReopenHandoffState(reviewObj: SourcingResultReviewObjectV2): CompareReopenV2HandoffState {
  const axes = evaluateCompareHandoffAxes(reviewObj, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    handoffStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    sourcingResultReviewObjectV2Id: reviewObj.id,
    sourceTriageSessionV2Id: reviewObj.sourceTriageSessionV2Id,
    sourceResultSetV2Id: reviewObj.sourceResultSetV2Id,
    sourceSearchRunId: reviewObj.sourceSearchRunId,
    poRecordId: reviewObj.poRecordId,
    reviewObjectStatus: reviewObj.status,
    compareReadyCandidateCount: reviewObj.compareReadyCandidates.length,
    requestDirectCandidateCount: reviewObj.requestDirectCandidates.length,
    substituteHoldCandidateCount: reviewObj.substituteHoldCandidates.length,
    excludedCandidateCount: reviewObj.excludedCandidates.length,
    mixedRoute: reviewObj.mixedRoute,
    laneProvenance: reviewObj.laneProvenanceByCandidate,
    axisResults: axes,
    decision: null,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    handoffPackageId: null,
    compareReopenCaseId: null,
  };
}

// ── Readiness Axes Evaluation ──
export function evaluateCompareHandoffAxes(reviewObj: SourcingResultReviewObjectV2, decision: CompareReopenHandoffDecision | null): CompareHandoffAxisResult[] {
  const results: CompareHandoffAxisResult[] = [];

  // 1. Scope compare ready
  if (reviewObj.status !== "compare_ready" && reviewObj.status !== "mixed_route_ready") {
    results.push({ axis: "scope_compare_ready", status: "blocked", detail: "Review object가 compare 가능한 상태가 아님" });
  } else if (reviewObj.compareReadyCandidates.length === 0) {
    results.push({ axis: "scope_compare_ready", status: "blocked", detail: "Compare-ready candidate가 없음" });
  } else if (decision && decision.compareCandidateIds.length === 0) {
    results.push({ axis: "scope_compare_ready", status: "blocked", detail: "Compare scope candidate 미지정" });
  } else if (decision?.compareCandidateIds.length) {
    results.push({ axis: "scope_compare_ready", status: "ok", detail: `${decision.compareCandidateIds.length}건 compare scope 확인됨` });
  } else {
    results.push({ axis: "scope_compare_ready", status: "blocked", detail: "Compare scope 미입력" });
  }

  // 2. Group compare ready
  if (decision && decision.compareGroups.length > 0) {
    const ungrouped = decision.compareCandidateIds.filter(
      id => !decision.compareGroups.some(g => g.candidateIds.includes(id))
    );
    if (ungrouped.length > 0) {
      results.push({ axis: "group_compare_ready", status: "blocked", detail: `${ungrouped.length}건 candidate가 compare group에 미배정` });
    } else {
      results.push({ axis: "group_compare_ready", status: "ok", detail: "Compare group 배정 완료" });
    }
  } else if (decision && decision.compareCandidateIds.length > 0) {
    results.push({ axis: "group_compare_ready", status: "blocked", detail: "Compare group 미구성" });
  } else {
    results.push({ axis: "group_compare_ready", status: "blocked", detail: "Compare group 미입력" });
  }

  // 3. Delta compare ready
  if (decision && decision.deltaFirstAxis.length > 0) {
    results.push({ axis: "delta_compare_ready", status: "ok", detail: `Delta axis: ${decision.deltaFirstAxis.join(", ")}` });
  } else {
    results.push({ axis: "delta_compare_ready", status: "blocked", detail: "Delta-first 비교 축 미설정" });
  }

  // 4. Route compare ready
  if (decision) {
    const contamination: string[] = [];
    if (decision.exceptionFlags.includes("request_direct_contamination")) contamination.push("request-direct");
    if (decision.exceptionFlags.includes("substitute_hold_contamination")) contamination.push("substitute-hold");
    if (decision.exceptionFlags.includes("excluded_contamination")) contamination.push("excluded");

    if (contamination.length > 0) {
      results.push({ axis: "route_compare_ready", status: "blocked", detail: `Compare scope에 ${contamination.join(", ")} 후보 혼입` });
    } else if (reviewObj.mixedRoute && decision.exceptionFlags.includes("mixed_route_unsplit")) {
      results.push({ axis: "route_compare_ready", status: "blocked", detail: "Mixed-route 분리 미완료" });
    } else {
      results.push({ axis: "route_compare_ready", status: "ok", detail: "Route 분리 완료" });
    }
  } else {
    results.push({ axis: "route_compare_ready", status: "blocked", detail: "Route 분리 미확인" });
  }

  // 5. Context compare ready
  if (decision) {
    if (decision.exceptionFlags.includes("prior_context_bias")) {
      results.push({ axis: "context_compare_ready", status: "warning", detail: "Prior context 편향 가능성" });
    } else if (decision.exceptionFlags.includes("category_mismatch_in_group")) {
      results.push({ axis: "context_compare_ready", status: "warning", detail: "Compare group 내 category 불일치" });
    } else {
      results.push({ axis: "context_compare_ready", status: "ok", detail: "Context 정리됨" });
    }
  } else {
    results.push({ axis: "context_compare_ready", status: "blocked", detail: "Context 미확인" });
  }

  return results;
}

// ── Handoff Readiness Aggregate ──
export interface CompareReopenHandoffReadinessResult {
  status: CompareReopenHandoffStatus;
  blockers: string[];
  warnings: string[];
  canHandoff: boolean;
}

export function evaluateCompareReopenHandoffReadiness(state: CompareReopenV2HandoffState): CompareReopenHandoffReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.sourcingResultReviewObjectV2Id) blockers.push("Review object lineage 없음");
  if (state.reviewObjectStatus !== "compare_ready" && state.reviewObjectStatus !== "mixed_route_ready") {
    blockers.push("Review object가 compare 가능한 상태가 아님");
  }

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Decision completeness
  if (!state.decision) {
    blockers.push("Compare handoff decision 미완료");
  } else {
    if (state.decision.compareCandidateIds.length === 0) blockers.push("Compare candidate 없음");
    if (state.decision.compareGroups.length === 0) blockers.push("Compare group 미구성");
    if (state.decision.deltaFirstAxis.length === 0) blockers.push("Delta-first axis 미설정");

    // Contamination check
    const compareIds = new Set(state.decision.compareCandidateIds);
    const requestIds = new Set(state.decision.requestDirectExcludedIds);
    const substituteIds = new Set(state.decision.substituteHoldExcludedIds);

    for (const id of compareIds) {
      if (requestIds.has(id)) blockers.push(`Candidate ${id}가 compare와 request-direct에 동시 포함`);
      if (substituteIds.has(id)) blockers.push(`Candidate ${id}가 compare와 substitute-hold에 동시 포함`);
    }
  }

  const status: CompareReopenHandoffStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 handoff 금지 (보수적)
  return { status, blockers, warnings, canHandoff: status === "ready" };
}

// ── Canonical Compare Reopen Handoff Package V2 ──
export interface CompareReopenHandoffPackageV2 {
  id: string;
  sourcingResultReviewObjectV2Id: string;
  sourceTriageSessionV2Id: string;
  sourceResultSetV2Id: string;
  sourceSearchRunId: string;
  poRecordId: string;
  compareScope: string;
  compareCandidateIds: string[];
  compareCandidates: SearchResultCandidate[];
  compareGroups: CompareGroup[];
  exactComparableIds: string[];
  equivalentComparableIds: string[];
  deltaFirstAxis: DeltaFirstAxis[];
  requestDirectExcludedIds: string[];
  substituteHoldExcludedIds: string[];
  laneProvenance: LaneProvenance[];
  priorVendorReferenceVisible: boolean;
  priorQuoteReferenceVisible: boolean;
  operatorNote: string;
  exceptionFlags: CompareHandoffExceptionFlag[];
  createdAt: string;
  createdBy: string;
  nextDestination: string;
}

export function buildCompareReopenHandoffPackageV2(
  state: CompareReopenV2HandoffState,
  reviewObj: SourcingResultReviewObjectV2,
): CompareReopenHandoffPackageV2 | null {
  if (!state.decision) return null;
  const readiness = evaluateCompareReopenHandoffReadiness(state);
  if (!readiness.canHandoff) return null;

  const d = state.decision;
  const candidateSet = new Set(d.compareCandidateIds);
  const compareCandidates = reviewObj.compareReadyCandidates.filter(c => candidateSet.has(c.candidateId));
  const relevantProvenance = state.laneProvenance.filter(p => candidateSet.has(p.candidateId));

  return {
    id: `cmpreopkg_${Date.now().toString(36)}`,
    sourcingResultReviewObjectV2Id: state.sourcingResultReviewObjectV2Id,
    sourceTriageSessionV2Id: state.sourceTriageSessionV2Id,
    sourceResultSetV2Id: state.sourceResultSetV2Id,
    sourceSearchRunId: state.sourceSearchRunId,
    poRecordId: state.poRecordId,
    compareScope: d.compareScope,
    compareCandidateIds: d.compareCandidateIds,
    compareCandidates,
    compareGroups: d.compareGroups,
    exactComparableIds: d.exactComparableIds,
    equivalentComparableIds: d.equivalentComparableIds,
    deltaFirstAxis: d.deltaFirstAxis,
    requestDirectExcludedIds: d.requestDirectExcludedIds,
    substituteHoldExcludedIds: d.substituteHoldExcludedIds,
    laneProvenance: relevantProvenance,
    priorVendorReferenceVisible: d.priorVendorReferenceVisible,
    priorQuoteReferenceVisible: d.priorQuoteReferenceVisible,
    operatorNote: d.operatorNote,
    exceptionFlags: d.exceptionFlags,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    nextDestination: "compare_reopen_v2",
  };
}

// ── Canonical Compare Reopen Case V2 ──
export interface CompareReopenCaseV2 {
  id: string;
  sourceHandoffPackageV2Id: string;
  status: "queued" | "opened" | "hydrating" | "ready_for_compare_review" | "on_hold" | "cancelled";
  openedAt: string;
  openedBy: string;
  targetWorkbench: string;
  nextDestination: string;
}

export function buildCompareReopenCaseV2(pkg: CompareReopenHandoffPackageV2): CompareReopenCaseV2 {
  return {
    id: `cmpreocase_${Date.now().toString(36)}`,
    sourceHandoffPackageV2Id: pkg.id,
    status: "queued",
    openedAt: new Date().toISOString(),
    openedBy: "operator",
    targetWorkbench: "compare_reopen_v2",
    nextDestination: "compare_reopen_v2",
  };
}

// ── Activity Events ──
export type CompareReopenHandoffEventType =
  | "compare_reopen_handoff_opened"
  | "compare_reopen_handoff_saved"
  | "compare_reopen_handoff_hold_set"
  | "compare_reopen_handoff_blocker_detected"
  | "compare_reopen_handoff_warning_detected"
  | "compare_reopen_handoff_package_v2_created"
  | "compare_reopen_case_v2_created"
  | "compare_reopen_handoff_completed";

export interface CompareReopenHandoffEvent {
  type: CompareReopenHandoffEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  reviewObjectV2Id: string;
  handoffPackageV2Id: string | null;
  compareReopenCaseV2Id: string | null;
  changedFields: string[];
  destination: string;
}

export function createCompareReopenHandoffEvent(
  type: CompareReopenHandoffEventType,
  state: CompareReopenV2HandoffState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): CompareReopenHandoffEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    reviewObjectV2Id: state.sourcingResultReviewObjectV2Id,
    handoffPackageV2Id: state.handoffPackageId,
    compareReopenCaseV2Id: state.compareReopenCaseId,
    changedFields,
    destination,
  };
}
