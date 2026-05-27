/**
 * Dispatch Preparation Workbench Engine — outbound assembly + send package + readiness
 *
 * 고정 규칙:
 * 1. poRecord = canonical PO truth. dispatch prep에서 vendor/qty/amount 수정 금지.
 * 2. supplier-facing 정보는 dispatchPreparationDraft에서 관리.
 * 3. ready_for_send_confirmation ≠ sent.
 * 4. canonical dispatchSendPackage = send confirmation 단일 intake source.
 */

import type { PoRecord } from "./po-creation-execution-engine";

// ── Case Status ──
export type DispatchPreparationCaseStatus = "queued" | "in_preparation" | "on_hold" | "ready_for_send_confirmation" | "returned_for_correction" | "cancelled";
export type DispatchPreparationReadinessStatus = "blocked" | "warning" | "ready";
export type SendChannel = "email" | "supplier_portal" | "manual_upload" | "other_controlled";

// ── Draft ──
export interface DispatchPreparationDraft {
  id: string;
  poRecordId: string;
  channel: SendChannel;
  primaryRecipient: string;
  ccRecipients: string[];
  subject: string;
  supplierMessage: string;
  attachmentSelection: string[];
  operatorNote: string;
}

// ── State ──
export interface DispatchPreparationWorkbenchState {
  caseStatus: DispatchPreparationCaseStatus;
  readiness: DispatchPreparationReadinessStatus;
  poRecordId: string;
  vendorId: string;
  lineCount: number;
  amountSummary: string;
  draft: DispatchPreparationDraft;
  blockerCount: number;
  warningCount: number;
}

export function createInitialDispatchPreparationWorkbenchState(poRecord: PoRecord): DispatchPreparationWorkbenchState {
  const draft: DispatchPreparationDraft = { id: `dispprep_${Date.now().toString(36)}`, poRecordId: poRecord.id, channel: "email", primaryRecipient: "", ccRecipients: [], subject: "", supplierMessage: "", attachmentSelection: [], operatorNote: "" };
  const readiness = evaluateDispatchPreparationReadiness(draft, poRecord);
  return { caseStatus: "in_preparation", readiness: readiness.status, poRecordId: poRecord.id, vendorId: poRecord.vendorId, lineCount: poRecord.lineItems.length, amountSummary: poRecord.amountSummary, draft, blockerCount: readiness.blockers.length, warningCount: readiness.warnings.length };
}

// ── Readiness ──
export interface DispatchPrepReadinessResult { status: DispatchPreparationReadinessStatus; blockers: string[]; warnings: string[]; }
export function evaluateDispatchPreparationReadiness(draft: DispatchPreparationDraft, poRecord: PoRecord): DispatchPrepReadinessResult {
  const blockers: string[] = []; const warnings: string[] = [];
  if (!draft.primaryRecipient) blockers.push("공급사 수신자 미지정");
  if (!draft.channel) blockers.push("발송 채널 미선택");
  if (!poRecord.vendorOrderContact) blockers.push("공급사 발송 연락처 누락");
  if (!poRecord.shipTo) blockers.push("배송지 누락");
  if (poRecord.lineItems.length === 0) blockers.push("라인 항목 없음");
  if (draft.attachmentSelection.length === 0) warnings.push("첨부 파일 없음");
  if (!draft.supplierMessage) warnings.push("공급사 대상 메모 미입력");
  if (!draft.subject) warnings.push("발송 제목 미입력");
  return { status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready", blockers, warnings };
}

// ── Canonical Dispatch Send Package ──
export interface DispatchSendPackage { id: string; sourcePoRecordId: string; sourceDispatchPreparationCaseId: string; sourceDispatchPreparationDraftId: string; vendorId: string; primaryRecipient: string; ccRecipients: string[]; channel: SendChannel; subject: string; supplierMessage: string; attachmentSummary: string; lineItemsSummary: string; amountSummary: string; shipTo: string; deliveryContext: string; operatorNote: string; blockerSnapshot: string[]; warningSnapshot: string[]; createdAt: string; createdBy: string; nextDestination: string; }

export function buildDispatchSendPackage(draft: DispatchPreparationDraft, poRecord: PoRecord, readiness: DispatchPrepReadinessResult): DispatchSendPackage {
  return { id: `dispsendpkg_${Date.now().toString(36)}`, sourcePoRecordId: poRecord.id, sourceDispatchPreparationCaseId: "", sourceDispatchPreparationDraftId: draft.id, vendorId: poRecord.vendorId, primaryRecipient: draft.primaryRecipient, ccRecipients: draft.ccRecipients, channel: draft.channel, subject: draft.subject, supplierMessage: draft.supplierMessage, attachmentSummary: draft.attachmentSelection.join(", ") || "없음", lineItemsSummary: `${poRecord.lineItems.length}개 라인`, amountSummary: poRecord.amountSummary, shipTo: poRecord.shipTo, deliveryContext: poRecord.receivingInstruction, operatorNote: draft.operatorNote, blockerSnapshot: readiness.blockers, warningSnapshot: readiness.warnings, createdAt: new Date().toISOString(), createdBy: "operator", nextDestination: "send_confirmation" };
}
