/**
 * Receiving Preparation Re-entry Engine — refreshed inbound plan + checklist recheck + receiving execution re-entry handoff
 *
 * 이 단계가 완성되면 re-entry chain → original Receiving Execution (15단계) → Intake → Stock → Reorder 무한 순환
 */

import type { ReceivingPreparationReentryHandoff } from "./supplier-confirmation-reentry-engine";

// ── Status ──
export type ReceivingPrepReentryStatus = "receiving_preparation_reentry_open" | "receiving_preparation_reentry_in_progress" | "receiving_preparation_reentry_recorded";
export type ReceivingPrepReentrySubstatus = "awaiting_refreshed_inbound_expectation_review" | "awaiting_partial_receiving_revalidation" | "awaiting_lot_expiry_storage_recheck" | "receiving_preparation_reentry_blocked" | "ready_for_receiving_execution_reentry";

// ── State ──
export interface ReceivingPreparationReentryState {
  receivingPreparationReentryStatus: ReceivingPrepReentryStatus;
  substatus: ReceivingPrepReentrySubstatus;
  receivingPreparationReentryOpenedAt: string;
  supplierConfirmationReentryObjectId: string;
  confirmedLineCount: number;
  expectedInboundWindowStatus: "confirmed" | "pending" | "changed";
  partialReceivingReentryStatus: "full" | "partial" | "split" | "pending";
  lotExpiryStorageReadinessStatus: "ready" | "pending" | "blocked";
  priorPreparationOverlapCount: number;
  documentReadinessStatus: "ready" | "pending" | "blocked";
  missingDecisionCount: number;
  receivingPreparationReentryBlockedFlag: boolean;
  receivingPreparationReentryBlockedReason: string | null;
  receivingPreparationReentryObjectId: string | null;
}

export function createInitialReceivingPrepReentryState(handoff: ReceivingPreparationReentryHandoff): ReceivingPreparationReentryState {
  const isReady = handoff.receivingPreparationReentryReadiness === "ready";
  return {
    receivingPreparationReentryStatus: "receiving_preparation_reentry_open",
    substatus: isReady ? "awaiting_refreshed_inbound_expectation_review" : "receiving_preparation_reentry_blocked",
    receivingPreparationReentryOpenedAt: new Date().toISOString(),
    supplierConfirmationReentryObjectId: handoff.supplierConfirmationReentryObjectId,
    confirmedLineCount: 0,
    expectedInboundWindowStatus: "pending",
    partialReceivingReentryStatus: "pending",
    lotExpiryStorageReadinessStatus: "pending",
    priorPreparationOverlapCount: 0,
    documentReadinessStatus: "pending",
    missingDecisionCount: 3,
    receivingPreparationReentryBlockedFlag: !isReady,
    receivingPreparationReentryBlockedReason: !isReady ? "Receiving Prep Re-entry 조건 미충족" : null,
    receivingPreparationReentryObjectId: null,
  };
}

// ── Validator ──
export interface ReceivingPrepReentryValidation { canRecordReceivingPreparationReentry: boolean; canOpenReceivingExecutionReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateReceivingPrepReentryBeforeRecord(state: ReceivingPreparationReentryState): ReceivingPrepReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.receivingPreparationReentryBlockedFlag) blocking.push(state.receivingPreparationReentryBlockedReason || "차단됨");
  if (state.expectedInboundWindowStatus === "pending") { warnings.push("Inbound window 미확인"); missing.push("Inbound 확인"); }
  if (state.lotExpiryStorageReadinessStatus === "blocked") blocking.push("Lot/Storage 준비 차단");
  if (state.lotExpiryStorageReadinessStatus === "pending") { warnings.push("Lot/Storage 미준비"); missing.push("Lot/Storage 확인"); }
  if (state.documentReadinessStatus === "pending") { warnings.push("입고 문서 미준비"); missing.push("문서 준비"); }
  if (state.priorPreparationOverlapCount > 0) warnings.push("이전 preparation overlap");
  const canRecord = blocking.length === 0;
  const canExec = canRecord && state.lotExpiryStorageReadinessStatus === "ready" && state.documentReadinessStatus === "ready";
  return { canRecordReceivingPreparationReentry: canRecord, canOpenReceivingExecutionReentry: canExec, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : canExec ? "Receiving Execution Re-entry로 보내기" : "Readiness 항목 완료 후 진행" };
}

// ── Decision Options ──
export interface ReceivingPrepReentryDecisionOptions { canRecordPreparation: boolean; canOpenReceivingExecutionReentry: boolean; canHold: boolean; canReturnSupplierConfirmReentry: boolean; decisionReasonSummary: string; }
export function buildReceivingPrepReentryDecisionOptions(state: ReceivingPreparationReentryState): ReceivingPrepReentryDecisionOptions {
  const v = validateReceivingPrepReentryBeforeRecord(state);
  return { canRecordPreparation: v.canRecordReceivingPreparationReentry, canOpenReceivingExecutionReentry: v.canOpenReceivingExecutionReentry, canHold: v.missingItems.length > 0, canReturnSupplierConfirmReentry: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface ReceivingPreparationReentryObject { id: string; supplierConfirmationReentryObjectId: string; confirmedLineCoverageSummary: string; refreshedInboundExpectationSummary: string; partialReceivingRevalidationSummary: string; lotExpiryStorageReadinessSummary: string; documentReadinessSummary: string; priorPreparationOverlapSummary: string; recordedAt: string; recordedBy: string; }
export function buildReceivingPreparationReentryObject(state: ReceivingPreparationReentryState): ReceivingPreparationReentryObject {
  return { id: `rcvprepreentry_${Date.now().toString(36)}`, supplierConfirmationReentryObjectId: state.supplierConfirmationReentryObjectId, confirmedLineCoverageSummary: `${state.confirmedLineCount}개 라인`, refreshedInboundExpectationSummary: state.expectedInboundWindowStatus, partialReceivingRevalidationSummary: state.partialReceivingReentryStatus, lotExpiryStorageReadinessSummary: state.lotExpiryStorageReadinessStatus, documentReadinessSummary: state.documentReadinessStatus, priorPreparationOverlapSummary: state.priorPreparationOverlapCount > 0 ? "충돌 있음" : "충돌 없음", recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Receiving Execution Re-entry Handoff ──
export interface ReceivingExecutionReentryHandoff { receivingPreparationReentryObjectId: string; refreshedInboundExpectationSummary: string; partialReceivingRevalidationSummary: string; lotExpiryStorageReadinessSummary: string; documentReadinessSummary: string; receivingExecutionReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildReceivingExecutionReentryHandoff(obj: ReceivingPreparationReentryObject): ReceivingExecutionReentryHandoff {
  const isReady = obj.lotExpiryStorageReadinessSummary === "ready" && obj.documentReadinessSummary === "ready";
  return { receivingPreparationReentryObjectId: obj.id, refreshedInboundExpectationSummary: obj.refreshedInboundExpectationSummary, partialReceivingRevalidationSummary: obj.partialReceivingRevalidationSummary, lotExpiryStorageReadinessSummary: obj.lotExpiryStorageReadinessSummary, documentReadinessSummary: obj.documentReadinessSummary, receivingExecutionReentryReadiness: isReady ? "ready" : "pending" };
}
