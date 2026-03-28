/**
 * Send Confirmation Workbench Engine — final confirmation + duplicate protection + dispatch execution case
 *
 * 고정 규칙:
 * 1. dispatchSendPackage = 단일 입력 source. preparation payload 재작성 금지.
 * 2. ready_for_send_confirmation ≠ sent. confirmation은 잠금 단계.
 * 3. duplicate send protection 강제.
 * 4. canonical sendConfirmationRecord + dispatchExecutionCase 분리 생성.
 * 5. core PO truth 수정 금지 — confirmation은 확인+잠금만.
 */

import type { DispatchSendPackage } from "./dispatch-preparation-workbench-engine";

// ── Case Status ──
export type SendConfirmationCaseStatus = "queued" | "in_confirmation" | "on_hold" | "confirmed_ready_for_execution" | "returned_for_preparation" | "cancelled";
export type SendConfirmationReadinessStatus = "blocked" | "warning" | "ready";

// ── Confirmation Record ──
export interface SendConfirmationRecord {
  id: string;
  dispatchSendPackageId: string;
  recipientConfirmed: boolean;
  attachmentsConfirmed: boolean;
  channelConfirmed: boolean;
  duplicateCheckConfirmed: boolean;
  messageConfirmed: boolean;
  operatorConfirmationNote: string;
  confirmedAt: string;
  confirmedBy: string;
}

// ── State ──
export interface SendConfirmationWorkbenchState {
  caseStatus: SendConfirmationCaseStatus;
  readiness: SendConfirmationReadinessStatus;
  dispatchSendPackageId: string;
  vendorId: string;
  primaryRecipient: string;
  channel: string;
  attachmentCount: number;
  confirmationChecklist: {
    recipientConfirmed: boolean;
    attachmentsConfirmed: boolean;
    channelConfirmed: boolean;
    duplicateCheckConfirmed: boolean;
    messageConfirmed: boolean;
  };
  operatorNote: string;
  duplicateSendRisk: boolean;
  blockerCount: number;
  warningCount: number;
  confirmationRecordId: string | null;
  executionCaseId: string | null;
}

export function createInitialSendConfirmationWorkbenchState(pkg: DispatchSendPackage): SendConfirmationWorkbenchState {
  const readiness = evaluateSendConfirmationReadiness(pkg, { recipientConfirmed: false, attachmentsConfirmed: false, channelConfirmed: false, duplicateCheckConfirmed: false, messageConfirmed: false });
  return {
    caseStatus: "in_confirmation",
    readiness: readiness.status,
    dispatchSendPackageId: pkg.id,
    vendorId: pkg.vendorId,
    primaryRecipient: pkg.primaryRecipient,
    channel: pkg.channel,
    attachmentCount: pkg.attachmentSummary ? 1 : 0,
    confirmationChecklist: { recipientConfirmed: false, attachmentsConfirmed: false, channelConfirmed: false, duplicateCheckConfirmed: false, messageConfirmed: false },
    operatorNote: "",
    duplicateSendRisk: false,
    blockerCount: readiness.blockers.length,
    warningCount: readiness.warnings.length,
    confirmationRecordId: null,
    executionCaseId: null,
  };
}

// ── Readiness ──
export interface SendConfirmationReadinessResult { status: SendConfirmationReadinessStatus; blockers: string[]; warnings: string[]; }

export function evaluateSendConfirmationReadiness(
  pkg: DispatchSendPackage,
  checklist: { recipientConfirmed: boolean; attachmentsConfirmed: boolean; channelConfirmed: boolean; duplicateCheckConfirmed: boolean; messageConfirmed: boolean },
): SendConfirmationReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!pkg.primaryRecipient) blockers.push("수신자 미지정");
  if (!pkg.channel) blockers.push("발송 채널 미선택");
  if (!checklist.recipientConfirmed) blockers.push("수신자 확인 미완료");
  if (!checklist.channelConfirmed) blockers.push("채널 확인 미완료");
  if (!checklist.duplicateCheckConfirmed) blockers.push("중복 전송 확인 미완료");

  if (!checklist.attachmentsConfirmed) warnings.push("첨부 확인 미완료");
  if (!checklist.messageConfirmed) warnings.push("메시지 확인 미완료");
  if (!pkg.supplierMessage) warnings.push("공급사 대상 메시지 없음");

  return { status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready", blockers, warnings };
}

// ── Build Confirmation Record ──
export function buildSendConfirmationRecord(state: SendConfirmationWorkbenchState): SendConfirmationRecord {
  return {
    id: `sendconf_${Date.now().toString(36)}`,
    dispatchSendPackageId: state.dispatchSendPackageId,
    recipientConfirmed: state.confirmationChecklist.recipientConfirmed,
    attachmentsConfirmed: state.confirmationChecklist.attachmentsConfirmed,
    channelConfirmed: state.confirmationChecklist.channelConfirmed,
    duplicateCheckConfirmed: state.confirmationChecklist.duplicateCheckConfirmed,
    messageConfirmed: state.confirmationChecklist.messageConfirmed,
    operatorConfirmationNote: state.operatorNote,
    confirmedAt: new Date().toISOString(),
    confirmedBy: "operator",
  };
}

// ── Canonical Dispatch Execution Case ──
export interface DispatchExecutionCaseV2 {
  id: string;
  sourcePoRecordId: string;
  sourceDispatchPreparationCaseId: string;
  sourceDispatchSendPackageId: string;
  sourceSendConfirmationRecordId: string;
  vendorId: string;
  primaryRecipient: string;
  ccRecipients: string[];
  channel: string;
  subject: string;
  supplierMessage: string;
  attachmentSummary: string;
  duplicateCheckSnapshot: string;
  warningSnapshot: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "executing" | "sent" | "failed" | "cancelled";
  nextDestination: string;
}

export function buildDispatchExecutionCaseV2(pkg: DispatchSendPackage, confirmRecord: SendConfirmationRecord): DispatchExecutionCaseV2 {
  return {
    id: `dispexec_${Date.now().toString(36)}`,
    sourcePoRecordId: pkg.sourcePoRecordId,
    sourceDispatchPreparationCaseId: pkg.sourceDispatchPreparationCaseId,
    sourceDispatchSendPackageId: pkg.id,
    sourceSendConfirmationRecordId: confirmRecord.id,
    vendorId: pkg.vendorId,
    primaryRecipient: pkg.primaryRecipient,
    ccRecipients: pkg.ccRecipients,
    channel: pkg.channel,
    subject: pkg.subject,
    supplierMessage: pkg.supplierMessage,
    attachmentSummary: pkg.attachmentSummary,
    duplicateCheckSnapshot: confirmRecord.duplicateCheckConfirmed ? "확인됨" : "미확인",
    warningSnapshot: pkg.warningSnapshot,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: "dispatch_execution",
  };
}
