/**
 * Receiving Execution Workbench — actual receipt capture + discrepancy + lot/expiry + inventory handoff
 *
 * 고정 규칙:
 * 1. receiving execution은 preparation snapshot 기반. confirmation/request/approval 직접 재사용 금지.
 * 2. actual receipt는 canonical event. free-text memo만으로 source of truth 금지.
 * 3. expected vs actual discrepancy는 구조화된 판단. 숨기기 금지.
 * 4. lot / expiry는 optional decoration이 아니라 execution integrity 요소.
 * 5. receiving_prepared → receiving_in_progress → received_recorded 단방향.
 * 6. inventory handoff는 receiving event 기반. expected truth를 actual처럼 쓰지 말 것.
 * 7. queue badge = detail receiving execution status = rail summary. 동일 source.
 */

import type { PODetailModel, PODraftState } from "./po-created-detail";
import type { ConfirmedQtyStatus } from "./supplier-confirmation-workbench";
import type { ReceivingPreparationSnapshot } from "./receiving-preparation-workbench";

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Execution Substatus
// ══════════════════════════════════════════════════════════════════════════════

export type ReceivingExecSubstatus =
  | "awaiting_first_receipt"
  | "partial_receipt_recorded"
  | "receipt_discrepancy_detected"
  | "receipt_blocked"
  | "ready_for_inventory_intake";

export const RECEIVING_EXEC_SUBSTATUS_LABELS: Record<ReceivingExecSubstatus, string> = {
  awaiting_first_receipt: "첫 입고 대기",
  partial_receipt_recorded: "부분 입고 기록",
  receipt_discrepancy_detected: "입고 차이 감지",
  receipt_blocked: "입고 차단",
  ready_for_inventory_intake: "재고 반영 가능",
};

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Execution Tracking
// ══════════════════════════════════════════════════════════════════════════════

export interface ReceivingExecutionTracking {
  purchaseOrderId: string;

  // ── Status ──
  receivingExecutionStatus: ReceivingExecSubstatus;
  receivingStartedAt: string | null;
  receivingStartedBy: string | null;
  receivingRecordedAt: string | null;
  receivingRecordedBy: string | null;

  // ── Receipt summary ──
  receiptStatus: "none" | "partial" | "full" | "over";
  actualReceivedQtySummary: string | null;
  partialReceiptFlag: boolean;
  receiptDiscrepancyFlag: boolean;
  receiptDiscrepancySummary: string | null;

  // ── Event ref ──
  receivingEventId: string | null;

  // ── Preparation lineage ──
  receivingPreparationSnapshotId: string | null;
}

export function createInitialReceivingExecutionTracking(
  purchaseOrderId: string,
  receivingPreparationSnapshotId: string
): ReceivingExecutionTracking {
  return {
    purchaseOrderId,
    receivingExecutionStatus: "awaiting_first_receipt",
    receivingStartedAt: null,
    receivingStartedBy: null,
    receivingRecordedAt: null,
    receivingRecordedBy: null,
    receiptStatus: "none",
    actualReceivedQtySummary: null,
    partialReceiptFlag: false,
    receiptDiscrepancyFlag: false,
    receiptDiscrepancySummary: null,
    receivingEventId: null,
    receivingPreparationSnapshotId,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Start Receiving Execution (state transition)
// ══════════════════════════════════════════════════════════════════════════════

export interface StartReceivingResult {
  success: boolean;
  tracking: ReceivingExecutionTracking;
  newState: PODraftState;
  reason: string | null;
}

export function startReceivingExecution(
  detail: PODetailModel,
  tracking: ReceivingExecutionTracking,
  startedBy?: string | null
): StartReceivingResult {
  if (detail.draftState !== "receiving_prepared") {
    return {
      success: false,
      tracking,
      newState: detail.draftState,
      reason: "입고 준비 완료 상태에서만 입고 실행을 시작할 수 있습니다.",
    };
  }

  if (tracking.receivingStartedAt) {
    return {
      success: false,
      tracking,
      newState: detail.draftState,
      reason: "이미 입고 실행이 시작되었습니다.",
    };
  }

  if (!tracking.receivingPreparationSnapshotId) {
    return {
      success: false,
      tracking,
      newState: detail.draftState,
      reason: "입고 준비 기준값이 없습니다.",
    };
  }

  const now = new Date().toISOString();

  return {
    success: true,
    tracking: {
      ...tracking,
      receivingExecutionStatus: "awaiting_first_receipt",
      receivingStartedAt: now,
      receivingStartedBy: startedBy ?? null,
    },
    newState: "receiving_in_progress",
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Receiving Event (actual receipt record)
// ══════════════════════════════════════════════════════════════════════════════

export type ReceivedLineStatus = "received_full" | "received_partial" | "not_received" | "damaged" | "rejected";

export const RECEIVED_LINE_STATUS_LABELS: Record<ReceivedLineStatus, string> = {
  received_full: "전량 수령",
  received_partial: "부분 수령",
  not_received: "미수령",
  damaged: "파손",
  rejected: "반려",
};

export interface ReceivedLineRecord {
  lineId: string;
  itemId: string | null;
  itemName: string;
  expectedQty: number;
  actualReceivedQty: number;
  status: ReceivedLineStatus;
  lotNumber: string | null;
  expiryDate: string | null;
  storageCondition: string | null;
  damageNote: string | null;
  lineNote: string | null;
}

export type LotCaptureStatus = "captured" | "not_required" | "missing" | "partial";
export type ExpiryCaptureStatus = "captured" | "not_required" | "missing" | "partial";
export type StorageConditionStatus = "verified" | "not_required" | "exception" | "unchecked";

export interface ReceivingEvent {
  eventId: string;
  purchaseOrderId: string;
  receivingPreparationSnapshotId: string;

  // ── Actual receipt ──
  receivedAt: string;
  receivedBy: string | null;
  actualReceivedQtySummary: string;
  receivedLines: ReceivedLineRecord[];
  receivedLineCount: number;

  // ── Receipt flags ──
  partialReceiptFlag: boolean;
  damagedFlag: boolean;
  missingLineFlag: boolean;

  // ── Compliance capture ──
  lotCaptureStatus: LotCaptureStatus;
  expiryCaptureStatus: ExpiryCaptureStatus;
  storageConditionStatus: StorageConditionStatus;

  // ── Summary ──
  receiverSummary: string;
  evidenceRef: string | null;

  // ── Metadata ──
  recordedAt: string;
}

let _re = 0;
function reUid(): string { return `re_${Date.now()}_${++_re}`; }

// ══════════════════════════════════════════════════════════════════════════════
// Record Receiving Event
// ══════════════════════════════════════════════════════════════════════════════

export interface RecordReceivingInput {
  purchaseOrderId: string;
  receivingPreparationSnapshotId: string;
  receivedAt?: string;
  receivedBy?: string | null;
  receivedLines: ReceivedLineRecord[];
  partialReceiptFlag: boolean;
  damagedFlag?: boolean;
  lotCaptureStatus: LotCaptureStatus;
  expiryCaptureStatus: ExpiryCaptureStatus;
  storageConditionStatus: StorageConditionStatus;
  receiverSummary: string;
  evidenceRef?: string | null;
}

export interface RecordReceivingResult {
  success: boolean;
  event: ReceivingEvent | null;
  tracking: ReceivingExecutionTracking;
  reason: string | null;
}

export function recordReceivingEvent(
  detail: PODetailModel,
  tracking: ReceivingExecutionTracking,
  input: RecordReceivingInput
): RecordReceivingResult {
  // Guard: must be in progress
  if (detail.draftState !== "receiving_in_progress") {
    return {
      success: false,
      event: null,
      tracking,
      reason: "입고 진행 중 상태에서만 입고 기록을 할 수 있습니다.",
    };
  }

  // Guard: already recorded
  if (tracking.receivingEventId) {
    return {
      success: false,
      event: null,
      tracking,
      reason: "이미 입고 기록이 존재합니다.",
    };
  }

  const now = new Date().toISOString();
  const hasMissing = input.receivedLines.some(l => l.status === "not_received");
  const hasDamaged = input.receivedLines.some(l => l.status === "damaged");

  // Qty summary
  const totalExpected = input.receivedLines.reduce((s, l) => s + l.expectedQty, 0);
  const totalReceived = input.receivedLines.reduce((s, l) => s + l.actualReceivedQty, 0);
  let receiptStatus: ReceivingExecutionTracking["receiptStatus"];
  if (totalReceived === 0) receiptStatus = "none";
  else if (totalReceived < totalExpected) receiptStatus = "partial";
  else if (totalReceived === totalExpected) receiptStatus = "full";
  else receiptStatus = "over";

  const qtySummary = `${totalReceived}/${totalExpected}`;

  const event: ReceivingEvent = {
    eventId: reUid(),
    purchaseOrderId: input.purchaseOrderId,
    receivingPreparationSnapshotId: input.receivingPreparationSnapshotId,
    receivedAt: input.receivedAt ?? now,
    receivedBy: input.receivedBy ?? null,
    actualReceivedQtySummary: qtySummary,
    receivedLines: input.receivedLines,
    receivedLineCount: input.receivedLines.length,
    partialReceiptFlag: input.partialReceiptFlag,
    damagedFlag: input.damagedFlag ?? hasDamaged,
    missingLineFlag: hasMissing,
    lotCaptureStatus: input.lotCaptureStatus,
    expiryCaptureStatus: input.expiryCaptureStatus,
    storageConditionStatus: input.storageConditionStatus,
    receiverSummary: input.receiverSummary,
    evidenceRef: input.evidenceRef ?? null,
    recordedAt: now,
  };

  const updatedTracking: ReceivingExecutionTracking = {
    ...tracking,
    receivingRecordedAt: now,
    receivingRecordedBy: input.receivedBy ?? null,
    receiptStatus,
    actualReceivedQtySummary: qtySummary,
    partialReceiptFlag: input.partialReceiptFlag,
    receivingEventId: event.eventId,
  };

  return {
    success: true,
    event,
    tracking: updatedTracking,
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Expected vs Actual Discrepancy Evaluator
// ══════════════════════════════════════════════════════════════════════════════

export type ReceiptDiscrepancyType =
  | "qty_short_received"
  | "qty_over_received"
  | "partial_receipt"
  | "eta_miss_late_receipt"
  | "missing_line"
  | "damaged_item"
  | "lot_expiry_missing"
  | "storage_handling_exception";

export const RECEIPT_DISCREPANCY_TYPE_LABELS: Record<ReceiptDiscrepancyType, string> = {
  qty_short_received: "수량 부족",
  qty_over_received: "수량 초과",
  partial_receipt: "부분 입고",
  eta_miss_late_receipt: "납기 지연",
  missing_line: "품목 누락",
  damaged_item: "파손 품목",
  lot_expiry_missing: "Lot/유효기한 누락",
  storage_handling_exception: "보관 조건 예외",
};

export type ReceiptDiscrepancySeverity = "none" | "info" | "warning" | "blocking";

export interface ReceiptDiscrepancyIssue {
  type: ReceiptDiscrepancyType;
  severity: ReceiptDiscrepancySeverity;
  message: string;
  recommendedAction: string;
}

export interface ReceiptDiscrepancyEvaluation {
  hasReceiptDiscrepancy: boolean;
  blockingIssues: ReceiptDiscrepancyIssue[];
  warningIssues: ReceiptDiscrepancyIssue[];
  severityLevel: ReceiptDiscrepancySeverity;
  recommendedResolutionPath: string;
}

export interface ReceiptDiscrepancyPolicy {
  blockOnShortReceived: boolean;
  blockOnDamaged: boolean;
  blockOnMissingLine: boolean;
  blockOnLotMissing: boolean;
  blockOnExpiryMissing: boolean;
  warnOnLateLate: boolean;
}

export const DEFAULT_RECEIPT_DISCREPANCY_POLICY: ReceiptDiscrepancyPolicy = {
  blockOnShortReceived: false,
  blockOnDamaged: true,
  blockOnMissingLine: true,
  blockOnLotMissing: true,
  blockOnExpiryMissing: true,
  warnOnLateLate: true,
};

export function evaluateReceivingExecutionDiscrepancy(
  prepSnapshot: ReceivingPreparationSnapshot,
  event: ReceivingEvent,
  policy: ReceiptDiscrepancyPolicy = DEFAULT_RECEIPT_DISCREPANCY_POLICY
): ReceiptDiscrepancyEvaluation {
  const blocking: ReceiptDiscrepancyIssue[] = [];
  const warning: ReceiptDiscrepancyIssue[] = [];

  // Qty short
  if (event.partialReceiptFlag || event.receivedLines.some(l => l.actualReceivedQty < l.expectedQty)) {
    const issue: ReceiptDiscrepancyIssue = {
      type: "qty_short_received",
      severity: policy.blockOnShortReceived ? "blocking" : "warning",
      message: "입고 수량이 예정보다 부족합니다.",
      recommendedAction: "부족분 확인 및 추가 입고 일정 조율",
    };
    if (policy.blockOnShortReceived) blocking.push(issue); else warning.push(issue);
  }

  // Qty over
  if (event.receivedLines.some(l => l.actualReceivedQty > l.expectedQty)) {
    warning.push({
      type: "qty_over_received",
      severity: "warning",
      message: "입고 수량이 예정보다 많습니다.",
      recommendedAction: "초과분 확인 및 반품 또는 추가 재고 처리",
    });
  }

  // Partial receipt
  if (event.partialReceiptFlag) {
    warning.push({
      type: "partial_receipt",
      severity: "warning",
      message: "부분 입고 상태입니다.",
      recommendedAction: "잔량 입고 일정 확인",
    });
  }

  // Late receipt (compare expected date with actual)
  if (prepSnapshot.expectedReceivingDate && event.receivedAt) {
    const expected = new Date(prepSnapshot.expectedReceivingDate).getTime();
    const actual = new Date(event.receivedAt).getTime();
    if (actual > expected && policy.warnOnLateLate) {
      warning.push({
        type: "eta_miss_late_receipt",
        severity: "warning",
        message: "예정일보다 늦게 입고되었습니다.",
        recommendedAction: "납기 지연 사유 기록",
      });
    }
  }

  // Missing line
  if (event.missingLineFlag) {
    const issue: ReceiptDiscrepancyIssue = {
      type: "missing_line",
      severity: policy.blockOnMissingLine ? "blocking" : "warning",
      message: "일부 품목이 누락되었습니다.",
      recommendedAction: "누락 품목 공급사 확인 필요",
    };
    if (policy.blockOnMissingLine) blocking.push(issue); else warning.push(issue);
  }

  // Damaged
  if (event.damagedFlag) {
    const issue: ReceiptDiscrepancyIssue = {
      type: "damaged_item",
      severity: policy.blockOnDamaged ? "blocking" : "warning",
      message: "파손 품목이 있습니다.",
      recommendedAction: "파손 품목 반품/교환 처리",
    };
    if (policy.blockOnDamaged) blocking.push(issue); else warning.push(issue);
  }

  // Lot missing
  if (event.lotCaptureStatus === "missing" && policy.blockOnLotMissing) {
    blocking.push({
      type: "lot_expiry_missing",
      severity: "blocking",
      message: "Lot 번호가 기록되지 않았습니다.",
      recommendedAction: "Lot 번호 확인 후 입력",
    });
  }

  // Expiry missing
  if (event.expiryCaptureStatus === "missing" && policy.blockOnExpiryMissing) {
    blocking.push({
      type: "lot_expiry_missing",
      severity: "blocking",
      message: "유효기한이 기록되지 않았습니다.",
      recommendedAction: "유효기한 확인 후 입력",
    });
  }

  // Storage exception
  if (event.storageConditionStatus === "exception") {
    warning.push({
      type: "storage_handling_exception",
      severity: "warning",
      message: "보관 조건 예외가 발생했습니다.",
      recommendedAction: "보관 조건 확인 및 조치",
    });
  }

  let severityLevel: ReceiptDiscrepancySeverity = "none";
  if (blocking.length > 0) severityLevel = "blocking";
  else if (warning.length > 0) severityLevel = "warning";

  let recommendedResolutionPath: string;
  if (blocking.length > 0) {
    recommendedResolutionPath = `차단 항목 ${blocking.length}건 해결 필요`;
  } else if (warning.length > 0) {
    recommendedResolutionPath = `주의 항목 ${warning.length}건 확인 후 진행 가능`;
  } else {
    recommendedResolutionPath = "차이 없음 — 재고 반영 진행 가능";
  }

  return {
    hasReceiptDiscrepancy: blocking.length > 0 || warning.length > 0,
    blockingIssues: blocking,
    warningIssues: warning,
    severityLevel,
    recommendedResolutionPath,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Lot / Expiry / Storage Compliance Gate
// ══════════════════════════════════════════════════════════════════════════════

export interface ComplianceCapturePolicy {
  lotRequired: boolean;
  expiryRequired: boolean;
  storageConditionRequired: boolean;
}

export const DEFAULT_COMPLIANCE_CAPTURE_POLICY: ComplianceCapturePolicy = {
  lotRequired: true,
  expiryRequired: true,
  storageConditionRequired: false,
};

export interface ComplianceCaptureResult {
  captureComplete: boolean;
  blockingIssues: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  missingCaptureItems: string[];
}

export function validateReceivingComplianceCapture(
  event: ReceivingEvent,
  policy: ComplianceCapturePolicy = DEFAULT_COMPLIANCE_CAPTURE_POLICY
): ComplianceCaptureResult {
  const blockingIssues: { code: string; message: string }[] = [];
  const warnings: { code: string; message: string }[] = [];
  const missingItems: string[] = [];

  // Lot
  if (policy.lotRequired && event.lotCaptureStatus === "missing") {
    blockingIssues.push({ code: "lot_missing", message: "Lot 번호가 기록되지 않았습니다." });
    missingItems.push("Lot 번호");
  } else if (event.lotCaptureStatus === "partial") {
    warnings.push({ code: "lot_partial", message: "일부 품목의 Lot 번호가 누락되었습니다." });
    missingItems.push("일부 Lot 번호");
  }

  // Expiry
  if (policy.expiryRequired && event.expiryCaptureStatus === "missing") {
    blockingIssues.push({ code: "expiry_missing", message: "유효기한이 기록되지 않았습니다." });
    missingItems.push("유효기한");
  } else if (event.expiryCaptureStatus === "partial") {
    warnings.push({ code: "expiry_partial", message: "일부 품목의 유효기한이 누락되었습니다." });
    missingItems.push("일부 유효기한");
  }

  // Storage
  if (policy.storageConditionRequired && event.storageConditionStatus === "unchecked") {
    blockingIssues.push({ code: "storage_unchecked", message: "보관 조건이 확인되지 않았습니다." });
    missingItems.push("보관 조건 확인");
  } else if (event.storageConditionStatus === "exception") {
    warnings.push({ code: "storage_exception", message: "보관 조건 예외가 있습니다." });
  }

  // Line-level lot/expiry check
  for (const line of event.receivedLines) {
    if (policy.lotRequired && !line.lotNumber && line.status !== "not_received" && line.status !== "rejected") {
      blockingIssues.push({
        code: `line_lot_missing_${line.lineId}`,
        message: `${line.itemName}: Lot 번호 누락`,
      });
    }
    if (policy.expiryRequired && !line.expiryDate && line.status !== "not_received" && line.status !== "rejected") {
      blockingIssues.push({
        code: `line_expiry_missing_${line.lineId}`,
        message: `${line.itemName}: 유효기한 누락`,
      });
    }
  }

  return {
    captureComplete: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    missingCaptureItems: missingItems,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Finalize Receiving Event (state transition → received_recorded)
// ══════════════════════════════════════════════════════════════════════════════

export interface FinalizeReceivingResult {
  success: boolean;
  tracking: ReceivingExecutionTracking;
  newState: PODraftState;
  reason: string | null;
}

export function finalizeReceivingEvent(
  detail: PODetailModel,
  tracking: ReceivingExecutionTracking,
  event: ReceivingEvent,
  discrepancy: ReceiptDiscrepancyEvaluation,
  compliance: ComplianceCaptureResult
): FinalizeReceivingResult {
  // Guard: must be in progress
  if (detail.draftState !== "receiving_in_progress") {
    return {
      success: false,
      tracking,
      newState: detail.draftState,
      reason: "입고 진행 중 상태에서만 입고 기록을 완료할 수 있습니다.",
    };
  }

  // Guard: must have event
  if (!tracking.receivingEventId) {
    return {
      success: false,
      tracking,
      newState: detail.draftState,
      reason: "입고 기록이 없습니다. 먼저 입고를 기록해 주세요.",
    };
  }

  // Guard: compliance blocking
  if (!compliance.captureComplete) {
    return {
      success: false,
      tracking: {
        ...tracking,
        receivingExecutionStatus: "receipt_blocked",
      },
      newState: detail.draftState,
      reason: `필수 기록 항목 ${compliance.blockingIssues.length}건이 누락되었습니다.`,
    };
  }

  // Determine substatus
  let substatus: ReceivingExecSubstatus;
  if (discrepancy.blockingIssues.length > 0) {
    substatus = "receipt_discrepancy_detected";
  } else if (event.partialReceiptFlag) {
    substatus = "partial_receipt_recorded";
  } else {
    substatus = "ready_for_inventory_intake";
  }

  const updatedTracking: ReceivingExecutionTracking = {
    ...tracking,
    receivingExecutionStatus: substatus,
    receiptDiscrepancyFlag: discrepancy.hasReceiptDiscrepancy,
    receiptDiscrepancySummary: discrepancy.hasReceiptDiscrepancy
      ? discrepancy.recommendedResolutionPath
      : null,
  };

  return {
    success: true,
    tracking: updatedTracking,
    newState: "received_recorded",
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Inventory Intake Handoff Bundle
// ══════════════════════════════════════════════════════════════════════════════

export interface InventoryIntakeHandoff {
  handoffId: string;
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;

  // ── Source ──
  receivingEventId: string;
  receivingPreparationSnapshotId: string;

  // ── Actual values ──
  actualReceivedAt: string;
  actualReceivedQtySummary: string;
  partialReceiptFlag: boolean;
  receivedLineCount: number;

  // ── Lot / Expiry ──
  lotCaptureStatus: LotCaptureStatus;
  expiryCaptureStatus: ExpiryCaptureStatus;
  receivedLines: ReceivedLineRecord[];

  // ── Discrepancy ──
  discrepancySummary: string | null;
  hasBlockingDiscrepancy: boolean;

  // ── Inventory seed ──
  inventoryNoteSeed: string;

  // ── Lineage ──
  lineCount: number;
  currency: string;
  grandTotal: number;

  // ── Metadata ──
  preparedAt: string;
  preparedBy: string | null;
}

let _iih = 0;
function iihUid(): string { return `iih_${Date.now()}_${++_iih}`; }

export function buildInventoryIntakeHandoff(
  detail: PODetailModel,
  event: ReceivingEvent,
  discrepancy: ReceiptDiscrepancyEvaluation,
  preparedBy?: string | null
): InventoryIntakeHandoff {
  const noteParts: string[] = [];
  if (event.partialReceiptFlag) noteParts.push("부분 입고");
  if (event.damagedFlag) noteParts.push("파손 품목 있음");
  if (discrepancy.warningIssues.length > 0) noteParts.push(`주의 ${discrepancy.warningIssues.length}건`);

  return {
    handoffId: iihUid(),
    purchaseOrderId: detail.purchaseOrderId,
    vendorId: detail.supplierId,
    vendorName: detail.supplierName,
    receivingEventId: event.eventId,
    receivingPreparationSnapshotId: event.receivingPreparationSnapshotId,
    actualReceivedAt: event.receivedAt,
    actualReceivedQtySummary: event.actualReceivedQtySummary,
    partialReceiptFlag: event.partialReceiptFlag,
    receivedLineCount: event.receivedLineCount,
    lotCaptureStatus: event.lotCaptureStatus,
    expiryCaptureStatus: event.expiryCaptureStatus,
    receivedLines: event.receivedLines,
    discrepancySummary: discrepancy.hasReceiptDiscrepancy ? discrepancy.recommendedResolutionPath : null,
    hasBlockingDiscrepancy: discrepancy.blockingIssues.length > 0,
    inventoryNoteSeed: noteParts.length > 0 ? noteParts.join(" / ") : "정상 입고",
    lineCount: detail.lineCount,
    currency: detail.currency,
    grandTotal: detail.grandTotal,
    preparedAt: new Date().toISOString(),
    preparedBy: preparedBy ?? null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Execution Workbench Model (center + rail + dock)
// ══════════════════════════════════════════════════════════════════════════════

export interface ReceivingExecWorkbenchModel {
  detail: PODetailModel | null;
  tracking: ReceivingExecutionTracking | null;
  event: ReceivingEvent | null;
  discrepancy: ReceiptDiscrepancyEvaluation | null;
  compliance: ComplianceCaptureResult | null;

  isReceivingExecutionVisible: boolean;

  // ── Header ──
  execBadge: string;
  execColor: "slate" | "amber" | "emerald" | "red" | "blue";

  // ── Dock CTAs ──
  primaryAction: ReceivingExecDockAction;
  secondaryActions: ReceivingExecDockAction[];

  // ── Rail checklist ──
  checklistItems: ReceivingExecChecklistItem[];
}

export interface ReceivingExecDockAction {
  id: string;
  label: string;
  enabled: boolean;
  reason: string | null;
}

export interface ReceivingExecChecklistItem {
  label: string;
  status: "done" | "pending" | "blocked";
}

export function buildReceivingExecWorkbenchModel(input: {
  detail: PODetailModel | null;
  tracking: ReceivingExecutionTracking | null;
  event: ReceivingEvent | null;
  discrepancy: ReceiptDiscrepancyEvaluation | null;
  compliance: ComplianceCaptureResult | null;
}): ReceivingExecWorkbenchModel {
  const { detail, tracking, event, discrepancy, compliance } = input;

  const validStates: PODraftState[] = ["receiving_prepared", "receiving_in_progress", "received_recorded"];
  if (!detail || !tracking || !validStates.includes(detail.draftState)) {
    return {
      detail: null,
      tracking: null,
      event: null,
      discrepancy: null,
      compliance: null,
      isReceivingExecutionVisible: false,
      execBadge: "—",
      execColor: "slate",
      primaryAction: { id: "noop", label: "—", enabled: false, reason: null },
      secondaryActions: [],
      checklistItems: [],
    };
  }

  // Badge
  let execBadge: string;
  let execColor: ReceivingExecWorkbenchModel["execColor"];
  switch (tracking.receivingExecutionStatus) {
    case "awaiting_first_receipt":
      execBadge = "첫 입고 대기";
      execColor = "slate";
      break;
    case "partial_receipt_recorded":
      execBadge = "부분 입고 기록";
      execColor = "amber";
      break;
    case "receipt_discrepancy_detected":
      execBadge = "입고 차이 감지";
      execColor = "red";
      break;
    case "receipt_blocked":
      execBadge = "입고 차단";
      execColor = "red";
      break;
    case "ready_for_inventory_intake":
      execBadge = "재고 반영 가능";
      execColor = "emerald";
      break;
  }

  // Checklist
  const hasEvent = !!event;
  const isCompliant = compliance?.captureComplete ?? false;
  const hasNoBlockingDisc = !discrepancy || discrepancy.blockingIssues.length === 0;
  const isReady = tracking.receivingExecutionStatus === "ready_for_inventory_intake";

  const checklist: ReceivingExecChecklistItem[] = [
    { label: "입고 실행 시작", status: tracking.receivingStartedAt ? "done" : "pending" },
    { label: "입고 기록", status: hasEvent ? "done" : "pending" },
    {
      label: "Lot/유효기한 기록",
      status: isCompliant ? "done" : compliance ? "blocked" : "pending",
    },
    {
      label: "입고 차이 검토",
      status: discrepancy
        ? discrepancy.blockingIssues.length > 0
          ? "blocked"
          : "done"
        : "pending",
    },
    {
      label: "재고 반영 가능",
      status: isReady ? "done" : "pending",
    },
  ];

  // Dock actions
  let primaryAction: ReceivingExecDockAction;
  if (!tracking.receivingStartedAt) {
    primaryAction = {
      id: "start_receiving",
      label: "입고 실행 시작",
      enabled: true,
      reason: null,
    };
  } else if (!hasEvent) {
    primaryAction = {
      id: "record_receipt",
      label: "입고 기록",
      enabled: true,
      reason: null,
    };
  } else if (!isCompliant && compliance) {
    primaryAction = {
      id: "complete_compliance",
      label: "필수 기록 완성",
      enabled: true,
      reason: `누락 ${compliance.blockingIssues.length}건`,
    };
  } else if (detail.draftState === "receiving_in_progress") {
    primaryAction = {
      id: "finalize_receiving",
      label: "입고 기록 확정",
      enabled: hasEvent && isCompliant,
      reason: !hasEvent ? "입고 기록 없음" : !isCompliant ? "필수 기록 미완" : null,
    };
  } else if (isReady) {
    primaryAction = {
      id: "prepare_inventory",
      label: "재고 반영 준비",
      enabled: true,
      reason: null,
    };
  } else {
    primaryAction = {
      id: "review_discrepancy",
      label: "차이 검토",
      enabled: true,
      reason: null,
    };
  }

  const secondaryActions: ReceivingExecDockAction[] = [];

  if (hasEvent && discrepancy && discrepancy.hasReceiptDiscrepancy && primaryAction.id !== "review_discrepancy") {
    secondaryActions.push({
      id: "review_discrepancy",
      label: "입고 차이 검토",
      enabled: true,
      reason: null,
    });
  }

  if (isReady && primaryAction.id !== "prepare_inventory") {
    secondaryActions.push({
      id: "prepare_inventory",
      label: "재고 반영 준비",
      enabled: true,
      reason: null,
    });
  }

  return {
    detail,
    tracking,
    event,
    discrepancy,
    compliance,
    isReceivingExecutionVisible: true,
    execBadge,
    execColor,
    primaryAction,
    secondaryActions,
    checklistItems: checklist,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Execution Queue Row Badge
// ══════════════════════════════════════════════════════════════════════════════

export interface ReceivingExecQueueRowBadge {
  purchaseOrderId: string;
  vendorName: string;
  stateBadge: string;
  execBadge: string;
  stateColor: "slate" | "amber" | "emerald" | "red" | "blue";
  partialReceiptFlag: boolean;
  receiptDiscrepancyFlag: boolean;
  inventoryIntakeAllowed: boolean;
  nextAction: string;
}

export function buildReceivingExecQueueRowBadge(
  detail: PODetailModel,
  tracking: ReceivingExecutionTracking
): ReceivingExecQueueRowBadge {
  let stateColor: ReceivingExecQueueRowBadge["stateColor"];
  if (tracking.receivingExecutionStatus === "receipt_blocked" || tracking.receivingExecutionStatus === "receipt_discrepancy_detected") {
    stateColor = "red";
  } else if (tracking.partialReceiptFlag) {
    stateColor = "amber";
  } else if (tracking.receivingExecutionStatus === "ready_for_inventory_intake") {
    stateColor = "emerald";
  } else if (tracking.receivingEventId) {
    stateColor = "blue";
  } else {
    stateColor = "slate";
  }

  const execBadge = RECEIVING_EXEC_SUBSTATUS_LABELS[tracking.receivingExecutionStatus];

  let nextAction: string;
  if (!tracking.receivingStartedAt) {
    nextAction = "입고 실행 시작 필요";
  } else if (!tracking.receivingEventId) {
    nextAction = "입고 기록 필요";
  } else if (tracking.receivingExecutionStatus === "receipt_blocked") {
    nextAction = "필수 기록 완성 필요";
  } else if (tracking.receiptDiscrepancyFlag) {
    nextAction = "입고 차이 검토 필요";
  } else if (tracking.receivingExecutionStatus === "ready_for_inventory_intake") {
    nextAction = "재고 반영 가능";
  } else {
    nextAction = "입고 처리 진행 중";
  }

  return {
    purchaseOrderId: detail.purchaseOrderId,
    vendorName: detail.supplierName,
    stateBadge: detail.draftState === "received_recorded" ? "입고 기록 완료" : "입고 진행 중",
    execBadge,
    stateColor,
    partialReceiptFlag: tracking.partialReceiptFlag,
    receiptDiscrepancyFlag: tracking.receiptDiscrepancyFlag,
    inventoryIntakeAllowed: tracking.receivingExecutionStatus === "ready_for_inventory_intake",
    nextAction,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Execution Activity Events
// ══════════════════════════════════════════════════════════════════════════════

export type ReceivingExecActivityType =
  | "receiving_execution_started"
  | "receipt_recorded"
  | "receipt_discrepancy_flagged"
  | "compliance_capture_completed"
  | "receiving_event_finalized"
  | "inventory_intake_prepared"
  | "inventory_intake_blocked";

export interface ReceivingExecActivity {
  type: ReceivingExecActivityType;
  at: string;
  actorId: string | null;
  summary: string;
  eventId: string | null;
}

export function createReceivingExecActivity(input: {
  type: ReceivingExecActivityType;
  actorId?: string;
  summary: string;
  eventId?: string;
}): ReceivingExecActivity {
  return {
    type: input.type,
    at: new Date().toISOString(),
    actorId: input.actorId ?? null,
    summary: input.summary,
    eventId: input.eventId ?? null,
  };
}
