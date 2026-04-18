/**
 * PO Dispatch — preparation + validation + send + audit
 *
 * 고정 규칙:
 * 1. dispatch는 오직 po_ready_for_send 상태에서만 진입.
 * 2. preview 확인 전 actual send 금지.
 * 3. recipient/attachment/policy 검증 통과 후에만 send 가능.
 * 4. po_ready_for_send → po_sent 단방향.
 * 5. send 결과는 dispatch log + recipient snapshot + attachment snapshot으로 남음.
 * 6. preview payload = send payload. 분리 금지.
 */

import type { PODetailModel, PODraftState } from "./po-created-detail";

// ══════════════════════════════════════════════════════════════════════════════
// Recipient
// ══════════════════════════════════════════════════════════════════════════════

export interface DispatchRecipient {
  contactId: string;
  name: string;
  email: string;
  role: "primary" | "cc" | "fallback";
  source: "vendor_master" | "approved_contact" | "manual_override";
  verifiedAt: string | null;
  overrideReason: string | null;
}

export interface RecipientResolution {
  recipients: DispatchRecipient[];
  hasPrimary: boolean;
  issues: string[];
}

export function resolveDispatchRecipients(input: {
  vendorId: string;
  vendorName: string;
  vendorContactEmail?: string | null;
}): RecipientResolution {
  const recipients: DispatchRecipient[] = [];
  const issues: string[] = [];

  if (input.vendorContactEmail) {
    recipients.push({
      contactId: `vc_${input.vendorId}`,
      name: input.vendorName,
      email: input.vendorContactEmail,
      role: "primary",
      source: "vendor_master",
      verifiedAt: null,
      overrideReason: null,
    });
  }

  if (recipients.length === 0) {
    issues.push("no_primary_recipient");
  }

  return {
    recipients,
    hasPrimary: recipients.some(r => r.role === "primary"),
    issues,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Attachment Bundle
// ══════════════════════════════════════════════════════════════════════════════

export interface DispatchAttachment {
  attachmentId: string;
  fileName: string;
  fileType: "po_document" | "supporting_doc" | "terms_annex" | "other";
  included: boolean;
  validationStatus: "valid" | "missing" | "invalid";
}

export interface AttachmentBundle {
  attachments: DispatchAttachment[];
  hasRequiredPO: boolean;
  issues: string[];
}

export function buildDispatchAttachmentBundle(input: {
  purchaseOrderId: string;
  supportingDocIds: string[];
}): AttachmentBundle {
  const attachments: DispatchAttachment[] = [];
  const issues: string[] = [];

  // Generated PO document (required)
  attachments.push({
    attachmentId: `po_doc_${input.purchaseOrderId}`,
    fileName: `PO-${input.purchaseOrderId}.pdf`,
    fileType: "po_document",
    included: true,
    validationStatus: "valid",
  });

  // Supporting docs
  for (const docId of input.supportingDocIds) {
    attachments.push({
      attachmentId: docId,
      fileName: `doc-${docId}`,
      fileType: "supporting_doc",
      included: true,
      validationStatus: "valid",
    });
  }

  const hasRequiredPO = attachments.some(a => a.fileType === "po_document" && a.validationStatus === "valid");
  if (!hasRequiredPO) issues.push("required_po_document_missing");

  return { attachments, hasRequiredPO, issues };
}

// ══════════════════════════════════════════════════════════════════════════════
// Dispatch Preparation Model
// ══════════════════════════════════════════════════════════════════════════════

export interface DispatchPreparation {
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;

  recipients: RecipientResolution;
  attachments: AttachmentBundle;

  outboundContent: {
    subject: string;
    messageSummary: string;
    supplierMemo: string | null;
    billingReference: string | null;
    shippingReference: string | null;
    confirmationAsk: string;
  };

  dispatchStatus: "preparing" | "preview_ready" | "preview_confirmed" | "sent";
  previewConfirmed: boolean;
}

export function buildDispatchPreparation(input: {
  detail: PODetailModel;
  vendorContactEmail?: string | null;
  supportingDocIds?: string[];
}): DispatchPreparation {
  const recipients = resolveDispatchRecipients({
    vendorId: input.detail.supplierId,
    vendorName: input.detail.supplierName,
    vendorContactEmail: input.vendorContactEmail,
  });

  const attachments = buildDispatchAttachmentBundle({
    purchaseOrderId: input.detail.purchaseOrderId,
    supportingDocIds: input.supportingDocIds ?? [],
  });

  return {
    purchaseOrderId: input.detail.purchaseOrderId,
    vendorId: input.detail.supplierId,
    vendorName: input.detail.supplierName,
    recipients,
    attachments,
    outboundContent: {
      subject: `Purchase Order ${input.detail.purchaseOrderId} — ${input.detail.supplierName}`,
      messageSummary: `${input.detail.lineCount}건 품목, 총액 ${input.detail.currency} ${input.detail.grandTotal.toLocaleString()}`,
      supplierMemo: input.detail.supplierMemo,
      billingReference: null,
      shippingReference: null,
      confirmationAsk: "주문 확인 및 예상 납기를 회신해 주세요.",
    },
    dispatchStatus: "preparing",
    previewConfirmed: false,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Dispatch Validation Gate
// ══════════════════════════════════════════════════════════════════════════════

export interface DispatchValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export interface DispatchValidationResult {
  canSend: boolean;
  blockingIssues: DispatchValidationIssue[];
  warnings: DispatchValidationIssue[];
  requiredFixActions: string[];
}

export function validateDispatchBeforeSend(
  prep: DispatchPreparation,
  detail: PODetailModel,
  existingSentIds: string[]
): DispatchValidationResult {
  const blockingIssues: DispatchValidationIssue[] = [];
  const warnings: DispatchValidationIssue[] = [];
  const requiredFixActions: string[] = [];

  // Recipient
  if (!prep.recipients.hasPrimary) {
    blockingIssues.push({ code: "no_primary_recipient", message: "수신자가 지정되지 않았습니다." });
    requiredFixActions.push("수신자 확인");
  }

  // Attachment
  if (!prep.attachments.hasRequiredPO) {
    blockingIssues.push({ code: "po_document_missing", message: "PO 문서가 첨부되지 않았습니다." });
    requiredFixActions.push("PO 문서 첨부");
  }

  // Preview
  if (!prep.previewConfirmed) {
    blockingIssues.push({ code: "preview_not_confirmed", message: "발송 미리보기를 확인해 주세요." });
    requiredFixActions.push("발송 미리보기 확인");
  }

  // Status
  if (detail.draftState !== "po_ready_for_send") {
    blockingIssues.push({ code: "invalid_status", message: "전송 준비 완료 상태가 아닙니다." });
  }

  // Duplicate
  if (existingSentIds.includes(detail.purchaseOrderId)) {
    blockingIssues.push({ code: "duplicate_send", message: "이 발주는 이미 전송되었습니다." });
  }

  // Outbound content
  if (!prep.outboundContent.subject) {
    warnings.push({ code: "subject_empty", message: "제목이 비어 있습니다." });
  }
  if (!prep.outboundContent.supplierMemo) {
    warnings.push({ code: "memo_empty", message: "공급사 전달 메모가 비어 있습니다." });
  }

  // Lineage
  if (!detail.lineage.approvalDecisionId) {
    blockingIssues.push({ code: "approval_lineage_missing", message: "승인 결정 참조가 없습니다." });
  }

  return {
    canSend: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    requiredFixActions,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Dispatch Log
// ══════════════════════════════════════════════════════════════════════════════

export interface DispatchLog {
  dispatchLogId: string;
  purchaseOrderId: string;
  procurementCaseId: string;

  recipientSnapshot: DispatchRecipient[];
  attachmentSnapshot: DispatchAttachment[];
  outboundContentSnapshot: DispatchPreparation["outboundContent"];

  sentAt: string;
  sentBy: string | null;
  sendChannel: "email" | "manual" | "api" | "simulated";
  sendResult: "success" | "failed" | "pending";

  lineageSnapshot: {
    requestAssemblyId: string | null;
    approvalDecisionId: string | null;
    poConversionDraftId: string | null;
  };
}

let _dlc = 0;
function dlUid(): string { return `dl_${Date.now()}_${++_dlc}`; }

// ══════════════════════════════════════════════════════════════════════════════
// Send Transaction
// ══════════════════════════════════════════════════════════════════════════════

export interface SendDispatchResult {
  success: boolean;
  dispatchLog: DispatchLog | null;
  newState: PODraftState;
  validationResult: DispatchValidationResult;
}

export function executePoDispatch(input: {
  prep: DispatchPreparation;
  detail: PODetailModel;
  existingSentIds: string[];
  sentBy?: string;
  sendChannel?: DispatchLog["sendChannel"];
}): SendDispatchResult {
  const { prep, detail, existingSentIds } = input;

  // Validate
  const validationResult = validateDispatchBeforeSend(prep, detail, existingSentIds);
  if (!validationResult.canSend) {
    return {
      success: false,
      dispatchLog: null,
      newState: detail.draftState,
      validationResult,
    };
  }

  const now = new Date().toISOString();

  const dispatchLog: DispatchLog = {
    dispatchLogId: dlUid(),
    purchaseOrderId: detail.purchaseOrderId,
    procurementCaseId: detail.procurementCaseId,
    recipientSnapshot: prep.recipients.recipients,
    attachmentSnapshot: prep.attachments.attachments,
    outboundContentSnapshot: prep.outboundContent,
    sentAt: now,
    sentBy: input.sentBy ?? null,
    sendChannel: input.sendChannel ?? "simulated",
    sendResult: "success",
    lineageSnapshot: {
      requestAssemblyId: detail.lineage.requestAssemblyId,
      approvalDecisionId: detail.lineage.approvalDecisionId,
      poConversionDraftId: detail.sourcePOConversionDraftId,
    },
  };

  return {
    success: true,
    dispatchLog,
    newState: "po_sent",
    validationResult,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Dispatch Workbench Model
// ══════════════════════════════════════════════════════════════════════════════

export interface DispatchWorkbenchModel {
  preparation: DispatchPreparation | null;
  validation: DispatchValidationResult | null;
  isDispatchVisible: boolean;
  canPreview: boolean;
  canSend: boolean;

  // Dock CTAs
  previewLabel: string;
  sendLabel: string;
  backLabel: string;

  // Rail
  checklistItems: DispatchChecklistItem[];
}

export interface DispatchChecklistItem {
  label: string;
  status: "done" | "pending" | "blocked";
}

export function buildDispatchWorkbenchModel(input: {
  detail: PODetailModel | null;
  prep: DispatchPreparation | null;
  validation: DispatchValidationResult | null;
  existingSentIds: string[];
}): DispatchWorkbenchModel {
  const { detail, prep, validation } = input;

  if (!detail || detail.draftState !== "po_ready_for_send") {
    return {
      preparation: null,
      validation: null,
      isDispatchVisible: false,
      canPreview: false,
      canSend: false,
      previewLabel: "발송 미리보기",
      sendLabel: "전송",
      backLabel: "PO 상세로 돌아가기",
      checklistItems: [],
    };
  }

  const checklist: DispatchChecklistItem[] = [
    { label: "수신자 확인", status: prep?.recipients.hasPrimary ? "done" : "blocked" },
    { label: "PO 문서 첨부", status: prep?.attachments.hasRequiredPO ? "done" : "blocked" },
    { label: "발송 내용 확인", status: prep?.outboundContent.subject ? "done" : "pending" },
    { label: "미리보기 확인", status: prep?.previewConfirmed ? "done" : "pending" },
    { label: "중복 전송 확인", status: input.existingSentIds.includes(detail.purchaseOrderId) ? "blocked" : "done" },
  ];

  const canPreview = !!prep && prep.recipients.hasPrimary && prep.attachments.hasRequiredPO;
  const canSend = !!validation?.canSend;

  return {
    preparation: prep,
    validation,
    isDispatchVisible: true,
    canPreview,
    canSend,
    previewLabel: prep?.previewConfirmed ? "미리보기 재확인" : "발송 미리보기",
    sendLabel: canSend ? "확인 후 전송" : `전송 불가 (${validation?.blockingIssues.length ?? 0}건 차단)`,
    backLabel: "PO 상세로 돌아가기",
    checklistItems: checklist,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Dispatch Activity Events
// ══════════════════════════════════════════════════════════════════════════════

export type DispatchActivityType =
  | "dispatch_preparation_started"
  | "dispatch_preview_generated"
  | "dispatch_preview_confirmed"
  | "dispatch_sent"
  | "dispatch_failed";

export interface DispatchActivity {
  type: DispatchActivityType;
  at: string;
  actorId: string | null;
  summary: string;
}

export function createDispatchActivity(input: {
  type: DispatchActivityType;
  actorId?: string;
  summary: string;
}): DispatchActivity {
  return {
    type: input.type,
    at: new Date().toISOString(),
    actorId: input.actorId ?? null,
    summary: input.summary,
  };
}
