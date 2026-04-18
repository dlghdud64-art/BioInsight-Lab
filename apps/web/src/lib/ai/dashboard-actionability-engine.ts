/**
 * Dashboard Actionability Engine — dashboard를 action hub로 전환
 *
 * dashboard의 모든 패널/KPI/alert이 클릭 가능한 운영 진입점이 됨.
 * "보는 화면"이 아니라 "운영 액션 launcher".
 *
 * DRILLDOWN CONTRACT:
 * - BottleneckAlert → inbox deep link (prefiltered)
 * - KPIStrip → domain/urgency/SLA filter
 * - TopBlocker → related case list
 * - DomainPanel → queue segment entry
 * - Reapproval/Escalation → prefiltered inbox
 */

import {
  APPROVAL_ROUTES,
  buildApprovalSearchParams,
  type ApprovalNavigationState,
} from "./approval-shell-routing-engine";
import type { ApprovalDomain, ApprovalUrgencyLevel } from "./approval-inbox-projection-v2-engine";
import type {
  ApprovalMetric,
  BottleneckIndicator,
  BlockerFrequency,
  DomainMetrics,
} from "./approval-governance-metrics-engine";

// ── Drilldown Link ──
export interface DrilldownLink {
  href: string;
  label: string;
  description: string;
  filterApplied: string[];
  priority: "high" | "medium" | "low";
}

// ── Bottleneck Alert → Deep Link ──
export function buildBottleneckDrilldown(bottleneck: BottleneckIndicator): DrilldownLink {
  const params: Partial<ApprovalNavigationState> = {};
  const filters: string[] = [];

  switch (bottleneck.type) {
    case "sla_breach_cluster":
      params.inboxView = "sla_breached";
      filters.push("SLA 초과 건만 표시");
      break;
    case "escalation_spike":
      params.inboxView = "escalation";
      filters.push("에스컬레이션 대기만 표시");
      break;
    case "reapproval_loop":
      params.inboxView = "reapproval";
      filters.push("재승인 필요 건만 표시");
      break;
    case "backlog_aging":
      params.inboxView = "sla_breached";
      if (bottleneck.affectedDomain) {
        params.inboxDomain = bottleneck.affectedDomain;
        filters.push(`${bottleneck.affectedDomain} domain`);
      }
      filters.push("오래된 대기 건 우선");
      break;
    case "policy_bottleneck":
      params.inboxView = "all";
      filters.push("정책 차단 건 포함");
      break;
  }

  const searchParams = buildApprovalSearchParams(params);
  return {
    href: `${APPROVAL_ROUTES.inbox}?${searchParams.toString()}`,
    label: bottleneck.type === "sla_breach_cluster" ? "SLA 초과 큐 열기"
      : bottleneck.type === "escalation_spike" ? "에스컬레이션 큐 열기"
      : bottleneck.type === "reapproval_loop" ? "재승인 큐 열기"
      : bottleneck.type === "backlog_aging" ? "정체 큐 열기"
      : "관련 큐 열기",
    description: bottleneck.detail,
    filterApplied: filters,
    priority: bottleneck.severity === "critical" ? "high" : "medium",
  };
}

// ── KPI → Filter ──
export function buildKPIDrilldown(metric: ApprovalMetric): DrilldownLink | null {
  const params: Partial<ApprovalNavigationState> = {};
  const filters: string[] = [];

  switch (metric.metricKey) {
    case "approval_lead_time":
      params.inboxView = "sla_breached";
      filters.push("평균 소요 시간 초과 건");
      break;
    case "sla_breach_rate":
      params.inboxView = "sla_breached";
      filters.push("SLA 초과 건");
      break;
    case "escalation_ratio":
      params.inboxView = "escalation";
      filters.push("에스컬레이션 건");
      break;
    case "reapproval_rate":
      params.inboxView = "reapproval";
      filters.push("재승인 필요 건");
      break;
    case "snapshot_invalidation_rate":
      params.inboxView = "reapproval";
      filters.push("Snapshot 무효화 건");
      break;
    case "sod_violation_attempts":
      // SoD violations → audit view
      return {
        href: APPROVAL_ROUTES.history,
        label: "SoD 위반 이력 보기",
        description: `${metric.value}건 SoD 위반 시도`,
        filterApplied: ["SoD violation events"],
        priority: metric.status === "critical" ? "high" : "medium",
      };
    case "delegation_conflict_frequency":
      return {
        href: APPROVAL_ROUTES.history,
        label: "위임 충돌 이력 보기",
        description: `${metric.value}건 delegation conflict`,
        filterApplied: ["delegation conflict events"],
        priority: metric.status === "critical" ? "high" : "medium",
      };
    case "backlog_oldest_age":
      params.inboxView = "sla_breached";
      filters.push("최장 대기 건");
      break;
    default:
      return null;
  }

  const searchParams = buildApprovalSearchParams(params);
  return {
    href: `${APPROVAL_ROUTES.inbox}?${searchParams.toString()}`,
    label: `${metric.label} 상세`,
    description: metric.detail,
    filterApplied: filters,
    priority: metric.status === "critical" ? "high" : metric.status === "warning" ? "medium" : "low",
  };
}

// ── Domain Panel → Queue Segment ──
export function buildDomainDrilldown(domain: DomainMetrics): DrilldownLink {
  const params: Partial<ApprovalNavigationState> = {
    inboxView: "by_domain",
    inboxDomain: domain.domain,
  };
  const searchParams = buildApprovalSearchParams(params);

  return {
    href: `${APPROVAL_ROUTES.inbox}?${searchParams.toString()}`,
    label: `${DOMAIN_LABELS[domain.domain]} 큐 열기`,
    description: `${domain.pendingCount}건 대기, 평균 ${Math.round(domain.avgLeadTimeMinutes / 60)}시간`,
    filterApplied: [`domain=${domain.domain}`],
    priority: domain.slaBreachCount > 0 || domain.oldestItemAgeMinutes > 480 ? "high" : "medium",
  };
}

// ── Top Blocker → Case List ──
export function buildBlockerDrilldown(blocker: BlockerFrequency): DrilldownLink {
  const params: Partial<ApprovalNavigationState> = {
    inboxView: "all",
  };
  const searchParams = buildApprovalSearchParams(params);

  return {
    href: `${APPROVAL_ROUTES.inbox}?${searchParams.toString()}`,
    label: `차단 이유 드릴다운`,
    description: `'${blocker.blockerReason}' — ${blocker.count}건 (${blocker.percentage}%)`,
    filterApplied: [`blocker: ${blocker.blockerReason}`, ...blocker.affectedDomains.map(d => `domain: ${d}`)],
    priority: blocker.percentage > 30 ? "high" : "medium",
  };
}

// ── Build All Dashboard Actions ──
export interface DashboardActionMap {
  bottleneckLinks: DrilldownLink[];
  kpiLinks: (DrilldownLink | null)[];
  domainLinks: DrilldownLink[];
  blockerLinks: DrilldownLink[];
}

export function buildDashboardActionMap(
  bottlenecks: BottleneckIndicator[],
  metrics: ApprovalMetric[],
  domains: DomainMetrics[],
  blockers: BlockerFrequency[],
): DashboardActionMap {
  return {
    bottleneckLinks: bottlenecks.map(buildBottleneckDrilldown),
    kpiLinks: metrics.map(buildKPIDrilldown),
    domainLinks: domains.map(buildDomainDrilldown),
    blockerLinks: blockers.map(buildBlockerDrilldown),
  };
}

// ── Domain Labels ──
const DOMAIN_LABELS: Record<string, string> = {
  fire_execution: "발송",
  stock_release: "재고 릴리스",
  exception_resolve: "예외 해결",
  exception_return_to_stage: "예외 복귀",
};
