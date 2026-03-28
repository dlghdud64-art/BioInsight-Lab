/**
 * Dispatch Preparation Engine — 발송 준비 상태 모델 + recipient/outbound/attachment + validator + send confirmation handoff
 */

import type { DispatchPreparationHandoff } from "./po-created-engine";

// ── Status ──
export type DispatchPrepStatus = "dispatch_preparation_open" | "dispatch_preparation_in_progress" | "dispatch_preparation_recorded";
export type DispatchPrepSubstatus = "awaiting_recipient_review" | "awaiting_outbound_summary" | "awaiting_attachment_bundle" | "dispatch_preparation_blocked" | "ready_for_send_confirmation";

// ── State ──
export interface DispatchPreparationState {
  dispatchPreparationStatus: DispatchPrepStatus;
  substatus: DispatchPrepSubstatus;
  dispatchPreparationOpenedAt: string;
  poCreatedObjectId: string;
  createdVendorIds: string[];
  recipients: DispatchRecipient[];
  outboundPackage: OutboundPackageBasis;
  attachmentBundle: AttachmentBundleItem[];
  missingFieldCount: number;
  dispatchPreparationBlockedFlag: boolean;
  dispatchPreparationBlockedReason: string | null;
  dispatchPreparationObjectId: string | null;
}

export interface DispatchRecipient { recipientId: string; displayName: string; email: string; role: "primary" | "cc"; channel: string; isValid: boolean; }
export interface OutboundPackageBasis { supplierFacingNote: string; poSummary: string; deliveryReference: string; paymentReference: string; responseExpectation: string; }
export interface AttachmentBundleItem { attachmentId: string; name: string; type: "po_document" | "supporting" | "optional"; included: boolean; }

export function createInitialDispatchPrepState(handoff: DispatchPreparationHandoff): DispatchPreparationState {
  const recipients = handoff.createdVendorIds.map((vid, i) => ({
    recipientId: `rcpt_${vid}`, displayName: vid, email: "", role: "primary" as const, channel: "email", isValid: false,
  }));
  return {
    dispatchPreparationStatus: "dispatch_preparation_open",
    substatus: "awaiting_recipient_review",
    dispatchPreparationOpenedAt: new Date().toISOString(),
    poCreatedObjectId: handoff.poCreatedObjectId,
    createdVendorIds: handoff.createdVendorIds,
    recipients,
    outboundPackage: { supplierFacingNote: "", poSummary: handoff.createdLineCoverageSummary, deliveryReference: "", paymentReference: "", responseExpectation: "" },
    attachmentBundle: [{ attachmentId: "att_po", name: "PO 문서", type: "po_document", included: true }],
    missingFieldCount: 0,
    dispatchPreparationBlockedFlag: handoff.dispatchReadiness === "blocked",
    dispatchPreparationBlockedReason: handoff.dispatchReadiness === "blocked" ? "Dispatch 준비 조건 미충족" : null,
    dispatchPreparationObjectId: null,
  };
}

// ── Readiness ──
export interface DispatchPrepReadiness { sendCriticalMissing: string[]; nonCriticalMissing: string[]; isSendReady: boolean; }
export function buildDispatchPrepReadiness(state: DispatchPreparationState): DispatchPrepReadiness {
  const critical: string[] = [];
  const nonCritical: string[] = [];
  if (state.recipients.filter(r => r.role === "primary").length === 0) critical.push("주 수신자");
  if (!state.recipients.some(r => r.isValid)) critical.push("유효한 수신자");
  if (!state.outboundPackage.supplierFacingNote && !state.outboundPackage.poSummary) critical.push("발송 내용");
  if (!state.attachmentBundle.some(a => a.type === "po_document" && a.included)) critical.push("PO 문서 첨부");
  if (!state.outboundPackage.deliveryReference) nonCritical.push("납품 참조");
  if (!state.outboundPackage.responseExpectation) nonCritical.push("응답 요청");
  return { sendCriticalMissing: critical, nonCriticalMissing: nonCritical, isSendReady: critical.length === 0 };
}

// ── Validator ──
export interface DispatchPrepValidation { canRecordDispatchPreparation: boolean; canOpenSendConfirmation: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateDispatchPrepBeforeRecord(state: DispatchPreparationState): DispatchPrepValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.dispatchPreparationBlockedFlag) blocking.push(state.dispatchPreparationBlockedReason || "차단됨");
  const readiness = buildDispatchPrepReadiness(state);
  readiness.sendCriticalMissing.forEach(f => { warnings.push(`필수: ${f}`); missing.push(f); });
  readiness.nonCriticalMissing.forEach(f => missing.push(`(선택) ${f}`));
  const canRecord = blocking.length === 0;
  return { canRecordDispatchPreparation: canRecord, canOpenSendConfirmation: canRecord && readiness.isSendReady, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : !readiness.isSendReady ? "필수 필드 입력" : "Dispatch Preparation 저장" };
}

// ── Canonical Object ──
export interface DispatchPreparationObject { id: string; poCreatedObjectId: string; primaryRecipient: string; sendChannel: string; outboundSummary: string; attachmentBundleSummary: string; readinessSummary: string; recordedAt: string; recordedBy: string; }
export function buildDispatchPreparationObject(state: DispatchPreparationState): DispatchPreparationObject {
  const primary = state.recipients.find(r => r.role === "primary");
  return {
    id: `dispprep_${Date.now().toString(36)}`,
    poCreatedObjectId: state.poCreatedObjectId,
    primaryRecipient: primary?.displayName || "미지정",
    sendChannel: primary?.channel || "email",
    outboundSummary: state.outboundPackage.poSummary || state.outboundPackage.supplierFacingNote || "",
    attachmentBundleSummary: `${state.attachmentBundle.filter(a => a.included).length}개 첨부`,
    readinessSummary: buildDispatchPrepReadiness(state).isSendReady ? "Send 준비 완료" : "Send 준비 미완료",
    recordedAt: new Date().toISOString(),
    recordedBy: "operator",
  };
}

// ── Send Confirmation Handoff ──
export interface SendConfirmationHandoff { dispatchPreparationObjectId: string; poCreatedObjectId: string; primaryRecipient: string; sendChannel: string; attachmentBundleSummary: string; outboundSummary: string; sendConfirmationReadiness: "ready" | "incomplete" | "blocked"; }
export function buildSendConfirmationHandoff(obj: DispatchPreparationObject): SendConfirmationHandoff {
  return { dispatchPreparationObjectId: obj.id, poCreatedObjectId: obj.poCreatedObjectId, primaryRecipient: obj.primaryRecipient, sendChannel: obj.sendChannel, attachmentBundleSummary: obj.attachmentBundleSummary, outboundSummary: obj.outboundSummary, sendConfirmationReadiness: obj.readinessSummary.includes("완료") ? "ready" : "incomplete" };
}
