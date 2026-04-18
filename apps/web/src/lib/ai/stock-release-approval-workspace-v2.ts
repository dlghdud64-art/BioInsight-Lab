/**
 * Stock Release Approval Workspace v2 — approval review surface for stock release
 *
 * center = 승인 판단 (release evidence + location/qty + policy)
 * rail = disposition snapshot + release line details + policy constraint results
 * dock = approve / reject / escalate / request_change
 *
 * WORKSPACE CONTRACT:
 * - input: StockReleaseApprovalGateV2 + ApprovalWorkbenchStateV2 + release session snapshot
 * - output: StockReleaseApprovalWorkspaceStateV2 (render-ready surface state)
 * - 읽기 전용 surface — mutation은 stock-release-approval-resolution에서만
 */

import type { StockReleaseApprovalGateV2, ReleasePayloadHash } from "./stock-release-approval-handoff-gate-v2-engine";
import type { ApprovalWorkbenchStateV2 } from "./dispatch-v2-approval-workbench-engine";
import type { ActorContext, ProcurementRole, ActionRiskTier, StageActionKey } from "./dispatch-v2-permission-policy-engine";

// ── Workspace Status ──
export type StockReleaseApprovalWorkspaceStatus =
  | "awaiting_reviewer"
  | "in_review"
  | "decision_made"
  | "approval_expired"
  | "snapshot_invalidated";

// ── Workspace Mode ──
export type StockReleaseApprovalWorkspaceMode =
  | "release_evidence_review"
  | "location_verification"
  | "policy_review"
  | "decision_entry"
  | "post_decision_summary";

// ── Center Panel ──
export interface StockReleaseApprovalCenterPanelState {
  actionSummary: {
    actionKey: StageActionKey;
    riskTier: ActionRiskTier;
    caseId: string;
    requestedBy: string;
    requestedAt: string;
    totalReleasableQty: number;
    totalLineCount: number;
    whyApprovalNeeded: string;
  };
  releaseLineSummary: Array<{
    lineId: string;
    releasableQty: number;
    locationAssigned: string;
    binAssigned: string;
    releaseStatus: string;
  }>;
  policyConstraintResults: Array<{
    constraintKey: string;
    status: "pass" | "warning" | "block";
    reason: string;
  }>;
  payloadHashSummary: {
    hashAtApprovalTime: ReleasePayloadHash | null;
    hashCurrent: ReleasePayloadHash;
    match: boolean;
    mismatchDetail: string;
  };
}

// ── Rail Panel ──
export interface StockReleaseApprovalRailPanelState {
  dispositionSnapshotSummary: string;
  locationVerificationNotes: string[];
  approvalHistory: Array<{
    actorId: string;
    role: ProcurementRole;
    decision: string;
    reason: string;
    timestamp: string;
  }>;
  auditTrail: string[];
}

// ── Dock ──
export interface StockReleaseApprovalDockState {
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
export interface StockReleaseApprovalWorkspaceStateV2 {
  workspaceId: string;
  caseId: string;
  releaseSessionId: string;
  gateId: string;
  workbenchId: string | null;
  workspaceStatus: StockReleaseApprovalWorkspaceStatus;
  workspaceMode: StockReleaseApprovalWorkspaceMode;
  centerPanel: StockReleaseApprovalCenterPanelState;
  railPanel: StockReleaseApprovalRailPanelState;
  dock: StockReleaseApprovalDockState;
  reviewer: { actorId: string; roles: ProcurementRole[] };
  generatedAt: string;
}

// ── Build Workspace ──
export function buildStockReleaseApprovalWorkspaceStateV2(
  gate: StockReleaseApprovalGateV2,
  workbench: ApprovalWorkbenchStateV2 | null,
  reviewer: ActorContext,
  releaseLines: Array<{ lineId: string; releasableQty: number; locationAssigned: string; binAssigned: string; releaseStatus: string }>,
  payloadHashCurrent: ReleasePayloadHash,
): StockReleaseApprovalWorkspaceStateV2 {
  const evidence = workbench?.evidence;
  const decision = workbench?.decision;

  let status: StockReleaseApprovalWorkspaceStatus;
  let mode: StockReleaseApprovalWorkspaceMode;

  if (gate.gateStatus === "approval_snapshot_invalid") {
    status = "snapshot_invalidated"; mode = "release_evidence_review";
  } else if (decision) {
    status = "decision_made"; mode = "post_decision_summary";
  } else if (workbench?.workbenchStatus === "in_review") {
    status = "in_review"; mode = "release_evidence_review";
  } else {
    status = "awaiting_reviewer"; mode = "release_evidence_review";
  }

  const centerPanel: StockReleaseApprovalCenterPanelState = {
    actionSummary: {
      actionKey: gate.actionKey,
      riskTier: evidence?.riskTier || "tier3_irreversible",
      caseId: gate.caseId,
      requestedBy: evidence?.requestedBy || "",
      requestedAt: evidence?.requestedAt || "",
      totalReleasableQty: releaseLines.reduce((s, l) => s + l.releasableQty, 0),
      totalLineCount: releaseLines.length,
      whyApprovalNeeded: evidence?.whyApprovalNeeded || "Stock release requires approval",
    },
    releaseLineSummary: releaseLines,
    policyConstraintResults: evidence?.approvalRequirement.policySnapshot.map(p => ({
      constraintKey: p.constraintKey,
      status: p.status,
      reason: p.reason,
    })) || [],
    payloadHashSummary: {
      hashAtApprovalTime: gate.payloadHashAtApproval,
      hashCurrent: payloadHashCurrent,
      match: gate.payloadHashMatch,
      mismatchDetail: gate.payloadHashMatch ? "" : "승인 이후 release payload가 변경됨 — 재승인 필요",
    },
  };

  const railPanel: StockReleaseApprovalRailPanelState = {
    dispositionSnapshotSummary: evidence?.objectSnapshotSummary || "",
    locationVerificationNotes: [],
    approvalHistory: decision ? [{
      actorId: decision.decidedBy, role: decision.decidedByRole,
      decision: decision.decision, reason: decision.decisionReason,
      timestamp: decision.decidedAt,
    }] : [],
    auditTrail: [],
  };

  const dock: StockReleaseApprovalDockState = {
    canApprove: (workbench?.canApprove ?? false) && gate.payloadHashMatch,
    canReject: workbench?.canReject ?? false,
    canEscalate: workbench?.canEscalate ?? true,
    canRequestChange: (workbench?.canRequestChange ?? false) || !gate.payloadHashMatch,
    approveLabel: "재고 릴리스 승인",
    rejectLabel: "릴리스 거부",
    escalateLabel: "상위 승인자 에스컬레이션",
    requestChangeLabel: gate.payloadHashMatch ? "수정 요청" : "Payload 변경됨 — 재검토 필요",
    blockerSummary: [
      ...gate.preconditionResults.filter(p => !p.passed && p.blockingLevel === "hard_blocker").map(p => p.reason),
      ...(workbench?.blockerSummary || []),
    ],
  };

  return {
    workspaceId: `stkrlsappws_${Date.now().toString(36)}`,
    caseId: gate.caseId,
    releaseSessionId: gate.releaseSessionId,
    gateId: gate.gateId,
    workbenchId: workbench?.workbenchId || null,
    workspaceStatus: status, workspaceMode: mode,
    centerPanel, railPanel, dock,
    reviewer: { actorId: reviewer.actorId, roles: reviewer.roles },
    generatedAt: new Date().toISOString(),
  };
}

// ── Events ──
export type StockReleaseApprovalWorkspaceEventType =
  | "stock_release_approval_workspace_opened"
  | "stock_release_approval_evidence_reviewed"
  | "stock_release_approval_decision_entered"
  | "stock_release_approval_workspace_closed";

export interface StockReleaseApprovalWorkspaceEvent {
  type: StockReleaseApprovalWorkspaceEventType;
  caseId: string; workspaceId: string; releaseSessionId: string;
  actorId: string; timestamp: string;
}
