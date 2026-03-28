/**
 * Ownership Governance Loop Closure Engine
 *
 * Dashboard Panels → Review Workbench → Remediation → Execution Queue → Audit Closure
 * 전체 ownership governance 루프를 끊기지 않게 연결.
 *
 * HANDOFF MAP:
 * - OwnerBacklogPanel → owner detail → reassign review workbench
 * - OwnerlessHotspotPanel → assign flow → governance review
 * - OverloadedOwnerPanel → redistribute → execution queue
 * - OwnershipCoverageCard → fill gaps → conflict remediation
 * - ConflictDetection → remediation action → review → execute → audit close
 *
 * INVALIDATION AFTER GOVERNANCE ACTIONS:
 * - ownership change applied → owner panels + coverage + recommended actions
 * - conflict remediated → conflict panel + affected owner panels
 * - execution completed → execution status + owner panels + audit closure status
 * - audit closed → audit panel + rollout history
 * - reverted → all ownership panels + execution + audit reopen
 */

import type { ApprovalDomain } from "./approval-inbox-projection-v2-engine";
import type { OwnershipType } from "./multi-team-ownership-engine";
import type { OwnershipChangeStatus } from "./ownership-governance-lifecycle-engine";
import type { ExecutionStatus } from "./approval-execution-queue-engine";

// ══════════════════════════════════════════════
// Governance Handoff Link
// ══════════════════════════════════════════════

export type GovernanceHandoffTarget =
  | "review_workbench"
  | "conflict_remediation"
  | "execution_queue"
  | "audit_closure"
  | "ownership_authoring"
  | "simulation_preview"
  | "dashboard_panel";

export interface GovernanceHandoffLink {
  linkId: string;
  sourcePanel: string;
  sourceItemId: string;
  target: GovernanceHandoffTarget;
  targetId: string | null;
  href: string;
  label: string;
  context: Record<string, string>;
  urgency: "immediate" | "soon" | "scheduled";
}

// ══════════════════════════════════════════════
// Panel → Governance Flow Links
// ══════════════════════════════════════════════

export function buildOwnerBacklogHandoff(
  ownerId: string,
  ownerName: string,
  loadScore: number,
): GovernanceHandoffLink[] {
  const links: GovernanceHandoffLink[] = [];

  if (loadScore >= 80) {
    links.push({
      linkId: `hoff_backlog_reassign_${ownerId}`,
      sourcePanel: "owner_backlog", sourceItemId: ownerId,
      target: "review_workbench", targetId: null,
      href: `/dashboard/approval/governance/review?action=reassign&from=${ownerId}`,
      label: `${ownerName} 재배정 검토`,
      context: { ownerId, loadScore: String(loadScore) },
      urgency: "immediate",
    });
    links.push({
      linkId: `hoff_backlog_sim_${ownerId}`,
      sourcePanel: "owner_backlog", sourceItemId: ownerId,
      target: "simulation_preview", targetId: null,
      href: `/dashboard/approval/governance/simulation?from=${ownerId}`,
      label: "재배정 영향 시뮬레이션",
      context: { ownerId },
      urgency: "immediate",
    });
  }

  return links;
}

export function buildOwnerlessHandoff(
  unassignedCount: number,
  urgentCount: number,
  domains: ApprovalDomain[],
): GovernanceHandoffLink[] {
  if (unassignedCount === 0) return [];

  const links: GovernanceHandoffLink[] = [{
    linkId: "hoff_ownerless_assign",
    sourcePanel: "ownerless_hotspot", sourceItemId: "ownerless",
    target: "ownership_authoring", targetId: null,
    href: "/dashboard/approval/governance/ownership?action=assign",
    label: `${unassignedCount}건 담당자 배정`,
    context: { count: String(unassignedCount), urgent: String(urgentCount), domains: domains.join(",") },
    urgency: urgentCount > 0 ? "immediate" : "soon",
  }];

  if (unassignedCount > 3) {
    links.push({
      linkId: "hoff_ownerless_review",
      sourcePanel: "ownerless_hotspot", sourceItemId: "ownerless",
      target: "review_workbench", targetId: null,
      href: "/dashboard/approval/governance/review?type=bulk_assign",
      label: "일괄 배정 검토",
      context: { count: String(unassignedCount) },
      urgency: "immediate",
    });
  }

  return links;
}

export function buildOverloadedHandoff(
  ownerId: string,
  ownerName: string,
  excessCount: number,
): GovernanceHandoffLink[] {
  return [{
    linkId: `hoff_overload_redistribute_${ownerId}`,
    sourcePanel: "overloaded_owner", sourceItemId: ownerId,
    target: "execution_queue", targetId: null,
    href: `/dashboard/approval/governance/execution?action=redistribute&from=${ownerId}`,
    label: `${ownerName} → ${excessCount}건 재분배 실행`,
    context: { ownerId, excessCount: String(excessCount) },
    urgency: "immediate",
  }, {
    linkId: `hoff_overload_sim_${ownerId}`,
    sourcePanel: "overloaded_owner", sourceItemId: ownerId,
    target: "simulation_preview", targetId: null,
    href: `/dashboard/approval/governance/simulation?redistribute=${ownerId}`,
    label: "재분배 영향 미리보기",
    context: { ownerId },
    urgency: "immediate",
  }];
}

export function buildConflictRemediationHandoff(
  conflictId: string,
  conflictType: string,
  severity: string,
): GovernanceHandoffLink[] {
  return [{
    linkId: `hoff_conflict_${conflictId}`,
    sourcePanel: "conflict_detection", sourceItemId: conflictId,
    target: "conflict_remediation", targetId: conflictId,
    href: `/dashboard/approval/governance/remediation?conflict=${conflictId}`,
    label: `${conflictType} 수정`,
    context: { conflictId, severity },
    urgency: severity === "critical" ? "immediate" : "soon",
  }];
}

// ══════════════════════════════════════════════
// Governance Action → Invalidation
// ══════════════════════════════════════════════

export type GovernancePanelTarget =
  | "owner_backlog"
  | "ownerless_hotspot"
  | "overloaded_owner"
  | "ownership_coverage"
  | "conflict_panel"
  | "execution_status"
  | "audit_closure_status"
  | "recommended_actions"
  | "rollout_history"
  | "all_ownership_panels";

export interface GovernanceInvalidationRule {
  trigger: string;
  invalidates: GovernancePanelTarget[];
  description: string;
}

export const GOVERNANCE_INVALIDATION_RULES: GovernanceInvalidationRule[] = [
  {
    trigger: "ownership_change_applied",
    invalidates: ["owner_backlog", "ownership_coverage", "recommended_actions", "ownerless_hotspot", "overloaded_owner"],
    description: "Ownership 변경 적용 → owner panels + coverage 갱신",
  },
  {
    trigger: "conflict_remediated",
    invalidates: ["conflict_panel", "owner_backlog", "ownership_coverage"],
    description: "충돌 수정 → conflict panel + 영향 owner panels 갱신",
  },
  {
    trigger: "execution_completed",
    invalidates: ["execution_status", "owner_backlog", "ownership_coverage", "audit_closure_status"],
    description: "실행 완료 → execution + owner + audit 갱신",
  },
  {
    trigger: "execution_partial_failure",
    invalidates: ["execution_status", "owner_backlog", "conflict_panel"],
    description: "부분 실패 → execution + 실패 scope conflict 재탐지",
  },
  {
    trigger: "audit_closed",
    invalidates: ["audit_closure_status", "rollout_history"],
    description: "감사 폐쇄 → audit + rollout history 갱신",
  },
  {
    trigger: "ownership_reverted",
    invalidates: ["all_ownership_panels"],
    description: "롤백 → 모든 ownership panel 전체 갱신",
  },
  {
    trigger: "simulation_completed",
    invalidates: ["recommended_actions"],
    description: "시뮬레이션 → 추천 액션 재계산",
  },
];

export function getInvalidationTargets(trigger: string): GovernancePanelTarget[] {
  const rule = GOVERNANCE_INVALIDATION_RULES.find(r => r.trigger === trigger);
  if (!rule) return [];
  if (rule.invalidates.includes("all_ownership_panels")) {
    return ["owner_backlog", "ownerless_hotspot", "overloaded_owner", "ownership_coverage", "conflict_panel", "execution_status", "audit_closure_status", "recommended_actions", "rollout_history"];
  }
  return rule.invalidates;
}

// ══════════════════════════════════════════════
// Full Loop State
// ══════════════════════════════════════════════

export interface GovernanceLoopState {
  // Current step in the loop
  currentStep: "dashboard" | "review" | "remediation" | "execution" | "audit_closure" | "completed";
  // Change request being processed
  activeChangeRequestId: string | null;
  activeChangeRequestStatus: OwnershipChangeStatus | null;
  // Execution
  activeExecutionId: string | null;
  executionStatus: ExecutionStatus | null;
  // Audit
  auditClosed: boolean;
  // Navigation
  returnToDashboardPanel: string | null;
  handoffHistory: GovernanceHandoffLink[];
}

export function createGovernanceLoopState(): GovernanceLoopState {
  return {
    currentStep: "dashboard",
    activeChangeRequestId: null, activeChangeRequestStatus: null,
    activeExecutionId: null, executionStatus: null,
    auditClosed: false,
    returnToDashboardPanel: null,
    handoffHistory: [],
  };
}

export type GovernanceLoopEvent =
  | { type: "enter_review"; changeRequestId: string; fromPanel: string }
  | { type: "enter_remediation"; conflictId: string }
  | { type: "enter_execution"; executionId: string }
  | { type: "enter_audit"; rolloutId: string }
  | { type: "step_completed"; step: GovernanceLoopState["currentStep"] }
  | { type: "return_to_dashboard" }
  | { type: "loop_completed" };

export function applyGovernanceLoopEvent(
  state: GovernanceLoopState,
  event: GovernanceLoopEvent,
): GovernanceLoopState {
  let u = { ...state };

  switch (event.type) {
    case "enter_review":
      u.currentStep = "review";
      u.activeChangeRequestId = event.changeRequestId;
      u.returnToDashboardPanel = event.fromPanel;
      break;
    case "enter_remediation":
      u.currentStep = "remediation";
      break;
    case "enter_execution":
      u.currentStep = "execution";
      u.activeExecutionId = event.executionId;
      break;
    case "enter_audit":
      u.currentStep = "audit_closure";
      break;
    case "step_completed":
      // Advance to next step
      const ORDER: GovernanceLoopState["currentStep"][] = ["dashboard", "review", "remediation", "execution", "audit_closure", "completed"];
      const currentIdx = ORDER.indexOf(u.currentStep);
      if (currentIdx < ORDER.length - 1) u.currentStep = ORDER[currentIdx + 1];
      break;
    case "return_to_dashboard":
      u.currentStep = "dashboard";
      break;
    case "loop_completed":
      u.currentStep = "completed";
      u.auditClosed = true;
      break;
  }

  return u;
}
