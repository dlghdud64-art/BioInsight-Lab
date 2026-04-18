/**
 * Approval Policy Surface Engine — operator workspace에 policy reason inline 연결
 *
 * 목적:
 * - 왜 막혔는지 (blocker reason + policy constraint)
 * - 누가 승인해야 하는지 (required approver role + escalation)
 * - 어떤 hash/policy mismatch 때문에 재승인이 필요한지 (consume guard detail)
 * - 현재 snapshot 상태 (valid/expired/consumed/invalidated)
 *
 * 이 엔진은 read-only projection — 모든 source of truth는 upstream engine에서 옴.
 * workspace component가 이 surface를 inline 렌더하면 됨.
 */

import type { PermissionCheckResult, ApprovalRequirementV2, StageActionKey, ProcurementRole, ActionRiskTier } from "./dispatch-v2-permission-policy-engine";
import type { ApprovalSnapshotV2 } from "./dispatch-v2-approval-workbench-engine";
import type { ConsumeGuardResult, ConsumeGuardCheck } from "./approval-snapshot-validator";

// ── Policy Blocker Surface ──
export interface PolicyBlockerSurface {
  constraintKey: string;
  status: "pass" | "warning" | "block";
  reason: string;
  escalationRole: ProcurementRole | null;
}

// ── Approval Status Surface ──
export type ApprovalStatusIndicator =
  | "no_approval_needed"
  | "approval_pending"
  | "approval_granted"
  | "approval_rejected"
  | "approval_escalated"
  | "approval_expired"
  | "snapshot_invalidated"
  | "snapshot_consumed"
  | "reapproval_required";

// ── Policy Surface State ──
export interface ApprovalPolicySurfaceState {
  // Context
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;
  caseId: string;

  // Permission Status
  permissionSummary: {
    permitted: boolean;
    level: "allowed" | "requires_approval" | "denied";
    reason: string;
  };

  // Policy Constraints
  policyBlockers: PolicyBlockerSurface[];
  policyWarnings: PolicyBlockerSurface[];
  hasBlockers: boolean;
  hasWarnings: boolean;

  // Approval Requirement
  approvalRequired: boolean;
  requiredApproverRole: ProcurementRole | null;
  selfApprovalAllowed: boolean;
  dualApprovalRequired: boolean;

  // Approval Status
  approvalStatus: ApprovalStatusIndicator;
  approvalStatusReason: string;

  // Snapshot State (if exists)
  snapshotSummary: {
    exists: boolean;
    snapshotId: string | null;
    consumed: boolean;
    expired: boolean;
    valid: boolean;
    validUntil: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
  };

  // Consume Guard Summary (if evaluated)
  consumeGuardSummary: {
    evaluated: boolean;
    passed: boolean;
    failedChecks: string[];
    totalChecks: number;
    passedChecks: number;
  } | null;

  // Hash Mismatch Detail (if any)
  hashMismatchDetail: {
    hasMismatch: boolean;
    entityVersionChanged: boolean;
    contentChanged: boolean;
    policyChanged: boolean;
    scopeChanged: boolean;
    mismatchExplanation: string;
  };

  // Operator Guidance
  operatorGuidance: {
    nextAction: string;
    whyBlocked: string[];
    whoCanUnblock: string[];
    reapprovalNeeded: boolean;
    reapprovalReason: string;
  };

  generatedAt: string;
}

// ── Build Policy Surface ──
export function buildApprovalPolicySurface(
  caseId: string,
  permissionResult: PermissionCheckResult,
  snapshot: ApprovalSnapshotV2 | null,
  consumeGuardResult: ConsumeGuardResult | null,
): ApprovalPolicySurfaceState {
  const req = permissionResult.approvalRequirement;

  // Policy blockers/warnings
  const policyBlockers: PolicyBlockerSurface[] = req.policySnapshot
    .filter(p => p.status === "block")
    .map(p => ({ constraintKey: p.constraintKey, status: p.status, reason: p.reason, escalationRole: p.escalationRole }));

  const policyWarnings: PolicyBlockerSurface[] = req.policySnapshot
    .filter(p => p.status === "warning")
    .map(p => ({ constraintKey: p.constraintKey, status: p.status, reason: p.reason, escalationRole: p.escalationRole }));

  // Snapshot state
  const now = new Date();
  const snapshotExists = snapshot !== null;
  const snapshotExpired = snapshot ? new Date(snapshot.validUntil) < now : false;
  const snapshotConsumed = snapshot?.consumed ?? false;
  const snapshotValid = snapshotExists && !snapshotExpired && !snapshotConsumed;

  // Approval status
  let approvalStatus: ApprovalStatusIndicator;
  let approvalStatusReason: string;

  if (!req.approvalRequired) {
    approvalStatus = "no_approval_needed";
    approvalStatusReason = "이 작업은 승인 없이 실행 가능합니다";
  } else if (consumeGuardResult && !consumeGuardResult.guardPassed) {
    approvalStatus = "snapshot_invalidated";
    approvalStatusReason = `Snapshot 검증 실패: ${consumeGuardResult.failedChecks.join("; ")}`;
  } else if (snapshotConsumed) {
    approvalStatus = "snapshot_consumed";
    approvalStatusReason = "Snapshot이 이미 사용됨 — 재승인 필요";
  } else if (snapshotExpired) {
    approvalStatus = "approval_expired";
    approvalStatusReason = `Snapshot 만료 (${snapshot!.validUntil})`;
  } else if (snapshotValid) {
    approvalStatus = "approval_granted";
    approvalStatusReason = `${snapshot!.approvedBy}에 의해 승인됨 (${snapshot!.approvedAt})`;
  } else {
    approvalStatus = "approval_pending";
    approvalStatusReason = `${req.requiredApproverRole || "approver"} 승인 대기 중`;
  }

  // Consume guard summary
  let consumeGuardSummary = null;
  if (consumeGuardResult) {
    consumeGuardSummary = {
      evaluated: true,
      passed: consumeGuardResult.guardPassed,
      failedChecks: consumeGuardResult.failedChecks,
      totalChecks: consumeGuardResult.checks.length,
      passedChecks: consumeGuardResult.checks.filter(c => c.passed).length,
    };
  }

  // Hash mismatch detail
  const hashChecks = consumeGuardResult?.checks || [];
  const entityChanged = hashChecks.find(c => c.checkKey === "entity_version_match")?.passed === false;
  const contentChanged = hashChecks.find(c => c.checkKey === "payload_content_hash_match")?.passed === false;
  const policyChanged = hashChecks.find(c => c.checkKey === "policy_evaluation_hash_match")?.passed === false;
  const scopeChanged = hashChecks.find(c => c.checkKey === "scope_match")?.passed === false;
  const hasMismatch = (entityChanged || contentChanged || policyChanged || scopeChanged) ?? false;

  const mismatchParts: string[] = [];
  if (entityChanged) mismatchParts.push("원본 entity version 변경");
  if (contentChanged) mismatchParts.push("payload 내용 변경");
  if (policyChanged) mismatchParts.push("policy 평가 결과 변경");
  if (scopeChanged) mismatchParts.push("대상 범위 변경");

  // Operator guidance
  const whyBlocked: string[] = [
    ...req.blockedReasonCodes,
    ...policyBlockers.map(b => b.reason),
  ];
  const whoCanUnblock: string[] = [];
  if (req.requiredApproverRole) whoCanUnblock.push(`${req.requiredApproverRole} 역할 승인자`);
  if (permissionResult.escalationRole) whoCanUnblock.push(`에스컬레이션: ${permissionResult.escalationRole}`);

  let nextAction: string;
  if (approvalStatus === "no_approval_needed") {
    nextAction = "바로 실행 가능";
  } else if (approvalStatus === "approval_granted") {
    nextAction = "승인 완료 — 실행 진행 가능";
  } else if (approvalStatus === "snapshot_invalidated" || approvalStatus === "approval_expired" || approvalStatus === "snapshot_consumed") {
    nextAction = "재승인 요청 필요";
  } else if (policyBlockers.length > 0) {
    nextAction = "정책 위반 해소 후 재요청";
  } else {
    nextAction = `${req.requiredApproverRole || "approver"} 승인 요청`;
  }

  const reapprovalNeeded = approvalStatus === "snapshot_invalidated" || approvalStatus === "approval_expired" || approvalStatus === "snapshot_consumed";

  return {
    actionKey: req.actionKey,
    riskTier: req.actionRiskTier,
    caseId,
    permissionSummary: {
      permitted: permissionResult.permitted,
      level: permissionResult.permissionLevel,
      reason: permissionResult.reason,
    },
    policyBlockers,
    policyWarnings,
    hasBlockers: policyBlockers.length > 0,
    hasWarnings: policyWarnings.length > 0,
    approvalRequired: req.approvalRequired,
    requiredApproverRole: req.requiredApproverRole,
    selfApprovalAllowed: req.selfApprovalAllowed,
    dualApprovalRequired: req.dualApprovalRequired,
    approvalStatus,
    approvalStatusReason,
    snapshotSummary: {
      exists: snapshotExists,
      snapshotId: snapshot?.snapshotId || null,
      consumed: snapshotConsumed,
      expired: snapshotExpired,
      valid: snapshotValid,
      validUntil: snapshot?.validUntil || null,
      approvedBy: snapshot?.approvedBy || null,
      approvedAt: snapshot?.approvedAt || null,
    },
    consumeGuardSummary,
    hashMismatchDetail: {
      hasMismatch,
      entityVersionChanged: entityChanged ?? false,
      contentChanged: contentChanged ?? false,
      policyChanged: policyChanged ?? false,
      scopeChanged: scopeChanged ?? false,
      mismatchExplanation: hasMismatch ? `변경된 항목: ${mismatchParts.join(", ")}` : "",
    },
    operatorGuidance: {
      nextAction,
      whyBlocked,
      whoCanUnblock,
      reapprovalNeeded,
      reapprovalReason: reapprovalNeeded ? `이전 승인이 무효화됨 (${approvalStatusReason})` : "",
    },
    generatedAt: new Date().toISOString(),
  };
}
