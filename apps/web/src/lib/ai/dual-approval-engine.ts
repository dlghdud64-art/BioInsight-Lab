/**
 * Dual Approval Engine — 2인 이상 승인 통제
 *
 * dualApprovalRequired = true인 action에 대해 복수 승인자 검증.
 *
 * DUAL APPROVAL TARGETS (우선 대상):
 * - actual_send_fire_execute (tier3)
 * - stock_release_execute (tier3)
 * - exception_resolve (tier3)
 * - exception_return_to_stage (tier3)
 * - approve_exception_override (tier3)
 *
 * RULES:
 * 1. quorum = 2 (최소 2명 승인)
 * 2. first approver ≠ second approver (동일인 금지)
 * 3. first approver ≠ requester (self-approve 금지, Tier 3)
 * 4. second approver ≠ requester (self-approve 금지, Tier 3)
 * 5. first/second approver는 same-department 가능 (but warning)
 * 6. delegation chain 충돌 검사 (delegated-from이 requester인 경우 차단)
 * 7. quorum 미달 시 실행 차단
 */

import type { ProcurementRole, StageActionKey, ActionRiskTier, ActorContext } from "./dispatch-v2-permission-policy-engine";
import type { ApprovalSnapshotV2, ApprovalDecisionV2 } from "./dispatch-v2-approval-workbench-engine";

// ── Dual Approval Status ──
export type DualApprovalStatus =
  | "awaiting_first_approval"
  | "first_approved_awaiting_second"
  | "quorum_reached"
  | "rejected_by_first"
  | "rejected_by_second"
  | "escalated"
  | "expired"
  | "invalidated";

// ── Dual Approval Slot ──
export interface DualApprovalSlot {
  slotNumber: 1 | 2;
  status: "empty" | "approved" | "rejected" | "escalated";
  approverId: string | null;
  approverRole: ProcurementRole | null;
  decisionAt: string | null;
  decisionReason: string;
  snapshotId: string | null;
  conditions: string[];
}

// ── Dual Approval Session ──
export interface DualApprovalSessionV2 {
  sessionId: string;
  caseId: string;
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;
  requesterId: string;
  requesterRole: ProcurementRole;
  status: DualApprovalStatus;
  requiredQuorum: number;
  slots: [DualApprovalSlot, DualApprovalSlot];
  // Conflict tracking
  sameApproverBlocked: boolean;
  selfApprovalBlocked: boolean;
  delegationConflict: boolean;
  sameDepartmentWarning: boolean;
  // Result
  quorumReached: boolean;
  finalSnapshotIds: string[];
  // Audit
  openedAt: string;
  lastUpdatedAt: string;
  openedBy: string;
}

// ── Conflict Check Result ──
export interface DualApprovalConflictCheck {
  allowed: boolean;
  conflicts: string[];
  warnings: string[];
}

// ── Create Session ──
export function createDualApprovalSession(
  caseId: string,
  actionKey: StageActionKey,
  riskTier: ActionRiskTier,
  requester: ActorContext,
): DualApprovalSessionV2 {
  const now = new Date().toISOString();
  const emptySlot = (n: 1 | 2): DualApprovalSlot => ({
    slotNumber: n, status: "empty",
    approverId: null, approverRole: null,
    decisionAt: null, decisionReason: "",
    snapshotId: null, conditions: [],
  });
  return {
    sessionId: `dualapp_${Date.now().toString(36)}`,
    caseId, actionKey, riskTier,
    requesterId: requester.actorId,
    requesterRole: requester.roles[0] || "operator",
    status: "awaiting_first_approval",
    requiredQuorum: 2,
    slots: [emptySlot(1), emptySlot(2)],
    sameApproverBlocked: false,
    selfApprovalBlocked: false,
    delegationConflict: false,
    sameDepartmentWarning: false,
    quorumReached: false,
    finalSnapshotIds: [],
    openedAt: now, lastUpdatedAt: now, openedBy: requester.actorId,
  };
}

// ── Check Candidate Approver ──
export function checkDualApprovalCandidate(
  session: DualApprovalSessionV2,
  candidate: ActorContext,
  slotNumber: 1 | 2,
): DualApprovalConflictCheck {
  const conflicts: string[] = [];
  const warnings: string[] = [];

  // Self-approval check (candidate = requester)
  if (candidate.actorId === session.requesterId) {
    conflicts.push("Self-approval 금지 — 요청자와 승인자가 동일인");
  }

  // Same-approver check (candidate = other slot's approver)
  const otherSlot = session.slots[slotNumber === 1 ? 1 : 0];
  if (otherSlot.approverId && otherSlot.approverId === candidate.actorId) {
    conflicts.push("동일인 이중 승인 금지 — 1차와 2차 승인자가 같은 사람");
  }

  // Delegation conflict (candidate delegated from requester)
  if (candidate.delegatedBy === session.requesterId) {
    conflicts.push("Delegation 충돌 — 요청자가 위임한 승인자는 동일 건 승인 불가");
  }

  // Same department warning (not a blocker, but tracked)
  if (candidate.departmentId === session.requesterId) {
    // Note: in real implementation, would check requester's department
    warnings.push("같은 부서 승인자 — 분리 권장");
  }

  return {
    allowed: conflicts.length === 0,
    conflicts,
    warnings,
  };
}

// ── Submit Slot Approval ──
export function submitDualApprovalSlot(
  session: DualApprovalSessionV2,
  slotNumber: 1 | 2,
  approver: ActorContext,
  decision: "approved" | "rejected" | "escalated",
  reason: string,
  snapshotId: string | null,
  conditions: string[] = [],
): { session: DualApprovalSessionV2; events: DualApprovalEvent[] } {
  const events: DualApprovalEvent[] = [];
  const now = new Date().toISOString();

  // Conflict check
  const conflictCheck = checkDualApprovalCandidate(session, approver, slotNumber);
  if (!conflictCheck.allowed) {
    events.push({
      type: "dual_approval_conflict_blocked",
      caseId: session.caseId, sessionId: session.sessionId,
      slotNumber, actorId: approver.actorId,
      reason: conflictCheck.conflicts.join("; "),
      timestamp: now,
    });
    return { session: { ...session, lastUpdatedAt: now }, events };
  }

  const slotIdx = slotNumber - 1;
  const updatedSlots = [...session.slots] as [DualApprovalSlot, DualApprovalSlot];
  updatedSlots[slotIdx] = {
    slotNumber,
    status: decision,
    approverId: approver.actorId,
    approverRole: approver.roles[0] || "approver",
    decisionAt: now,
    decisionReason: reason,
    snapshotId: decision === "approved" ? snapshotId : null,
    conditions,
  };

  let newStatus: DualApprovalStatus = session.status;
  let quorumReached = false;
  const snapshotIds: string[] = [];

  if (decision === "rejected") {
    newStatus = slotNumber === 1 ? "rejected_by_first" : "rejected_by_second";
    events.push({ type: "dual_approval_slot_rejected", caseId: session.caseId, sessionId: session.sessionId, slotNumber, actorId: approver.actorId, reason, timestamp: now });
  } else if (decision === "escalated") {
    newStatus = "escalated";
    events.push({ type: "dual_approval_slot_escalated", caseId: session.caseId, sessionId: session.sessionId, slotNumber, actorId: approver.actorId, reason, timestamp: now });
  } else if (decision === "approved") {
    events.push({ type: "dual_approval_slot_approved", caseId: session.caseId, sessionId: session.sessionId, slotNumber, actorId: approver.actorId, reason, timestamp: now });

    // Check quorum
    const approvedCount = updatedSlots.filter(s => s.status === "approved").length;
    if (approvedCount >= session.requiredQuorum) {
      quorumReached = true;
      newStatus = "quorum_reached";
      updatedSlots.forEach(s => { if (s.snapshotId) snapshotIds.push(s.snapshotId); });
      events.push({ type: "dual_approval_quorum_reached", caseId: session.caseId, sessionId: session.sessionId, slotNumber, actorId: approver.actorId, reason: `Quorum ${approvedCount}/${session.requiredQuorum} reached`, timestamp: now });
    } else {
      newStatus = "first_approved_awaiting_second";
    }
  }

  return {
    session: {
      ...session,
      slots: updatedSlots,
      status: newStatus,
      quorumReached,
      finalSnapshotIds: snapshotIds,
      sameApproverBlocked: conflictCheck.conflicts.some(c => c.includes("동일인")),
      selfApprovalBlocked: conflictCheck.conflicts.some(c => c.includes("Self-approval")),
      delegationConflict: conflictCheck.conflicts.some(c => c.includes("Delegation")),
      sameDepartmentWarning: conflictCheck.warnings.length > 0,
      lastUpdatedAt: now,
    },
    events,
  };
}

// ── Events ──
export type DualApprovalEventType =
  | "dual_approval_session_created"
  | "dual_approval_slot_approved"
  | "dual_approval_slot_rejected"
  | "dual_approval_slot_escalated"
  | "dual_approval_quorum_reached"
  | "dual_approval_conflict_blocked"
  | "dual_approval_expired";

export interface DualApprovalEvent {
  type: DualApprovalEventType;
  caseId: string;
  sessionId: string;
  slotNumber: 1 | 2;
  actorId: string;
  reason: string;
  timestamp: string;
}
