/**
 * Dispatch Execution Workbench Engine — actual send execution + idempotency + dispatchSendRecord + poRecord.status=sent
 *
 * 고정 규칙:
 * 1. dispatchExecutionCase = 단일 입력 source.
 * 2. confirmed_ready ≠ sent. execution success 이후에만 sent 전이.
 * 3. duplicate send 절대 방지 (idempotency).
 * 4. canonical dispatchSendRecord = sent 이후 단일 truth.
 * 5. 실패 시 retry / return routing. dead-end 금지.
 */

import type { DispatchExecutionCaseV2 } from "./send-confirmation-workbench-engine";

// ── Execution Status ──
export type DispatchExecutionStatus = "not_started" | "blocked" | "running" | "partial_failure" | "success" | "failed";

// ── Failure Class ──
export type SendFailureClass = "recipient_resolution_failed" | "channel_unavailable" | "attachment_resolution_failed" | "duplicate_blocked" | "payload_invalid" | "system_send_failed" | "lineage_broken";

// ── State ──
export interface DispatchExecutionWorkbenchState {
  executionCaseId: string;
  executionStatus: DispatchExecutionStatus;
  caseStatus: "queued" | "executing" | "sent" | "failed" | "cancelled";
  vendorId: string;
  primaryRecipient: string;
  channel: string;
  attachmentCount: number;
  duplicateCheckPassed: boolean;
  payloadChecksum: string;
  failureClass: SendFailureClass | null;
  failureMessage: string;
  retryCount: number;
  sendRecordId: string | null;
  sentAt: string | null;
  blockerCount: number;
  warningCount: number;
}

export function createInitialDispatchExecutionWorkbenchState(execCase: DispatchExecutionCaseV2): DispatchExecutionWorkbenchState {
  const checkpoints = evaluateExecutionCheckpoints(execCase);
  return {
    executionCaseId: execCase.id,
    executionStatus: checkpoints.blockers.length > 0 ? "blocked" : "not_started",
    caseStatus: execCase.status,
    vendorId: execCase.vendorId,
    primaryRecipient: execCase.primaryRecipient,
    channel: execCase.channel,
    attachmentCount: execCase.attachmentSummary ? 1 : 0,
    duplicateCheckPassed: execCase.duplicateCheckSnapshot === "확인됨",
    payloadChecksum: `chk_${Date.now().toString(36)}`,
    failureClass: null,
    failureMessage: "",
    retryCount: 0,
    sendRecordId: null,
    sentAt: null,
    blockerCount: checkpoints.blockers.length,
    warningCount: checkpoints.warnings.length,
  };
}

// ── Execution Checkpoints ──
export interface ExecutionCheckpointResult { blockers: string[]; warnings: string[]; canExecute: boolean; }

export function evaluateExecutionCheckpoints(execCase: DispatchExecutionCaseV2): ExecutionCheckpointResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!execCase.primaryRecipient) blockers.push("수신자 미지정");
  if (!execCase.channel) blockers.push("채널 미선택");
  if (execCase.duplicateCheckSnapshot !== "확인됨") blockers.push("중복 전송 확인 미완료");
  if (!execCase.vendorId) blockers.push("공급사 미지정");
  if (execCase.status !== "queued") blockers.push("Case 상태가 queued가 아님");
  if (!execCase.attachmentSummary) warnings.push("첨부 없음");
  if (!execCase.supplierMessage) warnings.push("공급사 메시지 없음");
  return { blockers, warnings, canExecute: blockers.length === 0 };
}

// ── Canonical Dispatch Send Record ──
export interface DispatchSendRecord {
  id: string;
  sourcePoRecordId: string;
  sourceDispatchPreparationCaseId: string;
  sourceDispatchSendPackageId: string;
  sourceSendConfirmationRecordId: string;
  sourceDispatchExecutionCaseId: string;
  vendorId: string;
  primaryRecipient: string;
  ccRecipients: string[];
  channel: string;
  subject: string;
  supplierMessageSummary: string;
  attachmentSummary: string;
  payloadChecksum: string;
  sentAt: string;
  sentBy: string;
  deliveryProviderRef: string;
  executionLogSummary: string;
  status: "sent" | "delivery_pending" | "delivery_failed" | "cancelled";
}

// ── Execute Send (simulate) ──
export function executeDispatchSend(
  state: DispatchExecutionWorkbenchState,
  execCase: DispatchExecutionCaseV2,
): { success: boolean; state: DispatchExecutionWorkbenchState; sendRecord: DispatchSendRecord | null; failureClass: SendFailureClass | null } {
  // Idempotency: already sent
  if (state.sendRecordId) {
    return { success: false, state: { ...state, executionStatus: "failed", failureClass: "duplicate_blocked", failureMessage: "이미 전송된 건입니다" }, sendRecord: null, failureClass: "duplicate_blocked" };
  }

  // Checkpoint validation
  const checkpoints = evaluateExecutionCheckpoints(execCase);
  if (!checkpoints.canExecute) {
    return { success: false, state: { ...state, caseStatus: "failed", executionStatus: "failed", failureClass: "payload_invalid", failureMessage: checkpoints.blockers[0] }, sendRecord: null, failureClass: "payload_invalid" };
  }

  // Simulate successful send
  const now = new Date().toISOString();
  const sendRecord: DispatchSendRecord = {
    id: `sendrec_${Date.now().toString(36)}`,
    sourcePoRecordId: execCase.sourcePoRecordId,
    sourceDispatchPreparationCaseId: execCase.sourceDispatchPreparationCaseId,
    sourceDispatchSendPackageId: execCase.sourceDispatchSendPackageId,
    sourceSendConfirmationRecordId: execCase.sourceSendConfirmationRecordId,
    sourceDispatchExecutionCaseId: execCase.id,
    vendorId: execCase.vendorId,
    primaryRecipient: execCase.primaryRecipient,
    ccRecipients: execCase.ccRecipients,
    channel: execCase.channel,
    subject: execCase.subject,
    supplierMessageSummary: execCase.supplierMessage,
    attachmentSummary: execCase.attachmentSummary,
    payloadChecksum: state.payloadChecksum,
    sentAt: now,
    sentBy: "operator",
    deliveryProviderRef: `dp_${Date.now().toString(36)}`,
    executionLogSummary: "전송 성공",
    status: "sent",
  };

  return {
    success: true,
    state: { ...state, caseStatus: "sent", executionStatus: "success", sendRecordId: sendRecord.id, sentAt: now, duplicateCheckPassed: true },
    sendRecord,
    failureClass: null,
  };
}

// ── Retry (failed only) ──
export function canRetryExecution(state: DispatchExecutionWorkbenchState): boolean {
  return state.executionStatus === "failed" && !state.sendRecordId;
}

export function prepareRetry(state: DispatchExecutionWorkbenchState): DispatchExecutionWorkbenchState {
  return { ...state, executionStatus: "not_started", caseStatus: "queued", failureClass: null, failureMessage: "", retryCount: state.retryCount + 1 };
}
