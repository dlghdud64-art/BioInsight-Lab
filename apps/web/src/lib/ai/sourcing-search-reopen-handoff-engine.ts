/**
 * Sourcing Search Reopen Handoff Engine — procurement re-entry → search reopen seed package
 *
 * 고정 규칙:
 * 1. procurementReentryReopenObject = 단일 입력 source.
 * 2. route = sourcing_search_reopen ≠ search executed. handoff ready 이후에만 넘기기.
 * 3. scope/seed/mode/policy/context 5개 readiness 축 분리 평가.
 * 4. tri-option lane policy (exact/equivalent/substitute) 필수 — strategy auto-select 금지.
 * 5. substituteAllowed = false면 substitute lane 차단.
 * 6. canonical sourcingSearchReopenSeedPackage = Sourcing Search Reopen v2의 단일 intake source.
 * 7. actual search execution은 이 단계에서 금지.
 */

import type { ProcurementReentryReopenObject, ReentryRoute, SearchSeedMode, ReentryExceptionFlag } from "./procurement-reentry-workbench-engine";

// ── Handoff Status ──
export type SearchReopenHandoffStatus = "not_started" | "blocked" | "warning" | "ready" | "handed_off";

// ── Readiness Axis ──
export type SearchHandoffAxis = "scope_search_ready" | "seed_search_ready" | "mode_search_ready" | "policy_search_ready" | "context_search_ready";
export type SearchHandoffAxisStatus = "ok" | "warning" | "blocked";

export interface SearchHandoffAxisResult {
  axis: SearchHandoffAxis;
  status: SearchHandoffAxisStatus;
  detail: string;
}

// ── Exception Flag ──
export type SearchHandoffExceptionFlag =
  | "scope_unclear"
  | "seed_missing"
  | "exact_identifier_missing"
  | "vendor_hint_stale"
  | "substitute_policy_conflict"
  | "held_scope_contamination"
  | "lane_policy_incomplete"
  | "carry_forward_conflict"
  | "route_mismatch";

// ── Search Reopen Decision ──
export interface SourcingSearchReopenDecision {
  searchScope: string;
  searchQtyByLine: string;
  searchSeedMode: SearchSeedMode;
  exactItemSeed: string;
  vendorHint: string;
  catalogSeed: string;
  casSeed: string;
  equivalentAllowed: boolean;
  substituteAllowed: boolean;
  excludedScope: string;
  operatorNote: string;
  exceptionFlags: SearchHandoffExceptionFlag[];
}

// ── State ──
export interface SourcingSearchReopenHandoffState {
  handoffStatus: SearchReopenHandoffStatus;
  procurementReentryReopenObjectId: string;
  poRecordId: string;
  vendorId: string;
  sourceReorderDecisionCaseId: string;
  sourceProcurementReentryCaseId: string;
  reentryScope: string;
  reentryQtyByLine: string;
  reentryRoute: ReentryRoute;
  substituteAllowed: boolean;
  carryForwardVendorContext: boolean;
  carryForwardCompareContext: boolean;
  carryForwardQuoteContext: boolean;
  axisResults: SearchHandoffAxisResult[];
  decision: SourcingSearchReopenDecision | null;
  blockerCount: number;
  warningCount: number;
  seedPackageId: string | null;
  reopenCaseId: string | null;
  correctionRouteId: string | null;
}

export function createInitialSearchReopenHandoffState(reopenObj: ProcurementReentryReopenObject): SourcingSearchReopenHandoffState {
  const axes = evaluateSearchHandoffAxes(reopenObj, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    handoffStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    procurementReentryReopenObjectId: reopenObj.id,
    poRecordId: reopenObj.sourcePoRecordId,
    vendorId: reopenObj.vendorId,
    sourceReorderDecisionCaseId: reopenObj.sourceReorderDecisionCaseId,
    sourceProcurementReentryCaseId: reopenObj.sourceProcurementReentryCaseId,
    reentryScope: reopenObj.reentryScope,
    reentryQtyByLine: reopenObj.reentryQtyByLine,
    reentryRoute: reopenObj.route,
    substituteAllowed: reopenObj.substituteAllowed,
    carryForwardVendorContext: reopenObj.carryForwardVendorContext,
    carryForwardCompareContext: reopenObj.carryForwardCompareContext,
    carryForwardQuoteContext: reopenObj.carryForwardQuoteContext,
    axisResults: axes,
    decision: null,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    seedPackageId: null,
    reopenCaseId: null,
    correctionRouteId: null,
  };
}

// ── Readiness Axes Evaluation ──
export function evaluateSearchHandoffAxes(reopenObj: ProcurementReentryReopenObject, decision: SourcingSearchReopenDecision | null): SearchHandoffAxisResult[] {
  const results: SearchHandoffAxisResult[] = [];

  // 1. Scope search ready
  if (reopenObj.route !== "sourcing_search_reopen") {
    results.push({ axis: "scope_search_ready", status: "blocked", detail: "Route가 sourcing_search_reopen이 아님" });
  } else if (!reopenObj.reentryScope) {
    results.push({ axis: "scope_search_ready", status: "blocked", detail: "재진입 대상 범위 없음" });
  } else if (decision && !decision.searchScope) {
    results.push({ axis: "scope_search_ready", status: "blocked", detail: "검색 대상 범위 미지정" });
  } else if (decision?.searchScope) {
    results.push({ axis: "scope_search_ready", status: "ok", detail: "검색 범위 확인됨" });
  } else {
    results.push({ axis: "scope_search_ready", status: "blocked", detail: "검색 범위 미입력" });
  }

  // 2. Seed search ready
  if (decision) {
    if (!decision.exactItemSeed && !decision.catalogSeed && !decision.casSeed && !decision.vendorHint) {
      results.push({ axis: "seed_search_ready", status: "blocked", detail: "검색 seed 식별자 전혀 없음" });
    } else if (!decision.exactItemSeed) {
      results.push({ axis: "seed_search_ready", status: "warning", detail: "Exact item seed 없음 — vendor/catalog/CAS 힌트만 존재" });
    } else {
      results.push({ axis: "seed_search_ready", status: "ok", detail: "검색 seed 확인됨" });
    }
  } else {
    results.push({ axis: "seed_search_ready", status: "blocked", detail: "검색 seed 미입력" });
  }

  // 3. Mode search ready
  if (decision && decision.searchSeedMode) {
    results.push({ axis: "mode_search_ready", status: "ok", detail: `Search mode: ${decision.searchSeedMode}` });
  } else {
    results.push({ axis: "mode_search_ready", status: "blocked", detail: "Search seed mode 미지정" });
  }

  // 4. Policy search ready
  if (decision) {
    const policyIssues: string[] = [];
    if (!decision.substituteAllowed && decision.searchSeedMode === "equivalent_plus_substitute") {
      policyIssues.push("대체 불허인데 substitute mode가 열려 있음");
    }
    if (decision.exceptionFlags.includes("held_scope_contamination")) {
      policyIssues.push("Hold scope가 검색 대상에 섞임");
    }
    if (decision.exceptionFlags.includes("substitute_policy_conflict")) {
      policyIssues.push("Substitute 정책 충돌");
    }

    if (policyIssues.length > 0) {
      results.push({ axis: "policy_search_ready", status: "blocked", detail: policyIssues.join("; ") });
    } else {
      results.push({ axis: "policy_search_ready", status: "ok", detail: "정책 기준 충족" });
    }
  } else {
    results.push({ axis: "policy_search_ready", status: "blocked", detail: "정책 기준 미확인" });
  }

  // 5. Context search ready
  if (decision) {
    const contextIssues: string[] = [];
    if (decision.exceptionFlags.includes("vendor_hint_stale")) contextIssues.push("Vendor hint stale");
    if (decision.exceptionFlags.includes("carry_forward_conflict")) contextIssues.push("Carry-forward 충돌");

    if (contextIssues.length > 0) {
      results.push({ axis: "context_search_ready", status: "warning", detail: contextIssues.join("; ") });
    } else {
      results.push({ axis: "context_search_ready", status: "ok", detail: "Context 정리됨" });
    }
  } else {
    results.push({ axis: "context_search_ready", status: "blocked", detail: "Context 미확인" });
  }

  return results;
}

// ── Handoff Readiness Aggregate ──
export interface SearchReopenHandoffReadinessResult {
  status: SearchReopenHandoffStatus;
  blockers: string[];
  warnings: string[];
  canHandoff: boolean;
}

export function evaluateSearchReopenHandoffReadiness(state: SourcingSearchReopenHandoffState): SearchReopenHandoffReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.procurementReentryReopenObjectId) blockers.push("Procurement re-entry reopen object lineage 없음");
  if (state.reentryRoute !== "sourcing_search_reopen") blockers.push("Route가 sourcing_search_reopen이 아님");

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Decision completeness
  if (!state.decision) {
    blockers.push("Search reopen decision 미완료");
  } else {
    // Tri-option lane policy check
    if (!state.decision.searchSeedMode) blockers.push("Search seed mode 미지정");

    // Substitute guard
    if (!state.decision.substituteAllowed && state.decision.searchSeedMode === "equivalent_plus_substitute") {
      blockers.push("대체 불허인데 substitute mode 선택됨");
    }

    // Excluded scope guard
    if (state.decision.exceptionFlags.includes("held_scope_contamination")) {
      blockers.push("Hold/excluded scope가 검색 대상에 포함됨");
    }
  }

  const status: SearchReopenHandoffStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 handoff 금지 (보수적)
  return { status, blockers, warnings, canHandoff: status === "ready" };
}

// ── Tri-option Lane Policy ──
export interface TriOptionLanePolicy {
  exactMatchEnabled: boolean;
  crossVendorEquivalentEnabled: boolean;
  alternativeSubstituteEnabled: boolean;
}

export function buildTriOptionLanePolicy(decision: SourcingSearchReopenDecision): TriOptionLanePolicy {
  return {
    exactMatchEnabled: true,
    crossVendorEquivalentEnabled: decision.equivalentAllowed,
    alternativeSubstituteEnabled: decision.substituteAllowed && decision.searchSeedMode === "equivalent_plus_substitute",
  };
}

// ── Canonical Sourcing Search Reopen Seed Package ──
export interface SourcingSearchReopenSeedPackage {
  id: string;
  sourcePoRecordId: string;
  sourceInventoryAvailabilityRecordId: string;
  sourceReorderDecisionCaseId: string;
  sourceProcurementReentryCaseId: string;
  sourceProcurementReentryReopenObjectId: string;
  vendorId: string;
  searchScope: string;
  searchQtyByLine: string;
  searchSeedMode: SearchSeedMode;
  exactItemSeed: string;
  vendorHint: string;
  catalogSeed: string;
  casSeed: string;
  equivalentAllowed: boolean;
  substituteAllowed: boolean;
  lanePolicy: TriOptionLanePolicy;
  carryForwardVendorContext: boolean;
  carryForwardCompareContext: boolean;
  carryForwardQuoteContext: boolean;
  excludedScope: string;
  operatorNote: string;
  exceptionFlags: SearchHandoffExceptionFlag[];
  createdAt: string;
  createdBy: string;
  nextDestination: string;
}

export function buildSourcingSearchReopenSeedPackage(state: SourcingSearchReopenHandoffState): SourcingSearchReopenSeedPackage | null {
  if (!state.decision) return null;
  const readiness = evaluateSearchReopenHandoffReadiness(state);
  if (!readiness.canHandoff) return null;

  const d = state.decision;
  const lanePolicy = buildTriOptionLanePolicy(d);

  return {
    id: `srchseed_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceInventoryAvailabilityRecordId: "",
    sourceReorderDecisionCaseId: state.sourceReorderDecisionCaseId,
    sourceProcurementReentryCaseId: state.sourceProcurementReentryCaseId,
    sourceProcurementReentryReopenObjectId: state.procurementReentryReopenObjectId,
    vendorId: state.vendorId,
    searchScope: d.searchScope,
    searchQtyByLine: d.searchQtyByLine,
    searchSeedMode: d.searchSeedMode,
    exactItemSeed: d.exactItemSeed,
    vendorHint: d.vendorHint,
    catalogSeed: d.catalogSeed,
    casSeed: d.casSeed,
    equivalentAllowed: d.equivalentAllowed,
    substituteAllowed: d.substituteAllowed,
    lanePolicy,
    carryForwardVendorContext: state.carryForwardVendorContext,
    carryForwardCompareContext: state.carryForwardCompareContext,
    carryForwardQuoteContext: state.carryForwardQuoteContext,
    excludedScope: d.excludedScope,
    operatorNote: d.operatorNote,
    exceptionFlags: d.exceptionFlags,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    nextDestination: "sourcing_search_reopen_v2",
  };
}

// ── Canonical Sourcing Search Reopen Case ──
export interface SourcingSearchReopenCase {
  id: string;
  sourceSeedPackageId: string;
  status: "queued" | "opened" | "on_hold" | "ready_for_search_execution" | "cancelled";
  openedAt: string;
  openedBy: string;
  targetWorkbench: string;
  nextDestination: string;
}

export function buildSourcingSearchReopenCase(seedPackage: SourcingSearchReopenSeedPackage): SourcingSearchReopenCase {
  return {
    id: `srchreopen_${Date.now().toString(36)}`,
    sourceSeedPackageId: seedPackage.id,
    status: "queued",
    openedAt: new Date().toISOString(),
    openedBy: "operator",
    targetWorkbench: "sourcing_search_reopen_v2",
    nextDestination: "sourcing_search_reopen_v2",
  };
}

// ── Correction Route ──
export interface SearchHandoffCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceProcurementReentryReopenObjectId: string;
  routeType: "reentry_workbench_return" | "shortage_recalculation" | "policy_clarification" | "context_refresh";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildSearchHandoffCorrectionRoute(
  state: SourcingSearchReopenHandoffState,
  routeType: SearchHandoffCorrectionRoute["routeType"],
  reason: string,
): SearchHandoffCorrectionRoute {
  const readiness = evaluateSearchReopenHandoffReadiness(state);

  const nextDest =
    routeType === "reentry_workbench_return" ? "procurement_reentry_workbench"
    : routeType === "shortage_recalculation" ? "reorder_decision_gate"
    : routeType === "policy_clarification" ? "policy_review"
    : "context_refresh";

  return {
    id: `srchhcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceProcurementReentryReopenObjectId: state.procurementReentryReopenObjectId,
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
export type SearchReopenHandoffEventType =
  | "sourcing_search_reopen_handoff_opened"
  | "sourcing_search_reopen_handoff_saved"
  | "sourcing_search_reopen_handoff_hold_set"
  | "sourcing_search_reopen_handoff_blocker_detected"
  | "sourcing_search_reopen_handoff_warning_detected"
  | "sourcing_search_reopen_seed_package_created"
  | "sourcing_search_reopen_case_created"
  | "sourcing_search_reopen_handoff_completed";

export interface SearchReopenHandoffEvent {
  type: SearchReopenHandoffEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  procurementReentryReopenObjectId: string;
  seedPackageId: string | null;
  reopenCaseId: string | null;
  changedFields: string[];
  destination: string;
}

export function createSearchReopenHandoffEvent(
  type: SearchReopenHandoffEventType,
  state: SourcingSearchReopenHandoffState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): SearchReopenHandoffEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    procurementReentryReopenObjectId: state.procurementReentryReopenObjectId,
    seedPackageId: state.seedPackageId,
    reopenCaseId: state.reopenCaseId,
    changedFields,
    destination,
  };
}
