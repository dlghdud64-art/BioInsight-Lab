/**
 * PO Conversion Entry v2 Intake Hydration Engine — handoff package → PO entry session
 *
 * 고정 규칙:
 * 1. poConversionHandoffPackageV2 = 단일 입력 source.
 * 2. opened ≠ entry started. hydration ready 이후에만 entry session 생성.
 * 3. scope/payload/separation/governance/entry 5개 hydration 축 분리 평가.
 * 4. returned / rejected는 entry session에 재유입 금지.
 * 5. rationale / provenance / governance는 visibility만 — PO truth 자동 생성 금지.
 * 6. canonical poEntrySessionV2 = actual entry의 단일 source of truth.
 * 7. draft 작성 / PO 생성 실행은 이 단계에서 금지.
 * 8. open → hydrate → ready → entry 순서 강제.
 */

import type { PoConversionHandoffPackageV2, PoConversionEntryCaseV2, PoLineItemSeed, PoHandoffExceptionFlag } from "./po-conversion-handoff-gate-v2-engine";
import type { ScopeRationale } from "./approval-workbench-review-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";

// ── Hydration Status ──
export type PoEntryHydrationStatus = "not_started" | "blocked" | "warning" | "ready" | "hydrated";

// ── Readiness Axis ──
export type PoEntryHydrationAxis = "scope_hydration_ready" | "payload_hydration_ready" | "separation_hydration_ready" | "governance_hydration_ready" | "entry_execution_ready";
export type PoEntryHydrationAxisStatus = "ok" | "warning" | "blocked";

export interface PoEntryHydrationAxisResult {
  axis: PoEntryHydrationAxis;
  status: PoEntryHydrationAxisStatus;
  detail: string;
}

// ── Precheck Flag ──
export type PoEntryHydrationPrecheckFlag =
  | "scope_empty"
  | "returned_contamination"
  | "rejected_contamination"
  | "vendor_missing"
  | "line_items_missing"
  | "qty_incomplete"
  | "amount_incomplete"
  | "ship_to_missing"
  | "bill_to_missing"
  | "receiving_missing"
  | "rationale_missing"
  | "provenance_missing"
  | "governance_stale"
  | "equivalent_heavy";

// ── State ──
export interface PoConversionEntryV2HydrationState {
  hydrationStatus: PoEntryHydrationStatus;
  poConversionEntryCaseV2Id: string;
  handoffPackageV2Id: string;
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
  axisResults: PoEntryHydrationAxisResult[];
  operatorPrepNote: string;
  precheckFlags: PoEntryHydrationPrecheckFlag[];
  blockerCount: number;
  warningCount: number;
  entrySessionId: string | null;
  correctionRouteId: string | null;
}

export function createInitialPoEntryHydrationState(
  pkg: PoConversionHandoffPackageV2,
  entryCase: PoConversionEntryCaseV2,
): PoConversionEntryV2HydrationState {
  const axes = evaluatePoEntryHydrationAxes(pkg, []);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    hydrationStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    poConversionEntryCaseV2Id: entryCase.id,
    handoffPackageV2Id: pkg.id,
    poRecordId: pkg.poRecordId,
    poEligibleScope: pkg.poEligibleScope,
    approvedScopeIds: pkg.approvedScopeIds,
    returnedExcludedIds: pkg.returnedExcludedIds,
    rejectedExcludedIds: pkg.rejectedExcludedIds,
    vendorId: pkg.vendorId,
    lineItems: pkg.lineItems,
    amountSummary: pkg.amountSummary,
    provenanceByLine: pkg.provenanceByLine,
    rationaleByLine: pkg.rationaleByLine,
    quoteReferenceVisible: pkg.quoteReferenceVisible,
    policyReferenceVisible: pkg.policyReferenceVisible,
    budgetReferenceVisible: pkg.budgetReferenceVisible,
    receivingInstruction: pkg.receivingInstruction,
    shipTo: pkg.shipTo,
    billTo: pkg.billTo,
    axisResults: axes,
    operatorPrepNote: "",
    precheckFlags: [],
    blockerCount: blockers.length,
    warningCount: warnings.length,
    entrySessionId: null,
    correctionRouteId: null,
  };
}

// ── Hydration Axes Evaluation ──
export function evaluatePoEntryHydrationAxes(pkg: PoConversionHandoffPackageV2, precheckFlags: PoEntryHydrationPrecheckFlag[]): PoEntryHydrationAxisResult[] {
  const results: PoEntryHydrationAxisResult[] = [];

  // 1. Scope hydration ready
  if (pkg.approvedScopeIds.length === 0) {
    results.push({ axis: "scope_hydration_ready", status: "blocked", detail: "Approved scope 비어 있음" });
  } else if (precheckFlags.includes("scope_empty")) {
    results.push({ axis: "scope_hydration_ready", status: "blocked", detail: "Scope hydrate 실패" });
  } else {
    results.push({ axis: "scope_hydration_ready", status: "ok", detail: `${pkg.approvedScopeIds.length}건 approved scope hydrate 준비` });
  }

  // 2. Payload hydration ready
  const payloadBlockers: string[] = [];
  if (!pkg.vendorId) payloadBlockers.push("vendor");
  if (pkg.lineItems.length === 0) payloadBlockers.push("line items");
  if (pkg.lineItems.some(l => !l.qty || l.qty <= 0)) payloadBlockers.push("qty");
  if (!pkg.shipTo && precheckFlags.includes("ship_to_missing")) payloadBlockers.push("ship-to");
  if (!pkg.receivingInstruction && precheckFlags.includes("receiving_missing")) payloadBlockers.push("receiving");

  if (payloadBlockers.length > 0) {
    results.push({ axis: "payload_hydration_ready", status: "blocked", detail: `Payload 누락: ${payloadBlockers.join(", ")}` });
  } else if (!pkg.billTo) {
    results.push({ axis: "payload_hydration_ready", status: "warning", detail: "Bill-to 누락" });
  } else if (pkg.lineItems.some(l => l.unitPrice === null || l.amount === null)) {
    results.push({ axis: "payload_hydration_ready", status: "warning", detail: "일부 line price/amount 누락" });
  } else {
    results.push({ axis: "payload_hydration_ready", status: "ok", detail: "Payload hydrate 준비 완료" });
  }

  // 3. Separation hydration ready
  if (precheckFlags.includes("returned_contamination")) {
    results.push({ axis: "separation_hydration_ready", status: "blocked", detail: "Returned scope가 entry session에 혼입" });
  } else if (precheckFlags.includes("rejected_contamination")) {
    results.push({ axis: "separation_hydration_ready", status: "blocked", detail: "Rejected scope가 entry session에 혼입" });
  } else {
    const returnedInApproved = pkg.returnedExcludedIds.filter(id => pkg.approvedScopeIds.includes(id));
    const rejectedInApproved = pkg.rejectedExcludedIds.filter(id => pkg.approvedScopeIds.includes(id));
    if (returnedInApproved.length > 0 || rejectedInApproved.length > 0) {
      results.push({ axis: "separation_hydration_ready", status: "blocked", detail: "Returned/rejected가 approved scope에 포함" });
    } else {
      results.push({ axis: "separation_hydration_ready", status: "ok", detail: "Returned/rejected 분리 완료" });
    }
  }

  // 4. Governance hydration ready
  const govIssues: string[] = [];
  if (pkg.exceptionFlags.includes("stale_quote_reference")) govIssues.push("Quote reference stale");
  if (pkg.exceptionFlags.includes("budget_recheck_needed")) govIssues.push("Budget 재확인 필요");
  if (pkg.exceptionFlags.includes("policy_gap")) govIssues.push("Policy 간극 존재");
  if (precheckFlags.includes("governance_stale")) govIssues.push("Governance context stale");

  if (govIssues.length > 0) {
    results.push({ axis: "governance_hydration_ready", status: "warning", detail: govIssues.join("; ") });
  } else {
    results.push({ axis: "governance_hydration_ready", status: "ok", detail: "Governance reference 준비 완료" });
  }

  // 5. Entry execution ready
  const hasBlocker = results.some(r => r.status === "blocked");
  if (hasBlocker) {
    results.push({ axis: "entry_execution_ready", status: "blocked", detail: "Hydration blocker 존재" });
  } else if (precheckFlags.includes("equivalent_heavy")) {
    results.push({ axis: "entry_execution_ready", status: "warning", detail: "Equivalent 비중 높은 PO — entry 시 주의 필요" });
  } else if (precheckFlags.includes("provenance_missing")) {
    results.push({ axis: "entry_execution_ready", status: "blocked", detail: "Provenance 누락" });
  } else {
    results.push({ axis: "entry_execution_ready", status: "ok", detail: "PO entry 시작 가능" });
  }

  return results;
}

// ── Hydration Readiness Aggregate ──
export interface PoEntryHydrationReadinessResult {
  status: PoEntryHydrationStatus;
  blockers: string[];
  warnings: string[];
  canComplete: boolean;
}

export function evaluatePoEntryHydrationReadiness(state: PoConversionEntryV2HydrationState): PoEntryHydrationReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.handoffPackageV2Id) blockers.push("Handoff package lineage 없음");
  if (!state.poConversionEntryCaseV2Id) blockers.push("PO conversion entry case lineage 없음");

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Precheck flags
  if (state.precheckFlags.includes("scope_empty")) blockers.push("PO scope 비어 있음");
  if (state.precheckFlags.includes("returned_contamination")) blockers.push("Returned 혼입");
  if (state.precheckFlags.includes("rejected_contamination")) blockers.push("Rejected 혼입");
  if (state.precheckFlags.includes("vendor_missing")) blockers.push("Vendor 누락");
  if (state.precheckFlags.includes("line_items_missing")) blockers.push("Line items 누락");
  if (state.precheckFlags.includes("qty_incomplete")) blockers.push("Qty 불완전");
  if (state.precheckFlags.includes("ship_to_missing")) warnings.push("Ship-to 누락");
  if (state.precheckFlags.includes("bill_to_missing")) warnings.push("Bill-to 누락");
  if (state.precheckFlags.includes("receiving_missing")) warnings.push("Receiving instruction 누락");
  if (state.precheckFlags.includes("governance_stale")) warnings.push("Governance context stale");
  if (state.precheckFlags.includes("equivalent_heavy")) warnings.push("Equivalent 비중 높음");
  if (state.precheckFlags.includes("rationale_missing")) warnings.push("Rationale 누락");
  if (state.precheckFlags.includes("provenance_missing")) blockers.push("Provenance 누락");

  const status: PoEntryHydrationStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 completion 금지 (보수적)
  return { status, blockers, warnings, canComplete: status === "ready" };
}

// ── PO Entry Session Status ──
export type PoEntrySessionStatus = "initialized" | "hydrated" | "ready_for_po_entry" | "entry_in_progress" | "entry_completed" | "cancelled";

// ── Canonical PO Entry Session V2 ──
export interface PoEntrySessionV2 {
  id: string;
  sourcePoConversionHandoffPackageV2Id: string;
  sourcePoConversionEntryCaseV2Id: string;
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
  operatorPrepNote: string;
  precheckFlags: PoEntryHydrationPrecheckFlag[];
  hydratedAt: string;
  hydratedBy: string;
  status: PoEntrySessionStatus;
  nextDestination: string;
}

export function buildPoEntrySessionV2(state: PoConversionEntryV2HydrationState): PoEntrySessionV2 | null {
  const readiness = evaluatePoEntryHydrationReadiness(state);
  if (!readiness.canComplete) return null;

  return {
    id: `poentsv2_${Date.now().toString(36)}`,
    sourcePoConversionHandoffPackageV2Id: state.handoffPackageV2Id,
    sourcePoConversionEntryCaseV2Id: state.poConversionEntryCaseV2Id,
    poRecordId: state.poRecordId,
    poEligibleScope: state.poEligibleScope,
    approvedScopeIds: state.approvedScopeIds,
    returnedExcludedIds: state.returnedExcludedIds,
    rejectedExcludedIds: state.rejectedExcludedIds,
    vendorId: state.vendorId,
    lineItems: state.lineItems,
    amountSummary: state.amountSummary,
    provenanceByLine: state.provenanceByLine,
    rationaleByLine: state.rationaleByLine,
    quoteReferenceVisible: state.quoteReferenceVisible,
    policyReferenceVisible: state.policyReferenceVisible,
    budgetReferenceVisible: state.budgetReferenceVisible,
    receivingInstruction: state.receivingInstruction,
    shipTo: state.shipTo,
    billTo: state.billTo,
    operatorPrepNote: state.operatorPrepNote,
    precheckFlags: state.precheckFlags,
    hydratedAt: new Date().toISOString(),
    hydratedBy: "operator",
    status: "ready_for_po_entry",
    nextDestination: "po_conversion_entry_v2",
  };
}

// ── Correction Route ──
export interface PoEntryHydrationCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceHandoffPackageV2Id: string;
  routeType: "handoff_gate_return" | "approval_review_return" | "payload_correction" | "governance_correction" | "separation_correction";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildPoEntryHydrationCorrectionRoute(
  state: PoConversionEntryV2HydrationState,
  routeType: PoEntryHydrationCorrectionRoute["routeType"],
  reason: string,
): PoEntryHydrationCorrectionRoute {
  const readiness = evaluatePoEntryHydrationReadiness(state);

  const nextDest =
    routeType === "handoff_gate_return" ? "po_conversion_handoff_gate_v2"
    : routeType === "approval_review_return" ? "approval_review_v2"
    : routeType === "payload_correction" ? "po_conversion_handoff_gate_v2"
    : routeType === "governance_correction" ? "approval_handoff_gate_v2"
    : "po_conversion_handoff_gate_v2";

  return {
    id: `pohydrcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceHandoffPackageV2Id: state.handoffPackageV2Id,
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
export type PoEntryHydrationEventType =
  | "po_entry_hydration_opened"
  | "po_entry_hydration_saved"
  | "po_entry_hydration_hold_set"
  | "po_entry_hydration_blocker_detected"
  | "po_entry_hydration_warning_detected"
  | "po_entry_session_v2_created"
  | "po_entry_hydration_completed"
  | "po_ready_for_entry";

export interface PoEntryHydrationEvent {
  type: PoEntryHydrationEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  handoffPackageV2Id: string;
  entryCaseV2Id: string;
  entrySessionV2Id: string | null;
  changedFields: string[];
  destination: string;
}

export function createPoEntryHydrationEvent(
  type: PoEntryHydrationEventType,
  state: PoConversionEntryV2HydrationState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): PoEntryHydrationEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    handoffPackageV2Id: state.handoffPackageV2Id,
    entryCaseV2Id: state.poConversionEntryCaseV2Id,
    entrySessionV2Id: state.entrySessionId,
    changedFields,
    destination,
  };
}
