/**
 * Reorder Decision Governance Engine
 *
 * released 기준 재주문 판단 + procurement re-entry handoff.
 * stock-release-governance-engine의 ReorderDecisionGovHandoff를 입력으로 받아
 * usable stock gap → reorder 판단 → procurement re-entry handoff까지 governance 레이어.
 *
 * 기존 reorder-decision-engine.ts / reorder-decision-gate-engine.ts 위에
 * 상태 머신 + supply context + line-level decision + re-entry lineage 추가.
 *
 * IMMUTABLE RULES:
 * 1. reorder는 received가 아니라 released 기준
 * 2. hold / quarantine / destroy 수량은 usable stock 계산에서 제외
 * 3. re-entry는 새 요청처럼 보여도 lineage는 이어져야 함
 * 4. watch ≠ no_action — watch는 모니터링 중이고, no_action은 재주문 불필요 확정
 * 5. expedite는 reorder_required 위의 긴급도 — lead time breach일 때만
 * 6. procurement re-entry handoff는 reorder_required / expedite_required에서만
 * 7. no_action / watch terminal에서도 lineage는 보존
 */

import type { ReorderDecisionGovHandoff } from "./stock-release-governance-engine";
import { getStatusLabel } from "./governance-grammar-registry";

// ══════════════════════════════════════════════
// Reorder Decision Governance Status
// ══════════════════════════════════════════════

export type ReorderDecisionGovStatus =
  | "not_evaluated"
  | "evaluating"
  | "watch_active"
  | "reorder_recommended"
  | "reorder_required"
  | "expedite_required"
  | "no_action"
  | "procurement_reentry_ready"
  | "cancelled";

/** Terminal states */
export const REORDER_TERMINAL: readonly ReorderDecisionGovStatus[] = [
  "no_action",
  "procurement_reentry_ready",
  "cancelled",
] as const;

/** Valid transitions */
const REORDER_TRANSITIONS: Record<ReorderDecisionGovStatus, ReorderDecisionGovStatus[]> = {
  not_evaluated: ["evaluating", "cancelled"],
  evaluating: ["watch_active", "reorder_recommended", "reorder_required", "expedite_required", "no_action", "cancelled"],
  watch_active: ["evaluating", "reorder_recommended", "reorder_required", "expedite_required", "no_action", "cancelled"],
  reorder_recommended: ["evaluating", "reorder_required", "expedite_required", "no_action", "procurement_reentry_ready", "cancelled"],
  reorder_required: ["evaluating", "expedite_required", "procurement_reentry_ready", "cancelled"],
  expedite_required: ["evaluating", "procurement_reentry_ready", "cancelled"],
  no_action: [],       // terminal
  procurement_reentry_ready: [],  // terminal
  cancelled: [],       // terminal
};

// ══════════════════════════════════════════════
// Supply Context — 외부 입력
// ══════════════════════════════════════════════

export interface SupplyDemandContext {
  currentAvailableStock: number;
  projectedDemand: number;
  reservedDemand: number;
  openInboundQuantity: number;
  safetyStockLevel: number;
  supplierLeadTimeDays: number;
  averageDailyUsage: number;
  daysOfCoverageRemaining: number;
}

// ══════════════════════════════════════════════
// Line-level Reorder Decision
// ══════════════════════════════════════════════

export type ReorderLineDecisionType = "reorder" | "watch" | "no_action" | "return_claim" | "substitute" | "pending";

export interface ReorderLineDecision {
  lineId: string;
  itemName: string;
  orderedQuantity: number;
  releasedQuantity: number;
  gapQuantity: number;
  returnedQuantity: number;
  destroyedQuantity: number;
  decision: ReorderLineDecisionType;
  reorderQuantity: number;
  urgency: "immediate" | "normal" | "watch" | "none";
  rationale: string;
  supplierPath: "same_supplier" | "alternate_supplier" | "substitute_item" | "not_applicable";
}

// ══════════════════════════════════════════════
// Loss Accounting — return/destroy lineage
// ══════════════════════════════════════════════

export interface LossAccountingSummary {
  totalReturned: number;
  totalDestroyed: number;
  totalHeld: number;
  totalLoss: number;
  lossPercentage: number;
  hasSupplierClaim: boolean;
  anomalyLineage: Array<{
    lineId: string;
    itemName: string;
    lossType: "return" | "destroy" | "held";
    quantity: number;
    reason: string;
  }>;
}

// ══════════════════════════════════════════════
// Reorder Decision Governance State
// ══════════════════════════════════════════════

export interface ReorderDecisionGovernanceState {
  governanceId: string;
  caseId: string;
  poNumber: string;
  status: ReorderDecisionGovStatus;
  // Gap from stock release
  originalOrderedQuantity: number;
  releasedQuantity: number;
  gapQuantity: number;
  hasGap: boolean;
  // Supply context
  supplyContext: SupplyDemandContext | null;
  coverageStatus: "critical" | "low" | "adequate" | "surplus";
  leadTimeBreached: boolean;
  safetyStockBreached: boolean;
  // Line decisions
  lineDecisions: ReorderLineDecision[];
  totalReorderQuantity: number;
  reorderLineCount: number;
  watchLineCount: number;
  noActionLineCount: number;
  pendingLineCount: number;
  // Loss accounting
  lossAccounting: LossAccountingSummary;
  // Re-entry path
  reentryPath: "same_supplier" | "alternate_supplier" | "substitute" | "mixed" | "not_determined";
  // Upstream linkage
  stockReleaseGovernanceId: string;
  receivingExecutionId: string;
  confirmationGovernanceId: string;
  poCreatedObjectId: string;
  // Chain linkage for re-entry
  priorSupplierIds: string[];
  priorAnomalies: string[];
  // Audit
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

// ══════════════════════════════════════════════
// Create from Handoff
// ══════════════════════════════════════════════

export function createReorderDecisionGovernanceState(
  handoff: ReorderDecisionGovHandoff,
  actor: string,
): ReorderDecisionGovernanceState {
  const now = new Date().toISOString();

  // Build initial line decisions from gap details
  const lineDecisions: ReorderLineDecision[] = handoff.gapLineDetails.map(line => ({
    lineId: line.lineId,
    itemName: line.itemName,
    orderedQuantity: line.ordered,
    releasedQuantity: line.released,
    gapQuantity: line.gap,
    returnedQuantity: 0,
    destroyedQuantity: 0,
    decision: "pending",
    reorderQuantity: 0,
    urgency: "none",
    rationale: "",
    supplierPath: "not_applicable",
  }));

  const lossAccounting: LossAccountingSummary = {
    totalReturned: handoff.returnedQuantity,
    totalDestroyed: handoff.destroyedQuantity,
    totalHeld: handoff.heldQuantity,
    totalLoss: handoff.returnedQuantity + handoff.destroyedQuantity,
    lossPercentage: handoff.originalOrderedQuantity > 0
      ? Math.round(((handoff.returnedQuantity + handoff.destroyedQuantity) / handoff.originalOrderedQuantity) * 100)
      : 0,
    hasSupplierClaim: handoff.returnedQuantity > 0,
    anomalyLineage: [],
  };

  return {
    governanceId: `rdgov_${Date.now().toString(36)}`,
    caseId: handoff.caseId,
    poNumber: handoff.poNumber,
    status: "not_evaluated",
    originalOrderedQuantity: handoff.originalOrderedQuantity,
    releasedQuantity: handoff.releasedQuantity,
    gapQuantity: handoff.gapQuantity,
    hasGap: handoff.hasGap,
    supplyContext: null,
    coverageStatus: "adequate",
    leadTimeBreached: false,
    safetyStockBreached: false,
    lineDecisions,
    totalReorderQuantity: 0,
    reorderLineCount: 0,
    watchLineCount: 0,
    noActionLineCount: 0,
    pendingLineCount: lineDecisions.length,
    lossAccounting,
    reentryPath: "not_determined",
    stockReleaseGovernanceId: handoff.governanceId,
    receivingExecutionId: "",
    confirmationGovernanceId: "",
    poCreatedObjectId: "",
    priorSupplierIds: [],
    priorAnomalies: [],
    createdAt: now,
    updatedAt: now,
    updatedBy: actor,
  };
}

// ══════════════════════════════════════════════
// Transition Validation
// ══════════════════════════════════════════════

export interface ReorderGovTransitionResult {
  success: boolean;
  state: ReorderDecisionGovernanceState;
  error: string | null;
}

function validateTransition(from: ReorderDecisionGovStatus, to: ReorderDecisionGovStatus): string | null {
  if (REORDER_TERMINAL.includes(from)) {
    return `Cannot transition from terminal status '${from}'`;
  }
  if (!REORDER_TRANSITIONS[from].includes(to)) {
    return `Invalid transition: ${from} → ${to}. Allowed: ${REORDER_TRANSITIONS[from].join(", ") || "none"}`;
  }
  return null;
}

// ══════════════════════════════════════════════
// Start Evaluation
// ══════════════════════════════════════════════

export function startReorderEvaluation(
  state: ReorderDecisionGovernanceState,
  actor: string,
): ReorderGovTransitionResult {
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
// Update Supply Context — 외부 데이터 입력
// ══════════════════════════════════════════════

export function updateSupplyContext(
  state: ReorderDecisionGovernanceState,
  context: SupplyDemandContext,
  actor: string,
): ReorderGovTransitionResult {
  if (REORDER_TERMINAL.includes(state.status)) {
    return { success: false, state, error: `Terminal 상태에서 supply context 변경 불가` };
  }

  const coverageStatus: ReorderDecisionGovernanceState["coverageStatus"] =
    context.daysOfCoverageRemaining <= 0 ? "critical"
    : context.daysOfCoverageRemaining < context.supplierLeadTimeDays ? "low"
    : context.currentAvailableStock > context.projectedDemand * 2 ? "surplus"
    : "adequate";

  const leadTimeBreached = context.daysOfCoverageRemaining < context.supplierLeadTimeDays;
  const safetyStockBreached = context.currentAvailableStock < context.safetyStockLevel;

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      supplyContext: context,
      coverageStatus,
      leadTimeBreached,
      safetyStockBreached,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Evaluate Line Decision
// ══════════════════════════════════════════════

export interface ReorderLineEvaluationInput {
  lineId: string;
  decision: ReorderLineDecisionType;
  reorderQuantity: number;
  urgency: ReorderLineDecision["urgency"];
  rationale: string;
  supplierPath: ReorderLineDecision["supplierPath"];
}

export function evaluateReorderLine(
  state: ReorderDecisionGovernanceState,
  input: ReorderLineEvaluationInput,
  actor: string,
): ReorderGovTransitionResult {
  if (state.status !== "evaluating" && state.status !== "watch_active" && state.status !== "reorder_recommended") {
    return { success: false, state, error: `현재 상태 '${state.status}'에서 라인 평가 불가` };
  }

  const lineIdx = state.lineDecisions.findIndex(l => l.lineId === input.lineId);
  if (lineIdx < 0) {
    return { success: false, state, error: `라인 ID '${input.lineId}' 미발견` };
  }

  const updatedLines = [...state.lineDecisions];
  updatedLines[lineIdx] = {
    ...updatedLines[lineIdx],
    decision: input.decision,
    reorderQuantity: input.reorderQuantity,
    urgency: input.urgency,
    rationale: input.rationale,
    supplierPath: input.supplierPath,
  };

  // Recalculate totals
  const reorderLines = updatedLines.filter(l => l.decision === "reorder" || l.decision === "substitute");
  const watchLines = updatedLines.filter(l => l.decision === "watch");
  const noActionLines = updatedLines.filter(l => l.decision === "no_action" || l.decision === "return_claim");
  const pendingLines = updatedLines.filter(l => l.decision === "pending");
  const totalReorder = reorderLines.reduce((s, l) => s + l.reorderQuantity, 0);

  // Determine re-entry path
  const paths = reorderLines.map(l => l.supplierPath).filter(p => p !== "not_applicable");
  const uniquePaths = [...new Set(paths)];
  const reentryPath: ReorderDecisionGovernanceState["reentryPath"] =
    uniquePaths.length === 0 ? "not_determined"
    : uniquePaths.length === 1 ? (
      uniquePaths[0] === "same_supplier" ? "same_supplier"
      : uniquePaths[0] === "alternate_supplier" ? "alternate_supplier"
      : "substitute"
    )
    : "mixed";

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      lineDecisions: updatedLines,
      totalReorderQuantity: totalReorder,
      reorderLineCount: reorderLines.length,
      watchLineCount: watchLines.length,
      noActionLineCount: noActionLines.length,
      pendingLineCount: pendingLines.length,
      reentryPath,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Set Watch Active
// ══════════════════════════════════════════════

export function setWatchActive(
  state: ReorderDecisionGovernanceState,
  actor: string,
): ReorderGovTransitionResult {
  const error = validateTransition(state.status, "watch_active");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: { ...state, status: "watch_active", updatedAt: now, updatedBy: actor },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Mark Reorder Recommended
// ══════════════════════════════════════════════

export function markReorderRecommended(
  state: ReorderDecisionGovernanceState,
  actor: string,
): ReorderGovTransitionResult {
  const error = validateTransition(state.status, "reorder_recommended");
  if (error) return { success: false, state, error };

  if (state.totalReorderQuantity === 0) {
    return { success: false, state, error: "재주문 수량 0 — reorder recommended 불가" };
  }

  const now = new Date().toISOString();
  return {
    success: true,
    state: { ...state, status: "reorder_recommended", updatedAt: now, updatedBy: actor },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Mark Reorder Required
// ══════════════════════════════════════════════

export function markReorderRequired(
  state: ReorderDecisionGovernanceState,
  actor: string,
): ReorderGovTransitionResult {
  const error = validateTransition(state.status, "reorder_required");
  if (error) return { success: false, state, error };

  if (state.totalReorderQuantity === 0) {
    return { success: false, state, error: "재주문 수량 0 — reorder required 불가" };
  }

  const now = new Date().toISOString();
  return {
    success: true,
    state: { ...state, status: "reorder_required", updatedAt: now, updatedBy: actor },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Mark Expedite Required — lead time breach only
// ══════════════════════════════════════════════

export function markExpediteRequired(
  state: ReorderDecisionGovernanceState,
  actor: string,
): ReorderGovTransitionResult {
  const error = validateTransition(state.status, "expedite_required");
  if (error) return { success: false, state, error };

  if (!state.leadTimeBreached) {
    return { success: false, state, error: "리드타임 breach 없이 expedite 불가" };
  }
  if (state.totalReorderQuantity === 0) {
    return { success: false, state, error: "재주문 수량 0 — expedite 불가" };
  }

  const now = new Date().toISOString();
  return {
    success: true,
    state: { ...state, status: "expedite_required", updatedAt: now, updatedBy: actor },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Mark No Action — terminal
// ══════════════════════════════════════════════

export function markNoAction(
  state: ReorderDecisionGovernanceState,
  reason: string,
  actor: string,
): ReorderGovTransitionResult {
  const error = validateTransition(state.status, "no_action");
  if (error) return { success: false, state, error };

  if (state.pendingLineCount > 0) {
    return { success: false, state, error: "미평가 라인 존재 — 모든 라인 평가 후 no_action 가능" };
  }

  if (state.safetyStockBreached && state.totalReorderQuantity === 0) {
    return { success: false, state, error: "안전재고 미달인데 재주문 없이 no_action 불가" };
  }

  const now = new Date().toISOString();
  return {
    success: true,
    state: { ...state, status: "no_action", updatedAt: now, updatedBy: actor },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Mark Procurement Re-entry Ready — terminal
// ══════════════════════════════════════════════

export function markProcurementReentryReady(
  state: ReorderDecisionGovernanceState,
  actor: string,
): ReorderGovTransitionResult {
  const error = validateTransition(state.status, "procurement_reentry_ready");
  if (error) return { success: false, state, error };

  if (state.totalReorderQuantity === 0) {
    return { success: false, state, error: "재주문 수량 0 — procurement re-entry 불가" };
  }

  if (state.pendingLineCount > 0) {
    return { success: false, state, error: "미평가 라인 존재 — 모든 라인 평가 필요" };
  }

  if (state.reentryPath === "not_determined") {
    return { success: false, state, error: "재진입 경로 미결정 — supplier path 지정 필요" };
  }

  const now = new Date().toISOString();
  return {
    success: true,
    state: { ...state, status: "procurement_reentry_ready", updatedAt: now, updatedBy: actor },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Cancel
// ══════════════════════════════════════════════

export function cancelReorderDecision(
  state: ReorderDecisionGovernanceState,
  reason: string,
  actor: string,
): ReorderGovTransitionResult {
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
// Reorder Decision Surface — UI 투사
// ══════════════════════════════════════════════

export interface ReorderDecisionGovSurface {
  status: ReorderDecisionGovStatus;
  statusLabel: string;
  statusColor: "slate" | "blue" | "amber" | "emerald" | "red" | "orange";
  isTerminal: boolean;
  primaryMessage: string;
  nextAction: string;
  // Gap summary
  originalOrdered: number;
  released: number;
  gap: number;
  hasGap: boolean;
  // Supply
  coverageStatus: string;
  leadTimeBreached: boolean;
  safetyStockBreached: boolean;
  // Decisions
  totalReorderQty: number;
  reorderCount: number;
  watchCount: number;
  noActionCount: number;
  pendingCount: number;
  // Loss
  totalLoss: number;
  lossPercentage: number;
  hasSupplierClaim: boolean;
  // Re-entry
  reentryPath: string;
  // Dock actions
  canEvaluate: boolean;
  canSetWatch: boolean;
  canRecommendReorder: boolean;
  canRequireReorder: boolean;
  canExpedite: boolean;
  canMarkNoAction: boolean;
  canProcurementReentry: boolean;
  canCancel: boolean;
  canReopenStockRelease: boolean;
  // Line detail
  lineDecisions: Array<{
    lineId: string;
    itemName: string;
    ordered: number;
    released: number;
    gap: number;
    decision: string;
    reorderQty: number;
    urgency: string;
    supplierPath: string;
  }>;
}

/** Status labels — grammar registry 직접 소비. 하드코딩 금지. */
function getReorderStatusLabel(status: ReorderDecisionGovStatus): string {
  return getStatusLabel("reorder_decision", status);
}

const REORDER_STATUS_COLORS: Record<ReorderDecisionGovStatus, ReorderDecisionGovSurface["statusColor"]> = {
  not_evaluated: "slate",
  evaluating: "blue",
  watch_active: "amber",
  reorder_recommended: "amber",
  reorder_required: "red",
  expedite_required: "orange",
  no_action: "emerald",
  procurement_reentry_ready: "emerald",
  cancelled: "slate",
};

export function buildReorderDecisionGovSurface(state: ReorderDecisionGovernanceState): ReorderDecisionGovSurface {
  const isTerminal = REORDER_TERMINAL.includes(state.status);
  const noPending = state.pendingLineCount === 0;

  const primaryMessage = state.status === "not_evaluated"
    ? `재주문 판단 대기 — gap ${state.gapQuantity}개 (주문 ${state.originalOrderedQuantity} / 릴리즈 ${state.releasedQuantity})`
    : state.status === "evaluating"
      ? `재주문 평가 중 — ${state.reorderLineCount + state.watchLineCount + state.noActionLineCount}/${state.lineDecisions.length}건 판단`
    : state.status === "watch_active"
      ? `모니터링 — ${state.watchLineCount}건 감시 중`
    : state.status === "reorder_recommended"
      ? `재주문 권고 — ${state.totalReorderQuantity}개 (${state.reorderLineCount}건)`
    : state.status === "reorder_required"
      ? `재주문 필요 — ${state.totalReorderQuantity}개 즉시 발주`
    : state.status === "expedite_required"
      ? `긴급 재주문 — 리드타임 초과, ${state.totalReorderQuantity}개 긴급 발주`
    : state.status === "no_action"
      ? `조치 불필요 — 현재 가용 재고 충분`
    : state.status === "procurement_reentry_ready"
      ? `구매 재진입 준비 완료 — ${state.totalReorderQuantity}개 (${state.reentryPath})`
    : "취소됨";

  const nextAction = state.status === "not_evaluated"
    ? "재주문 평가 시작"
    : state.status === "evaluating"
      ? noPending ? "재주문 판단 확정" : "라인별 재주문 판단"
    : state.status === "watch_active"
      ? "supply context 업데이트 또는 재평가"
    : state.status === "reorder_recommended"
      ? "Procurement Re-entry로 보내기 또는 재주문 확정"
    : state.status === "reorder_required"
      ? "Procurement Re-entry로 보내기"
    : state.status === "expedite_required"
      ? "긴급 Procurement Re-entry로 보내기"
    : state.status === "no_action"
      ? "완료"
    : state.status === "procurement_reentry_ready"
      ? "Re-entry Handoff 생성"
    : "재시작하려면 Stock Release 재진입";

  const canReorder = state.totalReorderQuantity > 0;

  return {
    status: state.status,
    statusLabel: getReorderStatusLabel(state.status),
    statusColor: REORDER_STATUS_COLORS[state.status],
    isTerminal,
    primaryMessage,
    nextAction,
    originalOrdered: state.originalOrderedQuantity,
    released: state.releasedQuantity,
    gap: state.gapQuantity,
    hasGap: state.hasGap,
    coverageStatus: state.coverageStatus,
    leadTimeBreached: state.leadTimeBreached,
    safetyStockBreached: state.safetyStockBreached,
    totalReorderQty: state.totalReorderQuantity,
    reorderCount: state.reorderLineCount,
    watchCount: state.watchLineCount,
    noActionCount: state.noActionLineCount,
    pendingCount: state.pendingLineCount,
    totalLoss: state.lossAccounting.totalLoss,
    lossPercentage: state.lossAccounting.lossPercentage,
    hasSupplierClaim: state.lossAccounting.hasSupplierClaim,
    reentryPath: state.reentryPath,
    canEvaluate: state.status === "not_evaluated",
    canSetWatch: state.status === "evaluating" && state.watchLineCount > 0,
    canRecommendReorder: state.status === "evaluating" && canReorder,
    canRequireReorder: (state.status === "evaluating" || state.status === "reorder_recommended") && canReorder,
    canExpedite: (state.status === "evaluating" || state.status === "reorder_required") && canReorder && state.leadTimeBreached,
    canMarkNoAction: state.status === "evaluating" && noPending && !state.safetyStockBreached,
    canProcurementReentry: (state.status === "reorder_recommended" || state.status === "reorder_required" || state.status === "expedite_required") && canReorder && noPending && state.reentryPath !== "not_determined",
    canCancel: !isTerminal,
    canReopenStockRelease: state.status === "not_evaluated" || state.status === "evaluating",
    lineDecisions: state.lineDecisions.map(l => ({
      lineId: l.lineId,
      itemName: l.itemName,
      ordered: l.orderedQuantity,
      released: l.releasedQuantity,
      gap: l.gapQuantity,
      decision: l.decision,
      reorderQty: l.reorderQuantity,
      urgency: l.urgency,
      supplierPath: l.supplierPath,
    })),
  };
}

// ══════════════════════════════════════════════
// Procurement Re-entry Handoff — reorder_required / expedite / procurement_reentry_ready에서만
// ══════════════════════════════════════════════

export interface ProcurementReentryGovHandoff {
  governanceId: string;
  caseId: string;
  poNumber: string;
  // Reorder scope
  reorderLines: Array<{
    lineId: string;
    itemName: string;
    reorderQuantity: number;
    urgency: string;
    supplierPath: string;
    rationale: string;
  }>;
  totalReorderQuantity: number;
  reentryPath: string;
  isExpedite: boolean;
  // Supply context snapshot
  coverageStatus: string;
  leadTimeBreached: boolean;
  safetyStockBreached: boolean;
  // Loss lineage
  totalLoss: number;
  returnedQuantity: number;
  destroyedQuantity: number;
  hasSupplierClaim: boolean;
  // Full chain lineage
  originalPoNumber: string;
  stockReleaseGovernanceId: string;
  priorSupplierIds: string[];
  priorAnomalies: string[];
}

export function buildProcurementReentryHandoff(
  state: ReorderDecisionGovernanceState,
): ProcurementReentryGovHandoff | null {
  if (state.status !== "procurement_reentry_ready") return null;

  const reorderLines = state.lineDecisions
    .filter(l => l.decision === "reorder" || l.decision === "substitute")
    .map(l => ({
      lineId: l.lineId,
      itemName: l.itemName,
      reorderQuantity: l.reorderQuantity,
      urgency: l.urgency,
      supplierPath: l.supplierPath,
      rationale: l.rationale,
    }));

  if (reorderLines.length === 0) return null;

  return {
    governanceId: state.governanceId,
    caseId: state.caseId,
    poNumber: state.poNumber,
    reorderLines,
    totalReorderQuantity: state.totalReorderQuantity,
    reentryPath: state.reentryPath,
    isExpedite: false, // was expedite_required before moving to procurement_reentry_ready
    coverageStatus: state.coverageStatus,
    leadTimeBreached: state.leadTimeBreached,
    safetyStockBreached: state.safetyStockBreached,
    totalLoss: state.lossAccounting.totalLoss,
    returnedQuantity: state.lossAccounting.totalReturned,
    destroyedQuantity: state.lossAccounting.totalDestroyed,
    hasSupplierClaim: state.lossAccounting.hasSupplierClaim,
    originalPoNumber: state.poNumber,
    stockReleaseGovernanceId: state.stockReleaseGovernanceId,
    priorSupplierIds: state.priorSupplierIds,
    priorAnomalies: state.priorAnomalies,
  };
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type ReorderDecisionGovEventType =
  | "reorder_decision_gov_created"
  | "reorder_evaluation_started"
  | "reorder_line_evaluated"
  | "reorder_supply_context_updated"
  | "reorder_watch_set"
  | "reorder_recommended"
  | "reorder_required"
  | "reorder_expedite_required"
  | "reorder_no_action"
  | "reorder_procurement_reentry_ready"
  | "reorder_cancelled"
  | "procurement_reentry_handoff_created";

export interface ReorderDecisionGovEvent {
  type: ReorderDecisionGovEventType;
  governanceId: string;
  caseId: string;
  poNumber: string;
  fromStatus: ReorderDecisionGovStatus;
  toStatus: ReorderDecisionGovStatus;
  actor: string;
  timestamp: string;
  detail: string;
}
