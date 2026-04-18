/**
 * Receiving Execution Re-entry Engine — actual rereceipt + line recapture + lot/storage recapture + inventory intake re-entry handoff
 *
 * 이 단계 완성 → Inventory Intake (16단계) → Stock Release → Reorder Decision 무한 순환
 */

import type { ReceivingExecutionReentryHandoff } from "./receiving-preparation-reentry-engine";

// ── Status ──
export type ReceivingExecReentryStatus = "receiving_execution_reentry_open" | "receiving_execution_reentry_in_progress" | "receiving_execution_reentry_recorded";
export type ReceivingExecReentrySubstatus = "awaiting_actual_rereceipt_capture" | "awaiting_line_level_rereceipt_review" | "awaiting_lot_expiry_storage_recapture" | "receiving_execution_reentry_blocked" | "ready_for_inventory_intake_reentry";

// ── State ──
export interface ReceivingExecutionReentryState {
  receivingExecutionReentryStatus: ReceivingExecReentryStatus;
  substatus: ReceivingExecReentrySubstatus;
  receivingExecutionReentryOpenedAt: string;
  receivingPreparationReentryObjectId: string;
  expectedLineCount: number;
  actualReceivedLineCount: number;
  actualRereceiptQtySummary: string;
  partialRereceiptFlag: boolean;
  priorExecutionOverlapCount: number;
  recaptureCompletenessStatus: "complete" | "partial" | "pending";
  missingDecisionCount: number;
  receivingExecutionReentryBlockedFlag: boolean;
  receivingExecutionReentryBlockedReason: string | null;
  receivingExecutionReentryObjectId: string | null;
}

export function createInitialReceivingExecReentryState(handoff: ReceivingExecutionReentryHandoff): ReceivingExecutionReentryState {
  const isReady = handoff.receivingExecutionReentryReadiness === "ready";
  return {
    receivingExecutionReentryStatus: "receiving_execution_reentry_open",
    substatus: isReady ? "awaiting_actual_rereceipt_capture" : "receiving_execution_reentry_blocked",
    receivingExecutionReentryOpenedAt: new Date().toISOString(),
    receivingPreparationReentryObjectId: handoff.receivingPreparationReentryObjectId,
    expectedLineCount: 0,
    actualReceivedLineCount: 0,
    actualRereceiptQtySummary: "",
    partialRereceiptFlag: false,
    priorExecutionOverlapCount: 0,
    recaptureCompletenessStatus: "pending",
    missingDecisionCount: 2,
    receivingExecutionReentryBlockedFlag: !isReady,
    receivingExecutionReentryBlockedReason: !isReady ? "Receiving Execution Re-entry 조건 미충족" : null,
    receivingExecutionReentryObjectId: null,
  };
}

// ── Validator ──
export interface ReceivingExecReentryValidation { canRecordReceivingExecutionReentry: boolean; canOpenInventoryIntakeReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateReceivingExecReentryBeforeRecord(state: ReceivingExecutionReentryState): ReceivingExecReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.receivingExecutionReentryBlockedFlag) blocking.push(state.receivingExecutionReentryBlockedReason || "차단됨");
  if (!state.actualRereceiptQtySummary) { warnings.push("Actual rereceipt 미기록"); missing.push("입고 기록"); }
  if (state.recaptureCompletenessStatus === "pending") { warnings.push("Lot/Storage recapture 미완료"); missing.push("Capture 완료"); }
  if (state.priorExecutionOverlapCount > 0) warnings.push("이전 execution overlap");
  const canRecord = blocking.length === 0;
  const canIntake = canRecord && state.recaptureCompletenessStatus === "complete" && !!state.actualRereceiptQtySummary;
  return { canRecordReceivingExecutionReentry: canRecord, canOpenInventoryIntakeReentry: canIntake, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : canIntake ? "Inventory Intake Re-entry로 보내기" : "입고 기록 + Capture 완료 후 진행" };
}

// ── Decision Options ──
export interface ReceivingExecReentryDecisionOptions { canRecordExecution: boolean; canOpenInventoryIntakeReentry: boolean; canHold: boolean; canReturnReceivingPrepReentry: boolean; decisionReasonSummary: string; }
export function buildReceivingExecReentryDecisionOptions(state: ReceivingExecutionReentryState): ReceivingExecReentryDecisionOptions {
  const v = validateReceivingExecReentryBeforeRecord(state);
  return { canRecordExecution: v.canRecordReceivingExecutionReentry, canOpenInventoryIntakeReentry: v.canOpenInventoryIntakeReentry, canHold: v.missingItems.length > 0, canReturnReceivingPrepReentry: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface ReceivingExecutionReentryObject { id: string; receivingPreparationReentryObjectId: string; actualRereceiptSummary: string; lineLevelRereceiptSummary: string; priorExecutionOverlapSummary: string; lotExpiryStorageRecaptureSummary: string; damageDocumentRecaptureSummary: string; recordedAt: string; recordedBy: string; }
export function buildReceivingExecutionReentryObject(state: ReceivingExecutionReentryState): ReceivingExecutionReentryObject {
  return { id: `rcvexecre_${Date.now().toString(36)}`, receivingPreparationReentryObjectId: state.receivingPreparationReentryObjectId, actualRereceiptSummary: state.actualRereceiptQtySummary || "미기록", lineLevelRereceiptSummary: `${state.actualReceivedLineCount}/${state.expectedLineCount} 라인`, priorExecutionOverlapSummary: state.priorExecutionOverlapCount > 0 ? "충돌 있음" : "충돌 없음", lotExpiryStorageRecaptureSummary: state.recaptureCompletenessStatus, damageDocumentRecaptureSummary: state.recaptureCompletenessStatus, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Inventory Intake Re-entry Handoff ──
export interface InventoryIntakeReentryHandoff { receivingExecutionReentryObjectId: string; actualRereceiptSummary: string; lineLevelRereceiptSummary: string; lotExpiryStorageRecaptureSummary: string; damageDocumentRecaptureSummary: string; inventoryIntakeReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildInventoryIntakeReentryHandoff(obj: ReceivingExecutionReentryObject): InventoryIntakeReentryHandoff {
  const isReady = obj.lotExpiryStorageRecaptureSummary === "complete" && obj.actualRereceiptSummary !== "미기록";
  return { receivingExecutionReentryObjectId: obj.id, actualRereceiptSummary: obj.actualRereceiptSummary, lineLevelRereceiptSummary: obj.lineLevelRereceiptSummary, lotExpiryStorageRecaptureSummary: obj.lotExpiryStorageRecaptureSummary, damageDocumentRecaptureSummary: obj.damageDocumentRecaptureSummary, inventoryIntakeReentryReadiness: isReady ? "ready" : "pending" };
}
