/**
 * Dashboard → Policy/Admin Action Loop Engine
 *
 * dashboard 패널에서 "문제 발견" → "어디를 고쳐야 하는지" 연결.
 *
 * LOOP CONTRACT:
 * - EscalationHotspot → policy domain simulation deep link
 * - PolicyImpactTrend → publish version / rollback candidate drilldown
 * - TeamSiteBreakdown → team/site ownership view
 * - ReapprovalLoop → case cluster + root cause bucket
 * - recommended action → inbox / workbench / policy admin 바로 진입
 *
 * 핵심: dashboard가 "보기"에서 끝나지 않고 **운영 개입 loop의 허브**가 됨.
 */

import { APPROVAL_ROUTES, buildApprovalSearchParams, type ApprovalNavigationState } from "./approval-shell-routing-engine";
import type { ApprovalDomain } from "./approval-inbox-projection-v2-engine";
import type { BreakdownRecord } from "./governance-dashboard-breakdown-engine";
import type { EscalationHotspot } from "./governance-escalation-hotspot-engine";
import type { PolicyChangeImpact } from "./governance-escalation-hotspot-engine";

// ══════════════════════════════════════════════
// Action Link Types
// ══════════════════════════════════════════════

export type ActionLinkTarget = "inbox" | "workbench" | "policy_admin" | "policy_simulation" | "case_overview" | "dashboard";

export interface DashboardActionLink {
  linkId: string;
  target: ActionLinkTarget;
  href: string;
  label: string;
  description: string;
  context: Record<string, string>;
  priority: "critical" | "high" | "medium" | "low";
  sourcePanel: string;
  sourceItemId: string;
}

// ══════════════════════════════════════════════
// Recommended Action
// ══════════════════════════════════════════════

export interface RecommendedAction {
  actionId: string;
  type: "tune_policy" | "assign_approver" | "escalate_ownership" | "review_cases" | "rollback_policy" | "adjust_threshold" | "investigate_loop";
  title: string;
  description: string;
  targetLinks: DashboardActionLink[];
  urgency: "immediate" | "soon" | "scheduled";
  estimatedImpact: string;
}

// ══════════════════════════════════════════════
// Escalation Hotspot → Policy Simulation Link
// ══════════════════════════════════════════════

export function buildEscalationToPolicyLinks(hotspot: EscalationHotspot): RecommendedAction {
  const links: DashboardActionLink[] = [];

  // Link to policy admin for the hottest source
  if (hotspot.sourceBreakdown.length > 0) {
    const topSource = hotspot.sourceBreakdown[0];
    links.push({
      linkId: `esc_pol_${hotspot.domain}_${topSource.source}`,
      target: "policy_admin",
      href: `/dashboard/approval/policy-admin?domain=${topSource.source}`,
      label: `${topSource.source} 정책 검토`,
      description: `${topSource.source} 정책이 ${hotspot.domain}에서 ${topSource.count}건 에스컬레이션 발생`,
      context: { domain: hotspot.domain, source: topSource.source, count: String(topSource.count) },
      priority: hotspot.escalationRate > 30 ? "critical" : hotspot.escalationRate > 15 ? "high" : "medium",
      sourcePanel: "escalation_hotspot",
      sourceItemId: hotspot.domain,
    });

    // Link to policy simulation
    links.push({
      linkId: `esc_sim_${hotspot.domain}_${topSource.source}`,
      target: "policy_simulation",
      href: `/dashboard/approval/policy-admin?domain=${topSource.source}&mode=simulation`,
      label: `${topSource.source} 정책 시뮬레이션`,
      description: `임계값 조정 시 에스컬레이션 감소 효과 미리보기`,
      context: { domain: hotspot.domain, source: topSource.source },
      priority: "high",
      sourcePanel: "escalation_hotspot",
      sourceItemId: hotspot.domain,
    });
  }

  // Link to inbox for affected cases
  const inboxParams = buildApprovalSearchParams({ inboxView: "escalation", inboxDomain: hotspot.domain });
  links.push({
    linkId: `esc_inbox_${hotspot.domain}`,
    target: "inbox",
    href: `${APPROVAL_ROUTES.inbox}?${inboxParams.toString()}`,
    label: `${DOMAIN_SHORT[hotspot.domain]} 에스컬레이션 큐`,
    description: `${hotspot.escalationCount}건 에스컬레이션 대기`,
    context: { domain: hotspot.domain },
    priority: hotspot.escalationCount > 10 ? "high" : "medium",
    sourcePanel: "escalation_hotspot",
    sourceItemId: hotspot.domain,
  });

  return {
    actionId: `rec_esc_${hotspot.domain}`,
    type: "tune_policy",
    title: `${DOMAIN_SHORT[hotspot.domain]} 에스컬레이션 원인 정책 조정`,
    description: `${hotspot.sourceBreakdown[0]?.source || "unknown"} 정책이 ${hotspot.escalationRate}% 에스컬레이션을 유발. 임계값 또는 승인 경로 조정 검토.`,
    targetLinks: links,
    urgency: hotspot.escalationRate > 30 ? "immediate" : "soon",
    estimatedImpact: `에스컬레이션 ${hotspot.escalationCount}건 중 정책 조정으로 감소 가능`,
  };
}

// ══════════════════════════════════════════════
// Policy Impact → Publish/Rollback Drilldown
// ══════════════════════════════════════════════

export function buildPolicyImpactToAdminLinks(impact: PolicyChangeImpact): RecommendedAction {
  const links: DashboardActionLink[] = [];

  if (impact.overallImpact === "tightened") {
    links.push({
      linkId: `imp_review_${impact.changeEventId}`,
      target: "policy_admin",
      href: `/dashboard/approval/policy-admin?version=${impact.changeEventId}`,
      label: "정책 변경 검토",
      description: `${impact.policyDomain} 정책 강화로 승인 ${impact.approvalDelta > 0 ? "+" : ""}${impact.approvalDelta}, 차단 ${impact.blockDelta > 0 ? "+" : ""}${impact.blockDelta}`,
      context: { changeId: impact.changeEventId, impact: impact.overallImpact },
      priority: Math.abs(impact.blockDelta) > 5 ? "critical" : "high",
      sourcePanel: "policy_impact_trend",
      sourceItemId: impact.changeEventId,
    });

    // Rollback candidate if heavily tightened
    if (Math.abs(impact.blockDelta) > 3 || Math.abs(impact.escalationDelta) > 3) {
      links.push({
        linkId: `imp_rollback_${impact.changeEventId}`,
        target: "policy_admin",
        href: `/dashboard/approval/policy-admin?version=${impact.changeEventId}&action=rollback`,
        label: "롤백 검토",
        description: "정책 과도 강화 — 이전 버전 롤백 검토",
        context: { changeId: impact.changeEventId, action: "rollback" },
        priority: "critical",
        sourcePanel: "policy_impact_trend",
        sourceItemId: impact.changeEventId,
      });
    }
  }

  // Impact inbox link
  const inboxParams = buildApprovalSearchParams({ inboxView: "all" });
  links.push({
    linkId: `imp_inbox_${impact.changeEventId}`,
    target: "inbox",
    href: `${APPROVAL_ROUTES.inbox}?${inboxParams.toString()}`,
    label: "영향받은 케이스 확인",
    description: `정책 변경 후 영향받은 approval 건 확인`,
    context: { changeId: impact.changeEventId },
    priority: "medium",
    sourcePanel: "policy_impact_trend",
    sourceItemId: impact.changeEventId,
  });

  return {
    actionId: `rec_imp_${impact.changeEventId}`,
    type: impact.overallImpact === "tightened" ? "adjust_threshold" : "review_cases",
    title: `${impact.policyDomain} 정책 변경 영향 검토`,
    description: `${impact.changeType} 후 ${impact.overallImpact}: 승인 ${impact.approvalDelta > 0 ? "+" : ""}${impact.approvalDelta}, 에스컬레이션 ${impact.escalationDelta > 0 ? "+" : ""}${impact.escalationDelta}, 차단 ${impact.blockDelta > 0 ? "+" : ""}${impact.blockDelta}`,
    targetLinks: links,
    urgency: impact.overallImpact === "tightened" && Math.abs(impact.blockDelta) > 3 ? "immediate" : "soon",
    estimatedImpact: `${impact.overallImpact === "tightened" ? "통제 강화" : "통제 완화"} — 운영 흐름 변동`,
  };
}

// ══════════════════════════════════════════════
// Team/Site Breakdown → Ownership Link
// ══════════════════════════════════════════════

export function buildBreakdownToOwnershipLinks(record: BreakdownRecord): RecommendedAction {
  const links: DashboardActionLink[] = [];

  // Inbox filtered by this group
  const inboxParams = buildApprovalSearchParams({
    inboxView: record.dimensionType === "domain" ? "by_domain" : "my_assigned",
    inboxDomain: record.dimensionType === "domain" ? record.dimensionId as ApprovalDomain : undefined,
  });
  links.push({
    linkId: `brk_inbox_${record.dimensionId}`,
    target: "inbox",
    href: `${APPROVAL_ROUTES.inbox}?${inboxParams.toString()}`,
    label: `${record.dimensionLabel} 대기 큐`,
    description: `${record.pendingCount}건 대기, SLA초과 ${record.slaBreachCount}`,
    context: { dimension: record.dimensionType, id: record.dimensionId },
    priority: record.riskLevel === "critical" ? "critical" : record.riskLevel === "high" ? "high" : "medium",
    sourcePanel: "team_site_breakdown",
    sourceItemId: record.dimensionId,
  });

  // If top blocker exists → policy admin
  if (record.topBlocker) {
    links.push({
      linkId: `brk_policy_${record.dimensionId}`,
      target: "policy_admin",
      href: `/dashboard/approval/policy-admin?search=${encodeURIComponent(record.topBlocker)}`,
      label: "주요 차단 정책 검토",
      description: `'${record.topBlocker}' 차단이 ${record.dimensionLabel}에서 빈발`,
      context: { blocker: record.topBlocker },
      priority: "high",
      sourcePanel: "team_site_breakdown",
      sourceItemId: record.dimensionId,
    });
  }

  let actionType: RecommendedAction["type"] = "review_cases";
  if (record.escalationRate > 25) actionType = "escalate_ownership";
  else if (record.slaBreachRate > 20) actionType = "assign_approver";
  else if (record.topBlocker) actionType = "tune_policy";

  return {
    actionId: `rec_brk_${record.dimensionId}`,
    type: actionType,
    title: `${record.dimensionLabel} 운영 개입`,
    description: `Risk ${record.riskScore} — ${record.riskLevel}. ${record.pendingCount}건 대기, SLA초과 ${record.slaBreachRate}%, 에스컬레이션 ${record.escalationRate}%`,
    targetLinks: links,
    urgency: record.riskLevel === "critical" ? "immediate" : record.riskLevel === "high" ? "soon" : "scheduled",
    estimatedImpact: `${record.dimensionLabel}의 승인 병목 해소`,
  };
}

// ══════════════════════════════════════════════
// Reapproval Loop → Root Cause Link
// ══════════════════════════════════════════════

export function buildReapprovalLoopToActionLinks(
  caseId: string,
  totalLoops: number,
  loopCategory: string,
): RecommendedAction {
  const links: DashboardActionLink[] = [];

  // Case drilldown
  links.push({
    linkId: `loop_case_${caseId}`,
    target: "case_overview",
    href: APPROVAL_ROUTES.caseOverview(caseId),
    label: "케이스 상세",
    description: `${totalLoops}회 재승인 반복`,
    context: { caseId, loops: String(totalLoops) },
    priority: totalLoops > 3 ? "critical" : "high",
    sourcePanel: "reapproval_loop",
    sourceItemId: caseId,
  });

  // Root cause → policy admin or workflow review
  if (loopCategory === "policy_drift") {
    links.push({
      linkId: `loop_policy_${caseId}`,
      target: "policy_admin",
      href: `/dashboard/approval/policy-admin?highlight=recent_changes`,
      label: "정책 변경 이력 확인",
      description: "정책 drift로 인한 재승인 — 최근 변경 확인",
      context: { caseId, rootCause: "policy_drift" },
      priority: "high",
      sourcePanel: "reapproval_loop",
      sourceItemId: caseId,
    });
  }

  return {
    actionId: `rec_loop_${caseId}`,
    type: "investigate_loop",
    title: `재승인 루프 조사: ${caseId.slice(0, 12)}`,
    description: `${totalLoops}회 반복 (${loopCategory}). ${loopCategory === "policy_drift" ? "정책 변경이 원인" : loopCategory === "payload_change" ? "payload 변경이 원인" : "복합 원인"}`,
    targetLinks: links,
    urgency: totalLoops > 3 ? "immediate" : "soon",
    estimatedImpact: "재승인 루프 해소 → 승인 지연 감소",
  };
}

// ══════════════════════════════════════════════
// Build All Recommended Actions
// ══════════════════════════════════════════════

export interface DashboardRecommendedActions {
  actions: RecommendedAction[];
  immediateCount: number;
  soonCount: number;
  scheduledCount: number;
  totalLinks: number;
  generatedAt: string;
}

export function buildAllRecommendedActions(
  escalationHotspots: EscalationHotspot[],
  policyImpacts: PolicyChangeImpact[],
  breakdownRecords: BreakdownRecord[],
  loopCases: Array<{ caseId: string; totalLoops: number; loopCategory: string }>,
): DashboardRecommendedActions {
  const actions: RecommendedAction[] = [];

  // Escalation hotspot actions
  for (const hotspot of escalationHotspots) {
    if (hotspot.escalationCount > 0) {
      actions.push(buildEscalationToPolicyLinks(hotspot));
    }
  }

  // Policy impact actions
  for (const impact of policyImpacts) {
    if (impact.overallImpact !== "neutral") {
      actions.push(buildPolicyImpactToAdminLinks(impact));
    }
  }

  // Breakdown actions (high risk only)
  for (const record of breakdownRecords) {
    if (record.riskLevel === "critical" || record.riskLevel === "high") {
      actions.push(buildBreakdownToOwnershipLinks(record));
    }
  }

  // Reapproval loop actions
  for (const loop of loopCases) {
    if (loop.totalLoops >= 2) {
      actions.push(buildReapprovalLoopToActionLinks(loop.caseId, loop.totalLoops, loop.loopCategory));
    }
  }

  // Sort by urgency
  const urgencyOrder: Record<string, number> = { immediate: 0, soon: 1, scheduled: 2 };
  actions.sort((a, b) => (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2));

  return {
    actions,
    immediateCount: actions.filter(a => a.urgency === "immediate").length,
    soonCount: actions.filter(a => a.urgency === "soon").length,
    scheduledCount: actions.filter(a => a.urgency === "scheduled").length,
    totalLinks: actions.reduce((s, a) => s + a.targetLinks.length, 0),
    generatedAt: new Date().toISOString(),
  };
}

// ── Domain Short Labels ──
const DOMAIN_SHORT: Record<string, string> = {
  fire_execution: "발송", stock_release: "릴리스",
  exception_resolve: "예외해결", exception_return_to_stage: "예외복귀",
};
