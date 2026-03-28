/**
 * Exception Recovery Approval Resolution v2 Engine
 *
 * ⚠️ WRITE-PATH RESOLUTION:
 * - canonical write scope: ExceptionApprovalSessionV2.decision, snapshot consumption, recovery unlock
 * - single writer: 이 엔진만 exception approval 결정과 snapshot 소비를 canonical하게 기록
 * - input source trust: ExceptionApprovalGateV2 + ApprovalWorkbenchStateV2
 * - downstream consumer: dispatch-exception-recovery-v2-engine (resolve/return action)
 * - forbidden: snapshot 미검증 recovery unlock, ALLOWED_RETURN_TARGETS 우회
 *
 * CONSUME GUARD: 공용 approval-snapshot-validator.ts 사용
 */

import type { ExceptionPayloadHash, toApprovalPayloadHash as _toApprovalPayloadHash } from "./exception-approval-handoff-gate-v2-engine";
import type { ApprovalSnapshotV2, ApprovalDecisionV2 } from "./dispatch-v2-approval-workbench-engine";
import type { ActorContext, StageActionKey } from "./dispatch-v2-permission-policy-engine";
import { runConsumeGuard, consumeSnapshot, type ApprovalPayloadHash, type ConsumeGuardResult } from "./approval-snapshot-validator";

// ── Session Status ──
export type ExceptionApprovalSessionStatus =
  | "pending_approval"
  | "approval_in_progress"
  | "approved_pending_consume"
  | "snapshot_consumed_recovery_unlocked"
  | "rejected"
  | "escalated"
  | "change_requested"
  | "snapshot_invalidated"
  | "expired";

// ── Session ──
export interface ExceptionApprovalSessionV2 {
  sessionId: string;
  caseId: string;
  exceptionRecordId: string;
  gateId: string;
  actionKey: StageActionKey;
  targetAction: "exception_resolve" | "exception_return_to_stage";
  sessionStatus: ExceptionApprovalSessionStatus;
  approvalSnapshotId: string | null;
  decisionRecord: ApprovalDecisionV2 | null;
  consumeGuardResult: ConsumeGuardResult | null;
  payloadHashAtApproval: ExceptionPayloadHash | null;
  payloadHashAtConsume: ExceptionPayloadHash | null;
  recoveryUnlocked: boolean;
  recoveryUnlockedAt: string | null;
  recoveryUnlockedBy: string | null;
  openedAt: string;
  lastUpdatedAt: string;
  openedBy: string;
  auditEventRefs: string[];
}

// ── Actions ──
export type ExceptionApprovalAction =
  | "open_approval_session"
  | "submit_approval_decision"
  | "consume_approval_snapshot"
  | "invalidate_snapshot"
  | "request_reapproval";

export interface ExceptionApprovalActionPayload {
  action: ExceptionApprovalAction;
  actor: ActorContext;
  decision?: ApprovalDecisionV2;
  snapshot?: ApprovalSnapshotV2;
  payloadHashCurrent?: ExceptionPayloadHash;
  invalidationReason?: string;
  timestamp: string;
}

export interface ExceptionApprovalMutationResult {
  applied: boolean;
  rejectedReason: string | null;
  updatedSession: ExceptionApprovalSessionV2;
  consumedSnapshot: ApprovalSnapshotV2 | null;
  emittedEvents: ExceptionApprovalEvent[];
}

// ── Adapter ──
function toApprovalHash(h: ExceptionPayloadHash): ApprovalPayloadHash {
  return { entityVersion: h.exceptionVersion, contentHash: h.affectedLineHash, policyHash: h.recoveryActionHash, scopeHash: h.returnTargetHash };
}

// ── Create Initial Session ──
export function createExceptionApprovalSession(
  caseId: string,
  exceptionRecordId: string,
  gateId: string,
  targetAction: "exception_resolve" | "exception_return_to_stage",
  actor: string,
): ExceptionApprovalSessionV2 {
  const now = new Date().toISOString();
  const actionKey: StageActionKey = targetAction === "exception_resolve" ? "exception_resolve" : "exception_return_to_stage";
  return {
    sessionId: `excappsn_${Date.now().toString(36)}`,
    caseId, exceptionRecordId, gateId,
    actionKey, targetAction,
    sessionStatus: "pending_approval",
    approvalSnapshotId: null, decisionRecord: null,
    consumeGuardResult: null, payloadHashAtApproval: null, payloadHashAtConsume: null,
    recoveryUnlocked: false, recoveryUnlockedAt: null, recoveryUnlockedBy: null,
    openedAt: now, lastUpdatedAt: now, openedBy: actor,
    auditEventRefs: [],
  };
}

// ── Apply Mutation ──
export function applyExceptionApprovalMutation(
  session: ExceptionApprovalSessionV2,
  payload: ExceptionApprovalActionPayload,
): ExceptionApprovalMutationResult {
  const now = payload.timestamp;
  const events: ExceptionApprovalEvent[] = [];
  const makeEvent = (type: ExceptionApprovalEventType, reason: string): ExceptionApprovalEvent => ({
    type, caseId: session.caseId, sessionId: session.sessionId,
    exceptionRecordId: session.exceptionRecordId, gateId: session.gateId,
    targetAction: session.targetAction,
    actorId: payload.actor.actorId, reason, timestamp: now,
  });
  const reject = (reason: string): ExceptionApprovalMutationResult => {
    events.push(makeEvent("exception_approval_mutation_rejected", reason));
    return { applied: false, rejectedReason: reason, updatedSession: session, consumedSnapshot: null, emittedEvents: events };
  };

  let u = { ...session, lastUpdatedAt: now };

  switch (payload.action) {
    case "open_approval_session": {
      u.sessionStatus = "approval_in_progress";
      events.push(makeEvent("exception_approval_session_opened", "Session opened"));
      break;
    }

    case "submit_approval_decision": {
      if (!payload.decision) return reject("Decision 필수");
      if (u.sessionStatus !== "approval_in_progress" && u.sessionStatus !== "pending_approval")
        return reject(`승인 결정 불가 상태: ${u.sessionStatus}`);

      u.decisionRecord = payload.decision;
      if (payload.decision.decision === "approved") {
        u.sessionStatus = "approved_pending_consume";
        u.approvalSnapshotId = payload.decision.approvalSnapshotId;
        events.push(makeEvent("exception_approval_decision_approved", payload.decision.decisionReason));
      } else if (payload.decision.decision === "rejected") {
        u.sessionStatus = "rejected";
        events.push(makeEvent("exception_approval_decision_rejected", payload.decision.decisionReason));
      } else if (payload.decision.decision === "escalated") {
        u.sessionStatus = "escalated";
        events.push(makeEvent("exception_approval_decision_escalated", payload.decision.decisionReason));
      } else {
        u.sessionStatus = "change_requested";
        events.push(makeEvent("exception_approval_change_requested", payload.decision.decisionReason));
      }
      break;
    }

    case "consume_approval_snapshot": {
      if (u.sessionStatus !== "approved_pending_consume")
        return reject(`Snapshot consume 불가 상태: ${u.sessionStatus}`);
      if (!payload.snapshot) return reject("Snapshot 필수");
      if (!payload.payloadHashCurrent) return reject("Current payload hash 필수");

      const approvalHash = u.payloadHashAtApproval || payload.payloadHashCurrent;

      // Use shared consume guard
      const guardResult = runConsumeGuard(
        payload.snapshot,
        session.caseId,
        session.actionKey,
        toApprovalHash(approvalHash),
        toApprovalHash(payload.payloadHashCurrent),
      );
      u.consumeGuardResult = guardResult;
      u.payloadHashAtConsume = payload.payloadHashCurrent;

      if (!guardResult.guardPassed) {
        u.sessionStatus = "snapshot_invalidated";
        events.push(makeEvent("exception_approval_consume_guard_failed", guardResult.consumeBlockedReason));
        return { applied: true, rejectedReason: null, updatedSession: u, consumedSnapshot: null, emittedEvents: events };
      }

      // Consume via shared utility
      const consumed = consumeSnapshot(payload.snapshot, `${session.targetAction}:${session.exceptionRecordId}`);

      u.recoveryUnlocked = true;
      u.recoveryUnlockedAt = now;
      u.recoveryUnlockedBy = payload.actor.actorId;
      u.sessionStatus = "snapshot_consumed_recovery_unlocked";
      events.push(makeEvent("exception_approval_snapshot_consumed", `Snapshot ${payload.snapshot.snapshotId} consumed — recovery unlocked`));
      return { applied: true, rejectedReason: null, updatedSession: u, consumedSnapshot: consumed, emittedEvents: events };
    }

    case "invalidate_snapshot": {
      u.sessionStatus = "snapshot_invalidated";
      u.recoveryUnlocked = false;
      u.recoveryUnlockedAt = null;
      u.recoveryUnlockedBy = null;
      events.push(makeEvent("exception_approval_snapshot_invalidated", payload.invalidationReason || "Manual invalidation"));
      break;
    }

    case "request_reapproval": {
      if (u.sessionStatus !== "snapshot_invalidated" && u.sessionStatus !== "expired" && u.sessionStatus !== "change_requested")
        return reject(`재승인 요청 불가 상태: ${u.sessionStatus}`);
      u.sessionStatus = "pending_approval";
      u.approvalSnapshotId = null; u.decisionRecord = null;
      u.consumeGuardResult = null; u.payloadHashAtApproval = null; u.payloadHashAtConsume = null;
      u.recoveryUnlocked = false; u.recoveryUnlockedAt = null; u.recoveryUnlockedBy = null;
      events.push(makeEvent("exception_approval_reapproval_requested", "Reapproval requested"));
      break;
    }

    default:
      return reject(`Unknown action: ${payload.action}`);
  }
  return { applied: true, rejectedReason: null, updatedSession: u, consumedSnapshot: null, emittedEvents: events };
}

// ── Store Payload Hash ──
export function recordExceptionApprovalTimePayloadHash(
  session: ExceptionApprovalSessionV2,
  payloadHash: ExceptionPayloadHash,
): ExceptionApprovalSessionV2 {
  return { ...session, payloadHashAtApproval: payloadHash };
}

// ── Events ──
export type ExceptionApprovalEventType =
  | "exception_approval_session_opened"
  | "exception_approval_decision_approved"
  | "exception_approval_decision_rejected"
  | "exception_approval_decision_escalated"
  | "exception_approval_change_requested"
  | "exception_approval_snapshot_consumed"
  | "exception_approval_snapshot_invalidated"
  | "exception_approval_consume_guard_failed"
  | "exception_approval_reapproval_requested"
  | "exception_approval_mutation_rejected";

export interface ExceptionApprovalEvent {
  type: ExceptionApprovalEventType;
  caseId: string; sessionId: string; exceptionRecordId: string; gateId: string;
  targetAction: "exception_resolve" | "exception_return_to_stage";
  actorId: string; reason: string; timestamp: string;
}
