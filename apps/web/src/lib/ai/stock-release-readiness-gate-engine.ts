/**
 * Stock Release Readiness Gate Engine — received → release eligible scope gate
 *
 * 고정 규칙:
 * 1. receivingExecutionRecord = 단일 입력 source.
 * 2. received ≠ available stock. gate 통과 이후에만 release handoff.
 * 3. scope/quality/location/traceability/policy 5개 readiness 축 분리 평가.
 * 4. quarantine/discrepancy/hold scope는 release eligible에서 제외.
 * 5. canonical stockReleaseCase = 다음 단계 단일 intake source.
 * 6. actual inventory qty mutation은 이 단계에서 금지.
 * 7. available stock / reorder / 재구매 직접 점프 금지.
 */

import type { ReceivingExecutionRecord, ExecutionRecordStatus } from "./receiving-execution-workbench-engine";

// ── Gate Status ──
export type StockReleaseReadinessGateStatus = "not_started" | "blocked" | "warning" | "ready" | "handed_off";

// ── Readiness Axis ──
export type ReleaseReadinessAxis = "scope_release_ready" | "quality_release_ready" | "location_release_ready" | "traceability_release_ready" | "policy_release_ready";
export type ReleaseAxisStatus = "ok" | "warning" | "blocked";

export interface ReleaseAxisResult {
  axis: ReleaseReadinessAxis;
  status: ReleaseAxisStatus;
  detail: string;
}

// ── Exception Flag ──
export type ReleaseExceptionFlag =
  | "scope_unclear"
  | "quarantine_not_separated"
  | "discrepancy_unresolved"
  | "lot_missing"
  | "expiry_missing"
  | "bin_unassigned"
  | "location_unconfirmed"
  | "qa_hold_active"
  | "doc_hold_active"
  | "partial_remaining_open"
  | "policy_violation";

// ── Release Readiness Decision ──
export interface StockReleaseReadinessDecision {
  releaseEligibleScope: string;
  releaseQtyByLine: string;
  holdScope: string;
  quarantineExcludedScope: string;
  discrepancyExcludedScope: string;
  locationId: string;
  binAssignmentRequired: boolean;
  lotScopedRelease: boolean;
  expiryPolicyChecked: boolean;
  releaseInstruction: string;
  operatorNote: string;
  exceptionFlags: ReleaseExceptionFlag[];
}

// ── State ──
export interface StockReleaseReadinessGateState {
  gateId: string;
  gateStatus: StockReleaseReadinessGateStatus;
  poRecordId: string;
  vendorId: string;
  receivingExecutionRecordId: string;
  receivingRecordStatus: ExecutionRecordStatus;
  receivedLineSummary: string;
  cleanReceivedScope: string;
  quarantineScope: string;
  discrepancyScope: string;
  axisResults: ReleaseAxisResult[];
  decision: StockReleaseReadinessDecision | null;
  blockerCount: number;
  warningCount: number;
  stockReleaseCaseId: string | null;
  correctionRouteId: string | null;
}

export function createInitialStockReleaseReadinessGateState(record: ReceivingExecutionRecord): StockReleaseReadinessGateState {
  const axes = evaluateReleaseReadinessAxes(record, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    gateId: `stkrelgate_${Date.now().toString(36)}`,
    gateStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    poRecordId: record.sourcePoRecordId,
    vendorId: record.vendorId,
    receivingExecutionRecordId: record.id,
    receivingRecordStatus: record.status,
    receivedLineSummary: record.receivedLineSummary,
    cleanReceivedScope: record.status === "recorded_full" ? "전체" : "부분",
    quarantineScope: record.quarantineSummary,
    discrepancyScope: record.discrepancySummary,
    axisResults: axes,
    decision: null,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    stockReleaseCaseId: null,
    correctionRouteId: null,
  };
}

// ── Readiness Axes Evaluation ──
export function evaluateReleaseReadinessAxes(record: ReceivingExecutionRecord, decision: StockReleaseReadinessDecision | null): ReleaseAxisResult[] {
  const results: ReleaseAxisResult[] = [];

  // 1. Scope release ready
  if (record.status === "quarantined" || record.status === "failed") {
    results.push({ axis: "scope_release_ready", status: "blocked", detail: "Receiving record가 release candidate 상태가 아님" });
  } else if (decision && !decision.releaseEligibleScope) {
    results.push({ axis: "scope_release_ready", status: "blocked", detail: "Release 가능 범위 미지정" });
  } else if (decision?.releaseEligibleScope) {
    results.push({ axis: "scope_release_ready", status: "ok", detail: "Release 범위 확인됨" });
  } else {
    results.push({ axis: "scope_release_ready", status: "blocked", detail: "Release 범위 미입력" });
  }

  // 2. Quality release ready
  if (record.quarantineSummary !== "없음" && (!decision || !decision.quarantineExcludedScope)) {
    results.push({ axis: "quality_release_ready", status: "blocked", detail: "Quarantine 대상 미분리" });
  } else if (record.discrepancySummary !== "없음" && (!decision || !decision.discrepancyExcludedScope)) {
    results.push({ axis: "quality_release_ready", status: "blocked", detail: "Discrepancy 대상 미분리" });
  } else if (decision?.exceptionFlags.includes("qa_hold_active")) {
    results.push({ axis: "quality_release_ready", status: "blocked", detail: "QA hold 활성 상태" });
  } else if (decision?.exceptionFlags.includes("doc_hold_active")) {
    results.push({ axis: "quality_release_ready", status: "warning", detail: "Document hold 활성 상태" });
  } else {
    results.push({ axis: "quality_release_ready", status: decision ? "ok" : "blocked", detail: decision ? "품질 기준 확인됨" : "품질 기준 미확인" });
  }

  // 3. Location release ready
  if (decision && decision.locationId) {
    if (decision.binAssignmentRequired && decision.exceptionFlags.includes("bin_unassigned")) {
      results.push({ axis: "location_release_ready", status: "blocked", detail: "Bin assignment 필요하나 미지정" });
    } else {
      results.push({ axis: "location_release_ready", status: "ok", detail: "Location/bin 확인됨" });
    }
  } else if (decision && !decision.locationId) {
    results.push({ axis: "location_release_ready", status: "blocked", detail: "Release 위치 미지정" });
  } else {
    results.push({ axis: "location_release_ready", status: "blocked", detail: "Location 미입력" });
  }

  // 4. Traceability release ready
  if (decision) {
    const traceIssues: string[] = [];
    if (decision.lotScopedRelease && decision.exceptionFlags.includes("lot_missing")) traceIssues.push("lot");
    if (decision.expiryPolicyChecked && decision.exceptionFlags.includes("expiry_missing")) traceIssues.push("expiry");
    if (traceIssues.length > 0) {
      results.push({ axis: "traceability_release_ready", status: "blocked", detail: `${traceIssues.join(", ")} traceability 누락` });
    } else {
      results.push({ axis: "traceability_release_ready", status: "ok", detail: "Lot/expiry traceability 확인됨" });
    }
  } else {
    results.push({ axis: "traceability_release_ready", status: "blocked", detail: "Traceability 미확인" });
  }

  // 5. Policy release ready
  if (decision?.exceptionFlags.includes("policy_violation")) {
    results.push({ axis: "policy_release_ready", status: "blocked", detail: "Warehouse/inventory policy 위반" });
  } else if (decision?.exceptionFlags.includes("partial_remaining_open")) {
    results.push({ axis: "policy_release_ready", status: "warning", detail: "Partial receipt로 인해 remaining open qty 존재" });
  } else {
    results.push({ axis: "policy_release_ready", status: decision ? "ok" : "blocked", detail: decision ? "정책 기준 충족" : "정책 기준 미확인" });
  }

  return results;
}

// ── Gate Readiness Aggregate ──
export interface StockReleaseReadinessResult {
  gateStatus: StockReleaseReadinessGateStatus;
  blockers: string[];
  warnings: string[];
  canHandoff: boolean;
}

export function evaluateStockReleaseReadiness(state: StockReleaseReadinessGateState): StockReleaseReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.receivingExecutionRecordId) blockers.push("Receiving execution record lineage 없음");
  if (state.receivingRecordStatus === "quarantined" || state.receivingRecordStatus === "failed") {
    blockers.push("Receiving record가 release candidate 상태가 아님");
  }

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Decision completeness
  if (!state.decision) {
    blockers.push("Stock release readiness decision 미완료");
  } else {
    if (state.decision.exceptionFlags.includes("scope_unclear")) blockers.push("Release 범위 불명확");
    if (state.decision.exceptionFlags.includes("quarantine_not_separated")) blockers.push("Quarantine 대상 미분리");
    if (state.decision.exceptionFlags.includes("discrepancy_unresolved")) blockers.push("Discrepancy 미해결");
    if (state.decision.exceptionFlags.includes("location_unconfirmed")) blockers.push("Release 위치 미확정");
  }

  const gateStatus: StockReleaseReadinessGateStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 handoff 금지 (보수적)
  return { gateStatus, blockers, warnings, canHandoff: gateStatus === "ready" };
}

// ── Canonical Stock Release Case ──
export interface StockReleaseCase {
  id: string;
  sourcePoRecordId: string;
  sourceReceivingExecutionRecordId: string;
  sourceStockReleaseReadinessGateId: string;
  vendorId: string;
  releaseEligibleScope: string;
  releaseQtyByLine: string;
  holdScope: string;
  quarantineExcludedScope: string;
  discrepancyExcludedScope: string;
  locationId: string;
  binAssignmentRequired: boolean;
  lotScopedRelease: boolean;
  expiryPolicyChecked: boolean;
  releaseInstruction: string;
  exceptionFlags: ReleaseExceptionFlag[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_review" | "on_hold" | "ready_for_release_execution" | "released_partially" | "released_fully" | "cancelled";
  nextDestination: string;
}

export function buildStockReleaseCase(state: StockReleaseReadinessGateState): StockReleaseCase | null {
  if (!state.decision) return null;
  const readiness = evaluateStockReleaseReadiness(state);
  if (!readiness.canHandoff) return null;

  const d = state.decision;
  return {
    id: `stkrel_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceReceivingExecutionRecordId: state.receivingExecutionRecordId,
    sourceStockReleaseReadinessGateId: state.gateId,
    vendorId: state.vendorId,
    releaseEligibleScope: d.releaseEligibleScope,
    releaseQtyByLine: d.releaseQtyByLine,
    holdScope: d.holdScope,
    quarantineExcludedScope: d.quarantineExcludedScope,
    discrepancyExcludedScope: d.discrepancyExcludedScope,
    locationId: d.locationId,
    binAssignmentRequired: d.binAssignmentRequired,
    lotScopedRelease: d.lotScopedRelease,
    expiryPolicyChecked: d.expiryPolicyChecked,
    releaseInstruction: d.releaseInstruction,
    exceptionFlags: d.exceptionFlags,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: "stock_release_execution",
  };
}

// ── Correction Route ──
export interface StockReleaseCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceStockReleaseReadinessGateId: string;
  routeType: "receiving_correction" | "quarantine_resolution" | "discrepancy_resolution" | "location_clarification" | "quality_review";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildStockReleaseCorrectionRoute(
  state: StockReleaseReadinessGateState,
  routeType: StockReleaseCorrectionRoute["routeType"],
  reason: string,
): StockReleaseCorrectionRoute {
  const readiness = evaluateStockReleaseReadiness(state);

  const nextDest =
    routeType === "receiving_correction" ? "receiving_execution"
    : routeType === "quarantine_resolution" ? "quarantine_resolution"
    : routeType === "discrepancy_resolution" ? "discrepancy_resolution"
    : routeType === "location_clarification" ? "location_clarification"
    : "quality_review";

  return {
    id: `stkrelcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceStockReleaseReadinessGateId: state.gateId,
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
export type StockReleaseReadinessEventType =
  | "stock_release_readiness_gate_opened"
  | "stock_release_readiness_saved"
  | "stock_release_readiness_hold_set"
  | "stock_release_readiness_blocker_detected"
  | "stock_release_readiness_warning_detected"
  | "stock_release_readiness_correction_routed"
  | "stock_release_case_created"
  | "stock_release_readiness_handoff_completed";

export interface StockReleaseReadinessEvent {
  type: StockReleaseReadinessEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  receivingExecutionRecordId: string;
  gateId: string;
  stockReleaseCaseId: string | null;
  changedFields: string[];
  destination: string;
}

export function createStockReleaseReadinessEvent(
  type: StockReleaseReadinessEventType,
  state: StockReleaseReadinessGateState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): StockReleaseReadinessEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    receivingExecutionRecordId: state.receivingExecutionRecordId,
    gateId: state.gateId,
    stockReleaseCaseId: state.stockReleaseCaseId,
    changedFields,
    destination,
  };
}
