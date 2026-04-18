/**
 * Available Stock Release Workbench Engine — actual inventory mutation + availability record + downstream routing
 *
 * 고정 규칙:
 * 1. stockReleaseCase = 단일 입력 source.
 * 2. release ready ≠ available stock. actual mutation success 이후에만 availability truth 생성.
 * 3. clean/partial/held/failed 구조적 분리.
 * 4. idempotency guard 필수 — 동일 scope 중복 mutation 금지.
 * 5. held/quarantine/discrepancy scope는 release qty에서 제외.
 * 6. canonical inventoryAvailabilityRecord = 가용 재고 truth.
 * 7. downstream: reorderDecisionCase / inventoryHoldCase / availabilityCorrectionCase 분기.
 * 8. reorder / 재구매 / PO lifecycle 직접 점프 금지.
 */

import type { StockReleaseCase, ReleaseExceptionFlag } from "./stock-release-readiness-gate-engine";

// ── Release Execution Status ──
export type StockReleaseExecutionStatus = "blocked" | "warning" | "ready" | "running" | "success" | "failed";

// ── Release Exception Flag ──
export type StockMutationExceptionFlag =
  | "release_qty_unclear"
  | "bin_unassigned"
  | "lot_traceability_missing"
  | "expiry_traceability_missing"
  | "held_scope_contamination"
  | "duplicate_mutation_detected"
  | "location_mismatch"
  | "policy_violation"
  | "partial_remaining_open";

// ── Stock Release Execution Decision ──
export interface StockReleaseExecutionDecision {
  releaseQtyByLine: string;
  locationId: string;
  binByLine: string;
  lotScopedReleaseByLine: string;
  expiryCheckedByLine: string;
  heldExcludedScope: string;
  operatorReleaseNote: string;
  traceabilityCheckPassed: boolean;
  exceptionFlags: StockMutationExceptionFlag[];
}

// ── State ──
export interface AvailableStockReleaseWorkbenchState {
  caseStatus: StockReleaseCase["status"];
  executionStatus: StockReleaseExecutionStatus;
  stockReleaseCaseId: string;
  poRecordId: string;
  vendorId: string;
  sourceReceivingExecutionRecordId: string;
  sourceGateId: string;
  releaseEligibleScope: string;
  releaseEligibleQty: string;
  holdScope: string;
  quarantineExcludedScope: string;
  discrepancyExcludedScope: string;
  locationId: string;
  binAssignmentRequired: boolean;
  lotScopedRelease: boolean;
  expiryPolicyChecked: boolean;
  decision: StockReleaseExecutionDecision | null;
  mutationChecksum: string;
  blockerCount: number;
  warningCount: number;
  availabilityRecordId: string | null;
  holdCaseId: string | null;
  reorderDecisionCaseId: string | null;
  correctionCaseId: string | null;
}

export function createInitialAvailableStockReleaseState(releaseCase: StockReleaseCase): AvailableStockReleaseWorkbenchState {
  return {
    caseStatus: "in_review",
    executionStatus: "blocked",
    stockReleaseCaseId: releaseCase.id,
    poRecordId: releaseCase.sourcePoRecordId,
    vendorId: releaseCase.vendorId,
    sourceReceivingExecutionRecordId: releaseCase.sourceReceivingExecutionRecordId,
    sourceGateId: releaseCase.sourceStockReleaseReadinessGateId,
    releaseEligibleScope: releaseCase.releaseEligibleScope,
    releaseEligibleQty: releaseCase.releaseQtyByLine,
    holdScope: releaseCase.holdScope,
    quarantineExcludedScope: releaseCase.quarantineExcludedScope,
    discrepancyExcludedScope: releaseCase.discrepancyExcludedScope,
    locationId: releaseCase.locationId,
    binAssignmentRequired: releaseCase.binAssignmentRequired,
    lotScopedRelease: releaseCase.lotScopedRelease,
    expiryPolicyChecked: releaseCase.expiryPolicyChecked,
    decision: null,
    mutationChecksum: `mchk_${Date.now().toString(36)}`,
    blockerCount: 1,
    warningCount: 0,
    availabilityRecordId: null,
    holdCaseId: null,
    reorderDecisionCaseId: null,
    correctionCaseId: null,
  };
}

// ── Execution Readiness ──
export interface StockReleaseExecutionReadinessResult {
  status: StockReleaseExecutionStatus;
  blockers: string[];
  warnings: string[];
  canExecute: boolean;
}

export function evaluateStockReleaseExecutionReadiness(state: AvailableStockReleaseWorkbenchState): StockReleaseExecutionReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.stockReleaseCaseId) blockers.push("Stock release case lineage 없음");
  if (!state.sourceReceivingExecutionRecordId) blockers.push("Receiving execution record lineage 없음");

  // Idempotency guard
  if (state.availabilityRecordId) {
    blockers.push("이미 가용 재고가 반영된 건입니다 (중복 mutation 금지)");
    return { status: "blocked", blockers, warnings, canExecute: false };
  }

  if (!state.decision) {
    blockers.push("Stock mutation decision 미완료");
    return { status: "blocked", blockers, warnings, canExecute: false };
  }

  const d = state.decision;

  // Release qty
  if (!d.releaseQtyByLine) blockers.push("Release 대상 수량 미확정");

  // Location / bin
  if (!d.locationId) blockers.push("Release 위치 미지정");
  if (state.binAssignmentRequired && !d.binByLine) blockers.push("Bin assignment 필요하나 미지정");
  if (d.exceptionFlags.includes("location_mismatch")) blockers.push("Location mismatch 발견");

  // Traceability
  if (state.lotScopedRelease && d.exceptionFlags.includes("lot_traceability_missing")) {
    blockers.push("Lot traceability 누락 (필수)");
  }
  if (state.expiryPolicyChecked && d.exceptionFlags.includes("expiry_traceability_missing")) {
    blockers.push("Expiry traceability 누락 (필수)");
  }
  if (!d.traceabilityCheckPassed) blockers.push("Traceability 체크 미통과");

  // Hold contamination guard
  if (d.exceptionFlags.includes("held_scope_contamination")) {
    blockers.push("Hold scope가 release qty에 포함되어 있음");
  }

  // Duplicate guard
  if (d.exceptionFlags.includes("duplicate_mutation_detected")) {
    blockers.push("중복 mutation 감지");
  }

  // Policy
  if (d.exceptionFlags.includes("policy_violation")) {
    blockers.push("Inventory policy 위반");
  }

  // Warnings
  if (d.exceptionFlags.includes("partial_remaining_open")) {
    warnings.push("Partial release로 인해 remaining open qty 존재");
  }
  if (d.exceptionFlags.includes("release_qty_unclear")) {
    warnings.push("Release 수량 명확성 낮음");
  }
  if (state.holdScope && state.holdScope !== "없음") {
    warnings.push("Hold scope 존재 — 별도 hold case로 분기 필요");
  }

  const status: StockReleaseExecutionStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 execute 금지 (보수적)
  return { status, blockers, warnings, canExecute: status === "ready" };
}

// ── Availability Record Status ──
export type AvailabilityRecordStatus = "available_full" | "available_partial" | "held_partial" | "failed";

// ── Canonical Inventory Availability Record ──
export interface InventoryAvailabilityRecord {
  id: string;
  sourcePoRecordId: string;
  sourceReceivingExecutionRecordId: string;
  sourceStockReleaseCaseId: string;
  vendorId: string;
  availableQtyByLine: string;
  locationId: string;
  binByLine: string;
  lotScopedAvailabilityByLine: string;
  expiryScopedAvailabilityByLine: string;
  heldExcludedScope: string;
  traceabilitySummary: string;
  releaseExecutedAt: string;
  releaseExecutedBy: string;
  mutationChecksum: string;
  status: AvailabilityRecordStatus;
  nextDestination: string;
}

export function executeStockRelease(
  state: AvailableStockReleaseWorkbenchState,
): { success: boolean; state: AvailableStockReleaseWorkbenchState; record: InventoryAvailabilityRecord | null } {
  // Idempotency: already released
  if (state.availabilityRecordId) {
    return {
      success: false,
      state: { ...state, executionStatus: "failed" },
      record: null,
    };
  }

  const readiness = evaluateStockReleaseExecutionReadiness(state);
  if (!readiness.canExecute || !state.decision) {
    return {
      success: false,
      state: { ...state, executionStatus: "failed", blockerCount: readiness.blockers.length, warningCount: readiness.warnings.length },
      record: null,
    };
  }

  const d = state.decision;
  const hasHeld = state.holdScope && state.holdScope !== "없음";

  const status: AvailabilityRecordStatus =
    hasHeld ? "held_partial"
    : state.releaseEligibleScope === "전체" ? "available_full"
    : "available_partial";

  const nextDest =
    status === "available_full" ? "reorder_decision"
    : status === "available_partial" ? "reorder_decision"
    : "inventory_hold_management";

  const now = new Date().toISOString();
  const record: InventoryAvailabilityRecord = {
    id: `invavail_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceReceivingExecutionRecordId: state.sourceReceivingExecutionRecordId,
    sourceStockReleaseCaseId: state.stockReleaseCaseId,
    vendorId: state.vendorId,
    availableQtyByLine: d.releaseQtyByLine,
    locationId: d.locationId,
    binByLine: d.binByLine,
    lotScopedAvailabilityByLine: d.lotScopedReleaseByLine,
    expiryScopedAvailabilityByLine: d.expiryCheckedByLine,
    heldExcludedScope: d.heldExcludedScope,
    traceabilitySummary: d.traceabilityCheckPassed ? "통과" : "미통과",
    releaseExecutedAt: now,
    releaseExecutedBy: "operator",
    mutationChecksum: state.mutationChecksum,
    status,
    nextDestination: nextDest,
  };

  const updatedCaseStatus = status === "available_full" ? "released_fully" as const : "released_partially" as const;

  return {
    success: true,
    state: {
      ...state,
      caseStatus: updatedCaseStatus,
      executionStatus: "success",
      availabilityRecordId: record.id,
    },
    record,
  };
}

// ── Can Retry Release ──
export function canRetryRelease(state: AvailableStockReleaseWorkbenchState): boolean {
  return state.executionStatus === "failed" && !state.availabilityRecordId;
}

// ── Downstream: Reorder Decision Case ──
export interface ReorderDecisionCase {
  id: string;
  sourcePoRecordId: string;
  sourceInventoryAvailabilityRecordId: string;
  vendorId: string;
  eligibleScope: string;
  availableQtySummary: string;
  lotExpirySummary: string;
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_review" | "decided" | "deferred" | "cancelled";
  nextDestination: string;
}

export function buildReorderDecisionCase(record: InventoryAvailabilityRecord): ReorderDecisionCase | null {
  if (record.status === "failed") return null;

  return {
    id: `reorderdec_${Date.now().toString(36)}`,
    sourcePoRecordId: record.sourcePoRecordId,
    sourceInventoryAvailabilityRecordId: record.id,
    vendorId: record.vendorId,
    eligibleScope: record.status === "available_full" ? "전체" : "부분",
    availableQtySummary: record.availableQtyByLine,
    lotExpirySummary: `${record.lotScopedAvailabilityByLine}; ${record.expiryScopedAvailabilityByLine}`,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: "reorder_decision",
  };
}

// ── Downstream: Inventory Hold Case ──
export interface InventoryHoldCase {
  id: string;
  sourcePoRecordId: string;
  sourceInventoryAvailabilityRecordId: string;
  issueType: "quarantine_hold" | "discrepancy_hold" | "quality_hold" | "document_hold" | "mixed";
  affectedScope: string;
  holdDetail: string;
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_review" | "resolved" | "disposed" | "cancelled";
  nextDestination: string;
}

export function buildInventoryHoldCase(record: InventoryAvailabilityRecord): InventoryHoldCase | null {
  if (!record.heldExcludedScope || record.heldExcludedScope === "없음") return null;

  return {
    id: `invhold_${Date.now().toString(36)}`,
    sourcePoRecordId: record.sourcePoRecordId,
    sourceInventoryAvailabilityRecordId: record.id,
    issueType: "mixed",
    affectedScope: record.heldExcludedScope,
    holdDetail: record.heldExcludedScope,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: "inventory_hold_management",
  };
}

// ── Downstream: Availability Correction Case ──
export interface AvailabilityCorrectionCase {
  id: string;
  sourcePoRecordId: string;
  sourceInventoryAvailabilityRecordId: string;
  issueType: "traceability_mismatch" | "location_mismatch" | "qty_correction" | "bin_reassignment" | "mixed";
  affectedScope: string;
  correctionDetail: string;
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildAvailabilityCorrectionCase(
  record: InventoryAvailabilityRecord,
  issueType: AvailabilityCorrectionCase["issueType"],
  correctionDetail: string,
): AvailabilityCorrectionCase {
  return {
    id: `invcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: record.sourcePoRecordId,
    sourceInventoryAvailabilityRecordId: record.id,
    issueType,
    affectedScope: record.availableQtyByLine,
    correctionDetail,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: "availability_correction",
  };
}

// ── Activity Events ──
export type AvailableStockReleaseEventType =
  | "available_stock_release_opened"
  | "available_stock_release_saved"
  | "available_stock_release_hold_set"
  | "available_stock_release_blocker_detected"
  | "available_stock_release_warning_detected"
  | "available_stock_release_execute_started"
  | "available_stock_release_record_created"
  | "inventory_hold_case_created"
  | "reorder_decision_case_created"
  | "availability_correction_case_created";

export interface AvailableStockReleaseEvent {
  type: AvailableStockReleaseEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  stockReleaseCaseId: string;
  inventoryAvailabilityRecordId: string | null;
  downstreamCaseId: string | null;
  changedFields: string[];
  destination: string;
}

export function createAvailableStockReleaseEvent(
  type: AvailableStockReleaseEventType,
  state: AvailableStockReleaseWorkbenchState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
  downstreamCaseId?: string | null,
): AvailableStockReleaseEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    stockReleaseCaseId: state.stockReleaseCaseId,
    inventoryAvailabilityRecordId: state.availabilityRecordId,
    downstreamCaseId: downstreamCaseId ?? null,
    changedFields,
    destination,
  };
}
