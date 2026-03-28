/**
 * PO Created Engine — PO 생성 상태 모델 + send readiness + validator + created object + dispatch handoff
 *
 * 고정 규칙:
 * 1. PO created = conversion draft를 실제 발주 객체로 확정하는 canonical gate.
 * 2. conversion draft ≠ PO created — 별도 상태로 분리.
 * 3. send-critical field 누락 시 dispatch preparation 차단.
 * 4. canonical PO created object 없이 dispatch 진행 금지.
 * 5. created 이후 분기: dispatch prep / hold / conversion return.
 */

import type { PoConversionDraftObject, PoCreatedHandoff } from "./po-conversion-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Created Status
// ══════════════════════════════════════════════════════════════════════════════

export type PoCreatedStatus =
  | "po_created_open"
  | "po_created_review_in_progress"
  | "po_created_recorded";

export type PoCreatedSubstatus =
  | "awaiting_send_readiness_review"
  | "missing_operational_completion"
  | "created_blocked"
  | "ready_for_dispatch_preparation"
  | "ready_for_supplier_send";

// ══════════════════════════════════════════════════════════════════════════════
// Created State
// ══════════════════════════════════════════════════════════════════════════════

export interface PoCreatedState {
  poCreatedStatus: PoCreatedStatus;
  substatus: PoCreatedSubstatus;
  poCreatedOpenedAt: string;
  poCreatedOpenedBy: "conversion_handoff" | "manual";
  poConversionDraftObjectId: string;
  approvalDecisionObjectId: string;
  requestSubmissionEventId: string;
  createdVendorCount: number;
  createdLineCount: number;
  createdCommercialFieldCount: number;
  createdOperationalFieldCount: number;
  missingFieldCount: number;
  poCreatedBlockedFlag: boolean;
  poCreatedBlockedReason: string | null;
  poCreatedObjectId: string | null;
  // ── Resolved basis ──
  createdBasis: PoCreatedBasis;
}

export interface PoCreatedBasis {
  vendorIds: string[];
  lineCoverageSummary: string;
  paymentTerm: string;
  billingReference: string;
  deliveryTarget: string;
  receivingInstruction: string;
  shipToReference: string;
  internalNote: string;
  supplierNote: string;
  commercialSummary: string;
  operationalSummary: string;
}

export function createInitialPoCreatedState(
  handoff: PoCreatedHandoff,
  draft: PoConversionDraftObject,
): PoCreatedState {
  const basis = resolvePoCreatedBasis(draft);
  const readiness = buildPoCreatedReadinessSummary(basis);

  return {
    poCreatedStatus: "po_created_open",
    substatus: readiness.sendCriticalMissing.length > 0 ? "missing_operational_completion" : "awaiting_send_readiness_review",
    poCreatedOpenedAt: new Date().toISOString(),
    poCreatedOpenedBy: "conversion_handoff",
    poConversionDraftObjectId: handoff.poConversionDraftObjectId,
    approvalDecisionObjectId: handoff.approvalDecisionObjectId,
    requestSubmissionEventId: draft.requestSubmissionEventId,
    createdVendorCount: handoff.approvedVendorIds.length,
    createdLineCount: handoff.approvedVendorIds.length,
    createdCommercialFieldCount: readiness.commercialFieldsFilled,
    createdOperationalFieldCount: readiness.operationalFieldsFilled,
    missingFieldCount: readiness.sendCriticalMissing.length,
    poCreatedBlockedFlag: handoff.poCreatedReadiness === "blocked",
    poCreatedBlockedReason: handoff.poCreatedReadiness === "blocked" ? "PO 생성 조건 미충족" : null,
    poCreatedObjectId: null,
    createdBasis: basis,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Basis Resolver
// ══════════════════════════════════════════════════════════════════════════════

export function resolvePoCreatedBasis(
  draft: PoConversionDraftObject,
): PoCreatedBasis {
  const fields = draft.editablePoEntryFieldValues;
  return {
    vendorIds: draft.approvedVendorIds,
    lineCoverageSummary: draft.approvedLineCoverageSummary,
    paymentTerm: fields.paymentTerm,
    billingReference: fields.billingReference,
    deliveryTarget: fields.requestedDeliveryTarget,
    receivingInstruction: fields.receivingInstruction,
    shipToReference: fields.shipToReference,
    internalNote: fields.internalPoNote,
    supplierNote: fields.supplierFacingNote,
    commercialSummary: draft.commercialCompletionSummary,
    operationalSummary: draft.operationalCompletionSummary,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Send Readiness
// ══════════════════════════════════════════════════════════════════════════════

export interface PoCreatedReadinessSummary {
  sendCriticalMissing: string[];
  nonCriticalMissing: string[];
  commercialFieldsFilled: number;
  operationalFieldsFilled: number;
  isSendReady: boolean;
}

export function buildPoCreatedReadinessSummary(
  basis: PoCreatedBasis,
): PoCreatedReadinessSummary {
  const sendCriticalMissing: string[] = [];
  const nonCriticalMissing: string[] = [];

  // Send-critical
  if (basis.vendorIds.length === 0) sendCriticalMissing.push("공급사");
  if (!basis.paymentTerm) sendCriticalMissing.push("결제 조건");
  if (!basis.shipToReference) sendCriticalMissing.push("배송지 참조");
  if (!basis.deliveryTarget) sendCriticalMissing.push("납품 요청일");
  if (!basis.receivingInstruction) sendCriticalMissing.push("입고 지시");

  // Non-critical
  if (!basis.billingReference) nonCriticalMissing.push("청구 참조");
  if (!basis.internalNote) nonCriticalMissing.push("내부 메모");
  if (!basis.supplierNote) nonCriticalMissing.push("공급사 전달 메모");

  let commercialFilled = 0;
  if (basis.paymentTerm) commercialFilled++;
  if (basis.billingReference) commercialFilled++;

  let operationalFilled = 0;
  if (basis.deliveryTarget) operationalFilled++;
  if (basis.receivingInstruction) operationalFilled++;
  if (basis.shipToReference) operationalFilled++;

  return {
    sendCriticalMissing,
    nonCriticalMissing,
    commercialFieldsFilled: commercialFilled,
    operationalFieldsFilled: operationalFilled,
    isSendReady: sendCriticalMissing.length === 0,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Validator
// ══════════════════════════════════════════════════════════════════════════════

export interface PoCreatedValidation {
  canRecordPoCreated: boolean;
  canOpenDispatchPreparation: boolean;
  blockingIssues: string[];
  warnings: string[];
  missingItems: string[];
  recommendedNextAction: string;
}

export function validatePoCreatedBeforeDispatchPrep(
  state: PoCreatedState,
): PoCreatedValidation {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const missingItems: string[] = [];

  if (!state.poConversionDraftObjectId) {
    blockingIssues.push("PO 전환 초안이 없습니다");
  }

  if (state.poCreatedBlockedFlag) {
    blockingIssues.push(state.poCreatedBlockedReason || "PO 생성이 차단되었습니다");
  }

  if (state.createdVendorCount === 0) {
    blockingIssues.push("생성 공급사가 없습니다");
  }

  const readiness = buildPoCreatedReadinessSummary(state.createdBasis);

  readiness.sendCriticalMissing.forEach((f) => {
    warnings.push(`필수 필드 누락: ${f}`);
    missingItems.push(f);
  });

  readiness.nonCriticalMissing.forEach((f) => {
    missingItems.push(`(선택) ${f}`);
  });

  const canRecord = blockingIssues.length === 0;
  const canDispatch = canRecord && readiness.isSendReady;

  return {
    canRecordPoCreated: canRecord,
    canOpenDispatchPreparation: canDispatch,
    blockingIssues,
    warnings,
    missingItems,
    recommendedNextAction: blockingIssues.length > 0
      ? "차단 사항을 먼저 해결하세요"
      : !readiness.isSendReady
        ? "필수 필드를 채우고 PO Created를 저장하세요"
        : "PO Created를 저장하고 Dispatch Preparation으로 보내세요",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Decision Options
// ══════════════════════════════════════════════════════════════════════════════

export interface PoCreatedDecisionOptions {
  canRecordCreated: boolean;
  canOpenDispatchPrep: boolean;
  canHold: boolean;
  canReturnConversion: boolean;
  decisionReasonSummary: string;
}

export function buildPoCreatedDecisionOptions(
  state: PoCreatedState,
): PoCreatedDecisionOptions {
  const validation = validatePoCreatedBeforeDispatchPrep(state);
  return {
    canRecordCreated: validation.canRecordPoCreated,
    canOpenDispatchPrep: validation.canOpenDispatchPreparation,
    canHold: validation.missingItems.length > 0 && !validation.canOpenDispatchPreparation,
    canReturnConversion: true,
    decisionReasonSummary: validation.recommendedNextAction,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical PO Created Object
// ══════════════════════════════════════════════════════════════════════════════

export interface PoCreatedObject {
  id: string;
  poConversionDraftObjectId: string;
  approvalDecisionObjectId: string;
  requestSubmissionEventId: string;
  createdVendorIds: string[];
  createdLineCoverageSummary: string;
  commercialSummary: string;
  operationalSummary: string;
  readinessSummary: string;
  recordedAt: string;
  recordedBy: string;
}

export function buildPoCreatedObject(
  state: PoCreatedState,
): PoCreatedObject {
  const readiness = buildPoCreatedReadinessSummary(state.createdBasis);
  return {
    id: `pocreated_${Date.now().toString(36)}`,
    poConversionDraftObjectId: state.poConversionDraftObjectId,
    approvalDecisionObjectId: state.approvalDecisionObjectId,
    requestSubmissionEventId: state.requestSubmissionEventId,
    createdVendorIds: state.createdBasis.vendorIds,
    createdLineCoverageSummary: state.createdBasis.lineCoverageSummary,
    commercialSummary: state.createdBasis.commercialSummary,
    operationalSummary: state.createdBasis.operationalSummary,
    readinessSummary: readiness.isSendReady ? "Dispatch 준비 완료" : `누락: ${readiness.sendCriticalMissing.join(", ")}`,
    recordedAt: new Date().toISOString(),
    recordedBy: "operator",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Dispatch Preparation Handoff
// ══════════════════════════════════════════════════════════════════════════════

export interface DispatchPreparationHandoff {
  poCreatedObjectId: string;
  poConversionDraftObjectId: string;
  approvalDecisionObjectId: string;
  createdVendorIds: string[];
  createdLineCoverageSummary: string;
  commercialSummary: string;
  operationalSummary: string;
  dispatchReadiness: "ready" | "incomplete" | "blocked";
}

export function buildDispatchPreparationHandoff(
  createdObject: PoCreatedObject,
): DispatchPreparationHandoff {
  const isReady = createdObject.readinessSummary.startsWith("Dispatch 준비 완료");
  return {
    poCreatedObjectId: createdObject.id,
    poConversionDraftObjectId: createdObject.poConversionDraftObjectId,
    approvalDecisionObjectId: createdObject.approvalDecisionObjectId,
    createdVendorIds: createdObject.createdVendorIds,
    createdLineCoverageSummary: createdObject.createdLineCoverageSummary,
    commercialSummary: createdObject.commercialSummary,
    operationalSummary: createdObject.operationalSummary,
    dispatchReadiness: isReady ? "ready" : "incomplete",
  };
}
