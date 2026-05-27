/**
 * Receiving Readiness Gate Engine — supplier confirmed → receiving intake readiness gate
 *
 * 고정 규칙:
 * 1. supplierAcknowledgementRecord (confirmed) = 단일 입력 source.
 * 2. supplier_acknowledged ≠ receiving_pending. gate 통과 이후에만 전이.
 * 3. scope/arrival/location/document/capture rule 5개 readiness 축 분리 평가.
 * 4. partial/staged receiving guard 필수 — 전체가 아닌 건 자동 full readiness 금지.
 * 5. canonical receivingIntakeCase = 다음 단계 단일 intake source.
 * 6. receiving/stock/available inventory 직접 점프 금지.
 */

import type { SupplierAcknowledgementRecord } from "./supplier-acknowledgement-review-engine";

// ── Gate Status ──
export type ReceivingReadinessGateStatus = "not_started" | "blocked" | "warning" | "ready" | "handed_off";

// ── Readiness Axis ──
export type ReadinessAxis = "scope_ready" | "arrival_ready" | "location_ready" | "document_ready" | "capture_rule_ready";
export type AxisStatus = "ok" | "warning" | "blocked";

export interface ReadinessAxisResult {
  axis: ReadinessAxis;
  status: AxisStatus;
  detail: string;
}

// ── Exception Flag ──
export type ReceivingExceptionFlag = "scope_mismatch" | "partial_shipment_expected" | "staged_delivery" | "lot_capture_missing" | "expiry_capture_missing" | "document_incomplete" | "location_unclear" | "arrival_window_wide" | "supplier_note_ambiguous";

// ── Receiving Readiness Decision ──
export interface ReceivingReadinessDecision {
  eligibleLineScope: string;
  expectedInboundQty: string;
  partialReceiptAllowed: boolean;
  lotCaptureRequired: boolean;
  expiryCaptureRequired: boolean;
  requiredDocs: string[];
  receivingLocation: string;
  expectedArrivalWindow: string;
  receivingInstruction: string;
  exceptionFlags: ReceivingExceptionFlag[];
  operatorNote: string;
}

// ── State ──
export interface ReceivingReadinessGateState {
  gateId: string;
  gateStatus: ReceivingReadinessGateStatus;
  poRecordId: string;
  vendorId: string;
  supplierAckRecordId: string;
  confirmedScope: string;
  confirmedAckType: string;
  axisResults: ReadinessAxisResult[];
  decision: ReceivingReadinessDecision | null;
  blockerCount: number;
  warningCount: number;
  receivingIntakeCaseId: string | null;
  correctionRouteId: string | null;
}

export function createInitialReceivingReadinessGateState(ackRecord: SupplierAcknowledgementRecord): ReceivingReadinessGateState {
  const axes = evaluateReadinessAxes(ackRecord, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    gateId: `rcvgate_${Date.now().toString(36)}`,
    gateStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    poRecordId: ackRecord.sourcePoRecordId,
    vendorId: ackRecord.vendorId,
    supplierAckRecordId: ackRecord.id,
    confirmedScope: ackRecord.confirmedLineSummary,
    confirmedAckType: ackRecord.acknowledgementType,
    axisResults: axes,
    decision: null,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    receivingIntakeCaseId: null,
    correctionRouteId: null,
  };
}

// ── Readiness Axes Evaluation ──
export function evaluateReadinessAxes(ackRecord: SupplierAcknowledgementRecord, decision: ReceivingReadinessDecision | null): ReadinessAxisResult[] {
  const results: ReadinessAxisResult[] = [];

  // 1. Scope ready
  if (ackRecord.status !== "confirmed") {
    results.push({ axis: "scope_ready", status: "blocked", detail: "Acknowledgement가 confirmed 상태가 아님" });
  } else if (ackRecord.acknowledgementScope === "partial_lines") {
    results.push({ axis: "scope_ready", status: "warning", detail: "부분 라인만 confirmed — 입고 범위 확인 필요" });
  } else if (decision && !decision.eligibleLineScope) {
    results.push({ axis: "scope_ready", status: "blocked", detail: "입고 대상 라인 범위 미지정" });
  } else {
    results.push({ axis: "scope_ready", status: decision?.eligibleLineScope ? "ok" : "blocked", detail: decision?.eligibleLineScope ? "입고 범위 확인됨" : "입고 대상 범위 미지정" });
  }

  // 2. Arrival ready
  if (decision && decision.expectedArrivalWindow) {
    results.push({ axis: "arrival_ready", status: "ok", detail: "예상 도착 정보 확인됨" });
  } else if (decision && !decision.expectedArrivalWindow) {
    results.push({ axis: "arrival_ready", status: "blocked", detail: "예상 도착 정보 없음" });
  } else {
    results.push({ axis: "arrival_ready", status: "blocked", detail: "예상 도착 정보 미입력" });
  }

  // 3. Location ready
  if (decision && decision.receivingLocation) {
    results.push({ axis: "location_ready", status: "ok", detail: "입고 위치 확인됨" });
  } else {
    results.push({ axis: "location_ready", status: "blocked", detail: "입고 위치 미지정" });
  }

  // 4. Document ready
  if (decision && decision.requiredDocs.length > 0) {
    results.push({ axis: "document_ready", status: "ok", detail: `필요 문서 ${decision.requiredDocs.length}건 확인됨` });
  } else if (decision && decision.requiredDocs.length === 0) {
    results.push({ axis: "document_ready", status: "warning", detail: "입고 관련 문서가 지정되지 않음" });
  } else {
    results.push({ axis: "document_ready", status: "blocked", detail: "필수 입고 문서 확인 미완료" });
  }

  // 5. Capture rule ready
  if (decision) {
    const lotOk = !decision.lotCaptureRequired || decision.exceptionFlags.every(f => f !== "lot_capture_missing");
    const expiryOk = !decision.expiryCaptureRequired || decision.exceptionFlags.every(f => f !== "expiry_capture_missing");
    if (lotOk && expiryOk) {
      results.push({ axis: "capture_rule_ready", status: "ok", detail: "Lot/유효기한 capture 규칙 확인됨" });
    } else {
      results.push({ axis: "capture_rule_ready", status: "warning", detail: "Lot 또는 유효기한 capture 규칙 미확정" });
    }
  } else {
    results.push({ axis: "capture_rule_ready", status: "blocked", detail: "Capture 규칙 미입력" });
  }

  return results;
}

// ── Gate Readiness Aggregate ──
export interface ReceivingReadinessResult {
  gateStatus: ReceivingReadinessGateStatus;
  blockers: string[];
  warnings: string[];
  canHandoff: boolean;
}

export function evaluateReceivingReadiness(state: ReceivingReadinessGateState): ReceivingReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage check
  if (!state.supplierAckRecordId) blockers.push("Supplier acknowledgement record lineage 없음");
  if (state.confirmedAckType !== "confirmed") blockers.push("Acknowledgement가 confirmed 상태가 아님");

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Decision completeness
  if (!state.decision) {
    blockers.push("Receiving readiness decision 미완료");
  } else {
    // Partial/staged guard
    if (!state.decision.partialReceiptAllowed && state.confirmedScope !== "전체 라인") {
      blockers.push("부분 입고 불허인데 confirmed scope가 전체가 아님");
    }
    if (state.decision.exceptionFlags.includes("scope_mismatch")) {
      blockers.push("Acknowledgement scope와 receiving scope 불일치");
    }
    if (state.decision.exceptionFlags.includes("location_unclear")) {
      blockers.push("입고 위치 불명확");
    }
    // Warnings from exception flags
    if (state.decision.exceptionFlags.includes("arrival_window_wide")) {
      warnings.push("예상 도착 기간이 넓음");
    }
    if (state.decision.exceptionFlags.includes("supplier_note_ambiguous")) {
      warnings.push("공급사 노트가 모호함");
    }
    if (state.decision.exceptionFlags.includes("partial_shipment_expected")) {
      warnings.push("부분 배송 예상됨");
    }
    if (state.decision.exceptionFlags.includes("staged_delivery")) {
      warnings.push("분할 납품 예상됨");
    }
    if (state.decision.exceptionFlags.includes("document_incomplete")) {
      warnings.push("입고 문서 불완전");
    }
  }

  const gateStatus: ReceivingReadinessGateStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning 상태에서도 handoff 금지 (보수적)
  return { gateStatus, blockers, warnings, canHandoff: gateStatus === "ready" };
}

// ── Can Transition to Receiving Pending ──
export function canTransitionToReceivingPending(state: ReceivingReadinessGateState): boolean {
  if (state.confirmedAckType !== "confirmed") return false;
  if (!state.decision) return false;
  const readiness = evaluateReceivingReadiness(state);
  return readiness.canHandoff;
}

// ── Canonical Receiving Intake Case ──
export interface ReceivingIntakeCase {
  id: string;
  sourcePoRecordId: string;
  sourceSupplierAckRecordId: string;
  sourceReceivingReadinessGateId: string;
  vendorId: string;
  eligibleLineScope: string;
  expectedInboundQtySummary: string;
  partialReceiptAllowed: boolean;
  lotCaptureRequired: boolean;
  expiryCaptureRequired: boolean;
  requiredDocs: string[];
  receivingLocation: string;
  expectedArrivalWindow: string;
  receivingInstruction: string;
  exceptionFlags: ReceivingExceptionFlag[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_review" | "awaiting_receipt" | "in_receiving" | "completed" | "cancelled";
  nextDestination: string;
}

export function buildReceivingIntakeCase(state: ReceivingReadinessGateState): ReceivingIntakeCase | null {
  if (!state.decision) return null;
  const readiness = evaluateReceivingReadiness(state);
  if (!readiness.canHandoff) return null;

  const d = state.decision;
  return {
    id: `rcvintake_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceSupplierAckRecordId: state.supplierAckRecordId,
    sourceReceivingReadinessGateId: state.gateId,
    vendorId: state.vendorId,
    eligibleLineScope: d.eligibleLineScope,
    expectedInboundQtySummary: d.expectedInboundQty,
    partialReceiptAllowed: d.partialReceiptAllowed,
    lotCaptureRequired: d.lotCaptureRequired,
    expiryCaptureRequired: d.expiryCaptureRequired,
    requiredDocs: d.requiredDocs,
    receivingLocation: d.receivingLocation,
    expectedArrivalWindow: d.expectedArrivalWindow,
    receivingInstruction: d.receivingInstruction,
    exceptionFlags: d.exceptionFlags,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: "receiving_intake",
  };
}

// ── Correction Route Case ──
export interface ReceivingReadinessCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceReceivingReadinessGateId: string;
  routeType: "scope_correction" | "document_recovery" | "location_clarification" | "arrival_clarification" | "ack_review_return";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildCorrectionRoute(state: ReceivingReadinessGateState, routeType: ReceivingReadinessCorrectionRoute["routeType"], reason: string): ReceivingReadinessCorrectionRoute {
  const readiness = evaluateReceivingReadiness(state);

  const nextDest =
    routeType === "ack_review_return" ? "acknowledgement_review"
    : routeType === "scope_correction" ? "acknowledgement_followup"
    : routeType === "document_recovery" ? "document_recovery"
    : routeType === "location_clarification" ? "location_clarification"
    : "arrival_clarification";

  return {
    id: `rcvcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceReceivingReadinessGateId: state.gateId,
    routeType,
    reason,
    unresolvedBlockers: readiness.blockers,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: nextDest,
  };
}

// ── Gate Activity Event ──
export type ReceivingReadinessGateEventType =
  | "receiving_readiness_gate_opened"
  | "receiving_readiness_saved"
  | "receiving_readiness_hold_set"
  | "receiving_readiness_blocker_detected"
  | "receiving_readiness_warning_detected"
  | "receiving_readiness_correction_routed"
  | "receiving_intake_case_created"
  | "po_marked_receiving_pending"
  | "receiving_readiness_handoff_completed";

export interface ReceivingReadinessGateEvent {
  type: ReceivingReadinessGateEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  ackRecordId: string;
  gateId: string;
  receivingIntakeCaseId: string | null;
  changedFields: string[];
  destination: string;
}

export function createGateEvent(
  type: ReceivingReadinessGateEventType,
  state: ReceivingReadinessGateState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): ReceivingReadinessGateEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    ackRecordId: state.supplierAckRecordId,
    gateId: state.gateId,
    receivingIntakeCaseId: state.receivingIntakeCaseId,
    changedFields,
    destination,
  };
}
