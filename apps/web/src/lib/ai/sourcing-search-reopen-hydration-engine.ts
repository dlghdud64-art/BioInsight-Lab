/**
 * Sourcing Search Reopen v2 Intake Hydration Engine — seed package → search session initialization
 *
 * 고정 규칙:
 * 1. sourcingSearchReopenSeedPackage = 단일 입력 source.
 * 2. opened ≠ search executed. hydration ready 이후에만 execution 준비 완료.
 * 3. scope/seed/lane/context/execution 5개 hydration 축 분리 평가.
 * 4. tri-option lane policy hydration 필수 — auto-select 금지.
 * 5. carry-forward context는 reference visibility만 — query truth 오염 금지.
 * 6. canonical sourcingSearchSession = actual execution의 단일 source of truth.
 * 7. actual search query execution은 이 단계에서 금지.
 * 8. open → hydrate → ready → execute 순서 강제.
 */

import type { SourcingSearchReopenSeedPackage, SourcingSearchReopenCase, TriOptionLanePolicy, SearchHandoffExceptionFlag } from "./sourcing-search-reopen-handoff-engine";
import type { SearchSeedMode } from "./procurement-reentry-workbench-engine";

// ── Hydration Status ──
export type SearchHydrationStatus = "not_started" | "blocked" | "warning" | "ready" | "hydrated";

// ── Readiness Axis ──
export type HydrationAxis = "scope_hydration_ready" | "seed_hydration_ready" | "lane_hydration_ready" | "context_hydration_ready" | "execution_hydration_ready";
export type HydrationAxisStatus = "ok" | "warning" | "blocked";

export interface HydrationAxisResult {
  axis: HydrationAxis;
  status: HydrationAxisStatus;
  detail: string;
}

// ── Precheck Flag ──
export type SearchPrecheckFlag =
  | "scope_empty"
  | "seed_incomplete"
  | "lane_policy_ambiguous"
  | "excluded_scope_contamination"
  | "vendor_hint_bias_risk"
  | "compare_context_stale"
  | "quote_context_stale"
  | "substitute_lane_conflict"
  | "equivalent_lane_conflict";

// ── Search Session State ──
export interface SourcingSearchSessionState {
  scope: string;
  qtyByLine: string;
  searchSeedMode: SearchSeedMode;
  exactItemSeed: string;
  vendorHint: string;
  catalogSeed: string;
  casSeed: string;
  equivalentLaneEnabled: boolean;
  substituteLaneEnabled: boolean;
  compareContextVisible: boolean;
  quoteContextVisible: boolean;
  excludedScope: string;
  operatorPrepNote: string;
  precheckFlags: SearchPrecheckFlag[];
}

// ── Workbench State ──
export interface SourcingSearchReopenHydrationState {
  hydrationStatus: SearchHydrationStatus;
  sourcingSearchReopenCaseId: string;
  seedPackageId: string;
  poRecordId: string;
  vendorId: string;
  lanePolicy: TriOptionLanePolicy;
  axisResults: HydrationAxisResult[];
  sessionState: SourcingSearchSessionState | null;
  blockerCount: number;
  warningCount: number;
  searchSessionId: string | null;
  correctionRouteId: string | null;
}

export function createInitialHydrationState(
  seedPackage: SourcingSearchReopenSeedPackage,
  reopenCase: SourcingSearchReopenCase,
): SourcingSearchReopenHydrationState {
  const axes = evaluateHydrationAxes(seedPackage, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    hydrationStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    sourcingSearchReopenCaseId: reopenCase.id,
    seedPackageId: seedPackage.id,
    poRecordId: seedPackage.sourcePoRecordId,
    vendorId: seedPackage.vendorId,
    lanePolicy: seedPackage.lanePolicy,
    axisResults: axes,
    sessionState: null,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    searchSessionId: null,
    correctionRouteId: null,
  };
}

// ── Hydration Axes Evaluation ──
export function evaluateHydrationAxes(seedPackage: SourcingSearchReopenSeedPackage, session: SourcingSearchSessionState | null): HydrationAxisResult[] {
  const results: HydrationAxisResult[] = [];

  // 1. Scope hydration ready
  if (!seedPackage.searchScope) {
    results.push({ axis: "scope_hydration_ready", status: "blocked", detail: "Search scope 비어 있음" });
  } else if (session && !session.scope) {
    results.push({ axis: "scope_hydration_ready", status: "blocked", detail: "Session scope hydrate 실패" });
  } else if (session?.scope) {
    results.push({ axis: "scope_hydration_ready", status: "ok", detail: "Search scope hydrate 완료" });
  } else {
    results.push({ axis: "scope_hydration_ready", status: "blocked", detail: "Scope hydrate 미시작" });
  }

  // 2. Seed hydration ready
  if (session) {
    if (!session.exactItemSeed && !session.catalogSeed && !session.casSeed && !session.vendorHint) {
      results.push({ axis: "seed_hydration_ready", status: "blocked", detail: "검색 seed 전혀 hydrate되지 않음" });
    } else if (!session.exactItemSeed) {
      results.push({ axis: "seed_hydration_ready", status: "warning", detail: "Exact item seed 없음 — 보조 seed만 존재" });
    } else {
      results.push({ axis: "seed_hydration_ready", status: "ok", detail: "검색 seed hydrate 완료" });
    }
  } else {
    if (!seedPackage.exactItemSeed && !seedPackage.catalogSeed && !seedPackage.casSeed) {
      results.push({ axis: "seed_hydration_ready", status: "blocked", detail: "Seed package에 핵심 식별자 없음" });
    } else {
      results.push({ axis: "seed_hydration_ready", status: "blocked", detail: "Seed hydrate 미시작" });
    }
  }

  // 3. Lane hydration ready
  if (session) {
    if (!seedPackage.substituteAllowed && session.substituteLaneEnabled) {
      results.push({ axis: "lane_hydration_ready", status: "blocked", detail: "대체 불허인데 substitute lane이 활성화됨" });
    } else if (!seedPackage.equivalentAllowed && session.equivalentLaneEnabled) {
      results.push({ axis: "lane_hydration_ready", status: "blocked", detail: "Equivalent 불허인데 equivalent lane이 활성화됨" });
    } else {
      results.push({ axis: "lane_hydration_ready", status: "ok", detail: "Lane policy hydrate 완료" });
    }
  } else {
    results.push({ axis: "lane_hydration_ready", status: "blocked", detail: "Lane policy hydrate 미시작" });
  }

  // 4. Context hydration ready
  if (session) {
    const contextIssues: string[] = [];
    if (session.precheckFlags.includes("vendor_hint_bias_risk")) contextIssues.push("Vendor hint 편향 위험");
    if (session.precheckFlags.includes("compare_context_stale")) contextIssues.push("Compare context stale");
    if (session.precheckFlags.includes("quote_context_stale")) contextIssues.push("Quote context stale");
    if (session.precheckFlags.includes("excluded_scope_contamination")) contextIssues.push("Excluded scope 오염");

    if (session.precheckFlags.includes("excluded_scope_contamination")) {
      results.push({ axis: "context_hydration_ready", status: "blocked", detail: "Excluded scope가 search 대상에 섞임" });
    } else if (contextIssues.length > 0) {
      results.push({ axis: "context_hydration_ready", status: "warning", detail: contextIssues.join("; ") });
    } else {
      results.push({ axis: "context_hydration_ready", status: "ok", detail: "Context hydrate 완료" });
    }
  } else {
    results.push({ axis: "context_hydration_ready", status: "blocked", detail: "Context hydrate 미시작" });
  }

  // 5. Execution hydration ready
  if (session) {
    const execBlockers = session.precheckFlags.filter(f =>
      f === "scope_empty" || f === "seed_incomplete" || f === "lane_policy_ambiguous" || f === "excluded_scope_contamination" || f === "substitute_lane_conflict"
    );
    if (execBlockers.length > 0) {
      results.push({ axis: "execution_hydration_ready", status: "blocked", detail: `Execution precheck 실패: ${execBlockers.join(", ")}` });
    } else {
      results.push({ axis: "execution_hydration_ready", status: "ok", detail: "Execution precheck 통과" });
    }
  } else {
    results.push({ axis: "execution_hydration_ready", status: "blocked", detail: "Execution precheck 미시작" });
  }

  return results;
}

// ── Hydration Readiness Aggregate ──
export interface SearchHydrationReadinessResult {
  status: SearchHydrationStatus;
  blockers: string[];
  warnings: string[];
  canComplete: boolean;
}

export function evaluateSearchHydrationReadiness(state: SourcingSearchReopenHydrationState): SearchHydrationReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.seedPackageId) blockers.push("Seed package lineage 없음");
  if (!state.sourcingSearchReopenCaseId) blockers.push("Search reopen case lineage 없음");

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Session completeness
  if (!state.sessionState) {
    blockers.push("Search session state 미생성");
  }

  const status: SearchHydrationStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 completion 금지 (보수적)
  return { status, blockers, warnings, canComplete: status === "ready" };
}

// ── Canonical Sourcing Search Session ──
export type SearchSessionStatus = "initialized" | "hydrated" | "ready_for_search_execution" | "search_running" | "search_completed" | "cancelled";

export interface SourcingSearchSession {
  id: string;
  sourceSeedPackageId: string;
  sourceReopenCaseId: string;
  poRecordId: string;
  scope: string;
  qtyByLine: string;
  searchSeedMode: SearchSeedMode;
  exactItemSeed: string;
  vendorHint: string;
  catalogSeed: string;
  casSeed: string;
  equivalentLaneEnabled: boolean;
  substituteLaneEnabled: boolean;
  lanePolicy: TriOptionLanePolicy;
  compareContextVisible: boolean;
  quoteContextVisible: boolean;
  excludedScope: string;
  operatorPrepNote: string;
  precheckFlags: SearchPrecheckFlag[];
  hydratedAt: string;
  hydratedBy: string;
  status: SearchSessionStatus;
  nextDestination: string;
}

export function buildSourcingSearchSession(state: SourcingSearchReopenHydrationState): SourcingSearchSession | null {
  if (!state.sessionState) return null;
  const readiness = evaluateSearchHydrationReadiness(state);
  if (!readiness.canComplete) return null;

  const s = state.sessionState;
  return {
    id: `srchsession_${Date.now().toString(36)}`,
    sourceSeedPackageId: state.seedPackageId,
    sourceReopenCaseId: state.sourcingSearchReopenCaseId,
    poRecordId: state.poRecordId,
    scope: s.scope,
    qtyByLine: s.qtyByLine,
    searchSeedMode: s.searchSeedMode,
    exactItemSeed: s.exactItemSeed,
    vendorHint: s.vendorHint,
    catalogSeed: s.catalogSeed,
    casSeed: s.casSeed,
    equivalentLaneEnabled: s.equivalentLaneEnabled,
    substituteLaneEnabled: s.substituteLaneEnabled,
    lanePolicy: state.lanePolicy,
    compareContextVisible: s.compareContextVisible,
    quoteContextVisible: s.quoteContextVisible,
    excludedScope: s.excludedScope,
    operatorPrepNote: s.operatorPrepNote,
    precheckFlags: s.precheckFlags,
    hydratedAt: new Date().toISOString(),
    hydratedBy: "operator",
    status: "ready_for_search_execution",
    nextDestination: "sourcing_search_reopen_v2_execution",
  };
}

// ── Correction Route ──
export interface HydrationCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceSeedPackageId: string;
  routeType: "handoff_surface_return" | "reentry_workbench_return" | "scope_correction" | "seed_correction" | "lane_policy_correction";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildHydrationCorrectionRoute(
  state: SourcingSearchReopenHydrationState,
  routeType: HydrationCorrectionRoute["routeType"],
  reason: string,
): HydrationCorrectionRoute {
  const readiness = evaluateSearchHydrationReadiness(state);

  const nextDest =
    routeType === "handoff_surface_return" ? "sourcing_search_reopen_handoff"
    : routeType === "reentry_workbench_return" ? "procurement_reentry_workbench"
    : routeType === "scope_correction" ? "sourcing_search_reopen_handoff"
    : routeType === "seed_correction" ? "sourcing_search_reopen_handoff"
    : "sourcing_search_reopen_handoff";

  return {
    id: `hydrcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceSeedPackageId: state.seedPackageId,
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
export type SearchHydrationEventType =
  | "sourcing_search_hydration_opened"
  | "sourcing_search_hydration_saved"
  | "sourcing_search_hydration_hold_set"
  | "sourcing_search_hydration_blocker_detected"
  | "sourcing_search_hydration_warning_detected"
  | "sourcing_search_session_created"
  | "sourcing_search_hydration_completed"
  | "sourcing_search_ready_for_execution";

export interface SearchHydrationEvent {
  type: SearchHydrationEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  seedPackageId: string;
  reopenCaseId: string;
  searchSessionId: string | null;
  changedFields: string[];
  destination: string;
}

export function createSearchHydrationEvent(
  type: SearchHydrationEventType,
  state: SourcingSearchReopenHydrationState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): SearchHydrationEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    seedPackageId: state.seedPackageId,
    reopenCaseId: state.sourcingSearchReopenCaseId,
    searchSessionId: state.searchSessionId,
    changedFields,
    destination,
  };
}
