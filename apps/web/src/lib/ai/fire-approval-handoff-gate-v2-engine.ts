/**
 * Fire Approval Handoff Gate v2 Engine
 *
 * fire_ready_pending_ignition → approval gate → fire execution
 *
 * GATE CONTRACT:
 * - input: ActualSendFireSessionV2 (fire_ready_pending_ignition) + PermissionCheckResult
 * - output: FireApprovalGateV2 (gate status + precondition results)
 * - fire execution은 valid unconsumed ApprovalSnapshotV2 없이 절대 진행 불가
 *
 * 10 preconditions:
 * 1. fire_session_ready — fire session이 fire_ready_pending_ignition 상태
 * 2. ignition_readiness_confirmed — ignition gate가 allowed
 * 3. permission_check_completed — checkPermission 결과 존재
 * 4. approval_required_verified — requires_approval이면 approval 필수
 * 5. approval_snapshot_exists — snapshot 존재 (approval required인 경우)
 * 6. approval_snapshot_not_consumed — snapshot 미사용
 * 7. approval_snapshot_not_expired — snapshot 유효기간 내
 * 8. approval_snapshot_action_match — snapshot의 actionKey 일치
 * 9. approval_snapshot_case_match — snapshot의 caseId 일치
 * 10. payload_hash_integrity — approval 시점 payload hash와 현재 일치
 */

import type { ActualSendFireSessionV2 } from "./actual-send-fire-resolution-v2-engine";
import type { PermissionCheckResult, StageActionKey, ActorContext } from "./dispatch-v2-permission-policy-engine";
import type { ApprovalSnapshotV2 } from "./dispatch-v2-approval-workbench-engine";

// ── Gate Status ──
export type FireApprovalGateStatus =
  | "not_eligible"
  | "approval_not_required"
  | "approval_required_pending"
  | "approval_granted_ready"
  | "approval_blocked"
  | "approval_snapshot_invalid";

// ── Precondition Keys ──
export type FireApprovalPreconditionKey =
  | "fire_session_ready"
  | "ignition_readiness_confirmed"
  | "permission_check_completed"
  | "approval_required_verified"
  | "approval_snapshot_exists"
  | "approval_snapshot_not_consumed"
  | "approval_snapshot_not_expired"
  | "approval_snapshot_action_match"
  | "approval_snapshot_case_match"
  | "payload_hash_integrity";

export type FireApprovalBlockingLevel = "hard_blocker" | "soft_blocker" | "warning";

export interface FireApprovalPreconditionResult {
  key: FireApprovalPreconditionKey;
  passed: boolean;
  blockingLevel: FireApprovalBlockingLevel;
  reason: string;
}

// ── Payload Hash ──
export interface FirePayloadHash {
  entityVersion: string;
  payloadContentHash: string;
  policyEvaluationHash: string;
  lineItemScope: string;
}

// ── Gate Object ──
export interface FireApprovalGateV2 {
  gateId: string;
  caseId: string;
  fireSessionId: string;
  actionKey: StageActionKey;
  gateStatus: FireApprovalGateStatus;
  preconditionResults: FireApprovalPreconditionResult[];
  hardBlockerCount: number;
  softBlockerCount: number;
  warningCount: number;
  approvalRequired: boolean;
  approvalSnapshotId: string | null;
  approvalSnapshotValid: boolean;
  payloadHashAtApproval: FirePayloadHash | null;
  payloadHashCurrent: FirePayloadHash | null;
  payloadHashMatch: boolean;
  canProceedToFire: boolean;
  gateReason: string;
  evaluatedAt: string;
  evaluatedBy: string;
}

// ── Build Gate ──
export function buildFireApprovalGateV2(
  fireSession: ActualSendFireSessionV2,
  permissionResult: PermissionCheckResult,
  reviewer: ActorContext,
  snapshot: ApprovalSnapshotV2 | null,
  payloadHashAtApproval: FirePayloadHash | null,
  payloadHashCurrent: FirePayloadHash,
): FireApprovalGateV2 {
  const preconditions: FireApprovalPreconditionResult[] = [];
  const now = new Date();

  // 1. fire_session_ready
  preconditions.push({
    key: "fire_session_ready",
    passed: fireSession.sessionStatus === "fire_ready_pending_ignition",
    blockingLevel: "hard_blocker",
    reason: fireSession.sessionStatus === "fire_ready_pending_ignition" ? "" : `Fire session not ready: ${fireSession.sessionStatus}`,
  });

  // 2. ignition_readiness_confirmed
  preconditions.push({
    key: "ignition_readiness_confirmed",
    passed: fireSession.ignitionReadinessGateState.ignitionReadinessAllowed,
    blockingLevel: "hard_blocker",
    reason: fireSession.ignitionReadinessGateState.ignitionReadinessAllowed ? "" : "Ignition readiness not allowed",
  });

  // 3. permission_check_completed
  preconditions.push({
    key: "permission_check_completed",
    passed: true, // permissionResult exists by definition
    blockingLevel: "hard_blocker",
    reason: "",
  });

  // 4. approval_required_verified
  const approvalRequired = permissionResult.requiresApproval;
  preconditions.push({
    key: "approval_required_verified",
    passed: true, // always passes — this is informational
    blockingLevel: "warning",
    reason: approvalRequired ? "Approval required for this action" : "No approval required",
  });

  // Snapshot checks (only relevant if approval required)
  let snapshotValid = false;
  if (approvalRequired) {
    // 5. snapshot exists
    const snapshotExists = snapshot !== null;
    preconditions.push({
      key: "approval_snapshot_exists",
      passed: snapshotExists,
      blockingLevel: "hard_blocker",
      reason: snapshotExists ? "" : "Approval snapshot 없음 — 승인 필요",
    });

    // 6. not consumed
    const notConsumed = snapshot ? !snapshot.consumed : false;
    preconditions.push({
      key: "approval_snapshot_not_consumed",
      passed: notConsumed,
      blockingLevel: "hard_blocker",
      reason: notConsumed ? "" : "Approval snapshot 이미 사용됨",
    });

    // 7. not expired
    const notExpired = snapshot ? new Date(snapshot.validUntil) > now : false;
    preconditions.push({
      key: "approval_snapshot_not_expired",
      passed: notExpired,
      blockingLevel: "hard_blocker",
      reason: notExpired ? "" : "Approval snapshot 만료됨",
    });

    // 8. action match
    const actionMatch = snapshot ? snapshot.actionKey === "actual_send_fire_execute" || snapshot.actionKey === "approve_fire_execution" : false;
    preconditions.push({
      key: "approval_snapshot_action_match",
      passed: actionMatch,
      blockingLevel: "hard_blocker",
      reason: actionMatch ? "" : `Action key 불일치: expected actual_send_fire_execute, got ${snapshot?.actionKey || "none"}`,
    });

    // 9. case match
    const caseMatch = snapshot ? snapshot.caseId === fireSession.caseId : false;
    preconditions.push({
      key: "approval_snapshot_case_match",
      passed: caseMatch,
      blockingLevel: "hard_blocker",
      reason: caseMatch ? "" : `Case ID 불일치: ${fireSession.caseId} vs ${snapshot?.caseId || "none"}`,
    });

    // 10. payload hash integrity
    const hashMatch = payloadHashAtApproval !== null &&
      payloadHashAtApproval.entityVersion === payloadHashCurrent.entityVersion &&
      payloadHashAtApproval.payloadContentHash === payloadHashCurrent.payloadContentHash &&
      payloadHashAtApproval.policyEvaluationHash === payloadHashCurrent.policyEvaluationHash &&
      payloadHashAtApproval.lineItemScope === payloadHashCurrent.lineItemScope;
    preconditions.push({
      key: "payload_hash_integrity",
      passed: hashMatch,
      blockingLevel: "hard_blocker",
      reason: hashMatch ? "" : "Payload hash 불일치 — 승인 이후 원본 변경됨. 재승인 필요",
    });

    snapshotValid = snapshotExists && notConsumed && notExpired && actionMatch && caseMatch && hashMatch;
  } else {
    // No approval required — skip snapshot checks but still pass them
    ["approval_snapshot_exists", "approval_snapshot_not_consumed", "approval_snapshot_not_expired", "approval_snapshot_action_match", "approval_snapshot_case_match", "payload_hash_integrity"].forEach(key => {
      preconditions.push({ key: key as FireApprovalPreconditionKey, passed: true, blockingLevel: "warning", reason: "Approval not required — skipped" });
    });
    snapshotValid = true;
  }

  const hardBlockers = preconditions.filter(p => !p.passed && p.blockingLevel === "hard_blocker");
  const softBlockers = preconditions.filter(p => !p.passed && p.blockingLevel === "soft_blocker");
  const warnings = preconditions.filter(p => !p.passed && p.blockingLevel === "warning");

  const canProceed = hardBlockers.length === 0 && softBlockers.length === 0;

  let gateStatus: FireApprovalGateStatus;
  if (!preconditions[0].passed || !preconditions[1].passed) {
    gateStatus = "not_eligible";
  } else if (!approvalRequired) {
    gateStatus = "approval_not_required";
  } else if (!snapshot) {
    gateStatus = "approval_required_pending";
  } else if (!snapshotValid) {
    gateStatus = "approval_snapshot_invalid";
  } else if (canProceed) {
    gateStatus = "approval_granted_ready";
  } else {
    gateStatus = "approval_blocked";
  }

  return {
    gateId: `fireappgt_${Date.now().toString(36)}`,
    caseId: fireSession.caseId,
    fireSessionId: fireSession.actualSendFireSessionId,
    actionKey: "actual_send_fire_execute",
    gateStatus,
    preconditionResults: preconditions,
    hardBlockerCount: hardBlockers.length,
    softBlockerCount: softBlockers.length,
    warningCount: warnings.length,
    approvalRequired,
    approvalSnapshotId: snapshot?.snapshotId || null,
    approvalSnapshotValid: snapshotValid,
    payloadHashAtApproval,
    payloadHashCurrent,
    payloadHashMatch: !approvalRequired || (payloadHashAtApproval !== null &&
      payloadHashAtApproval.entityVersion === payloadHashCurrent.entityVersion &&
      payloadHashAtApproval.payloadContentHash === payloadHashCurrent.payloadContentHash &&
      payloadHashAtApproval.policyEvaluationHash === payloadHashCurrent.policyEvaluationHash &&
      payloadHashAtApproval.lineItemScope === payloadHashCurrent.lineItemScope),
    canProceedToFire: canProceed,
    gateReason: canProceed ? "Approval gate passed — fire execution eligible" : hardBlockers.map(b => b.reason).join("; "),
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: reviewer.actorId,
  };
}

// ── Events ──
export type FireApprovalGateEventType =
  | "fire_approval_gate_evaluated"
  | "fire_approval_gate_passed"
  | "fire_approval_gate_blocked"
  | "fire_approval_snapshot_invalid"
  | "fire_approval_payload_hash_mismatch";

export interface FireApprovalGateEvent {
  type: FireApprovalGateEventType;
  caseId: string;
  fireSessionId: string;
  gateId: string;
  gateStatus: FireApprovalGateStatus;
  reason: string;
  actorId: string;
  timestamp: string;
}

export function createFireApprovalGateEvent(gate: FireApprovalGateV2, actorId: string): FireApprovalGateEvent {
  const typeMap: Record<FireApprovalGateStatus, FireApprovalGateEventType> = {
    not_eligible: "fire_approval_gate_blocked",
    approval_not_required: "fire_approval_gate_passed",
    approval_required_pending: "fire_approval_gate_blocked",
    approval_granted_ready: "fire_approval_gate_passed",
    approval_blocked: "fire_approval_gate_blocked",
    approval_snapshot_invalid: "fire_approval_snapshot_invalid",
  };
  return {
    type: typeMap[gate.gateStatus],
    caseId: gate.caseId, fireSessionId: gate.fireSessionId, gateId: gate.gateId,
    gateStatus: gate.gateStatus, reason: gate.gateReason,
    actorId, timestamp: new Date().toISOString(),
  };
}
