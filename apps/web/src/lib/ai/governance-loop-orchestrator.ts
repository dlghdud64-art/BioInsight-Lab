/**
 * Governance Loop Orchestrator — 발견→판단→실행→검증 4-surface 루프 완전 폐쇄
 *
 * Dashboard 발견 → Review/Remediation 판단 → Execution 실행 → Audit Closure 검증
 * → Dashboard 반영. 같은 context로 끊기지 않게 이어짐.
 *
 * 새 엔진 추가 없이 existing governance substrate 위에서 orchestration만 추가.
 *
 * CORE CONTRACTS:
 * 1. GovernanceLoopContext — panel origin + filter + scope 보존
 * 2. startGovernanceLoopFromPanel — panel click → review workbench entry
 * 3. closeGovernanceLoop — resolved/partial/reverted/scheduled별 closure
 * 4. resumeGovernanceLoop — partial failure/audit incomplete에서 복귀
 * 5. evaluateEffectiveDateTransitions — 시간 경과 → 상태 갱신
 * 6. Cross-governance shared grammar — ownership/policy 동일 표현
 */

import type { ApprovalDomain } from "./approval-inbox-projection-v2-engine";
import type { OwnershipType } from "./multi-team-ownership-engine";
import type { GovernancePanelTarget } from "./ownership-governance-loop-closure-engine";

// ══════════════════════════════════════════════
// 1. GovernanceLoopContext — panel origin 전체 보존
// ══════════════════════════════════════════════

export interface GovernanceLoopContext {
  contextId: string;
  // Origin
  sourcePanel: string;
  sourceEntityType: "ownership" | "policy" | "approval" | "execution" | "audit";
  sourceEntityId: string;
  sourceFilterSnapshot: Record<string, string>;
  sourceSort: string;
  sourceViewMode: string;
  selectedScopeIds: string[];
  originatingRoute: string;
  originatingTimestamp: string;
  // Governance object
  governanceObjectId: string | null;
  governanceObjectType: "ownership_change" | "policy_version" | "approval_session" | null;
  canonicalWriterKey: string | null;
  // Loop progression
  currentSurface: "discovery" | "judgment" | "execution" | "verification" | "closed";
  surfaceHistory: Array<{ surface: string; enteredAt: string; exitedAt: string | null }>;
  // Resolution
  resolutionStatus: "pending" | "resolved" | "partial" | "reverted" | "scheduled" | null;
  resolutionDetail: string;
  // Origin badge
  originBadge: "ownerless" | "overloaded" | "backlog" | "coverage" | "conflict" | "sla_breach" | "escalation" | "reapproval" | "policy_impact" | null;
  // Scope carry-over
  inheritedFilters: Record<string, string>;
  unresolvedBlockerSummary: string[];
  scopeCount: number;
}

export function createGovernanceLoopContext(
  sourcePanel: string,
  sourceEntityType: GovernanceLoopContext["sourceEntityType"],
  sourceEntityId: string,
  originBadge: GovernanceLoopContext["originBadge"],
  filters: Record<string, string> = {},
  scopes: string[] = [],
  route: string = "",
): GovernanceLoopContext {
  return {
    contextId: `glctx_${Date.now().toString(36)}`,
    sourcePanel, sourceEntityType, sourceEntityId,
    sourceFilterSnapshot: filters, sourceSort: "", sourceViewMode: "",
    selectedScopeIds: scopes, originatingRoute: route,
    originatingTimestamp: new Date().toISOString(),
    governanceObjectId: null, governanceObjectType: null, canonicalWriterKey: null,
    currentSurface: "discovery",
    surfaceHistory: [{ surface: "discovery", enteredAt: new Date().toISOString(), exitedAt: null }],
    resolutionStatus: null, resolutionDetail: "",
    originBadge,
    inheritedFilters: filters,
    unresolvedBlockerSummary: [],
    scopeCount: scopes.length,
  };
}

// ══════════════════════════════════════════════
// 2. Start Loop — panel → judgment surface
// ══════════════════════════════════════════════

export function startGovernanceLoop(
  ctx: GovernanceLoopContext,
  governanceObjectId: string,
  governanceObjectType: GovernanceLoopContext["governanceObjectType"],
  canonicalWriterKey: string,
): GovernanceLoopContext {
  const now = new Date().toISOString();
  // Close discovery surface
  const history = ctx.surfaceHistory.map(h =>
    h.surface === "discovery" && !h.exitedAt ? { ...h, exitedAt: now } : h
  );
  return {
    ...ctx,
    currentSurface: "judgment",
    governanceObjectId, governanceObjectType, canonicalWriterKey,
    surfaceHistory: [...history, { surface: "judgment", enteredAt: now, exitedAt: null }],
  };
}

// ══════════════════════════════════════════════
// 3. Advance Surface
// ══════════════════════════════════════════════

export function advanceGovernanceSurface(
  ctx: GovernanceLoopContext,
  toSurface: GovernanceLoopContext["currentSurface"],
): GovernanceLoopContext {
  const now = new Date().toISOString();
  const history = ctx.surfaceHistory.map(h =>
    h.surface === ctx.currentSurface && !h.exitedAt ? { ...h, exitedAt: now } : h
  );
  return {
    ...ctx,
    currentSurface: toSurface,
    surfaceHistory: [...history, { surface: toSurface, enteredAt: now, exitedAt: null }],
  };
}

// ══════════════════════════════════════════════
// 4. Close Loop
// ══════════════════════════════════════════════

export type LoopClosureStatus = "resolved" | "partial" | "reverted" | "scheduled";

export interface LoopClosureResult {
  closedContext: GovernanceLoopContext;
  invalidationTargets: GovernancePanelTarget[];
  dashboardRefreshScope: "targeted" | "full";
  returnRoute: string;
  toastMessage: string;
  toastType: "success" | "info" | "warning";
}

export function closeGovernanceLoop(
  ctx: GovernanceLoopContext,
  status: LoopClosureStatus,
  detail: string,
): LoopClosureResult {
  const now = new Date().toISOString();
  const history = ctx.surfaceHistory.map(h =>
    !h.exitedAt ? { ...h, exitedAt: now } : h
  );

  const closedCtx: GovernanceLoopContext = {
    ...ctx,
    currentSurface: "closed",
    resolutionStatus: status,
    resolutionDetail: detail,
    surfaceHistory: [...history, { surface: "closed", enteredAt: now, exitedAt: now }],
  };

  // Determine invalidation based on closure status
  let invalidationTargets: GovernancePanelTarget[];
  let dashboardRefreshScope: LoopClosureResult["dashboardRefreshScope"];
  let toastType: LoopClosureResult["toastType"];

  switch (status) {
    case "resolved":
      invalidationTargets = getTargetedInvalidation(ctx.sourcePanel, ctx.originBadge);
      dashboardRefreshScope = "targeted";
      toastType = "success";
      break;
    case "partial":
      invalidationTargets = [...getTargetedInvalidation(ctx.sourcePanel, ctx.originBadge), "conflict_panel", "execution_status"];
      dashboardRefreshScope = "targeted";
      toastType = "warning";
      break;
    case "reverted":
      invalidationTargets = ["owner_backlog", "ownerless_hotspot", "overloaded_owner", "ownership_coverage", "conflict_panel", "execution_status", "audit_closure_status", "recommended_actions", "rollout_history"];
      dashboardRefreshScope = "full";
      toastType = "warning";
      break;
    case "scheduled":
      invalidationTargets = ["recommended_actions"];
      dashboardRefreshScope = "targeted";
      toastType = "info";
      break;
  }

  const toastMessages: Record<LoopClosureStatus, string> = {
    resolved: `${ctx.originBadge || "건"} 처리 완료 — ${ctx.scopeCount || 1}건 반영`,
    partial: `부분 완료 — 일부 scope 실패. 재시도 또는 롤백 필요`,
    reverted: `롤백 완료 — 이전 상태 복원됨`,
    scheduled: `예약 적용 등록 — effective date 도래 시 자동 반영`,
  };

  return {
    closedContext: closedCtx,
    invalidationTargets,
    dashboardRefreshScope,
    returnRoute: ctx.originatingRoute || "/dashboard/approval",
    toastMessage: toastMessages[status],
    toastType,
  };
}

function getTargetedInvalidation(sourcePanel: string, originBadge: GovernanceLoopContext["originBadge"]): GovernancePanelTarget[] {
  const base: GovernancePanelTarget[] = ["recommended_actions"];

  switch (originBadge) {
    case "ownerless":
      return [...base, "ownerless_hotspot", "ownership_coverage", "owner_backlog"];
    case "overloaded":
      return [...base, "overloaded_owner", "owner_backlog", "ownership_coverage"];
    case "backlog":
      return [...base, "owner_backlog", "ownership_coverage"];
    case "coverage":
      return [...base, "ownership_coverage", "ownerless_hotspot", "overloaded_owner"];
    case "conflict":
      return [...base, "conflict_panel", "owner_backlog", "ownership_coverage"];
    case "sla_breach":
      return [...base, "owner_backlog"];
    case "escalation":
      return [...base, "owner_backlog"];
    case "reapproval":
      return [...base, "owner_backlog"];
    case "policy_impact":
      return [...base, "rollout_history"];
    default:
      return [...base, "owner_backlog", "ownership_coverage"];
  }
}

// ══════════════════════════════════════════════
// 5. Resume Loop — partial failure / audit incomplete 복귀
// ══════════════════════════════════════════════

export function resumeGovernanceLoop(
  ctx: GovernanceLoopContext,
  resumeToSurface: "judgment" | "execution" | "verification",
): GovernanceLoopContext {
  const now = new Date().toISOString();
  return {
    ...ctx,
    currentSurface: resumeToSurface,
    resolutionStatus: "pending",
    resolutionDetail: "",
    surfaceHistory: [...ctx.surfaceHistory, { surface: `resume:${resumeToSurface}`, enteredAt: now, exitedAt: null }],
  };
}

// ══════════════════════════════════════════════
// 6. Effective Date Transitions
// ══════════════════════════════════════════════

export interface EffectiveDateTransition {
  changeRequestId: string;
  effectiveDate: string;
  status: "future" | "due" | "overdue" | "applied";
  daysUntilDue: number;
  action: "no_action" | "ready_to_queue" | "overdue_alert" | "already_applied";
  simulationStale: boolean;
}

export function evaluateEffectiveDateTransitions(
  scheduledChanges: Array<{ changeRequestId: string; effectiveDate: string; status: string; appliedAt: string | null }>,
  now: Date = new Date(),
): EffectiveDateTransition[] {
  return scheduledChanges.map(change => {
    if (change.appliedAt) {
      return { changeRequestId: change.changeRequestId, effectiveDate: change.effectiveDate, status: "applied" as const, daysUntilDue: 0, action: "already_applied" as const, simulationStale: false };
    }

    const dueDate = new Date(change.effectiveDate);
    const diffMs = dueDate.getTime() - now.getTime();
    const daysUntilDue = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    if (daysUntilDue <= 0) {
      return { changeRequestId: change.changeRequestId, effectiveDate: change.effectiveDate, status: "due" as const, daysUntilDue, action: change.status === "approved" ? "ready_to_queue" as const : "overdue_alert" as const, simulationStale: true };
    }
    if (daysUntilDue <= 3) {
      return { changeRequestId: change.changeRequestId, effectiveDate: change.effectiveDate, status: "future" as const, daysUntilDue, action: "no_action" as const, simulationStale: daysUntilDue <= 1 };
    }
    return { changeRequestId: change.changeRequestId, effectiveDate: change.effectiveDate, status: "future" as const, daysUntilDue, action: "no_action" as const, simulationStale: false };
  });
}

// ══════════════════════════════════════════════
// 7. Cross-Governance Shared Grammar
// ══════════════════════════════════════════════

/** Ownership과 Policy에서 동일하게 사용하는 governance grammar */
export const SHARED_GOVERNANCE_GRAMMAR = {
  // Lifecycle labels (동일)
  lifecycle: {
    draft: "초안",
    pending_review: "검토 대기",
    review_approved: "검토 승인",
    review_rejected: "검토 거부",
    approved: "승인됨",
    applied: "적용 완료",
    superseded: "대체됨",
    reverted: "롤백됨",
    cancelled: "취소됨",
  },
  // Queue statuses (동일)
  execution: {
    queued: "대기",
    executing: "실행 중",
    completed: "완료",
    partial_failure: "부분 실패",
    failed: "실패",
    rolled_back: "롤백됨",
  },
  // Rollback modes (동일)
  rollback: {
    full: "전체 롤백",
    failed_only: "실패 scope만 롤백",
  },
  // Audit closure (동일)
  audit: {
    complete: "감사 폐쇄 완료",
    incomplete: "감사 폐쇄 미완료",
    missing_fields: "필수 필드 누락",
  },
  // Simulation severity (동일)
  simulationImpact: {
    positive: "긍정적",
    negative: "부정적",
    mixed: "혼합",
    neutral: "변동 없음",
    tightened: "강화됨",
    relaxed: "완화됨",
  },
  // Dock action order (ownership/policy 동일)
  dockActionOrder: [
    "revert",      // 가장 좌측 (위험)
    "reject",
    "request_changes",
    "schedule",
    "approve",     // 가장 우측 (primary)
    "apply_now",
  ] as const,
  // Irreversible action emphasis (동일)
  irreversibleEmphasis: "rounded bg-blue-600 hover:bg-blue-500 text-white font-medium",
  dangerEmphasis: "rounded border-red-500/20 bg-red-500/10 text-red-300",
} as const;

// ══════════════════════════════════════════════
// 8. Audit Closure ↔ Dashboard Metric 연결
// ══════════════════════════════════════════════

export interface AuditMetricConnection {
  /** closure incomplete면 governance item은 resolved 취급 금지 */
  isResolvedForMetrics: boolean;
  /** closure pass 후에만 backlog 감소 가능 */
  backlogDecrementAllowed: boolean;
  /** missing fields → remediation CTA 연결 */
  remediationNeeded: boolean;
  /** audit incomplete badge 노출 */
  showIncompleteBadge: boolean;
}

export function evaluateAuditMetricConnection(
  auditClosed: boolean,
  auditMissingFields: string[],
  executionCompleted: boolean,
): AuditMetricConnection {
  return {
    isResolvedForMetrics: auditClosed && executionCompleted,
    backlogDecrementAllowed: auditClosed,
    remediationNeeded: !auditClosed && auditMissingFields.length > 0,
    showIncompleteBadge: !auditClosed && executionCompleted,
  };
}
