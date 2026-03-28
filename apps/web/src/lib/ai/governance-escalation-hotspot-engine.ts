/**
 * Governance Escalation Hotspot + Reapproval Loop + Policy Impact Trend Engines
 *
 * 3개 분석 엔진을 하나의 파일에 통합:
 * 1. Escalation Hotspot — domain별 escalation source 분해 + hotspot cluster
 * 2. Reapproval Loop Analyzer — stale/reapproval 반복 횟수 + snapshot invalidation 빈도
 * 3. Policy Impact Trend — publish/rollback 이후 approval/escalation/block 추세
 */

import type { ApprovalDomain } from "./approval-inbox-projection-v2-engine";
import type { ApprovalHistoryRecord } from "./approval-governance-metrics-engine";
import type { EffectiveEscalationSource } from "./policy-approval-conflict-diagnostics-engine";

// ══════════════════════════════════════════════
// 1. Escalation Hotspot
// ══════════════════════════════════════════════

export interface EscalationHotspot {
  domain: ApprovalDomain;
  escalationCount: number;
  escalationRate: number;
  sourceBreakdown: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  topCases: Array<{
    caseId: string;
    escalationCount: number;
    lastEscalatedAt: string;
  }>;
}

export interface EscalationHotspotSummary {
  hotspots: EscalationHotspot[];
  totalEscalations: number;
  hottestDomain: ApprovalDomain | null;
  hottestSource: string | null;
  generatedAt: string;
}

export function analyzeEscalationHotspots(
  history: ApprovalHistoryRecord[],
): EscalationHotspotSummary {
  const escalated = history.filter(h => h.decision === "escalated");
  const domains: ApprovalDomain[] = ["fire_execution", "stock_release", "exception_resolve", "exception_return_to_stage"];

  const hotspots: EscalationHotspot[] = domains.map(domain => {
    const domainEsc = escalated.filter(h => h.domain === domain);
    const domainTotal = history.filter(h => h.domain === domain).length;

    // Source breakdown from blocker reasons
    const sourceCounts = new Map<string, number>();
    for (const h of domainEsc) {
      for (const reason of h.blockerReasons) {
        const source = reason.split(":")[0] || "unknown";
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      }
    }

    const sourceBreakdown = [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({
        source,
        count,
        percentage: domainEsc.length > 0 ? Math.round((count / domainEsc.length) * 100) : 0,
      }));

    // Top cases
    const caseCounts = new Map<string, { count: number; lastAt: string }>();
    for (const h of domainEsc) {
      const existing = caseCounts.get(h.caseId) || { count: 0, lastAt: "" };
      existing.count++;
      if (h.decidedAt && h.decidedAt > existing.lastAt) existing.lastAt = h.decidedAt;
      caseCounts.set(h.caseId, existing);
    }

    const topCases = [...caseCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([caseId, data]) => ({ caseId, escalationCount: data.count, lastEscalatedAt: data.lastAt }));

    return {
      domain,
      escalationCount: domainEsc.length,
      escalationRate: domainTotal > 0 ? Math.round((domainEsc.length / domainTotal) * 100) : 0,
      sourceBreakdown,
      topCases,
    };
  }).filter(h => h.escalationCount > 0);

  hotspots.sort((a, b) => b.escalationCount - a.escalationCount);

  // Global top source
  const allSources = new Map<string, number>();
  for (const h of hotspots) {
    for (const s of h.sourceBreakdown) {
      allSources.set(s.source, (allSources.get(s.source) || 0) + s.count);
    }
  }
  let hottestSource: string | null = null;
  let maxSourceCount = 0;
  for (const [source, count] of allSources) {
    if (count > maxSourceCount) { hottestSource = source; maxSourceCount = count; }
  }

  return {
    hotspots,
    totalEscalations: escalated.length,
    hottestDomain: hotspots.length > 0 ? hotspots[0].domain : null,
    hottestSource,
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════
// 2. Reapproval Loop Analyzer
// ══════════════════════════════════════════════

export interface ReapprovalLoopAnalysis {
  totalReapprovals: number;
  totalSnapshotInvalidations: number;
  caseLoops: Array<{
    caseId: string;
    domain: ApprovalDomain;
    reapprovalCount: number;
    invalidationCount: number;
    loopCategory: "policy_drift" | "payload_change" | "snapshot_expiry" | "mixed";
  }>;
  domainBreakdown: Array<{
    domain: ApprovalDomain;
    reapprovalCount: number;
    invalidationCount: number;
    loopRate: number;
  }>;
  topRepeaters: Array<{
    caseId: string;
    totalLoops: number;
    lastOccurrence: string;
  }>;
  trend: "increasing" | "stable" | "decreasing" | "unknown";
  generatedAt: string;
}

export function analyzeReapprovalLoops(
  history: ApprovalHistoryRecord[],
): ReapprovalLoopAnalysis {
  const reapproved = history.filter(h => h.reapprovalCount > 0);
  const invalidated = history.filter(h => h.snapshotInvalidated);
  const domains: ApprovalDomain[] = ["fire_execution", "stock_release", "exception_resolve", "exception_return_to_stage"];

  // Case loops
  const caseMap = new Map<string, { domain: ApprovalDomain; reapprovals: number; invalidations: number; reasons: Set<string> }>();
  for (const h of history) {
    const key = `${h.caseId}_${h.domain}`;
    const existing = caseMap.get(key) || { domain: h.domain, reapprovals: 0, invalidations: 0, reasons: new Set<string>() };
    existing.reapprovals += h.reapprovalCount;
    if (h.snapshotInvalidated) {
      existing.invalidations++;
      existing.reasons.add("snapshot_invalidated");
    }
    caseMap.set(key, existing);
  }

  const caseLoops = [...caseMap.entries()]
    .filter(([_, data]) => data.reapprovals > 0 || data.invalidations > 0)
    .map(([key, data]) => {
      const caseId = key.split("_")[0];
      let loopCategory: "policy_drift" | "payload_change" | "snapshot_expiry" | "mixed" = "mixed";
      if (data.reasons.size === 1) {
        loopCategory = data.reasons.has("snapshot_invalidated") ? "policy_drift" : "payload_change";
      }
      return { caseId, domain: data.domain, reapprovalCount: data.reapprovals, invalidationCount: data.invalidations, loopCategory };
    })
    .sort((a, b) => b.reapprovalCount - a.reapprovalCount);

  // Domain breakdown
  const domainBreakdown = domains.map(domain => {
    const domainHist = history.filter(h => h.domain === domain);
    const domainReapprovals = domainHist.filter(h => h.reapprovalCount > 0).length;
    const domainInvalidations = domainHist.filter(h => h.snapshotInvalidated).length;
    return {
      domain,
      reapprovalCount: domainReapprovals,
      invalidationCount: domainInvalidations,
      loopRate: domainHist.length > 0 ? Math.round((domainReapprovals / domainHist.length) * 100) : 0,
    };
  });

  // Top repeaters
  const repeaterMap = new Map<string, { total: number; last: string }>();
  for (const h of reapproved) {
    const existing = repeaterMap.get(h.caseId) || { total: 0, last: "" };
    existing.total += h.reapprovalCount;
    if (h.decidedAt && h.decidedAt > existing.last) existing.last = h.decidedAt;
    repeaterMap.set(h.caseId, existing);
  }
  const topRepeaters = [...repeaterMap.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([caseId, data]) => ({ caseId, totalLoops: data.total, lastOccurrence: data.last }));

  return {
    totalReapprovals: reapproved.length,
    totalSnapshotInvalidations: invalidated.length,
    caseLoops,
    domainBreakdown,
    topRepeaters,
    trend: "unknown",
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════
// 3. Policy Impact Trend
// ══════════════════════════════════════════════

export interface PolicyChangeImpact {
  changeEventId: string;
  changeType: "publish" | "rollback";
  policyDomain: string;
  changedAt: string;
  // Before/After counts (7-day window)
  beforePeriod: { approvalNeeded: number; dualNeeded: number; escalated: number; blocked: number };
  afterPeriod: { approvalNeeded: number; dualNeeded: number; escalated: number; blocked: number };
  // Deltas
  approvalDelta: number;
  dualDelta: number;
  escalationDelta: number;
  blockDelta: number;
  overallImpact: "tightened" | "relaxed" | "mixed" | "neutral";
}

export interface PolicyImpactTrendSummary {
  changes: PolicyChangeImpact[];
  totalPublishes: number;
  totalRollbacks: number;
  netTighteningEvents: number;
  netRelaxingEvents: number;
  mostImpactfulChange: PolicyChangeImpact | null;
  generatedAt: string;
}

export function analyzePolicyImpactTrend(
  policyChanges: Array<{
    changeEventId: string;
    changeType: "publish" | "rollback";
    policyDomain: string;
    changedAt: string;
  }>,
  historyBefore: ApprovalHistoryRecord[],
  historyAfter: ApprovalHistoryRecord[],
): PolicyImpactTrendSummary {
  const changes: PolicyChangeImpact[] = policyChanges.map(change => {
    const beforeApproval = historyBefore.filter(h => h.decision === "pending" || h.decision === "approved").length;
    const afterApproval = historyAfter.filter(h => h.decision === "pending" || h.decision === "approved").length;
    const beforeDual = historyBefore.filter(h => h.dualApprovalUsed).length;
    const afterDual = historyAfter.filter(h => h.dualApprovalUsed).length;
    const beforeEsc = historyBefore.filter(h => h.decision === "escalated").length;
    const afterEsc = historyAfter.filter(h => h.decision === "escalated").length;
    const beforeBlock = historyBefore.filter(h => h.blockerReasons.length > 0).length;
    const afterBlock = historyAfter.filter(h => h.blockerReasons.length > 0).length;

    const approvalDelta = afterApproval - beforeApproval;
    const dualDelta = afterDual - beforeDual;
    const escalationDelta = afterEsc - beforeEsc;
    const blockDelta = afterBlock - beforeBlock;

    const totalDelta = approvalDelta + dualDelta + escalationDelta + blockDelta;
    const overallImpact: PolicyChangeImpact["overallImpact"] =
      totalDelta > 2 ? "tightened" : totalDelta < -2 ? "relaxed" : totalDelta !== 0 ? "mixed" : "neutral";

    return {
      changeEventId: change.changeEventId,
      changeType: change.changeType,
      policyDomain: change.policyDomain,
      changedAt: change.changedAt,
      beforePeriod: { approvalNeeded: beforeApproval, dualNeeded: beforeDual, escalated: beforeEsc, blocked: beforeBlock },
      afterPeriod: { approvalNeeded: afterApproval, dualNeeded: afterDual, escalated: afterEsc, blocked: afterBlock },
      approvalDelta, dualDelta, escalationDelta, blockDelta,
      overallImpact,
    };
  });

  const tightening = changes.filter(c => c.overallImpact === "tightened").length;
  const relaxing = changes.filter(c => c.overallImpact === "relaxed").length;

  // Most impactful = highest absolute total delta
  let mostImpactful: PolicyChangeImpact | null = null;
  let maxAbsDelta = 0;
  for (const c of changes) {
    const abs = Math.abs(c.approvalDelta) + Math.abs(c.dualDelta) + Math.abs(c.escalationDelta) + Math.abs(c.blockDelta);
    if (abs > maxAbsDelta) { mostImpactful = c; maxAbsDelta = abs; }
  }

  return {
    changes,
    totalPublishes: policyChanges.filter(c => c.changeType === "publish").length,
    totalRollbacks: policyChanges.filter(c => c.changeType === "rollback").length,
    netTighteningEvents: tightening,
    netRelaxingEvents: relaxing,
    mostImpactfulChange: mostImpactful,
    generatedAt: new Date().toISOString(),
  };
}
