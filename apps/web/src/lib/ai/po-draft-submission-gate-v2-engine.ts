/**
 * PO Draft Submission Gate v2 Engine — draft → submission package (frozen payload)
 *
 * 고정 규칙:
 * 1. poDraftV2 = 단일 입력 source.
 * 2. draft_ready ≠ submit-ready. gate 검증 이후에만 submission package 생성.
 * 3. line/context/warning/governance/creation 5개 readiness 축 분리 평가.
 * 4. blocker → 생성 금지, warning → acknowledgement 필수.
 * 5. frozen payload는 edit surface처럼 동작하지 않음.
 * 6. canonical poSubmissionPackageV2 = creation execution의 단일 intake source.
 * 7. actual PO creation 실행은 이 단계에서 금지.
 * 8. draft → submission gate → canonical package → creation execution 순서 강제.
 */

import type { PoDraftV2, PoDraftV2Status, PoDraftLineItem } from "./po-conversion-entry-v2-draft-engine";
import type { ScopeRationale } from "./approval-workbench-review-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";

// ── Gate Status ──
export type PoSubmissionGateStatus = "not_started" | "blocked" | "warning" | "ready" | "submitted" | "cancelled";

// ── Readiness Axis ──
export type PoSubmissionAxis = "line_submission_ready" | "context_submission_ready" | "warning_submission_ready" | "governance_submission_ready" | "creation_execution_ready";
export type PoSubmissionAxisStatus = "ok" | "warning" | "blocked";

export interface PoSubmissionAxisResult {
  axis: PoSubmissionAxis;
  status: PoSubmissionAxisStatus;
  detail: string;
}

// ── Precheck Flag ──
export type PoSubmissionPrecheckFlag =
  | "vendor_missing"
  | "line_items_empty"
  | "qty_incomplete"
  | "amount_incomplete"
  | "ship_to_missing"
  | "bill_to_missing"
  | "receiving_missing"
  | "flagged_line_in_payload"
  | "incomplete_line_in_payload"
  | "equivalent_no_acknowledgement"
  | "governance_stale"
  | "warning_unacknowledged";

// ── Exception Flag ──
export type PoSubmissionExceptionFlag =
  | "equivalent_heavy_payload"
  | "stale_quote_reference"
  | "budget_recheck_needed"
  | "policy_gap"
  | "partial_line_coverage";

// ── Gate Decision ──
export interface PoSubmissionGateDecision {
  frozenVendorId: string;
  frozenLineItems: PoDraftLineItem[];
  frozenAmountSummary: string;
  frozenShipTo: string;
  frozenBillTo: string;
  frozenReceivingInstruction: string;
  internalOrderMemo: string;
  quoteReferenceVisible: boolean;
  policyReferenceVisible: boolean;
  budgetReferenceVisible: boolean;
  warningAcknowledged: boolean;
  operatorSubmissionNote: string;
  precheckFlags: PoSubmissionPrecheckFlag[];
  exceptionFlags: PoSubmissionExceptionFlag[];
}

// ── State ──
export interface PoDraftSubmissionGateV2State {
  gateStatus: PoSubmissionGateStatus;
  poDraftV2Id: string;
  sourcePoEntrySessionV2Id: string;
  sourcePoConversionHandoffPackageV2Id: string;
  sourceApprovalDecisionRecordV2Id: string;
  poRecordId: string;
  draftStatus: PoDraftV2Status;
  lineItemCount: number;
  axisResults: PoSubmissionAxisResult[];
  decision: PoSubmissionGateDecision | null;
  blockerCount: number;
  warningCount: number;
  submissionPackageId: string | null;
  creationExecutionCaseId: string | null;
}

export function createInitialSubmissionGateState(draft: PoDraftV2): PoDraftSubmissionGateV2State {
  const axes = evaluateSubmissionAxes(draft, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    gateStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    poDraftV2Id: draft.id,
    sourcePoEntrySessionV2Id: draft.sourcePoEntrySessionV2Id,
    sourcePoConversionHandoffPackageV2Id: draft.sourcePoConversionHandoffPackageV2Id,
    sourceApprovalDecisionRecordV2Id: draft.sourceApprovalDecisionRecordV2Id,
    poRecordId: draft.poRecordId,
    draftStatus: draft.status,
    lineItemCount: draft.lineItems.length,
    axisResults: axes,
    decision: null,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    submissionPackageId: null,
    creationExecutionCaseId: null,
  };
}

// ── Readiness Axes Evaluation ──
export function evaluateSubmissionAxes(draft: PoDraftV2, decision: PoSubmissionGateDecision | null): PoSubmissionAxisResult[] {
  const results: PoSubmissionAxisResult[] = [];

  // 1. Line submission ready
  if (draft.status !== "draft_ready") {
    results.push({ axis: "line_submission_ready", status: "blocked", detail: "Draft가 draft_ready 상태가 아님" });
  } else if (draft.lineItems.length === 0) {
    results.push({ axis: "line_submission_ready", status: "blocked", detail: "Line items 비어 있음" });
  } else {
    const incompleteLines = draft.lineItems.filter(l => l.draftStatus !== "completed");
    const flaggedLines = draft.lineItems.filter(l => l.draftStatus === "flagged");
    if (flaggedLines.length > 0) {
      results.push({ axis: "line_submission_ready", status: "blocked", detail: `${flaggedLines.length}건 flagged line 존재` });
    } else if (incompleteLines.length > 0) {
      results.push({ axis: "line_submission_ready", status: "blocked", detail: `${incompleteLines.length}건 incomplete line 존재` });
    } else {
      const missingQty = draft.lineItems.filter(l => !l.qty || l.qty <= 0);
      if (missingQty.length > 0) {
        results.push({ axis: "line_submission_ready", status: "blocked", detail: `${missingQty.length}건 line qty 누락` });
      } else {
        results.push({ axis: "line_submission_ready", status: "ok", detail: `${draft.lineItems.length}건 line 준비 완료` });
      }
    }
  }

  // 2. Context submission ready
  if (!draft.shipTo) {
    results.push({ axis: "context_submission_ready", status: "blocked", detail: "Ship-to 누락" });
  } else if (!draft.billTo) {
    results.push({ axis: "context_submission_ready", status: "warning", detail: "Bill-to 누락" });
  } else if (!draft.receivingInstruction) {
    results.push({ axis: "context_submission_ready", status: "warning", detail: "Receiving instruction 누락" });
  } else {
    results.push({ axis: "context_submission_ready", status: "ok", detail: "Order context 준비 완료" });
  }

  // 3. Warning submission ready
  if (decision) {
    if (decision.precheckFlags.length > 0 && !decision.warningAcknowledged) {
      const warningFlags = decision.precheckFlags.filter(f =>
        f === "equivalent_no_acknowledgement" || f === "governance_stale" || f === "warning_unacknowledged"
      );
      if (warningFlags.length > 0) {
        results.push({ axis: "warning_submission_ready", status: "warning", detail: "Warning acknowledgement 필요" });
      } else {
        results.push({ axis: "warning_submission_ready", status: "ok", detail: "Warning 해소됨" });
      }
    } else if (decision.warningAcknowledged) {
      results.push({ axis: "warning_submission_ready", status: "ok", detail: "Warning acknowledged" });
    } else {
      results.push({ axis: "warning_submission_ready", status: "ok", detail: "Warning 없음" });
    }
  } else {
    // Check draft-level warnings
    const equivalentLines = draft.lineItems.filter(l => l.provenance === "equivalent");
    if (equivalentLines.length > 0) {
      results.push({ axis: "warning_submission_ready", status: "warning", detail: `${equivalentLines.length}건 equivalent line — acknowledgement 필요` });
    } else {
      results.push({ axis: "warning_submission_ready", status: "blocked", detail: "Gate decision 미완료" });
    }
  }

  // 4. Governance submission ready
  if (decision) {
    const govIssues: string[] = [];
    if (decision.exceptionFlags.includes("stale_quote_reference")) govIssues.push("Quote reference stale");
    if (decision.exceptionFlags.includes("budget_recheck_needed")) govIssues.push("Budget 재확인 필요");
    if (decision.exceptionFlags.includes("policy_gap")) govIssues.push("Policy 간극 존재");

    if (govIssues.length > 0) {
      results.push({ axis: "governance_submission_ready", status: "warning", detail: govIssues.join("; ") });
    } else {
      results.push({ axis: "governance_submission_ready", status: "ok", detail: "Governance reference 준비 완료" });
    }
  } else {
    results.push({ axis: "governance_submission_ready", status: "blocked", detail: "Governance 미확인" });
  }

  // 5. Creation execution ready
  const hasBlocker = results.some(r => r.status === "blocked");
  const hasWarning = results.some(r => r.status === "warning");
  if (hasBlocker) {
    results.push({ axis: "creation_execution_ready", status: "blocked", detail: "Submission blocker 존재" });
  } else if (hasWarning && (!decision || !decision.warningAcknowledged)) {
    results.push({ axis: "creation_execution_ready", status: "warning", detail: "Warning acknowledgement 미완료" });
  } else if (decision?.exceptionFlags.includes("equivalent_heavy_payload")) {
    results.push({ axis: "creation_execution_ready", status: "warning", detail: "Equivalent 비중 높은 PO" });
  } else {
    results.push({ axis: "creation_execution_ready", status: "ok", detail: "Creation execution 시작 가능" });
  }

  return results;
}

// ── Gate Readiness Aggregate ──
export interface PoSubmissionReadinessResult {
  status: PoSubmissionGateStatus;
  blockers: string[];
  warnings: string[];
  canSubmit: boolean;
}

export function evaluatePoSubmissionReadiness(state: PoDraftSubmissionGateV2State): PoSubmissionReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.poDraftV2Id) blockers.push("PO draft lineage 없음");
  if (state.draftStatus !== "draft_ready") blockers.push("Draft가 draft_ready 상태가 아님");

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Decision completeness
  if (!state.decision) {
    blockers.push("Submission gate decision 미완료");
  } else {
    // Blocker precheck flags
    if (state.decision.precheckFlags.includes("vendor_missing")) blockers.push("Vendor 누락");
    if (state.decision.precheckFlags.includes("line_items_empty")) blockers.push("Line items 비어 있음");
    if (state.decision.precheckFlags.includes("qty_incomplete")) blockers.push("Qty 불완전");
    if (state.decision.precheckFlags.includes("flagged_line_in_payload")) blockers.push("Flagged line이 frozen payload에 포함");
    if (state.decision.precheckFlags.includes("incomplete_line_in_payload")) blockers.push("Incomplete line이 frozen payload에 포함");

    // Warning precheck flags
    if (state.decision.precheckFlags.includes("ship_to_missing")) blockers.push("Ship-to 누락");
    if (state.decision.precheckFlags.includes("bill_to_missing")) warnings.push("Bill-to 누락");
    if (state.decision.precheckFlags.includes("receiving_missing")) warnings.push("Receiving instruction 누락");
    if (state.decision.precheckFlags.includes("amount_incomplete")) warnings.push("Amount 불완전");
    if (state.decision.precheckFlags.includes("equivalent_no_acknowledgement")) warnings.push("Equivalent acknowledgement 미완료");
    if (state.decision.precheckFlags.includes("governance_stale")) warnings.push("Governance context stale");

    // Warning acknowledgement
    if (warnings.length > 0 && !state.decision.warningAcknowledged) {
      blockers.push("Warning이 존재하나 acknowledgement 미완료");
    }
  }

  const status: PoSubmissionGateStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: blocker 없고 warning acknowledged면 submit 가능
  return { status, blockers, warnings, canSubmit: blockers.length === 0 };
}

// ── Submission Package Status ──
export type PoSubmissionPackageStatus = "queued_for_creation" | "blocked" | "cancelled";

// ── Canonical PO Submission Package V2 ──
export interface PoSubmissionPackageV2 {
  id: string;
  sourcePoDraftV2Id: string;
  sourcePoEntrySessionV2Id: string;
  sourcePoConversionHandoffPackageV2Id: string;
  sourceApprovalDecisionRecordV2Id: string;
  poRecordId: string;
  frozenVendorId: string;
  frozenLineItems: PoDraftLineItem[];
  frozenAmountSummary: string;
  frozenShipTo: string;
  frozenBillTo: string;
  frozenReceivingInstruction: string;
  internalOrderMemo: string;
  provenanceByLine: LaneProvenance[];
  rationaleByLine: ScopeRationale[];
  quoteReferenceVisible: boolean;
  policyReferenceVisible: boolean;
  budgetReferenceVisible: boolean;
  warningAcknowledged: boolean;
  operatorSubmissionNote: string;
  createdAt: string;
  createdBy: string;
  status: PoSubmissionPackageStatus;
  nextDestination: string;
}

export function buildPoSubmissionPackageV2(
  state: PoDraftSubmissionGateV2State,
  draft: PoDraftV2,
): PoSubmissionPackageV2 | null {
  if (!state.decision) return null;
  const readiness = evaluatePoSubmissionReadiness(state);
  if (!readiness.canSubmit) return null;

  const d = state.decision;
  return {
    id: `posubpkg_${Date.now().toString(36)}`,
    sourcePoDraftV2Id: state.poDraftV2Id,
    sourcePoEntrySessionV2Id: state.sourcePoEntrySessionV2Id,
    sourcePoConversionHandoffPackageV2Id: state.sourcePoConversionHandoffPackageV2Id,
    sourceApprovalDecisionRecordV2Id: state.sourceApprovalDecisionRecordV2Id,
    poRecordId: state.poRecordId,
    frozenVendorId: d.frozenVendorId,
    frozenLineItems: d.frozenLineItems,
    frozenAmountSummary: d.frozenAmountSummary,
    frozenShipTo: d.frozenShipTo,
    frozenBillTo: d.frozenBillTo,
    frozenReceivingInstruction: d.frozenReceivingInstruction,
    internalOrderMemo: d.internalOrderMemo,
    provenanceByLine: draft.provenanceByLine,
    rationaleByLine: draft.rationaleByLine,
    quoteReferenceVisible: d.quoteReferenceVisible,
    policyReferenceVisible: d.policyReferenceVisible,
    budgetReferenceVisible: d.budgetReferenceVisible,
    warningAcknowledged: d.warningAcknowledged,
    operatorSubmissionNote: d.operatorSubmissionNote,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued_for_creation",
    nextDestination: "po_creation_execution_v2",
  };
}

// ── Canonical PO Creation Execution Case V2 ──
export interface PoCreationExecutionCaseV2 {
  id: string;
  sourcePoSubmissionPackageV2Id: string;
  status: "queued" | "opened" | "executing" | "completed" | "on_hold" | "cancelled";
  openedAt: string;
  openedBy: string;
  targetWorkbench: string;
  nextDestination: string;
}

export function buildPoCreationExecutionCaseV2(pkg: PoSubmissionPackageV2): PoCreationExecutionCaseV2 {
  return {
    id: `pocreatecase_${Date.now().toString(36)}`,
    sourcePoSubmissionPackageV2Id: pkg.id,
    status: "queued",
    openedAt: new Date().toISOString(),
    openedBy: "operator",
    targetWorkbench: "po_creation_execution_v2",
    nextDestination: "po_creation_execution_v2",
  };
}

// ── Activity Events ──
export type PoSubmissionGateEventType =
  | "po_submission_gate_opened"
  | "po_submission_gate_saved"
  | "po_submission_gate_hold_set"
  | "po_submission_gate_blocker_detected"
  | "po_submission_gate_warning_detected"
  | "po_submission_package_v2_created"
  | "po_creation_execution_case_v2_created"
  | "po_submission_gate_completed";

export interface PoSubmissionGateEvent {
  type: PoSubmissionGateEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  poDraftV2Id: string;
  submissionPackageV2Id: string | null;
  creationExecutionCaseV2Id: string | null;
  changedFields: string[];
  destination: string;
}

export function createPoSubmissionGateEvent(
  type: PoSubmissionGateEventType,
  state: PoDraftSubmissionGateV2State,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): PoSubmissionGateEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    poDraftV2Id: state.poDraftV2Id,
    submissionPackageV2Id: state.submissionPackageId,
    creationExecutionCaseV2Id: state.creationExecutionCaseId,
    changedFields,
    destination,
  };
}
