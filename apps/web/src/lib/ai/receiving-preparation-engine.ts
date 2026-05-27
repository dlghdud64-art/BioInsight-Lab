/**
 * Receiving Preparation Engine — 입고 준비 상태 모델 + expected inbound + lot/storage readiness + execution handoff
 */

import type { ReceivingPrepFromConfirmationHandoff } from "./supplier-confirmation-engine";

// ── Status ──
export type ReceivingPrepStatus = "receiving_preparation_open" | "receiving_preparation_in_progress" | "receiving_preparation_recorded";
export type ReceivingPrepSubstatus = "awaiting_inbound_window_review" | "awaiting_lot_storage_readiness" | "receiving_preparation_blocked" | "ready_for_receiving_execution";

// ── State ──
export interface ReceivingPreparationState {
  receivingPreparationStatus: ReceivingPrepStatus;
  substatus: ReceivingPrepSubstatus;
  receivingPreparationOpenedAt: string;
  supplierConfirmationObjectId: string;
  confirmedLineCoverageSummary: string;
  confirmedQtySummary: string;
  confirmedEtaWindow: string;
  partialReceivingPlanSummary: string;
  lotStorageReadiness: LotStorageReadiness;
  receivingPreparationBlockedFlag: boolean;
  receivingPreparationBlockedReason: string | null;
  receivingPreparationObjectId: string | null;
}

export interface LotStorageReadiness { lotTrackingRequired: boolean; expiryTrackingRequired: boolean; storageLocationAssigned: boolean; receivingDocReady: boolean; }

export function createInitialReceivingPreparationState(handoff: ReceivingPrepFromConfirmationHandoff): ReceivingPreparationState {
  return {
    receivingPreparationStatus: "receiving_preparation_open",
    substatus: handoff.receivingPreparationReadiness === "ready" ? "awaiting_inbound_window_review" : "receiving_preparation_blocked",
    receivingPreparationOpenedAt: new Date().toISOString(),
    supplierConfirmationObjectId: handoff.supplierConfirmationObjectId,
    confirmedLineCoverageSummary: handoff.confirmedLineCoverageSummary,
    confirmedQtySummary: handoff.confirmedQtySummary,
    confirmedEtaWindow: handoff.confirmedEtaWindow,
    partialReceivingPlanSummary: "",
    lotStorageReadiness: { lotTrackingRequired: true, expiryTrackingRequired: true, storageLocationAssigned: false, receivingDocReady: false },
    receivingPreparationBlockedFlag: handoff.receivingPreparationReadiness === "blocked",
    receivingPreparationBlockedReason: handoff.receivingPreparationReadiness === "blocked" ? "Supplier Confirmation 조건 미충족" : null,
    receivingPreparationObjectId: null,
  };
}

// ── Validator ──
export interface ReceivingPrepValidation { canRecordReceivingPreparation: boolean; canOpenReceivingExecution: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateReceivingPreparationBeforeRecord(state: ReceivingPreparationState): ReceivingPrepValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.receivingPreparationBlockedFlag) blocking.push(state.receivingPreparationBlockedReason || "차단됨");
  if (!state.confirmedQtySummary) blocking.push("확정 수량 없음");
  if (!state.confirmedEtaWindow) warnings.push("확정 납기 없음");
  if (!state.lotStorageReadiness.storageLocationAssigned) missing.push("보관 위치 미지정");
  if (!state.lotStorageReadiness.receivingDocReady) missing.push("입고 문서 미준비");
  const canRecord = blocking.length === 0;
  return { canRecordReceivingPreparation: canRecord, canOpenReceivingExecution: canRecord && warnings.length === 0, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : warnings.length > 0 ? "경고 항목 검토" : "Receiving Execution으로 보내기" };
}

// ── Canonical Object ──
export interface ReceivingPreparationObject { id: string; supplierConfirmationObjectId: string; confirmedLineCoverageSummary: string; confirmedQtySummary: string; confirmedEtaWindow: string; partialReceivingPlanSummary: string; lotStorageReadinessSummary: string; recordedAt: string; recordedBy: string; }
export function buildReceivingPreparationObject(state: ReceivingPreparationState): ReceivingPreparationObject {
  const ls = state.lotStorageReadiness;
  return { id: `rcvprep_${Date.now().toString(36)}`, supplierConfirmationObjectId: state.supplierConfirmationObjectId, confirmedLineCoverageSummary: state.confirmedLineCoverageSummary, confirmedQtySummary: state.confirmedQtySummary, confirmedEtaWindow: state.confirmedEtaWindow, partialReceivingPlanSummary: state.partialReceivingPlanSummary, lotStorageReadinessSummary: `Lot: ${ls.lotTrackingRequired ? "필요" : "불필요"}, Storage: ${ls.storageLocationAssigned ? "지정됨" : "미지정"}`, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Execution Handoff ──
export interface ReceivingExecutionHandoff { receivingPreparationObjectId: string; supplierConfirmationObjectId: string; confirmedLineCoverageSummary: string; confirmedQtySummary: string; confirmedEtaWindow: string; partialReceivingPlanSummary: string; receivingExecutionReadiness: "ready" | "pending" | "blocked"; }
export function buildReceivingExecutionHandoff(obj: ReceivingPreparationObject): ReceivingExecutionHandoff {
  return { receivingPreparationObjectId: obj.id, supplierConfirmationObjectId: obj.supplierConfirmationObjectId, confirmedLineCoverageSummary: obj.confirmedLineCoverageSummary, confirmedQtySummary: obj.confirmedQtySummary, confirmedEtaWindow: obj.confirmedEtaWindow, partialReceivingPlanSummary: obj.partialReceivingPlanSummary, receivingExecutionReadiness: "ready" };
}
