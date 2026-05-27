/**
 * PO Conversion Entry Workbench Engine — canonical poDraft + line item + order context + readiness
 */

import type { PoConversionEntryHandoffPackageV2, ApprovedItemLine } from "./approval-workbench-engine";

// ── Case Status ──
export type PoConversionEntryCaseStatus = "queued" | "in_entry" | "on_hold" | "draft_ready" | "returned_for_revision" | "cancelled";
export type PoEntryReadinessStatus = "blocked" | "warning" | "ready";
export type PoDraftMode = "editing" | "hold" | "ready_for_submission";
export type PoLineStatus = "pending_completion" | "completed" | "flagged";

// ── PO Draft Line ──
export interface PoDraftLine { sourceApprovedLineId: string; itemId: string; itemName: string; supplierSku: string; pack: string; qty: number; unitPrice: number; currency: string; lineTotal: number; deliveryNote: string; receivingNote: string; memo: string; lineStatus: PoLineStatus; }

// ── PO Draft ──
export interface PoDraft { id: string; poConversionEntryCaseId: string; poConversionEntryHandoffPackageId: string; vendorId: string; vendorOrderContact: string; billTo: string; shipTo: string; requesterContext: string; departmentContext: string; expectedDeliveryWindow: string; receivingInstruction: string; internalOrderMemo: string; currency: string; lineItems: PoDraftLine[]; attachmentInclusionSummary: string; readinessStatus: PoEntryReadinessStatus; createdAt: string; createdBy: string; lastEditedAt: string; markedReadyAt: string | null; }

// ── State ──
export interface PoConversionEntryWorkbenchState {
  caseStatus: PoConversionEntryCaseStatus;
  draftMode: PoDraftMode;
  entryReadiness: PoEntryReadinessStatus;
  handoffPackageId: string;
  poDraft: PoDraft;
  blockerCount: number;
  warningCount: number;
}

export function createInitialPoConversionEntryState(pkg: PoConversionEntryHandoffPackageV2): PoConversionEntryWorkbenchState {
  const lines: PoDraftLine[] = pkg.approvedItemLines.map((l) => ({ sourceApprovedLineId: l.itemId, itemId: l.itemId, itemName: l.itemName, supplierSku: l.supplierSku, pack: l.pack, qty: l.qty, unitPrice: l.unitPrice, currency: "KRW", lineTotal: l.qty * l.unitPrice, deliveryNote: "", receivingNote: "", memo: l.note, lineStatus: "pending_completion" }));
  const draft: PoDraft = { id: `podraft_${Date.now().toString(36)}`, poConversionEntryCaseId: `pocase_${Date.now().toString(36)}`, poConversionEntryHandoffPackageId: pkg.id, vendorId: pkg.selectedVendorId, vendorOrderContact: "", billTo: "", shipTo: "", requesterContext: pkg.requesterContext, departmentContext: pkg.departmentContext, expectedDeliveryWindow: "", receivingInstruction: "", internalOrderMemo: "", currency: "KRW", lineItems: lines, attachmentInclusionSummary: pkg.attachmentSummary, readinessStatus: "blocked", createdAt: new Date().toISOString(), createdBy: "operator", lastEditedAt: new Date().toISOString(), markedReadyAt: null };
  return { caseStatus: "in_entry", draftMode: "editing", entryReadiness: "blocked", handoffPackageId: pkg.id, poDraft: draft, blockerCount: 0, warningCount: 0 };
}

// ── Readiness Validator ──
export interface PoEntryReadinessValidation { canMarkDraftReady: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validatePoEntryReadiness(state: PoConversionEntryWorkbenchState): PoEntryReadinessValidation {
  const blocking: string[] = []; const warnings: string[] = []; const missing: string[] = [];
  const d = state.poDraft;
  if (!d.vendorId) { blocking.push("공급사 미지정"); missing.push("공급사"); }
  if (d.lineItems.length === 0) { blocking.push("라인 항목 없음"); missing.push("라인 항목"); }
  const incomplete = d.lineItems.filter(l => l.lineStatus !== "completed");
  if (incomplete.length > 0) { blocking.push(`${incomplete.length}개 라인 미완료`); missing.push("라인 완료"); }
  const noQty = d.lineItems.filter(l => l.qty <= 0);
  if (noQty.length > 0) blocking.push(`${noQty.length}개 라인 수량 0`);
  if (!d.shipTo) { blocking.push("배송지 미지정"); missing.push("배송지"); }
  if (!d.billTo) warnings.push("청구지 미입력");
  if (!d.receivingInstruction) warnings.push("입고 지시 미입력");
  if (!d.expectedDeliveryWindow) warnings.push("예상 납기 미입력");
  const canReady = blocking.length === 0;
  return { canMarkDraftReady: canReady, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : warnings.length > 0 ? "경고 항목 검토 후 draft ready" : "Draft Ready로 표시" };
}

export function markPoDraftReady(state: PoConversionEntryWorkbenchState): PoConversionEntryWorkbenchState {
  return { ...state, caseStatus: "draft_ready", draftMode: "ready_for_submission", entryReadiness: "ready", poDraft: { ...state.poDraft, readinessStatus: "ready", markedReadyAt: new Date().toISOString(), lastEditedAt: new Date().toISOString() } };
}
