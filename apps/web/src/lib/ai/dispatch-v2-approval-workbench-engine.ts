/**
 * Dispatch v2 Approval Workbench Engine — irreversible action 승인 운영면
 *
 * Approval은 modal이 아니라 정식 workbench surface.
 * center = 승인 판단, rail = policy evidence / object snapshot, dock = approve / reject / escalate
 *
 * 대상: fire / stock release / exception resolve / high-variance disposition / budget override
 */

import type { ApprovalRequirementV2, ApprovalRequest, ApprovalRequestStatus, ProcurementRole, ActorContext, StageActionKey, ActionRiskTier } from "./dispatch-v2-permission-policy-engine";

// ── Approval Workbench Status ──
export type ApprovalWorkbenchStatusV2 = "pending_review" | "in_review" | "approved" | "rejected" | "escalated" | "expired" | "cancelled";

// ── Approval Evidence ──
export interface ApprovalEvidenceV2 {
  caseId: string;
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;
  requestedBy: string;
  requestedAt: string;
  approvalRequirement: ApprovalRequirementV2;
  objectSnapshotSummary: string;
  affectedLineCount: number;
  totalAmount: number;
  policyConstraintSummary: string[];
  whyApprovalNeeded: string;
  whySelfApprovalBlocked: string;
}

// ── Approval Decision ──
export interface ApprovalDecisionV2 {
  decisionId: string;
  requestId: string;
  caseId: string;
  actionKey: StageActionKey;
  decision: "approved" | "rejected" | "escalated" | "request_change";
  decidedBy: string;
  decidedByRole: ProcurementRole;
  decidedAt: string;
  decisionReason: string;
  conditionsIfAny: string[];
  approvalSnapshotId: string;
}

// ── Approval Snapshot (token for downstream gate) ──
export interface ApprovalSnapshotV2 {
  snapshotId: string;
  requestId: string;
  caseId: string;
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;
  approvedBy: string;
  approvedByRole: ProcurementRole;
  approvedAt: string;
  approvalReason: string;
  policyConstraintResults: string[];
  validUntil: string; // expiry for time-limited approvals
  consumed: boolean;
  consumedAt: string | null;
  consumedByAction: string | null;
}

// ── Approval Workbench State ──
export interface ApprovalWorkbenchStateV2 {
  workbenchId: string;
  caseId: string;
  request: ApprovalRequest;
  evidence: ApprovalEvidenceV2;
  workbenchStatus: ApprovalWorkbenchStatusV2;
  decision: ApprovalDecisionV2 | null;
  approvalSnapshot: ApprovalSnapshotV2 | null;
  canApprove: boolean;
  canReject: boolean;
  canEscalate: boolean;
  canRequestChange: boolean;
  blockerSummary: string[];
  operatorNote: string;
  generatedAt: string;
}

// ── Build Workbench ──
export function buildApprovalWorkbenchStateV2(
  request: ApprovalRequest,
  requirement: ApprovalRequirementV2,
  reviewer: ActorContext,
  objectSnapshot: string,
  lineCount: number,
  totalAmount: number,
): ApprovalWorkbenchStateV2 {
  const evidence: ApprovalEvidenceV2 = {
    caseId: request.caseId, actionKey: request.actionKey,
    riskTier: requirement.actionRiskTier,
    requestedBy: request.requestedBy, requestedAt: request.requestedAt,
    approvalRequirement: requirement,
    objectSnapshotSummary: objectSnapshot,
    affectedLineCount: lineCount, totalAmount,
    policyConstraintSummary: requirement.policySnapshot.filter(p => p.status !== "pass").map(p => `${p.constraintKey}: ${p.reason}`),
    whyApprovalNeeded: requirement.approvalRequired ? `${requirement.requiredApproverRole} 승인 필요 (${requirement.actionRiskTier})` : "N/A",
    whySelfApprovalBlocked: !requirement.selfApprovalAllowed ? `Tier 3 irreversible action — self-approve 금지` : requirement.dualApprovalRequired ? "Dual approval 필요" : "Self-approval 가능",
  };

  const hasReviewerRole = requirement.requiredApproverRole ? reviewer.roles.some(r => r === requirement.requiredApproverRole || ROLE_HIERARCHY_LOCAL[r] >= ROLE_HIERARCHY_LOCAL[requirement.requiredApproverRole!]) : false;
  const isSameActor = reviewer.actorId === request.requestedBy;
  const canApprove = hasReviewerRole && (!isSameActor || requirement.selfApprovalAllowed);

  return {
    workbenchId: `appwb_${Date.now().toString(36)}`, caseId: request.caseId,
    request, evidence,
    workbenchStatus: "pending_review",
    decision: null, approvalSnapshot: null,
    canApprove,
    canReject: hasReviewerRole,
    canEscalate: true,
    canRequestChange: hasReviewerRole,
    blockerSummary: requirement.blockedReasonCodes,
    operatorNote: "", generatedAt: new Date().toISOString(),
  };
}

const ROLE_HIERARCHY_LOCAL: Record<ProcurementRole, number> = { viewer: 0, requester: 1, operator: 2, approver: 3, admin: 4, owner: 5 };

// ── Decide Approval ──
export function decideApprovalV2(
  workbench: ApprovalWorkbenchStateV2,
  decision: "approved" | "rejected" | "escalated" | "request_change",
  decidedBy: ActorContext,
  reason: string,
  conditions: string[] = [],
): { workbench: ApprovalWorkbenchStateV2; snapshot: ApprovalSnapshotV2 | null } {
  const now = new Date().toISOString();
  const decisionRecord: ApprovalDecisionV2 = {
    decisionId: `appdec_${Date.now().toString(36)}`, requestId: workbench.request.requestId,
    caseId: workbench.caseId, actionKey: workbench.request.actionKey,
    decision, decidedBy: decidedBy.actorId, decidedByRole: decidedBy.roles[0] || "operator",
    decidedAt: now, decisionReason: reason, conditionsIfAny: conditions,
    approvalSnapshotId: "",
  };

  let snapshot: ApprovalSnapshotV2 | null = null;
  if (decision === "approved") {
    snapshot = {
      snapshotId: `appsnap_${Date.now().toString(36)}`, requestId: workbench.request.requestId,
      caseId: workbench.caseId, actionKey: workbench.request.actionKey,
      riskTier: workbench.evidence.riskTier,
      approvedBy: decidedBy.actorId, approvedByRole: decidedBy.roles[0] || "approver",
      approvedAt: now, approvalReason: reason,
      policyConstraintResults: workbench.evidence.policyConstraintSummary,
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h expiry
      consumed: false, consumedAt: null, consumedByAction: null,
    };
    decisionRecord.approvalSnapshotId = snapshot.snapshotId;
  }

  const statusMap: Record<string, ApprovalWorkbenchStatusV2> = { approved: "approved", rejected: "rejected", escalated: "escalated", request_change: "pending_review" };

  return {
    workbench: { ...workbench, workbenchStatus: statusMap[decision], decision: decisionRecord, approvalSnapshot: snapshot },
    snapshot,
  };
}

// ── Consume Approval Snapshot (attach to action execution) ──
export function consumeApprovalSnapshot(snapshot: ApprovalSnapshotV2, consumedByAction: string): ApprovalSnapshotV2 {
  if (snapshot.consumed) throw new Error("Approval snapshot already consumed");
  if (new Date(snapshot.validUntil) < new Date()) throw new Error("Approval snapshot expired");
  return { ...snapshot, consumed: true, consumedAt: new Date().toISOString(), consumedByAction };
}

// ── Events ──
export type ApprovalWorkbenchEventType = "approval_workbench_opened" | "approval_reviewed" | "approval_approved" | "approval_rejected" | "approval_escalated" | "approval_change_requested" | "approval_snapshot_created" | "approval_snapshot_consumed" | "approval_snapshot_expired";
export interface ApprovalWorkbenchEvent { type: ApprovalWorkbenchEventType; caseId: string; requestId: string; actionKey: StageActionKey; actorId: string; reason: string; timestamp: string; }
