/**
 * Stock Release Handoff Gate v2 — variance disposition → stock release entry
 * disposition complete + releasable qty > 0일 때만 stock release 진입.
 * hold/rejected scope는 stock release 대상에서 제외.
 */

import type { ReceivingVarianceDispositionSessionV2, VarianceDispositionStatus } from "./receiving-variance-disposition-v2-engine";

export type StockReleaseHandoffGateStatusV2 = "not_eligible" | "disposition_dependency_open" | "eligible_for_stock_release" | "stock_release_locked";

export interface StockReleaseHandoffGateV2Engine {
  stockReleaseHandoffGateId: string; caseId: string; sentStateRecordId: string; dispositionSessionId: string;
  gateStatus: StockReleaseHandoffGateStatusV2;
  dispositionStatus: VarianceDispositionStatus; allDispositionsComplete: boolean;
  totalReleasableQty: number; totalHoldQty: number; totalRejectedQty: number;
  stockReleaseAllowed: boolean;
  blockers: string[]; warnings: string[];
  canOpenStockReleaseWorkspace: boolean;
  nextSurfaceLabel: string; generatedAt: string;
}

export function buildStockReleaseHandoffGateV2(dispSession: ReceivingVarianceDispositionSessionV2): StockReleaseHandoffGateV2Engine {
  const blockers: string[] = []; const warnings: string[] = [];
  if (!dispSession.allDispositionsComplete) blockers.push("Disposition 미완료");
  if (!dispSession.stockReleaseAllowed) blockers.push("Stock release not allowed");
  if (dispSession.totalReleasableQty === 0) blockers.push("Releasable qty = 0");
  if (dispSession.totalHoldQty > 0) warnings.push(`Hold qty: ${dispSession.totalHoldQty}`);
  if (dispSession.totalRejectedQty > 0) warnings.push(`Rejected qty: ${dispSession.totalRejectedQty}`);

  const canOpen = blockers.length === 0 && dispSession.stockReleaseAllowed;
  const gateStatus: StockReleaseHandoffGateStatusV2 = !dispSession.allDispositionsComplete ? "disposition_dependency_open" : !dispSession.stockReleaseAllowed ? "not_eligible" : blockers.length > 0 ? "stock_release_locked" : "eligible_for_stock_release";

  return { stockReleaseHandoffGateId: `stkrlhgate_${Date.now().toString(36)}`, caseId: dispSession.caseId, sentStateRecordId: dispSession.sentStateRecordId, dispositionSessionId: dispSession.dispositionSessionId, gateStatus, dispositionStatus: dispSession.sessionStatus, allDispositionsComplete: dispSession.allDispositionsComplete, totalReleasableQty: dispSession.totalReleasableQty, totalHoldQty: dispSession.totalHoldQty, totalRejectedQty: dispSession.totalRejectedQty, stockReleaseAllowed: dispSession.stockReleaseAllowed, blockers, warnings, canOpenStockReleaseWorkspace: canOpen, nextSurfaceLabel: canOpen ? "Stock Release Workspace (Entry Enabled)" : "Stock Release Workspace (Locked)", generatedAt: new Date().toISOString() };
}
