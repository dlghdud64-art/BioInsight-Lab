/**
 * Stock Release Approval Handoff Gate v2 Engine
 *
 * stock_release_execute → approval gate → release execution
 *
 * GATE CONTRACT:
 * - input: StockReleaseSessionV2 (release_in_progress/release_open) + PermissionCheckResult
 * - output: StockReleaseApprovalGateV2 (gate status + precondition results)
 * - stock release execution은 valid unconsumed ApprovalSnapshotV2 없이 진행 불가 (approval required인 경우)
 *
 * 10 preconditions:
 * 1. release_session_exists — session 존재
 * 2. release_lines_assigned — 모든 line에 location 배정
 * 3. permission_check_completed — checkPermission 결과 존재
 * 4. approval_required_verified — requires_approval이면 approval 필수
 * 5. approval_snapshot_exists — snapshot 존재 (approval required인 경우)
 * 6. approval_snapshot_not_consumed — snapshot 미사용
 * 7. approval_snapshot_not_expired — snapshot 유효기간 내
 * 8. approval_snapshot_action_match — snapshot의 actionKey 일치
 * 9. approval_snapshot_case_match — snapshot의 caseId 일치
 * 10. release_payload_hash_integrity — approval 시점 release hash와 현재 일치
 */

import type { StockReleaseSessionV2 } from "./stock-release-resolution-v2-engine";
import type { PermissionCheckResult, StageActionKey, ActorContext } from "./dispatch-v2-permission-policy-engine";
import type { ApprovalSnapshotV2 } from "./dispatch-v2-approval-workbench-engine";

// ── Gate Status ──
export type StockReleaseApprovalGateStatus =
  | "not_eligible"
  | "approval_not_required"
  | "approval_required_pending"
  | "approval_granted_ready"
  | "approval_blocked"
  | "approval_snapshot_invalid";

// ── Precondition Keys ──
export type StockReleaseApprovalPreconditionKey =
  | "release_session_exists"
  | "release_lines_assigned"
  | "permission_check_completed"
  | "approval_required_verified"
  | "approval_snapshot_exists"
  | "approval_snapshot_not_consumed"
  | "approval_snapshot_not_expired"
  | "approval_snapshot_action_match"
  | "approval_snapshot_case_match"
  | "release_payload_hash_integrity";

export interface StockReleaseApprovalPreconditionResult {
  key: StockReleaseApprovalPreconditionKey;
  passed: boolean;
  blockingLevel: "hard_blocker" | "soft_blocker" | "warning";
  reason: string;
}

// ── Release Payload Hash ──
export interface ReleasePayloadHash {
  releaseSessionVersion: string;
  lineItemHash: string;
  totalReleasableQtyHash: string;
  locationAssignmentHash: string;
}

// ── Gate Object ──
export interface StockReleaseApprovalGateV2 {
  gateId: string;
  caseId: string;
  releaseSessionId: string;
  actionKey: StageActionKey;
  gateStatus: StockReleaseApprovalGateStatus;
  preconditionResults: StockReleaseApprovalPreconditionResult[];
  hardBlockerCount: number;
  softBlockerCount: number;
  warningCount: number;
  approvalRequired: boolean;
  approvalSnapshotId: string | null;
  approvalSnapshotValid: boolean;
  payloadHashAtApproval: ReleasePayloadHash | null;
  payloadHashCurrent: ReleasePayloadHash | null;
  payloadHashMatch: boolean;
  canProceedToRelease: boolean;
  gateReason: string;
  evaluatedAt: string;
  evaluatedBy: string;
}

// ── Build Gate ──
export function buildStockReleaseApprovalGateV2(
  session: StockReleaseSessionV2,
  permissionResult: PermissionCheckResult,
  reviewer: ActorContext,
  snapshot: ApprovalSnapshotV2 | null,
  payloadHashAtApproval: ReleasePayloadHash | null,
  payloadHashCurrent: ReleasePayloadHash,
): StockReleaseApprovalGateV2 {
  const preconditions: StockReleaseApprovalPreconditionResult[] = [];
  const now = new Date();

  // 1. release_session_exists
  preconditions.push({
    key: "release_session_exists", passed: true,
    blockingLevel: "hard_blocker", reason: "",
  });

  // 2. release_lines_assigned
  const allAssigned = session.releaseLines.every(l => l.locationAssigned && l.locationAssigned !== "");
  preconditions.push({
    key: "release_lines_assigned", passed: allAssigned,
    blockingLevel: "hard_blocker",
    reason: allAssigned ? "" : "일부 release line에 location 미배정",
  });

  // 3. permission_check_completed
  preconditions.push({ key: "permission_check_completed", passed: true, blockingLevel: "hard_blocker", reason: "" });

  // 4. approval_required_verified
  const approvalRequired = permissionResult.requiresApproval;
  preconditions.push({
    key: "approval_required_verified", passed: true,
    blockingLevel: "warning",
    reason: approvalRequired ? "Approval required for stock release" : "No approval required",
  });

  let snapshotValid = false;
  if (approvalRequired) {
    const snapshotExists = snapshot !== null;
    preconditions.push({ key: "approval_snapshot_exists", passed: snapshotExists, blockingLevel: "hard_blocker", reason: snapshotExists ? "" : "Approval snapshot 없음 — 승인 필요" });

    const notConsumed = snapshot ? !snapshot.consumed : false;
    preconditions.push({ key: "approval_snapshot_not_consumed", passed: notConsumed, blockingLevel: "hard_blocker", reason: notConsumed ? "" : "Approval snapshot 이미 사용됨" });

    const notExpired = snapshot ? new Date(snapshot.validUntil) > now : false;
    preconditions.push({ key: "approval_snapshot_not_expired", passed: notExpired, blockingLevel: "hard_blocker", reason: notExpired ? "" : "Approval snapshot 만료됨" });

    const actionMatch = snapshot ? snapshot.actionKey === "stock_release_execute" || snapshot.actionKey === "approve_stock_release" : false;
    preconditions.push({ key: "approval_snapshot_action_match", passed: actionMatch, blockingLevel: "hard_blocker", reason: actionMatch ? "" : `Action key 불일치: ${snapshot?.actionKey || "none"}` });

    const caseMatch = snapshot ? snapshot.caseId === session.caseId : false;
    preconditions.push({ key: "approval_snapshot_case_match", passed: caseMatch, blockingLevel: "hard_blocker", reason: caseMatch ? "" : `Case ID 불일치` });

    const hashMatch = payloadHashAtApproval !== null &&
      payloadHashAtApproval.releaseSessionVersion === payloadHashCurrent.releaseSessionVersion &&
      payloadHashAtApproval.lineItemHash === payloadHashCurrent.lineItemHash &&
      payloadHashAtApproval.totalReleasableQtyHash === payloadHashCurrent.totalReleasableQtyHash &&
      payloadHashAtApproval.locationAssignmentHash === payloadHashCurrent.locationAssignmentHash;
    preconditions.push({ key: "release_payload_hash_integrity", passed: hashMatch, blockingLevel: "hard_blocker", reason: hashMatch ? "" : "Release payload hash 불일치 — 승인 이후 변경됨. 재승인 필요" });

    snapshotValid = snapshotExists && notConsumed && notExpired && actionMatch && caseMatch && hashMatch;
  } else {
    (["approval_snapshot_exists", "approval_snapshot_not_consumed", "approval_snapshot_not_expired", "approval_snapshot_action_match", "approval_snapshot_case_match", "release_payload_hash_integrity"] as StockReleaseApprovalPreconditionKey[]).forEach(key => {
      preconditions.push({ key, passed: true, blockingLevel: "warning", reason: "Approval not required — skipped" });
    });
    snapshotValid = true;
  }

  const hardBlockers = preconditions.filter(p => !p.passed && p.blockingLevel === "hard_blocker");
  const softBlockers = preconditions.filter(p => !p.passed && p.blockingLevel === "soft_blocker");
  const warnings = preconditions.filter(p => !p.passed && p.blockingLevel === "warning");
  const canProceed = hardBlockers.length === 0 && softBlockers.length === 0;

  let gateStatus: StockReleaseApprovalGateStatus;
  if (!allAssigned) {
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
    gateId: `stkrlsappgt_${Date.now().toString(36)}`,
    caseId: session.caseId,
    releaseSessionId: session.releaseSessionId,
    actionKey: "stock_release_execute",
    gateStatus, preconditionResults: preconditions,
    hardBlockerCount: hardBlockers.length, softBlockerCount: softBlockers.length, warningCount: warnings.length,
    approvalRequired,
    approvalSnapshotId: snapshot?.snapshotId || null,
    approvalSnapshotValid: snapshotValid,
    payloadHashAtApproval, payloadHashCurrent,
    payloadHashMatch: !approvalRequired || (payloadHashAtApproval !== null &&
      payloadHashAtApproval.releaseSessionVersion === payloadHashCurrent.releaseSessionVersion &&
      payloadHashAtApproval.lineItemHash === payloadHashCurrent.lineItemHash &&
      payloadHashAtApproval.totalReleasableQtyHash === payloadHashCurrent.totalReleasableQtyHash &&
      payloadHashAtApproval.locationAssignmentHash === payloadHashCurrent.locationAssignmentHash),
    canProceedToRelease: canProceed,
    gateReason: canProceed ? "Approval gate passed — release execution eligible" : hardBlockers.map(b => b.reason).join("; "),
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: reviewer.actorId,
  };
}

// ── Events ──
export type StockReleaseApprovalGateEventType = "stock_release_approval_gate_evaluated" | "stock_release_approval_gate_passed" | "stock_release_approval_gate_blocked" | "stock_release_approval_snapshot_invalid";
export interface StockReleaseApprovalGateEvent { type: StockReleaseApprovalGateEventType; caseId: string; releaseSessionId: string; gateId: string; gateStatus: StockReleaseApprovalGateStatus; reason: string; actorId: string; timestamp: string; }
