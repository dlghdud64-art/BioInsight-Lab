/**
 * Inventory Intake Engine — 재고 편입 상태 + stockable/hold/quarantine disposition + lot/expiry/storage assignment + stock release handoff
 */

import type { InventoryIntakeHandoff, ReceivingExecutionObject } from "./receiving-execution-engine";

// ── Status ──
export type InventoryIntakeStatus = "inventory_intake_open" | "inventory_intake_in_progress" | "inventory_intake_recorded";
export type InventoryIntakeSubstatus = "awaiting_stockable_allocation" | "awaiting_lot_expiry_storage_assignment" | "awaiting_hold_quarantine_disposition" | "inventory_intake_blocked" | "partially_stockable_recorded" | "ready_for_stock_release";

// ── Disposition ──
export type DispositionType = "stockable_now" | "inspection_hold" | "quarantine_hold" | "damaged_retained" | "discard_pending" | "unresolved";

export interface LineDisposition { lineId: string; disposition: DispositionType; qty: number; lotNumber: string; expiryDate: string; storageLocation: string; note: string; }

// ── State ──
export interface InventoryIntakeState {
  inventoryIntakeStatus: InventoryIntakeStatus;
  substatus: InventoryIntakeSubstatus;
  inventoryIntakeOpenedAt: string;
  inventoryIntakeOpenedBy: "execution_handoff" | "manual";
  receivingExecutionObjectId: string;
  receivedLineCount: number;
  stockableLineCount: number;
  stockableQtySummary: string;
  holdQtySummary: string;
  quarantineQtySummary: string;
  damagedQtySummary: string;
  missingCaptureCount: number;
  inventoryIntakeBlockedFlag: boolean;
  inventoryIntakeBlockedReason: string | null;
  inventoryIntakeObjectId: string | null;
  lineDispositions: LineDisposition[];
}

export function createInitialInventoryIntakeState(handoff: InventoryIntakeHandoff): InventoryIntakeState {
  return {
    inventoryIntakeStatus: "inventory_intake_open",
    substatus: "awaiting_stockable_allocation",
    inventoryIntakeOpenedAt: new Date().toISOString(),
    inventoryIntakeOpenedBy: "execution_handoff",
    receivingExecutionObjectId: handoff.receivingExecutionObjectId,
    receivedLineCount: 0,
    stockableLineCount: 0,
    stockableQtySummary: "",
    holdQtySummary: "",
    quarantineQtySummary: "",
    damagedQtySummary: "",
    missingCaptureCount: 0,
    inventoryIntakeBlockedFlag: handoff.inventoryIntakeReadiness === "blocked",
    inventoryIntakeBlockedReason: handoff.inventoryIntakeReadiness === "blocked" ? "Inventory Intake 조건 미충족" : null,
    inventoryIntakeObjectId: null,
    lineDispositions: [],
  };
}

// ── Disposition Plan ──
export interface InventoryDispositionPlan { stockableLineIds: string[]; holdLineIds: string[]; quarantineLineIds: string[]; damagedLineIds: string[]; discardCandidateLineIds: string[]; blockingIssues: string[]; warnings: string[]; }
export function buildInventoryDispositionPlan(dispositions: LineDisposition[]): InventoryDispositionPlan {
  const stockable = dispositions.filter(d => d.disposition === "stockable_now").map(d => d.lineId);
  const hold = dispositions.filter(d => d.disposition === "inspection_hold").map(d => d.lineId);
  const quarantine = dispositions.filter(d => d.disposition === "quarantine_hold").map(d => d.lineId);
  const damaged = dispositions.filter(d => d.disposition === "damaged_retained").map(d => d.lineId);
  const discard = dispositions.filter(d => d.disposition === "discard_pending").map(d => d.lineId);
  const unresolved = dispositions.filter(d => d.disposition === "unresolved");
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (unresolved.length > 0) blocking.push(`${unresolved.length}개 라인 미결정`);
  if (damaged.length > 0) warnings.push(`${damaged.length}개 손상 보유`);
  if (quarantine.length > 0) warnings.push(`${quarantine.length}개 검역 보류`);
  return { stockableLineIds: stockable, holdLineIds: hold, quarantineLineIds: quarantine, damagedLineIds: damaged, discardCandidateLineIds: discard, blockingIssues: blocking, warnings };
}

// ── Stock Entry Assignment ──
export interface StockEntryAssignment { lotAssignmentStatus: "assigned" | "pending" | "not_required"; expiryAssignmentStatus: "assigned" | "pending" | "not_required"; storageAssignmentStatus: "assigned" | "pending" | "not_required"; inventoryBucketStatus: "assigned" | "pending"; receivingDocLinkStatus: "linked" | "pending"; blockingIssues: string[]; warnings: string[]; }
export function buildInventoryStockEntryAssignments(dispositions: LineDisposition[]): StockEntryAssignment {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const noLot = dispositions.filter(d => d.disposition === "stockable_now" && !d.lotNumber);
  const noExpiry = dispositions.filter(d => d.disposition === "stockable_now" && !d.expiryDate);
  const noStorage = dispositions.filter(d => d.disposition === "stockable_now" && !d.storageLocation);
  if (noLot.length > 0) warnings.push(`${noLot.length}개 Lot 미지정`);
  if (noExpiry.length > 0) warnings.push(`${noExpiry.length}개 유효기한 미지정`);
  if (noStorage.length > 0) blocking.push(`${noStorage.length}개 보관 위치 미지정`);
  const hasLot = dispositions.some(d => d.lotNumber);
  const hasExpiry = dispositions.some(d => d.expiryDate);
  const hasStorage = dispositions.some(d => d.storageLocation);
  return { lotAssignmentStatus: hasLot ? "assigned" : dispositions.length > 0 ? "pending" : "not_required", expiryAssignmentStatus: hasExpiry ? "assigned" : dispositions.length > 0 ? "pending" : "not_required", storageAssignmentStatus: hasStorage ? "assigned" : dispositions.length > 0 ? "pending" : "not_required", inventoryBucketStatus: "pending", receivingDocLinkStatus: "pending", blockingIssues: blocking, warnings };
}

// ── Validator ──
export interface InventoryIntakeValidation { canRecordInventoryIntake: boolean; canOpenStockRelease: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateInventoryIntakeBeforeRecord(state: InventoryIntakeState): InventoryIntakeValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.inventoryIntakeBlockedFlag) blocking.push(state.inventoryIntakeBlockedReason || "차단됨");
  if (state.lineDispositions.length === 0) blocking.push("라인별 disposition 없음");
  const plan = buildInventoryDispositionPlan(state.lineDispositions);
  plan.blockingIssues.forEach(b => blocking.push(b));
  plan.warnings.forEach(w => warnings.push(w));
  const assignments = buildInventoryStockEntryAssignments(state.lineDispositions);
  assignments.blockingIssues.forEach(b => { blocking.push(b); missing.push(b); });
  assignments.warnings.forEach(w => { warnings.push(w); missing.push(w); });
  const canRecord = blocking.length === 0;
  const canRelease = canRecord && plan.stockableLineIds.length > 0 && assignments.storageAssignmentStatus === "assigned";
  return { canRecordInventoryIntake: canRecord, canOpenStockRelease: canRelease, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : !canRelease ? "Lot/Storage 지정 완료 후 진행" : "Stock Release로 보내기" };
}

// ── Decision Options ──
export interface InventoryIntakeDecisionOptions { canRecordIntake: boolean; canOpenStockRelease: boolean; canHold: boolean; canReturnExecution: boolean; decisionReasonSummary: string; }
export function buildInventoryIntakeDecisionOptions(state: InventoryIntakeState): InventoryIntakeDecisionOptions {
  const v = validateInventoryIntakeBeforeRecord(state);
  return { canRecordIntake: v.canRecordInventoryIntake, canOpenStockRelease: v.canOpenStockRelease, canHold: v.missingItems.length > 0, canReturnExecution: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Inventory Intake Object ──
export interface InventoryIntakeObject { id: string; receivingExecutionObjectId: string; stockableQtySummary: string; holdQtySummary: string; quarantineQtySummary: string; damagedQtySummary: string; inventoryAssignmentSummary: string; dispositionSummary: string; recordedAt: string; recordedBy: string; }
export function buildInventoryIntakeObject(state: InventoryIntakeState): InventoryIntakeObject {
  const plan = buildInventoryDispositionPlan(state.lineDispositions);
  return { id: `invintake_${Date.now().toString(36)}`, receivingExecutionObjectId: state.receivingExecutionObjectId, stockableQtySummary: state.stockableQtySummary || `${plan.stockableLineIds.length}개 라인`, holdQtySummary: state.holdQtySummary || `${plan.holdLineIds.length}개`, quarantineQtySummary: state.quarantineQtySummary || `${plan.quarantineLineIds.length}개`, damagedQtySummary: state.damagedQtySummary || `${plan.damagedLineIds.length}개`, inventoryAssignmentSummary: `Stockable: ${plan.stockableLineIds.length}, Hold: ${plan.holdLineIds.length}, Quarantine: ${plan.quarantineLineIds.length}`, dispositionSummary: plan.blockingIssues.length > 0 ? plan.blockingIssues.join("; ") : "전량 disposition 완료", recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Stock Release Handoff ──
export interface AvailableStockReleaseHandoff { inventoryIntakeObjectId: string; receivingExecutionObjectId: string; stockableQtySummary: string; holdQtySummary: string; quarantineQtySummary: string; inventoryAssignmentSummary: string; stockReleaseReadiness: "ready" | "pending" | "blocked"; }
export function buildAvailableStockReleaseHandoff(obj: InventoryIntakeObject, canRelease: boolean): AvailableStockReleaseHandoff {
  return { inventoryIntakeObjectId: obj.id, receivingExecutionObjectId: obj.receivingExecutionObjectId, stockableQtySummary: obj.stockableQtySummary, holdQtySummary: obj.holdQtySummary, quarantineQtySummary: obj.quarantineQtySummary, inventoryAssignmentSummary: obj.inventoryAssignmentSummary, stockReleaseReadiness: canRelease ? "ready" : "pending" };
}
