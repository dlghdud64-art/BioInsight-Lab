/**
 * Receiving Execution Engine — 입고 실행 상태 모델 + line capture + lot/expiry/storage + discrepancy + inventory handoff
 *
 * 고정 규칙:
 * 1. receiving execution = actual receipt를 기록하고 잠그는 canonical gate.
 * 2. preparation ≠ execution — expected와 actual은 다른 canonical truth.
 * 3. line-level receipt capture + lot/expiry/storage/damage capture 필수.
 * 4. canonical receiving execution object 없이 inventory intake 진입 금지.
 * 5. discrepancy가 남아있으면 inventory intake 차단 또는 hold.
 */

import type { ReceivingExecutionHandoff, ReceivingPreparationObject } from "./receiving-preparation-engine";

// ── Status ──
export type ReceivingExecutionStatus = "receiving_execution_open" | "receiving_execution_in_progress" | "receiving_execution_recorded";
export type ReceivingExecutionSubstatus = "awaiting_actual_receipt_capture" | "awaiting_line_level_receipt_review" | "awaiting_lot_expiry_storage_capture" | "receiving_execution_blocked" | "partial_receipt_recorded" | "ready_for_inventory_intake";

// ── Line Receipt State ──
export type LineReceiptStatus = "full" | "partial" | "short" | "over" | "missing" | "damaged" | "mismatch";

export interface LineReceiptCapture {
  lineId: string;
  expectedQty: number;
  receivedQty: number;
  receiptStatus: LineReceiptStatus;
  shortFlag: boolean;
  overFlag: boolean;
  missingFlag: boolean;
  damagedFlag: boolean;
  substituteFlag: boolean;
  lineNote: string;
}

// ── Lot/Expiry/Storage Capture ──
export type CaptureStatus = "captured" | "pending" | "not_required" | "blocked";

export interface ReceivingCaptureChecklist {
  lotCaptureStatus: CaptureStatus;
  lotNumber: string;
  expiryCaptureStatus: CaptureStatus;
  expiryDate: string;
  storageCaptureStatus: CaptureStatus;
  storageLocation: string;
  receivingDocStatus: CaptureStatus;
  receivingDocReference: string;
  damageCaptureStatus: CaptureStatus;
  damageNote: string;
  quarantineFlag: boolean;
}

// ── State ──
export interface ReceivingExecutionState {
  receivingExecutionStatus: ReceivingExecutionStatus;
  substatus: ReceivingExecutionSubstatus;
  receivingExecutionOpenedAt: string;
  receivingExecutionOpenedBy: "preparation_handoff" | "manual";
  receivingPreparationObjectId: string;
  expectedLineCount: number;
  receivedLineCount: number;
  actualReceivedQtySummary: string;
  actualReceiptTimestamp: string | null;
  partialReceiptFlag: boolean;
  receiptDiscrepancyCount: number;
  missingCaptureCount: number;
  receivingExecutionBlockedFlag: boolean;
  receivingExecutionBlockedReason: string | null;
  receivingExecutionObjectId: string | null;
  // ── Captures ──
  lineReceipts: LineReceiptCapture[];
  captureChecklist: ReceivingCaptureChecklist;
}

export function createInitialReceivingExecutionState(handoff: ReceivingExecutionHandoff): ReceivingExecutionState {
  return {
    receivingExecutionStatus: "receiving_execution_open",
    substatus: "awaiting_actual_receipt_capture",
    receivingExecutionOpenedAt: new Date().toISOString(),
    receivingExecutionOpenedBy: "preparation_handoff",
    receivingPreparationObjectId: handoff.receivingPreparationObjectId,
    expectedLineCount: 0,
    receivedLineCount: 0,
    actualReceivedQtySummary: "",
    actualReceiptTimestamp: null,
    partialReceiptFlag: false,
    receiptDiscrepancyCount: 0,
    missingCaptureCount: 0,
    receivingExecutionBlockedFlag: handoff.receivingExecutionReadiness === "blocked",
    receivingExecutionBlockedReason: handoff.receivingExecutionReadiness === "blocked" ? "입고 실행 조건 미충족" : null,
    receivingExecutionObjectId: null,
    lineReceipts: [],
    captureChecklist: {
      lotCaptureStatus: "pending", lotNumber: "",
      expiryCaptureStatus: "pending", expiryDate: "",
      storageCaptureStatus: "pending", storageLocation: "",
      receivingDocStatus: "pending", receivingDocReference: "",
      damageCaptureStatus: "pending", damageNote: "",
      quarantineFlag: false,
    },
  };
}

// ── Discrepancy Evaluator ──
export interface ReceiptDiscrepancy {
  hasCriticalReceiptDiscrepancy: boolean;
  hasResolvableReceiptIssue: boolean;
  blockingIssues: string[];
  warnings: string[];
  holdRequired: boolean;
  recommendedNextAction: string;
}

export function evaluateReceivingExecutionDiscrepancy(state: ReceivingExecutionState): ReceiptDiscrepancy {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const damaged = state.lineReceipts.filter(l => l.damagedFlag);
  const missing = state.lineReceipts.filter(l => l.missingFlag);
  const short = state.lineReceipts.filter(l => l.shortFlag);
  const over = state.lineReceipts.filter(l => l.overFlag);
  if (damaged.length > 0) blocking.push(`${damaged.length}개 라인 손상`);
  if (missing.length > 0) blocking.push(`${missing.length}개 라인 누락`);
  if (short.length > 0) warnings.push(`${short.length}개 라인 부족 수량`);
  if (over.length > 0) warnings.push(`${over.length}개 라인 초과 수량`);
  if (state.captureChecklist.quarantineFlag) blocking.push("검역 대상");
  if (!state.actualReceiptTimestamp) blocking.push("입고 시점 미기록");
  return { hasCriticalReceiptDiscrepancy: blocking.length > 0, hasResolvableReceiptIssue: warnings.length > 0, blockingIssues: blocking, warnings, holdRequired: blocking.length > 0, recommendedNextAction: blocking.length > 0 ? "입고 이슈 해결" : warnings.length > 0 ? "경고 항목 검토 후 저장" : "Receiving Execution 저장" };
}

// ── Capture Checklist Evaluator ──
export function evaluateReceivingCaptureChecklist(state: ReceivingExecutionState): { blockingIssues: string[]; warnings: string[]; allCaptured: boolean } {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const cl = state.captureChecklist;
  if (cl.lotCaptureStatus === "pending") warnings.push("Lot 미기록");
  if (cl.expiryCaptureStatus === "pending") warnings.push("유효기한 미기록");
  if (cl.storageCaptureStatus === "pending") warnings.push("보관 위치 미기록");
  if (cl.receivingDocStatus === "pending") warnings.push("입고 문서 미기록");
  if (cl.damageCaptureStatus === "blocked") blocking.push("손상 기록 필요");
  const allCaptured = [cl.lotCaptureStatus, cl.expiryCaptureStatus, cl.storageCaptureStatus, cl.receivingDocStatus].every(s => s === "captured" || s === "not_required");
  return { blockingIssues: blocking, warnings, allCaptured };
}

// ── Validator ──
export interface ReceivingExecutionValidation {
  canRecordReceivingExecution: boolean;
  canOpenInventoryIntake: boolean;
  blockingIssues: string[];
  warnings: string[];
  missingItems: string[];
  recommendedNextAction: string;
}

export function validateReceivingExecutionBeforeRecord(state: ReceivingExecutionState): ReceivingExecutionValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.receivingExecutionBlockedFlag) blocking.push(state.receivingExecutionBlockedReason || "차단됨");
  if (!state.actualReceiptTimestamp) blocking.push("입고 시점 미기록");
  if (state.lineReceipts.length === 0) blocking.push("라인별 입고 기록 없음");
  const disc = evaluateReceivingExecutionDiscrepancy(state);
  disc.blockingIssues.forEach(b => blocking.push(b));
  disc.warnings.forEach(w => warnings.push(w));
  const capture = evaluateReceivingCaptureChecklist(state);
  capture.blockingIssues.forEach(b => blocking.push(b));
  capture.warnings.forEach(w => { warnings.push(w); missing.push(w); });
  const canRecord = blocking.length === 0;
  const canInventory = canRecord && capture.allCaptured;
  return { canRecordReceivingExecution: canRecord, canOpenInventoryIntake: canInventory, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : !canInventory ? "캡처 항목 완료 후 진행" : "Inventory Intake로 보내기" };
}

// ── Decision Options ──
export interface ReceivingExecutionDecisionOptions { canRecordExecution: boolean; canOpenInventoryIntake: boolean; canHold: boolean; canReturnPreparation: boolean; decisionReasonSummary: string; }
export function buildReceivingExecutionDecisionOptions(state: ReceivingExecutionState): ReceivingExecutionDecisionOptions {
  const v = validateReceivingExecutionBeforeRecord(state);
  return { canRecordExecution: v.canRecordReceivingExecution, canOpenInventoryIntake: v.canOpenInventoryIntake, canHold: v.missingItems.length > 0, canReturnPreparation: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Receiving Execution Object ──
export interface ReceivingExecutionObject {
  id: string;
  receivingPreparationObjectId: string;
  actualReceivedQtySummary: string;
  actualReceiptTimestamp: string;
  lineReceiptSummary: string;
  receiptDiscrepancySummary: string;
  receivingCaptureSummary: string;
  recordedAt: string;
  recordedBy: string;
}

export function buildReceivingExecutionObject(state: ReceivingExecutionState): ReceivingExecutionObject {
  const disc = evaluateReceivingExecutionDiscrepancy(state);
  const full = state.lineReceipts.filter(l => l.receiptStatus === "full").length;
  const partial = state.lineReceipts.filter(l => l.receiptStatus === "partial").length;
  return {
    id: `rcvexec_${Date.now().toString(36)}`,
    receivingPreparationObjectId: state.receivingPreparationObjectId,
    actualReceivedQtySummary: state.actualReceivedQtySummary || `${state.lineReceipts.length}개 라인`,
    actualReceiptTimestamp: state.actualReceiptTimestamp || new Date().toISOString(),
    lineReceiptSummary: `전량 ${full}, 부분 ${partial}, 총 ${state.lineReceipts.length}`,
    receiptDiscrepancySummary: disc.blockingIssues.length > 0 ? disc.blockingIssues.join("; ") : disc.warnings.length > 0 ? disc.warnings.join("; ") : "차이 없음",
    receivingCaptureSummary: `Lot: ${state.captureChecklist.lotCaptureStatus}, Expiry: ${state.captureChecklist.expiryCaptureStatus}, Storage: ${state.captureChecklist.storageCaptureStatus}`,
    recordedAt: new Date().toISOString(),
    recordedBy: "operator",
  };
}

// ── Inventory Intake Handoff ──
export interface InventoryIntakeHandoff {
  receivingExecutionObjectId: string;
  receivingPreparationObjectId: string;
  actualReceivedQtySummary: string;
  actualReceiptTimestamp: string;
  lineReceiptSummary: string;
  receiptDiscrepancySummary: string;
  inventoryIntakeReadiness: "ready" | "pending" | "blocked";
}

export function buildInventoryIntakeHandoff(obj: ReceivingExecutionObject, canIntake: boolean): InventoryIntakeHandoff {
  return {
    receivingExecutionObjectId: obj.id,
    receivingPreparationObjectId: obj.receivingPreparationObjectId,
    actualReceivedQtySummary: obj.actualReceivedQtySummary,
    actualReceiptTimestamp: obj.actualReceiptTimestamp,
    lineReceiptSummary: obj.lineReceiptSummary,
    receiptDiscrepancySummary: obj.receiptDiscrepancySummary,
    inventoryIntakeReadiness: canIntake ? "ready" : "pending",
  };
}
