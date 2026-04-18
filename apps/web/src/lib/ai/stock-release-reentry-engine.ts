/**
 * Available Stock Release Re-entry Engine — usable release 재판단 + disposition reclassification + reorder decision re-entry handoff
 */

import type { InventoryIntakeReentryHandoff } from "./receiving-execution-reentry-engine";

export type StockReleaseReentryStatus = "available_stock_release_reentry_open" | "available_stock_release_reentry_in_progress" | "available_stock_release_reentry_recorded";
export type StockReleaseReentrySubstatus = "awaiting_release_eligibility_recheck" | "awaiting_hold_quarantine_reclassification" | "awaiting_prior_release_overlap_resolution" | "available_stock_release_reentry_blocked" | "ready_for_reorder_decision_reentry";

export interface StockReleaseReentryState {
  availableStockReleaseReentryStatus: StockReleaseReentryStatus; substatus: StockReleaseReentrySubstatus; availableStockReleaseReentryOpenedAt: string; receivingExecutionReentryObjectId: string;
  releasableQtySummary: string; holdRemainingQtySummary: string; quarantineRemainingQtySummary: string; damagedRemainingQtySummary: string; priorReleaseOverlapCount: number; releaseEligibilityStatus: "ready" | "pending" | "blocked";
  missingDecisionCount: number; availableStockReleaseReentryBlockedFlag: boolean; availableStockReleaseReentryBlockedReason: string | null; availableStockReleaseReentryObjectId: string | null;
}

// Note: handoff comes from receiving-execution-reentry-engine's InventoryIntakeReentryHandoff, repurposed here
export function createInitialStockReleaseReentryState(receivingExecReentryObjectId: string): StockReleaseReentryState {
  return { availableStockReleaseReentryStatus: "available_stock_release_reentry_open", substatus: "awaiting_release_eligibility_recheck", availableStockReleaseReentryOpenedAt: new Date().toISOString(), receivingExecutionReentryObjectId: receivingExecReentryObjectId, releasableQtySummary: "", holdRemainingQtySummary: "", quarantineRemainingQtySummary: "", damagedRemainingQtySummary: "", priorReleaseOverlapCount: 0, releaseEligibilityStatus: "pending", missingDecisionCount: 1, availableStockReleaseReentryBlockedFlag: false, availableStockReleaseReentryBlockedReason: null, availableStockReleaseReentryObjectId: null };
}

export interface StockReleaseReentryValidation { canRecordAvailableStockReleaseReentry: boolean; canOpenReorderDecisionReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateStockReleaseReentryBeforeRecord(state: StockReleaseReentryState): StockReleaseReentryValidation {
  const blocking: string[] = []; const warnings: string[] = []; const missing: string[] = [];
  if (state.availableStockReleaseReentryBlockedFlag) blocking.push(state.availableStockReleaseReentryBlockedReason || "차단됨");
  if (!state.releasableQtySummary) { warnings.push("Releasable qty 미확인"); missing.push("Release 확인"); }
  if (state.priorReleaseOverlapCount > 0) warnings.push("이전 release overlap");
  const canRecord = blocking.length === 0;
  return { canRecordAvailableStockReleaseReentry: canRecord, canOpenReorderDecisionReentry: canRecord && state.releaseEligibilityStatus === "ready", blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : state.releaseEligibilityStatus === "ready" ? "Reorder Decision Re-entry로 보내기" : "Release 확인 후 진행" };
}

export interface StockReleaseReentryObject { id: string; receivingExecutionReentryObjectId: string; releasableQtySummary: string; holdRemainingQtySummary: string; quarantineRemainingQtySummary: string; damagedRemainingQtySummary: string; priorReleaseOverlapSummary: string; releaseGateSummary: string; recordedAt: string; recordedBy: string; }
export function buildStockReleaseReentryObject(state: StockReleaseReentryState): StockReleaseReentryObject {
  return { id: `stkrelre_${Date.now().toString(36)}`, receivingExecutionReentryObjectId: state.receivingExecutionReentryObjectId, releasableQtySummary: state.releasableQtySummary || "미확인", holdRemainingQtySummary: state.holdRemainingQtySummary, quarantineRemainingQtySummary: state.quarantineRemainingQtySummary, damagedRemainingQtySummary: state.damagedRemainingQtySummary, priorReleaseOverlapSummary: state.priorReleaseOverlapCount > 0 ? "충돌 있음" : "충돌 없음", releaseGateSummary: state.releaseEligibilityStatus, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

export interface ReorderDecisionReentryHandoff { availableStockReleaseReentryObjectId: string; releasableQtySummary: string; holdRemainingQtySummary: string; quarantineRemainingQtySummary: string; releaseGateSummary: string; reorderDecisionReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildReorderDecisionReentryHandoff(obj: StockReleaseReentryObject): ReorderDecisionReentryHandoff {
  return { availableStockReleaseReentryObjectId: obj.id, releasableQtySummary: obj.releasableQtySummary, holdRemainingQtySummary: obj.holdRemainingQtySummary, quarantineRemainingQtySummary: obj.quarantineRemainingQtySummary, releaseGateSummary: obj.releaseGateSummary, reorderDecisionReentryReadiness: obj.releaseGateSummary === "ready" ? "ready" : "pending" };
}
