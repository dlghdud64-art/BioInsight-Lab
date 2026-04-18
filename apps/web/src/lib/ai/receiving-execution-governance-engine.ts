/**
 * Receiving Execution Governance Engine — 실물 입고 상태 머신 (governance layer)
 *
 * 기존 receiving-execution-engine.ts의 field-level 모델 위에
 * 상태 머신 + delta-first + discrepancy governance + stock release gate handoff 추가.
 *
 * receiving preparation (governance) ≠ receiving execution (this engine).
 * preparation = "받을 준비 됐는가?" (blocker-based gating)
 * execution = "실제로 받는 중 / 받았다" (state machine)
 *
 * STATE MACHINE:
 *   awaiting_receipt → receiving_in_progress → received
 *                                            → partially_received → received
 *                                            → discrepancy → quarantined / received
 *   any non-terminal → cancelled
 *
 * IMMUTABLE RULES:
 * 1. received ≠ usable stock — receiving truth와 inventory available truth 분리
 * 2. quality/safety/release gate를 거쳐야만 available stock으로 전이
 * 3. line 단위 qty match/mismatch, damage, expiry, lot capture
 * 4. discrepancy 발견 시 quarantine 또는 operator 결정 필요
 * 5. partially_received는 누적 수령 — 잔여분은 별도 추적
 * 6. unresolved discrepancy가 있으면 received(terminal) 진입 차단
 */

import type { ExpectedReceiptLine, ReceivingExecutionHandoff } from "./receiving-preparation-governance-engine";
import { getStatusLabel } from "./governance-grammar-registry";

// ══════════════════════════════════════════════
// Receiving Execution Status
// ══════════════════════════════════════════════

export type ReceivingGovExecutionStatus =
  | "awaiting_receipt"
  | "receiving_in_progress"
  | "partially_received"
  | "received"
  | "discrepancy"
  | "quarantined"
  | "cancelled";

/** Terminal states */
export const RECEIVING_GOV_TERMINAL: readonly ReceivingGovExecutionStatus[] = ["received", "cancelled"] as const;

/** Valid transitions */
const RECEIVING_GOV_TRANSITIONS: Record<ReceivingGovExecutionStatus, ReceivingGovExecutionStatus[]> = {
  awaiting_receipt: ["receiving_in_progress", "cancelled"],
  receiving_in_progress: ["received", "partially_received", "discrepancy", "cancelled"],
  partially_received: ["receiving_in_progress", "received", "discrepancy", "cancelled"],
  received: [], // terminal
  discrepancy: ["quarantined", "receiving_in_progress", "received", "cancelled"],
  quarantined: ["receiving_in_progress", "discrepancy", "cancelled"],
  cancelled: [], // terminal
};

// ══════════════════════════════════════════════
// Received Line — 실제 수령 라인
// ══════════════════════════════════════════════

export interface GovReceivedLine {
  lineId: string;
  itemName: string;
  expectedQuantity: number;
  receivedQuantity: number;
  lotNumber: string;
  expiryDate: string | null;
  quantityMatch: "exact" | "over" | "under" | "zero";
  hasDamage: boolean;
  damageDescription: string;
  hasExpiryIssue: boolean;
  expiryIssueDetail: string;
  documentMismatch: boolean;
  documentMismatchDetail: string;
  lineResult: "accepted" | "accepted_with_note" | "rejected" | "quarantined" | "pending";
  inspectionNote: string;
}

// ══════════════════════════════════════════════
// Discrepancy
// ══════════════════════════════════════════════

export type GovDiscrepancyType =
  | "quantity_mismatch"
  | "damaged_goods"
  | "expiry_issue"
  | "wrong_item"
  | "document_mismatch"
  | "lot_number_missing"
  | "packaging_issue"
  | "temperature_excursion";

export interface GovReceivingDiscrepancy {
  discrepancyId: string;
  lineId: string;
  type: GovDiscrepancyType;
  severity: "minor" | "major" | "critical";
  detail: string;
  resolution: "pending" | "accepted_as_is" | "return_to_supplier" | "quarantined" | "adjusted";
  resolutionNote: string;
}

// ══════════════════════════════════════════════
// Receiving Execution Governance State
// ══════════════════════════════════════════════

export interface ReceivingExecutionGovernanceState {
  executionId: string;
  caseId: string;
  poNumber: string;
  status: ReceivingGovExecutionStatus;
  // Expected (from prep handoff)
  expectedLines: ExpectedReceiptLine[];
  expectedTotalAmount: number;
  // Actual received
  receivedLines: GovReceivedLine[];
  totalReceivedQuantity: number;
  totalExpectedQuantity: number;
  // Discrepancies
  discrepancies: GovReceivingDiscrepancy[];
  hasUnresolvedDiscrepancies: boolean;
  // Quarantine
  quarantinedLineIds: string[];
  quarantineReason: string;
  // Summary
  receiptCompleteness: number; // 0-100
  acceptedLineCount: number;
  rejectedLineCount: number;
  pendingLineCount: number;
  // Site
  receivingSite: string;
  storageLocation: string;
  // Timestamps
  receiptStartedAt: string | null;
  receiptCompletedAt: string | null;
  // Linkage
  receivingPrepStateId: string;
  confirmationGovernanceId: string;
  executionLinkageId: string;
  payloadSnapshotId: string;
  poCreatedObjectId: string;
  // Audit
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

// ══════════════════════════════════════════════
// Create from Handoff
// ══════════════════════════════════════════════

export function createReceivingExecutionGovernanceState(
  handoff: ReceivingExecutionHandoff,
  actor: string,
): ReceivingExecutionGovernanceState {
  const now = new Date().toISOString();
  const totalExpected = handoff.expectedLines.reduce((sum, l) => sum + l.expectedQuantity, 0);

  return {
    executionId: `rexecgov_${Date.now().toString(36)}`,
    caseId: handoff.caseId,
    poNumber: handoff.poNumber,
    status: "awaiting_receipt",
    expectedLines: handoff.expectedLines,
    expectedTotalAmount: handoff.expectedTotalAmount,
    receivedLines: [],
    totalReceivedQuantity: 0,
    totalExpectedQuantity: totalExpected,
    discrepancies: [],
    hasUnresolvedDiscrepancies: false,
    quarantinedLineIds: [],
    quarantineReason: "",
    receiptCompleteness: 0,
    acceptedLineCount: 0,
    rejectedLineCount: 0,
    pendingLineCount: handoff.expectedLines.length,
    receivingSite: handoff.receivingSite,
    storageLocation: handoff.storageLocation,
    receiptStartedAt: null,
    receiptCompletedAt: null,
    receivingPrepStateId: handoff.stateId,
    confirmationGovernanceId: handoff.confirmationGovernanceId,
    executionLinkageId: handoff.executionId,
    payloadSnapshotId: handoff.payloadSnapshotId,
    poCreatedObjectId: handoff.poCreatedObjectId,
    createdAt: now,
    updatedAt: now,
    updatedBy: actor,
  };
}

// ══════════════════════════════════════════════
// Transition Validation
// ══════════════════════════════════════════════

export interface ReceivingGovTransitionResult {
  success: boolean;
  state: ReceivingExecutionGovernanceState;
  error: string | null;
}

function validateTransition(from: ReceivingGovExecutionStatus, to: ReceivingGovExecutionStatus): string | null {
  if (RECEIVING_GOV_TERMINAL.includes(from)) {
    return `Cannot transition from terminal status '${from}'`;
  }
  if (!RECEIVING_GOV_TRANSITIONS[from].includes(to)) {
    return `Invalid transition: ${from} → ${to}. Allowed: ${RECEIVING_GOV_TRANSITIONS[from].join(", ") || "none"}`;
  }
  return null;
}

// ══════════════════════════════════════════════
// Start Receiving
// ══════════════════════════════════════════════

export function startReceivingGov(
  state: ReceivingExecutionGovernanceState,
  actor: string,
): ReceivingGovTransitionResult {
  const error = validateTransition(state.status, "receiving_in_progress");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "receiving_in_progress",
      receiptStartedAt: state.receiptStartedAt || now,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Record Line Receipt
// ══════════════════════════════════════════════

export function recordLineReceiptGov(
  state: ReceivingExecutionGovernanceState,
  line: GovReceivedLine,
  actor: string,
): ReceivingGovTransitionResult {
  if (state.status !== "receiving_in_progress" && state.status !== "partially_received") {
    return { success: false, state, error: `현재 상태 '${state.status}'에서 라인 수령 불가` };
  }

  const existingIdx = state.receivedLines.findIndex(l => l.lineId === line.lineId);
  const updatedLines = [...state.receivedLines];
  if (existingIdx >= 0) {
    updatedLines[existingIdx] = line;
  } else {
    updatedLines.push(line);
  }

  // Auto-detect discrepancies
  const newDiscrepancies = [...state.discrepancies.filter(d => d.lineId !== line.lineId)];

  if (line.quantityMatch !== "exact") {
    newDiscrepancies.push({
      discrepancyId: `disc_${line.lineId}_qty`,
      lineId: line.lineId,
      type: "quantity_mismatch",
      severity: line.quantityMatch === "zero" ? "critical" : "major",
      detail: `예상 ${line.expectedQuantity} / 실수령 ${line.receivedQuantity}`,
      resolution: "pending",
      resolutionNote: "",
    });
  }

  if (line.hasDamage) {
    newDiscrepancies.push({
      discrepancyId: `disc_${line.lineId}_dmg`,
      lineId: line.lineId,
      type: "damaged_goods",
      severity: "major",
      detail: line.damageDescription || "파손 확인됨",
      resolution: "pending",
      resolutionNote: "",
    });
  }

  if (line.hasExpiryIssue) {
    newDiscrepancies.push({
      discrepancyId: `disc_${line.lineId}_exp`,
      lineId: line.lineId,
      type: "expiry_issue",
      severity: "critical",
      detail: line.expiryIssueDetail || "유효기한 문제",
      resolution: "pending",
      resolutionNote: "",
    });
  }

  if (line.documentMismatch) {
    newDiscrepancies.push({
      discrepancyId: `disc_${line.lineId}_doc`,
      lineId: line.lineId,
      type: "document_mismatch",
      severity: "minor",
      detail: line.documentMismatchDetail || "서류 불일치",
      resolution: "pending",
      resolutionNote: "",
    });
  }

  if (!line.lotNumber) {
    newDiscrepancies.push({
      discrepancyId: `disc_${line.lineId}_lot`,
      lineId: line.lineId,
      type: "lot_number_missing",
      severity: "minor",
      detail: "Lot 번호 미기재",
      resolution: "pending",
      resolutionNote: "",
    });
  }

  // Recalculate summary
  const totalReceived = updatedLines.reduce((sum, l) => sum + l.receivedQuantity, 0);
  const completeness = state.totalExpectedQuantity > 0 ? Math.round((totalReceived / state.totalExpectedQuantity) * 100) : 0;
  const accepted = updatedLines.filter(l => l.lineResult === "accepted" || l.lineResult === "accepted_with_note").length;
  const rejected = updatedLines.filter(l => l.lineResult === "rejected").length;
  const pending = state.expectedLines.length - updatedLines.length + updatedLines.filter(l => l.lineResult === "pending").length;
  const hasUnresolved = newDiscrepancies.some(d => d.resolution === "pending");

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      receivedLines: updatedLines,
      totalReceivedQuantity: totalReceived,
      discrepancies: newDiscrepancies,
      hasUnresolvedDiscrepancies: hasUnresolved,
      receiptCompleteness: Math.min(completeness, 100),
      acceptedLineCount: accepted,
      rejectedLineCount: rejected,
      pendingLineCount: pending,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Mark Partially Received
// ══════════════════════════════════════════════

export function markPartiallyReceivedGov(
  state: ReceivingExecutionGovernanceState,
  actor: string,
): ReceivingGovTransitionResult {
  const error = validateTransition(state.status, "partially_received");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: { ...state, status: "partially_received", updatedAt: now, updatedBy: actor },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Mark Received (complete) — terminal
// ══════════════════════════════════════════════

export function markReceivedGov(
  state: ReceivingExecutionGovernanceState,
  actor: string,
): ReceivingGovTransitionResult {
  const error = validateTransition(state.status, "received");
  if (error) return { success: false, state, error };

  if (state.hasUnresolvedDiscrepancies) {
    return { success: false, state, error: "미해결 불일치 존재 — 모든 불일치 처리 후 완료 가능" };
  }

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "received",
      receiptCompletedAt: now,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Mark Discrepancy
// ══════════════════════════════════════════════

export function markDiscrepancyGov(
  state: ReceivingExecutionGovernanceState,
  actor: string,
): ReceivingGovTransitionResult {
  const error = validateTransition(state.status, "discrepancy");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: { ...state, status: "discrepancy", updatedAt: now, updatedBy: actor },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Quarantine
// ══════════════════════════════════════════════

export function quarantineReceiptGov(
  state: ReceivingExecutionGovernanceState,
  lineIds: string[],
  reason: string,
  actor: string,
): ReceivingGovTransitionResult {
  const error = validateTransition(state.status, "quarantined");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "quarantined",
      quarantinedLineIds: lineIds,
      quarantineReason: reason,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Resolve Discrepancy
// ══════════════════════════════════════════════

export function resolveDiscrepancyGov(
  state: ReceivingExecutionGovernanceState,
  discrepancyId: string,
  resolution: GovReceivingDiscrepancy["resolution"],
  note: string,
  actor: string,
): ReceivingGovTransitionResult {
  const discIdx = state.discrepancies.findIndex(d => d.discrepancyId === discrepancyId);
  if (discIdx < 0) {
    return { success: false, state, error: `불일치 ID '${discrepancyId}' 미발견` };
  }

  const updatedDisc = [...state.discrepancies];
  updatedDisc[discIdx] = { ...updatedDisc[discIdx], resolution, resolutionNote: note };

  const hasUnresolved = updatedDisc.some(d => d.resolution === "pending");
  const now = new Date().toISOString();

  return {
    success: true,
    state: {
      ...state,
      discrepancies: updatedDisc,
      hasUnresolvedDiscrepancies: hasUnresolved,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Cancel
// ══════════════════════════════════════════════

export function cancelReceivingExecutionGov(
  state: ReceivingExecutionGovernanceState,
  reason: string,
  actor: string,
): ReceivingGovTransitionResult {
  const error = validateTransition(state.status, "cancelled");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: { ...state, status: "cancelled", updatedAt: now, updatedBy: actor },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Receiving Execution Governance Surface — UI 투사
// ══════════════════════════════════════════════

export interface ReceivingExecutionGovSurface {
  status: ReceivingGovExecutionStatus;
  statusLabel: string;
  statusColor: "slate" | "blue" | "amber" | "emerald" | "red";
  isTerminal: boolean;
  primaryMessage: string;
  nextAction: string;
  // Summary
  completeness: number;
  expectedLineCount: number;
  receivedLineCount: number;
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
  discrepancyCount: number;
  unresolvedDiscrepancyCount: number;
  quarantinedCount: number;
  // Dock actions
  canStartReceiving: boolean;
  canRecordLine: boolean;
  canMarkPartial: boolean;
  canMarkComplete: boolean;
  canMarkDiscrepancy: boolean;
  canQuarantine: boolean;
  canCancel: boolean;
  canReopenPrep: boolean;
  // Delta (expected vs received)
  lineDelta: Array<{
    lineId: string;
    itemName: string;
    expected: number;
    received: number;
    match: "exact" | "over" | "under" | "zero" | "pending";
    issues: string[];
  }>;
}

/** Status labels — grammar registry 직접 소비. 하드코딩 금지. */
function getReceivingExecStatusLabel(status: ReceivingGovExecutionStatus): string {
  return getStatusLabel("receiving_execution", status);
}

const GOV_STATUS_COLORS: Record<ReceivingGovExecutionStatus, ReceivingExecutionGovSurface["statusColor"]> = {
  awaiting_receipt: "blue",
  receiving_in_progress: "amber",
  partially_received: "amber",
  received: "emerald",
  discrepancy: "red",
  quarantined: "red",
  cancelled: "slate",
};

export function buildReceivingExecutionGovSurface(state: ReceivingExecutionGovernanceState): ReceivingExecutionGovSurface {
  const isTerminal = RECEIVING_GOV_TERMINAL.includes(state.status);
  const unresolvedCount = state.discrepancies.filter(d => d.resolution === "pending").length;

  const primaryMessage = state.status === "awaiting_receipt"
    ? `입고 대기 — ${state.expectedLines.length}건 ${state.totalExpectedQuantity}개 예정`
    : state.status === "receiving_in_progress"
      ? `입고 진행 — ${state.receiptCompleteness}% 완료`
    : state.status === "partially_received"
      ? `부분 입고 — ${state.receivedLines.length}/${state.expectedLines.length}건, ${state.receiptCompleteness}%`
    : state.status === "received"
      ? `입고 완료 — ${state.acceptedLineCount}건 수락, ${state.rejectedLineCount}건 거부`
    : state.status === "discrepancy"
      ? `불일치 ${state.discrepancies.length}건 — ${unresolvedCount}건 미해결`
    : state.status === "quarantined"
      ? `${state.quarantinedLineIds.length}건 격리 — ${state.quarantineReason}`
    : "입고 취소됨";

  const nextAction = state.status === "awaiting_receipt"
    ? "입고 시작"
    : state.status === "receiving_in_progress"
      ? "라인별 수령 기록"
    : state.status === "partially_received"
      ? "잔여 라인 계속 또는 부분 완료"
    : state.status === "received"
      ? "Stock Release Gate 진입"
    : state.status === "discrepancy"
      ? "불일치 처리 (격리/수락/반품)"
    : state.status === "quarantined"
      ? "격리 해제 또는 반품 결정"
    : "재시작하려면 Receiving Prep 재진입";

  const lineDelta = state.expectedLines.map(expected => {
    const received = state.receivedLines.find(r => r.lineId === expected.lineId);
    const issues: string[] = [];
    if (received) {
      if (received.hasDamage) issues.push("파손");
      if (received.hasExpiryIssue) issues.push("유효기한");
      if (received.documentMismatch) issues.push("서류불일치");
      if (!received.lotNumber) issues.push("Lot미기재");
    }
    return {
      lineId: expected.lineId,
      itemName: expected.itemName,
      expected: expected.expectedQuantity,
      received: received?.receivedQuantity ?? 0,
      match: received ? received.quantityMatch : "pending" as const,
      issues,
    };
  });

  return {
    status: state.status,
    statusLabel: getReceivingExecStatusLabel(state.status),
    statusColor: GOV_STATUS_COLORS[state.status],
    isTerminal,
    primaryMessage,
    nextAction,
    completeness: state.receiptCompleteness,
    expectedLineCount: state.expectedLines.length,
    receivedLineCount: state.receivedLines.length,
    acceptedCount: state.acceptedLineCount,
    rejectedCount: state.rejectedLineCount,
    pendingCount: state.pendingLineCount,
    discrepancyCount: state.discrepancies.length,
    unresolvedDiscrepancyCount: unresolvedCount,
    quarantinedCount: state.quarantinedLineIds.length,
    canStartReceiving: state.status === "awaiting_receipt",
    canRecordLine: state.status === "receiving_in_progress" || state.status === "partially_received",
    canMarkPartial: state.status === "receiving_in_progress",
    canMarkComplete: (state.status === "receiving_in_progress" || state.status === "partially_received" || state.status === "discrepancy") && !state.hasUnresolvedDiscrepancies,
    canMarkDiscrepancy: state.status === "receiving_in_progress" || state.status === "partially_received",
    canQuarantine: state.status === "discrepancy",
    canCancel: !isTerminal,
    canReopenPrep: state.status === "awaiting_receipt",
    lineDelta,
  };
}

// ══════════════════════════════════════════════
// Stock Release Gate Handoff — received에서만
// ══════════════════════════════════════════════

export interface StockReleaseGateHandoff {
  receivingExecutionId: string;
  caseId: string;
  poNumber: string;
  acceptedLines: GovReceivedLine[];
  rejectedLines: GovReceivedLine[];
  resolvedDiscrepancies: GovReceivingDiscrepancy[];
  totalAcceptedQuantity: number;
  receivingSite: string;
  storageLocation: string;
  receiptCompletedAt: string;
  receivingPrepStateId: string;
  confirmationGovernanceId: string;
  executionLinkageId: string;
  poCreatedObjectId: string;
}

export function buildStockReleaseGateHandoff(
  state: ReceivingExecutionGovernanceState,
): StockReleaseGateHandoff | null {
  if (state.status !== "received") return null;

  const accepted = state.receivedLines.filter(l => l.lineResult === "accepted" || l.lineResult === "accepted_with_note");
  const rejected = state.receivedLines.filter(l => l.lineResult === "rejected");
  const resolved = state.discrepancies.filter(d => d.resolution !== "pending");

  return {
    receivingExecutionId: state.executionId,
    caseId: state.caseId,
    poNumber: state.poNumber,
    acceptedLines: accepted,
    rejectedLines: rejected,
    resolvedDiscrepancies: resolved,
    totalAcceptedQuantity: accepted.reduce((sum, l) => sum + l.receivedQuantity, 0),
    receivingSite: state.receivingSite,
    storageLocation: state.storageLocation,
    receiptCompletedAt: state.receiptCompletedAt || state.updatedAt,
    receivingPrepStateId: state.receivingPrepStateId,
    confirmationGovernanceId: state.confirmationGovernanceId,
    executionLinkageId: state.executionLinkageId,
    poCreatedObjectId: state.poCreatedObjectId,
  };
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type ReceivingGovExecutionEventType =
  | "receiving_gov_started"
  | "receiving_gov_line_received"
  | "receiving_gov_partial_recorded"
  | "receiving_gov_completed"
  | "receiving_gov_discrepancy_detected"
  | "receiving_gov_discrepancy_resolved"
  | "receiving_gov_quarantined"
  | "receiving_gov_quarantine_released"
  | "receiving_gov_cancelled"
  | "stock_release_gate_handoff_created";

export interface ReceivingGovExecutionEvent {
  type: ReceivingGovExecutionEventType;
  executionId: string;
  caseId: string;
  poNumber: string;
  fromStatus: ReceivingGovExecutionStatus;
  toStatus: ReceivingGovExecutionStatus;
  actor: string;
  timestamp: string;
  detail: string;
}
