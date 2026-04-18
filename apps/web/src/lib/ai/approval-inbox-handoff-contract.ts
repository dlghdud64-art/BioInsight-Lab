/**
 * Approval Inbox ↔ Domain Workbench Handoff Contract
 *
 * Inbox와 Domain Workspace 간 상태 정합성을 보장하는 contract 정의.
 *
 * PROBLEM:
 * - inbox에서 본 상태
 * - domain workspace에서 본 상태
 * - 실제 resolution 대상 상태
 * 이 셋이 미세하게 어긋날 수 있음.
 *
 * SOLUTION:
 * ApprovalHandoffToken — inbox → workspace 전환 시 전달하는 canonical token.
 * workspace는 이 token의 hash와 현재 실제 상태를 비교해서 stale이면 거부.
 */

import type { ApprovalDomain, ApprovalInboxItemStatus } from "./approval-inbox-projection-v2-engine";
import type { StageActionKey, ActionRiskTier, ProcurementRole } from "./dispatch-v2-permission-policy-engine";

// ── Handoff Token ──
export interface ApprovalHandoffToken {
  tokenId: string;
  // Source (inbox)
  inboxItemId: string;
  // Target (domain workspace)
  domain: ApprovalDomain;
  caseId: string;
  sourceSessionId: string;
  sourceGateId: string;
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;
  // State at handoff time
  itemStatusAtHandoff: ApprovalInboxItemStatus;
  approvalSnapshotId: string | null;
  reapprovalRequired: boolean;
  policySnapshotHash: string;
  payloadHash: string;
  lastMaterialChangeAt: string;
  // Handoff metadata
  handoffBy: string;
  handoffAt: string;
  handoffReason: string;
}

// ── Handoff Validation Result ──
export interface HandoffValidationResult {
  valid: boolean;
  stale: boolean;
  staleReasons: string[];
  currentStatus: string;
  tokenStatus: ApprovalInboxItemStatus;
  recommendation: "proceed" | "refresh_inbox" | "reapproval_required" | "session_closed";
}

// ── Create Handoff Token ──
export function createHandoffToken(
  inboxItemId: string,
  domain: ApprovalDomain,
  caseId: string,
  sourceSessionId: string,
  sourceGateId: string,
  actionKey: StageActionKey,
  riskTier: ActionRiskTier,
  itemStatus: ApprovalInboxItemStatus,
  approvalSnapshotId: string | null,
  reapprovalRequired: boolean,
  policySnapshotHash: string,
  payloadHash: string,
  lastMaterialChangeAt: string,
  handoffBy: string,
): ApprovalHandoffToken {
  return {
    tokenId: `hoff_${Date.now().toString(36)}`,
    inboxItemId,
    domain, caseId, sourceSessionId, sourceGateId,
    actionKey, riskTier,
    itemStatusAtHandoff: itemStatus,
    approvalSnapshotId,
    reapprovalRequired,
    policySnapshotHash,
    payloadHash,
    lastMaterialChangeAt,
    handoffBy,
    handoffAt: new Date().toISOString(),
    handoffReason: `Inbox → ${domain} workspace`,
  };
}

// ── Validate Handoff Token against Current State ──
export function validateHandoffToken(
  token: ApprovalHandoffToken,
  currentSessionStatus: string,
  currentPolicySnapshotHash: string,
  currentPayloadHash: string,
  currentLastMaterialChangeAt: string,
): HandoffValidationResult {
  const staleReasons: string[] = [];

  // Check if session status has changed
  const terminalStatuses = ["snapshot_consumed_fire_unlocked", "snapshot_consumed_release_unlocked", "snapshot_consumed_recovery_unlocked", "rejected"];
  if (terminalStatuses.includes(currentSessionStatus)) {
    return {
      valid: false,
      stale: true,
      staleReasons: [`Session이 이미 종료됨: ${currentSessionStatus}`],
      currentStatus: currentSessionStatus,
      tokenStatus: token.itemStatusAtHandoff,
      recommendation: "session_closed",
    };
  }

  // Check policy hash drift
  if (token.policySnapshotHash !== currentPolicySnapshotHash) {
    staleReasons.push("Policy 평가 결과 변경됨");
  }

  // Check payload hash drift
  if (token.payloadHash !== currentPayloadHash) {
    staleReasons.push("Payload 내용 변경됨");
  }

  // Check material change timestamp
  if (token.lastMaterialChangeAt !== currentLastMaterialChangeAt) {
    staleReasons.push(`Material change: ${token.lastMaterialChangeAt} → ${currentLastMaterialChangeAt}`);
  }

  const isStale = staleReasons.length > 0;

  let recommendation: HandoffValidationResult["recommendation"];
  if (!isStale) {
    recommendation = "proceed";
  } else if (staleReasons.some(r => r.includes("Payload") || r.includes("Policy"))) {
    recommendation = "reapproval_required";
  } else {
    recommendation = "refresh_inbox";
  }

  return {
    valid: !isStale,
    stale: isStale,
    staleReasons,
    currentStatus: currentSessionStatus,
    tokenStatus: token.itemStatusAtHandoff,
    recommendation,
  };
}

// ── Handoff Events ──
export type HandoffEventType =
  | "handoff_token_created"
  | "handoff_token_validated"
  | "handoff_token_stale_detected"
  | "handoff_workspace_opened"
  | "handoff_refresh_required";

export interface HandoffEvent {
  type: HandoffEventType;
  tokenId: string;
  domain: ApprovalDomain;
  caseId: string;
  actorId: string;
  staleReasons: string[];
  timestamp: string;
}
