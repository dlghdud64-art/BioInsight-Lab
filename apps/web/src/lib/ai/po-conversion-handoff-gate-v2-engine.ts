/**
 * PO Conversion Handoff Gate v2 Engine — approval decision → PO conversion handoff package
 *
 * 고정 규칙:
 * 1. approvalDecisionRecordV2 = 단일 입력 source.
 * 2. approved ≠ PO entry started. handoff ready 이후에만 넘기기.
 * 3. scope/separation/payload/governance/entry 5개 readiness 축 분리 평가.
 * 4. returned / rejected scope는 PO payload에서 명시적 제외.
 * 5. vendor / qty / amount / receiving context 불완전 시 handoff 금지.
 * 6. canonical poConversionHandoffPackageV2 = PO entry layer의 단일 intake source.
 * 7. actual PO draft 입력 / PO 생성 실행은 이 단계에서 금지.
 * 8. approval decision → PO handoff → PO hydration → PO entry 순서 강제.
 */

import type { ApprovalDecisionRecordV2, ApprovalDecisionRecordStatus, ScopeRationale } from "./approval-workbench-review-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";

// ── Gate Status ──
export type PoConversionHandoffGateStatus = "not_started" | "blocked" | "warning" | "ready" | "handed_off";

// ── Readiness Axis ──
export type PoHandoffAxis = "scope_po_ready" | "separation_po_ready" | "payload_po_ready" | "governance_po_ready" | "entry_po_ready";
export type PoHandoffAxisStatus = "ok" | "warning" | "blocked";

export interface PoHandoffAxisResult {
  axis: PoHandoffAxis;
  status: PoHandoffAxisStatus;
  detail: string;
}

// ── PO Line Item ──
export interface PoLineItemSeed {
  lineId: string;
  candidateId: string;
  productIdentity: string;
  qty: number;
  unit: string;
  unitPrice: number | null;
  amount: number | null;
  vendorName: string;
  provenance: "exact" | "equivalent";
}

// ── Precheck Flag ──
export type PoHandoffPrecheckFlag =
  | "scope_empty"
  | "returned_contamination"
  | "rejected_contamination"
  | "vendor_missing"
  | "qty_missing"
  | "amount_missing"
  | "receiving_missing"
  | "ship_to_missing"
  | "bill_to_missing"
  | "rationale_missing"
  | "provenance_missing"
  | "budget_reference_missing"
  | "policy_reference_missing";

// ── Exception Flag ──
export type PoHandoffExceptionFlag =
  | "equivalent_heavy_po"
  | "mixed_decision_unresolved"
  | "stale_quote_reference"
  | "budget_recheck_needed"
  | "policy_gap"
  | "partial_line_coverage";

// ── Handoff Decision ──
export interface PoConversionHandoffDecision {
  poEligibleScope: string;
  approvedScopeIds: string[];
  returnedExcludedIds: string[];
  rejectedExcludedIds: string[];
  vendorId: string;
  lineItems: PoLineItemSeed[];
  amountSummary: string;
  provenanceByLine: LaneProvenance[];
  rationaleByLine: ScopeRationale[];
  quoteReferenceVisible: boolean;
  policyReferenceVisible: boolean;
  budgetReferenceVisible: boolean;
  receivingInstruction: string;
  shipTo: string;
  billTo: string;
  operatorNote: string;
  precheckFlags: PoHandoffPrecheckFlag[];
  exceptionFlags: PoHandoffExceptionFlag[];
}

// ── State ──
export interface PoConversionHandoffGateV2State {
  gateStatus: PoConversionHandoffGateStatus;
  approvalDecisionRecordV2Id: string;
  sourceApprovalReviewSessionV2Id: string;
  sourceApprovalHandoffPackageV2Id: string;
  poRecordId: string;
  decisionStatus: ApprovalDecisionRecordStatus;
  approvedCount: number;
  returnedCount: number;
  rejectedCount: number;
  axisResults: PoHandoffAxisResult[];
  decision: PoConversionHandoffDecision | null;
  blockerCount: number;
  warningCount: number;
  handoffPackageId: string | null;
  entryCaseId: string | null;
}

export function createInitialPoConversionHandoffGateState(record: ApprovalDecisionRecordV2): PoConversionHandoffGateV2State {
  const axes = evaluatePoHandoffAxes(record, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    gateStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    approvalDecisionRecordV2Id: record.id,
    sourceApprovalReviewSessionV2Id: record.sourceApprovalReviewSessionV2Id,
    sourceApprovalHandoffPackageV2Id: record.sourceApprovalHandoffPackageV2Id,
    poRecordId: record.poRecordId,
    decisionStatus: record.status,
    approvedCount: record.approvedScopeIds.length,
    returnedCount: record.returnedScopeIds.length,
    rejectedCount: record.rejectedScopeIds.length,
    axisResults: axes,
    decision: null,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    handoffPackageId: null,
    entryCaseId: null,
  };
}

// ── Readiness Axes Evaluation ──
export function evaluatePoHandoffAxes(record: ApprovalDecisionRecordV2, decision: PoConversionHandoffDecision | null): PoHandoffAxisResult[] {
  const results: PoHandoffAxisResult[] = [];

  // 1. Scope PO ready
  if (record.status !== "approved" && record.status !== "mixed_scope_blocked") {
    results.push({ axis: "scope_po_ready", status: "blocked", detail: "Decision record가 PO 가능한 상태가 아님" });
  } else if (record.approvedScopeIds.length === 0) {
    results.push({ axis: "scope_po_ready", status: "blocked", detail: "Approved scope가 없음" });
  } else if (decision && decision.approvedScopeIds.length === 0) {
    results.push({ axis: "scope_po_ready", status: "blocked", detail: "PO eligible scope 미지정" });
  } else if (decision?.approvedScopeIds.length) {
    results.push({ axis: "scope_po_ready", status: "ok", detail: `${decision.approvedScopeIds.length}건 PO scope 확인됨` });
  } else {
    results.push({ axis: "scope_po_ready", status: "blocked", detail: "PO scope 미입력" });
  }

  // 2. Separation PO ready
  if (decision) {
    const approvedSet = new Set(decision.approvedScopeIds);
    const returnedInApproved = decision.returnedExcludedIds.filter(id => approvedSet.has(id));
    const rejectedInApproved = decision.rejectedExcludedIds.filter(id => approvedSet.has(id));

    if (returnedInApproved.length > 0) {
      results.push({ axis: "separation_po_ready", status: "blocked", detail: `${returnedInApproved.length}건 returned scope가 PO scope에 포함` });
    } else if (rejectedInApproved.length > 0) {
      results.push({ axis: "separation_po_ready", status: "blocked", detail: `${rejectedInApproved.length}건 rejected scope가 PO scope에 포함` });
    } else if (record.status === "mixed_scope_blocked" && decision.exceptionFlags.includes("mixed_decision_unresolved")) {
      results.push({ axis: "separation_po_ready", status: "warning", detail: "Mixed decision 상태 — excluded route 확인 필요" });
    } else {
      results.push({ axis: "separation_po_ready", status: "ok", detail: "Returned/rejected 분리 완료" });
    }
  } else {
    results.push({ axis: "separation_po_ready", status: "blocked", detail: "Separation 미확인" });
  }

  // 3. Payload PO ready
  if (decision) {
    const payloadBlockers: string[] = [];
    if (!decision.vendorId) payloadBlockers.push("vendor");
    if (decision.lineItems.length === 0) payloadBlockers.push("line items");
    if (decision.lineItems.some(l => !l.qty || l.qty <= 0)) payloadBlockers.push("qty");
    if (decision.precheckFlags.includes("receiving_missing")) payloadBlockers.push("receiving");
    if (decision.precheckFlags.includes("ship_to_missing")) payloadBlockers.push("ship-to");

    if (payloadBlockers.length > 0) {
      results.push({ axis: "payload_po_ready", status: "blocked", detail: `PO payload 누락: ${payloadBlockers.join(", ")}` });
    } else if (decision.precheckFlags.includes("bill_to_missing")) {
      results.push({ axis: "payload_po_ready", status: "warning", detail: "Bill-to 누락" });
    } else if (decision.precheckFlags.includes("amount_missing")) {
      results.push({ axis: "payload_po_ready", status: "warning", detail: "일부 line amount 누락" });
    } else {
      results.push({ axis: "payload_po_ready", status: "ok", detail: "PO payload 준비 완료" });
    }
  } else {
    results.push({ axis: "payload_po_ready", status: "blocked", detail: "Payload 미확인" });
  }

  // 4. Governance PO ready
  if (decision) {
    const govIssues: string[] = [];
    if (decision.exceptionFlags.includes("budget_recheck_needed")) govIssues.push("예산 재확인 필요");
    if (decision.exceptionFlags.includes("policy_gap")) govIssues.push("정책 간극 존재");
    if (decision.exceptionFlags.includes("stale_quote_reference")) govIssues.push("Quote reference stale");

    if (govIssues.length > 0) {
      results.push({ axis: "governance_po_ready", status: "warning", detail: govIssues.join("; ") });
    } else {
      results.push({ axis: "governance_po_ready", status: "ok", detail: "Governance reference 준비 완료" });
    }
  } else {
    results.push({ axis: "governance_po_ready", status: "blocked", detail: "Governance 미확인" });
  }

  // 5. Entry PO ready
  const hasBlocker = results.some(r => r.status === "blocked");
  if (hasBlocker) {
    results.push({ axis: "entry_po_ready", status: "blocked", detail: "Handoff blocker 존재" });
  } else if (decision?.exceptionFlags.includes("equivalent_heavy_po")) {
    results.push({ axis: "entry_po_ready", status: "warning", detail: "Equivalent 비중 높은 PO — entry 시 주의 필요" });
  } else if (decision?.exceptionFlags.includes("partial_line_coverage")) {
    results.push({ axis: "entry_po_ready", status: "warning", detail: "일부 line만 PO 대상 — 나머지 처리 경로 확인 필요" });
  } else {
    results.push({ axis: "entry_po_ready", status: "ok", detail: "PO entry 시작 가능" });
  }

  return results;
}

// ── Gate Readiness Aggregate ──
export interface PoConversionHandoffReadinessResult {
  status: PoConversionHandoffGateStatus;
  blockers: string[];
  warnings: string[];
  canHandoff: boolean;
}

export function evaluatePoConversionHandoffReadiness(state: PoConversionHandoffGateV2State): PoConversionHandoffReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.approvalDecisionRecordV2Id) blockers.push("Approval decision record lineage 없음");
  if (state.decisionStatus !== "approved" && state.decisionStatus !== "mixed_scope_blocked") {
    blockers.push("Decision record가 PO 가능한 상태가 아님");
  }

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Decision completeness
  if (!state.decision) {
    blockers.push("PO conversion handoff decision 미완료");
  }

  const status: PoConversionHandoffGateStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 handoff 금지 (보수적)
  return { status, blockers, warnings, canHandoff: status === "ready" };
}

// ── Canonical PO Conversion Handoff Package V2 ──
export interface PoConversionHandoffPackageV2 {
  id: string;
  sourceApprovalDecisionRecordV2Id: string;
  sourceApprovalReviewSessionV2Id: string;
  sourceApprovalHandoffPackageV2Id: string;
  poRecordId: string;
  poEligibleScope: string;
  approvedScopeIds: string[];
  returnedExcludedIds: string[];
  rejectedExcludedIds: string[];
  vendorId: string;
  lineItems: PoLineItemSeed[];
  amountSummary: string;
  provenanceByLine: LaneProvenance[];
  rationaleByLine: ScopeRationale[];
  quoteReferenceVisible: boolean;
  policyReferenceVisible: boolean;
  budgetReferenceVisible: boolean;
  receivingInstruction: string;
  shipTo: string;
  billTo: string;
  operatorNote: string;
  exceptionFlags: PoHandoffExceptionFlag[];
  createdAt: string;
  createdBy: string;
  nextDestination: string;
}

export function buildPoConversionHandoffPackageV2(state: PoConversionHandoffGateV2State): PoConversionHandoffPackageV2 | null {
  if (!state.decision) return null;
  const readiness = evaluatePoConversionHandoffReadiness(state);
  if (!readiness.canHandoff) return null;

  const d = state.decision;
  return {
    id: `poconvpkg_${Date.now().toString(36)}`,
    sourceApprovalDecisionRecordV2Id: state.approvalDecisionRecordV2Id,
    sourceApprovalReviewSessionV2Id: state.sourceApprovalReviewSessionV2Id,
    sourceApprovalHandoffPackageV2Id: state.sourceApprovalHandoffPackageV2Id,
    poRecordId: state.poRecordId,
    poEligibleScope: d.poEligibleScope,
    approvedScopeIds: d.approvedScopeIds,
    returnedExcludedIds: d.returnedExcludedIds,
    rejectedExcludedIds: d.rejectedExcludedIds,
    vendorId: d.vendorId,
    lineItems: d.lineItems,
    amountSummary: d.amountSummary,
    provenanceByLine: d.provenanceByLine,
    rationaleByLine: d.rationaleByLine,
    quoteReferenceVisible: d.quoteReferenceVisible,
    policyReferenceVisible: d.policyReferenceVisible,
    budgetReferenceVisible: d.budgetReferenceVisible,
    receivingInstruction: d.receivingInstruction,
    shipTo: d.shipTo,
    billTo: d.billTo,
    operatorNote: d.operatorNote,
    exceptionFlags: d.exceptionFlags,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    nextDestination: "po_conversion_entry_v2",
  };
}

// ── Canonical PO Conversion Entry Case V2 ──
export interface PoConversionEntryCaseV2 {
  id: string;
  sourcePoConversionHandoffPackageV2Id: string;
  status: "queued" | "opened" | "hydrating" | "ready_for_entry" | "on_hold" | "cancelled";
  openedAt: string;
  openedBy: string;
  targetWorkbench: string;
  nextDestination: string;
}

export function buildPoConversionEntryCaseV2(pkg: PoConversionHandoffPackageV2): PoConversionEntryCaseV2 {
  return {
    id: `poconvcase_${Date.now().toString(36)}`,
    sourcePoConversionHandoffPackageV2Id: pkg.id,
    status: "queued",
    openedAt: new Date().toISOString(),
    openedBy: "operator",
    targetWorkbench: "po_conversion_entry_v2",
    nextDestination: "po_conversion_entry_v2",
  };
}

// ── Correction Route ──
export interface PoHandoffCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceApprovalDecisionRecordV2Id: string;
  routeType: "approval_review_return" | "payload_correction" | "governance_correction" | "separation_correction";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildPoHandoffCorrectionRoute(
  state: PoConversionHandoffGateV2State,
  routeType: PoHandoffCorrectionRoute["routeType"],
  reason: string,
): PoHandoffCorrectionRoute {
  const readiness = evaluatePoConversionHandoffReadiness(state);

  const nextDest =
    routeType === "approval_review_return" ? "approval_review_v2"
    : routeType === "payload_correction" ? "po_conversion_handoff_gate_v2"
    : routeType === "governance_correction" ? "approval_handoff_gate_v2"
    : "approval_review_v2";

  return {
    id: `pohcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceApprovalDecisionRecordV2Id: state.approvalDecisionRecordV2Id,
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
export type PoConversionHandoffEventType =
  | "po_conversion_handoff_gate_opened"
  | "po_conversion_handoff_gate_saved"
  | "po_conversion_handoff_gate_hold_set"
  | "po_conversion_handoff_gate_blocker_detected"
  | "po_conversion_handoff_gate_warning_detected"
  | "po_conversion_handoff_package_v2_created"
  | "po_conversion_entry_case_v2_created"
  | "po_conversion_handoff_completed";

export interface PoConversionHandoffEvent {
  type: PoConversionHandoffEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  approvalDecisionRecordV2Id: string;
  handoffPackageV2Id: string | null;
  entryCaseV2Id: string | null;
  changedFields: string[];
  destination: string;
}

export function createPoConversionHandoffEvent(
  type: PoConversionHandoffEventType,
  state: PoConversionHandoffGateV2State,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): PoConversionHandoffEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    approvalDecisionRecordV2Id: state.approvalDecisionRecordV2Id,
    handoffPackageV2Id: state.handoffPackageId,
    entryCaseV2Id: state.entryCaseId,
    changedFields,
    destination,
  };
}
