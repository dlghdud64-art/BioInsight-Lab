/**
 * Sourcing Search Result Workbench v2 Intake Engine — result set → triage session initialization
 *
 * 고정 규칙:
 * 1. sourcingResultSetV2 = 단일 입력 source.
 * 2. ready_for_triage ≠ triage complete. intake hydration 이후에만 triage session 생성.
 * 3. Exact / Equivalent / Substitute / Excluded lane 구조 유지 — flat list 회귀 금지.
 * 4. compare eligibility / request-direct bypass는 preview만 — truth 생성 금지.
 * 5. normalizationIssueCandidates는 main triage lane 밖에 유지.
 * 6. canonical sourcingResultTriageSessionV2 = actual triage의 단일 source of truth.
 * 7. shortlist / exclude / hold / compare decision은 이 단계에서 금지.
 * 8. result set → intake hydrate → ready_for_result_triage → actual triage 순서 강제.
 */

import type { SourcingResultSetV2, SearchResultCandidate, ResultSetStatus } from "./sourcing-search-reopen-execution-engine";

// ── Intake Status ──
export type ResultIntakeStatus = "not_started" | "blocked" | "warning" | "ready" | "hydrated";

// ── Readiness Axis ──
export type ResultIntakeAxis = "lane_intake_ready" | "candidate_intake_ready" | "compare_preview_ready" | "direct_bypass_preview_ready" | "triage_execution_ready";
export type ResultIntakeAxisStatus = "ok" | "warning" | "blocked";

export interface ResultIntakeAxisResult {
  axis: ResultIntakeAxis;
  status: ResultIntakeAxisStatus;
  detail: string;
}

// ── Precheck Flag ──
export type ResultIntakePrecheckFlag =
  | "lane_grouping_broken"
  | "excluded_contamination"
  | "normalization_issue_unresolved"
  | "compare_preview_unstable"
  | "request_direct_preview_unstable"
  | "vendor_hint_bias"
  | "lane_imbalance"
  | "substitute_lane_empty"
  | "exact_lane_empty";

// ── Lane Visibility ──
export interface LaneVisibility {
  exactVisible: boolean;
  equivalentVisible: boolean;
  substituteVisible: boolean;
  excludedVisible: boolean;
}

// ── Compare Eligible Preview ──
export interface CompareEligiblePreview {
  exactComparableCandidateIds: string[];
  equivalentComparableCandidateIds: string[];
  substituteHoldCandidateIds: string[];
  requestDirectBypassCandidateIds: string[];
}

// ── State ──
export interface SourcingResultWorkbenchV2IntakeState {
  intakeStatus: ResultIntakeStatus;
  sourcingResultSetV2Id: string;
  sourceSearchRunId: string;
  sourceSearchSessionId: string;
  poRecordId: string;
  searchScope: string;
  searchQtyByLine: string;
  exactCandidateCount: number;
  equivalentCandidateCount: number;
  substituteCandidateCount: number;
  excludedCandidateCount: number;
  normalizationIssueCandidateCount: number;
  laneVisibility: LaneVisibility;
  compareEligiblePreview: CompareEligiblePreview | null;
  axisResults: ResultIntakeAxisResult[];
  operatorIntakeNote: string;
  precheckFlags: ResultIntakePrecheckFlag[];
  blockerCount: number;
  warningCount: number;
  triageSessionId: string | null;
  correctionRouteId: string | null;
}

export function createInitialResultIntakeState(resultSet: SourcingResultSetV2): SourcingResultWorkbenchV2IntakeState {
  const axes = evaluateResultIntakeAxes(resultSet, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    intakeStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    sourcingResultSetV2Id: resultSet.id,
    sourceSearchRunId: resultSet.sourceSearchRunId,
    sourceSearchSessionId: resultSet.sourceSessionId,
    poRecordId: resultSet.poRecordId,
    searchScope: resultSet.searchScope,
    searchQtyByLine: resultSet.searchQtyByLine,
    exactCandidateCount: resultSet.exactCandidates.length,
    equivalentCandidateCount: resultSet.equivalentCandidates.length,
    substituteCandidateCount: resultSet.substituteCandidates.length,
    excludedCandidateCount: resultSet.excludedCandidates.length,
    normalizationIssueCandidateCount: resultSet.normalizationIssueCandidates.length,
    laneVisibility: {
      exactVisible: resultSet.exactCandidates.length > 0,
      equivalentVisible: resultSet.equivalentCandidates.length > 0,
      substituteVisible: resultSet.substituteCandidates.length > 0,
      excludedVisible: resultSet.excludedCandidates.length > 0,
    },
    compareEligiblePreview: null,
    axisResults: axes,
    operatorIntakeNote: "",
    precheckFlags: [],
    blockerCount: blockers.length,
    warningCount: warnings.length,
    triageSessionId: null,
    correctionRouteId: null,
  };
}

// ── Intake Axes Evaluation ──
export function evaluateResultIntakeAxes(resultSet: SourcingResultSetV2, preview: CompareEligiblePreview | null): ResultIntakeAxisResult[] {
  const results: ResultIntakeAxisResult[] = [];

  // 1. Lane intake ready
  const totalActive = resultSet.exactCandidates.length + resultSet.equivalentCandidates.length + resultSet.substituteCandidates.length;
  if (totalActive === 0) {
    results.push({ axis: "lane_intake_ready", status: "blocked", detail: "Triage 대상 candidate가 없습니다" });
  } else {
    results.push({ axis: "lane_intake_ready", status: "ok", detail: `${totalActive}건 triage candidate 준비됨` });
  }

  // 2. Candidate intake ready
  if (resultSet.normalizationIssueCandidates.length > 0) {
    results.push({ axis: "candidate_intake_ready", status: "blocked", detail: `${resultSet.normalizationIssueCandidates.length}건 normalization 미해결` });
  } else if (resultSet.status === "blocked") {
    results.push({ axis: "candidate_intake_ready", status: "blocked", detail: "Result set이 blocked 상태" });
  } else {
    results.push({ axis: "candidate_intake_ready", status: "ok", detail: "Candidate 분류 완료" });
  }

  // 3. Compare preview ready
  if (preview) {
    const comparableCount = preview.exactComparableCandidateIds.length + preview.equivalentComparableCandidateIds.length;
    if (comparableCount === 0) {
      results.push({ axis: "compare_preview_ready", status: "warning", detail: "Compare 가능 후보 없음" });
    } else {
      results.push({ axis: "compare_preview_ready", status: "ok", detail: `${comparableCount}건 compare 가능 후보` });
    }
  } else {
    results.push({ axis: "compare_preview_ready", status: "blocked", detail: "Compare eligibility preview 미생성" });
  }

  // 4. Direct bypass preview ready
  if (preview) {
    if (preview.requestDirectBypassCandidateIds.length > 0) {
      results.push({ axis: "direct_bypass_preview_ready", status: "ok", detail: `${preview.requestDirectBypassCandidateIds.length}건 request-direct 후보` });
    } else {
      results.push({ axis: "direct_bypass_preview_ready", status: "ok", detail: "Request-direct bypass 해당 없음" });
    }
  } else {
    results.push({ axis: "direct_bypass_preview_ready", status: "blocked", detail: "Request-direct preview 미생성" });
  }

  // 5. Triage execution ready
  if (totalActive > 0 && resultSet.normalizationIssueCandidates.length === 0 && preview) {
    results.push({ axis: "triage_execution_ready", status: "ok", detail: "Triage 시작 가능" });
  } else {
    results.push({ axis: "triage_execution_ready", status: "blocked", detail: "Triage 시작 조건 미충족" });
  }

  return results;
}

// ── Intake Readiness Aggregate ──
export interface ResultIntakeReadinessResult {
  status: ResultIntakeStatus;
  blockers: string[];
  warnings: string[];
  canComplete: boolean;
}

export function evaluateResultIntakeReadiness(state: SourcingResultWorkbenchV2IntakeState): ResultIntakeReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.sourcingResultSetV2Id) blockers.push("Result set lineage 없음");
  if (!state.sourceSearchRunId) blockers.push("Search run lineage 없음");

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Normalization guard
  if (state.normalizationIssueCandidateCount > 0) {
    blockers.push(`${state.normalizationIssueCandidateCount}건 normalization issue 미해결`);
  }

  // Compare preview
  if (!state.compareEligiblePreview) {
    blockers.push("Compare eligibility preview 미생성");
  }

  // Precheck flags
  if (state.precheckFlags.includes("lane_grouping_broken")) blockers.push("Lane grouping 무결성 깨짐");
  if (state.precheckFlags.includes("excluded_contamination")) blockers.push("Excluded candidate가 triage lane에 혼입됨");
  if (state.precheckFlags.includes("normalization_issue_unresolved")) blockers.push("Normalization issue 미해결");
  if (state.precheckFlags.includes("compare_preview_unstable")) warnings.push("Compare preview가 불안정");
  if (state.precheckFlags.includes("request_direct_preview_unstable")) warnings.push("Request-direct preview가 불안정");
  if (state.precheckFlags.includes("vendor_hint_bias")) warnings.push("Vendor hint 편향 가능성");
  if (state.precheckFlags.includes("lane_imbalance")) warnings.push("Lane 간 결과 편중");
  if (state.precheckFlags.includes("exact_lane_empty")) warnings.push("Exact lane 결과 없음");

  const status: ResultIntakeStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 completion 금지 (보수적)
  return { status, blockers, warnings, canComplete: status === "ready" };
}

// ── Triage Session Status ──
export type TriageSessionStatus = "initialized" | "hydrated" | "ready_for_result_triage" | "triage_in_progress" | "triage_completed" | "cancelled";

// ── Canonical Sourcing Result Triage Session V2 ──
export interface SourcingResultTriageSessionV2 {
  id: string;
  sourceResultSetV2Id: string;
  sourceSearchRunId: string;
  sourceSearchSessionId: string;
  poRecordId: string;
  searchScope: string;
  searchQtyByLine: string;
  exactCandidates: SearchResultCandidate[];
  equivalentCandidates: SearchResultCandidate[];
  substituteCandidates: SearchResultCandidate[];
  excludedCandidates: SearchResultCandidate[];
  normalizationIssueCandidates: SearchResultCandidate[];
  compareEligiblePreview: CompareEligiblePreview;
  requestDirectPreview: string[];
  laneVisibility: LaneVisibility;
  operatorIntakeNote: string;
  precheckFlags: ResultIntakePrecheckFlag[];
  hydratedAt: string;
  hydratedBy: string;
  status: TriageSessionStatus;
  nextDestination: string;
}

export function buildSourcingResultTriageSessionV2(
  state: SourcingResultWorkbenchV2IntakeState,
  resultSet: SourcingResultSetV2,
): SourcingResultTriageSessionV2 | null {
  const readiness = evaluateResultIntakeReadiness(state);
  if (!readiness.canComplete) return null;
  if (!state.compareEligiblePreview) return null;

  return {
    id: `srchrtrgsv2_${Date.now().toString(36)}`,
    sourceResultSetV2Id: resultSet.id,
    sourceSearchRunId: resultSet.sourceSearchRunId,
    sourceSearchSessionId: resultSet.sourceSessionId,
    poRecordId: state.poRecordId,
    searchScope: state.searchScope,
    searchQtyByLine: state.searchQtyByLine,
    exactCandidates: resultSet.exactCandidates,
    equivalentCandidates: resultSet.equivalentCandidates,
    substituteCandidates: resultSet.substituteCandidates,
    excludedCandidates: resultSet.excludedCandidates,
    normalizationIssueCandidates: resultSet.normalizationIssueCandidates,
    compareEligiblePreview: state.compareEligiblePreview,
    requestDirectPreview: state.compareEligiblePreview.requestDirectBypassCandidateIds,
    laneVisibility: state.laneVisibility,
    operatorIntakeNote: state.operatorIntakeNote,
    precheckFlags: state.precheckFlags,
    hydratedAt: new Date().toISOString(),
    hydratedBy: "operator",
    status: "ready_for_result_triage",
    nextDestination: "sourcing_result_triage_v2",
  };
}

// ── Correction Route ──
export interface ResultIntakeCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceResultSetV2Id: string;
  routeType: "execution_return" | "hydration_return" | "lane_correction" | "normalization_correction";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildResultIntakeCorrectionRoute(
  state: SourcingResultWorkbenchV2IntakeState,
  routeType: ResultIntakeCorrectionRoute["routeType"],
  reason: string,
): ResultIntakeCorrectionRoute {
  const readiness = evaluateResultIntakeReadiness(state);

  const nextDest =
    routeType === "execution_return" ? "sourcing_search_execution_v2"
    : routeType === "hydration_return" ? "sourcing_search_hydration_v2"
    : routeType === "lane_correction" ? "sourcing_search_execution_v2"
    : "sourcing_search_execution_v2";

  return {
    id: `rsltintkcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceResultSetV2Id: state.sourcingResultSetV2Id,
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
export type ResultIntakeEventType =
  | "sourcing_result_intake_opened"
  | "sourcing_result_intake_saved"
  | "sourcing_result_intake_hold_set"
  | "sourcing_result_intake_blocker_detected"
  | "sourcing_result_intake_warning_detected"
  | "sourcing_result_triage_session_created"
  | "sourcing_result_intake_completed"
  | "sourcing_result_ready_for_triage";

export interface ResultIntakeEvent {
  type: ResultIntakeEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  resultSetV2Id: string;
  triageSessionId: string | null;
  changedFields: string[];
  destination: string;
}

export function createResultIntakeEvent(
  type: ResultIntakeEventType,
  state: SourcingResultWorkbenchV2IntakeState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): ResultIntakeEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    resultSetV2Id: state.sourcingResultSetV2Id,
    triageSessionId: state.triageSessionId,
    changedFields,
    destination,
  };
}
