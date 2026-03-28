/**
 * Reorder Trigger v2 Engine — inventory availability → reorder evaluation → procurement re-entry
 *
 * available inventory 기준으로 reorder 필요 여부 판단.
 * safety stock / lead time / demand context 기반 평가.
 * 결과: no_reorder_needed / reorder_recommended / reorder_urgent / procurement_reentry_required
 */

import type { AvailableInventorySnapshotV2 } from "./available-inventory-projection-v2-engine";

export type ReorderEvaluationResult = "no_reorder_needed" | "reorder_recommended" | "reorder_urgent" | "procurement_reentry_required" | "monitoring";

export interface ReorderContext {
  safetyStockQty: number;
  averageDailyUsage: number;
  leadTimeDays: number;
  currentDemandQty: number;
  reorderPointQty: number;
}

export interface ReorderTriggerEvaluationV2 {
  evaluationId: string; caseId: string; snapshotId: string;
  totalAvailableQty: number; reorderContext: ReorderContext;
  availableVsSafetyStock: number; // positive = above safety, negative = below
  availableVsReorderPoint: number;
  daysOfSupplyRemaining: number;
  evaluationResult: ReorderEvaluationResult;
  evaluationReason: string;
  procurementReentryRecommended: boolean;
  nextDestination: "procurement_reentry" | "monitoring" | "no_action";
  evaluatedAt: string; evaluatedBy: string;
}

export function evaluateReorderTrigger(snapshot: AvailableInventorySnapshotV2, context: ReorderContext): ReorderTriggerEvaluationV2 {
  const available = snapshot.totalAvailableQty;
  const vsSafety = available - context.safetyStockQty;
  const vsReorderPoint = available - context.reorderPointQty;
  const daysOfSupply = context.averageDailyUsage > 0 ? Math.floor(available / context.averageDailyUsage) : 999;

  let result: ReorderEvaluationResult;
  let reason: string;
  let reentry: boolean;
  let nextDest: "procurement_reentry" | "monitoring" | "no_action";

  if (available <= 0) {
    result = "procurement_reentry_required"; reason = "재고 0 — 즉시 재구매 필요"; reentry = true; nextDest = "procurement_reentry";
  } else if (vsSafety < 0) {
    result = "reorder_urgent"; reason = `안전재고 미달 (${vsSafety})`; reentry = true; nextDest = "procurement_reentry";
  } else if (vsReorderPoint < 0) {
    result = "reorder_recommended"; reason = `재주문점 도달 (${vsReorderPoint})`; reentry = true; nextDest = "procurement_reentry";
  } else if (daysOfSupply < context.leadTimeDays * 1.5) {
    result = "reorder_recommended"; reason = `공급 일수 부족 (${daysOfSupply}일 < lead time ${context.leadTimeDays}일 × 1.5)`; reentry = true; nextDest = "procurement_reentry";
  } else if (daysOfSupply < context.leadTimeDays * 3) {
    result = "monitoring"; reason = `모니터링 구간 (${daysOfSupply}일)`; reentry = false; nextDest = "monitoring";
  } else {
    result = "no_reorder_needed"; reason = `충분 (${daysOfSupply}일 공급 가능)`; reentry = false; nextDest = "no_action";
  }

  return { evaluationId: `reordeval_${Date.now().toString(36)}`, caseId: snapshot.caseId, snapshotId: snapshot.snapshotId, totalAvailableQty: available, reorderContext: context, availableVsSafetyStock: vsSafety, availableVsReorderPoint: vsReorderPoint, daysOfSupplyRemaining: daysOfSupply, evaluationResult: result, evaluationReason: reason, procurementReentryRecommended: reentry, nextDestination: nextDest, evaluatedAt: new Date().toISOString(), evaluatedBy: "system" };
}

export type ReorderEventType = "reorder_evaluation_computed" | "reorder_recommended" | "reorder_urgent" | "procurement_reentry_triggered" | "no_reorder_needed" | "reorder_monitoring";
export interface ReorderEvent { type: ReorderEventType; caseId: string; evaluationId: string; result: ReorderEvaluationResult; reason: string; timestamp: string; }
export function createReorderEvent(evaluation: ReorderTriggerEvaluationV2): ReorderEvent {
  const typeMap: Record<ReorderEvaluationResult, ReorderEventType> = { no_reorder_needed: "no_reorder_needed", reorder_recommended: "reorder_recommended", reorder_urgent: "reorder_urgent", procurement_reentry_required: "procurement_reentry_triggered", monitoring: "reorder_monitoring" };
  return { type: typeMap[evaluation.evaluationResult], caseId: evaluation.caseId, evaluationId: evaluation.evaluationId, result: evaluation.evaluationResult, reason: evaluation.evaluationReason, timestamp: evaluation.evaluatedAt };
}
