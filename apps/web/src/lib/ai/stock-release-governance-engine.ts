/**
 * Stock Release Governance Engine
 *
 * received ≠ available stock.
 * receiving execution (governance) → stock release gate → quality/safety hold → release → available stock handoff
 *
 * 기존 stock-release-readiness-gate-engine.ts의 5-axis model 위에
 * 상태 머신 + hold management + line-level release/held separation + reorder handoff 추가.
 *
 * IMMUTABLE RULES:
 * 1. received ≠ usable stock — release gate를 통과해야만 available stock
 * 2. quality/safety/compliance hold가 있으면 release 차단
 * 3. quarantine 라인은 release scope에서 반드시 제외
 * 4. unresolved discrepancy가 있으면 해당 라인 release 차단
 * 5. release는 line 단위 — 전체 일괄 release가 아님
 * 6. lot/expiry 검증 실패 라인은 hold
 * 7. released ≠ consumed — available stock handoff 이후 소비는 별도 추적
 */

import type { StockReleaseGateHandoff, GovReceivedLine, GovReceivingDiscrepancy } from "./receiving-execution-governance-engine";
import { getStatusLabel } from "./governance-grammar-registry";

// ══════════════════════════════════════════════
// Stock Release Status
// ══════════════════════════════════════════════

export type StockReleaseGovStatus =
  | "not_evaluated"
  | "evaluating"
  | "hold_active"
  | "partially_released"
  | "released"
  | "cancelled";

/** Terminal states */
export const RELEASE_TERMINAL: readonly StockReleaseGovStatus[] = ["released", "cancelled"] as const;

/** Valid transitions */
const RELEASE_TRANSITIONS: Record<StockReleaseGovStatus, StockReleaseGovStatus[]> = {
  not_evaluated: ["evaluating", "cancelled"],
  evaluating: ["hold_active", "partially_released", "released", "cancelled"],
  hold_active: ["evaluating", "partially_released", "released", "cancelled"],
  partially_released: ["evaluating", "released", "cancelled"],
  released: [], // terminal
  cancelled: [], // terminal
};

// ══════════════════════════════════════════════
// Hold — quality / safety / compliance
// ══════════════════════════════════════════════

export type HoldType =
  | "quality_review"
  | "safety_review"
  | "compliance_review"
  | "expiry_concern"
  | "lot_traceability"
  | "document_incomplete"
  | "quarantine_unresolved"
  | "discrepancy_unresolved"
  | "operator_manual";

export interface StockHold {
  holdId: string;
  type: HoldType;
  severity: "hard" | "soft";
  affectedLineIds: string[];
  reason: string;
  placedAt: string;
  placedBy: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: "released" | "returned" | "destroyed" | "reclassified" | null;
  resolutionNote: string;
}

// ══════════════════════════════════════════════
// Release Line — line 단위 release 판단
// ══════════════════════════════════════════════

export interface ReleaseLineDecision {
  lineId: string;
  itemName: string;
  receivedQuantity: number;
  releasableQuantity: number;
  heldQuantity: number;
  holdReasons: string[];
  lotNumber: string;
  expiryDate: string | null;
  expiryValid: boolean;
  lotTraceValid: boolean;
  qualityStatus: "passed" | "pending" | "failed" | "hold";
  releaseDecision: "release" | "hold" | "return" | "destroy" | "pending";
}

// ══════════════════════════════════════════════
// Stock Release Governance State
// ══════════════════════════════════════════════

export interface StockReleaseGovernanceState {
  governanceId: string;
  caseId: string;
  poNumber: string;
  status: StockReleaseGovStatus;
  // Lines
  releaseLines: ReleaseLineDecision[];
  totalReceivedQuantity: number;
  totalReleasableQuantity: number;
  totalHeldQuantity: number;
  // Holds
  activeHolds: StockHold[];
  resolvedHolds: StockHold[];
  hasUnresolvedHolds: boolean;
  // Quality/Safety
  qualityReviewComplete: boolean;
  safetyReviewComplete: boolean;
  complianceReviewComplete: boolean;
  // Summary
  releaseCompleteness: number; // 0-100
  releasedLineCount: number;
  heldLineCount: number;
  pendingLineCount: number;
  // Site
  receivingSite: string;
  storageLocation: string;
  // Linkage
  receivingExecutionId: string;
  receivingPrepStateId: string;
  confirmationGovernanceId: string;
  executionLinkageId: string;
  poCreatedObjectId: string;
  // Audit
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

// ══════════════════════════════════════════════
// Create from Handoff
// ══════════════════════════════════════════════

export function createStockReleaseGovernanceState(
  handoff: StockReleaseGateHandoff,
  actor: string,
): StockReleaseGovernanceState {
  const now = new Date().toISOString();

  // Build initial release lines from accepted received lines
  const releaseLines: ReleaseLineDecision[] = handoff.acceptedLines.map(line => ({
    lineId: line.lineId,
    itemName: line.itemName,
    receivedQuantity: line.receivedQuantity,
    releasableQuantity: 0, // starts at 0 — must pass gates
    heldQuantity: line.receivedQuantity, // all held until evaluated
    holdReasons: ["평가 전 — 릴리즈 미확정"],
    lotNumber: line.lotNumber,
    expiryDate: line.expiryDate,
    expiryValid: false, // pending
    lotTraceValid: !!line.lotNumber,
    qualityStatus: "pending",
    releaseDecision: "pending",
  }));

  const totalReceived = releaseLines.reduce((s, l) => s + l.receivedQuantity, 0);

  return {
    governanceId: `srgov_${Date.now().toString(36)}`,
    caseId: handoff.caseId,
    poNumber: handoff.poNumber,
    status: "not_evaluated",
    releaseLines,
    totalReceivedQuantity: totalReceived,
    totalReleasableQuantity: 0,
    totalHeldQuantity: totalReceived,
    activeHolds: [],
    resolvedHolds: [],
    hasUnresolvedHolds: false,
    qualityReviewComplete: false,
    safetyReviewComplete: false,
    complianceReviewComplete: false,
    releaseCompleteness: 0,
    releasedLineCount: 0,
    heldLineCount: releaseLines.length,
    pendingLineCount: 0,
    receivingSite: handoff.receivingSite,
    storageLocation: handoff.storageLocation,
    receivingExecutionId: handoff.receivingExecutionId,
    receivingPrepStateId: handoff.receivingPrepStateId,
    confirmationGovernanceId: handoff.confirmationGovernanceId,
    executionLinkageId: handoff.executionLinkageId,
    poCreatedObjectId: handoff.poCreatedObjectId,
    createdAt: now,
    updatedAt: now,
    updatedBy: actor,
  };
}

// ══════════════════════════════════════════════
// Transition Validation
// ══════════════════════════════════════════════

export interface ReleaseGovTransitionResult {
  success: boolean;
  state: StockReleaseGovernanceState;
  error: string | null;
}

function validateTransition(from: StockReleaseGovStatus, to: StockReleaseGovStatus): string | null {
  if (RELEASE_TERMINAL.includes(from)) {
    return `Cannot transition from terminal status '${from}'`;
  }
  if (!RELEASE_TRANSITIONS[from].includes(to)) {
    return `Invalid transition: ${from} → ${to}. Allowed: ${RELEASE_TRANSITIONS[from].join(", ") || "none"}`;
  }
  return null;
}

// ══════════════════════════════════════════════
// Start Evaluation
// ══════════════════════════════════════════════

export function startEvaluation(
  state: StockReleaseGovernanceState,
  actor: string,
): ReleaseGovTransitionResult {
  const error = validateTransition(state.status, "evaluating");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: { ...state, status: "evaluating", updatedAt: now, updatedBy: actor },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Evaluate Line — lot/expiry/quality per line
// ══════════════════════════════════════════════

export interface LineEvaluationInput {
  lineId: string;
  expiryValid: boolean;
  lotTraceValid: boolean;
  qualityStatus: ReleaseLineDecision["qualityStatus"];
  releaseDecision: ReleaseLineDecision["releaseDecision"];
  holdReasons?: string[];
}

export function evaluateReleaseLine(
  state: StockReleaseGovernanceState,
  input: LineEvaluationInput,
  actor: string,
): ReleaseGovTransitionResult {
  if (state.status !== "evaluating" && state.status !== "hold_active" && state.status !== "partially_released") {
    return { success: false, state, error: `현재 상태 '${state.status}'에서 라인 평가 불가` };
  }

  const lineIdx = state.releaseLines.findIndex(l => l.lineId === input.lineId);
  if (lineIdx < 0) {
    return { success: false, state, error: `라인 ID '${input.lineId}' 미발견` };
  }

  const updatedLines = [...state.releaseLines];
  const line = { ...updatedLines[lineIdx] };

  line.expiryValid = input.expiryValid;
  line.lotTraceValid = input.lotTraceValid;
  line.qualityStatus = input.qualityStatus;
  line.releaseDecision = input.releaseDecision;

  if (input.releaseDecision === "release" && input.qualityStatus === "passed" && input.expiryValid && input.lotTraceValid) {
    line.releasableQuantity = line.receivedQuantity;
    line.heldQuantity = 0;
    line.holdReasons = [];
  } else if (input.releaseDecision === "hold") {
    line.releasableQuantity = 0;
    line.heldQuantity = line.receivedQuantity;
    line.holdReasons = input.holdReasons || ["보류"];
  } else if (input.releaseDecision === "return" || input.releaseDecision === "destroy") {
    line.releasableQuantity = 0;
    line.heldQuantity = 0;
    line.holdReasons = [input.releaseDecision === "return" ? "공급사 반품" : "폐기"];
  } else {
    // pending or partial conditions
    const reasons: string[] = [];
    if (!input.expiryValid) reasons.push("유효기한 검증 실패");
    if (!input.lotTraceValid) reasons.push("Lot 추적 불가");
    if (input.qualityStatus === "failed") reasons.push("품질 검증 실패");
    if (input.qualityStatus === "hold") reasons.push("품질 보류");
    if (input.qualityStatus === "pending") reasons.push("품질 미검증");
    line.releasableQuantity = 0;
    line.heldQuantity = line.receivedQuantity;
    line.holdReasons = reasons.length > 0 ? reasons : ["평가 미완료"];
  }

  updatedLines[lineIdx] = line;

  // Recalculate totals
  const totalReleasable = updatedLines.reduce((s, l) => s + l.releasableQuantity, 0);
  const totalHeld = updatedLines.reduce((s, l) => s + l.heldQuantity, 0);
  const released = updatedLines.filter(l => l.releaseDecision === "release" && l.releasableQuantity > 0).length;
  const held = updatedLines.filter(l => l.releaseDecision === "hold" || l.heldQuantity > 0).length;
  const pending = updatedLines.filter(l => l.releaseDecision === "pending").length;
  const completeness = state.totalReceivedQuantity > 0 ? Math.round((totalReleasable / state.totalReceivedQuantity) * 100) : 0;

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      releaseLines: updatedLines,
      totalReleasableQuantity: totalReleasable,
      totalHeldQuantity: totalHeld,
      releaseCompleteness: completeness,
      releasedLineCount: released,
      heldLineCount: held,
      pendingLineCount: pending,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Place Hold
// ══════════════════════════════════════════════

export function placeHold(
  state: StockReleaseGovernanceState,
  hold: Omit<StockHold, "holdId" | "placedAt" | "resolvedAt" | "resolvedBy" | "resolution" | "resolutionNote">,
  actor: string,
): ReleaseGovTransitionResult {
  if (RELEASE_TERMINAL.includes(state.status)) {
    return { success: false, state, error: `Terminal 상태에서 hold 불가` };
  }

  const now = new Date().toISOString();
  const newHold: StockHold = {
    holdId: `hold_${Date.now().toString(36)}`,
    ...hold,
    placedAt: now,
    placedBy: actor,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
    resolutionNote: "",
  };

  const targetStatus: StockReleaseGovStatus = "hold_active";
  if (state.status !== "hold_active") {
    const err = validateTransition(state.status, targetStatus);
    if (err && state.status !== "evaluating" && state.status !== "partially_released") {
      return { success: false, state, error: err };
    }
  }

  return {
    success: true,
    state: {
      ...state,
      status: "hold_active",
      activeHolds: [...state.activeHolds, newHold],
      hasUnresolvedHolds: true,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Resolve Hold
// ══════════════════════════════════════════════

export function resolveHold(
  state: StockReleaseGovernanceState,
  holdId: string,
  resolution: NonNullable<StockHold["resolution"]>,
  note: string,
  actor: string,
): ReleaseGovTransitionResult {
  const holdIdx = state.activeHolds.findIndex(h => h.holdId === holdId);
  if (holdIdx < 0) {
    return { success: false, state, error: `Hold ID '${holdId}' 미발견` };
  }

  const now = new Date().toISOString();
  const resolved = { ...state.activeHolds[holdIdx], resolvedAt: now, resolvedBy: actor, resolution, resolutionNote: note };
  const remaining = state.activeHolds.filter((_, i) => i !== holdIdx);

  return {
    success: true,
    state: {
      ...state,
      activeHolds: remaining,
      resolvedHolds: [...state.resolvedHolds, resolved],
      hasUnresolvedHolds: remaining.length > 0,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Complete Quality/Safety/Compliance Review
// ══════════════════════════════════════════════

export function completeReview(
  state: StockReleaseGovernanceState,
  reviewType: "quality" | "safety" | "compliance",
  actor: string,
): ReleaseGovTransitionResult {
  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      qualityReviewComplete: reviewType === "quality" ? true : state.qualityReviewComplete,
      safetyReviewComplete: reviewType === "safety" ? true : state.safetyReviewComplete,
      complianceReviewComplete: reviewType === "compliance" ? true : state.complianceReviewComplete,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Mark Partially Released
// ══════════════════════════════════════════════

export function markPartiallyReleased(
  state: StockReleaseGovernanceState,
  actor: string,
): ReleaseGovTransitionResult {
  const error = validateTransition(state.status, "partially_released");
  if (error) return { success: false, state, error };

  if (state.totalReleasableQuantity === 0) {
    return { success: false, state, error: "릴리즈 가능 수량 0 — 부분 릴리즈 불가" };
  }

  const now = new Date().toISOString();
  return {
    success: true,
    state: { ...state, status: "partially_released", updatedAt: now, updatedBy: actor },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Mark Released (full) — terminal
// ══════════════════════════════════════════════

export function markReleased(
  state: StockReleaseGovernanceState,
  actor: string,
): ReleaseGovTransitionResult {
  const error = validateTransition(state.status, "released");
  if (error) return { success: false, state, error };

  if (state.hasUnresolvedHolds) {
    return { success: false, state, error: "미해결 hold 존재 — 모든 hold 처리 후 릴리즈 가능" };
  }

  if (state.releaseLines.some(l => l.releaseDecision === "pending")) {
    return { success: false, state, error: "미평가 라인 존재 — 모든 라인 평가 후 릴리즈 가능" };
  }

  const now = new Date().toISOString();
  return {
    success: true,
    state: { ...state, status: "released", updatedAt: now, updatedBy: actor },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Cancel
// ══════════════════════════════════════════════

export function cancelStockRelease(
  state: StockReleaseGovernanceState,
  reason: string,
  actor: string,
): ReleaseGovTransitionResult {
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
// Stock Release Surface — UI 투사
// ══════════════════════════════════════════════

export interface StockReleaseGovSurface {
  status: StockReleaseGovStatus;
  statusLabel: string;
  statusColor: "slate" | "blue" | "amber" | "emerald" | "red";
  isTerminal: boolean;
  primaryMessage: string;
  nextAction: string;
  // Summary
  totalReceived: number;
  totalReleasable: number;
  totalHeld: number;
  completeness: number;
  releasedCount: number;
  heldCount: number;
  pendingCount: number;
  // Reviews
  qualityDone: boolean;
  safetyDone: boolean;
  complianceDone: boolean;
  allReviewsDone: boolean;
  // Holds
  activeHoldCount: number;
  hasUnresolvedHolds: boolean;
  // Dock actions
  canEvaluate: boolean;
  canPlaceHold: boolean;
  canPartialRelease: boolean;
  canFullRelease: boolean;
  canCancel: boolean;
  canReopenReceiving: boolean;
  // Line detail
  lineDecisions: Array<{
    lineId: string;
    itemName: string;
    received: number;
    releasable: number;
    held: number;
    decision: string;
    holdReasons: string[];
    qualityStatus: string;
  }>;
}

/** Status labels — grammar registry 직접 소비. 하드코딩 금지. */
function getReleaseStatusLabel(status: StockReleaseGovStatus): string {
  return getStatusLabel("stock_release", status);
}

const RELEASE_STATUS_COLORS: Record<StockReleaseGovStatus, StockReleaseGovSurface["statusColor"]> = {
  not_evaluated: "slate",
  evaluating: "blue",
  hold_active: "amber",
  partially_released: "amber",
  released: "emerald",
  cancelled: "slate",
};

export function buildStockReleaseGovSurface(state: StockReleaseGovernanceState): StockReleaseGovSurface {
  const isTerminal = RELEASE_TERMINAL.includes(state.status);
  const allReviews = state.qualityReviewComplete && state.safetyReviewComplete && state.complianceReviewComplete;
  const noPending = !state.releaseLines.some(l => l.releaseDecision === "pending");

  const primaryMessage = state.status === "not_evaluated"
    ? `릴리즈 평가 대기 — ${state.releaseLines.length}건 ${state.totalReceivedQuantity}개`
    : state.status === "evaluating"
      ? `릴리즈 평가 중 — ${state.releasedLineCount}/${state.releaseLines.length}건 완료`
    : state.status === "hold_active"
      ? `보류 ${state.activeHolds.length}건 활성 — 해결 필요`
    : state.status === "partially_released"
      ? `부분 릴리즈 — ${state.totalReleasableQuantity}/${state.totalReceivedQuantity}개 (${state.releaseCompleteness}%)`
    : state.status === "released"
      ? `릴리즈 완료 — ${state.totalReleasableQuantity}개 가용 재고 반영`
    : "취소됨";

  const nextAction = state.status === "not_evaluated"
    ? "릴리즈 평가 시작"
    : state.status === "evaluating"
      ? noPending ? (allReviews ? "릴리즈 확정" : "품질/안전/준법 리뷰 완료 필요") : "라인별 품질/lot/expiry 평가"
    : state.status === "hold_active"
      ? `보류 ${state.activeHolds.length}건 해결 후 릴리즈`
    : state.status === "partially_released"
      ? "잔여 라인 평가 후 전량 릴리즈"
    : state.status === "released"
      ? "Reorder Decision 또는 완료"
    : "재시작하려면 Receiving 재진입";

  return {
    status: state.status,
    statusLabel: getReleaseStatusLabel(state.status),
    statusColor: RELEASE_STATUS_COLORS[state.status],
    isTerminal,
    primaryMessage,
    nextAction,
    totalReceived: state.totalReceivedQuantity,
    totalReleasable: state.totalReleasableQuantity,
    totalHeld: state.totalHeldQuantity,
    completeness: state.releaseCompleteness,
    releasedCount: state.releasedLineCount,
    heldCount: state.heldLineCount,
    pendingCount: state.pendingLineCount,
    qualityDone: state.qualityReviewComplete,
    safetyDone: state.safetyReviewComplete,
    complianceDone: state.complianceReviewComplete,
    allReviewsDone: allReviews,
    activeHoldCount: state.activeHolds.length,
    hasUnresolvedHolds: state.hasUnresolvedHolds,
    canEvaluate: state.status === "not_evaluated",
    canPlaceHold: !isTerminal,
    canPartialRelease: (state.status === "evaluating" || state.status === "hold_active") && state.totalReleasableQuantity > 0,
    canFullRelease: (state.status === "evaluating" || state.status === "partially_released") && !state.hasUnresolvedHolds && noPending,
    canCancel: !isTerminal,
    canReopenReceiving: state.status === "not_evaluated" || state.status === "evaluating",
    lineDecisions: state.releaseLines.map(l => ({
      lineId: l.lineId,
      itemName: l.itemName,
      received: l.receivedQuantity,
      releasable: l.releasableQuantity,
      held: l.heldQuantity,
      decision: l.releaseDecision,
      holdReasons: l.holdReasons,
      qualityStatus: l.qualityStatus,
    })),
  };
}

// ══════════════════════════════════════════════
// Available Stock Handoff — released에서만
// ══════════════════════════════════════════════

export interface AvailableStockHandoff {
  governanceId: string;
  caseId: string;
  poNumber: string;
  releasedLines: Array<{
    lineId: string;
    itemName: string;
    releasedQuantity: number;
    lotNumber: string;
    expiryDate: string | null;
    storageLocation: string;
  }>;
  totalReleasedQuantity: number;
  receivingSite: string;
  storageLocation: string;
  // Upstream linkage
  receivingExecutionId: string;
  confirmationGovernanceId: string;
  poCreatedObjectId: string;
}

export function buildAvailableStockHandoff(
  state: StockReleaseGovernanceState,
): AvailableStockHandoff | null {
  if (state.status !== "released" && state.status !== "partially_released") return null;

  const released = state.releaseLines.filter(l => l.releaseDecision === "release" && l.releasableQuantity > 0);
  if (released.length === 0) return null;

  return {
    governanceId: state.governanceId,
    caseId: state.caseId,
    poNumber: state.poNumber,
    releasedLines: released.map(l => ({
      lineId: l.lineId,
      itemName: l.itemName,
      releasedQuantity: l.releasableQuantity,
      lotNumber: l.lotNumber,
      expiryDate: l.expiryDate,
      storageLocation: state.storageLocation,
    })),
    totalReleasedQuantity: released.reduce((s, l) => s + l.releasableQuantity, 0),
    receivingSite: state.receivingSite,
    storageLocation: state.storageLocation,
    receivingExecutionId: state.receivingExecutionId,
    confirmationGovernanceId: state.confirmationGovernanceId,
    poCreatedObjectId: state.poCreatedObjectId,
  };
}

// ══════════════════════════════════════════════
// Reorder Decision Handoff — released + gap 감지
// ══════════════════════════════════════════════

export interface ReorderDecisionGovHandoff {
  governanceId: string;
  caseId: string;
  poNumber: string;
  releasedQuantity: number;
  heldQuantity: number;
  returnedQuantity: number;
  destroyedQuantity: number;
  originalOrderedQuantity: number;
  gapQuantity: number;
  hasGap: boolean;
  gapLineDetails: Array<{ lineId: string; itemName: string; ordered: number; released: number; gap: number }>;
}

export function buildReorderDecisionHandoff(
  state: StockReleaseGovernanceState,
  originalOrderedQuantity: number,
): ReorderDecisionGovHandoff | null {
  if (state.status !== "released") return null;

  const released = state.releaseLines.filter(l => l.releaseDecision === "release").reduce((s, l) => s + l.releasableQuantity, 0);
  const returned = state.releaseLines.filter(l => l.releaseDecision === "return").reduce((s, l) => s + l.receivedQuantity, 0);
  const destroyed = state.releaseLines.filter(l => l.releaseDecision === "destroy").reduce((s, l) => s + l.receivedQuantity, 0);
  const held = state.totalHeldQuantity;
  const gap = originalOrderedQuantity - released;

  const gapLines = state.releaseLines
    .filter(l => l.releaseDecision !== "release" || l.releasableQuantity < l.receivedQuantity)
    .map(l => ({
      lineId: l.lineId,
      itemName: l.itemName,
      ordered: l.receivedQuantity, // from PO perspective
      released: l.releasableQuantity,
      gap: l.receivedQuantity - l.releasableQuantity,
    }))
    .filter(l => l.gap > 0);

  return {
    governanceId: state.governanceId,
    caseId: state.caseId,
    poNumber: state.poNumber,
    releasedQuantity: released,
    heldQuantity: held,
    returnedQuantity: returned,
    destroyedQuantity: destroyed,
    originalOrderedQuantity,
    gapQuantity: Math.max(0, gap),
    hasGap: gap > 0,
    gapLineDetails: gapLines,
  };
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type StockReleaseGovEventType =
  | "stock_release_gov_created"
  | "stock_release_evaluation_started"
  | "stock_release_line_evaluated"
  | "stock_release_hold_placed"
  | "stock_release_hold_resolved"
  | "stock_release_review_completed"
  | "stock_release_partial"
  | "stock_release_full"
  | "stock_release_cancelled"
  | "available_stock_handoff_created"
  | "reorder_decision_handoff_created";

export interface StockReleaseGovEvent {
  type: StockReleaseGovEventType;
  governanceId: string;
  caseId: string;
  poNumber: string;
  fromStatus: StockReleaseGovStatus;
  toStatus: StockReleaseGovStatus;
  actor: string;
  timestamp: string;
  detail: string;
}
