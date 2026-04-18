/**
 * Exception Recovery Approval Workspace v2
 *
 * center = exception detail + recovery plan + risk assessment
 * rail = affected lines + return target validation + ALLOWED_RETURN_TARGETS evidence
 * dock = approve recovery / reject / escalate / request change
 *
 * WORKSPACE CONTRACT:
 * - 읽기 전용 surface
 * - exception_resolve: severity + recovery action + affected scope
 * - exception_return_to_stage: return target + bypass risk + allowed matrix evidence
 */

import type { ExceptionApprovalGateV2, ExceptionPayloadHash } from "./exception-approval-handoff-gate-v2-engine";
import type { DispatchExceptionRecordV2, ExceptionSourceStage, RecoveryAction } from "./dispatch-exception-recovery-v2-engine";
import type { ApprovalWorkbenchStateV2 } from "./dispatch-v2-approval-workbench-engine";
import type { ActorContext, ProcurementRole, ActionRiskTier, StageActionKey } from "./dispatch-v2-permission-policy-engine";

// ── Workspace Status ──
export type ExceptionApprovalWorkspaceStatus =
  | "awaiting_reviewer"
  | "in_review"
  | "decision_made"
  | "approval_expired"
  | "snapshot_invalidated"
  | "return_target_blocked";

// ── Workspace Mode ──
export type ExceptionApprovalWorkspaceMode =
  | "exception_evidence_review"
  | "recovery_plan_review"
  | "return_target_validation"
  | "bypass_risk_assessment"
  | "decision_entry"
  | "post_decision_summary";

// ── Center Panel ──
export interface ExceptionApprovalCenterPanelState {
  actionSummary: {
    actionKey: StageActionKey;
    targetAction: "exception_resolve" | "exception_return_to_stage";
    riskTier: ActionRiskTier;
    caseId: string;
    exceptionRecordId: string;
    requestedBy: string;
    requestedAt: string;
    whyApprovalNeeded: string;
  };
  exceptionDetail: {
    sourceStage: ExceptionSourceStage;
    exceptionType: string;
    severity: string;
    detail: string;
    affectedLineCount: number;
  };
  recoveryPlan: {
    recoveryAction: RecoveryAction | null;
    recoveryReason: string;
    returnToStage: ExceptionSourceStage | null;
    returnTargetAllowed: boolean;
    allowedTargetsFromSource: ExceptionSourceStage[];
    bypassRisk: string;
  };
  policyConstraintResults: Array<{
    constraintKey: string;
    status: "pass" | "warning" | "block";
    reason: string;
  }>;
}

// ── Rail Panel ──
export interface ExceptionApprovalRailPanelState {
  affectedLines: string[];
  returnTargetMatrix: {
    sourceStage: ExceptionSourceStage;
    allowedTargets: ExceptionSourceStage[];
    requestedTarget: ExceptionSourceStage | null;
    targetValidated: boolean;
  };
  auditTrail: Array<{
    action: string;
    actor: string;
    timestamp: string;
    detail: string;
  }>;
  approvalHistory: Array<{
    actorId: string;
    role: ProcurementRole;
    decision: string;
    reason: string;
    timestamp: string;
  }>;
}

// ── Dock ──
export interface ExceptionApprovalDockState {
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
export interface ExceptionApprovalWorkspaceStateV2 {
  workspaceId: string;
  caseId: string;
  exceptionRecordId: string;
  gateId: string;
  workbenchId: string | null;
  workspaceStatus: ExceptionApprovalWorkspaceStatus;
  workspaceMode: ExceptionApprovalWorkspaceMode;
  centerPanel: ExceptionApprovalCenterPanelState;
  railPanel: ExceptionApprovalRailPanelState;
  dock: ExceptionApprovalDockState;
  reviewer: { actorId: string; roles: ProcurementRole[] };
  generatedAt: string;
}

// ── ALLOWED_RETURN_TARGETS (for rail display) ──
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

// ── Build Workspace ──
export function buildExceptionApprovalWorkspaceStateV2(
  gate: ExceptionApprovalGateV2,
  record: DispatchExceptionRecordV2,
  workbench: ApprovalWorkbenchStateV2 | null,
  reviewer: ActorContext,
): ExceptionApprovalWorkspaceStateV2 {
  const evidence = workbench?.evidence;
  const decision = workbench?.decision;
  const allowedTargets = ALLOWED_RETURN_TARGETS[record.sourceStage] || [];
  const returnTargetAllowed = record.returnToStage ? allowedTargets.includes(record.returnToStage) : true;

  let status: ExceptionApprovalWorkspaceStatus;
  let mode: ExceptionApprovalWorkspaceMode;

  if (gate.gateStatus === "return_target_disallowed") {
    status = "return_target_blocked"; mode = "return_target_validation";
  } else if (gate.gateStatus === "approval_snapshot_invalid") {
    status = "snapshot_invalidated"; mode = "exception_evidence_review";
  } else if (decision) {
    status = "decision_made"; mode = "post_decision_summary";
  } else if (workbench?.workbenchStatus === "in_review") {
    status = "in_review"; mode = "exception_evidence_review";
  } else {
    status = "awaiting_reviewer"; mode = "exception_evidence_review";
  }

  const bypassRisk = gate.targetAction === "exception_return_to_stage"
    ? `Return to ${record.returnToStage} — mandatory gate를 건너뛸 수 있으므로 승인 필수`
    : "Exception resolve — 복구 완료 처리";

  const centerPanel: ExceptionApprovalCenterPanelState = {
    actionSummary: {
      actionKey: gate.actionKey,
      targetAction: gate.targetAction,
      riskTier: evidence?.riskTier || "tier3_irreversible",
      caseId: gate.caseId,
      exceptionRecordId: record.exceptionRecordId,
      requestedBy: evidence?.requestedBy || record.detectedBy,
      requestedAt: evidence?.requestedAt || record.detectedAt,
      whyApprovalNeeded: evidence?.whyApprovalNeeded || `Tier 3 irreversible — ${gate.targetAction} 승인 필요`,
    },
    exceptionDetail: {
      sourceStage: record.sourceStage,
      exceptionType: record.exceptionType,
      severity: record.severity,
      detail: record.exceptionDetail,
      affectedLineCount: record.affectedLineSet.length,
    },
    recoveryPlan: {
      recoveryAction: record.recoveryAction,
      recoveryReason: record.recoveryReason,
      returnToStage: record.returnToStage,
      returnTargetAllowed,
      allowedTargetsFromSource: allowedTargets,
      bypassRisk,
    },
    policyConstraintResults: evidence?.approvalRequirement.policySnapshot.map(p => ({
      constraintKey: p.constraintKey,
      status: p.status,
      reason: p.reason,
    })) || [],
  };

  const railPanel: ExceptionApprovalRailPanelState = {
    affectedLines: record.affectedLineSet,
    returnTargetMatrix: {
      sourceStage: record.sourceStage,
      allowedTargets,
      requestedTarget: record.returnToStage,
      targetValidated: returnTargetAllowed,
    },
    auditTrail: record.auditTrail.map(a => ({
      action: a.action, actor: a.actor, timestamp: a.timestamp, detail: a.detail,
    })),
    approvalHistory: decision ? [{
      actorId: decision.decidedBy, role: decision.decidedByRole,
      decision: decision.decision, reason: decision.decisionReason,
      timestamp: decision.decidedAt,
    }] : [],
  };

  const canApprove = (workbench?.canApprove ?? false) && gate.payloadHashMatch && returnTargetAllowed;
  const dock: ExceptionApprovalDockState = {
    canApprove,
    canReject: workbench?.canReject ?? false,
    canEscalate: workbench?.canEscalate ?? true,
    canRequestChange: (workbench?.canRequestChange ?? false) || !gate.payloadHashMatch || !returnTargetAllowed,
    approveLabel: gate.targetAction === "exception_return_to_stage" ? `${record.returnToStage}로 복귀 승인` : "Exception 해결 승인",
    rejectLabel: "복구 거부",
    escalateLabel: "상위 승인자 에스컬레이션",
    requestChangeLabel: !returnTargetAllowed ? "Return target 변경 필요" : !gate.payloadHashMatch ? "Payload 변경됨 — 재검토 필요" : "수정 요청",
    blockerSummary: gate.preconditionResults.filter(p => !p.passed && p.blockingLevel === "hard_blocker").map(p => p.reason),
  };

  return {
    workspaceId: `excappws_${Date.now().toString(36)}`,
    caseId: gate.caseId,
    exceptionRecordId: record.exceptionRecordId,
    gateId: gate.gateId,
    workbenchId: workbench?.workbenchId || null,
    workspaceStatus: status, workspaceMode: mode,
    centerPanel, railPanel, dock,
    reviewer: { actorId: reviewer.actorId, roles: reviewer.roles },
    generatedAt: new Date().toISOString(),
  };
}

// ── Events ──
export type ExceptionApprovalWorkspaceEventType = "exception_approval_workspace_opened" | "exception_approval_evidence_reviewed" | "exception_approval_decision_entered" | "exception_approval_workspace_closed";
export interface ExceptionApprovalWorkspaceEvent { type: ExceptionApprovalWorkspaceEventType; caseId: string; workspaceId: string; exceptionRecordId: string; actorId: string; timestamp: string; }
