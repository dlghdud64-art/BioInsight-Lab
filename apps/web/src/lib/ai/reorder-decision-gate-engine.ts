/**
 * Reorder Decision Gate Engine — available stock → reorder/re-entry judgment gate
 *
 * 고정 규칙:
 * 1. inventoryAvailabilityRecord = 단일 입력 source.
 * 2. available stock ≠ reorder 불필요. gate 판단 이후에만 확정.
 * 3. coverage/risk/hold/reentry/policy 5개 readiness 축 분리 평가.
 * 4. held/partial scope는 coverage 산출에서 제외.
 * 5. canonical reorderDecisionCase = 다음 단계 단일 intake source.
 * 6. actual sourcing/search/compare 재실행은 이 단계에서 금지.
 * 7. PO lifecycle과 inventory replenishment lifecycle 분리.
 */

import type { InventoryAvailabilityRecord, AvailabilityRecordStatus } from "./available-stock-release-workbench-engine";

// ── Gate Status ──
export type ReorderDecisionGateStatus = "not_started" | "blocked" | "warning" | "ready" | "handed_off";

// ── Readiness Axis ──
export type ReorderReadinessAxis = "coverage_ready" | "risk_ready" | "hold_ready" | "reentry_ready" | "policy_ready";
export type ReorderAxisStatus = "ok" | "warning" | "blocked";

export interface ReorderAxisResult {
  axis: ReorderReadinessAxis;
  status: ReorderAxisStatus;
  detail: string;
}

// ── Re-entry Path ──
export type ReentryPath = "reopen_existing_procurement" | "sourcing_search_reentry" | "quote_reentry" | "approval_reentry" | "no_reorder_required" | "monitor_only";

// ── Exception Flag ──
export type ReorderExceptionFlag =
  | "shortage_unclear"
  | "hold_not_separated"
  | "safety_stock_breach"
  | "lead_time_high"
  | "demand_linkage_missing"
  | "substitute_unverified"
  | "budget_reentry_required"
  | "approval_reentry_required"
  | "forecast_low_confidence"
  | "partial_coverage_only";

// ── Reorder Decision Gate Decision ──
export interface ReorderDecisionGateDecision {
  reorderCandidateScope: string;
  remainingShortageQtyByLine: string;
  safetyStockBreach: boolean;
  leadTimeRisk: boolean;
  substituteAllowed: boolean;
  holdExcludedShortage: string;
  reentryPath: ReentryPath;
  operatorNote: string;
  exceptionFlags: ReorderExceptionFlag[];
}

// ── State ──
export interface ReorderDecisionGateState {
  gateId: string;
  gateStatus: ReorderDecisionGateStatus;
  poRecordId: string;
  vendorId: string;
  inventoryAvailabilityRecordId: string;
  availabilityStatus: AvailabilityRecordStatus;
  availableQtySummary: string;
  heldExcludedScope: string;
  axisResults: ReorderAxisResult[];
  decision: ReorderDecisionGateDecision | null;
  blockerCount: number;
  warningCount: number;
  reorderDecisionCaseId: string | null;
  procurementReentryCaseId: string | null;
  reorderMonitorCaseId: string | null;
  holdCaseId: string | null;
}

export function createInitialReorderDecisionGateState(record: InventoryAvailabilityRecord): ReorderDecisionGateState {
  const axes = evaluateReorderReadinessAxes(record, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    gateId: `reordgate_${Date.now().toString(36)}`,
    gateStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    poRecordId: record.sourcePoRecordId,
    vendorId: record.vendorId,
    inventoryAvailabilityRecordId: record.id,
    availabilityStatus: record.status,
    availableQtySummary: record.availableQtyByLine,
    heldExcludedScope: record.heldExcludedScope,
    axisResults: axes,
    decision: null,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    reorderDecisionCaseId: null,
    procurementReentryCaseId: null,
    reorderMonitorCaseId: null,
    holdCaseId: null,
  };
}

// ── Readiness Axes Evaluation ──
export function evaluateReorderReadinessAxes(record: InventoryAvailabilityRecord, decision: ReorderDecisionGateDecision | null): ReorderAxisResult[] {
  const results: ReorderAxisResult[] = [];

  // 1. Coverage ready
  if (record.status === "failed") {
    results.push({ axis: "coverage_ready", status: "blocked", detail: "Availability record가 failed 상태" });
  } else if (decision && !decision.remainingShortageQtyByLine) {
    results.push({ axis: "coverage_ready", status: "blocked", detail: "잔여 부족 수량 미산출" });
  } else if (decision?.remainingShortageQtyByLine) {
    results.push({ axis: "coverage_ready", status: "ok", detail: "잔여 부족 범위 확인됨" });
  } else {
    results.push({ axis: "coverage_ready", status: "blocked", detail: "Coverage 분석 미완료" });
  }

  // 2. Risk ready
  if (decision) {
    const risks: string[] = [];
    if (decision.safetyStockBreach) risks.push("안전재고 미달");
    if (decision.leadTimeRisk) risks.push("리드타임 위험");
    if (decision.exceptionFlags.includes("forecast_low_confidence")) risks.push("수요 예측 신뢰도 낮음");

    if (risks.length > 0 && !decision.reorderCandidateScope) {
      results.push({ axis: "risk_ready", status: "blocked", detail: `리스크 존재 (${risks.join(", ")})하나 재주문 후보 미지정` });
    } else if (risks.length > 0) {
      results.push({ axis: "risk_ready", status: "warning", detail: `리스크 존재: ${risks.join(", ")}` });
    } else {
      results.push({ axis: "risk_ready", status: "ok", detail: "리스크 정리됨" });
    }
  } else {
    results.push({ axis: "risk_ready", status: "blocked", detail: "리스크 분석 미완료" });
  }

  // 3. Hold ready
  if (record.heldExcludedScope && record.heldExcludedScope !== "없음") {
    if (decision && decision.holdExcludedShortage) {
      results.push({ axis: "hold_ready", status: "ok", detail: "Hold 제외 범위 분리됨" });
    } else {
      results.push({ axis: "hold_ready", status: "blocked", detail: "Hold scope가 coverage와 분리되지 않음" });
    }
  } else {
    results.push({ axis: "hold_ready", status: decision ? "ok" : "ok", detail: "Hold scope 없음" });
  }

  // 4. Reentry ready
  if (decision && decision.reentryPath) {
    results.push({ axis: "reentry_ready", status: "ok", detail: `재진입 경로: ${decision.reentryPath}` });
  } else if (decision && !decision.reentryPath) {
    results.push({ axis: "reentry_ready", status: "blocked", detail: "재진입 경로 미지정" });
  } else {
    results.push({ axis: "reentry_ready", status: "blocked", detail: "재진입 경로 미입력" });
  }

  // 5. Policy ready
  if (decision) {
    const policyIssues: string[] = [];
    if (decision.exceptionFlags.includes("budget_reentry_required")) policyIssues.push("예산 재진입 필요");
    if (decision.exceptionFlags.includes("approval_reentry_required")) policyIssues.push("승인 재진입 필요");
    if (decision.exceptionFlags.includes("substitute_unverified")) policyIssues.push("대체품 미검증");

    if (policyIssues.length > 0) {
      results.push({ axis: "policy_ready", status: "warning", detail: policyIssues.join("; ") });
    } else {
      results.push({ axis: "policy_ready", status: "ok", detail: "정책 기준 충족" });
    }
  } else {
    results.push({ axis: "policy_ready", status: "blocked", detail: "정책 기준 미확인" });
  }

  return results;
}

// ── Gate Readiness Aggregate ──
export interface ReorderDecisionReadinessResult {
  gateStatus: ReorderDecisionGateStatus;
  blockers: string[];
  warnings: string[];
  canHandoff: boolean;
}

export function evaluateReorderDecisionReadiness(state: ReorderDecisionGateState): ReorderDecisionReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.inventoryAvailabilityRecordId) blockers.push("Inventory availability record lineage 없음");
  if (state.availabilityStatus === "failed") blockers.push("Availability record가 failed 상태");

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Decision completeness
  if (!state.decision) {
    blockers.push("Reorder decision 미완료");
  } else {
    if (state.decision.exceptionFlags.includes("shortage_unclear")) blockers.push("잔여 부족 범위 불명확");
    if (state.decision.exceptionFlags.includes("hold_not_separated")) blockers.push("Hold scope 미분리");
    if (state.decision.exceptionFlags.includes("demand_linkage_missing")) blockers.push("수요 연계 불명확");

    // Partial guard
    if (state.availabilityStatus === "available_partial" && !state.decision.remainingShortageQtyByLine) {
      blockers.push("Partial availability인데 잔여 부족 수량 미산출");
    }
    if (state.availabilityStatus === "held_partial" && !state.decision.holdExcludedShortage) {
      blockers.push("Hold partial인데 hold 제외 부족 범위 미분리");
    }

    // Safety stock guard
    if (state.decision.safetyStockBreach && state.decision.reentryPath === "no_reorder_required") {
      blockers.push("안전재고 미달인데 재주문 불필요 판단 불가");
    }
  }

  const gateStatus: ReorderDecisionGateStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 handoff 금지 (보수적)
  return { gateStatus, blockers, warnings, canHandoff: gateStatus === "ready" };
}

// ── Canonical Reorder Decision Case ──
export type ReorderDecisionCaseStatus = "queued" | "in_review" | "on_hold" | "reorder_required" | "no_reorder_required" | "routed_to_procurement_reentry" | "cancelled";

export interface ReorderDecisionCaseRecord {
  id: string;
  sourcePoRecordId: string;
  sourceInventoryAvailabilityRecordId: string;
  sourceReorderDecisionGateId: string;
  vendorId: string;
  reorderCandidateScope: string;
  remainingShortageQtyByLine: string;
  safetyStockBreach: boolean;
  leadTimeRisk: boolean;
  substituteAllowed: boolean;
  holdExcludedShortage: string;
  reentryPath: ReentryPath;
  operatorDecisionNote: string;
  exceptionFlags: ReorderExceptionFlag[];
  createdAt: string;
  createdBy: string;
  status: ReorderDecisionCaseStatus;
  nextDestination: string;
}

export function buildReorderDecisionCase(state: ReorderDecisionGateState): ReorderDecisionCaseRecord | null {
  if (!state.decision) return null;
  const readiness = evaluateReorderDecisionReadiness(state);
  if (!readiness.canHandoff) return null;

  const d = state.decision;
  const caseStatus: ReorderDecisionCaseStatus =
    d.reentryPath === "no_reorder_required" ? "no_reorder_required"
    : d.reentryPath === "monitor_only" ? "in_review"
    : "reorder_required";

  const nextDest =
    d.reentryPath === "no_reorder_required" ? "closed"
    : d.reentryPath === "monitor_only" ? "reorder_monitor"
    : "procurement_reentry";

  return {
    id: `reorddec_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceInventoryAvailabilityRecordId: state.inventoryAvailabilityRecordId,
    sourceReorderDecisionGateId: state.gateId,
    vendorId: state.vendorId,
    reorderCandidateScope: d.reorderCandidateScope,
    remainingShortageQtyByLine: d.remainingShortageQtyByLine,
    safetyStockBreach: d.safetyStockBreach,
    leadTimeRisk: d.leadTimeRisk,
    substituteAllowed: d.substituteAllowed,
    holdExcludedShortage: d.holdExcludedShortage,
    reentryPath: d.reentryPath,
    operatorDecisionNote: d.operatorNote,
    exceptionFlags: d.exceptionFlags,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: caseStatus,
    nextDestination: nextDest,
  };
}

// ── Downstream: Procurement Re-entry Case ──
export interface ProcurementReentryCase {
  id: string;
  sourcePoRecordId: string;
  sourceReorderDecisionCaseId: string;
  vendorId: string;
  reentryPath: ReentryPath;
  shortageScope: string;
  shortageQtyByLine: string;
  substituteAllowed: boolean;
  leadTimeRisk: boolean;
  operatorNote: string;
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "completed" | "cancelled";
  nextDestination: string;
}

export function buildProcurementReentryCase(decisionCase: ReorderDecisionCaseRecord): ProcurementReentryCase | null {
  if (decisionCase.status === "no_reorder_required" || decisionCase.status === "cancelled") return null;
  if (decisionCase.reentryPath === "no_reorder_required" || decisionCase.reentryPath === "monitor_only") return null;

  const nextDest =
    decisionCase.reentryPath === "sourcing_search_reentry" ? "sourcing_search"
    : decisionCase.reentryPath === "quote_reentry" ? "quote_request"
    : decisionCase.reentryPath === "approval_reentry" ? "approval_review"
    : "procurement_reopen";

  return {
    id: `procreentry_${Date.now().toString(36)}`,
    sourcePoRecordId: decisionCase.sourcePoRecordId,
    sourceReorderDecisionCaseId: decisionCase.id,
    vendorId: decisionCase.vendorId,
    reentryPath: decisionCase.reentryPath,
    shortageScope: decisionCase.reorderCandidateScope,
    shortageQtyByLine: decisionCase.remainingShortageQtyByLine,
    substituteAllowed: decisionCase.substituteAllowed,
    leadTimeRisk: decisionCase.leadTimeRisk,
    operatorNote: decisionCase.operatorDecisionNote,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: nextDest,
  };
}

// ── Downstream: Reorder Monitor Case ──
export interface ReorderMonitorCase {
  id: string;
  sourcePoRecordId: string;
  sourceReorderDecisionCaseId: string;
  vendorId: string;
  monitorScope: string;
  safetyStockBreach: boolean;
  leadTimeRisk: boolean;
  monitorNote: string;
  createdAt: string;
  createdBy: string;
  status: "monitoring" | "escalated" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildReorderMonitorCase(decisionCase: ReorderDecisionCaseRecord): ReorderMonitorCase | null {
  if (decisionCase.reentryPath !== "monitor_only") return null;

  return {
    id: `reordmon_${Date.now().toString(36)}`,
    sourcePoRecordId: decisionCase.sourcePoRecordId,
    sourceReorderDecisionCaseId: decisionCase.id,
    vendorId: decisionCase.vendorId,
    monitorScope: decisionCase.reorderCandidateScope,
    safetyStockBreach: decisionCase.safetyStockBreach,
    leadTimeRisk: decisionCase.leadTimeRisk,
    monitorNote: decisionCase.operatorDecisionNote,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "monitoring",
    nextDestination: "reorder_monitor",
  };
}

// ── Correction Route ──
export interface ReorderCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceReorderDecisionGateId: string;
  routeType: "availability_correction" | "hold_resolution" | "demand_clarification" | "coverage_recalculation";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildReorderCorrectionRoute(
  state: ReorderDecisionGateState,
  routeType: ReorderCorrectionRoute["routeType"],
  reason: string,
): ReorderCorrectionRoute {
  const readiness = evaluateReorderDecisionReadiness(state);

  const nextDest =
    routeType === "availability_correction" ? "stock_release_workbench"
    : routeType === "hold_resolution" ? "inventory_hold_management"
    : routeType === "demand_clarification" ? "demand_review"
    : "coverage_recalculation";

  return {
    id: `reordcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceReorderDecisionGateId: state.gateId,
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
export type ReorderDecisionGateEventType =
  | "reorder_decision_gate_opened"
  | "reorder_decision_gate_saved"
  | "reorder_decision_gate_hold_set"
  | "reorder_decision_gate_blocker_detected"
  | "reorder_decision_gate_warning_detected"
  | "reorder_decision_case_created"
  | "procurement_reentry_case_created"
  | "reorder_monitor_case_created"
  | "reorder_decision_handoff_completed";

export interface ReorderDecisionGateEvent {
  type: ReorderDecisionGateEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  inventoryAvailabilityRecordId: string;
  gateId: string;
  reorderDecisionCaseId: string | null;
  downstreamCaseId: string | null;
  changedFields: string[];
  destination: string;
}

export function createReorderDecisionGateEvent(
  type: ReorderDecisionGateEventType,
  state: ReorderDecisionGateState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
  downstreamCaseId?: string | null,
): ReorderDecisionGateEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    inventoryAvailabilityRecordId: state.inventoryAvailabilityRecordId,
    gateId: state.gateId,
    reorderDecisionCaseId: state.reorderDecisionCaseId,
    downstreamCaseId: downstreamCaseId ?? null,
    changedFields,
    destination,
  };
}
