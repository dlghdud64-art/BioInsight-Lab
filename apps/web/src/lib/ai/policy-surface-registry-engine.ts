/**
 * Policy Surface Registry Engine — 전체 workspace에 policy language 일관 적용
 *
 * 모든 operator workspace에서 동일한 policy surface를 보여주기 위한 registry.
 * 각 workspace는 자신의 actionKey로 이 registry에 질의하면
 * 해당 action의 permission/approval/policy/SoD 상태를 일관된 format으로 받음.
 *
 * ROLLOUT 대상:
 * - receiving_preparation: receiving_prep_manage
 * - receiving_execution: receiving_execution_record
 * - variance_disposition: variance_disposition_set
 * - stock_release: stock_release_execute
 * - reorder_trigger: reorder_trigger_evaluate
 * - procurement_reentry: (exception_return_to_stage)
 * - fire_execution: actual_send_fire_execute
 *
 * 각 workspace는 buildWorkspacePolicySurface()를 호출하면 됨.
 */

import {
  checkPermission,
  type ActorContext,
  type StageActionKey,
  type PolicyEvaluationContext,
  type PermissionCheckResult,
  type ProcurementRole,
  type ActionRiskTier,
} from "./dispatch-v2-permission-policy-engine";
import {
  buildApprovalPolicySurface,
  type ApprovalPolicySurfaceState,
} from "./approval-policy-surface-engine";
import type { ApprovalSnapshotV2 } from "./dispatch-v2-approval-workbench-engine";
import type { ConsumeGuardResult } from "./approval-snapshot-validator";

// ── Workspace Policy Surface Config ──
export interface WorkspacePolicySurfaceConfig {
  workspaceKey: string;
  actionKey: StageActionKey;
  label: string;
  description: string;
  riskContext: string;
}

// ── Registry: workspace → action mapping ──
const WORKSPACE_POLICY_REGISTRY: WorkspacePolicySurfaceConfig[] = [
  {
    workspaceKey: "receiving_preparation",
    actionKey: "receiving_prep_manage",
    label: "입고 준비",
    description: "입고 준비 작업 관리",
    riskContext: "입고 준비는 Tier 1 — 승인 없이 진행 가능",
  },
  {
    workspaceKey: "receiving_execution",
    actionKey: "receiving_execution_record",
    label: "입고 실행",
    description: "입고 수량/상태 기록",
    riskContext: "입고 실행은 Tier 1 — 정확한 수량/상태 기록 필수",
  },
  {
    workspaceKey: "variance_disposition",
    actionKey: "variance_disposition_set",
    label: "차이 처리",
    description: "입고 차이 처리 결정 (수용/반품/폐기/보류)",
    riskContext: "Tier 2 — variance 10% 초과 시 승인 필요",
  },
  {
    workspaceKey: "stock_release",
    actionKey: "stock_release_execute",
    label: "재고 릴리스",
    description: "처리 완료 재고를 가용 재고로 전환",
    riskContext: "Tier 3 irreversible — 릴리스 후 취소 불가. 별도 승인자 필수",
  },
  {
    workspaceKey: "reorder_trigger",
    actionKey: "reorder_trigger_evaluate",
    label: "재주문 평가",
    description: "재고 수준 기반 재주문 필요 여부 평가",
    riskContext: "Tier 1 — 평가는 자동, 실제 재구매는 별도 승인",
  },
  {
    workspaceKey: "fire_execution",
    actionKey: "actual_send_fire_execute",
    label: "발송 실행",
    description: "PO/견적 실제 발송 (irreversible)",
    riskContext: "Tier 3 irreversible — 발송 후 취소 불가. 별도 승인자 필수",
  },
  {
    workspaceKey: "exception_resolve",
    actionKey: "exception_resolve",
    label: "예외 해결",
    description: "예외 건 해결 처리",
    riskContext: "Tier 3 irreversible — 예외 해결은 감사 추적 필수",
  },
  {
    workspaceKey: "exception_return",
    actionKey: "exception_return_to_stage",
    label: "예외 복귀",
    description: "예외 건을 이전 단계로 복귀",
    riskContext: "Tier 3 irreversible — ALLOWED_RETURN_TARGETS 내에서만 가능. 승인 필수",
  },
  {
    workspaceKey: "supplier_ack_classify",
    actionKey: "supplier_ack_classify",
    label: "공급사 응답 분류",
    description: "공급사 응답 유형 분류 및 입고 준비 연결",
    riskContext: "Tier 2 — 분류 결과가 입고 흐름을 결정",
  },
  {
    workspaceKey: "delivery_tracking",
    actionKey: "delivery_tracking_manage",
    label: "배송 추적",
    description: "배송 상태 추적 및 예외 감지",
    riskContext: "Tier 1 — 추적은 조회 중심, 예외 시 별도 처리",
  },
];

// ── Build Workspace Policy Surface ──
export function buildWorkspacePolicySurface(
  workspaceKey: string,
  actor: ActorContext,
  caseId: string,
  policyContext: Partial<PolicyEvaluationContext> = {},
  snapshot: ApprovalSnapshotV2 | null = null,
  consumeGuardResult: ConsumeGuardResult | null = null,
): WorkspacePolicySurfaceResult {
  const config = WORKSPACE_POLICY_REGISTRY.find(w => w.workspaceKey === workspaceKey);
  if (!config) {
    return {
      found: false,
      workspaceKey,
      config: null,
      permissionResult: null,
      policySurface: null,
      inlineGuidance: {
        statusBadge: "unknown",
        statusColor: "slate",
        primaryMessage: `Unknown workspace: ${workspaceKey}`,
        blockerMessages: [],
        warningMessages: [],
        nextActionMessage: "",
        approverInfo: null,
      },
    };
  }

  const permissionResult = checkPermission(config.actionKey, actor, { caseId, ...policyContext });
  const policySurface = buildApprovalPolicySurface(caseId, permissionResult, snapshot, consumeGuardResult);

  // Build inline guidance for workspace header/strip
  const inlineGuidance = buildInlineGuidance(config, permissionResult, policySurface);

  return {
    found: true,
    workspaceKey,
    config,
    permissionResult,
    policySurface,
    inlineGuidance,
  };
}

// ── Result Type ──
export interface WorkspacePolicySurfaceResult {
  found: boolean;
  workspaceKey: string;
  config: WorkspacePolicySurfaceConfig | null;
  permissionResult: PermissionCheckResult | null;
  policySurface: ApprovalPolicySurfaceState | null;
  inlineGuidance: WorkspaceInlineGuidance;
}

// ── Inline Guidance (workspace header strip에 표시) ──
export interface WorkspaceInlineGuidance {
  statusBadge: "allowed" | "approval_needed" | "blocked" | "reapproval_needed" | "escalation_needed" | "unknown";
  statusColor: "emerald" | "blue" | "amber" | "red" | "slate";
  primaryMessage: string;
  blockerMessages: string[];
  warningMessages: string[];
  nextActionMessage: string;
  approverInfo: {
    requiredRole: ProcurementRole;
    selfApprovalAllowed: boolean;
    dualApprovalRequired: boolean;
  } | null;
}

function buildInlineGuidance(
  config: WorkspacePolicySurfaceConfig,
  perm: PermissionCheckResult,
  surface: ApprovalPolicySurfaceState,
): WorkspaceInlineGuidance {
  // Status badge
  let statusBadge: WorkspaceInlineGuidance["statusBadge"];
  let statusColor: WorkspaceInlineGuidance["statusColor"];
  let primaryMessage: string;

  if (surface.approvalStatus === "no_approval_needed" && perm.permitted) {
    statusBadge = "allowed";
    statusColor = "emerald";
    primaryMessage = `${config.label} — 바로 실행 가능`;
  } else if (surface.approvalStatus === "approval_granted") {
    statusBadge = "allowed";
    statusColor = "emerald";
    primaryMessage = `${config.label} — 승인 완료, 실행 가능`;
  } else if (surface.operatorGuidance.reapprovalNeeded) {
    statusBadge = "reapproval_needed";
    statusColor = "amber";
    primaryMessage = `${config.label} — 재승인 필요`;
  } else if (surface.hasBlockers) {
    statusBadge = "blocked";
    statusColor = "red";
    primaryMessage = `${config.label} — 정책 위반으로 차단`;
  } else if (perm.escalationRequired) {
    statusBadge = "escalation_needed";
    statusColor = "amber";
    primaryMessage = `${config.label} — 에스컬레이션 필요`;
  } else if (perm.requiresApproval) {
    statusBadge = "approval_needed";
    statusColor = "blue";
    primaryMessage = `${config.label} — ${perm.approvalRole || "approver"} 승인 필요`;
  } else {
    statusBadge = "allowed";
    statusColor = "emerald";
    primaryMessage = `${config.label} — 실행 가능`;
  }

  // Blocker/warning messages
  const blockerMessages = surface.policyBlockers.map(b => b.reason);
  const warningMessages = surface.policyWarnings.map(w => w.reason);

  // Next action
  const nextActionMessage = surface.operatorGuidance.nextAction;

  // Approver info
  let approverInfo: WorkspaceInlineGuidance["approverInfo"] = null;
  if (perm.requiresApproval && perm.approvalRole) {
    approverInfo = {
      requiredRole: perm.approvalRole,
      selfApprovalAllowed: perm.approvalRequirement.selfApprovalAllowed,
      dualApprovalRequired: perm.approvalRequirement.dualApprovalRequired,
    };
  }

  return {
    statusBadge, statusColor, primaryMessage,
    blockerMessages, warningMessages, nextActionMessage,
    approverInfo,
  };
}

// ── Get All Workspace Configs ──
export function getAllWorkspacePolicyConfigs(): WorkspacePolicySurfaceConfig[] {
  return [...WORKSPACE_POLICY_REGISTRY];
}

// ── Get Config by Key ──
export function getWorkspacePolicyConfig(workspaceKey: string): WorkspacePolicySurfaceConfig | null {
  return WORKSPACE_POLICY_REGISTRY.find(w => w.workspaceKey === workspaceKey) || null;
}

// ── Batch: Build surfaces for all workspaces (for dashboard/overview) ──
export function buildAllWorkspacePolicySurfaces(
  actor: ActorContext,
  caseId: string,
  policyContext: Partial<PolicyEvaluationContext> = {},
): WorkspacePolicySurfaceResult[] {
  return WORKSPACE_POLICY_REGISTRY.map(config =>
    buildWorkspacePolicySurface(config.workspaceKey, actor, caseId, policyContext)
  );
}

// ── Policy Surface Summary (for case-level overview) ──
export interface CasePolicySummary {
  caseId: string;
  totalWorkspaces: number;
  allowedCount: number;
  approvalNeededCount: number;
  blockedCount: number;
  reapprovalNeededCount: number;
  escalationNeededCount: number;
  workspaceSummaries: Array<{
    workspaceKey: string;
    label: string;
    statusBadge: WorkspaceInlineGuidance["statusBadge"];
    primaryMessage: string;
    blockerCount: number;
  }>;
  generatedAt: string;
}

export function buildCasePolicySummary(
  surfaces: WorkspacePolicySurfaceResult[],
  caseId: string,
): CasePolicySummary {
  const summaries = surfaces.map(s => ({
    workspaceKey: s.workspaceKey,
    label: s.config?.label || s.workspaceKey,
    statusBadge: s.inlineGuidance.statusBadge,
    primaryMessage: s.inlineGuidance.primaryMessage,
    blockerCount: s.inlineGuidance.blockerMessages.length,
  }));

  return {
    caseId,
    totalWorkspaces: surfaces.length,
    allowedCount: summaries.filter(s => s.statusBadge === "allowed").length,
    approvalNeededCount: summaries.filter(s => s.statusBadge === "approval_needed").length,
    blockedCount: summaries.filter(s => s.statusBadge === "blocked").length,
    reapprovalNeededCount: summaries.filter(s => s.statusBadge === "reapproval_needed").length,
    escalationNeededCount: summaries.filter(s => s.statusBadge === "escalation_needed").length,
    workspaceSummaries: summaries,
    generatedAt: new Date().toISOString(),
  };
}

// ── Events ──
export type PolicySurfaceEventType = "policy_surface_queried" | "policy_surface_blocker_shown" | "policy_surface_guidance_shown";
export interface PolicySurfaceEvent { type: PolicySurfaceEventType; workspaceKey: string; caseId: string; actionKey: StageActionKey; actorId: string; statusBadge: string; timestamp: string; }
