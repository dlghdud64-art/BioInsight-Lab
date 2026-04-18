/**
 * PO Created Workbench v2 Engine — created record → post-create review state
 *
 * 고정 규칙:
 * 1. poCreatedRecordV2 = 단일 입력 source.
 * 2. created ≠ dispatch-ready. review 완료 이후에만 review state 생성.
 * 3. integrity/context/exception/dispatch/handoff 5개 readiness 축 분리 평가.
 * 4. created canonical truth는 ad-hoc 수정 금지 — correction은 upstream return.
 * 5. provenance / rationale / governance는 visibility만.
 * 6. canonical poCreatedReviewStateV2 = dispatch handoff gate의 단일 intake.
 * 7. dispatch preparation 실행은 이 단계에서 금지.
 * 8. created record → review state → dispatch handoff gate 순서 강제.
 */

import type { PoCreatedRecordV2, PoCreatedRecordV2Status } from "./po-creation-execution-v2-engine";
import type { PoDraftLineItem } from "./po-conversion-entry-v2-draft-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";
import type { ScopeRationale } from "./approval-workbench-review-engine";

// ── Review Status ──
export type PoCreatedReviewStatus = "blocked" | "warning" | "ready" | "in_review" | "completed" | "failed";

// ── Exception Flag ──
export type PoCreatedExceptionFlag =
  | "vendor_mismatch"
  | "line_mismatch"
  | "amount_mismatch"
  | "ship_to_missing"
  | "bill_to_missing"
  | "receiving_instruction_missing"
  | "memo_insufficient"
  | "equivalent_heavy_note_needed"
  | "dispatch_note_needed"
  | "governance_stale";

// ── Review Decision ──
export interface PoCreatedReviewDecision {
  createdVendorId: string;
  createdLineItems: PoDraftLineItem[];
  createdAmountSummary: string;
  createdShipTo: string;
  createdBillTo: string;
  createdReceivingInstruction: string;
  provenanceByLine: LaneProvenance[];
  rationaleByLine: ScopeRationale[];
  dispatchReadiness: "ready" | "warning" | "blocked";
  exceptionFlags: PoCreatedExceptionFlag[];
  operatorReviewNote: string;
}

// ── State ──
export interface PoCreatedWorkbenchV2State {
  reviewStatus: PoCreatedReviewStatus;
  poCreatedRecordV2Id: string;
  sourcePoSubmissionPackageV2Id: string;
  sourcePoDraftV2Id: string;
  sourceApprovalDecisionRecordV2Id: string;
  poRecordId: string;
  createdStatus: PoCreatedRecordV2Status;
  createdVendorId: string;
  createdLineItemCount: number;
  createdAmountSummary: string;
  decision: PoCreatedReviewDecision | null;
  blockerCount: number;
  warningCount: number;
  reviewStateId: string | null;
}

export function createInitialPoCreatedWorkbenchState(record: PoCreatedRecordV2): PoCreatedWorkbenchV2State {
  return {
    reviewStatus: "in_review",
    poCreatedRecordV2Id: record.id,
    sourcePoSubmissionPackageV2Id: record.sourcePoSubmissionPackageV2Id,
    sourcePoDraftV2Id: record.sourcePoDraftV2Id,
    sourceApprovalDecisionRecordV2Id: record.sourceApprovalDecisionRecordV2Id,
    poRecordId: record.poRecordId,
    createdStatus: record.status,
    createdVendorId: record.createdVendorId,
    createdLineItemCount: record.createdLineItems.length,
    createdAmountSummary: record.createdAmountSummary,
    decision: null,
    blockerCount: 0,
    warningCount: 0,
    reviewStateId: null,
  };
}

// ── Review Readiness ──
export interface PoCreatedReviewReadinessResult {
  status: PoCreatedReviewStatus;
  blockers: string[];
  warnings: string[];
  canComplete: boolean;
}

export function evaluatePoCreatedReviewReadiness(state: PoCreatedWorkbenchV2State, record: PoCreatedRecordV2): PoCreatedReviewReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.poCreatedRecordV2Id) blockers.push("Created record lineage 없음");
  if (state.createdStatus !== "created") blockers.push("Created record가 created 상태가 아님");

  if (!state.decision) {
    blockers.push("Created review decision 미완료");
    return { status: "blocked", blockers, warnings, canComplete: false };
  }

  const d = state.decision;

  // Integrity checks
  if (!d.createdVendorId) blockers.push("Created vendor 누락");
  if (d.createdLineItems.length === 0) blockers.push("Created line items 비어 있음");
  if (!d.createdShipTo) blockers.push("Ship-to 누락");

  // Exception flags as blockers
  if (d.exceptionFlags.includes("vendor_mismatch")) blockers.push("Vendor mismatch 감지");
  if (d.exceptionFlags.includes("line_mismatch")) blockers.push("Line mismatch 감지");
  if (d.exceptionFlags.includes("amount_mismatch")) blockers.push("Amount mismatch 감지");

  // Exception flags as warnings
  if (d.exceptionFlags.includes("bill_to_missing")) warnings.push("Bill-to 누락");
  if (d.exceptionFlags.includes("receiving_instruction_missing")) warnings.push("Receiving instruction 누락");
  if (d.exceptionFlags.includes("memo_insufficient")) warnings.push("Memo 불충분");
  if (d.exceptionFlags.includes("equivalent_heavy_note_needed")) warnings.push("Equivalent line vendor-facing note 보강 필요");
  if (d.exceptionFlags.includes("dispatch_note_needed")) warnings.push("Dispatch preparation note 보강 필요");
  if (d.exceptionFlags.includes("governance_stale")) warnings.push("Governance reference stale");

  // Dispatch readiness
  if (d.dispatchReadiness === "blocked") blockers.push("Dispatch readiness blocked");

  // Line-level check
  const qtyMissing = d.createdLineItems.filter(l => !l.qty || l.qty <= 0);
  if (qtyMissing.length > 0) blockers.push(`${qtyMissing.length}건 line qty 누락`);

  const status: PoCreatedReviewStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "completed";

  // Batch 1: warning에서도 completion 금지 (보수적)
  return { status, blockers, warnings, canComplete: status === "completed" };
}

// ── Created Review State Status ──
export type PoCreatedReviewStateStatus = "verified_created" | "created_with_warning" | "blocked_for_dispatch" | "cancelled";

// ── Canonical PO Created Review State V2 ──
export interface PoCreatedReviewStateV2 {
  id: string;
  sourcePoCreatedRecordV2Id: string;
  sourcePoSubmissionPackageV2Id: string;
  sourcePoDraftV2Id: string;
  sourceApprovalDecisionRecordV2Id: string;
  poRecordId: string;
  verifiedVendorId: string;
  verifiedLineItems: PoDraftLineItem[];
  verifiedAmountSummary: string;
  verifiedShipTo: string;
  verifiedBillTo: string;
  verifiedReceivingInstruction: string;
  provenanceByLine: LaneProvenance[];
  rationaleByLine: ScopeRationale[];
  dispatchReadiness: "ready" | "warning" | "blocked";
  operatorReviewNote: string;
  exceptionFlags: PoCreatedExceptionFlag[];
  createdAt: string;
  createdBy: string;
  status: PoCreatedReviewStateStatus;
  nextDestination: string;
}

export function buildPoCreatedReviewStateV2(
  state: PoCreatedWorkbenchV2State,
  record: PoCreatedRecordV2,
): PoCreatedReviewStateV2 | null {
  const readiness = evaluatePoCreatedReviewReadiness(state, record);
  if (!readiness.canComplete) return null;
  if (!state.decision) return null;

  const d = state.decision;

  const reviewStatus: PoCreatedReviewStateStatus =
    d.exceptionFlags.length > 0 ? "created_with_warning"
    : "verified_created";

  const nextDest =
    reviewStatus === "verified_created" ? "dispatch_preparation_handoff_gate"
    : "dispatch_preparation_handoff_gate";

  return {
    id: `pocrvwst_${Date.now().toString(36)}`,
    sourcePoCreatedRecordV2Id: state.poCreatedRecordV2Id,
    sourcePoSubmissionPackageV2Id: state.sourcePoSubmissionPackageV2Id,
    sourcePoDraftV2Id: state.sourcePoDraftV2Id,
    sourceApprovalDecisionRecordV2Id: state.sourceApprovalDecisionRecordV2Id,
    poRecordId: state.poRecordId,
    verifiedVendorId: d.createdVendorId,
    verifiedLineItems: d.createdLineItems,
    verifiedAmountSummary: d.createdAmountSummary,
    verifiedShipTo: d.createdShipTo,
    verifiedBillTo: d.createdBillTo,
    verifiedReceivingInstruction: d.createdReceivingInstruction,
    provenanceByLine: d.provenanceByLine,
    rationaleByLine: d.rationaleByLine,
    dispatchReadiness: d.dispatchReadiness,
    operatorReviewNote: d.operatorReviewNote,
    exceptionFlags: d.exceptionFlags,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: reviewStatus,
    nextDestination: nextDest,
  };
}

// ── Activity Events ──
export type PoCreatedWorkbenchEventType =
  | "po_created_workbench_opened"
  | "po_created_workbench_saved"
  | "po_created_workbench_hold_set"
  | "po_created_workbench_blocker_detected"
  | "po_created_workbench_warning_detected"
  | "po_created_review_state_v2_created"
  | "po_created_workbench_completed"
  | "po_ready_for_dispatch_prep_handoff";

export interface PoCreatedWorkbenchEvent {
  type: PoCreatedWorkbenchEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  poCreatedRecordV2Id: string;
  poCreatedReviewStateV2Id: string | null;
  changedFields: string[];
  destination: string;
}

export function createPoCreatedWorkbenchEvent(
  type: PoCreatedWorkbenchEventType,
  state: PoCreatedWorkbenchV2State,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): PoCreatedWorkbenchEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    poCreatedRecordV2Id: state.poCreatedRecordV2Id,
    poCreatedReviewStateV2Id: state.reviewStateId,
    changedFields,
    destination,
  };
}
