/**
 * Procurement Re-entry Workbench Engine — re-entry scope/route/carry-forward → reopen object
 *
 * 고정 규칙:
 * 1. procurementReentryCase = 단일 입력 source.
 * 2. reorder_required ≠ search reopen. route selection 이후에만 handoff.
 * 3. scope/route/context/policy/seed 5개 readiness 축 분리 평가.
 * 4. carry-forward context validity guard 필수.
 * 5. canonical procurementReentryReopenObject = downstream workbench들의 단일 intake source.
 * 6. actual search/compare/quote/approval execution은 이 단계에서 금지.
 * 7. PO lifecycle과 re-entry lifecycle 분리.
 */

import type { ProcurementReentryCase, ReentryPath } from "./reorder-decision-gate-engine";

// ── Re-entry Case Status ──
export type ReentryCaseStatus = "queued" | "in_review" | "on_hold" | "ready_to_route" | "routed" | "cancelled";
export type ReentryReadinessStatus = "blocked" | "warning" | "ready";

// ── Re-entry Route ──
export type ReentryRoute =
  | "sourcing_search_reopen"
  | "sourcing_result_review_reentry"
  | "compare_reopen"
  | "request_reopen"
  | "quote_management_reentry"
  | "approval_reentry"
  | "monitor_only"
  | "cancelled";

// ── Search Seed Mode ──
export type SearchSeedMode = "exact_item_only" | "exact_plus_equivalent" | "equivalent_plus_substitute" | "quote_refresh_only" | "approval_reopen_only";

// ── Readiness Axis ──
export type ReentryReadinessAxis = "scope_reentry_ready" | "route_reentry_ready" | "context_reentry_ready" | "policy_reentry_ready" | "seed_reentry_ready";
export type ReentryAxisStatus = "ok" | "warning" | "blocked";

export interface ReentryAxisResult {
  axis: ReentryReadinessAxis;
  status: ReentryAxisStatus;
  detail: string;
}

// ── Exception Flag ──
export type ReentryExceptionFlag =
  | "scope_unclear"
  | "route_not_selected"
  | "vendor_context_stale"
  | "compare_context_stale"
  | "quote_context_stale"
  | "approval_context_invalid"
  | "substitute_disallowed_but_equivalent_seed"
  | "budget_recheck_required"
  | "held_scope_in_reentry"
  | "seed_package_incomplete";

// ── Re-entry Decision ──
export interface ProcurementReentryDecision {
  reentryScope: string;
  reentryQtyByLine: string;
  route: ReentryRoute;
  carryForwardVendorContext: boolean;
  carryForwardCompareContext: boolean;
  carryForwardQuoteContext: boolean;
  carryForwardApprovalContext: boolean;
  substituteAllowed: boolean;
  searchSeedMode: SearchSeedMode;
  urgency: "standard" | "urgent" | "critical";
  operatorNote: string;
  exceptionFlags: ReentryExceptionFlag[];
}

// ── State ──
export interface ProcurementReentryWorkbenchState {
  caseStatus: ReentryCaseStatus;
  reentryReadiness: ReentryReadinessStatus;
  procurementReentryCaseId: string;
  poRecordId: string;
  vendorId: string;
  sourceReorderDecisionCaseId: string;
  reentryPath: ReentryPath;
  shortageScope: string;
  shortageQtyByLine: string;
  substituteAllowed: boolean;
  leadTimeRisk: boolean;
  axisResults: ReentryAxisResult[];
  decision: ProcurementReentryDecision | null;
  blockerCount: number;
  warningCount: number;
  reopenObjectId: string | null;
  correctionRouteId: string | null;
}

export function createInitialProcurementReentryWorkbenchState(reentryCase: ProcurementReentryCase): ProcurementReentryWorkbenchState {
  const axes = evaluateReentryReadinessAxes(reentryCase, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    caseStatus: "in_review",
    reentryReadiness: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "blocked",
    procurementReentryCaseId: reentryCase.id,
    poRecordId: reentryCase.sourcePoRecordId,
    vendorId: reentryCase.vendorId,
    sourceReorderDecisionCaseId: reentryCase.sourceReorderDecisionCaseId,
    reentryPath: reentryCase.reentryPath,
    shortageScope: reentryCase.shortageScope,
    shortageQtyByLine: reentryCase.shortageQtyByLine,
    substituteAllowed: reentryCase.substituteAllowed,
    leadTimeRisk: reentryCase.leadTimeRisk,
    axisResults: axes,
    decision: null,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    reopenObjectId: null,
    correctionRouteId: null,
  };
}

// ── Readiness Axes Evaluation ──
export function evaluateReentryReadinessAxes(reentryCase: ProcurementReentryCase, decision: ProcurementReentryDecision | null): ReentryAxisResult[] {
  const results: ReentryAxisResult[] = [];

  // 1. Scope reentry ready
  if (!reentryCase.shortageScope) {
    results.push({ axis: "scope_reentry_ready", status: "blocked", detail: "재진입 대상 범위 없음" });
  } else if (decision && !decision.reentryScope) {
    results.push({ axis: "scope_reentry_ready", status: "blocked", detail: "재진입 라인 범위 미지정" });
  } else if (decision?.reentryScope) {
    results.push({ axis: "scope_reentry_ready", status: "ok", detail: "재진입 범위 확인됨" });
  } else {
    results.push({ axis: "scope_reentry_ready", status: "blocked", detail: "재진입 범위 미입력" });
  }

  // 2. Route reentry ready
  if (decision && decision.route && decision.route !== "cancelled") {
    results.push({ axis: "route_reentry_ready", status: "ok", detail: `경로: ${decision.route}` });
  } else if (decision && (!decision.route || decision.route === "cancelled")) {
    results.push({ axis: "route_reentry_ready", status: "blocked", detail: "재진입 경로 미선택" });
  } else {
    results.push({ axis: "route_reentry_ready", status: "blocked", detail: "경로 미입력" });
  }

  // 3. Context reentry ready
  if (decision) {
    const staleFlags: string[] = [];
    if (decision.carryForwardVendorContext && decision.exceptionFlags.includes("vendor_context_stale")) staleFlags.push("vendor");
    if (decision.carryForwardCompareContext && decision.exceptionFlags.includes("compare_context_stale")) staleFlags.push("compare");
    if (decision.carryForwardQuoteContext && decision.exceptionFlags.includes("quote_context_stale")) staleFlags.push("quote");
    if (decision.carryForwardApprovalContext && decision.exceptionFlags.includes("approval_context_invalid")) staleFlags.push("approval");

    if (staleFlags.length > 0) {
      results.push({ axis: "context_reentry_ready", status: "blocked", detail: `Stale/invalid carry-forward: ${staleFlags.join(", ")}` });
    } else {
      results.push({ axis: "context_reentry_ready", status: "ok", detail: "Carry-forward context 확인됨" });
    }
  } else {
    results.push({ axis: "context_reentry_ready", status: "blocked", detail: "Context carry-forward 미확인" });
  }

  // 4. Policy reentry ready
  if (decision) {
    const policyIssues: string[] = [];
    if (decision.exceptionFlags.includes("budget_recheck_required")) policyIssues.push("예산 재확인 필요");
    if (decision.exceptionFlags.includes("substitute_disallowed_but_equivalent_seed")) policyIssues.push("대체 불허인데 equivalent seed 선택됨");
    if (decision.exceptionFlags.includes("held_scope_in_reentry")) policyIssues.push("Hold scope가 재진입 범위에 포함됨");

    if (policyIssues.length > 0) {
      results.push({ axis: "policy_reentry_ready", status: "blocked", detail: policyIssues.join("; ") });
    } else {
      results.push({ axis: "policy_reentry_ready", status: "ok", detail: "정책 기준 충족" });
    }
  } else {
    results.push({ axis: "policy_reentry_ready", status: "blocked", detail: "정책 기준 미확인" });
  }

  // 5. Seed reentry ready
  if (decision) {
    if (decision.exceptionFlags.includes("seed_package_incomplete")) {
      results.push({ axis: "seed_reentry_ready", status: "blocked", detail: "Seed package 불완전" });
    } else if (decision.searchSeedMode) {
      results.push({ axis: "seed_reentry_ready", status: "ok", detail: `Seed mode: ${decision.searchSeedMode}` });
    } else {
      results.push({ axis: "seed_reentry_ready", status: "blocked", detail: "Search seed mode 미지정" });
    }
  } else {
    results.push({ axis: "seed_reentry_ready", status: "blocked", detail: "Seed 미입력" });
  }

  return results;
}

// ── Readiness Aggregate ──
export interface ReentryReadinessResult {
  status: ReentryReadinessStatus;
  blockers: string[];
  warnings: string[];
  canHandoff: boolean;
}

export function evaluateReentryReadiness(state: ProcurementReentryWorkbenchState): ReentryReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.procurementReentryCaseId) blockers.push("Procurement re-entry case lineage 없음");
  if (!state.sourceReorderDecisionCaseId) blockers.push("Reorder decision case lineage 없음");

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Decision completeness
  if (!state.decision) {
    blockers.push("Procurement re-entry decision 미완료");
  } else {
    // Route validity
    if (!state.decision.route || state.decision.route === "cancelled") {
      blockers.push("재진입 경로 미선택");
    }

    // Substitute guard
    if (!state.decision.substituteAllowed && (state.decision.searchSeedMode === "equivalent_plus_substitute")) {
      blockers.push("대체 불허인데 substitute seed mode 선택됨");
    }

    // Quote-only route guard
    if (state.decision.route === "quote_management_reentry" && state.decision.searchSeedMode !== "quote_refresh_only") {
      warnings.push("Quote re-entry 경로인데 seed mode가 quote_refresh_only가 아님");
    }

    // Approval-only route guard
    if (state.decision.route === "approval_reentry" && state.decision.searchSeedMode !== "approval_reopen_only") {
      warnings.push("Approval re-entry 경로인데 seed mode가 approval_reopen_only가 아님");
    }

    // Urgency + lead time
    if (state.leadTimeRisk && state.decision.urgency === "standard") {
      warnings.push("리드타임 위험인데 urgency가 standard");
    }
  }

  const status: ReentryReadinessStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 handoff 금지 (보수적)
  return { status, blockers, warnings, canHandoff: status === "ready" };
}

// ── Canonical Procurement Re-entry Reopen Object ──
export interface ProcurementReentryReopenObject {
  id: string;
  sourcePoRecordId: string;
  sourceInventoryAvailabilityRecordId: string;
  sourceReorderDecisionCaseId: string;
  sourceProcurementReentryCaseId: string;
  vendorId: string;
  reentryScope: string;
  reentryQtyByLine: string;
  route: ReentryRoute;
  carryForwardVendorContext: boolean;
  carryForwardCompareContext: boolean;
  carryForwardQuoteContext: boolean;
  carryForwardApprovalContext: boolean;
  substituteAllowed: boolean;
  searchSeedMode: SearchSeedMode;
  urgency: "standard" | "urgent" | "critical";
  operatorNote: string;
  exceptionFlags: ReentryExceptionFlag[];
  createdAt: string;
  createdBy: string;
  nextDestination: string;
}

export function buildProcurementReentryReopenObject(state: ProcurementReentryWorkbenchState): ProcurementReentryReopenObject | null {
  if (!state.decision) return null;
  const readiness = evaluateReentryReadiness(state);
  if (!readiness.canHandoff) return null;

  const d = state.decision;
  const nextDest =
    d.route === "sourcing_search_reopen" ? "sourcing_search_reopen_v2"
    : d.route === "sourcing_result_review_reentry" ? "sourcing_result_review_v2"
    : d.route === "compare_reopen" ? "compare_reopen_v2"
    : d.route === "request_reopen" ? "request_reopen"
    : d.route === "quote_management_reentry" ? "quote_management_reentry"
    : d.route === "approval_reentry" ? "approval_reentry"
    : d.route === "monitor_only" ? "reorder_monitor"
    : "closed";

  return {
    id: `procreopen_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceInventoryAvailabilityRecordId: "",
    sourceReorderDecisionCaseId: state.sourceReorderDecisionCaseId,
    sourceProcurementReentryCaseId: state.procurementReentryCaseId,
    vendorId: state.vendorId,
    reentryScope: d.reentryScope,
    reentryQtyByLine: d.reentryQtyByLine,
    route: d.route,
    carryForwardVendorContext: d.carryForwardVendorContext,
    carryForwardCompareContext: d.carryForwardCompareContext,
    carryForwardQuoteContext: d.carryForwardQuoteContext,
    carryForwardApprovalContext: d.carryForwardApprovalContext,
    substituteAllowed: d.substituteAllowed,
    searchSeedMode: d.searchSeedMode,
    urgency: d.urgency,
    operatorNote: d.operatorNote,
    exceptionFlags: d.exceptionFlags,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    nextDestination: nextDest,
  };
}

// ── Correction Route ──
export interface ReentryCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceProcurementReentryCaseId: string;
  routeType: "inventory_hold_resolution" | "availability_correction" | "shortage_recalculation" | "context_refresh";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildReentryCorrectionRoute(
  state: ProcurementReentryWorkbenchState,
  routeType: ReentryCorrectionRoute["routeType"],
  reason: string,
): ReentryCorrectionRoute {
  const readiness = evaluateReentryReadiness(state);

  const nextDest =
    routeType === "inventory_hold_resolution" ? "inventory_hold_management"
    : routeType === "availability_correction" ? "stock_release_workbench"
    : routeType === "shortage_recalculation" ? "reorder_decision_gate"
    : "context_refresh";

  return {
    id: `reentrycorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceProcurementReentryCaseId: state.procurementReentryCaseId,
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
export type ProcurementReentryEventType =
  | "procurement_reentry_workbench_opened"
  | "procurement_reentry_saved"
  | "procurement_reentry_hold_set"
  | "procurement_reentry_blocker_detected"
  | "procurement_reentry_warning_detected"
  | "procurement_reentry_route_selected"
  | "procurement_reentry_reopen_object_created"
  | "procurement_reentry_handoff_completed";

export interface ProcurementReentryEvent {
  type: ProcurementReentryEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  reorderDecisionCaseId: string;
  procurementReentryCaseId: string;
  reopenObjectId: string | null;
  changedFields: string[];
  destination: string;
}

export function createProcurementReentryEvent(
  type: ProcurementReentryEventType,
  state: ProcurementReentryWorkbenchState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): ProcurementReentryEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    reorderDecisionCaseId: state.sourceReorderDecisionCaseId,
    procurementReentryCaseId: state.procurementReentryCaseId,
    reopenObjectId: state.reopenObjectId,
    changedFields,
    destination,
  };
}
