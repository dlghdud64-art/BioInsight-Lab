/**
 * Dashboard Explainability Hardening Engine
 *
 * composite risk score, hotspot ranking, reapproval root-cause, policy impact delta를
 * 블랙박스가 아니라 설명 가능한 breakdown으로 제공.
 *
 * 핵심: 점수 자체가 새 블랙박스가 되면 안 됨.
 */

import type { BreakdownRecord } from "./governance-dashboard-breakdown-engine";
import type { EscalationHotspot } from "./governance-escalation-hotspot-engine";
import type { PolicyChangeImpact } from "./governance-escalation-hotspot-engine";

// ══════════════════════════════════════════════
// 1. Risk Score Breakdown
// ══════════════════════════════════════════════

export interface RiskScoreBreakdown {
  dimensionId: string;
  dimensionLabel: string;
  totalScore: number;
  riskLevel: string;
  factors: RiskFactor[];
  topContributor: string;
  comparisonNote: string;
}

export interface RiskFactor {
  factorKey: string;
  label: string;
  rawValue: number;
  weight: number;
  contribution: number;
  isTopContributor: boolean;
  explanation: string;
}

const RISK_WEIGHTS = {
  sla_breach: { weight: 0.30, label: "SLA 초과율" },
  escalation: { weight: 0.25, label: "에스컬레이션 비율" },
  reapproval: { weight: 0.20, label: "재승인 발생률" },
  aging: { weight: 0.15, label: "최장 대기 시간" },
  backlog: { weight: 0.10, label: "대기 건수" },
};

export function buildRiskScoreBreakdown(record: BreakdownRecord): RiskScoreBreakdown {
  const factors: RiskFactor[] = [];

  const slaContrib = Math.round(record.slaBreachRate * RISK_WEIGHTS.sla_breach.weight);
  factors.push({
    factorKey: "sla_breach", label: RISK_WEIGHTS.sla_breach.label,
    rawValue: record.slaBreachRate, weight: RISK_WEIGHTS.sla_breach.weight,
    contribution: slaContrib, isTopContributor: false,
    explanation: `SLA 초과 ${record.slaBreachRate}% × 가중치 ${RISK_WEIGHTS.sla_breach.weight * 100}% = ${slaContrib}점`,
  });

  const escContrib = Math.round(record.escalationRate * RISK_WEIGHTS.escalation.weight);
  factors.push({
    factorKey: "escalation", label: RISK_WEIGHTS.escalation.label,
    rawValue: record.escalationRate, weight: RISK_WEIGHTS.escalation.weight,
    contribution: escContrib, isTopContributor: false,
    explanation: `에스컬레이션 ${record.escalationRate}% × 가중치 ${RISK_WEIGHTS.escalation.weight * 100}% = ${escContrib}점`,
  });

  const reappContrib = Math.round(record.reapprovalRate * RISK_WEIGHTS.reapproval.weight);
  factors.push({
    factorKey: "reapproval", label: RISK_WEIGHTS.reapproval.label,
    rawValue: record.reapprovalRate, weight: RISK_WEIGHTS.reapproval.weight,
    contribution: reappContrib, isTopContributor: false,
    explanation: `재승인 ${record.reapprovalRate}% × 가중치 ${RISK_WEIGHTS.reapproval.weight * 100}% = ${reappContrib}점`,
  });

  const agingNorm = Math.min(100, Math.round(record.oldestPendingAgeMinutes / 4.8));
  const agingContrib = Math.round(agingNorm * RISK_WEIGHTS.aging.weight);
  factors.push({
    factorKey: "aging", label: RISK_WEIGHTS.aging.label,
    rawValue: record.oldestPendingAgeMinutes, weight: RISK_WEIGHTS.aging.weight,
    contribution: agingContrib, isTopContributor: false,
    explanation: `최장 ${Math.round(record.oldestPendingAgeMinutes / 60)}시간 (정규화 ${agingNorm}%) × ${RISK_WEIGHTS.aging.weight * 100}% = ${agingContrib}점`,
  });

  const backlogNorm = Math.min(100, record.pendingCount * 10);
  const backlogContrib = Math.round(backlogNorm * RISK_WEIGHTS.backlog.weight);
  factors.push({
    factorKey: "backlog", label: RISK_WEIGHTS.backlog.label,
    rawValue: record.pendingCount, weight: RISK_WEIGHTS.backlog.weight,
    contribution: backlogContrib, isTopContributor: false,
    explanation: `${record.pendingCount}건 (정규화 ${backlogNorm}%) × ${RISK_WEIGHTS.backlog.weight * 100}% = ${backlogContrib}점`,
  });

  // Mark top contributor
  factors.sort((a, b) => b.contribution - a.contribution);
  if (factors.length > 0) factors[0].isTopContributor = true;

  const topContributor = factors[0]?.label || "없음";

  return {
    dimensionId: record.dimensionId,
    dimensionLabel: record.dimensionLabel,
    totalScore: record.riskScore,
    riskLevel: record.riskLevel,
    factors,
    topContributor,
    comparisonNote: `Risk ${record.riskScore}점 — 주요 기여: ${topContributor} (${factors[0]?.contribution || 0}점)`,
  };
}

// ══════════════════════════════════════════════
// 2. Hotspot Ranking Explanation
// ══════════════════════════════════════════════

export interface HotspotRankingExplanation {
  domain: string;
  rank: number;
  escalationCount: number;
  escalationRate: number;
  topSource: string;
  topSourceCount: number;
  whyThisRank: string;
  comparedTo: string;
}

export function buildHotspotRankingExplanations(
  hotspots: EscalationHotspot[],
): HotspotRankingExplanation[] {
  const sorted = [...hotspots].sort((a, b) => b.escalationCount - a.escalationCount);

  return sorted.map((h, idx) => {
    const topSource = h.sourceBreakdown[0];
    const nextHotspot = sorted[idx + 1];

    return {
      domain: h.domain,
      rank: idx + 1,
      escalationCount: h.escalationCount,
      escalationRate: h.escalationRate,
      topSource: topSource?.source || "없음",
      topSourceCount: topSource?.count || 0,
      whyThisRank: `${h.escalationCount}건 에스컬레이션 (${h.escalationRate}%) — 주요 원인: ${topSource?.source || "없음"} (${topSource?.count || 0}건)`,
      comparedTo: nextHotspot
        ? `다음 순위 ${DOMAIN_SHORT[nextHotspot.domain] || nextHotspot.domain}: ${nextHotspot.escalationCount}건 (차이: ${h.escalationCount - nextHotspot.escalationCount})`
        : "최하위",
    };
  });
}

// ══════════════════════════════════════════════
// 3. Reapproval Root-Cause Summary
// ══════════════════════════════════════════════

export interface ReapprovalRootCauseSummary {
  totalLoops: number;
  categoryCounts: Record<string, number>;
  dominantCategory: string;
  dominantPercentage: number;
  rootCauseExplanation: string;
  recommendedFix: string;
}

export function buildReapprovalRootCauseSummary(
  loops: Array<{ caseId: string; totalLoops: number; loopCategory: string }>,
): ReapprovalRootCauseSummary {
  const categoryCounts: Record<string, number> = {};
  let totalLoops = 0;

  for (const loop of loops) {
    totalLoops += loop.totalLoops;
    categoryCounts[loop.loopCategory] = (categoryCounts[loop.loopCategory] || 0) + loop.totalLoops;
  }

  let dominantCategory = "mixed";
  let maxCount = 0;
  for (const [cat, count] of Object.entries(categoryCounts)) {
    if (count > maxCount) { dominantCategory = cat; maxCount = count; }
  }
  const dominantPercentage = totalLoops > 0 ? Math.round((maxCount / totalLoops) * 100) : 0;

  const CAUSE_EXPLANATIONS: Record<string, string> = {
    policy_drift: "정책 변경(publish/rollback)이 기존 승인을 무효화하여 재승인 요구",
    payload_change: "승인 후 payload(금액/수량/대상) 변경으로 재승인 필요",
    snapshot_expiry: "승인 snapshot 유효기간 만료 — 승인-실행 간 시간 초과",
    mixed: "복합 원인 — 정책 변경 + payload 변경 + 만료 혼합",
  };

  const CAUSE_FIXES: Record<string, string> = {
    policy_drift: "정책 변경 빈도 줄이기 또는 publish 전 영향 시뮬레이션 활용",
    payload_change: "승인 전 payload 확정 프로세스 강화 또는 변경 허용 범위 설정",
    snapshot_expiry: "snapshot 유효기간 연장 또는 승인-실행 간 시간 단축",
    mixed: "재승인 발생 케이스별 원인 분석 후 개별 대응",
  };

  return {
    totalLoops,
    categoryCounts,
    dominantCategory,
    dominantPercentage,
    rootCauseExplanation: CAUSE_EXPLANATIONS[dominantCategory] || CAUSE_EXPLANATIONS.mixed,
    recommendedFix: CAUSE_FIXES[dominantCategory] || CAUSE_FIXES.mixed,
  };
}

// ══════════════════════════════════════════════
// 4. Policy Impact Delta Explanation
// ══════════════════════════════════════════════

export interface PolicyImpactDeltaExplanation {
  changeEventId: string;
  overallImpact: string;
  detailExplanation: string;
  deltaBreakdown: Array<{
    metric: string;
    beforeValue: number;
    afterValue: number;
    delta: number;
    direction: "up" | "down" | "same";
    significance: "major" | "minor" | "none";
  }>;
  operatorSummary: string;
}

export function buildPolicyImpactDeltaExplanation(impact: PolicyChangeImpact): PolicyImpactDeltaExplanation {
  const breakdown = [
    { metric: "승인 필요", before: impact.beforePeriod.approvalNeeded, after: impact.afterPeriod.approvalNeeded, delta: impact.approvalDelta },
    { metric: "이중 승인", before: impact.beforePeriod.dualNeeded, after: impact.afterPeriod.dualNeeded, delta: impact.dualDelta },
    { metric: "에스컬레이션", before: impact.beforePeriod.escalated, after: impact.afterPeriod.escalated, delta: impact.escalationDelta },
    { metric: "차단", before: impact.beforePeriod.blocked, after: impact.afterPeriod.blocked, delta: impact.blockDelta },
  ].map(m => ({
    metric: m.metric,
    beforeValue: m.before,
    afterValue: m.after,
    delta: m.delta,
    direction: (m.delta > 0 ? "up" : m.delta < 0 ? "down" : "same") as "up" | "down" | "same",
    significance: (Math.abs(m.delta) > 3 ? "major" : Math.abs(m.delta) > 0 ? "minor" : "none") as "major" | "minor" | "none",
  }));

  const majorChanges = breakdown.filter(b => b.significance === "major");
  const detailParts = majorChanges.map(m => `${m.metric} ${m.delta > 0 ? "+" : ""}${m.delta}`);

  return {
    changeEventId: impact.changeEventId,
    overallImpact: impact.overallImpact,
    detailExplanation: majorChanges.length > 0
      ? `주요 변동: ${detailParts.join(", ")}`
      : "경미한 변동 또는 변동 없음",
    deltaBreakdown: breakdown,
    operatorSummary: impact.overallImpact === "tightened"
      ? `정책 강화 — ${detailParts.length > 0 ? detailParts.join(", ") : "경미한 수준"}`
      : impact.overallImpact === "relaxed"
        ? `정책 완화 — ${detailParts.length > 0 ? detailParts.join(", ") : "경미한 수준"}`
        : impact.overallImpact === "mixed"
          ? `혼합 영향 — 일부 강화, 일부 완화`
          : "변동 없음",
  };
}

// ── Domain Labels ──
const DOMAIN_SHORT: Record<string, string> = {
  fire_execution: "발송", stock_release: "릴리스",
  exception_resolve: "예외해결", exception_return_to_stage: "예외복귀",
};
