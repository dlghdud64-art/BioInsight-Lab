/**
 * Supplier Confirmation Re-entry Engine — confirmed terms recheck + prior confirmation overlap + receiving prep re-entry handoff
 *
 * 이 단계가 완성되면 re-entry chain이 original Receiving Preparation (14단계)으로 복귀하여
 * Receiving Execution → Inventory Intake → Stock Release → Reorder Decision 전체 cycle이 무한 순환합니다.
 */

import type { SupplierConfirmationReentryHandoff } from "./po-sent-reentry-tracking-engine";

// ── Status ──
export type SupplierConfirmationReentryStatus = "supplier_confirmation_reentry_open" | "supplier_confirmation_reentry_in_progress" | "supplier_confirmation_reentry_recorded";
export type SupplierConfirmationReentrySubstatus = "awaiting_confirmed_qty_recheck" | "awaiting_confirmed_eta_recheck" | "awaiting_commercial_term_recheck" | "supplier_confirmation_reentry_blocked" | "ready_for_receiving_preparation_reentry";

export type ConfReentryFieldStatus = "confirmed" | "partial" | "unclear" | "not_available";

// ── State ──
export interface SupplierConfirmationReentryState {
  supplierConfirmationReentryStatus: SupplierConfirmationReentryStatus;
  substatus: SupplierConfirmationReentrySubstatus;
  supplierConfirmationReentryOpenedAt: string;
  supplierAcknowledgmentReentryObjectId: string;
  confirmedQtyReentryStatus: ConfReentryFieldStatus;
  confirmedEtaReentryStatus: ConfReentryFieldStatus;
  confirmedCommercialReentryStatus: ConfReentryFieldStatus;
  substituteReentryFlag: boolean;
  priorConfirmationOverlapCount: number;
  clarificationOpenCount: number;
  missingDecisionCount: number;
  supplierConfirmationReentryBlockedFlag: boolean;
  supplierConfirmationReentryBlockedReason: string | null;
  supplierConfirmationReentryObjectId: string | null;
}

export function createInitialSupplierConfirmationReentryState(handoff: SupplierConfirmationReentryHandoff): SupplierConfirmationReentryState {
  const isReady = handoff.supplierConfirmationReentryReadiness === "ready";
  return {
    supplierConfirmationReentryStatus: "supplier_confirmation_reentry_open",
    substatus: isReady ? "awaiting_confirmed_qty_recheck" : "supplier_confirmation_reentry_blocked",
    supplierConfirmationReentryOpenedAt: new Date().toISOString(),
    supplierAcknowledgmentReentryObjectId: handoff.supplierAcknowledgmentReentryObjectId,
    confirmedQtyReentryStatus: "unclear",
    confirmedEtaReentryStatus: "unclear",
    confirmedCommercialReentryStatus: "unclear",
    substituteReentryFlag: false,
    priorConfirmationOverlapCount: 0,
    clarificationOpenCount: handoff.clarificationRequiredSummary.includes("필요") ? 1 : 0,
    missingDecisionCount: 3,
    supplierConfirmationReentryBlockedFlag: !isReady,
    supplierConfirmationReentryBlockedReason: !isReady ? "Confirmation Re-entry 조건 미충족" : null,
    supplierConfirmationReentryObjectId: null,
  };
}

// ── Validator ──
export interface SupplierConfirmationReentryValidation { canRecordSupplierConfirmationReentry: boolean; canOpenReceivingPreparationReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateSupplierConfirmationReentryBeforeRecord(state: SupplierConfirmationReentryState): SupplierConfirmationReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.supplierConfirmationReentryBlockedFlag) blocking.push(state.supplierConfirmationReentryBlockedReason || "차단됨");
  if (state.confirmedQtyReentryStatus === "not_available") blocking.push("수량 확인 불가");
  if (state.confirmedEtaReentryStatus === "not_available") blocking.push("납기 확인 불가");
  if (state.confirmedQtyReentryStatus === "unclear") { warnings.push("수량 미확인"); missing.push("수량 확인"); }
  if (state.confirmedEtaReentryStatus === "unclear") { warnings.push("납기 미확인"); missing.push("납기 확인"); }
  if (state.confirmedCommercialReentryStatus === "unclear") { warnings.push("상업 조건 미확인"); missing.push("상업 조건 확인"); }
  if (state.clarificationOpenCount > 0) warnings.push(`${state.clarificationOpenCount}개 clarification 미해결`);
  if (state.priorConfirmationOverlapCount > 0) warnings.push("이전 confirmation overlap");
  const canRecord = blocking.length === 0;
  const canReceiving = canRecord && state.confirmedQtyReentryStatus === "confirmed" && state.confirmedEtaReentryStatus === "confirmed";
  return { canRecordSupplierConfirmationReentry: canRecord, canOpenReceivingPreparationReentry: canReceiving, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : canReceiving ? "Receiving Preparation Re-entry로 보내기" : "수량·납기 확인 완료 후 진행" };
}

// ── Decision Options ──
export interface SupplierConfirmationReentryDecisionOptions { canRecordConfirmation: boolean; canOpenReceivingPreparationReentry: boolean; canHold: boolean; canReturnSentTrackingReentry: boolean; decisionReasonSummary: string; }
export function buildSupplierConfirmationReentryDecisionOptions(state: SupplierConfirmationReentryState): SupplierConfirmationReentryDecisionOptions {
  const v = validateSupplierConfirmationReentryBeforeRecord(state);
  return { canRecordConfirmation: v.canRecordSupplierConfirmationReentry, canOpenReceivingPreparationReentry: v.canOpenReceivingPreparationReentry, canHold: v.missingItems.length > 0, canReturnSentTrackingReentry: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface SupplierConfirmationReentryObject { id: string; supplierAcknowledgmentReentryObjectId: string; priorConfirmationReconciliationSummary: string; confirmedLineCoverageSummary: string; confirmedQtyReentrySummary: string; confirmedEtaWindowSummary: string; confirmedCommercialReentrySummary: string; discrepancyReentrySummary: string; clarificationSummary: string; recordedAt: string; recordedBy: string; }
export function buildSupplierConfirmationReentryObject(state: SupplierConfirmationReentryState): SupplierConfirmationReentryObject {
  return { id: `sconfre_${Date.now().toString(36)}`, supplierAcknowledgmentReentryObjectId: state.supplierAcknowledgmentReentryObjectId, priorConfirmationReconciliationSummary: state.priorConfirmationOverlapCount > 0 ? "이전 confirmation overlap 있음" : "충돌 없음", confirmedLineCoverageSummary: "재확인 완료", confirmedQtyReentrySummary: state.confirmedQtyReentryStatus, confirmedEtaWindowSummary: state.confirmedEtaReentryStatus, confirmedCommercialReentrySummary: `Qty: ${state.confirmedQtyReentryStatus}, ETA: ${state.confirmedEtaReentryStatus}, Commercial: ${state.confirmedCommercialReentryStatus}`, discrepancyReentrySummary: state.clarificationOpenCount > 0 ? `${state.clarificationOpenCount}개 미해결` : "차이 없음", clarificationSummary: state.clarificationOpenCount > 0 ? "Clarification 미해결" : "해결됨", recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Receiving Preparation Re-entry Handoff ──
export interface ReceivingPreparationReentryHandoff { supplierConfirmationReentryObjectId: string; confirmedLineCoverageSummary: string; confirmedQtyReentrySummary: string; confirmedEtaWindowSummary: string; confirmedCommercialReentrySummary: string; receivingPreparationReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildReceivingPreparationReentryHandoff(obj: SupplierConfirmationReentryObject): ReceivingPreparationReentryHandoff {
  const isReady = obj.confirmedQtyReentrySummary === "confirmed" && obj.confirmedEtaWindowSummary === "confirmed";
  return { supplierConfirmationReentryObjectId: obj.id, confirmedLineCoverageSummary: obj.confirmedLineCoverageSummary, confirmedQtyReentrySummary: obj.confirmedQtyReentrySummary, confirmedEtaWindowSummary: obj.confirmedEtaWindowSummary, confirmedCommercialReentrySummary: obj.confirmedCommercialReentrySummary, receivingPreparationReentryReadiness: isReady ? "ready" : "pending" };
}
