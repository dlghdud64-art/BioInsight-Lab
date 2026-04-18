/**
 * Dispatch Preparation Handoff Gate v2 Engine — created review state → dispatch preparation package
 *
 * 고정 규칙:
 * 1. poCreatedReviewStateV2 = 단일 입력 source.
 * 2. verified_created ≠ dispatch prep started. handoff ready 이후에만 넘기기.
 * 3. scope/vendor/reference/separation/prep 5개 readiness 축 분리 평가.
 * 4. internal-only context는 vendor-facing seed로 자동 유입 금지.
 * 5. attachment/reference는 visibility seed만 — actual attach 여부는 downstream에서 결정.
 * 6. canonical dispatchPreparationHandoffPackageV2 = dispatch layer의 단일 intake.
 * 7. actual dispatch drafting / send / execution은 이 단계에서 금지.
 * 8. created review → dispatch handoff → dispatch hydration → preparation 순서 강제.
 */

import type { PoCreatedReviewStateV2, PoCreatedReviewStateStatus, PoCreatedExceptionFlag } from "./po-created-workbench-v2-engine";
import type { PoDraftLineItem } from "./po-conversion-entry-v2-draft-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";
import type { ScopeRationale } from "./approval-workbench-review-engine";

// ── Gate Status ──
export type DispatchPrepHandoffGateStatus = "not_started" | "blocked" | "warning" | "ready" | "handed_off";

// ── Readiness Axis ──
export type DispatchPrepHandoffAxis = "scope_dispatch_ready" | "vendor_dispatch_ready" | "reference_dispatch_ready" | "separation_dispatch_ready" | "prep_intake_ready";
export type DispatchPrepHandoffAxisStatus = "ok" | "warning" | "blocked";

export interface DispatchPrepHandoffAxisResult {
  axis: DispatchPrepHandoffAxis;
  status: DispatchPrepHandoffAxisStatus;
  detail: string;
}

// ── Precheck Flag ──
export type DispatchPrepPrecheckFlag =
  | "scope_empty"
  | "vendor_contact_missing"
  | "line_items_empty"
  | "amount_missing"
  | "ship_to_missing"
  | "receiving_missing"
  | "internal_only_contamination"
  | "attachment_seed_missing"
  | "supplier_note_seed_missing";

// ── Exception Flag ──
export type DispatchPrepExceptionFlag =
  | "equivalent_heavy_dispatch"
  | "stale_quote_reference"
  | "vendor_facing_note_insufficient"
  | "governance_stale"
  | "created_with_warning_carry";

// ── Internal-Only Excluded Flag ──
export type InternalOnlyExcludedFlag =
  | "internal_order_memo"
  | "budget_note"
  | "governance_note"
  | "approval_internal_note"
  | "compare_internal_rationale";

// ── Handoff Decision ──
export interface DispatchPreparationHandoffDecision {
  dispatchEligibleScope: string;
  createdVendorId: string;
  vendorContactReferenceVisible: boolean;
  createdLineItems: PoDraftLineItem[];
  createdAmountSummary: string;
  shipToVisible: boolean;
  billToVisible: boolean;
  receivingInstructionVisible: boolean;
  quoteReferenceVisible: boolean;
  poReferenceVisible: boolean;
  attachmentSeedVisible: boolean;
  supplierFacingNoteSeed: string;
  internalOnlyExcludedFlags: InternalOnlyExcludedFlag[];
  operatorNote: string;
  precheckFlags: DispatchPrepPrecheckFlag[];
  exceptionFlags: DispatchPrepExceptionFlag[];
}

// ── State ──
export interface DispatchPrepHandoffGateV2State {
  gateStatus: DispatchPrepHandoffGateStatus;
  poCreatedReviewStateV2Id: string;
  sourcePoCreatedRecordV2Id: string;
  sourcePoSubmissionPackageV2Id: string;
  sourcePoDraftV2Id: string;
  sourceApprovalDecisionRecordV2Id: string;
  poRecordId: string;
  reviewStateStatus: PoCreatedReviewStateStatus;
  verifiedVendorId: string;
  verifiedLineItemCount: number;
  verifiedAmountSummary: string;
  dispatchReadiness: "ready" | "warning" | "blocked";
  axisResults: DispatchPrepHandoffAxisResult[];
  decision: DispatchPreparationHandoffDecision | null;
  blockerCount: number;
  warningCount: number;
  handoffPackageId: string | null;
  dispatchPrepCaseId: string | null;
}

export function createInitialDispatchPrepHandoffGateState(reviewState: PoCreatedReviewStateV2): DispatchPrepHandoffGateV2State {
  const axes = evaluateDispatchPrepHandoffAxes(reviewState, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    gateStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    poCreatedReviewStateV2Id: reviewState.id,
    sourcePoCreatedRecordV2Id: reviewState.sourcePoCreatedRecordV2Id,
    sourcePoSubmissionPackageV2Id: reviewState.sourcePoSubmissionPackageV2Id,
    sourcePoDraftV2Id: reviewState.sourcePoDraftV2Id,
    sourceApprovalDecisionRecordV2Id: reviewState.sourceApprovalDecisionRecordV2Id,
    poRecordId: reviewState.poRecordId,
    reviewStateStatus: reviewState.status,
    verifiedVendorId: reviewState.verifiedVendorId,
    verifiedLineItemCount: reviewState.verifiedLineItems.length,
    verifiedAmountSummary: reviewState.verifiedAmountSummary,
    dispatchReadiness: reviewState.dispatchReadiness,
    axisResults: axes,
    decision: null,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    handoffPackageId: null,
    dispatchPrepCaseId: null,
  };
}

// ── Readiness Axes Evaluation ──
export function evaluateDispatchPrepHandoffAxes(reviewState: PoCreatedReviewStateV2, decision: DispatchPreparationHandoffDecision | null): DispatchPrepHandoffAxisResult[] {
  const results: DispatchPrepHandoffAxisResult[] = [];

  // 1. Scope dispatch ready
  if (reviewState.status === "blocked_for_dispatch") {
    results.push({ axis: "scope_dispatch_ready", status: "blocked", detail: "Review state가 dispatch blocked 상태" });
  } else if (reviewState.verifiedLineItems.length === 0) {
    results.push({ axis: "scope_dispatch_ready", status: "blocked", detail: "Verified line items 비어 있음" });
  } else if (decision && !decision.dispatchEligibleScope) {
    results.push({ axis: "scope_dispatch_ready", status: "blocked", detail: "Dispatch eligible scope 미지정" });
  } else if (decision?.dispatchEligibleScope) {
    results.push({ axis: "scope_dispatch_ready", status: "ok", detail: "Dispatch scope 확인됨" });
  } else {
    results.push({ axis: "scope_dispatch_ready", status: "blocked", detail: "Dispatch scope 미입력" });
  }

  // 2. Vendor dispatch ready
  if (!reviewState.verifiedVendorId) {
    results.push({ axis: "vendor_dispatch_ready", status: "blocked", detail: "Verified vendor 없음" });
  } else if (decision && !decision.vendorContactReferenceVisible) {
    results.push({ axis: "vendor_dispatch_ready", status: "warning", detail: "Vendor contact reference 비활성" });
  } else if (decision?.vendorContactReferenceVisible) {
    results.push({ axis: "vendor_dispatch_ready", status: "ok", detail: "Vendor reference 준비됨" });
  } else {
    results.push({ axis: "vendor_dispatch_ready", status: "blocked", detail: "Vendor reference 미확인" });
  }

  // 3. Reference dispatch ready
  if (decision) {
    const refIssues: string[] = [];
    if (decision.precheckFlags.includes("attachment_seed_missing")) refIssues.push("attachment seed");
    if (decision.precheckFlags.includes("ship_to_missing")) refIssues.push("ship-to");
    if (decision.precheckFlags.includes("receiving_missing")) refIssues.push("receiving instruction");

    if (refIssues.length > 0) {
      results.push({ axis: "reference_dispatch_ready", status: "warning", detail: `Reference 누락: ${refIssues.join(", ")}` });
    } else {
      results.push({ axis: "reference_dispatch_ready", status: "ok", detail: "Reference visibility 준비됨" });
    }
  } else {
    results.push({ axis: "reference_dispatch_ready", status: "blocked", detail: "Reference 미확인" });
  }

  // 4. Separation dispatch ready
  if (decision) {
    if (decision.precheckFlags.includes("internal_only_contamination")) {
      results.push({ axis: "separation_dispatch_ready", status: "blocked", detail: "Internal-only context가 vendor-facing seed에 혼입" });
    } else if (decision.internalOnlyExcludedFlags.length === 0 && reviewState.exceptionFlags.length > 0) {
      results.push({ axis: "separation_dispatch_ready", status: "warning", detail: "Exception flag 존재하나 internal-only separation 미확인" });
    } else {
      results.push({ axis: "separation_dispatch_ready", status: "ok", detail: "Internal-only 분리 완료" });
    }
  } else {
    results.push({ axis: "separation_dispatch_ready", status: "blocked", detail: "Separation 미확인" });
  }

  // 5. Prep intake ready
  const hasBlocker = results.some(r => r.status === "blocked");
  if (hasBlocker) {
    results.push({ axis: "prep_intake_ready", status: "blocked", detail: "Handoff blocker 존재" });
  } else if (decision?.exceptionFlags.includes("equivalent_heavy_dispatch")) {
    results.push({ axis: "prep_intake_ready", status: "warning", detail: "Equivalent 비중 높은 dispatch — supplier-facing clarification 필요" });
  } else if (decision?.exceptionFlags.includes("vendor_facing_note_insufficient")) {
    results.push({ axis: "prep_intake_ready", status: "warning", detail: "Vendor-facing note 보강 필요" });
  } else {
    results.push({ axis: "prep_intake_ready", status: "ok", detail: "Dispatch preparation intake 가능" });
  }

  return results;
}

// ── Gate Readiness Aggregate ──
export interface DispatchPrepHandoffReadinessResult {
  status: DispatchPrepHandoffGateStatus;
  blockers: string[];
  warnings: string[];
  canHandoff: boolean;
}

export function evaluateDispatchPrepHandoffReadiness(state: DispatchPrepHandoffGateV2State): DispatchPrepHandoffReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.poCreatedReviewStateV2Id) blockers.push("Created review state lineage 없음");
  if (state.reviewStateStatus === "blocked_for_dispatch") blockers.push("Review state가 dispatch blocked 상태");

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Decision completeness
  if (!state.decision) {
    blockers.push("Dispatch handoff decision 미완료");
  } else {
    if (state.decision.precheckFlags.includes("scope_empty")) blockers.push("Dispatch scope 비어 있음");
    if (state.decision.precheckFlags.includes("vendor_contact_missing")) blockers.push("Vendor contact 누락");
    if (state.decision.precheckFlags.includes("line_items_empty")) blockers.push("Line items 비어 있음");
    if (state.decision.precheckFlags.includes("internal_only_contamination")) blockers.push("Internal-only 혼입");
  }

  const status: DispatchPrepHandoffGateStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 handoff 금지 (보수적)
  return { status, blockers, warnings, canHandoff: status === "ready" };
}

// ── Canonical Dispatch Preparation Handoff Package V2 ──
export interface DispatchPreparationHandoffPackageV2 {
  id: string;
  sourcePoCreatedReviewStateV2Id: string;
  sourcePoCreatedRecordV2Id: string;
  sourcePoSubmissionPackageV2Id: string;
  sourcePoDraftV2Id: string;
  sourceApprovalDecisionRecordV2Id: string;
  poRecordId: string;
  dispatchEligibleScope: string;
  createdVendorId: string;
  vendorContactReferenceVisible: boolean;
  createdLineItems: PoDraftLineItem[];
  createdAmountSummary: string;
  shipToVisible: boolean;
  billToVisible: boolean;
  receivingInstructionVisible: boolean;
  quoteReferenceVisible: boolean;
  poReferenceVisible: boolean;
  attachmentSeedVisible: boolean;
  supplierFacingNoteSeed: string;
  provenanceByLine: LaneProvenance[];
  rationaleByLine: ScopeRationale[];
  internalOnlyExcludedFlags: InternalOnlyExcludedFlag[];
  operatorNote: string;
  exceptionFlags: DispatchPrepExceptionFlag[];
  createdAt: string;
  createdBy: string;
  nextDestination: string;
}

export function buildDispatchPreparationHandoffPackageV2(
  state: DispatchPrepHandoffGateV2State,
  reviewState: PoCreatedReviewStateV2,
): DispatchPreparationHandoffPackageV2 | null {
  if (!state.decision) return null;
  const readiness = evaluateDispatchPrepHandoffReadiness(state);
  if (!readiness.canHandoff) return null;

  const d = state.decision;
  return {
    id: `dsppreppkg_${Date.now().toString(36)}`,
    sourcePoCreatedReviewStateV2Id: state.poCreatedReviewStateV2Id,
    sourcePoCreatedRecordV2Id: state.sourcePoCreatedRecordV2Id,
    sourcePoSubmissionPackageV2Id: state.sourcePoSubmissionPackageV2Id,
    sourcePoDraftV2Id: state.sourcePoDraftV2Id,
    sourceApprovalDecisionRecordV2Id: state.sourceApprovalDecisionRecordV2Id,
    poRecordId: state.poRecordId,
    dispatchEligibleScope: d.dispatchEligibleScope,
    createdVendorId: d.createdVendorId,
    vendorContactReferenceVisible: d.vendorContactReferenceVisible,
    createdLineItems: d.createdLineItems,
    createdAmountSummary: d.createdAmountSummary,
    shipToVisible: d.shipToVisible,
    billToVisible: d.billToVisible,
    receivingInstructionVisible: d.receivingInstructionVisible,
    quoteReferenceVisible: d.quoteReferenceVisible,
    poReferenceVisible: d.poReferenceVisible,
    attachmentSeedVisible: d.attachmentSeedVisible,
    supplierFacingNoteSeed: d.supplierFacingNoteSeed,
    provenanceByLine: reviewState.provenanceByLine,
    rationaleByLine: reviewState.rationaleByLine,
    internalOnlyExcludedFlags: d.internalOnlyExcludedFlags,
    operatorNote: d.operatorNote,
    exceptionFlags: d.exceptionFlags,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    nextDestination: "dispatch_preparation_workbench",
  };
}

// ── Canonical Dispatch Preparation Case ──
export interface DispatchPreparationCaseV2 {
  id: string;
  sourceDispatchPreparationHandoffPackageV2Id: string;
  status: "queued" | "opened" | "hydrating" | "ready_for_dispatch_preparation" | "on_hold" | "cancelled";
  openedAt: string;
  openedBy: string;
  targetWorkbench: string;
  nextDestination: string;
}

export function buildDispatchPreparationCaseV2(pkg: DispatchPreparationHandoffPackageV2): DispatchPreparationCaseV2 {
  return {
    id: `dspprepcase_${Date.now().toString(36)}`,
    sourceDispatchPreparationHandoffPackageV2Id: pkg.id,
    status: "queued",
    openedAt: new Date().toISOString(),
    openedBy: "operator",
    targetWorkbench: "dispatch_preparation_workbench",
    nextDestination: "dispatch_preparation_workbench",
  };
}

// ── Correction Route ──
export interface DispatchPrepHandoffCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourcePoCreatedReviewStateV2Id: string;
  routeType: "created_review_return" | "vendor_contact_correction" | "internal_separation_correction" | "reference_correction";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildDispatchPrepHandoffCorrectionRoute(
  state: DispatchPrepHandoffGateV2State,
  routeType: DispatchPrepHandoffCorrectionRoute["routeType"],
  reason: string,
): DispatchPrepHandoffCorrectionRoute {
  const readiness = evaluateDispatchPrepHandoffReadiness(state);

  const nextDest =
    routeType === "created_review_return" ? "po_created_workbench_v2"
    : routeType === "vendor_contact_correction" ? "po_created_workbench_v2"
    : routeType === "internal_separation_correction" ? "dispatch_prep_handoff_gate_v2"
    : "dispatch_prep_handoff_gate_v2";

  return {
    id: `dspphcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourcePoCreatedReviewStateV2Id: state.poCreatedReviewStateV2Id,
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
export type DispatchPrepHandoffEventType =
  | "dispatch_prep_handoff_gate_opened"
  | "dispatch_prep_handoff_gate_saved"
  | "dispatch_prep_handoff_gate_hold_set"
  | "dispatch_prep_handoff_gate_blocker_detected"
  | "dispatch_prep_handoff_gate_warning_detected"
  | "dispatch_prep_handoff_package_v2_created"
  | "dispatch_preparation_case_created"
  | "dispatch_prep_handoff_completed";

export interface DispatchPrepHandoffEvent {
  type: DispatchPrepHandoffEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  poCreatedReviewStateV2Id: string;
  handoffPackageV2Id: string | null;
  dispatchPrepCaseId: string | null;
  changedFields: string[];
  destination: string;
}

export function createDispatchPrepHandoffEvent(
  type: DispatchPrepHandoffEventType,
  state: DispatchPrepHandoffGateV2State,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): DispatchPrepHandoffEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    poCreatedReviewStateV2Id: state.poCreatedReviewStateV2Id,
    handoffPackageV2Id: state.handoffPackageId,
    dispatchPrepCaseId: state.dispatchPrepCaseId,
    changedFields,
    destination,
  };
}
