/**
 * PO Conversion Entry v2 Draft Editing Engine — entry session → PO draft
 *
 * 고정 규칙:
 * 1. poEntrySessionV2 = 단일 입력 source.
 * 2. ready_for_po_entry ≠ draft_ready. editing 완료 이후에만 draft 생성.
 * 3. line/context/governance/flagged/submission 5개 readiness 축 분리 평가.
 * 4. returned / rejected / flagged line은 active draft path에서 제외.
 * 5. rationale / provenance / governance는 visibility만 — draft payload 자동 확정 금지.
 * 6. canonical poDraftV2 = submission gate의 단일 intake source.
 * 7. submit / PO creation 실행은 이 단계에서 금지.
 * 8. editing → canonical draft → submission gate 순서 강제.
 */

import type { PoEntrySessionV2, PoEntrySessionStatus } from "./po-conversion-entry-v2-hydration-engine";
import type { PoLineItemSeed } from "./po-conversion-handoff-gate-v2-engine";
import type { ScopeRationale } from "./approval-workbench-review-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";

// ── Editing Status ──
export type PoDraftEditingStatus = "blocked" | "warning" | "ready" | "in_progress" | "completed" | "failed";

// ── Line Draft Status ──
export type LineDraftStatus = "pending_completion" | "completed" | "flagged";

// ── Draft Line Item ──
export interface PoDraftLineItem {
  lineId: string;
  scopeId: string;
  vendorId: string;
  supplierSku: string;
  catalogNo: string;
  productIdentity: string;
  qty: number;
  unit: string;
  unitPrice: number | null;
  lineTotal: number | null;
  deliveryNote: string;
  receivingNote: string;
  internalMemo: string;
  provenance: "exact" | "equivalent";
  draftStatus: LineDraftStatus;
}

// ── Draft Editing Decision ──
export interface PoDraftEditingDecision {
  lineItems: PoDraftLineItem[];
  vendorOrderContact: string;
  shipTo: string;
  billTo: string;
  requesterContext: string;
  departmentContext: string;
  receivingInstruction: string;
  internalOrderMemo: string;
  quoteReferenceVisible: boolean;
  policyReferenceVisible: boolean;
  budgetReferenceVisible: boolean;
  operatorDraftNote: string;
}

// ── State ──
export interface PoConversionEntryV2DraftState {
  editingStatus: PoDraftEditingStatus;
  poEntrySessionV2Id: string;
  sourceHandoffPackageV2Id: string;
  sourceApprovalDecisionRecordV2Id: string;
  poRecordId: string;
  poEligibleScope: string;
  approvedScopeIds: string[];
  returnedExcludedIds: string[];
  rejectedExcludedIds: string[];
  vendorId: string;
  decision: PoDraftEditingDecision | null;
  blockerCount: number;
  warningCount: number;
  draftId: string | null;
}

export function createInitialDraftEditingState(session: PoEntrySessionV2): PoConversionEntryV2DraftState {
  return {
    editingStatus: "in_progress",
    poEntrySessionV2Id: session.id,
    sourceHandoffPackageV2Id: session.sourcePoConversionHandoffPackageV2Id,
    sourceApprovalDecisionRecordV2Id: "",
    poRecordId: session.poRecordId,
    poEligibleScope: session.poEligibleScope,
    approvedScopeIds: session.approvedScopeIds,
    returnedExcludedIds: session.returnedExcludedIds,
    rejectedExcludedIds: session.rejectedExcludedIds,
    vendorId: session.vendorId,
    decision: null,
    blockerCount: 0,
    warningCount: 0,
    draftId: null,
  };
}

// ── Editing Readiness ──
export interface PoDraftEditingReadinessResult {
  status: PoDraftEditingStatus;
  blockers: string[];
  warnings: string[];
  canComplete: boolean;
}

export function evaluatePoDraftEditingReadiness(state: PoConversionEntryV2DraftState): PoDraftEditingReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.poEntrySessionV2Id) blockers.push("PO entry session lineage 없음");

  if (!state.decision) {
    blockers.push("PO draft editing decision 미완료");
    return { status: "blocked", blockers, warnings, canComplete: false };
  }

  const d = state.decision;

  // Line completeness
  if (d.lineItems.length === 0) {
    blockers.push("Line items 비어 있음");
  }

  const pendingLines = d.lineItems.filter(l => l.draftStatus === "pending_completion");
  const flaggedLines = d.lineItems.filter(l => l.draftStatus === "flagged");
  const completedLines = d.lineItems.filter(l => l.draftStatus === "completed");

  if (pendingLines.length === d.lineItems.length && d.lineItems.length > 0) {
    blockers.push("모든 line이 완성 대기 상태");
  } else if (pendingLines.length > 0) {
    blockers.push(`${pendingLines.length}건 line 편집 미완료`);
  }

  if (flaggedLines.length > 0) {
    blockers.push(`${flaggedLines.length}건 flagged line 존재 — active draft path 분리 필요`);
  }

  // Required field check per line
  for (const line of d.lineItems) {
    if (line.draftStatus === "completed") {
      if (!line.qty || line.qty <= 0) blockers.push(`Line ${line.lineId}: qty 누락`);
      if (!line.vendorId) blockers.push(`Line ${line.lineId}: vendor 누락`);
      if (!line.unit) warnings.push(`Line ${line.lineId}: unit 누락`);
      if (line.unitPrice === null) warnings.push(`Line ${line.lineId}: unit price 누락`);
    }
  }

  // Context completeness
  if (!d.shipTo) blockers.push("Ship-to 누락");
  if (!d.billTo) warnings.push("Bill-to 누락");
  if (!d.receivingInstruction) warnings.push("Receiving instruction 누락");
  if (!d.vendorOrderContact) warnings.push("Vendor order contact 누락");

  // Contamination guard
  const lineIds = new Set(d.lineItems.map(l => l.scopeId));
  const returnedInDraft = state.returnedExcludedIds.filter(id => lineIds.has(id));
  const rejectedInDraft = state.rejectedExcludedIds.filter(id => lineIds.has(id));
  if (returnedInDraft.length > 0) blockers.push(`${returnedInDraft.length}건 returned scope가 draft에 포함`);
  if (rejectedInDraft.length > 0) blockers.push(`${rejectedInDraft.length}건 rejected scope가 draft에 포함`);

  // Equivalent note guard
  const equivalentNoMemo = d.lineItems.filter(l => l.provenance === "equivalent" && !l.internalMemo && l.draftStatus === "completed");
  if (equivalentNoMemo.length > 0) {
    warnings.push(`${equivalentNoMemo.length}건 equivalent line에 내부 메모 없음`);
  }

  const status: PoDraftEditingStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "completed";

  // Batch 1: warning에서도 completion 금지 (보수적)
  return { status, blockers, warnings, canComplete: status === "completed" };
}

// ── PO Draft Status ──
export type PoDraftV2Status = "draft_incomplete" | "draft_ready" | "blocked" | "cancelled";

// ── Canonical PO Draft V2 ──
export interface PoDraftV2 {
  id: string;
  sourcePoEntrySessionV2Id: string;
  sourcePoConversionHandoffPackageV2Id: string;
  sourceApprovalDecisionRecordV2Id: string;
  poRecordId: string;
  poEligibleScope: string;
  vendorId: string;
  lineItems: PoDraftLineItem[];
  amountSummary: string;
  vendorOrderContact: string;
  shipTo: string;
  billTo: string;
  requesterContext: string;
  departmentContext: string;
  receivingInstruction: string;
  internalOrderMemo: string;
  provenanceByLine: LaneProvenance[];
  rationaleByLine: ScopeRationale[];
  quoteReferenceVisible: boolean;
  policyReferenceVisible: boolean;
  budgetReferenceVisible: boolean;
  operatorDraftNote: string;
  createdAt: string;
  createdBy: string;
  status: PoDraftV2Status;
  nextDestination: string;
}

export function buildPoDraftV2(
  state: PoConversionEntryV2DraftState,
  session: PoEntrySessionV2,
): PoDraftV2 | null {
  const readiness = evaluatePoDraftEditingReadiness(state);
  if (!readiness.canComplete) return null;
  if (!state.decision) return null;

  const d = state.decision;
  const completedLines = d.lineItems.filter(l => l.draftStatus === "completed");
  const totalAmount = completedLines.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0);

  const provenanceByLine: LaneProvenance[] = completedLines.map(l => ({
    candidateId: l.scopeId,
    originalLane: l.provenance,
    triageAction: "promote_to_compare",
    classification: l.provenance === "exact" ? "exact_comparable" : "equivalent_comparable",
  }));

  return {
    id: `podraftv2_${Date.now().toString(36)}`,
    sourcePoEntrySessionV2Id: state.poEntrySessionV2Id,
    sourcePoConversionHandoffPackageV2Id: state.sourceHandoffPackageV2Id,
    sourceApprovalDecisionRecordV2Id: state.sourceApprovalDecisionRecordV2Id,
    poRecordId: state.poRecordId,
    poEligibleScope: state.poEligibleScope,
    vendorId: state.vendorId,
    lineItems: completedLines,
    amountSummary: `${completedLines.length}건, 총 ${totalAmount.toLocaleString()}`,
    vendorOrderContact: d.vendorOrderContact,
    shipTo: d.shipTo,
    billTo: d.billTo,
    requesterContext: d.requesterContext,
    departmentContext: d.departmentContext,
    receivingInstruction: d.receivingInstruction,
    internalOrderMemo: d.internalOrderMemo,
    provenanceByLine,
    rationaleByLine: session.rationaleByLine,
    quoteReferenceVisible: d.quoteReferenceVisible,
    policyReferenceVisible: d.policyReferenceVisible,
    budgetReferenceVisible: d.budgetReferenceVisible,
    operatorDraftNote: d.operatorDraftNote,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "draft_ready",
    nextDestination: "po_draft_submission_gate_v2",
  };
}

// ── Activity Events ──
export type PoDraftEditingEventType =
  | "po_draft_editing_opened"
  | "po_draft_editing_saved"
  | "po_draft_editing_hold_set"
  | "po_draft_editing_blocker_detected"
  | "po_draft_editing_warning_detected"
  | "po_draft_v2_created"
  | "po_draft_editing_completed"
  | "po_ready_for_submission_gate";

export interface PoDraftEditingEvent {
  type: PoDraftEditingEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  poEntrySessionV2Id: string;
  poDraftV2Id: string | null;
  changedFields: string[];
  destination: string;
}

export function createPoDraftEditingEvent(
  type: PoDraftEditingEventType,
  state: PoConversionEntryV2DraftState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): PoDraftEditingEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    poEntrySessionV2Id: state.poEntrySessionV2Id,
    poDraftV2Id: state.draftId,
    changedFields,
    destination,
  };
}
