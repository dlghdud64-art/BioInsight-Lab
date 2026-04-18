/**
 * Fire Approval Workspace v2 — approval review surface for fire execution
 *
 * center = 승인 판단 (evidence + policy + risk summary)
 * rail = object snapshot + approval history + policy constraint results
 * dock = approve / reject / escalate / request_change
 *
 * WORKSPACE CONTRACT:
 * - input: FireApprovalGateV2 + ApprovalWorkbenchStateV2 + FireSession snapshot
 * - output: FireApprovalWorkspaceStateV2 (render-ready surface state)
 * - 읽기 전용 surface — mutation은 fire-approval-resolution에서만
 */

import type { FireApprovalGateV2, FirePayloadHash } from "./fire-approval-handoff-gate-v2-engine";
import type { ApprovalWorkbenchStateV2, ApprovalEvidenceV2 } from "./dispatch-v2-approval-workbench-engine";
import type { ActorContext, StageActionKey, ProcurementRole, ActionRiskTier } from "./dispatch-v2-permission-policy-engine";

// ── Workspace Status ──
export type FireApprovalWorkspaceStatus =
  | "awaiting_reviewer"
  | "in_review"
  | "decision_made"
  | "approval_expired"
  | "snapshot_invalidated";

// ── Workspace Mode ──
export type FireApprovalWorkspaceMode =
  | "evidence_review"
  | "policy_review"
  | "risk_assessment"
  | "decision_entry"
  | "post_decision_summary";

// ── Center Panel Section ──
export type FireApprovalCenterSection =
  | "action_summary"
  | "payload_snapshot"
  | "policy_constraint_results"
  | "risk_tier_explanation"
  | "previous_approvals"
  | "decision_form";

// ── Rail Section ──
export type FireApprovalRailSection =
  | "object_snapshot"
  | "approval_history"
  | "policy_evidence"
  | "audit_trail";

// ── Center Panel State ──
export interface FireApprovalCenterPanelState {
  activeSections: FireApprovalCenterSection[];
  actionSummary: {
    actionKey: StageActionKey;
    riskTier: ActionRiskTier;
    caseId: string;
    requestedBy: string;
    requestedAt: string;
    affectedLineCount: number;
    totalAmount: number;
    whyApprovalNeeded: string;
    whySelfApprovalBlocked: string;
  };
  policyConstraintResults: Array<{
    constraintKey: string;
    status: "pass" | "warning" | "block";
    reason: string;
  }>;
  riskTierExplanation: string;
  payloadHashSummary: {
    hashAtApprovalTime: FirePayloadHash | null;
    hashCurrent: FirePayloadHash;
    match: boolean;
    mismatchDetail: string;
  };
}

// ── Rail Panel State ──
export interface FireApprovalRailPanelState {
  activeSections: FireApprovalRailSection[];
  objectSnapshotSummary: string;
  approvalHistory: Array<{
    actorId: string;
    role: ProcurementRole;
    decision: string;
    reason: string;
    timestamp: string;
  }>;
  policyEvidence: string[];
  auditTrail: string[];
}

// ── Dock Actions ──
export interface FireApprovalDockState {
  canApprove: boolean;
  canReject: boolean;
  canEscalate: boolean;
  canRequestChange: boolean;
  approveLabel: string;
  rejectLabel: string;
  escalateLabel: string;
  requestChangeLabel: string;
  blockerSummary: string[];
}

// ── Workspace State ──
export interface FireApprovalWorkspaceStateV2 {
  workspaceId: string;
  caseId: string;
  fireSessionId: string;
  gateId: string;
  workbenchId: string | null;
  workspaceStatus: FireApprovalWorkspaceStatus;
  workspaceMode: FireApprovalWorkspaceMode;
  centerPanel: FireApprovalCenterPanelState;
  railPanel: FireApprovalRailPanelState;
  dock: FireApprovalDockState;
  reviewer: { actorId: string; roles: ProcurementRole[] };
  generatedAt: string;
}

// ── Build Workspace ──
export function buildFireApprovalWorkspaceStateV2(
  gate: FireApprovalGateV2,
  workbench: ApprovalWorkbenchStateV2 | null,
  reviewer: ActorContext,
  payloadHashCurrent: FirePayloadHash,
): FireApprovalWorkspaceStateV2 {
  const evidence = workbench?.evidence;
  const decision = workbench?.decision;

  // Determine workspace status
  let status: FireApprovalWorkspaceStatus;
  let mode: FireApprovalWorkspaceMode;

  if (gate.gateStatus === "approval_snapshot_invalid") {
    status = "snapshot_invalidated";
    mode = "evidence_review";
  } else if (decision) {
    status = "decision_made";
    mode = "post_decision_summary";
  } else if (workbench?.workbenchStatus === "in_review") {
    status = "in_review";
    mode = "evidence_review";
  } else {
    status = "awaiting_reviewer";
    mode = "evidence_review";
  }

  // Center panel
  const centerPanel: FireApprovalCenterPanelState = {
    activeSections: ["action_summary", "payload_snapshot", "policy_constraint_results", "risk_tier_explanation", "decision_form"],
    actionSummary: {
      actionKey: gate.actionKey,
      riskTier: evidence?.riskTier || "tier3_irreversible",
      caseId: gate.caseId,
      requestedBy: evidence?.requestedBy || "",
      requestedAt: evidence?.requestedAt || "",
      affectedLineCount: evidence?.affectedLineCount || 0,
      totalAmount: evidence?.totalAmount || 0,
      whyApprovalNeeded: evidence?.whyApprovalNeeded || "Fire execution requires approval",
      whySelfApprovalBlocked: evidence?.whySelfApprovalBlocked || "Tier 3 irreversible — self-approve blocked",
    },
    policyConstraintResults: evidence?.approvalRequirement.policySnapshot.map(p => ({
      constraintKey: p.constraintKey,
      status: p.status,
      reason: p.reason,
    })) || [],
    riskTierExplanation: "Tier 3 irreversible action — 발송 실행 후 취소 불가. 별도 승인자의 명시적 승인 필수.",
    payloadHashSummary: {
      hashAtApprovalTime: gate.payloadHashAtApproval,
      hashCurrent: payloadHashCurrent,
      match: gate.payloadHashMatch,
      mismatchDetail: gate.payloadHashMatch ? "" : "승인 이후 원본 payload가 변경됨 — 재승인 필요",
    },
  };

  // Rail panel
  const railPanel: FireApprovalRailPanelState = {
    activeSections: ["object_snapshot", "approval_history", "policy_evidence", "audit_trail"],
    objectSnapshotSummary: evidence?.objectSnapshotSummary || "",
    approvalHistory: decision ? [{
      actorId: decision.decidedBy,
      role: decision.decidedByRole,
      decision: decision.decision,
      reason: decision.decisionReason,
      timestamp: decision.decidedAt,
    }] : [],
    policyEvidence: evidence?.policyConstraintSummary || [],
    auditTrail: [],
  };

  // Dock
  const canApprove = workbench?.canApprove ?? false;
  const canReject = workbench?.canReject ?? false;
  const canEscalate = workbench?.canEscalate ?? true;
  const canRequestChange = workbench?.canRequestChange ?? false;

  const dock: FireApprovalDockState = {
    canApprove: canApprove && gate.payloadHashMatch,
    canReject,
    canEscalate,
    canRequestChange: canRequestChange || !gate.payloadHashMatch,
    approveLabel: "발송 승인",
    rejectLabel: "발송 거부",
    escalateLabel: "상위 승인자 에스컬레이션",
    requestChangeLabel: gate.payloadHashMatch ? "수정 요청" : "Payload 변경됨 — 재검토 필요",
    blockerSummary: [
      ...gate.preconditionResults.filter(p => !p.passed && p.blockingLevel === "hard_blocker").map(p => p.reason),
      ...(workbench?.blockerSummary || []),
    ],
  };

  return {
    workspaceId: `fireappws_${Date.now().toString(36)}`,
    caseId: gate.caseId,
    fireSessionId: gate.fireSessionId,
    gateId: gate.gateId,
    workbenchId: workbench?.workbenchId || null,
    workspaceStatus: status,
    workspaceMode: mode,
    centerPanel,
    railPanel,
    dock,
    reviewer: { actorId: reviewer.actorId, roles: reviewer.roles },
    generatedAt: new Date().toISOString(),
  };
}

// ── Events ──
export type FireApprovalWorkspaceEventType =
  | "fire_approval_workspace_opened"
  | "fire_approval_evidence_reviewed"
  | "fire_approval_policy_reviewed"
  | "fire_approval_risk_assessed"
  | "fire_approval_decision_entered"
  | "fire_approval_workspace_closed";

export interface FireApprovalWorkspaceEvent {
  type: FireApprovalWorkspaceEventType;
  caseId: string;
  workspaceId: string;
  fireSessionId: string;
  actorId: string;
  timestamp: string;
}
