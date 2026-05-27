/**
 * PO Draft Submission Gate Engine — draft_ready → 제출 가능 검증 + canonical poCreationSubmissionPackage
 */

import type { PoDraft, PoDraftLine } from "./po-conversion-entry-workbench-engine";

export type PoDraftSubmissionGateStatus = "not_started" | "blocked" | "warning" | "ready" | "submitted";

export interface PoDraftSubmissionGateState { gateStatus: PoDraftSubmissionGateStatus; poDraftId: string; vendorId: string; lineCount: number; totalAmount: number; blockerCount: number; warningCount: number; submissionPackageId: string | null; submittedAt: string | null; }

export interface SubmissionGateItem { id: string; severity: "blocker" | "warning" | "info"; message: string; }

export function evaluatePoDraftSubmissionGate(draft: PoDraft): { gateState: PoDraftSubmissionGateState; items: SubmissionGateItem[] } {
  const items: SubmissionGateItem[] = [];
  if (!draft.vendorId) items.push({ id: "blk_vendor", severity: "blocker", message: "공급사 미지정" });
  if (!draft.vendorOrderContact) items.push({ id: "blk_contact", severity: "blocker", message: "공급사 주문 연락처 누락" });
  if (draft.lineItems.length === 0) items.push({ id: "blk_no_lines", severity: "blocker", message: "라인 항목 없음" });
  const incomplete = draft.lineItems.filter(l => l.lineStatus !== "completed");
  if (incomplete.length > 0) items.push({ id: "blk_incomplete", severity: "blocker", message: `${incomplete.length}개 라인 미완료` });
  if (!draft.shipTo) items.push({ id: "blk_shipto", severity: "blocker", message: "배송지 누락" });
  if (!draft.billTo) items.push({ id: "warn_billto", severity: "warning", message: "청구지 미입력" });
  if (!draft.receivingInstruction) items.push({ id: "warn_rcv", severity: "warning", message: "입고 지시 미입력" });
  if (!draft.expectedDeliveryWindow) items.push({ id: "warn_delivery", severity: "warning", message: "예상 납기 미입력" });
  const blockerCount = items.filter(i => i.severity === "blocker").length;
  const warningCount = items.filter(i => i.severity === "warning").length;
  const total = draft.lineItems.reduce((s, l) => s + l.lineTotal, 0);
  const status: PoDraftSubmissionGateStatus = blockerCount > 0 ? "blocked" : warningCount > 0 ? "warning" : draft.readinessStatus === "ready" ? "ready" : "not_started";
  return { gateState: { gateStatus: status, poDraftId: draft.id, vendorId: draft.vendorId, lineCount: draft.lineItems.length, totalAmount: total, blockerCount, warningCount, submissionPackageId: null, submittedAt: null }, items };
}

// ── Canonical PO Creation Submission Package ──
export interface PoCreationSubmissionPackage { id: string; sourceRequestId: string; sourceApprovalCaseId: string; sourcePoConversionEntryCaseId: string; sourcePoDraftId: string; vendorId: string; vendorOrderContact: string; billTo: string; shipTo: string; requesterContext: string; departmentContext: string; currency: string; lineItems: PoDraftLine[]; amountSummary: string; receivingInstruction: string; internalOrderMemo: string; attachmentInclusionSummary: string; approvalLineageSummary: string; createdAt: string; createdBy: string; submittedAt: string; submittedBy: string; nextDestination: string; }

export function buildPoCreationSubmissionPackage(draft: PoDraft): PoCreationSubmissionPackage {
  const total = draft.lineItems.reduce((s, l) => s + l.lineTotal, 0);
  return { id: `posubpkg_${Date.now().toString(36)}`, sourceRequestId: "", sourceApprovalCaseId: "", sourcePoConversionEntryCaseId: draft.poConversionEntryCaseId, sourcePoDraftId: draft.id, vendorId: draft.vendorId, vendorOrderContact: draft.vendorOrderContact, billTo: draft.billTo, shipTo: draft.shipTo, requesterContext: draft.requesterContext, departmentContext: draft.departmentContext, currency: draft.currency, lineItems: draft.lineItems, amountSummary: `₩${total.toLocaleString("ko-KR")}`, receivingInstruction: draft.receivingInstruction, internalOrderMemo: draft.internalOrderMemo, attachmentInclusionSummary: draft.attachmentInclusionSummary, approvalLineageSummary: "", createdAt: new Date().toISOString(), createdBy: "operator", submittedAt: new Date().toISOString(), submittedBy: "operator", nextDestination: "po_creation_execution" };
}
