/**
 * PO Created Workbench Engine — created PO 운영 검토 + outbound readiness + dispatch prep routing
 *
 * 고정 규칙:
 * 1. poRecord = created 이후 단일 source of truth.
 * 2. created ≠ dispatch_preparing ≠ sent — 각각 별도 상태.
 * 3. created workbench에서 core truth (vendor/qty/amount) 직접 수정 금지.
 * 4. correction 필요 시 routing으로만 처리.
 * 5. dispatch prep은 다음 단계에서 — 여기는 created object control surface.
 */

import type { PoRecord } from "./po-creation-execution-engine";

// ── Workbench Status ──
export type PoCreatedWorkbenchStatus = "active_review" | "hold" | "ready_for_dispatch_prep" | "routed_to_dispatch_prep";
export type PoOutboundReadinessStatus = "blocked" | "warning" | "ready";

// ── State ──
export interface PoCreatedWorkbenchState {
  workbenchStatus: PoCreatedWorkbenchStatus;
  outboundReadiness: PoOutboundReadinessStatus;
  poRecordId: string;
  vendorId: string;
  lineCount: number;
  amountSummary: string;
  reviewNote: string;
  holdReason: string;
  blockerCount: number;
  warningCount: number;
  correctionTarget: string | null;
}

export function createInitialPoCreatedWorkbenchState(poRecord: PoRecord): PoCreatedWorkbenchState {
  const readiness = evaluateOutboundReadiness(poRecord);
  return {
    workbenchStatus: "active_review",
    outboundReadiness: readiness.status,
    poRecordId: poRecord.id,
    vendorId: poRecord.vendorId,
    lineCount: poRecord.lineItems.length,
    amountSummary: poRecord.amountSummary,
    reviewNote: "",
    holdReason: "",
    blockerCount: readiness.blockers.length,
    warningCount: readiness.warnings.length,
    correctionTarget: null,
  };
}

// ── Outbound Readiness ──
export interface OutboundReadinessResult {
  status: PoOutboundReadinessStatus;
  blockers: string[];
  warnings: string[];
  infos: string[];
}

export function evaluateOutboundReadiness(poRecord: PoRecord): OutboundReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];

  if (!poRecord.vendorOrderContact) blockers.push("공급사 발송 연락처 미확인");
  if (!poRecord.shipTo) blockers.push("배송지 누락");
  if (poRecord.lineItems.length === 0) blockers.push("라인 항목 없음");
  if (poRecord.status !== "created") blockers.push("PO 상태가 created가 아님");

  if (!poRecord.attachmentSummary) warnings.push("첨부 파일 없음");
  if (!poRecord.receivingInstruction) warnings.push("입고 지시 미입력");
  if (!poRecord.internalOrderMemo) infos.push("내부 주문 메모 없음");

  const status: PoOutboundReadinessStatus =
    blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready";

  return { status, blockers, warnings, infos };
}

// ── Workbench Actions ──
export function setWorkbenchHold(state: PoCreatedWorkbenchState, reason: string): PoCreatedWorkbenchState {
  return { ...state, workbenchStatus: "hold", holdReason: reason };
}

export function setWorkbenchReadyForDispatch(state: PoCreatedWorkbenchState): PoCreatedWorkbenchState {
  return { ...state, workbenchStatus: "ready_for_dispatch_prep" };
}

export function routeToDispatchPrep(state: PoCreatedWorkbenchState): PoCreatedWorkbenchState {
  return { ...state, workbenchStatus: "routed_to_dispatch_prep" };
}

export function setCorrectionTarget(state: PoCreatedWorkbenchState, target: string): PoCreatedWorkbenchState {
  return { ...state, correctionTarget: target };
}

// ── Dispatch Preparation Package (intake 전제 구조) ──
export interface DispatchPreparationPackageV2 {
  id: string;
  sourcePoRecordId: string;
  sourceRequestId: string;
  sourceApprovalCaseId: string;
  vendorId: string;
  vendorDispatchContact: string;
  outboundDocumentSummary: string;
  attachmentSummary: string;
  lineItemsSummary: string;
  amountSummary: string;
  billTo: string;
  shipTo: string;
  requesterContext: string;
  departmentContext: string;
  receivingInstruction: string;
  dispatchNoteSummary: string;
  blockerSnapshot: string[];
  warningSnapshot: string[];
  createdAt: string;
  createdBy: string;
  nextDestination: string;
}

export function buildDispatchPreparationPackageV2(poRecord: PoRecord, readiness: OutboundReadinessResult): DispatchPreparationPackageV2 {
  return {
    id: `disppkgv2_${Date.now().toString(36)}`,
    sourcePoRecordId: poRecord.id,
    sourceRequestId: poRecord.sourceRequestId,
    sourceApprovalCaseId: poRecord.sourceApprovalCaseId,
    vendorId: poRecord.vendorId,
    vendorDispatchContact: poRecord.vendorOrderContact,
    outboundDocumentSummary: "",
    attachmentSummary: poRecord.attachmentSummary,
    lineItemsSummary: `${poRecord.lineItems.length}개 라인`,
    amountSummary: poRecord.amountSummary,
    billTo: poRecord.billTo,
    shipTo: poRecord.shipTo,
    requesterContext: poRecord.requesterContext,
    departmentContext: poRecord.departmentContext,
    receivingInstruction: poRecord.receivingInstruction,
    dispatchNoteSummary: "",
    blockerSnapshot: readiness.blockers,
    warningSnapshot: readiness.warnings,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    nextDestination: "dispatch_preparation",
  };
}
