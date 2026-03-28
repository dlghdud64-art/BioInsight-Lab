/**
 * Compare Reopen v2 Intake Hydration Engine — handoff package → compare review session
 *
 * 고정 규칙:
 * 1. compareReopenHandoffPackageV2 = 단일 입력 source.
 * 2. opened ≠ review started. hydration ready 이후에만 review session 생성.
 * 3. scope/group/delta/route/review 5개 hydration 축 분리 평가.
 * 4. exact/equivalent provenance 유지 — flat list 회귀 금지.
 * 5. prior context는 reference visibility만 — compare truth 오염 금지.
 * 6. canonical compareReviewSessionV2 = actual review의 단일 source of truth.
 * 7. shortlist / exclude / rationale decision은 이 단계에서 금지.
 * 8. open → hydrate → ready → review 순서 강제.
 */

import type { CompareReopenHandoffPackageV2, CompareReopenCaseV2, CompareGroup, DeltaFirstAxis, CompareHandoffExceptionFlag } from "./compare-reopen-v2-handoff-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";
import type { SearchResultCandidate } from "./sourcing-search-reopen-execution-engine";

// ── Hydration Status ──
export type CompareHydrationStatus = "not_started" | "blocked" | "warning" | "ready" | "hydrated";

// ── Readiness Axis ──
export type CompareHydrationAxis = "scope_hydration_ready" | "group_hydration_ready" | "delta_hydration_ready" | "route_hydration_ready" | "review_execution_ready";
export type CompareHydrationAxisStatus = "ok" | "warning" | "blocked";

export interface CompareHydrationAxisResult {
  axis: CompareHydrationAxis;
  status: CompareHydrationAxisStatus;
  detail: string;
}

// ── Precheck Flag ──
export type CompareHydrationPrecheckFlag =
  | "scope_empty"
  | "group_broken"
  | "delta_axis_missing"
  | "request_direct_contamination"
  | "substitute_hold_contamination"
  | "excluded_contamination"
  | "provenance_broken"
  | "prior_vendor_bias"
  | "prior_quote_stale"
  | "category_mismatch";

// ── State ──
export interface CompareReopenV2HydrationState {
  hydrationStatus: CompareHydrationStatus;
  compareReopenCaseV2Id: string;
  handoffPackageV2Id: string;
  poRecordId: string;
  compareScope: string;
  compareCandidateIds: string[];
  compareGroups: CompareGroup[];
  exactComparableIds: string[];
  equivalentComparableIds: string[];
  deltaFirstAxis: DeltaFirstAxis[];
  requestDirectExcludedIds: string[];
  substituteHoldExcludedIds: string[];
  laneProvenance: LaneProvenance[];
  priorVendorReferenceVisible: boolean;
  priorQuoteReferenceVisible: boolean;
  axisResults: CompareHydrationAxisResult[];
  operatorPrepNote: string;
  precheckFlags: CompareHydrationPrecheckFlag[];
  blockerCount: number;
  warningCount: number;
  reviewSessionId: string | null;
  correctionRouteId: string | null;
}

export function createInitialCompareHydrationState(
  pkg: CompareReopenHandoffPackageV2,
  reopenCase: CompareReopenCaseV2,
): CompareReopenV2HydrationState {
  const axes = evaluateCompareHydrationAxes(pkg, []);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    hydrationStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    compareReopenCaseV2Id: reopenCase.id,
    handoffPackageV2Id: pkg.id,
    poRecordId: pkg.poRecordId,
    compareScope: pkg.compareScope,
    compareCandidateIds: pkg.compareCandidateIds,
    compareGroups: pkg.compareGroups,
    exactComparableIds: pkg.exactComparableIds,
    equivalentComparableIds: pkg.equivalentComparableIds,
    deltaFirstAxis: pkg.deltaFirstAxis,
    requestDirectExcludedIds: pkg.requestDirectExcludedIds,
    substituteHoldExcludedIds: pkg.substituteHoldExcludedIds,
    laneProvenance: pkg.laneProvenance,
    priorVendorReferenceVisible: pkg.priorVendorReferenceVisible,
    priorQuoteReferenceVisible: pkg.priorQuoteReferenceVisible,
    axisResults: axes,
    operatorPrepNote: "",
    precheckFlags: [],
    blockerCount: blockers.length,
    warningCount: warnings.length,
    reviewSessionId: null,
    correctionRouteId: null,
  };
}

// ── Hydration Axes Evaluation ──
export function evaluateCompareHydrationAxes(pkg: CompareReopenHandoffPackageV2, precheckFlags: CompareHydrationPrecheckFlag[]): CompareHydrationAxisResult[] {
  const results: CompareHydrationAxisResult[] = [];

  // 1. Scope hydration ready
  if (pkg.compareCandidateIds.length === 0) {
    results.push({ axis: "scope_hydration_ready", status: "blocked", detail: "Compare scope에 candidate 없음" });
  } else if (precheckFlags.includes("scope_empty")) {
    results.push({ axis: "scope_hydration_ready", status: "blocked", detail: "Scope hydrate 실패" });
  } else {
    results.push({ axis: "scope_hydration_ready", status: "ok", detail: `${pkg.compareCandidateIds.length}건 compare scope hydrate 준비` });
  }

  // 2. Group hydration ready
  if (pkg.compareGroups.length === 0) {
    results.push({ axis: "group_hydration_ready", status: "blocked", detail: "Compare group 없음" });
  } else if (precheckFlags.includes("group_broken")) {
    results.push({ axis: "group_hydration_ready", status: "blocked", detail: "Compare group 구조 깨짐" });
  } else if (precheckFlags.includes("category_mismatch")) {
    results.push({ axis: "group_hydration_ready", status: "warning", detail: "Compare group 내 category 불일치 가능성" });
  } else {
    const totalGrouped = pkg.compareGroups.reduce((sum, g) => sum + g.candidateIds.length, 0);
    const ungrouped = pkg.compareCandidateIds.length - totalGrouped;
    if (ungrouped > 0) {
      results.push({ axis: "group_hydration_ready", status: "blocked", detail: `${ungrouped}건 candidate가 group에 미배정` });
    } else {
      results.push({ axis: "group_hydration_ready", status: "ok", detail: "Compare group hydrate 준비 완료" });
    }
  }

  // 3. Delta hydration ready
  if (pkg.deltaFirstAxis.length === 0) {
    results.push({ axis: "delta_hydration_ready", status: "blocked", detail: "Delta-first 비교 축 없음" });
  } else {
    results.push({ axis: "delta_hydration_ready", status: "ok", detail: `Delta axis: ${pkg.deltaFirstAxis.join(", ")}` });
  }

  // 4. Route hydration ready
  const contamination: string[] = [];
  if (precheckFlags.includes("request_direct_contamination")) contamination.push("request-direct");
  if (precheckFlags.includes("substitute_hold_contamination")) contamination.push("substitute-hold");
  if (precheckFlags.includes("excluded_contamination")) contamination.push("excluded");

  if (contamination.length > 0) {
    results.push({ axis: "route_hydration_ready", status: "blocked", detail: `Compare session에 ${contamination.join(", ")} 혼입` });
  } else {
    results.push({ axis: "route_hydration_ready", status: "ok", detail: "Excluded route 분리됨" });
  }

  // 5. Review execution ready
  const hasBlocker = results.some(r => r.status === "blocked");
  if (hasBlocker) {
    results.push({ axis: "review_execution_ready", status: "blocked", detail: "Hydration blocker 존재" });
  } else if (precheckFlags.includes("prior_vendor_bias")) {
    results.push({ axis: "review_execution_ready", status: "warning", detail: "Prior vendor 편향 가능성" });
  } else if (precheckFlags.includes("prior_quote_stale")) {
    results.push({ axis: "review_execution_ready", status: "warning", detail: "Prior quote reference가 stale" });
  } else {
    results.push({ axis: "review_execution_ready", status: "ok", detail: "Review 시작 가능" });
  }

  return results;
}

// ── Hydration Readiness Aggregate ──
export interface CompareHydrationReadinessResult {
  status: CompareHydrationStatus;
  blockers: string[];
  warnings: string[];
  canComplete: boolean;
}

export function evaluateCompareHydrationReadiness(state: CompareReopenV2HydrationState): CompareHydrationReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.handoffPackageV2Id) blockers.push("Handoff package lineage 없음");
  if (!state.compareReopenCaseV2Id) blockers.push("Compare reopen case lineage 없음");

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Precheck flags
  if (state.precheckFlags.includes("scope_empty")) blockers.push("Compare scope 비어 있음");
  if (state.precheckFlags.includes("group_broken")) blockers.push("Compare group 구조 깨짐");
  if (state.precheckFlags.includes("delta_axis_missing")) blockers.push("Delta axis 누락");
  if (state.precheckFlags.includes("request_direct_contamination")) blockers.push("Request-direct 혼입");
  if (state.precheckFlags.includes("substitute_hold_contamination")) blockers.push("Substitute-hold 혼입");
  if (state.precheckFlags.includes("excluded_contamination")) blockers.push("Excluded 혼입");
  if (state.precheckFlags.includes("provenance_broken")) blockers.push("Lane provenance 깨짐");
  if (state.precheckFlags.includes("prior_vendor_bias")) warnings.push("Prior vendor 편향 가능성");
  if (state.precheckFlags.includes("prior_quote_stale")) warnings.push("Prior quote stale");
  if (state.precheckFlags.includes("category_mismatch")) warnings.push("Category 불일치 가능성");

  const status: CompareHydrationStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 completion 금지 (보수적)
  return { status, blockers, warnings, canComplete: status === "ready" };
}

// ── Compare Review Session Status ──
export type CompareReviewSessionStatus = "initialized" | "hydrated" | "ready_for_compare_review" | "review_in_progress" | "review_completed" | "cancelled";

// ── Canonical Compare Review Session V2 ──
export interface CompareReviewSessionV2 {
  id: string;
  sourceHandoffPackageV2Id: string;
  sourceCompareReopenCaseV2Id: string;
  poRecordId: string;
  compareScope: string;
  compareCandidateIds: string[];
  compareCandidates: SearchResultCandidate[];
  compareGroups: CompareGroup[];
  exactComparableIds: string[];
  equivalentComparableIds: string[];
  deltaFirstAxis: DeltaFirstAxis[];
  laneProvenance: LaneProvenance[];
  priorVendorReferenceVisible: boolean;
  priorQuoteReferenceVisible: boolean;
  requestDirectExcludedIds: string[];
  substituteHoldExcludedIds: string[];
  operatorPrepNote: string;
  precheckFlags: CompareHydrationPrecheckFlag[];
  hydratedAt: string;
  hydratedBy: string;
  status: CompareReviewSessionStatus;
  nextDestination: string;
}

export function buildCompareReviewSessionV2(
  state: CompareReopenV2HydrationState,
  pkg: CompareReopenHandoffPackageV2,
): CompareReviewSessionV2 | null {
  const readiness = evaluateCompareHydrationReadiness(state);
  if (!readiness.canComplete) return null;

  return {
    id: `cmprevsv2_${Date.now().toString(36)}`,
    sourceHandoffPackageV2Id: state.handoffPackageV2Id,
    sourceCompareReopenCaseV2Id: state.compareReopenCaseV2Id,
    poRecordId: state.poRecordId,
    compareScope: state.compareScope,
    compareCandidateIds: state.compareCandidateIds,
    compareCandidates: pkg.compareCandidates,
    compareGroups: state.compareGroups,
    exactComparableIds: state.exactComparableIds,
    equivalentComparableIds: state.equivalentComparableIds,
    deltaFirstAxis: state.deltaFirstAxis,
    laneProvenance: state.laneProvenance,
    priorVendorReferenceVisible: state.priorVendorReferenceVisible,
    priorQuoteReferenceVisible: state.priorQuoteReferenceVisible,
    requestDirectExcludedIds: state.requestDirectExcludedIds,
    substituteHoldExcludedIds: state.substituteHoldExcludedIds,
    operatorPrepNote: state.operatorPrepNote,
    precheckFlags: state.precheckFlags,
    hydratedAt: new Date().toISOString(),
    hydratedBy: "operator",
    status: "ready_for_compare_review",
    nextDestination: "compare_reopen_v2_review",
  };
}

// ── Correction Route ──
export interface CompareHydrationCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceHandoffPackageV2Id: string;
  routeType: "handoff_return" | "triage_return" | "group_correction" | "delta_correction" | "route_correction";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildCompareHydrationCorrectionRoute(
  state: CompareReopenV2HydrationState,
  routeType: CompareHydrationCorrectionRoute["routeType"],
  reason: string,
): CompareHydrationCorrectionRoute {
  const readiness = evaluateCompareHydrationReadiness(state);

  const nextDest =
    routeType === "handoff_return" ? "compare_reopen_v2_handoff"
    : routeType === "triage_return" ? "sourcing_result_triage_v2"
    : routeType === "group_correction" ? "compare_reopen_v2_handoff"
    : routeType === "delta_correction" ? "compare_reopen_v2_handoff"
    : "compare_reopen_v2_handoff";

  return {
    id: `cmphydrcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceHandoffPackageV2Id: state.handoffPackageV2Id,
    routeType,
    reason,
    unresolvedBlockers: readiness.blockers,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: nextDest,
  };
}

// ── Activity Events ──
export type CompareHydrationEventType =
  | "compare_hydration_opened"
  | "compare_hydration_saved"
  | "compare_hydration_hold_set"
  | "compare_hydration_blocker_detected"
  | "compare_hydration_warning_detected"
  | "compare_review_session_v2_created"
  | "compare_hydration_completed"
  | "compare_ready_for_review";

export interface CompareHydrationEvent {
  type: CompareHydrationEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  handoffPackageV2Id: string;
  compareReopenCaseV2Id: string;
  reviewSessionV2Id: string | null;
  changedFields: string[];
  destination: string;
}

export function createCompareHydrationEvent(
  type: CompareHydrationEventType,
  state: CompareReopenV2HydrationState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): CompareHydrationEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    handoffPackageV2Id: state.handoffPackageV2Id,
    compareReopenCaseV2Id: state.compareReopenCaseV2Id,
    reviewSessionV2Id: state.reviewSessionId,
    changedFields,
    destination,
  };
}
