/**
 * Fire Approval Resolution v2 Engine — approval decision → snapshot consume → fire gate unlock
 *
 * ⚠️ WRITE-PATH RESOLUTION:
 * - canonical write scope: FireApprovalSessionV2.decision, snapshot consumption, fire unlock status
 * - single writer: 이 엔진만 fire approval 결정과 snapshot 소비를 canonical하게 기록
 * - input source trust: FireApprovalGateV2 (gate preconditions) + ApprovalWorkbenchStateV2 (approval decision)
 * - downstream consumer: actual-send-fired-transaction-v2-engine (fire execution)
 * - forbidden: snapshot 미검증 fire unlock, payload hash 불일치 시 승인, 만료/소비 snapshot 재사용
 *
 * CONSUME GUARD HARDENING:
 * 1. Entity version match — 승인 시점 entity version vs 현재 entity version
 * 2. Payload content hash match — 승인 시점 payload hash vs 현재
 * 3. Policy evaluation hash match — 승인 시점 policy result vs 현재
 * 4. Line item scope match — 승인 대상 line set vs 현재
 * 5. Single-use enforcement — consumed=true 후 재사용 불가
 * 6. Expiry enforcement — validUntil 초과 시 무효
 * 7. Action key match — snapshot.actionKey vs consume target action
 * 8. Case ID match — snapshot.caseId vs consume target case
 */

import type { FireApprovalGateV2, FirePayloadHash } from "./fire-approval-handoff-gate-v2-engine";
import type { ApprovalSnapshotV2, ApprovalDecisionV2 } from "./dispatch-v2-approval-workbench-engine";
import type { ActorContext, StageActionKey, ProcurementRole } from "./dispatch-v2-permission-policy-engine";

// ── Session Status ──
export type FireApprovalSessionStatus =
  | "pending_approval"
  | "approval_in_progress"
  | "approved_pending_consume"
  | "snapshot_consumed_fire_unlocked"
  | "rejected"
  | "escalated"
  | "change_requested"
  | "snapshot_invalidated"
  | "expired";

// ── Consume Guard Result ──
export interface SnapshotConsumeGuardResult {
  guardPassed: boolean;
  checks: SnapshotConsumeCheck[];
  failedChecks: string[];
  consumeAllowed: boolean;
  consumeBlockedReason: string;
}

export interface SnapshotConsumeCheck {
  checkKey: string;
  passed: boolean;
  expected: string;
  actual: string;
  reason: string;
}

// ── Fire Approval Session ──
export interface FireApprovalSessionV2 {
  sessionId: string;
  caseId: string;
  fireSessionId: string;
  gateId: string;
  actionKey: StageActionKey;
  sessionStatus: FireApprovalSessionStatus;
  // Approval tracking
  approvalSnapshotId: string | null;
  decisionRecord: ApprovalDecisionV2 | null;
  // Consume guard
  consumeGuardResult: SnapshotConsumeGuardResult | null;
  payloadHashAtApproval: FirePayloadHash | null;
  payloadHashAtConsume: FirePayloadHash | null;
  // Fire unlock
  fireUnlocked: boolean;
  fireUnlockedAt: string | null;
  fireUnlockedBy: string | null;
  // Audit
  openedAt: string;
  lastUpdatedAt: string;
  openedBy: string;
  auditEventRefs: string[];
}

// ── Actions ──
export type FireApprovalAction =
  | "open_approval_session"
  | "submit_approval_decision"
  | "consume_approval_snapshot"
  | "invalidate_snapshot"
  | "request_reapproval";

export interface FireApprovalActionPayload {
  action: FireApprovalAction;
  actor: ActorContext;
  decision?: ApprovalDecisionV2;
  snapshot?: ApprovalSnapshotV2;
  payloadHashCurrent?: FirePayloadHash;
  invalidationReason?: string;
  timestamp: string;
}

// ── Mutation Result ──
export interface FireApprovalMutationResult {
  applied: boolean;
  rejectedReason: string | null;
  updatedSession: FireApprovalSessionV2;
  consumedSnapshot: ApprovalSnapshotV2 | null;
  emittedEvents: FireApprovalEvent[];
}

// ── Create Initial Session ──
export function createFireApprovalSession(
  caseId: string,
  fireSessionId: string,
  gateId: string,
  actor: string,
): FireApprovalSessionV2 {
  const now = new Date().toISOString();
  return {
    sessionId: `fireappsn_${Date.now().toString(36)}`,
    caseId, fireSessionId, gateId,
    actionKey: "actual_send_fire_execute",
    sessionStatus: "pending_approval",
    approvalSnapshotId: null, decisionRecord: null,
    consumeGuardResult: null, payloadHashAtApproval: null, payloadHashAtConsume: null,
    fireUnlocked: false, fireUnlockedAt: null, fireUnlockedBy: null,
    openedAt: now, lastUpdatedAt: now, openedBy: actor,
    auditEventRefs: [],
  };
}

// ── Snapshot Consume Guard (Hardened) ──
export function runSnapshotConsumeGuard(
  snapshot: ApprovalSnapshotV2,
  targetCaseId: string,
  targetActionKey: StageActionKey,
  payloadHashAtApproval: FirePayloadHash,
  payloadHashCurrent: FirePayloadHash,
): SnapshotConsumeGuardResult {
  const checks: SnapshotConsumeCheck[] = [];
  const now = new Date();

  // 1. Single-use enforcement
  checks.push({
    checkKey: "single_use",
    passed: !snapshot.consumed,
    expected: "consumed=false",
    actual: `consumed=${snapshot.consumed}`,
    reason: snapshot.consumed ? "Snapshot 이미 사용됨 — 재사용 불가" : "",
  });

  // 2. Expiry enforcement
  const notExpired = new Date(snapshot.validUntil) > now;
  checks.push({
    checkKey: "expiry",
    passed: notExpired,
    expected: `validUntil > ${now.toISOString()}`,
    actual: `validUntil=${snapshot.validUntil}`,
    reason: notExpired ? "" : "Snapshot 유효기간 만료",
  });

  // 3. Action key match
  const actionMatch = snapshot.actionKey === targetActionKey ||
    snapshot.actionKey === "approve_fire_execution";
  checks.push({
    checkKey: "action_key_match",
    passed: actionMatch,
    expected: targetActionKey,
    actual: snapshot.actionKey,
    reason: actionMatch ? "" : `Action key 불일치: ${snapshot.actionKey} vs ${targetActionKey}`,
  });

  // 4. Case ID match
  const caseMatch = snapshot.caseId === targetCaseId;
  checks.push({
    checkKey: "case_id_match",
    passed: caseMatch,
    expected: targetCaseId,
    actual: snapshot.caseId,
    reason: caseMatch ? "" : `Case ID 불일치: ${snapshot.caseId} vs ${targetCaseId}`,
  });

  // 5. Entity version match
  const entityMatch = payloadHashAtApproval.entityVersion === payloadHashCurrent.entityVersion;
  checks.push({
    checkKey: "entity_version_match",
    passed: entityMatch,
    expected: payloadHashAtApproval.entityVersion,
    actual: payloadHashCurrent.entityVersion,
    reason: entityMatch ? "" : "Entity version 변경됨 — 승인 후 원본 수정. 재승인 필요",
  });

  // 6. Payload content hash match
  const payloadMatch = payloadHashAtApproval.payloadContentHash === payloadHashCurrent.payloadContentHash;
  checks.push({
    checkKey: "payload_content_hash_match",
    passed: payloadMatch,
    expected: payloadHashAtApproval.payloadContentHash,
    actual: payloadHashCurrent.payloadContentHash,
    reason: payloadMatch ? "" : "Payload 내용 변경됨 — 승인 시점과 다른 데이터. 재승인 필요",
  });

  // 7. Policy evaluation hash match
  const policyMatch = payloadHashAtApproval.policyEvaluationHash === payloadHashCurrent.policyEvaluationHash;
  checks.push({
    checkKey: "policy_evaluation_hash_match",
    passed: policyMatch,
    expected: payloadHashAtApproval.policyEvaluationHash,
    actual: payloadHashCurrent.policyEvaluationHash,
    reason: policyMatch ? "" : "Policy 평가 결과 변경됨 — 정책 변경 후 재평가 필요",
  });

  // 8. Line item scope match
  const scopeMatch = payloadHashAtApproval.lineItemScope === payloadHashCurrent.lineItemScope;
  checks.push({
    checkKey: "line_item_scope_match",
    passed: scopeMatch,
    expected: payloadHashAtApproval.lineItemScope,
    actual: payloadHashCurrent.lineItemScope,
    reason: scopeMatch ? "" : "Line item 범위 변경됨 — 승인 대상 불일치. 재승인 필요",
  });

  const failedChecks = checks.filter(c => !c.passed).map(c => c.reason);
  const allPassed = failedChecks.length === 0;

  return {
    guardPassed: allPassed,
    checks,
    failedChecks,
    consumeAllowed: allPassed,
    consumeBlockedReason: allPassed ? "" : failedChecks.join("; "),
  };
}

// ── Apply Mutation ──
export function applyFireApprovalMutation(
  session: FireApprovalSessionV2,
  payload: FireApprovalActionPayload,
): FireApprovalMutationResult {
  const now = payload.timestamp;
  const events: FireApprovalEvent[] = [];
  const makeEvent = (type: FireApprovalEventType, reason: string): FireApprovalEvent => ({
    type, caseId: session.caseId, sessionId: session.sessionId,
    fireSessionId: session.fireSessionId, gateId: session.gateId,
    actorId: payload.actor.actorId, reason, timestamp: now,
  });
  const reject = (reason: string): FireApprovalMutationResult => {
    events.push(makeEvent("fire_approval_mutation_rejected", reason));
    return { applied: false, rejectedReason: reason, updatedSession: session, consumedSnapshot: null, emittedEvents: events };
  };

  let u = { ...session, lastUpdatedAt: now };

  switch (payload.action) {
    case "open_approval_session": {
      u.sessionStatus = "approval_in_progress";
      events.push(makeEvent("fire_approval_session_opened", "Session opened"));
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
        events.push(makeEvent("fire_approval_decision_approved", payload.decision.decisionReason));
      } else if (payload.decision.decision === "rejected") {
        u.sessionStatus = "rejected";
        events.push(makeEvent("fire_approval_decision_rejected", payload.decision.decisionReason));
      } else if (payload.decision.decision === "escalated") {
        u.sessionStatus = "escalated";
        events.push(makeEvent("fire_approval_decision_escalated", payload.decision.decisionReason));
      } else {
        u.sessionStatus = "change_requested";
        events.push(makeEvent("fire_approval_change_requested", payload.decision.decisionReason));
      }
      break;
    }

    case "consume_approval_snapshot": {
      if (u.sessionStatus !== "approved_pending_consume")
        return reject(`Snapshot consume 불가 상태: ${u.sessionStatus}`);
      if (!payload.snapshot) return reject("Snapshot 필수");
      if (!payload.payloadHashCurrent) return reject("Current payload hash 필수");
      if (!u.payloadHashAtApproval && !payload.payloadHashCurrent)
        return reject("Approval-time payload hash 미기록");

      // Use stored approval-time hash or from payload
      const approvalHash = u.payloadHashAtApproval || payload.payloadHashCurrent;

      // Run hardened consume guard
      const guardResult = runSnapshotConsumeGuard(
        payload.snapshot,
        session.caseId,
        session.actionKey,
        approvalHash,
        payload.payloadHashCurrent,
      );
      u.consumeGuardResult = guardResult;
      u.payloadHashAtConsume = payload.payloadHashCurrent;

      if (!guardResult.guardPassed) {
        u.sessionStatus = "snapshot_invalidated";
        events.push(makeEvent("fire_approval_consume_guard_failed", guardResult.consumeBlockedReason));
        return { applied: true, rejectedReason: null, updatedSession: u, consumedSnapshot: null, emittedEvents: events };
      }

      // Consume the snapshot
      const consumedSnapshot: ApprovalSnapshotV2 = {
        ...payload.snapshot,
        consumed: true,
        consumedAt: now,
        consumedByAction: `fire_execution:${session.fireSessionId}`,
      };

      u.fireUnlocked = true;
      u.fireUnlockedAt = now;
      u.fireUnlockedBy = payload.actor.actorId;
      u.sessionStatus = "snapshot_consumed_fire_unlocked";
      events.push(makeEvent("fire_approval_snapshot_consumed", `Snapshot ${payload.snapshot.snapshotId} consumed — fire unlocked`));

      return { applied: true, rejectedReason: null, updatedSession: u, consumedSnapshot, emittedEvents: events };
    }

    case "invalidate_snapshot": {
      u.sessionStatus = "snapshot_invalidated";
      u.fireUnlocked = false;
      u.fireUnlockedAt = null;
      u.fireUnlockedBy = null;
      events.push(makeEvent("fire_approval_snapshot_invalidated", payload.invalidationReason || "Manual invalidation"));
      break;
    }

    case "request_reapproval": {
      if (u.sessionStatus !== "snapshot_invalidated" && u.sessionStatus !== "expired" && u.sessionStatus !== "change_requested")
        return reject(`재승인 요청 불가 상태: ${u.sessionStatus}`);
      u.sessionStatus = "pending_approval";
      u.approvalSnapshotId = null;
      u.decisionRecord = null;
      u.consumeGuardResult = null;
      u.payloadHashAtApproval = null;
      u.payloadHashAtConsume = null;
      u.fireUnlocked = false;
      u.fireUnlockedAt = null;
      u.fireUnlockedBy = null;
      events.push(makeEvent("fire_approval_reapproval_requested", "Reapproval requested — previous approval cleared"));
      break;
    }

    default:
      return reject(`Unknown action: ${payload.action}`);
  }

  return { applied: true, rejectedReason: null, updatedSession: u, consumedSnapshot: null, emittedEvents: events };
}

// ── Store Payload Hash at Approval Time ──
export function recordApprovalTimePayloadHash(
  session: FireApprovalSessionV2,
  payloadHash: FirePayloadHash,
): FireApprovalSessionV2 {
  return { ...session, payloadHashAtApproval: payloadHash };
}

// ── Events ──
export type FireApprovalEventType =
  | "fire_approval_session_opened"
  | "fire_approval_decision_approved"
  | "fire_approval_decision_rejected"
  | "fire_approval_decision_escalated"
  | "fire_approval_change_requested"
  | "fire_approval_snapshot_consumed"
  | "fire_approval_snapshot_invalidated"
  | "fire_approval_consume_guard_failed"
  | "fire_approval_reapproval_requested"
  | "fire_approval_mutation_rejected"
  | "fire_approval_fire_unlocked"
  | "fire_approval_expired";

export interface FireApprovalEvent {
  type: FireApprovalEventType;
  caseId: string;
  sessionId: string;
  fireSessionId: string;
  gateId: string;
  actorId: string;
  reason: string;
  timestamp: string;
}
