/**
 * Receiving Execution Workbench Engine — actual receipt capture + discrepancy/quarantine routing + execution record
 *
 * 고정 규칙:
 * 1. receivingExecutionCase = 단일 입력 source.
 * 2. ready_for_execution ≠ received. actual receipt capture 이후에만 received 전이.
 * 3. clean/partial/discrepancy/quarantine/failed 구조적 분리.
 * 4. mandatory capture rule 누락 시 receipt confirm 금지.
 * 5. canonical receivingExecutionRecord = actual receipt truth.
 * 6. downstream: stockReleaseGateCase / receivingDiscrepancyCase / receivingQuarantineCase 분기.
 * 7. stock / available inventory / reorder 직접 점프 금지.
 */

import type { ReceivingExecutionCase, IntakeExceptionFlag } from "./receiving-intake-workbench-engine";

// ── Execution Case Status ──
export type ExecutionCaseStatus = "queued" | "in_execution" | "on_hold" | "partially_received" | "fully_received" | "failed" | "cancelled";
export type ExecutionReadinessStatus = "blocked" | "warning" | "ready";

// ── Line Receipt Status ──
export type LineReceiptStatus = "pending_capture" | "captured_clean" | "captured_with_discrepancy" | "quarantined" | "not_received";

// ── Line Receipt Capture ──
export interface LineReceiptCapture {
  lineId: string;
  expectedQty: number;
  actualReceivedQty: number;
  receivedUnit: string;
  lotNumber: string;
  expiryDate: string;
  serialNumber: string;
  temperatureCheckResult: string;
  damageFlag: boolean;
  discrepancyFlag: boolean;
  quarantineFlag: boolean;
  receivingNote: string;
  docVerificationStatus: "verified" | "pending" | "failed" | "not_required";
  lineReceiptStatus: LineReceiptStatus;
}

// ── Execution Decision ──
export interface ReceivingExecutionDecision {
  lineCaptures: LineReceiptCapture[];
  overallReceivingNote: string;
  discrepancyResolutionPath: string;
  quarantineResolutionPath: string;
}

// ── State ──
export interface ReceivingExecutionWorkbenchState {
  caseStatus: ExecutionCaseStatus;
  executionReadiness: ExecutionReadinessStatus;
  receivingExecutionCaseId: string;
  poRecordId: string;
  vendorId: string;
  sourceAckRecordId: string;
  sourceIntakeCaseId: string;
  eligibleLineScope: string;
  expectedInboundQty: string;
  receivingLocation: string;
  partialReceiptAllowed: boolean;
  lotCaptureRequired: boolean;
  expiryCaptureRequired: boolean;
  serialCaptureRequired: boolean;
  temperatureCheckRequired: boolean;
  damageCheckRequired: boolean;
  quarantineCandidate: boolean;
  decision: ReceivingExecutionDecision | null;
  blockerCount: number;
  warningCount: number;
  executionRecordId: string | null;
  stockReleaseGateCaseId: string | null;
  discrepancyCaseId: string | null;
  quarantineCaseId: string | null;
}

export function createInitialReceivingExecutionWorkbenchState(execCase: ReceivingExecutionCase): ReceivingExecutionWorkbenchState {
  return {
    caseStatus: "in_execution",
    executionReadiness: "blocked",
    receivingExecutionCaseId: execCase.id,
    poRecordId: execCase.sourcePoRecordId,
    vendorId: execCase.vendorId,
    sourceAckRecordId: execCase.sourceSupplierAckRecordId,
    sourceIntakeCaseId: execCase.sourceReceivingIntakeCaseId,
    eligibleLineScope: execCase.eligibleLineScope,
    expectedInboundQty: execCase.expectedInboundQtySummary,
    receivingLocation: execCase.receivingLocation,
    partialReceiptAllowed: execCase.partialReceiptAllowed,
    lotCaptureRequired: execCase.lotCaptureRequired,
    expiryCaptureRequired: execCase.expiryCaptureRequired,
    serialCaptureRequired: execCase.serialCaptureRequired,
    temperatureCheckRequired: execCase.temperatureCheckRequired,
    damageCheckRequired: execCase.damageCheckRequired,
    quarantineCandidate: execCase.quarantineCandidate,
    decision: null,
    blockerCount: 1,
    warningCount: 0,
    executionRecordId: null,
    stockReleaseGateCaseId: null,
    discrepancyCaseId: null,
    quarantineCaseId: null,
  };
}

// ── Execution Readiness Evaluation ──
export interface ExecutionReadinessResult {
  status: ExecutionReadinessStatus;
  blockers: string[];
  warnings: string[];
  canConfirm: boolean;
}

export function evaluateExecutionReadiness(state: ReceivingExecutionWorkbenchState): ExecutionReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.receivingExecutionCaseId) blockers.push("Receiving execution case lineage 없음");
  if (!state.sourceIntakeCaseId) blockers.push("Receiving intake case lineage 없음");
  if (!state.sourceAckRecordId) blockers.push("Supplier acknowledgement record lineage 없음");

  if (!state.decision) {
    blockers.push("실제 입고 캡처 미완료");
    return { status: "blocked", blockers, warnings, canConfirm: false };
  }

  const lines = state.decision.lineCaptures;

  // No lines captured
  if (lines.length === 0) {
    blockers.push("입고 라인 캡처가 없습니다");
    return { status: "blocked", blockers, warnings, canConfirm: false };
  }

  // Pending capture check
  const pendingLines = lines.filter(l => l.lineReceiptStatus === "pending_capture");
  if (pendingLines.length === lines.length) {
    blockers.push("모든 라인이 캡처 대기 상태입니다");
  } else if (pendingLines.length > 0) {
    warnings.push(`${pendingLines.length}개 라인 캡처 미완료`);
  }

  // Mandatory capture rules
  for (const line of lines) {
    if (line.lineReceiptStatus === "pending_capture" || line.lineReceiptStatus === "not_received") continue;

    if (state.lotCaptureRequired && !line.lotNumber) {
      blockers.push(`라인 ${line.lineId}: lot 번호 누락 (필수)`);
    }
    if (state.expiryCaptureRequired && !line.expiryDate) {
      blockers.push(`라인 ${line.lineId}: 유효기한 누락 (필수)`);
    }
    if (state.serialCaptureRequired && !line.serialNumber) {
      blockers.push(`라인 ${line.lineId}: 시리얼 번호 누락 (필수)`);
    }
    if (state.temperatureCheckRequired && !line.temperatureCheckResult) {
      blockers.push(`라인 ${line.lineId}: 온도 체크 누락 (필수)`);
    }
    if (state.damageCheckRequired && line.damageFlag && !line.discrepancyFlag) {
      blockers.push(`라인 ${line.lineId}: 손상 발견되었으나 discrepancy 미표시`);
    }
    if (line.docVerificationStatus === "failed") {
      blockers.push(`라인 ${line.lineId}: 문서 검증 실패`);
    }
    if (line.docVerificationStatus === "pending") {
      warnings.push(`라인 ${line.lineId}: 문서 검증 대기 중`);
    }
  }

  // Partial receipt guard
  const receivedLines = lines.filter(l => l.lineReceiptStatus === "captured_clean" || l.lineReceiptStatus === "captured_with_discrepancy");
  const notReceivedLines = lines.filter(l => l.lineReceiptStatus === "not_received");
  if (!state.partialReceiptAllowed && notReceivedLines.length > 0 && receivedLines.length > 0) {
    blockers.push("부분 입고 불허인데 일부 라인 미수령");
  }

  // Discrepancy guard
  const discrepancyLines = lines.filter(l => l.discrepancyFlag);
  if (discrepancyLines.length > 0 && !state.decision.discrepancyResolutionPath) {
    blockers.push("Discrepancy 발견되었으나 처리 경로 미지정");
  }
  if (discrepancyLines.length > 0) {
    warnings.push(`${discrepancyLines.length}개 라인 discrepancy 존재`);
  }

  // Quarantine guard
  const quarantineLines = lines.filter(l => l.quarantineFlag);
  if (quarantineLines.length > 0 && !state.decision.quarantineResolutionPath) {
    blockers.push("격리 대상 존재하나 격리 경로 미지정");
  }
  if (quarantineLines.length > 0) {
    warnings.push(`${quarantineLines.length}개 라인 격리 대상`);
  }

  // Damage guard
  const damagedLines = lines.filter(l => l.damageFlag);
  if (damagedLines.length > 0) {
    warnings.push(`${damagedLines.length}개 라인 손상 감지`);
  }

  const status: ExecutionReadinessStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 confirm 금지 (보수적)
  return { status, blockers, warnings, canConfirm: status === "ready" };
}

// ── Execution Record Status ──
export type ExecutionRecordStatus = "recorded_full" | "recorded_partial" | "recorded_with_discrepancy" | "quarantined" | "failed";

// ── Canonical Receiving Execution Record ──
export interface ReceivingExecutionRecord {
  id: string;
  sourcePoRecordId: string;
  sourceSupplierAckRecordId: string;
  sourceReceivingIntakeCaseId: string;
  sourceReceivingExecutionCaseId: string;
  vendorId: string;
  receivedLineSummary: string;
  actualQtyByLine: string;
  lotByLine: string;
  expiryByLine: string;
  serialByLine: string;
  temperatureCheckSummary: string;
  damageSummary: string;
  discrepancySummary: string;
  quarantineSummary: string;
  docVerificationSummary: string;
  receivedAt: string;
  receivedBy: string;
  status: ExecutionRecordStatus;
  nextDestination: string;
}

export function buildReceivingExecutionRecord(state: ReceivingExecutionWorkbenchState): ReceivingExecutionRecord | null {
  if (!state.decision) return null;
  const readiness = evaluateExecutionReadiness(state);
  if (!readiness.canConfirm) return null;

  const lines = state.decision.lineCaptures;
  const cleanLines = lines.filter(l => l.lineReceiptStatus === "captured_clean");
  const discrepancyLines = lines.filter(l => l.lineReceiptStatus === "captured_with_discrepancy");
  const quarantineLines = lines.filter(l => l.quarantineFlag);
  const notReceivedLines = lines.filter(l => l.lineReceiptStatus === "not_received");

  const status: ExecutionRecordStatus =
    quarantineLines.length > 0 ? "quarantined"
    : discrepancyLines.length > 0 ? "recorded_with_discrepancy"
    : notReceivedLines.length > 0 ? "recorded_partial"
    : "recorded_full";

  const nextDest =
    status === "recorded_full" ? "stock_release_gate"
    : status === "recorded_partial" ? "stock_release_gate"
    : status === "recorded_with_discrepancy" ? "discrepancy_resolution"
    : "quarantine_resolution";

  return {
    id: `rcvrec_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceSupplierAckRecordId: state.sourceAckRecordId,
    sourceReceivingIntakeCaseId: state.sourceIntakeCaseId,
    sourceReceivingExecutionCaseId: state.receivingExecutionCaseId,
    vendorId: state.vendorId,
    receivedLineSummary: `${cleanLines.length} clean, ${discrepancyLines.length} discrepancy, ${quarantineLines.length} quarantine, ${notReceivedLines.length} not received`,
    actualQtyByLine: lines.map(l => `${l.lineId}:${l.actualReceivedQty}`).join("; "),
    lotByLine: lines.filter(l => l.lotNumber).map(l => `${l.lineId}:${l.lotNumber}`).join("; "),
    expiryByLine: lines.filter(l => l.expiryDate).map(l => `${l.lineId}:${l.expiryDate}`).join("; "),
    serialByLine: lines.filter(l => l.serialNumber).map(l => `${l.lineId}:${l.serialNumber}`).join("; "),
    temperatureCheckSummary: lines.filter(l => l.temperatureCheckResult).map(l => `${l.lineId}:${l.temperatureCheckResult}`).join("; "),
    damageSummary: lines.filter(l => l.damageFlag).map(l => `${l.lineId}: 손상`).join("; ") || "없음",
    discrepancySummary: discrepancyLines.map(l => `${l.lineId}: ${l.receivingNote}`).join("; ") || "없음",
    quarantineSummary: quarantineLines.map(l => `${l.lineId}: ${l.receivingNote}`).join("; ") || "없음",
    docVerificationSummary: lines.map(l => `${l.lineId}:${l.docVerificationStatus}`).join("; "),
    receivedAt: new Date().toISOString(),
    receivedBy: "operator",
    status,
    nextDestination: nextDest,
  };
}

// ── Can Transition to Received ──
export function canTransitionToReceived(record: ReceivingExecutionRecord): boolean {
  return record.status === "recorded_full" || record.status === "recorded_partial";
}

// ── Downstream Case: Stock Release Gate ──
export interface StockReleaseGateCase {
  id: string;
  sourcePoRecordId: string;
  sourceReceivingExecutionRecordId: string;
  vendorId: string;
  eligibleScope: string;
  cleanReceivedLineSummary: string;
  actualQtySummary: string;
  lotSummary: string;
  expirySummary: string;
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_review" | "released" | "on_hold" | "cancelled";
  nextDestination: string;
}

export function buildStockReleaseGateCase(record: ReceivingExecutionRecord): StockReleaseGateCase | null {
  if (record.status === "quarantined" || record.status === "failed") return null;

  return {
    id: `stkgate_${Date.now().toString(36)}`,
    sourcePoRecordId: record.sourcePoRecordId,
    sourceReceivingExecutionRecordId: record.id,
    vendorId: record.vendorId,
    eligibleScope: record.status === "recorded_full" ? "전체" : "부분",
    cleanReceivedLineSummary: record.receivedLineSummary,
    actualQtySummary: record.actualQtyByLine,
    lotSummary: record.lotByLine,
    expirySummary: record.expiryByLine,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: "stock_release_gate",
  };
}

// ── Downstream Case: Receiving Discrepancy ──
export interface ReceivingDiscrepancyCase {
  id: string;
  sourcePoRecordId: string;
  sourceReceivingExecutionRecordId: string;
  issueType: "qty_mismatch" | "doc_mismatch" | "condition_mismatch" | "packaging_mismatch" | "mixed";
  affectedLineSummary: string;
  discrepancyDetail: string;
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildReceivingDiscrepancyCase(record: ReceivingExecutionRecord): ReceivingDiscrepancyCase | null {
  if (record.status !== "recorded_with_discrepancy") return null;

  return {
    id: `rcvdisc_${Date.now().toString(36)}`,
    sourcePoRecordId: record.sourcePoRecordId,
    sourceReceivingExecutionRecordId: record.id,
    issueType: "mixed",
    affectedLineSummary: record.discrepancySummary,
    discrepancyDetail: record.discrepancySummary,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: "discrepancy_resolution",
  };
}

// ── Downstream Case: Receiving Quarantine ──
export interface ReceivingQuarantineCase {
  id: string;
  sourcePoRecordId: string;
  sourceReceivingExecutionRecordId: string;
  issueType: "damage" | "temperature_excursion" | "contamination_risk" | "doc_failure" | "mixed";
  affectedLineSummary: string;
  quarantineDetail: string;
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_review" | "released" | "disposed" | "returned" | "cancelled";
  nextDestination: string;
}

export function buildReceivingQuarantineCase(record: ReceivingExecutionRecord): ReceivingQuarantineCase | null {
  if (record.status !== "quarantined") return null;

  return {
    id: `rcvquar_${Date.now().toString(36)}`,
    sourcePoRecordId: record.sourcePoRecordId,
    sourceReceivingExecutionRecordId: record.id,
    issueType: "mixed",
    affectedLineSummary: record.quarantineSummary,
    quarantineDetail: record.quarantineSummary,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: "quarantine_resolution",
  };
}

// ── Activity Events ──
export type ReceivingExecutionEventType =
  | "receiving_execution_opened"
  | "receiving_execution_saved"
  | "receiving_execution_hold_set"
  | "receiving_execution_blocker_detected"
  | "receiving_execution_warning_detected"
  | "receiving_execution_discrepancy_flagged"
  | "receiving_execution_quarantine_flagged"
  | "receiving_execution_record_created"
  | "po_marked_received"
  | "stock_release_gate_case_created"
  | "receiving_discrepancy_case_created"
  | "receiving_quarantine_case_created";

export interface ReceivingExecutionEvent {
  type: ReceivingExecutionEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  receivingExecutionCaseId: string;
  receivingExecutionRecordId: string | null;
  downstreamCaseId: string | null;
  changedFields: string[];
  destination: string;
}

export function createExecutionEvent(
  type: ReceivingExecutionEventType,
  state: ReceivingExecutionWorkbenchState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
  downstreamCaseId?: string | null,
): ReceivingExecutionEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    receivingExecutionCaseId: state.receivingExecutionCaseId,
    receivingExecutionRecordId: state.executionRecordId,
    downstreamCaseId: downstreamCaseId ?? null,
    changedFields,
    destination,
  };
}
