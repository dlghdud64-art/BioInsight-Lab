/**
 * Supplier Confirmation Engine — 공급 조건 확인 상태 모델 + confirmed terms + discrepancy + receiving handoff
 *
 * 고정 규칙:
 * 1. supplier confirmation = acknowledgment 이후 실제 공급 조건을 잠그는 canonical gate.
 * 2. acknowledgment ≠ confirmed — response가 왔다고 inbound truth가 되는 것은 아님.
 * 3. confirmed qty / ETA / MOQ / stock / substitute를 구조화해야 receiving prep 가능.
 * 4. canonical supplier confirmation object 없이 receiving prep 진입 금지.
 * 5. discrepancy가 남아있으면 receiving 차단 또는 follow-up hold.
 */

import type { SupplierConfirmationHandoff, SupplierAcknowledgmentObject } from "./po-sent-tracking-engine";

// ── Status ──
export type SupplierConfirmationStatus = "supplier_confirmation_open" | "supplier_confirmation_in_progress" | "supplier_confirmed_recorded";
export type SupplierConfirmationSubstatus = "awaiting_term_confirmation" | "awaiting_eta_confirmation" | "awaiting_qty_confirmation" | "supplier_confirmation_blocked" | "partial_confirmation_recorded" | "ready_for_receiving_preparation";

// ── Confirmation Field Status ──
export type ConfFieldStatus = "confirmed" | "partial" | "unclear" | "not_available";

// ── State ──
export interface SupplierConfirmationState {
  supplierConfirmationStatus: SupplierConfirmationStatus;
  substatus: SupplierConfirmationSubstatus;
  supplierConfirmationOpenedAt: string;
  supplierConfirmationOpenedBy: "tracking_handoff" | "manual";
  supplierAcknowledgmentObjectId: string;
  dispatchExecutionEventId: string;
  confirmedQtyStatus: ConfFieldStatus;
  confirmedEtaStatus: ConfFieldStatus;
  confirmedCommercialStatus: ConfFieldStatus;
  substituteOfferedFlag: boolean;
  uncertaintyCount: number;
  supplierConfirmationBlockedFlag: boolean;
  supplierConfirmationBlockedReason: string | null;
  supplierConfirmationObjectId: string | null;
  // ── Confirmed terms ──
  confirmedTerms: SupplierConfirmedTerms;
}

export interface SupplierConfirmedTerms {
  confirmedLineCoverage: string;
  confirmedQtySummary: string;
  confirmedEtaWindow: string;
  confirmedStockStatus: string;
  confirmedMoqStatus: string;
  substituteOfferedFlag: boolean;
  exceptionSummary: string;
}

export function createInitialSupplierConfirmationState(handoff: SupplierConfirmationHandoff): SupplierConfirmationState {
  const isReady = handoff.supplierConfirmationReadiness === "ready";
  return {
    supplierConfirmationStatus: "supplier_confirmation_open",
    substatus: isReady ? "awaiting_term_confirmation" : "supplier_confirmation_blocked",
    supplierConfirmationOpenedAt: new Date().toISOString(),
    supplierConfirmationOpenedBy: "tracking_handoff",
    supplierAcknowledgmentObjectId: handoff.supplierAcknowledgmentObjectId,
    dispatchExecutionEventId: handoff.dispatchExecutionEventId,
    confirmedQtyStatus: "unclear",
    confirmedEtaStatus: "unclear",
    confirmedCommercialStatus: "unclear",
    substituteOfferedFlag: false,
    uncertaintyCount: 3,
    supplierConfirmationBlockedFlag: !isReady,
    supplierConfirmationBlockedReason: !isReady ? "Acknowledgment 상태 미충족" : null,
    supplierConfirmationObjectId: null,
    confirmedTerms: {
      confirmedLineCoverage: "",
      confirmedQtySummary: "",
      confirmedEtaWindow: "",
      confirmedStockStatus: "",
      confirmedMoqStatus: "",
      substituteOfferedFlag: false,
      exceptionSummary: "",
    },
  };
}

// ── Discrepancy Evaluator ──
export interface ConfirmationDiscrepancy {
  hasCriticalDiscrepancy: boolean;
  hasResolvableUncertainty: boolean;
  blockingIssues: string[];
  warnings: string[];
  followupRequired: boolean;
  recommendedNextAction: string;
}

export function evaluateSupplierConfirmationDiscrepancy(state: SupplierConfirmationState): ConfirmationDiscrepancy {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (state.confirmedQtyStatus === "not_available") blocking.push("수량 확인 불가");
  if (state.confirmedEtaStatus === "not_available") blocking.push("납기 확인 불가");
  if (state.confirmedQtyStatus === "partial") warnings.push("부분 수량만 확인됨");
  if (state.confirmedEtaStatus === "unclear") warnings.push("납기 불확실");
  if (state.confirmedCommercialStatus === "unclear") warnings.push("상업 조건 미확정");
  if (state.substituteOfferedFlag) warnings.push("대체품 제안 — 검토 필요");
  const hasCritical = blocking.length > 0;
  const followup = state.confirmedQtyStatus === "unclear" || state.confirmedEtaStatus === "unclear";
  return { hasCriticalDiscrepancy: hasCritical, hasResolvableUncertainty: warnings.length > 0, blockingIssues: blocking, warnings, followupRequired: followup, recommendedNextAction: hasCritical ? "차단 사항 해결" : followup ? "Follow-up 후 확인" : "Supplier Confirmation 저장" };
}

// ── Validator ──
export interface SupplierConfirmationValidation {
  canRecordSupplierConfirmation: boolean;
  canOpenReceivingPreparation: boolean;
  blockingIssues: string[];
  warnings: string[];
  missingItems: string[];
  recommendedNextAction: string;
}

export function validateSupplierConfirmationBeforeRecord(state: SupplierConfirmationState): SupplierConfirmationValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.supplierConfirmationBlockedFlag) blocking.push(state.supplierConfirmationBlockedReason || "차단됨");
  if (!state.supplierAcknowledgmentObjectId) blocking.push("Acknowledgment 없음");
  const disc = evaluateSupplierConfirmationDiscrepancy(state);
  disc.blockingIssues.forEach(b => blocking.push(b));
  disc.warnings.forEach(w => warnings.push(w));
  if (state.confirmedQtyStatus === "unclear") missing.push("수량 확인");
  if (state.confirmedEtaStatus === "unclear") missing.push("납기 확인");
  const canRecord = blocking.length === 0;
  const canReceiving = canRecord && state.confirmedQtyStatus === "confirmed" && state.confirmedEtaStatus === "confirmed";
  return { canRecordSupplierConfirmation: canRecord, canOpenReceivingPreparation: canReceiving, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : !canReceiving ? "수량·납기 확인 완료 후 진행" : "Receiving Preparation으로 보내기" };
}

// ── Decision Options ──
export interface SupplierConfirmationDecisionOptions { canRecordConfirmation: boolean; canOpenReceivingPreparation: boolean; canHold: boolean; canReturnSentTracking: boolean; decisionReasonSummary: string; }
export function buildSupplierConfirmationDecisionOptions(state: SupplierConfirmationState): SupplierConfirmationDecisionOptions {
  const v = validateSupplierConfirmationBeforeRecord(state);
  return { canRecordConfirmation: v.canRecordSupplierConfirmation, canOpenReceivingPreparation: v.canOpenReceivingPreparation, canHold: v.missingItems.length > 0, canReturnSentTracking: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Supplier Confirmation Object ──
export interface SupplierConfirmationObject {
  id: string;
  supplierAcknowledgmentObjectId: string;
  dispatchExecutionEventId: string;
  confirmedLineCoverageSummary: string;
  confirmedQtySummary: string;
  confirmedEtaWindow: string;
  confirmedCommercialSummary: string;
  discrepancySummary: string;
  recordedAt: string;
  recordedBy: string;
}

export function buildSupplierConfirmationObject(state: SupplierConfirmationState): SupplierConfirmationObject {
  const disc = evaluateSupplierConfirmationDiscrepancy(state);
  return {
    id: `sconf_${Date.now().toString(36)}`,
    supplierAcknowledgmentObjectId: state.supplierAcknowledgmentObjectId,
    dispatchExecutionEventId: state.dispatchExecutionEventId,
    confirmedLineCoverageSummary: state.confirmedTerms.confirmedLineCoverage || "미확인",
    confirmedQtySummary: state.confirmedTerms.confirmedQtySummary || "미확인",
    confirmedEtaWindow: state.confirmedTerms.confirmedEtaWindow || "미확인",
    confirmedCommercialSummary: `Qty: ${state.confirmedQtyStatus}, ETA: ${state.confirmedEtaStatus}, Commercial: ${state.confirmedCommercialStatus}`,
    discrepancySummary: disc.blockingIssues.length > 0 ? disc.blockingIssues.join("; ") : disc.warnings.length > 0 ? disc.warnings.join("; ") : "차이 없음",
    recordedAt: new Date().toISOString(),
    recordedBy: "operator",
  };
}

// ── Receiving Preparation Handoff ──
export interface ReceivingPrepFromConfirmationHandoff {
  supplierConfirmationObjectId: string;
  supplierAcknowledgmentObjectId: string;
  dispatchExecutionEventId: string;
  confirmedLineCoverageSummary: string;
  confirmedQtySummary: string;
  confirmedEtaWindow: string;
  receivingPreparationReadiness: "ready" | "pending" | "blocked";
}

export function buildReceivingPrepHandoff(obj: SupplierConfirmationObject, canReceive: boolean): ReceivingPrepFromConfirmationHandoff {
  return {
    supplierConfirmationObjectId: obj.id,
    supplierAcknowledgmentObjectId: obj.supplierAcknowledgmentObjectId,
    dispatchExecutionEventId: obj.dispatchExecutionEventId,
    confirmedLineCoverageSummary: obj.confirmedLineCoverageSummary,
    confirmedQtySummary: obj.confirmedQtySummary,
    confirmedEtaWindow: obj.confirmedEtaWindow,
    receivingPreparationReadiness: canReceive ? "ready" : "pending",
  };
}
