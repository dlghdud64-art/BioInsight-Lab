/**
 * PO Creation Execution Engine — canonical poRecord 생성 + duplicate/idempotency 보호 + failure triage
 */

import type { PoCreationSubmissionPackage } from "./po-draft-submission-gate-engine";
import type { PoDraftLine } from "./po-conversion-entry-workbench-engine";

// ── Case Status ──
export type PoCreationCaseStatus = "queued" | "generating" | "generated" | "failed" | "cancelled";
export type PoCreationExecutionStatus = "not_started" | "blocked" | "running" | "warning" | "success" | "failed";
export type PoRecordStatus = "created" | "dispatch_preparing" | "sent" | "supplier_acknowledged" | "receiving_pending" | "received" | "cancelled";

// ── Failure Class ──
export type CreationFailureClass = "package_invalid" | "duplicate_detected" | "vendor_resolution_failed" | "line_validation_failed" | "system_generation_failed" | "lineage_broken";

// ── State ──
export interface PoCreationExecutionState { caseStatus: PoCreationCaseStatus; executionStatus: PoCreationExecutionStatus; submissionPackageId: string; vendorId: string; lineCount: number; totalAmount: string; duplicateCheckPassed: boolean; failureClass: CreationFailureClass | null; failureMessage: string; retryCount: number; poRecordId: string | null; createdAt: string | null; }

export function createInitialPoCreationExecutionState(pkg: PoCreationSubmissionPackage): PoCreationExecutionState {
  const total = pkg.lineItems.reduce((s, l) => s + l.lineTotal, 0);
  return { caseStatus: "queued", executionStatus: "not_started", submissionPackageId: pkg.id, vendorId: pkg.vendorId, lineCount: pkg.lineItems.length, totalAmount: `₩${total.toLocaleString("ko-KR")}`, duplicateCheckPassed: false, failureClass: null, failureMessage: "", retryCount: 0, poRecordId: null, createdAt: null };
}

// ── Execution Checkpoint ──
export interface ExecutionCheckpoint { packageIntegrity: boolean; vendorResolvable: boolean; lineNormalized: boolean; amountConsistent: boolean; addressComplete: boolean; duplicateCheckPassed: boolean; lineageContinuity: boolean; blockingIssues: string[]; warnings: string[]; }
export function evaluateExecutionCheckpoints(state: PoCreationExecutionState, pkg: PoCreationSubmissionPackage): ExecutionCheckpoint {
  const blocking: string[] = []; const warnings: string[] = [];
  const pkgOk = !!pkg.id; if (!pkgOk) blocking.push("Submission package 없음");
  const vendorOk = !!pkg.vendorId; if (!vendorOk) blocking.push("Vendor identity 누락");
  const lineOk = pkg.lineItems.length > 0; if (!lineOk) blocking.push("Line items 없음");
  const amountOk = pkg.lineItems.every(l => l.qty > 0 && l.unitPrice >= 0); if (!amountOk) blocking.push("Amount 정합성 실패");
  const addrOk = !!pkg.shipTo && !!pkg.billTo; if (!pkg.shipTo) blocking.push("Ship-to 누락"); if (!pkg.billTo) warnings.push("Bill-to 미입력");
  if (!pkg.attachmentInclusionSummary) warnings.push("Attachment 없음");
  return { packageIntegrity: pkgOk, vendorResolvable: vendorOk, lineNormalized: lineOk, amountConsistent: amountOk, addressComplete: addrOk, duplicateCheckPassed: state.duplicateCheckPassed, lineageContinuity: true, blockingIssues: blocking, warnings };
}

// ── Canonical PO Record ──
export interface PoRecordLine { poLineId: string; sourceDraftLineId: string; itemId: string; itemName: string; supplierSku: string; pack: string; qty: number; unitPrice: number; currency: string; lineTotal: number; deliveryNote: string; receivingNote: string; memo: string; }
export interface PoRecord { id: string; sourceRequestId: string; sourceApprovalCaseId: string; sourcePoConversionEntryCaseId: string; sourcePoDraftId: string; sourcePoCreationSubmissionPackageId: string; vendorId: string; vendorOrderContact: string; billTo: string; shipTo: string; requesterContext: string; departmentContext: string; currency: string; lineItems: PoRecordLine[]; amountSummary: string; receivingInstruction: string; internalOrderMemo: string; attachmentSummary: string; approvalLineageSummary: string; budgetPolicySummary: string; createdAt: string; createdBy: string; creationCaseId: string; status: PoRecordStatus; }

export function buildPoRecord(pkg: PoCreationSubmissionPackage, caseId: string): PoRecord {
  const lines: PoRecordLine[] = pkg.lineItems.map((l, i) => ({ poLineId: `poline_${i}_${Date.now().toString(36)}`, sourceDraftLineId: l.sourceApprovedLineId, itemId: l.itemId, itemName: l.itemName, supplierSku: l.supplierSku, pack: l.pack, qty: l.qty, unitPrice: l.unitPrice, currency: l.currency, lineTotal: l.lineTotal, deliveryNote: l.deliveryNote, receivingNote: l.receivingNote, memo: l.memo }));
  return { id: `po_${Date.now().toString(36)}`, sourceRequestId: pkg.sourceRequestId, sourceApprovalCaseId: pkg.sourceApprovalCaseId, sourcePoConversionEntryCaseId: pkg.sourcePoConversionEntryCaseId, sourcePoDraftId: pkg.sourcePoDraftId, sourcePoCreationSubmissionPackageId: pkg.id, vendorId: pkg.vendorId, vendorOrderContact: pkg.vendorOrderContact, billTo: pkg.billTo, shipTo: pkg.shipTo, requesterContext: pkg.requesterContext, departmentContext: pkg.departmentContext, currency: pkg.currency, lineItems: lines, amountSummary: pkg.amountSummary, receivingInstruction: pkg.receivingInstruction, internalOrderMemo: pkg.internalOrderMemo, attachmentSummary: pkg.attachmentInclusionSummary, approvalLineageSummary: pkg.approvalLineageSummary, budgetPolicySummary: "", createdAt: new Date().toISOString(), createdBy: "operator", creationCaseId: caseId, status: "created" };
}

// ── Execute Creation (simulate) ──
export function executePoCreation(state: PoCreationExecutionState, pkg: PoCreationSubmissionPackage): { success: boolean; state: PoCreationExecutionState; poRecord: PoRecord | null; failureClass: CreationFailureClass | null } {
  const checkpoints = evaluateExecutionCheckpoints(state, pkg);
  if (checkpoints.blockingIssues.length > 0) { return { success: false, state: { ...state, caseStatus: "failed", executionStatus: "failed", failureClass: "package_invalid", failureMessage: checkpoints.blockingIssues[0] }, poRecord: null, failureClass: "package_invalid" }; }
  if (state.poRecordId) { return { success: false, state: { ...state, executionStatus: "failed", failureClass: "duplicate_detected", failureMessage: "이미 생성된 PO가 있습니다" }, poRecord: null, failureClass: "duplicate_detected" }; }
  const caseId = `pocase_${Date.now().toString(36)}`;
  const record = buildPoRecord(pkg, caseId);
  return { success: true, state: { ...state, caseStatus: "generated", executionStatus: "success", duplicateCheckPassed: true, poRecordId: record.id, createdAt: record.createdAt }, poRecord: record, failureClass: null };
}
