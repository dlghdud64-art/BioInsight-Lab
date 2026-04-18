/**
 * Exception Recovery Approval Handoff Gate v2 Engine
 *
 * exception_resolve / exception_return_to_stage → approval gate → recovery execution
 *
 * GATE CONTRACT:
 * - input: DispatchExceptionRecordV2 + PermissionCheckResult
 * - output: ExceptionApprovalGateV2 (gate status + precondition results)
 * - exception resolve/return은 tier3_irreversible — valid unconsumed snapshot 필수
 *
 * 12 preconditions:
 * 1. exception_record_exists
 * 2. exception_status_eligible — open/in_investigation/resolution_in_progress
 * 3. recovery_action_set — return_to_stage인 경우 recovery action이 설정됨
 * 4. return_target_allowed — ALLOWED_RETURN_TARGETS matrix 검증
 * 5. permission_check_completed
 * 6. approval_required_verified
 * 7. approval_snapshot_exists
 * 8. approval_snapshot_not_consumed
 * 9. approval_snapshot_not_expired
 * 10. approval_snapshot_action_match
 * 11. approval_snapshot_case_match
 * 12. exception_payload_hash_integrity
 */

import type { DispatchExceptionRecordV2, ExceptionSourceStage } from "./dispatch-exception-recovery-v2-engine";
import type { PermissionCheckResult, StageActionKey, ActorContext } from "./dispatch-v2-permission-policy-engine";
import type { ApprovalSnapshotV2 } from "./dispatch-v2-approval-workbench-engine";
import { runGateFastCheck, type ApprovalPayloadHash } from "./approval-snapshot-validator";

// ── Gate Status ──
export type ExceptionApprovalGateStatus =
  | "not_eligible"
  | "approval_not_required"
  | "approval_required_pending"
  | "approval_granted_ready"
  | "approval_blocked"
  | "approval_snapshot_invalid"
  | "return_target_disallowed";

// ── Precondition Keys ──
export type ExceptionApprovalPreconditionKey =
  | "exception_record_exists"
  | "exception_status_eligible"
  | "recovery_action_set"
  | "return_target_allowed"
  | "permission_check_completed"
  | "approval_required_verified"
  | "approval_snapshot_exists"
  | "approval_snapshot_not_consumed"
  | "approval_snapshot_not_expired"
  | "approval_snapshot_action_match"
  | "approval_snapshot_case_match"
  | "exception_payload_hash_integrity";

export interface ExceptionApprovalPreconditionResult {
  key: ExceptionApprovalPreconditionKey;
  passed: boolean;
  blockingLevel: "hard_blocker" | "soft_blocker" | "warning";
  reason: string;
}

// ── Exception Payload Hash ──
export interface ExceptionPayloadHash {
  exceptionVersion: string;
  affectedLineHash: string;
  recoveryActionHash: string;
  returnTargetHash: string;
}

// ── Adapter: ExceptionPayloadHash → ApprovalPayloadHash ──
export function toApprovalPayloadHash(h: ExceptionPayloadHash): ApprovalPayloadHash {
  return { entityVersion: h.exceptionVersion, contentHash: h.affectedLineHash, policyHash: h.recoveryActionHash, scopeHash: h.returnTargetHash };
}

// ── Gate Object ──
export interface ExceptionApprovalGateV2 {
  gateId: string;
  caseId: string;
  exceptionRecordId: string;
  actionKey: StageActionKey;
  targetAction: "exception_resolve" | "exception_return_to_stage";
  gateStatus: ExceptionApprovalGateStatus;
  preconditionResults: ExceptionApprovalPreconditionResult[];
  hardBlockerCount: number;
  softBlockerCount: number;
  warningCount: number;
  approvalRequired: boolean;
  approvalSnapshotId: string | null;
  approvalSnapshotValid: boolean;
  payloadHashAtApproval: ExceptionPayloadHash | null;
  payloadHashCurrent: ExceptionPayloadHash | null;
  payloadHashMatch: boolean;
  canProceedToRecovery: boolean;
  gateReason: string;
  evaluatedAt: string;
  evaluatedBy: string;
}

// ── ALLOWED_RETURN_TARGETS (from exception engine, duplicated for gate-level fast-fail) ──
const ALLOWED_RETURN_TARGETS: Partial<Record<ExceptionSourceStage, ExceptionSourceStage[]>> = {
  stock_release: ["receiving_variance_disposition", "receiving_execution"],
  receiving_variance_disposition: ["receiving_execution", "receiving_preparation"],
  receiving_execution: ["receiving_preparation"],
  receiving_preparation: ["supplier_acknowledgment"],
  ack_followup: ["supplier_acknowledgment"],
  supplier_acknowledgment: ["delivery_tracking", "sent_outcome"],
  delivery_tracking: ["sent_outcome"],
  sent_outcome: ["actual_send_fire"],
  actual_send_fire: ["actual_send_execute"],
  actual_send_execute: ["actual_send_run"],
  actual_send_run: ["actual_send_execution"],
  actual_send_execution: ["actual_send_commit"],
  actual_send_commit: ["actual_send_transaction"],
  actual_send_transaction: ["actual_send_action"],
  actual_send_action: ["send_execution"],
  send_execution: ["send_confirmation"],
  send_confirmation: ["draft_assembly"],
  draft_assembly: ["dispatch_preparation"],
};

// ── Build Gate ──
export function buildExceptionApprovalGateV2(
  record: DispatchExceptionRecordV2,
  targetAction: "exception_resolve" | "exception_return_to_stage",
  permissionResult: PermissionCheckResult,
  reviewer: ActorContext,
  snapshot: ApprovalSnapshotV2 | null,
  payloadHashAtApproval: ExceptionPayloadHash | null,
  payloadHashCurrent: ExceptionPayloadHash,
): ExceptionApprovalGateV2 {
  const preconditions: ExceptionApprovalPreconditionResult[] = [];
  const now = new Date();
  const actionKey: StageActionKey = targetAction === "exception_resolve" ? "exception_resolve" : "exception_return_to_stage";

  // 1. exception_record_exists
  preconditions.push({ key: "exception_record_exists", passed: true, blockingLevel: "hard_blocker", reason: "" });

  // 2. exception_status_eligible
  const eligibleStatuses = ["open", "in_investigation", "resolution_in_progress"];
  const statusEligible = eligibleStatuses.includes(record.status);
  preconditions.push({
    key: "exception_status_eligible", passed: statusEligible,
    blockingLevel: "hard_blocker",
    reason: statusEligible ? "" : `Exception status '${record.status}'은 승인 진행 불가`,
  });

  // 3. recovery_action_set (for return_to_stage)
  if (targetAction === "exception_return_to_stage") {
    const hasRecovery = record.recoveryAction !== null;
    preconditions.push({
      key: "recovery_action_set", passed: hasRecovery,
      blockingLevel: "hard_blocker",
      reason: hasRecovery ? "" : "Recovery action 미설정 — set_recovery_action 먼저 실행 필요",
    });

    // 4. return_target_allowed
    const returnTarget = record.returnToStage;
    if (returnTarget) {
      const allowed = ALLOWED_RETURN_TARGETS[record.sourceStage];
      const targetAllowed = allowed ? allowed.includes(returnTarget) : false;
      preconditions.push({
        key: "return_target_allowed", passed: targetAllowed,
        blockingLevel: "hard_blocker",
        reason: targetAllowed ? "" : `Return to ${returnTarget} 불가 — ${record.sourceStage}에서 허용: ${allowed?.join(", ") || "없음"}. Mandatory gate bypass 금지`,
      });
    } else {
      preconditions.push({
        key: "return_target_allowed", passed: false,
        blockingLevel: "hard_blocker",
        reason: "Return target 미지정",
      });
    }
  } else {
    preconditions.push({ key: "recovery_action_set", passed: true, blockingLevel: "warning", reason: "Resolve action — recovery action check skipped" });
    preconditions.push({ key: "return_target_allowed", passed: true, blockingLevel: "warning", reason: "Resolve action — return target check skipped" });
  }

  // 5. permission_check_completed
  preconditions.push({ key: "permission_check_completed", passed: true, blockingLevel: "hard_blocker", reason: "" });

  // 6. approval_required_verified
  const approvalRequired = permissionResult.requiresApproval;
  preconditions.push({
    key: "approval_required_verified", passed: true,
    blockingLevel: "warning",
    reason: approvalRequired ? "Approval required" : "No approval required",
  });

  // Snapshot checks
  let snapshotValid = false;
  if (approvalRequired) {
    const snapshotExists = snapshot !== null;
    preconditions.push({ key: "approval_snapshot_exists", passed: snapshotExists, blockingLevel: "hard_blocker", reason: snapshotExists ? "" : "Approval snapshot 없음" });

    const notConsumed = snapshot ? !snapshot.consumed : false;
    preconditions.push({ key: "approval_snapshot_not_consumed", passed: notConsumed, blockingLevel: "hard_blocker", reason: notConsumed ? "" : "Snapshot 이미 사용됨" });

    const notExpired = snapshot ? new Date(snapshot.validUntil) > now : false;
    preconditions.push({ key: "approval_snapshot_not_expired", passed: notExpired, blockingLevel: "hard_blocker", reason: notExpired ? "" : "Snapshot 만료됨" });

    const approvalActionKey = targetAction === "exception_resolve" ? "approve_exception_override" : "approve_recovery_return";
    const actionMatch = snapshot ? (snapshot.actionKey === actionKey || snapshot.actionKey === approvalActionKey) : false;
    preconditions.push({ key: "approval_snapshot_action_match", passed: actionMatch, blockingLevel: "hard_blocker", reason: actionMatch ? "" : `Action key 불일치: ${snapshot?.actionKey || "none"}` });

    const caseMatch = snapshot ? snapshot.caseId === record.caseId : false;
    preconditions.push({ key: "approval_snapshot_case_match", passed: caseMatch, blockingLevel: "hard_blocker", reason: caseMatch ? "" : "Case ID 불일치" });

    const hashMatch = payloadHashAtApproval !== null &&
      payloadHashAtApproval.exceptionVersion === payloadHashCurrent.exceptionVersion &&
      payloadHashAtApproval.affectedLineHash === payloadHashCurrent.affectedLineHash &&
      payloadHashAtApproval.recoveryActionHash === payloadHashCurrent.recoveryActionHash &&
      payloadHashAtApproval.returnTargetHash === payloadHashCurrent.returnTargetHash;
    preconditions.push({ key: "exception_payload_hash_integrity", passed: hashMatch, blockingLevel: "hard_blocker", reason: hashMatch ? "" : "Exception payload hash 불일치 — 승인 이후 변경됨" });

    snapshotValid = snapshotExists && notConsumed && notExpired && actionMatch && caseMatch && hashMatch;
  } else {
    (["approval_snapshot_exists", "approval_snapshot_not_consumed", "approval_snapshot_not_expired", "approval_snapshot_action_match", "approval_snapshot_case_match", "exception_payload_hash_integrity"] as ExceptionApprovalPreconditionKey[]).forEach(key => {
      preconditions.push({ key, passed: true, blockingLevel: "warning", reason: "Approval not required — skipped" });
    });
    snapshotValid = true;
  }

  const hardBlockers = preconditions.filter(p => !p.passed && p.blockingLevel === "hard_blocker");
  const softBlockers = preconditions.filter(p => !p.passed && p.blockingLevel === "soft_blocker");
  const warnings = preconditions.filter(p => !p.passed && p.blockingLevel === "warning");
  const canProceed = hardBlockers.length === 0 && softBlockers.length === 0;

  let gateStatus: ExceptionApprovalGateStatus;
  if (!statusEligible) {
    gateStatus = "not_eligible";
  } else if (targetAction === "exception_return_to_stage" && hardBlockers.some(b => b.key === "return_target_allowed")) {
    gateStatus = "return_target_disallowed";
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
    gateId: `excappgt_${Date.now().toString(36)}`,
    caseId: record.caseId,
    exceptionRecordId: record.exceptionRecordId,
    actionKey,
    targetAction,
    gateStatus,
    preconditionResults: preconditions,
    hardBlockerCount: hardBlockers.length,
    softBlockerCount: softBlockers.length,
    warningCount: warnings.length,
    approvalRequired,
    approvalSnapshotId: snapshot?.snapshotId || null,
    approvalSnapshotValid: snapshotValid,
    payloadHashAtApproval, payloadHashCurrent,
    payloadHashMatch: !approvalRequired || (payloadHashAtApproval !== null &&
      payloadHashAtApproval.exceptionVersion === payloadHashCurrent.exceptionVersion &&
      payloadHashAtApproval.affectedLineHash === payloadHashCurrent.affectedLineHash &&
      payloadHashAtApproval.recoveryActionHash === payloadHashCurrent.recoveryActionHash &&
      payloadHashAtApproval.returnTargetHash === payloadHashCurrent.returnTargetHash),
    canProceedToRecovery: canProceed,
    gateReason: canProceed ? "Approval gate passed — recovery eligible" : hardBlockers.map(b => b.reason).join("; "),
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: reviewer.actorId,
  };
}

// ── Events ──
export type ExceptionApprovalGateEventType = "exception_approval_gate_evaluated" | "exception_approval_gate_passed" | "exception_approval_gate_blocked" | "exception_return_target_disallowed";
export interface ExceptionApprovalGateEvent { type: ExceptionApprovalGateEventType; caseId: string; exceptionRecordId: string; gateId: string; gateStatus: ExceptionApprovalGateStatus; reason: string; actorId: string; timestamp: string; }
