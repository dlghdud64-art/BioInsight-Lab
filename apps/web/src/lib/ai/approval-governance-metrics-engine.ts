/**
 * Approval Governance Metrics Engine — 조직 거버넌스 지표 계산
 *
 * 예쁜 차트보다 **어디가 병목인지와 어떤 정책이 운영을 가장 많이 막는지**가 먼저.
 *
 * 10 핵심 지표:
 * 1. approval_lead_time — 승인 요청 → 결정까지 시간
 * 2. sla_breach_rate — SLA 초과율
 * 3. escalation_ratio — 에스컬레이션 비율
 * 4. dual_approval_completion_time — 이중 승인 완료까지 시간
 * 5. reapproval_rate — 재승인 발생률
 * 6. stale_handoff_rate — stale handoff 감지율
 * 7. snapshot_invalidation_rate — snapshot 무효화율
 * 8. sod_violation_attempts — SoD 위반 시도 횟수
 * 9. delegation_conflict_frequency — delegation 충돌 빈도
 * 10. domain_backlog_aging — domain별 backlog 노화
 */

import type { ApprovalInboxItemV2, ApprovalDomain, ApprovalUrgencyLevel } from "./approval-inbox-projection-v2-engine";

// ── Metric Types ──
export interface ApprovalMetric {
  metricKey: string;
  label: string;
  value: number;
  unit: string;
  trend: "improving" | "stable" | "degrading" | "unknown";
  threshold: { warning: number; critical: number } | null;
  status: "healthy" | "warning" | "critical";
  detail: string;
}

// ── Governance Metrics Summary ──
export interface GovernanceMetricsSummary {
  generatedAt: string;
  periodLabel: string;
  metrics: ApprovalMetric[];
  domainBreakdown: DomainMetrics[];
  topBlockers: BlockerFrequency[];
  bottlenecks: BottleneckIndicator[];
}

export interface DomainMetrics {
  domain: ApprovalDomain;
  pendingCount: number;
  avgLeadTimeMinutes: number;
  slaBreachCount: number;
  escalationCount: number;
  reapprovalCount: number;
  oldestItemAgeMinutes: number;
}

export interface BlockerFrequency {
  blockerReason: string;
  count: number;
  percentage: number;
  affectedDomains: ApprovalDomain[];
}

export interface BottleneckIndicator {
  type: "backlog_aging" | "sla_breach_cluster" | "escalation_spike" | "reapproval_loop" | "policy_bottleneck";
  severity: "warning" | "critical";
  detail: string;
  affectedDomain: ApprovalDomain | null;
  recommendedAction: string;
}

// ── Historical Approval Record (for metrics computation) ──
export interface ApprovalHistoryRecord {
  sessionId: string;
  caseId: string;
  domain: ApprovalDomain;
  actionKey: string;
  riskTier: string;
  requestedAt: string;
  decidedAt: string | null;
  decision: "approved" | "rejected" | "escalated" | "expired" | "pending";
  leadTimeMinutes: number | null;
  slaBreached: boolean;
  reapprovalCount: number;
  snapshotInvalidated: boolean;
  sodViolationAttempted: boolean;
  delegationConflictDetected: boolean;
  dualApprovalUsed: boolean;
  dualApprovalCompletionMinutes: number | null;
  blockerReasons: string[];
}

// ── Compute Governance Metrics ──
export function computeGovernanceMetrics(
  history: ApprovalHistoryRecord[],
  currentInbox: ApprovalInboxItemV2[],
  periodLabel: string = "최근 7일",
): GovernanceMetricsSummary {
  const metrics: ApprovalMetric[] = [];
  const decided = history.filter(h => h.decidedAt !== null);
  const total = history.length;

  // 1. Approval Lead Time
  const leadTimes = decided.filter(h => h.leadTimeMinutes !== null).map(h => h.leadTimeMinutes!);
  const avgLeadTime = leadTimes.length > 0 ? Math.round(leadTimes.reduce((s, v) => s + v, 0) / leadTimes.length) : 0;
  metrics.push({
    metricKey: "approval_lead_time",
    label: "평균 승인 소요 시간",
    value: avgLeadTime,
    unit: "분",
    trend: "unknown",
    threshold: { warning: 240, critical: 480 }, // 4h warning, 8h critical
    status: avgLeadTime > 480 ? "critical" : avgLeadTime > 240 ? "warning" : "healthy",
    detail: `${decided.length}건 기준, 평균 ${Math.round(avgLeadTime / 60)}시간 ${avgLeadTime % 60}분`,
  });

  // 2. SLA Breach Rate
  const slaBreached = history.filter(h => h.slaBreached).length;
  const slaBreachRate = total > 0 ? Math.round((slaBreached / total) * 100) : 0;
  metrics.push({
    metricKey: "sla_breach_rate",
    label: "SLA 초과율",
    value: slaBreachRate,
    unit: "%",
    trend: "unknown",
    threshold: { warning: 10, critical: 25 },
    status: slaBreachRate > 25 ? "critical" : slaBreachRate > 10 ? "warning" : "healthy",
    detail: `${slaBreached}/${total}건 SLA 초과`,
  });

  // 3. Escalation Ratio
  const escalated = history.filter(h => h.decision === "escalated").length;
  const escalationRatio = total > 0 ? Math.round((escalated / total) * 100) : 0;
  metrics.push({
    metricKey: "escalation_ratio",
    label: "에스컬레이션 비율",
    value: escalationRatio,
    unit: "%",
    trend: "unknown",
    threshold: { warning: 15, critical: 30 },
    status: escalationRatio > 30 ? "critical" : escalationRatio > 15 ? "warning" : "healthy",
    detail: `${escalated}/${total}건 에스컬레이션`,
  });

  // 4. Dual Approval Completion Time
  const dualRecords = decided.filter(h => h.dualApprovalUsed && h.dualApprovalCompletionMinutes !== null);
  const avgDualTime = dualRecords.length > 0 ? Math.round(dualRecords.reduce((s, h) => s + h.dualApprovalCompletionMinutes!, 0) / dualRecords.length) : 0;
  metrics.push({
    metricKey: "dual_approval_completion_time",
    label: "이중 승인 완료 시간",
    value: avgDualTime,
    unit: "분",
    trend: "unknown",
    threshold: { warning: 360, critical: 720 },
    status: avgDualTime > 720 ? "critical" : avgDualTime > 360 ? "warning" : "healthy",
    detail: `${dualRecords.length}건 이중 승인, 평균 ${Math.round(avgDualTime / 60)}시간`,
  });

  // 5. Reapproval Rate
  const reapproved = history.filter(h => h.reapprovalCount > 0).length;
  const reapprovalRate = total > 0 ? Math.round((reapproved / total) * 100) : 0;
  metrics.push({
    metricKey: "reapproval_rate",
    label: "재승인 발생률",
    value: reapprovalRate,
    unit: "%",
    trend: "unknown",
    threshold: { warning: 10, critical: 20 },
    status: reapprovalRate > 20 ? "critical" : reapprovalRate > 10 ? "warning" : "healthy",
    detail: `${reapproved}/${total}건 재승인 발생`,
  });

  // 6-7. Snapshot Invalidation Rate
  const invalidated = history.filter(h => h.snapshotInvalidated).length;
  const invalidationRate = total > 0 ? Math.round((invalidated / total) * 100) : 0;
  metrics.push({
    metricKey: "snapshot_invalidation_rate",
    label: "Snapshot 무효화율",
    value: invalidationRate,
    unit: "%",
    trend: "unknown",
    threshold: { warning: 5, critical: 15 },
    status: invalidationRate > 15 ? "critical" : invalidationRate > 5 ? "warning" : "healthy",
    detail: `${invalidated}/${total}건 payload/policy drift로 무효화`,
  });

  // 8. SoD Violation Attempts
  const sodAttempts = history.filter(h => h.sodViolationAttempted).length;
  metrics.push({
    metricKey: "sod_violation_attempts",
    label: "SoD 위반 시도",
    value: sodAttempts,
    unit: "건",
    trend: "unknown",
    threshold: { warning: 3, critical: 10 },
    status: sodAttempts > 10 ? "critical" : sodAttempts > 3 ? "warning" : "healthy",
    detail: `${sodAttempts}건 동일인 준비/승인/실행 시도 차단`,
  });

  // 9. Delegation Conflict Frequency
  const delegConflicts = history.filter(h => h.delegationConflictDetected).length;
  metrics.push({
    metricKey: "delegation_conflict_frequency",
    label: "Delegation 충돌",
    value: delegConflicts,
    unit: "건",
    trend: "unknown",
    threshold: { warning: 2, critical: 5 },
    status: delegConflicts > 5 ? "critical" : delegConflicts > 2 ? "warning" : "healthy",
    detail: `${delegConflicts}건 위임 체인 충돌 감지`,
  });

  // 10. Current Backlog (from inbox)
  const backlogAge = currentInbox.length > 0 ? Math.max(...currentInbox.map(i => i.ageMinutes)) : 0;
  metrics.push({
    metricKey: "backlog_oldest_age",
    label: "최장 대기 시간",
    value: backlogAge,
    unit: "분",
    trend: "unknown",
    threshold: { warning: 240, critical: 480 },
    status: backlogAge > 480 ? "critical" : backlogAge > 240 ? "warning" : "healthy",
    detail: `${currentInbox.length}건 대기 중, 최장 ${Math.round(backlogAge / 60)}시간`,
  });

  // Domain breakdown
  const domains: ApprovalDomain[] = ["fire_execution", "stock_release", "exception_resolve", "exception_return_to_stage"];
  const domainBreakdown: DomainMetrics[] = domains.map(domain => {
    const domainHistory = history.filter(h => h.domain === domain);
    const domainInbox = currentInbox.filter(i => i.domain === domain);
    const domainLeadTimes = domainHistory.filter(h => h.leadTimeMinutes !== null).map(h => h.leadTimeMinutes!);

    return {
      domain,
      pendingCount: domainInbox.length,
      avgLeadTimeMinutes: domainLeadTimes.length > 0 ? Math.round(domainLeadTimes.reduce((s, v) => s + v, 0) / domainLeadTimes.length) : 0,
      slaBreachCount: domainHistory.filter(h => h.slaBreached).length,
      escalationCount: domainHistory.filter(h => h.decision === "escalated").length,
      reapprovalCount: domainHistory.filter(h => h.reapprovalCount > 0).length,
      oldestItemAgeMinutes: domainInbox.length > 0 ? Math.max(...domainInbox.map(i => i.ageMinutes)) : 0,
    };
  });

  // Top blockers
  const allBlockers = history.flatMap(h => h.blockerReasons);
  const blockerCounts = new Map<string, { count: number; domains: Set<ApprovalDomain> }>();
  history.forEach(h => {
    h.blockerReasons.forEach(reason => {
      const existing = blockerCounts.get(reason) || { count: 0, domains: new Set() };
      existing.count++;
      existing.domains.add(h.domain);
      blockerCounts.set(reason, existing);
    });
  });
  const topBlockers: BlockerFrequency[] = [...blockerCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([reason, data]) => ({
      blockerReason: reason,
      count: data.count,
      percentage: total > 0 ? Math.round((data.count / total) * 100) : 0,
      affectedDomains: [...data.domains],
    }));

  // Bottleneck detection
  const bottlenecks: BottleneckIndicator[] = [];
  if (slaBreachRate > 25) {
    bottlenecks.push({ type: "sla_breach_cluster", severity: "critical", detail: `SLA 초과율 ${slaBreachRate}% — 승인 처리 지연`, affectedDomain: null, recommendedAction: "승인자 추가 배정 또는 SLA 기준 조정" });
  }
  if (escalationRatio > 30) {
    bottlenecks.push({ type: "escalation_spike", severity: "critical", detail: `에스컬레이션 비율 ${escalationRatio}% — 정책 과도 또는 권한 부족`, affectedDomain: null, recommendedAction: "정책 임계값 검토 또는 역할 권한 조정" });
  }
  if (reapprovalRate > 20) {
    bottlenecks.push({ type: "reapproval_loop", severity: "warning", detail: `재승인률 ${reapprovalRate}% — payload/policy drift 빈발`, affectedDomain: null, recommendedAction: "승인-실행 간 시간 단축 또는 payload 변경 프로세스 개선" });
  }
  domainBreakdown.forEach(d => {
    if (d.oldestItemAgeMinutes > 480) {
      bottlenecks.push({ type: "backlog_aging", severity: "warning", detail: `${d.domain} 최장 대기 ${Math.round(d.oldestItemAgeMinutes / 60)}시간`, affectedDomain: d.domain, recommendedAction: "해당 domain 승인 우선 처리" });
    }
  });
  if (topBlockers.length > 0 && topBlockers[0].percentage > 30) {
    bottlenecks.push({ type: "policy_bottleneck", severity: "warning", detail: `'${topBlockers[0].blockerReason}' 차단 ${topBlockers[0].percentage}% — 단일 정책이 과도하게 차단`, affectedDomain: null, recommendedAction: "해당 정책 임계값 또는 적용 범위 검토" });
  }

  return {
    generatedAt: new Date().toISOString(),
    periodLabel,
    metrics,
    domainBreakdown,
    topBlockers,
    bottlenecks,
  };
}
