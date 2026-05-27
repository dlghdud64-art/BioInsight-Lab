/**
 * Available Stock Release Engine — usable stock 확정 + hold/quarantine remaining + release decision + reorder handoff
 */

import type { AvailableStockReleaseHandoff, InventoryIntakeObject } from "./inventory-intake-engine";

// ── Status ──
export type StockReleaseStatus = "stock_release_open" | "stock_release_in_progress" | "stock_release_recorded";
export type StockReleaseSubstatus = "awaiting_release_review" | "awaiting_hold_resolution" | "stock_release_blocked" | "ready_for_reorder_decision";

// ── State ──
export interface StockReleaseState {
  stockReleaseStatus: StockReleaseStatus;
  substatus: StockReleaseSubstatus;
  stockReleaseOpenedAt: string;
  inventoryIntakeObjectId: string;
  releasableQtySummary: string;
  holdRemainingQtySummary: string;
  quarantineRemainingQtySummary: string;
  releaseDecisionSummary: string;
  stockReleaseBlockedFlag: boolean;
  stockReleaseBlockedReason: string | null;
  stockReleaseObjectId: string | null;
}

export function createInitialStockReleaseState(handoff: AvailableStockReleaseHandoff): StockReleaseState {
  return {
    stockReleaseStatus: "stock_release_open",
    substatus: handoff.stockReleaseReadiness === "ready" ? "awaiting_release_review" : "stock_release_blocked",
    stockReleaseOpenedAt: new Date().toISOString(),
    inventoryIntakeObjectId: handoff.inventoryIntakeObjectId,
    releasableQtySummary: handoff.stockableQtySummary,
    holdRemainingQtySummary: handoff.holdQtySummary,
    quarantineRemainingQtySummary: handoff.quarantineQtySummary,
    releaseDecisionSummary: "",
    stockReleaseBlockedFlag: handoff.stockReleaseReadiness === "blocked",
    stockReleaseBlockedReason: handoff.stockReleaseReadiness === "blocked" ? "Stock Release 조건 미충족" : null,
    stockReleaseObjectId: null,
  };
}

// ── Validator ──
export interface StockReleaseValidation { canRecordStockRelease: boolean; canOpenReorderDecision: boolean; blockingIssues: string[]; warnings: string[]; recommendedNextAction: string; }
export function validateStockReleaseBeforeRecord(state: StockReleaseState): StockReleaseValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (state.stockReleaseBlockedFlag) blocking.push(state.stockReleaseBlockedReason || "차단됨");
  if (!state.releasableQtySummary) blocking.push("릴리즈 가능 수량 없음");
  if (state.holdRemainingQtySummary && state.holdRemainingQtySummary !== "0개") warnings.push("Hold 잔여 수량 있음");
  if (state.quarantineRemainingQtySummary && state.quarantineRemainingQtySummary !== "0개") warnings.push("Quarantine 잔여 수량 있음");
  const canRecord = blocking.length === 0;
  return { canRecordStockRelease: canRecord, canOpenReorderDecision: canRecord, blockingIssues: blocking, warnings, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : "Stock Release 저장 후 Reorder Decision 진행" };
}

// ── Canonical Object ──
export interface StockReleaseObject { id: string; inventoryIntakeObjectId: string; releasableQtySummary: string; holdRemainingQtySummary: string; quarantineRemainingQtySummary: string; releaseDecisionSummary: string; recordedAt: string; recordedBy: string; }
export function buildStockReleaseObject(state: StockReleaseState): StockReleaseObject {
  return { id: `stkrel_${Date.now().toString(36)}`, inventoryIntakeObjectId: state.inventoryIntakeObjectId, releasableQtySummary: state.releasableQtySummary, holdRemainingQtySummary: state.holdRemainingQtySummary, quarantineRemainingQtySummary: state.quarantineRemainingQtySummary, releaseDecisionSummary: state.releaseDecisionSummary || "전량 릴리즈", recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Reorder Decision Handoff ──
export interface ReorderDecisionHandoff { availableStockReleaseObjectId: string; inventoryIntakeObjectId: string; releasableQtySummary: string; holdRemainingQtySummary: string; quarantineRemainingQtySummary: string; releaseDecisionSummary: string; reorderDecisionReadiness: "ready" | "pending" | "blocked"; }
export function buildReorderDecisionHandoff(obj: StockReleaseObject): ReorderDecisionHandoff {
  return { availableStockReleaseObjectId: obj.id, inventoryIntakeObjectId: obj.inventoryIntakeObjectId, releasableQtySummary: obj.releasableQtySummary, holdRemainingQtySummary: obj.holdRemainingQtySummary, quarantineRemainingQtySummary: obj.quarantineRemainingQtySummary, releaseDecisionSummary: obj.releaseDecisionSummary, reorderDecisionReadiness: "ready" };
}
