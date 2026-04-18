/**
 * PO Creation Execution v2 Engine — submission package → actual PO creation + created record
 *
 * 고정 규칙:
 * 1. poSubmissionPackageV2 = 단일 입력 source.
 * 2. queued_for_creation ≠ created. execution success 이후에만 created record 생성.
 * 3. duplicate / idempotency guard 필수 — 동일 payload 이중 생성 금지.
 * 4. failure class 구조화 필수 — dead-end 금지.
 * 5. canonical poCreatedRecordV2 = created truth.
 * 6. draft 재편집 / dispatch preparation은 이 단계에서 금지.
 * 7. submission → creation execution → created record → created workbench 순서 강제.
 */

import type { PoSubmissionPackageV2, PoSubmissionPackageStatus } from "./po-draft-submission-gate-v2-engine";
import type { PoDraftLineItem } from "./po-conversion-entry-v2-draft-engine";
import type { ScopeRationale } from "./approval-workbench-review-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";

// ── Execution Status ──
export type PoCreationExecutionStatus = "blocked" | "warning" | "ready" | "running" | "success" | "failed";

// ── Failure Class ──
export type PoCreationFailureClass =
  | "payload_incomplete"
  | "duplicate_detected"
  | "idempotency_locked"
  | "vendor_resolution_failed"
  | "amount_validation_failed"
  | "creation_system_failed"
  | "lineage_broken";

// ── State ──
export interface PoCreationExecutionV2State {
  executionStatus: PoCreationExecutionStatus;
  poCreationExecutionCaseV2Id: string;
  poSubmissionPackageV2Id: string;
  sourcePoDraftV2Id: string;
  sourcePoEntrySessionV2Id: string;
  sourceApprovalDecisionRecordV2Id: string;
  poRecordId: string;
  frozenVendorId: string;
  frozenLineItemCount: number;
  frozenAmountSummary: string;
  frozenShipTo: string;
  frozenBillTo: string;
  duplicateCheckPassed: boolean;
  idempotencyKey: string;
  failureClass: PoCreationFailureClass | null;
  failureMessage: string;
  retryCount: number;
  blockerCount: number;
  warningCount: number;
  createdRecordId: string | null;
}

export function createInitialPoCreationExecutionState(
  pkg: PoSubmissionPackageV2,
  execCase: { id: string },
): PoCreationExecutionV2State {
  return {
    executionStatus: "ready",
    poCreationExecutionCaseV2Id: execCase.id,
    poSubmissionPackageV2Id: pkg.id,
    sourcePoDraftV2Id: pkg.sourcePoDraftV2Id,
    sourcePoEntrySessionV2Id: pkg.sourcePoEntrySessionV2Id,
    sourceApprovalDecisionRecordV2Id: pkg.sourceApprovalDecisionRecordV2Id,
    poRecordId: pkg.poRecordId,
    frozenVendorId: pkg.frozenVendorId,
    frozenLineItemCount: pkg.frozenLineItems.length,
    frozenAmountSummary: pkg.frozenAmountSummary,
    frozenShipTo: pkg.frozenShipTo,
    frozenBillTo: pkg.frozenBillTo,
    duplicateCheckPassed: false,
    idempotencyKey: `idem_${pkg.id}_${Date.now().toString(36)}`,
    failureClass: null,
    failureMessage: "",
    retryCount: 0,
    blockerCount: 0,
    warningCount: 0,
    createdRecordId: null,
  };
}

// ── Execution Readiness ──
export interface PoCreationExecutionReadinessResult {
  status: PoCreationExecutionStatus;
  blockers: string[];
  warnings: string[];
  canExecute: boolean;
}

export function evaluatePoCreationExecutionReadiness(state: PoCreationExecutionV2State, pkg: PoSubmissionPackageV2): PoCreationExecutionReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.poSubmissionPackageV2Id) blockers.push("Submission package lineage 없음");
  if (pkg.status !== "queued_for_creation") blockers.push("Submission package가 queued_for_creation 상태가 아님");

  // Idempotency guard
  if (state.createdRecordId) {
    blockers.push("이미 PO가 생성된 건입니다 (중복 생성 금지)");
    return { status: "blocked", blockers, warnings, canExecute: false };
  }

  // Frozen payload check
  if (!pkg.frozenVendorId) blockers.push("Frozen vendor 누락");
  if (pkg.frozenLineItems.length === 0) blockers.push("Frozen line items 비어 있음");
  if (!pkg.frozenShipTo) blockers.push("Frozen ship-to 누락");

  // Line-level check
  const qtyMissing = pkg.frozenLineItems.filter(l => !l.qty || l.qty <= 0);
  if (qtyMissing.length > 0) blockers.push(`${qtyMissing.length}건 line qty 누락`);

  // Duplicate check
  if (!state.duplicateCheckPassed) {
    warnings.push("Duplicate check 미완료 — 실행 전 확인 필요");
  }

  // Governance warnings
  const exceptionFlags = (pkg as any).exceptionFlags;
  if (exceptionFlags?.includes("stale_quote_reference")) warnings.push("Stale quote reference");
  if (exceptionFlags?.includes("budget_recheck_needed")) warnings.push("Budget 재확인 필요");
  if (exceptionFlags?.includes("equivalent_heavy_payload")) warnings.push("Equivalent 비중 높은 PO");

  // Bill-to optional warning
  if (!pkg.frozenBillTo) warnings.push("Frozen bill-to 누락");

  const status: PoCreationExecutionStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  return { status, blockers, warnings, canExecute: blockers.length === 0 };
}

// ── Execute PO Creation (simulate) ──
export function executePoCreationV2(
  state: PoCreationExecutionV2State,
  pkg: PoSubmissionPackageV2,
): { success: boolean; state: PoCreationExecutionV2State; record: PoCreatedRecordV2 | null; failureClass: PoCreationFailureClass | null } {
  // Idempotency: already created
  if (state.createdRecordId) {
    return {
      success: false,
      state: { ...state, executionStatus: "failed", failureClass: "duplicate_detected", failureMessage: "이미 생성된 PO입니다" },
      record: null,
      failureClass: "duplicate_detected",
    };
  }

  // Readiness check
  const readiness = evaluatePoCreationExecutionReadiness(state, pkg);
  if (!readiness.canExecute) {
    const failClass: PoCreationFailureClass = !pkg.frozenVendorId ? "vendor_resolution_failed"
      : pkg.frozenLineItems.length === 0 ? "payload_incomplete"
      : "payload_incomplete";
    return {
      success: false,
      state: { ...state, executionStatus: "failed", failureClass: failClass, failureMessage: readiness.blockers[0] || "Execution blocked" },
      record: null,
      failureClass: failClass,
    };
  }

  // Simulate successful creation
  const now = new Date().toISOString();
  const totalAmount = pkg.frozenLineItems.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0);

  const record: PoCreatedRecordV2 = {
    id: `pocreatedv2_${Date.now().toString(36)}`,
    sourcePoSubmissionPackageV2Id: pkg.id,
    sourcePoDraftV2Id: pkg.sourcePoDraftV2Id,
    sourcePoEntrySessionV2Id: pkg.sourcePoEntrySessionV2Id,
    sourceApprovalDecisionRecordV2Id: pkg.sourceApprovalDecisionRecordV2Id,
    poRecordId: state.poRecordId,
    createdVendorId: pkg.frozenVendorId,
    createdLineItems: pkg.frozenLineItems,
    createdAmountSummary: `${pkg.frozenLineItems.length}건, 총 ${totalAmount.toLocaleString()}`,
    createdShipTo: pkg.frozenShipTo,
    createdBillTo: pkg.frozenBillTo,
    createdReceivingInstruction: pkg.frozenReceivingInstruction,
    internalOrderMemo: pkg.internalOrderMemo,
    provenanceByLine: pkg.provenanceByLine,
    rationaleByLine: pkg.rationaleByLine,
    idempotencyKey: state.idempotencyKey,
    createdAt: now,
    createdBy: "operator",
    status: "created",
    nextDestination: "po_created_workbench_v2",
  };

  return {
    success: true,
    state: {
      ...state,
      executionStatus: "success",
      createdRecordId: record.id,
      duplicateCheckPassed: true,
    },
    record,
    failureClass: null,
  };
}

// ── Can Retry ──
export function canRetryPoCreation(state: PoCreationExecutionV2State): boolean {
  return state.executionStatus === "failed" && !state.createdRecordId && state.failureClass !== "duplicate_detected";
}

// ── Prepare Retry ──
export function preparePoCreationRetry(state: PoCreationExecutionV2State): PoCreationExecutionV2State {
  return {
    ...state,
    executionStatus: "ready",
    failureClass: null,
    failureMessage: "",
    retryCount: state.retryCount + 1,
  };
}

// ── Created Record Status ──
export type PoCreatedRecordV2Status = "created" | "blocked_after_create" | "cancelled";

// ── Canonical PO Created Record V2 ──
export interface PoCreatedRecordV2 {
  id: string;
  sourcePoSubmissionPackageV2Id: string;
  sourcePoDraftV2Id: string;
  sourcePoEntrySessionV2Id: string;
  sourceApprovalDecisionRecordV2Id: string;
  poRecordId: string;
  createdVendorId: string;
  createdLineItems: PoDraftLineItem[];
  createdAmountSummary: string;
  createdShipTo: string;
  createdBillTo: string;
  createdReceivingInstruction: string;
  internalOrderMemo: string;
  provenanceByLine: LaneProvenance[];
  rationaleByLine: ScopeRationale[];
  idempotencyKey: string;
  createdAt: string;
  createdBy: string;
  status: PoCreatedRecordV2Status;
  nextDestination: string;
}

// ── Activity Events ──
export type PoCreationExecutionEventType =
  | "po_creation_execution_opened"
  | "po_creation_execution_started"
  | "po_creation_execution_saved"
  | "po_creation_execution_hold_set"
  | "po_creation_execution_blocker_detected"
  | "po_creation_execution_warning_detected"
  | "po_creation_execution_failed"
  | "po_created_record_v2_created"
  | "po_creation_execution_completed"
  | "po_ready_for_created_workbench";

export interface PoCreationExecutionEvent {
  type: PoCreationExecutionEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  poSubmissionPackageV2Id: string;
  poCreationExecutionCaseV2Id: string;
  poCreatedRecordV2Id: string | null;
  changedFields: string[];
  destination: string;
}

export function createPoCreationExecutionEvent(
  type: PoCreationExecutionEventType,
  state: PoCreationExecutionV2State,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): PoCreationExecutionEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    poSubmissionPackageV2Id: state.poSubmissionPackageV2Id,
    poCreationExecutionCaseV2Id: state.poCreationExecutionCaseV2Id,
    poCreatedRecordV2Id: state.createdRecordId,
    changedFields,
    destination,
  };
}
