/**
 * Sourcing Search Reopen v2 Execution Engine — search run + lane normalization + result set
 *
 * 고정 규칙:
 * 1. sourcingSearchSession = 단일 입력 source.
 * 2. ready_for_search_execution ≠ result review ready. run 완료 이후에만 result set 생성.
 * 3. Exact Match / Cross-Vendor Equivalent / Alternative Pack or Substitute lane 구조 유지.
 * 4. lane collapse 금지 — flat list 회귀 금지.
 * 5. shortlist / compare / recommend truth 생성 금지 — triage는 다음 단계.
 * 6. duplicate merge + normalization + exclusion 후 canonical result set 생성.
 * 7. execute → result set → triage → compare 순서 강제.
 */

import type { SourcingSearchSession, SearchSessionStatus, SearchPrecheckFlag } from "./sourcing-search-reopen-hydration-engine";
import type { TriOptionLanePolicy } from "./sourcing-search-reopen-handoff-engine";
import type { SearchSeedMode } from "./procurement-reentry-workbench-engine";

// ── Execution Status ──
export type SearchExecutionStatus = "blocked" | "warning" | "ready" | "running" | "partial_completed" | "completed" | "failed";

// ── Search Run Status ──
export type SearchRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

// ── Execution Flag ──
export type SearchExecutionFlag =
  | "exact_lane_empty"
  | "equivalent_lane_empty"
  | "substitute_lane_disabled"
  | "substitute_lane_empty"
  | "duplicate_candidates_found"
  | "normalization_issue"
  | "excluded_scope_leak"
  | "vendor_hint_bias_detected"
  | "lane_imbalance"
  | "rerun_recommended";

// ── Normalization Warning ──
export type NormalizationWarning =
  | "low_confidence_classification"
  | "ambiguous_lane_assignment"
  | "incomplete_product_identity"
  | "missing_price_data"
  | "missing_lead_time"
  | "stale_catalog_data";

// ── Result Candidate ──
export interface SearchResultCandidate {
  candidateId: string;
  lane: "exact" | "equivalent" | "substitute";
  productIdentity: string;
  vendorName: string;
  catalogNumber: string;
  casNumber: string;
  unitPrice: number | null;
  leadTimeDays: number | null;
  availabilityNote: string;
  normalizationConfidence: "high" | "medium" | "low";
  duplicateOf: string | null;
  excluded: boolean;
  excludeReason: string;
}

// ── State ──
export interface SourcingSearchExecutionState {
  executionStatus: SearchExecutionStatus;
  sourcingSearchSessionId: string;
  poRecordId: string;
  searchScope: string;
  searchQtyByLine: string;
  searchSeedMode: SearchSeedMode;
  lanePolicy: TriOptionLanePolicy;
  exactCandidates: SearchResultCandidate[];
  equivalentCandidates: SearchResultCandidate[];
  substituteCandidates: SearchResultCandidate[];
  excludedCandidates: SearchResultCandidate[];
  normalizationIssueCandidates: SearchResultCandidate[];
  duplicateMergedCount: number;
  executionFlags: SearchExecutionFlag[];
  normalizationWarnings: NormalizationWarning[];
  operatorExecutionNote: string;
  blockerCount: number;
  warningCount: number;
  searchRunId: string | null;
  resultSetId: string | null;
}

export function createInitialSearchExecutionState(session: SourcingSearchSession): SourcingSearchExecutionState {
  return {
    executionStatus: "ready",
    sourcingSearchSessionId: session.id,
    poRecordId: session.poRecordId,
    searchScope: session.scope,
    searchQtyByLine: session.qtyByLine,
    searchSeedMode: session.searchSeedMode,
    lanePolicy: session.lanePolicy,
    exactCandidates: [],
    equivalentCandidates: [],
    substituteCandidates: [],
    excludedCandidates: [],
    normalizationIssueCandidates: [],
    duplicateMergedCount: 0,
    executionFlags: [],
    normalizationWarnings: [],
    operatorExecutionNote: "",
    blockerCount: 0,
    warningCount: 0,
    searchRunId: null,
    resultSetId: null,
  };
}

// ── Execution Readiness ──
export interface SearchExecutionReadinessResult {
  status: SearchExecutionStatus;
  blockers: string[];
  warnings: string[];
  canHandoff: boolean;
}

export function evaluateSearchExecutionReadiness(state: SourcingSearchExecutionState): SearchExecutionReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.sourcingSearchSessionId) blockers.push("Search session lineage 없음");

  // Execution completion
  if (state.executionStatus === "running") {
    blockers.push("검색 실행 진행 중");
    return { status: "running", blockers, warnings, canHandoff: false };
  }
  if (state.executionStatus === "failed") {
    blockers.push("검색 실행 실패");
    return { status: "failed", blockers, warnings, canHandoff: false };
  }

  // Result existence
  const totalCandidates = state.exactCandidates.length + state.equivalentCandidates.length + state.substituteCandidates.length;
  if (totalCandidates === 0) {
    blockers.push("검색 결과가 없습니다");
  }

  // Lane policy enforcement
  if (state.lanePolicy.exactMatchEnabled && state.exactCandidates.length === 0) {
    warnings.push("Exact Match lane 활성인데 결과 없음");
  }
  if (state.lanePolicy.crossVendorEquivalentEnabled && state.equivalentCandidates.length === 0) {
    warnings.push("Cross-Vendor Equivalent lane 활성인데 결과 없음");
  }
  if (!state.lanePolicy.alternativeSubstituteEnabled && state.substituteCandidates.length > 0) {
    blockers.push("Substitute lane 비활성인데 substitute 결과가 존재함");
  }

  // Excluded scope leak
  if (state.executionFlags.includes("excluded_scope_leak")) {
    blockers.push("Excluded scope가 결과에 포함됨");
  }

  // Normalization issues
  if (state.normalizationIssueCandidates.length > 0) {
    blockers.push(`${state.normalizationIssueCandidates.length}건 정규화 미완료 candidate 존재`);
  }

  // Duplicate unresolved
  if (state.executionFlags.includes("duplicate_candidates_found") && state.duplicateMergedCount === 0) {
    warnings.push("중복 candidate 발견되었으나 merge 미완료");
  }

  // Warnings
  if (state.executionFlags.includes("lane_imbalance")) warnings.push("Lane 간 결과 편중");
  if (state.executionFlags.includes("vendor_hint_bias_detected")) warnings.push("Vendor hint 편향 감지");
  if (state.executionFlags.includes("exact_lane_empty")) warnings.push("Exact lane 결과 없음");
  if (state.normalizationWarnings.includes("low_confidence_classification")) warnings.push("낮은 신뢰도 분류 존재");
  if (state.normalizationWarnings.includes("missing_price_data")) warnings.push("가격 데이터 누락 존재");
  if (state.normalizationWarnings.includes("missing_lead_time")) warnings.push("리드타임 데이터 누락 존재");

  const status: SearchExecutionStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "completed";

  // Batch 1: warning에서도 handoff 금지 (보수적)
  return { status, blockers, warnings, canHandoff: status === "completed" };
}

// ── Simulate Search Run ──
export function executeSearchRun(state: SourcingSearchExecutionState): {
  state: SourcingSearchExecutionState;
  run: SourcingSearchRun;
} {
  const now = new Date().toISOString();
  const run: SourcingSearchRun = {
    id: `srchrun_${Date.now().toString(36)}`,
    sourceSessionId: state.sourcingSearchSessionId,
    sourceSeedPackageId: "",
    poRecordId: state.poRecordId,
    searchScope: state.searchScope,
    searchSeedMode: state.searchSeedMode,
    rawResultCountByLane: {
      exact: state.exactCandidates.length,
      equivalent: state.equivalentCandidates.length,
      substitute: state.substituteCandidates.length,
    },
    normalizedCandidateCountByLane: {
      exact: state.exactCandidates.filter(c => !c.excluded && !c.duplicateOf).length,
      equivalent: state.equivalentCandidates.filter(c => !c.excluded && !c.duplicateOf).length,
      substitute: state.substituteCandidates.filter(c => !c.excluded && !c.duplicateOf).length,
    },
    duplicateMergedCount: state.duplicateMergedCount,
    excludedResultCount: state.excludedCandidates.length,
    executionFlags: state.executionFlags,
    normalizationWarnings: state.normalizationWarnings,
    startedAt: now,
    completedAt: now,
    executedBy: "operator",
    status: "completed",
  };

  return {
    state: { ...state, executionStatus: "completed", searchRunId: run.id },
    run,
  };
}

// ── Canonical Sourcing Search Run ──
export interface SourcingSearchRun {
  id: string;
  sourceSessionId: string;
  sourceSeedPackageId: string;
  poRecordId: string;
  searchScope: string;
  searchSeedMode: SearchSeedMode;
  rawResultCountByLane: { exact: number; equivalent: number; substitute: number };
  normalizedCandidateCountByLane: { exact: number; equivalent: number; substitute: number };
  duplicateMergedCount: number;
  excludedResultCount: number;
  executionFlags: SearchExecutionFlag[];
  normalizationWarnings: NormalizationWarning[];
  startedAt: string;
  completedAt: string;
  executedBy: string;
  status: SearchRunStatus;
}

// ── Result Set Status ──
export type ResultSetStatus = "ready_for_triage" | "partially_ready" | "blocked" | "cancelled";

// ── Canonical Sourcing Result Set V2 ──
export interface SourcingResultSetV2 {
  id: string;
  sourceSessionId: string;
  sourceSearchRunId: string;
  sourceSeedPackageId: string;
  poRecordId: string;
  searchScope: string;
  searchQtyByLine: string;
  exactCandidates: SearchResultCandidate[];
  equivalentCandidates: SearchResultCandidate[];
  substituteCandidates: SearchResultCandidate[];
  excludedCandidates: SearchResultCandidate[];
  normalizationIssueCandidates: SearchResultCandidate[];
  operatorExecutionNote: string;
  createdAt: string;
  createdBy: string;
  status: ResultSetStatus;
  nextDestination: string;
}

export function buildSourcingResultSetV2(state: SourcingSearchExecutionState): SourcingResultSetV2 | null {
  const readiness = evaluateSearchExecutionReadiness(state);
  if (!readiness.canHandoff) return null;
  if (!state.searchRunId) return null;

  const status: ResultSetStatus =
    state.normalizationIssueCandidates.length > 0 ? "partially_ready"
    : "ready_for_triage";

  return {
    id: `srchrsetv2_${Date.now().toString(36)}`,
    sourceSessionId: state.sourcingSearchSessionId,
    sourceSearchRunId: state.searchRunId,
    sourceSeedPackageId: "",
    poRecordId: state.poRecordId,
    searchScope: state.searchScope,
    searchQtyByLine: state.searchQtyByLine,
    exactCandidates: state.exactCandidates.filter(c => !c.excluded),
    equivalentCandidates: state.equivalentCandidates.filter(c => !c.excluded),
    substituteCandidates: state.substituteCandidates.filter(c => !c.excluded),
    excludedCandidates: state.excludedCandidates,
    normalizationIssueCandidates: state.normalizationIssueCandidates,
    operatorExecutionNote: state.operatorExecutionNote,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status,
    nextDestination: "sourcing_result_workbench_v2",
  };
}

// ── Can Rerun ──
export function canRerunSearch(state: SourcingSearchExecutionState): boolean {
  return state.executionStatus === "failed" || state.executionFlags.includes("rerun_recommended");
}

// ── Activity Events ──
export type SearchExecutionEventType =
  | "sourcing_search_execution_opened"
  | "sourcing_search_execution_started"
  | "sourcing_search_execution_saved"
  | "sourcing_search_execution_hold_set"
  | "sourcing_search_execution_blocker_detected"
  | "sourcing_search_execution_warning_detected"
  | "sourcing_search_run_created"
  | "sourcing_result_set_v2_created"
  | "sourcing_search_execution_completed"
  | "sourcing_result_workbench_handoff_completed";

export interface SearchExecutionEvent {
  type: SearchExecutionEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  searchSessionId: string;
  searchRunId: string | null;
  resultSetId: string | null;
  changedFields: string[];
  destination: string;
}

export function createSearchExecutionEvent(
  type: SearchExecutionEventType,
  state: SourcingSearchExecutionState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): SearchExecutionEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    searchSessionId: state.sourcingSearchSessionId,
    searchRunId: state.searchRunId,
    resultSetId: state.resultSetId,
    changedFields,
    destination,
  };
}
