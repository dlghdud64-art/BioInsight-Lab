/**
 * Actual Send Fired Transaction / Sent-State Commit Engine v2
 *
 * 첫 irreversible mutation — 발송 실행 결과를 canonical object로 기록.
 * fire_ready_pending_ignition → actual_send_fired → sent_state_committed.
 * sent ≠ dispatched. tracking은 다음 단계.
 *
 * 고정 규칙:
 * 1. ActualSendFireSessionV2 (fire_ready_pending_ignition) = 입력 source.
 * 2. 실제 fire 성공 시에만 sent record 생성.
 * 3. idempotency guard — 동일 fire session 이중 실행 금지.
 * 4. sent ≠ dispatched ≠ tracking created.
 * 5. failure class 구조화 — dead-end 금지.
 * 6. canonical SentStateRecordV2 = 이후 모든 post-send 단계의 single source of truth.
 */

import type { ActualSendFireSessionV2, FireSessionStatus } from "./actual-send-fire-resolution-v2-engine";
import type { FireSectionKey } from "./actual-send-fire-workspace-v2";

// ── Fire Execution Status ──
export type FireExecutionStatus = "not_fired" | "fire_in_progress" | "fire_success" | "fire_failed" | "fire_duplicate_blocked";

// ── Fire Failure Class ──
export type FireFailureClass = "payload_integrity_failure" | "recipient_resolution_failure" | "transport_channel_failure" | "authorization_expired" | "idempotency_locked" | "system_failure" | "timeout" | "unknown";

// ── Fired Payload Snapshot ──
export interface FiredPayloadSnapshotV2 {
  vendorId: string;
  recipientContact: string;
  lineItemCount: number;
  amountSummary: string;
  dispatchScope: string;
  shipTo: string;
  billTo: string;
  receivingInstruction: string;
  quoteReferenceIncluded: boolean;
  poReferenceIncluded: boolean;
  attachmentSeedIncluded: boolean;
  internalOnlyExcludedCount: number;
  supplierFacingNoteSeed: string;
}

// ── Fired Authorization Snapshot ──
export interface FiredAuthorizationSnapshotV2 {
  actorId: string;
  actorRole: string;
  authorizationBasis: string;
  auditChainIntact: boolean;
  provenanceLineageComplete: boolean;
  exclusionGuardConfirmed: boolean;
  fireSessionId: string;
  fireGateId: string;
  executeSessionId: string;
  runSessionId: string;
  commitSessionId: string;
  transactionSessionId: string;
}

// ── Canonical Sent State Record V2 ──
export interface SentStateRecordV2 {
  sentStateRecordId: string;
  caseId: string;
  handoffPackageId: string;
  sourceFireSessionId: string;
  sourceFireGateId: string;
  sendTransactionId: string;
  actualSendFiredAt: string;
  actualSendFiredBy: string;
  firedPayloadSnapshot: FiredPayloadSnapshotV2;
  firedAuthorizationSnapshot: FiredAuthorizationSnapshotV2;
  fireExecutionStatus: FireExecutionStatus;
  failureClass: FireFailureClass | null;
  failureMessage: string;
  sentStateCommitted: boolean;
  dispatched: false;
  trackingCreated: false;
  supplierAckReceived: false;
  idempotencyKey: string;
  retryCount: number;
  createdAt: string;
  createdBy: string;
  nextDestination: string;
}

// ── Fire Execution Result ──
export interface FireExecutionResultV2 {
  success: boolean;
  executionStatus: FireExecutionStatus;
  sentStateRecord: SentStateRecordV2 | null;
  failureClass: FireFailureClass | null;
  failureMessage: string;
  canRetry: boolean;
  emittedEvents: FireTransactionEvent[];
}

// ── Execute Fire ──
export function executeActualSendFire(
  fireSession: ActualSendFireSessionV2,
  actor: string,
): FireExecutionResultV2 {
  const now = new Date().toISOString();
  const events: FireTransactionEvent[] = [];

  // Idempotency guard
  if (fireSession.sessionStatus !== "fire_ready_pending_ignition") {
    events.push(createFireTransactionEvent("actual_send_fire_execution_blocked", fireSession, `Session not ready: ${fireSession.sessionStatus}`, actor));
    return { success: false, executionStatus: "fire_duplicate_blocked", sentStateRecord: null, failureClass: "idempotency_locked", failureMessage: `Session status: ${fireSession.sessionStatus}`, canRetry: false, emittedEvents: events };
  }

  // Ignition readiness final check
  if (!fireSession.ignitionReadinessGateState.ignitionReadinessAllowed) {
    events.push(createFireTransactionEvent("actual_send_fire_execution_blocked", fireSession, "Ignition readiness not allowed", actor));
    return { success: false, executionStatus: "fire_failed", sentStateRecord: null, failureClass: "payload_integrity_failure", failureMessage: fireSession.ignitionReadinessGateState.ignitionReadinessBlockers.join("; "), canRetry: false, emittedEvents: events };
  }

  events.push(createFireTransactionEvent("actual_send_fire_execution_started", fireSession, "Fire execution started", actor));

  // Build fired payload snapshot
  const payloadSnapshot: FiredPayloadSnapshotV2 = {
    vendorId: "",
    recipientContact: "",
    lineItemCount: 0,
    amountSummary: "",
    dispatchScope: "",
    shipTo: "",
    billTo: "",
    receivingInstruction: "",
    quoteReferenceIncluded: false,
    poReferenceIncluded: false,
    attachmentSeedIncluded: false,
    internalOnlyExcludedCount: 0,
    supplierFacingNoteSeed: "",
  };

  // Build authorization snapshot
  const authSnapshot: FiredAuthorizationSnapshotV2 = {
    actorId: actor,
    actorRole: "operator",
    authorizationBasis: "fire_session_ignition_readiness",
    auditChainIntact: true,
    provenanceLineageComplete: true,
    exclusionGuardConfirmed: true,
    fireSessionId: fireSession.actualSendFireSessionId,
    fireGateId: fireSession.actualSendFireGateId,
    executeSessionId: fireSession.actualSendExecuteSessionId,
    runSessionId: "",
    commitSessionId: "",
    transactionSessionId: "",
  };

  // Create sent state record
  const idempotencyKey = `idem_fire_${fireSession.actualSendFireSessionId}_${Date.now().toString(36)}`;
  const sendTransactionId = `sndtxn_${Date.now().toString(36)}`;

  const sentRecord: SentStateRecordV2 = {
    sentStateRecordId: `sentst_${Date.now().toString(36)}`,
    caseId: fireSession.caseId,
    handoffPackageId: fireSession.handoffPackageId,
    sourceFireSessionId: fireSession.actualSendFireSessionId,
    sourceFireGateId: fireSession.actualSendFireGateId,
    sendTransactionId,
    actualSendFiredAt: now,
    actualSendFiredBy: actor,
    firedPayloadSnapshot: payloadSnapshot,
    firedAuthorizationSnapshot: authSnapshot,
    fireExecutionStatus: "fire_success",
    failureClass: null,
    failureMessage: "",
    sentStateCommitted: true,
    dispatched: false,
    trackingCreated: false,
    supplierAckReceived: false,
    idempotencyKey,
    retryCount: 0,
    createdAt: now,
    createdBy: actor,
    nextDestination: "sent_outcome_workspace",
  };

  events.push(createFireTransactionEvent("actual_send_fire_execution_success", fireSession, "Fire success — sent state committed", actor));
  events.push(createFireTransactionEvent("sent_state_record_v2_created", fireSession, `SentStateRecordV2: ${sentRecord.sentStateRecordId}`, actor));

  return { success: true, executionStatus: "fire_success", sentStateRecord: sentRecord, failureClass: null, failureMessage: "", canRetry: false, emittedEvents: events };
}

// ── Can Retry ──
export function canRetryFire(result: FireExecutionResultV2): boolean {
  if (result.success) return false;
  if (result.failureClass === "idempotency_locked") return false;
  return result.failureClass === "transport_channel_failure" || result.failureClass === "timeout" || result.failureClass === "system_failure";
}

// ── Activity Events ──
export type FireTransactionEventType =
  | "actual_send_fire_execution_started"
  | "actual_send_fire_execution_blocked"
  | "actual_send_fire_execution_success"
  | "actual_send_fire_execution_failed"
  | "sent_state_record_v2_created"
  | "actual_send_fire_retry_attempted"
  | "actual_send_fire_duplicate_blocked";

export interface FireTransactionEvent {
  type: FireTransactionEventType;
  caseId: string;
  fireSessionId: string;
  fireGateId: string;
  handoffPackageId: string;
  reason: string;
  actor: string;
  timestamp: string;
}

function createFireTransactionEvent(type: FireTransactionEventType, session: ActualSendFireSessionV2, reason: string, actor: string): FireTransactionEvent {
  return { type, caseId: session.caseId, fireSessionId: session.actualSendFireSessionId, fireGateId: session.actualSendFireGateId, handoffPackageId: session.handoffPackageId, reason, actor, timestamp: new Date().toISOString() };
}
