/**
 * Dispatch Execution Engine — Outbound Execution State Machine
 *
 * Dispatch Preparation (governance) ≠ Dispatch Execution (this engine).
 * preparation = "can we send?" (blocker-based gating)
 * execution = "we are sending / have sent" (state machine)
 *
 * STATE MACHINE:
 *   draft_dispatch → scheduled → queued_to_send → sending → sent
 *                  → queued_to_send                         → send_failed → retry → sending
 *   any non-terminal → cancelled
 *
 * IMMUTABLE RULES:
 * 1. ready_to_send (preparation readiness) ≠ sent (execution result)
 * 2. 발송 시점에 payload snapshot 고정 — 이후 internal truth 변경이 sent payload를 덮지 않음
 * 3. POCreatedRecord ≠ OutboundExecutionState — 항상 분리
 * 4. send_failed 후에는 resume / retry / cancel 중 하나만 가능 — 자동 재시도 금지
 * 5. cancelled는 terminal — reopen만으로 되돌릴 수 있음
 */

import { getStatusLabel } from "./governance-grammar-registry";

// ══════════════════════════════════════════════
// Execution Status
// ══════════════════════════════════════════════

export type OutboundExecutionStatus =
  | "draft_dispatch"
  | "scheduled"
  | "queued_to_send"
  | "sending"
  | "sent"
  | "send_failed"
  | "cancelled";

/** Terminal states — 이 상태에서는 forward transition 불가 (reopen 제외) */
export const TERMINAL_STATUSES: readonly OutboundExecutionStatus[] = ["sent", "cancelled"] as const;

/** Valid transitions map */
const VALID_TRANSITIONS: Record<OutboundExecutionStatus, OutboundExecutionStatus[]> = {
  draft_dispatch: ["scheduled", "queued_to_send", "cancelled"],
  scheduled: ["queued_to_send", "cancelled"],
  queued_to_send: ["sending", "cancelled"],
  sending: ["sent", "send_failed"],
  sent: [], // terminal
  send_failed: ["queued_to_send", "cancelled"], // retry → queued or cancel
  cancelled: [], // terminal — reopen은 별도 프로세스
};

// ══════════════════════════════════════════════
// Outbound Execution State
// ══════════════════════════════════════════════

export interface OutboundExecutionState {
  executionId: string;
  caseId: string;
  poNumber: string;
  status: OutboundExecutionStatus;
  // Payload snapshot — 발송 시점 고정
  payloadSnapshotId: string | null;
  payloadSnapshotFrozenAt: string | null;
  // Schedule
  scheduledSendAt: string | null;
  // Execution timestamps
  queuedAt: string | null;
  sendingStartedAt: string | null;
  sentAt: string | null;
  // Failure
  failureReason: string | null;
  failureOccurredAt: string | null;
  retryCount: number;
  maxRetries: number;
  // Cancel
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  // Linkage
  dispatchPreparationStateId: string;
  poCreatedObjectId: string;
  approvalDecisionObjectId: string;
  // Audit
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

// ══════════════════════════════════════════════
// Payload Snapshot — 발송 시점 고정본
// ══════════════════════════════════════════════

export interface OutboundPayloadSnapshot {
  snapshotId: string;
  frozenAt: string;
  poNumber: string;
  vendorName: string;
  vendorEmail: string;
  totalAmount: number;
  lineItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  paymentTerms: string;
  deliveryTerms: string;
  shippingAddress: string;
  billingAddress: string;
  attachedDocumentIds: string[];
  internalNote: string;
  supplierNote: string;
}

// ══════════════════════════════════════════════
// Create Initial Execution State
// ══════════════════════════════════════════════

export interface CreateExecutionInput {
  caseId: string;
  poNumber: string;
  dispatchPreparationStateId: string;
  poCreatedObjectId: string;
  approvalDecisionObjectId: string;
  actor: string;
}

export function createInitialExecutionState(input: CreateExecutionInput): OutboundExecutionState {
  const now = new Date().toISOString();
  return {
    executionId: `exec_${Date.now().toString(36)}`,
    caseId: input.caseId,
    poNumber: input.poNumber,
    status: "draft_dispatch",
    payloadSnapshotId: null,
    payloadSnapshotFrozenAt: null,
    scheduledSendAt: null,
    queuedAt: null,
    sendingStartedAt: null,
    sentAt: null,
    failureReason: null,
    failureOccurredAt: null,
    retryCount: 0,
    maxRetries: 3,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    dispatchPreparationStateId: input.dispatchPreparationStateId,
    poCreatedObjectId: input.poCreatedObjectId,
    approvalDecisionObjectId: input.approvalDecisionObjectId,
    createdAt: now,
    updatedAt: now,
    updatedBy: input.actor,
  };
}

// ══════════════════════════════════════════════
// Transition Validation
// ══════════════════════════════════════════════

export interface TransitionResult {
  success: boolean;
  state: OutboundExecutionState;
  error: string | null;
}

function validateTransition(from: OutboundExecutionStatus, to: OutboundExecutionStatus): string | null {
  if (TERMINAL_STATUSES.includes(from)) {
    return `Cannot transition from terminal status '${from}'`;
  }
  if (!VALID_TRANSITIONS[from].includes(to)) {
    return `Invalid transition: ${from} → ${to}. Allowed: ${VALID_TRANSITIONS[from].join(", ") || "none"}`;
  }
  return null;
}

// ══════════════════════════════════════════════
// State Transitions
// ══════════════════════════════════════════════

/** Schedule send — draft_dispatch → scheduled */
export function scheduleSend(
  state: OutboundExecutionState,
  scheduledAt: string,
  actor: string,
): TransitionResult {
  const error = validateTransition(state.status, "scheduled");
  if (error) return { success: false, state, error };

  return {
    success: true,
    state: {
      ...state,
      status: "scheduled",
      scheduledSendAt: scheduledAt,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    },
    error: null,
  };
}

/** Queue to send — draft_dispatch/scheduled/send_failed → queued_to_send */
export function queueToSend(
  state: OutboundExecutionState,
  payloadSnapshot: OutboundPayloadSnapshot,
  actor: string,
): TransitionResult {
  const error = validateTransition(state.status, "queued_to_send");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "queued_to_send",
      payloadSnapshotId: payloadSnapshot.snapshotId,
      payloadSnapshotFrozenAt: payloadSnapshot.frozenAt,
      queuedAt: now,
      retryCount: state.status === "send_failed" ? state.retryCount + 1 : state.retryCount,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

/** Start sending — queued_to_send → sending */
export function startSending(
  state: OutboundExecutionState,
  actor: string,
): TransitionResult {
  const error = validateTransition(state.status, "sending");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "sending",
      sendingStartedAt: now,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

/** Mark as sent — sending → sent (TERMINAL) */
export function markSent(
  state: OutboundExecutionState,
  actor: string,
): TransitionResult {
  const error = validateTransition(state.status, "sent");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "sent",
      sentAt: now,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

/** Mark as failed — sending → send_failed */
export function markSendFailed(
  state: OutboundExecutionState,
  failureReason: string,
  actor: string,
): TransitionResult {
  const error = validateTransition(state.status, "send_failed");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "send_failed",
      failureReason,
      failureOccurredAt: now,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

/** Cancel — any non-terminal → cancelled (TERMINAL) */
export function cancelExecution(
  state: OutboundExecutionState,
  reason: string,
  actor: string,
): TransitionResult {
  const error = validateTransition(state.status, "cancelled");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "cancelled",
      cancelledAt: now,
      cancelledBy: actor,
      cancelReason: reason,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Retry Gate — send_failed 상태에서만 retry 가능
// ══════════════════════════════════════════════

export interface RetryEvaluation {
  canRetry: boolean;
  canCancel: boolean;
  remainingRetries: number;
  blockReason: string | null;
}

export function evaluateRetryEligibility(state: OutboundExecutionState): RetryEvaluation {
  if (state.status !== "send_failed") {
    return { canRetry: false, canCancel: false, remainingRetries: 0, blockReason: `현재 상태 '${state.status}'에서는 재시도 불가` };
  }
  const remaining = state.maxRetries - state.retryCount;
  return {
    canRetry: remaining > 0,
    canCancel: true,
    remainingRetries: remaining,
    blockReason: remaining <= 0 ? `최대 재시도 횟수(${state.maxRetries}회) 초과 — 수동 처리 필요` : null,
  };
}

// ══════════════════════════════════════════════
// Execution Surface — UI 투사
// ══════════════════════════════════════════════

export interface ExecutionSurface {
  status: OutboundExecutionStatus;
  statusLabel: string;
  statusColor: "slate" | "blue" | "amber" | "emerald" | "red";
  isTerminal: boolean;
  primaryMessage: string;
  nextAction: string;
  // Available actions
  canSchedule: boolean;
  canSendNow: boolean;
  canRetry: boolean;
  canCancel: boolean;
  // Timeline
  timeline: Array<{ label: string; timestamp: string | null; status: "completed" | "current" | "pending" | "failed" }>;
}

/** Status labels — grammar registry 직접 소비. 하드코딩 금지. */
function getExecutionStatusLabel(status: OutboundExecutionStatus): string {
  return getStatusLabel("dispatch_execution", status);
}

const STATUS_COLORS: Record<OutboundExecutionStatus, ExecutionSurface["statusColor"]> = {
  draft_dispatch: "slate",
  scheduled: "blue",
  queued_to_send: "amber",
  sending: "amber",
  sent: "emerald",
  send_failed: "red",
  cancelled: "slate",
};

export function buildExecutionSurface(state: OutboundExecutionState): ExecutionSurface {
  const isTerminal = TERMINAL_STATUSES.includes(state.status);
  const retryEval = state.status === "send_failed" ? evaluateRetryEligibility(state) : null;

  const primaryMessage = state.status === "sent"
    ? `PO ${state.poNumber} 발송 완료`
    : state.status === "send_failed"
      ? `발송 실패 — ${state.failureReason || "원인 미상"}`
    : state.status === "cancelled"
      ? `발송 취소 — ${state.cancelReason || "사유 미기재"}`
    : state.status === "sending"
      ? "공급사에게 발송 처리 중…"
    : state.status === "scheduled"
      ? `${state.scheduledSendAt ? new Date(state.scheduledSendAt).toLocaleDateString("ko-KR") : "예정일 미설정"} 발송 예약됨`
    : state.status === "queued_to_send"
      ? "발송 대기열에 추가됨"
    : "발송 초안 — 실행 대기 중";

  const nextAction = state.status === "draft_dispatch"
    ? "발송 실행 또는 예약"
    : state.status === "scheduled"
      ? "예약 시간까지 대기 또는 즉시 발송"
    : state.status === "queued_to_send"
      ? "발송 처리 대기 중"
    : state.status === "sending"
      ? "발송 완료 대기 중"
    : state.status === "send_failed"
      ? retryEval?.canRetry ? "재시도 또는 취소" : "수동 처리 또는 취소"
    : state.status === "sent"
      ? "공급사 확인 대기"
    : "취소됨 — 재시작하려면 Dispatch Prep 재열기";

  // Timeline
  const timeline: ExecutionSurface["timeline"] = [
    { label: "발송 초안", timestamp: state.createdAt, status: state.status === "draft_dispatch" ? "current" : "completed" },
    { label: "예약", timestamp: state.scheduledSendAt, status: state.scheduledSendAt ? (state.status === "scheduled" ? "current" : "completed") : "pending" },
    { label: "대기열", timestamp: state.queuedAt, status: state.queuedAt ? (state.status === "queued_to_send" ? "current" : "completed") : "pending" },
    { label: "발송 중", timestamp: state.sendingStartedAt, status: state.sendingStartedAt ? (state.status === "sending" ? "current" : state.status === "send_failed" ? "failed" : "completed") : "pending" },
    { label: "발송 완료", timestamp: state.sentAt, status: state.sentAt ? "completed" : state.status === "send_failed" ? "failed" : "pending" },
  ];

  return {
    status: state.status,
    statusLabel: getExecutionStatusLabel(state.status),
    statusColor: STATUS_COLORS[state.status],
    isTerminal,
    primaryMessage,
    nextAction,
    canSchedule: state.status === "draft_dispatch",
    canSendNow: state.status === "draft_dispatch" || state.status === "scheduled",
    canRetry: retryEval?.canRetry ?? false,
    canCancel: !isTerminal,
    timeline,
  };
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type ExecutionEventType =
  | "execution_created"
  | "execution_scheduled"
  | "execution_queued"
  | "execution_sending"
  | "execution_sent"
  | "execution_failed"
  | "execution_retried"
  | "execution_cancelled";

export interface ExecutionEvent {
  type: ExecutionEventType;
  executionId: string;
  caseId: string;
  poNumber: string;
  fromStatus: OutboundExecutionStatus;
  toStatus: OutboundExecutionStatus;
  actor: string;
  timestamp: string;
  detail: string;
}

export function buildExecutionEvent(
  type: ExecutionEventType,
  state: OutboundExecutionState,
  fromStatus: OutboundExecutionStatus,
  detail: string,
): ExecutionEvent {
  return {
    type,
    executionId: state.executionId,
    caseId: state.caseId,
    poNumber: state.poNumber,
    fromStatus,
    toStatus: state.status,
    actor: state.updatedBy,
    timestamp: state.updatedAt,
    detail,
  };
}
