/**
 * Stock Release Approval Resolution v2 Engine — approval decision → snapshot consume → release gate unlock
 *
 * ⚠️ WRITE-PATH RESOLUTION:
 * - canonical write scope: StockReleaseApprovalSessionV2.decision, snapshot consumption, release unlock status
 * - single writer: 이 엔진만 stock release approval 결정과 snapshot 소비를 canonical하게 기록
 * - input source trust: StockReleaseApprovalGateV2 (gate preconditions) + ApprovalWorkbenchStateV2 (approval decision)
 * - downstream consumer: stock-release-resolution-v2-engine (complete_release action)
 * - forbidden: snapshot 미검증 release unlock, payload hash 불일치 시 승인, 만료/소비 snapshot 재사용
 *
 * CONSUME GUARD: Same 8-check pattern as fire-approval-resolution
 */

import type { ReleasePayloadHash } from "./stock-release-approval-handoff-gate-v2-engine";
import type { ApprovalSnapshotV2, ApprovalDecisionV2 } from "./dispatch-v2-approval-workbench-engine";
import type { ActorContext, StageActionKey } from "./dispatch-v2-permission-policy-engine";

// ── Session Status ──
export type StockReleaseApprovalSessionStatus =
  | "pending_approval"
  | "approval_in_progress"
  | "approved_pending_consume"
  | "snapshot_consumed_release_unlocked"
  | "rejected"
  | "escalated"
  | "change_requested"
  | "snapshot_invalidated"
  | "expired";

// ── Consume Guard ──
export interface ReleaseSnapshotConsumeGuardResult {
  guardPassed: boolean;
  checks: ReleaseSnapshotConsumeCheck[];
  failedChecks: string[];
  consumeAllowed: boolean;
  consumeBlockedReason: string;
}

export interface ReleaseSnapshotConsumeCheck {
  checkKey: string;
  passed: boolean;
  expected: string;
  actual: string;
  reason: string;
}

// ── Session ──
export interface StockReleaseApprovalSessionV2 {
  sessionId: string;
  caseId: string;
  releaseSessionId: string;
  gateId: string;
  actionKey: StageActionKey;
  sessionStatus: StockReleaseApprovalSessionStatus;
  approvalSnapshotId: string | null;
  decisionRecord: ApprovalDecisionV2 | null;
  consumeGuardResult: ReleaseSnapshotConsumeGuardResult | null;
  payloadHashAtApproval: ReleasePayloadHash | null;
  payloadHashAtConsume: ReleasePayloadHash | null;
  releaseUnlocked: boolean;
  releaseUnlockedAt: string | null;
  releaseUnlockedBy: string | null;
  openedAt: string;
  lastUpdatedAt: string;
  openedBy: string;
  auditEventRefs: string[];
}

// ── Actions ──
export type StockReleaseApprovalAction =
  | "open_approval_session"
  | "submit_approval_decision"
  | "consume_approval_snapshot"
  | "invalidate_snapshot"
  | "request_reapproval";

export interface StockReleaseApprovalActionPayload {
  action: StockReleaseApprovalAction;
  actor: ActorContext;
  decision?: ApprovalDecisionV2;
  snapshot?: ApprovalSnapshotV2;
  payloadHashCurrent?: ReleasePayloadHash;
  invalidationReason?: string;
  timestamp: string;
}

export interface StockReleaseApprovalMutationResult {
  applied: boolean;
  rejectedReason: string | null;
  updatedSession: StockReleaseApprovalSessionV2;
  consumedSnapshot: ApprovalSnapshotV2 | null;
  emittedEvents: StockReleaseApprovalEvent[];
}

// ── Create Initial Session ──
export function createStockReleaseApprovalSession(
  caseId: string,
  releaseSessionId: string,
  gateId: string,
  actor: string,
): StockReleaseApprovalSessionV2 {
  const now = new Date().toISOString();
  return {
    sessionId: `stkrlsappsn_${Date.now().toString(36)}`,
    caseId, releaseSessionId, gateId,
    actionKey: "stock_release_execute",
    sessionStatus: "pending_approval",
    approvalSnapshotId: null, decisionRecord: null,
    consumeGuardResult: null, payloadHashAtApproval: null, payloadHashAtConsume: null,
    releaseUnlocked: false, releaseUnlockedAt: null, releaseUnlockedBy: null,
    openedAt: now, lastUpdatedAt: now, openedBy: actor,
    auditEventRefs: [],
  };
}

// ── Consume Guard (Hardened) ──
export function runReleaseSnapshotConsumeGuard(
  snapshot: ApprovalSnapshotV2,
  targetCaseId: string,
  targetActionKey: StageActionKey,
  payloadHashAtApproval: ReleasePayloadHash,
  payloadHashCurrent: ReleasePayloadHash,
): ReleaseSnapshotConsumeGuardResult {
  const checks: ReleaseSnapshotConsumeCheck[] = [];
  const now = new Date();

  checks.push({ checkKey: "single_use", passed: !snapshot.consumed, expected: "consumed=false", actual: `consumed=${snapshot.consumed}`, reason: snapshot.consumed ? "Snapshot 이미 사용됨" : "" });
  checks.push({ checkKey: "expiry", passed: new Date(snapshot.validUntil) > now, expected: `validUntil > now`, actual: snapshot.validUntil, reason: new Date(snapshot.validUntil) > now ? "" : "Snapshot 만료됨" });
  const actionMatch = snapshot.actionKey === targetActionKey || snapshot.actionKey === "approve_stock_release";
  checks.push({ checkKey: "action_key_match", passed: actionMatch, expected: targetActionKey, actual: snapshot.actionKey, reason: actionMatch ? "" : "Action key 불일치" });
  checks.push({ checkKey: "case_id_match", passed: snapshot.caseId === targetCaseId, expected: targetCaseId, actual: snapshot.caseId, reason: snapshot.caseId === targetCaseId ? "" : "Case ID 불일치" });

  const versionMatch = payloadHashAtApproval.releaseSessionVersion === payloadHashCurrent.releaseSessionVersion;
  checks.push({ checkKey: "release_session_version_match", passed: versionMatch, expected: payloadHashAtApproval.releaseSessionVersion, actual: payloadHashCurrent.releaseSessionVersion, reason: versionMatch ? "" : "Release session version 변경됨" });

  const lineMatch = payloadHashAtApproval.lineItemHash === payloadHashCurrent.lineItemHash;
  checks.push({ checkKey: "line_item_hash_match", passed: lineMatch, expected: payloadHashAtApproval.lineItemHash, actual: payloadHashCurrent.lineItemHash, reason: lineMatch ? "" : "Line item 변경됨" });

  const qtyMatch = payloadHashAtApproval.totalReleasableQtyHash === payloadHashCurrent.totalReleasableQtyHash;
  checks.push({ checkKey: "qty_hash_match", passed: qtyMatch, expected: payloadHashAtApproval.totalReleasableQtyHash, actual: payloadHashCurrent.totalReleasableQtyHash, reason: qtyMatch ? "" : "Releasable 수량 변경됨" });

  const locMatch = payloadHashAtApproval.locationAssignmentHash === payloadHashCurrent.locationAssignmentHash;
  checks.push({ checkKey: "location_assignment_hash_match", passed: locMatch, expected: payloadHashAtApproval.locationAssignmentHash, actual: payloadHashCurrent.locationAssignmentHash, reason: locMatch ? "" : "Location 배정 변경됨" });

  const failedChecks = checks.filter(c => !c.passed).map(c => c.reason);
  return { guardPassed: failedChecks.length === 0, checks, failedChecks, consumeAllowed: failedChecks.length === 0, consumeBlockedReason: failedChecks.join("; ") };
}

// ── Apply Mutation ──
export function applyStockReleaseApprovalMutation(
  session: StockReleaseApprovalSessionV2,
  payload: StockReleaseApprovalActionPayload,
): StockReleaseApprovalMutationResult {
  const now = payload.timestamp;
  const events: StockReleaseApprovalEvent[] = [];
  const makeEvent = (type: StockReleaseApprovalEventType, reason: string): StockReleaseApprovalEvent => ({
    type, caseId: session.caseId, sessionId: session.sessionId,
    releaseSessionId: session.releaseSessionId, gateId: session.gateId,
    actorId: payload.actor.actorId, reason, timestamp: now,
  });
  const reject = (reason: string): StockReleaseApprovalMutationResult => {
    events.push(makeEvent("stock_release_approval_mutation_rejected", reason));
    return { applied: false, rejectedReason: reason, updatedSession: session, consumedSnapshot: null, emittedEvents: events };
  };

  let u = { ...session, lastUpdatedAt: now };

  switch (payload.action) {
    case "open_approval_session": {
      u.sessionStatus = "approval_in_progress";
      events.push(makeEvent("stock_release_approval_session_opened", "Session opened"));
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
        events.push(makeEvent("stock_release_approval_decision_approved", payload.decision.decisionReason));
      } else if (payload.decision.decision === "rejected") {
        u.sessionStatus = "rejected";
        events.push(makeEvent("stock_release_approval_decision_rejected", payload.decision.decisionReason));
      } else if (payload.decision.decision === "escalated") {
        u.sessionStatus = "escalated";
        events.push(makeEvent("stock_release_approval_decision_escalated", payload.decision.decisionReason));
      } else {
        u.sessionStatus = "change_requested";
        events.push(makeEvent("stock_release_approval_change_requested", payload.decision.decisionReason));
      }
      break;
    }

    case "consume_approval_snapshot": {
      if (u.sessionStatus !== "approved_pending_consume")
        return reject(`Snapshot consume 불가 상태: ${u.sessionStatus}`);
      if (!payload.snapshot) return reject("Snapshot 필수");
      if (!payload.payloadHashCurrent) return reject("Current payload hash 필수");

      const approvalHash = u.payloadHashAtApproval || payload.payloadHashCurrent;
      const guardResult = runReleaseSnapshotConsumeGuard(payload.snapshot, session.caseId, session.actionKey, approvalHash, payload.payloadHashCurrent);
      u.consumeGuardResult = guardResult;
      u.payloadHashAtConsume = payload.payloadHashCurrent;

      if (!guardResult.guardPassed) {
        u.sessionStatus = "snapshot_invalidated";
        events.push(makeEvent("stock_release_approval_consume_guard_failed", guardResult.consumeBlockedReason));
        return { applied: true, rejectedReason: null, updatedSession: u, consumedSnapshot: null, emittedEvents: events };
      }

      const consumedSnapshot: ApprovalSnapshotV2 = {
        ...payload.snapshot,
        consumed: true, consumedAt: now,
        consumedByAction: `stock_release:${session.releaseSessionId}`,
      };

      u.releaseUnlocked = true;
      u.releaseUnlockedAt = now;
      u.releaseUnlockedBy = payload.actor.actorId;
      u.sessionStatus = "snapshot_consumed_release_unlocked";
      events.push(makeEvent("stock_release_approval_snapshot_consumed", `Snapshot ${payload.snapshot.snapshotId} consumed — release unlocked`));
      return { applied: true, rejectedReason: null, updatedSession: u, consumedSnapshot, emittedEvents: events };
    }

    case "invalidate_snapshot": {
      u.sessionStatus = "snapshot_invalidated";
      u.releaseUnlocked = false;
      u.releaseUnlockedAt = null;
      u.releaseUnlockedBy = null;
      events.push(makeEvent("stock_release_approval_snapshot_invalidated", payload.invalidationReason || "Manual invalidation"));
      break;
    }

    case "request_reapproval": {
      if (u.sessionStatus !== "snapshot_invalidated" && u.sessionStatus !== "expired" && u.sessionStatus !== "change_requested")
        return reject(`재승인 요청 불가 상태: ${u.sessionStatus}`);
      u.sessionStatus = "pending_approval";
      u.approvalSnapshotId = null; u.decisionRecord = null;
      u.consumeGuardResult = null; u.payloadHashAtApproval = null; u.payloadHashAtConsume = null;
      u.releaseUnlocked = false; u.releaseUnlockedAt = null; u.releaseUnlockedBy = null;
      events.push(makeEvent("stock_release_approval_reapproval_requested", "Reapproval requested"));
      break;
    }

    default:
      return reject(`Unknown action: ${payload.action}`);
  }
  return { applied: true, rejectedReason: null, updatedSession: u, consumedSnapshot: null, emittedEvents: events };
}

// ── Store Payload Hash ──
export function recordReleaseApprovalTimePayloadHash(
  session: StockReleaseApprovalSessionV2,
  payloadHash: ReleasePayloadHash,
): StockReleaseApprovalSessionV2 {
  return { ...session, payloadHashAtApproval: payloadHash };
}

// ── Events ──
export type StockReleaseApprovalEventType =
  | "stock_release_approval_session_opened"
  | "stock_release_approval_decision_approved"
  | "stock_release_approval_decision_rejected"
  | "stock_release_approval_decision_escalated"
  | "stock_release_approval_change_requested"
  | "stock_release_approval_snapshot_consumed"
  | "stock_release_approval_snapshot_invalidated"
  | "stock_release_approval_consume_guard_failed"
  | "stock_release_approval_reapproval_requested"
  | "stock_release_approval_mutation_rejected";

export interface StockReleaseApprovalEvent {
  type: StockReleaseApprovalEventType;
  caseId: string; sessionId: string; releaseSessionId: string; gateId: string;
  actorId: string; reason: string; timestamp: string;
}
