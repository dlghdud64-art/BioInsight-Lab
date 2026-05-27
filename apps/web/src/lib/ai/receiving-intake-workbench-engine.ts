/**
 * Receiving Intake Workbench Engine — intake checklist + capture rules + execution case handoff
 *
 * 고정 규칙:
 * 1. receivingIntakeCase = 단일 입력 source.
 * 2. receiving_pending ≠ received. intake ready ≠ actual receipt capture.
 * 3. scope/document/capture/location/exception 5개 intake readiness 축 분리 평가.
 * 4. partial/exception receiving guard 필수 — capture rule 없이 execution 넘기기 금지.
 * 5. canonical receivingExecutionCase = 다음 단계 단일 intake source.
 * 6. actual received qty / lot / expiry 입력은 이 단계에서 금지 — execution에서 처리.
 * 7. stock / available inventory / reorder 직접 점프 금지.
 */

import type { ReceivingIntakeCase, ReceivingExceptionFlag } from "./receiving-readiness-gate-engine";

// ── Intake Case Status ──
export type ReceivingIntakeCaseStatus = "queued" | "in_review" | "on_hold" | "ready_for_execution" | "routed_to_correction" | "cancelled";
export type ReceivingIntakeReadinessStatus = "blocked" | "warning" | "ready";

// ── Intake Readiness Axis ──
export type IntakeReadinessAxis = "scope_intake_ready" | "document_intake_ready" | "capture_intake_ready" | "location_intake_ready" | "exception_intake_ready";
export type IntakeAxisStatus = "ok" | "warning" | "blocked";

export interface IntakeAxisResult {
  axis: IntakeReadinessAxis;
  status: IntakeAxisStatus;
  detail: string;
}

// ── Intake Exception Flag ──
export type IntakeExceptionFlag =
  | "scope_mismatch"
  | "qty_mismatch"
  | "partial_receipt_unresolved"
  | "doc_missing"
  | "lot_capture_undefined"
  | "expiry_capture_undefined"
  | "serial_capture_undefined"
  | "temperature_check_undefined"
  | "damage_check_undefined"
  | "quarantine_path_missing"
  | "location_unconfirmed"
  | "handling_instruction_missing";

// ── Receiving Intake Decision ──
export interface ReceivingIntakeDecision {
  lineScope: string;
  expectedQtyByLine: string;
  requiredDocs: string[];
  lotCaptureRequired: boolean;
  expiryCaptureRequired: boolean;
  serialCaptureRequired: boolean;
  temperatureCheckRequired: boolean;
  damageCheckRequired: boolean;
  partialReceiptAllowed: boolean;
  quarantineCandidate: boolean;
  operatorNote: string;
  exceptionFlags: IntakeExceptionFlag[];
}

// ── State ──
export interface ReceivingIntakeWorkbenchState {
  caseStatus: ReceivingIntakeCaseStatus;
  intakeReadiness: ReceivingIntakeReadinessStatus;
  receivingIntakeCaseId: string;
  poRecordId: string;
  vendorId: string;
  sourceAckRecordId: string;
  sourceGateId: string;
  eligibleLineScope: string;
  expectedInboundQty: string;
  receivingLocation: string;
  expectedArrivalWindow: string;
  axisResults: IntakeAxisResult[];
  decision: ReceivingIntakeDecision | null;
  blockerCount: number;
  warningCount: number;
  executionCaseId: string | null;
  correctionRouteId: string | null;
}

export function createInitialReceivingIntakeWorkbenchState(intakeCase: ReceivingIntakeCase): ReceivingIntakeWorkbenchState {
  const axes = evaluateIntakeAxes(intakeCase, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    caseStatus: "in_review",
    intakeReadiness: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "blocked",
    receivingIntakeCaseId: intakeCase.id,
    poRecordId: intakeCase.sourcePoRecordId,
    vendorId: intakeCase.vendorId,
    sourceAckRecordId: intakeCase.sourceSupplierAckRecordId,
    sourceGateId: intakeCase.sourceReceivingReadinessGateId,
    eligibleLineScope: intakeCase.eligibleLineScope,
    expectedInboundQty: intakeCase.expectedInboundQtySummary,
    receivingLocation: intakeCase.receivingLocation,
    expectedArrivalWindow: intakeCase.expectedArrivalWindow,
    axisResults: axes,
    decision: null,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    executionCaseId: null,
    correctionRouteId: null,
  };
}

// ── Intake Axes Evaluation ──
export function evaluateIntakeAxes(intakeCase: ReceivingIntakeCase, decision: ReceivingIntakeDecision | null): IntakeAxisResult[] {
  const results: IntakeAxisResult[] = [];

  // 1. Scope intake ready
  if (!intakeCase.eligibleLineScope) {
    results.push({ axis: "scope_intake_ready", status: "blocked", detail: "입고 대상 라인 범위 없음" });
  } else if (decision && !decision.lineScope) {
    results.push({ axis: "scope_intake_ready", status: "blocked", detail: "Intake 라인 범위 미지정" });
  } else if (decision?.lineScope) {
    results.push({ axis: "scope_intake_ready", status: "ok", detail: "입고 라인 범위 확인됨" });
  } else {
    results.push({ axis: "scope_intake_ready", status: "blocked", detail: "Intake 라인 범위 미입력" });
  }

  // 2. Document intake ready
  if (decision && decision.requiredDocs.length > 0) {
    results.push({ axis: "document_intake_ready", status: "ok", detail: `입고 문서 ${decision.requiredDocs.length}건 확인됨` });
  } else if (intakeCase.requiredDocs.length > 0 && !decision) {
    results.push({ axis: "document_intake_ready", status: "warning", detail: "Gate 문서 기준 있으나 intake 확인 미완료" });
  } else if (decision && decision.requiredDocs.length === 0) {
    results.push({ axis: "document_intake_ready", status: "warning", detail: "입고 문서가 지정되지 않음" });
  } else {
    results.push({ axis: "document_intake_ready", status: "blocked", detail: "입고 문서 체크리스트 미완료" });
  }

  // 3. Capture intake ready
  if (decision) {
    const captureIssues: string[] = [];
    if (decision.lotCaptureRequired && decision.exceptionFlags.includes("lot_capture_undefined")) captureIssues.push("lot");
    if (decision.expiryCaptureRequired && decision.exceptionFlags.includes("expiry_capture_undefined")) captureIssues.push("expiry");
    if (decision.serialCaptureRequired && decision.exceptionFlags.includes("serial_capture_undefined")) captureIssues.push("serial");
    if (decision.temperatureCheckRequired && decision.exceptionFlags.includes("temperature_check_undefined")) captureIssues.push("temperature");
    if (decision.damageCheckRequired && decision.exceptionFlags.includes("damage_check_undefined")) captureIssues.push("damage");

    if (captureIssues.length > 0) {
      results.push({ axis: "capture_intake_ready", status: "blocked", detail: `${captureIssues.join(", ")} 캡처 규칙 미정의` });
    } else {
      results.push({ axis: "capture_intake_ready", status: "ok", detail: "캡처 규칙 확인됨" });
    }
  } else {
    results.push({ axis: "capture_intake_ready", status: "blocked", detail: "캡처 규칙 미입력" });
  }

  // 4. Location intake ready
  if (intakeCase.receivingLocation) {
    results.push({ axis: "location_intake_ready", status: "ok", detail: "입고 위치 확인됨" });
  } else if (decision && decision.exceptionFlags.includes("location_unconfirmed")) {
    results.push({ axis: "location_intake_ready", status: "blocked", detail: "입고 위치 미확정" });
  } else {
    results.push({ axis: "location_intake_ready", status: "blocked", detail: "입고 위치 없음" });
  }

  // 5. Exception intake ready
  if (decision) {
    const hasQuarantineIssue = decision.quarantineCandidate && decision.exceptionFlags.includes("quarantine_path_missing");
    const hasPartialIssue = !decision.partialReceiptAllowed && decision.exceptionFlags.includes("partial_receipt_unresolved");
    const hasHandlingIssue = decision.exceptionFlags.includes("handling_instruction_missing");

    if (hasQuarantineIssue) {
      results.push({ axis: "exception_intake_ready", status: "blocked", detail: "격리 대상이나 격리 경로 미정의" });
    } else if (hasPartialIssue) {
      results.push({ axis: "exception_intake_ready", status: "blocked", detail: "부분 입고 불허인데 부분 입고 이슈 미해결" });
    } else if (hasHandlingIssue) {
      results.push({ axis: "exception_intake_ready", status: "warning", detail: "취급 지침 불완전" });
    } else {
      results.push({ axis: "exception_intake_ready", status: "ok", detail: "예외 경로 확인됨" });
    }
  } else {
    results.push({ axis: "exception_intake_ready", status: "blocked", detail: "예외 경로 미입력" });
  }

  return results;
}

// ── Intake Readiness Aggregate ──
export interface ReceivingIntakeReadinessResult {
  status: ReceivingIntakeReadinessStatus;
  blockers: string[];
  warnings: string[];
  canHandoff: boolean;
}

export function evaluateReceivingIntakeReadiness(state: ReceivingIntakeWorkbenchState): ReceivingIntakeReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.receivingIntakeCaseId) blockers.push("Receiving intake case lineage 없음");
  if (!state.sourceAckRecordId) blockers.push("Supplier acknowledgement record lineage 없음");
  if (!state.sourceGateId) blockers.push("Receiving readiness gate lineage 없음");

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Decision completeness
  if (!state.decision) {
    blockers.push("Receiving intake decision 미완료");
  } else {
    // Partial receipt guard
    if (!state.decision.partialReceiptAllowed && state.decision.exceptionFlags.includes("partial_receipt_unresolved")) {
      blockers.push("부분 입고 불허인데 부분 입고 이슈 미해결");
    }
    // Quarantine guard
    if (state.decision.quarantineCandidate && state.decision.exceptionFlags.includes("quarantine_path_missing")) {
      blockers.push("격리 대상이나 격리 경로 미정의");
    }
    // Mandatory capture guard
    if (state.decision.lotCaptureRequired && state.decision.exceptionFlags.includes("lot_capture_undefined")) {
      blockers.push("Lot 캡처 필수인데 규칙 미정의");
    }
    if (state.decision.expiryCaptureRequired && state.decision.exceptionFlags.includes("expiry_capture_undefined")) {
      blockers.push("유효기한 캡처 필수인데 규칙 미정의");
    }
    if (state.decision.damageCheckRequired && state.decision.exceptionFlags.includes("damage_check_undefined")) {
      blockers.push("파손 검사 필수인데 규칙 미정의");
    }
    // Warning flags
    if (state.decision.exceptionFlags.includes("handling_instruction_missing")) {
      warnings.push("취급 지침 불완전");
    }
    if (state.decision.exceptionFlags.includes("qty_mismatch")) {
      warnings.push("예상 수량 불일치 가능성");
    }
  }

  const status: ReceivingIntakeReadinessStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 handoff 금지 (보수적)
  return { status, blockers, warnings, canHandoff: status === "ready" };
}

// ── Canonical Receiving Execution Case ──
export interface ReceivingExecutionCase {
  id: string;
  sourcePoRecordId: string;
  sourceSupplierAckRecordId: string;
  sourceReceivingIntakeCaseId: string;
  vendorId: string;
  eligibleLineScope: string;
  expectedInboundQtySummary: string;
  partialReceiptAllowed: boolean;
  requiredDocs: string[];
  lotCaptureRequired: boolean;
  expiryCaptureRequired: boolean;
  serialCaptureRequired: boolean;
  temperatureCheckRequired: boolean;
  damageCheckRequired: boolean;
  quarantineCandidate: boolean;
  receivingLocation: string;
  expectedArrivalWindow: string;
  receivingInstruction: string;
  exceptionFlags: IntakeExceptionFlag[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_execution" | "partially_received" | "fully_received" | "failed" | "cancelled";
  nextDestination: string;
}

export function buildReceivingExecutionCase(state: ReceivingIntakeWorkbenchState): ReceivingExecutionCase | null {
  if (!state.decision) return null;
  const readiness = evaluateReceivingIntakeReadiness(state);
  if (!readiness.canHandoff) return null;

  const d = state.decision;
  return {
    id: `rcvexec_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceSupplierAckRecordId: state.sourceAckRecordId,
    sourceReceivingIntakeCaseId: state.receivingIntakeCaseId,
    vendorId: state.vendorId,
    eligibleLineScope: d.lineScope,
    expectedInboundQtySummary: d.expectedQtyByLine,
    partialReceiptAllowed: d.partialReceiptAllowed,
    requiredDocs: d.requiredDocs,
    lotCaptureRequired: d.lotCaptureRequired,
    expiryCaptureRequired: d.expiryCaptureRequired,
    serialCaptureRequired: d.serialCaptureRequired,
    temperatureCheckRequired: d.temperatureCheckRequired,
    damageCheckRequired: d.damageCheckRequired,
    quarantineCandidate: d.quarantineCandidate,
    receivingLocation: state.receivingLocation,
    expectedArrivalWindow: state.expectedArrivalWindow,
    receivingInstruction: d.operatorNote,
    exceptionFlags: d.exceptionFlags,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: "receiving_execution",
  };
}

// ── Intake Correction Route ──
export interface IntakeCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceReceivingIntakeCaseId: string;
  routeType: "scope_correction" | "doc_clarification" | "capture_rule_clarification" | "supplier_clarification" | "ack_review_return";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildIntakeCorrectionRoute(
  state: ReceivingIntakeWorkbenchState,
  routeType: IntakeCorrectionRoute["routeType"],
  reason: string,
): IntakeCorrectionRoute {
  const readiness = evaluateReceivingIntakeReadiness(state);

  const nextDest =
    routeType === "ack_review_return" ? "acknowledgement_review"
    : routeType === "scope_correction" ? "receiving_readiness_gate"
    : routeType === "doc_clarification" ? "document_clarification"
    : routeType === "capture_rule_clarification" ? "capture_rule_review"
    : "supplier_clarification";

  return {
    id: `intkcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceReceivingIntakeCaseId: state.receivingIntakeCaseId,
    routeType,
    reason,
    unresolvedBlockers: readiness.blockers,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: nextDest,
  };
}

// ── Activity Events ──
export type ReceivingIntakeEventType =
  | "receiving_intake_opened"
  | "receiving_intake_saved"
  | "receiving_intake_hold_set"
  | "receiving_intake_blocker_detected"
  | "receiving_intake_warning_detected"
  | "receiving_intake_correction_routed"
  | "receiving_execution_case_created"
  | "receiving_intake_marked_ready_for_execution"
  | "receiving_intake_handoff_completed";

export interface ReceivingIntakeEvent {
  type: ReceivingIntakeEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  receivingIntakeCaseId: string;
  receivingExecutionCaseId: string | null;
  changedFields: string[];
  destination: string;
}

export function createIntakeEvent(
  type: ReceivingIntakeEventType,
  state: ReceivingIntakeWorkbenchState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): ReceivingIntakeEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    receivingIntakeCaseId: state.receivingIntakeCaseId,
    receivingExecutionCaseId: state.executionCaseId,
    changedFields,
    destination,
  };
}
