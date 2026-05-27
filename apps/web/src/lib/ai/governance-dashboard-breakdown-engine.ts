/**
 * Governance Dashboard Breakdown Engine — team/site 단위 운영 병목 분석
 *
 * 조직 단위로 approval backlog, SLA, escalation, reapproval을 보여줌.
 * 차트가 아니라 **운영 개입 우선순위 면**.
 *
 * BREAKDOWN DIMENSIONS:
 * - team / department / site
 * - domain (fire / stock / exception)
 * - urgency (critical / high / medium / low)
 */

import type { ApprovalDomain, ApprovalUrgencyLevel, ApprovalInboxItemV2 } from "./approval-inbox-projection-v2-engine";
import type { ApprovalHistoryRecord } from "./approval-governance-metrics-engine";

// ── Breakdown Key ──
export type BreakdownDimension = "team" | "department" | "site" | "domain";

// ── Breakdown Record ──
export interface BreakdownRecord {
  dimensionType: BreakdownDimension;
  dimensionId: string;
  dimensionLabel: string;
  // Backlog
  pendingCount: number;
  oldestPendingAgeMinutes: number;
  // Performance
  avgLeadTimeMinutes: number;
  slaBreachCount: number;
  slaBreachRate: number;
  // Issues
  escalationCount: number;
  escalationRate: number;
  reapprovalCount: number;
  reapprovalRate: number;
  // Dual approval
  dualApprovalPendingCount: number;
  avgDualApprovalLatencyMinutes: number;
  // Risk
  riskScore: number; // 0-100, composite
  riskLevel: "low" | "medium" | "high" | "critical";
  topBlocker: string;
  // Deep link
  drilldownFilterKey: string;
  drilldownFilterValue: string;
}

// ── Breakdown Summary ──
export interface GovernanceBreakdownSummary {
  dimension: BreakdownDimension;
  records: BreakdownRecord[];
  totalGroups: number;
  highRiskCount: number;
  criticalCount: number;
  hottestGroup: BreakdownRecord | null;
  generatedAt: string;
}

// ── Compute Breakdown ──
export function computeGovernanceBreakdown(
  dimension: BreakdownDimension,
  inboxItems: ApprovalInboxItemV2[],
  history: ApprovalHistoryRecord[],
  getDimensionId: (item: ApprovalInboxItemV2) => string,
  getDimensionLabel: (id: string) => string,
  getHistoryDimensionId: (record: ApprovalHistoryRecord) => string,
): GovernanceBreakdownSummary {
  // Group inbox items
  const groups = new Map<string, ApprovalInboxItemV2[]>();
  for (const item of inboxItems) {
    const id = getDimensionId(item);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(item);
  }

  // Group history
  const historyGroups = new Map<string, ApprovalHistoryRecord[]>();
  for (const rec of history) {
    const id = getHistoryDimensionId(rec);
    if (!historyGroups.has(id)) historyGroups.set(id, []);
    historyGroups.get(id)!.push(rec);
  }

  // Merge all known group IDs
  const allIds = new Set([...groups.keys(), ...historyGroups.keys()]);

  const records: BreakdownRecord[] = [];
  for (const id of allIds) {
    const items = groups.get(id) || [];
    const hist = historyGroups.get(id) || [];

    const pendingCount = items.length;
    const oldestAge = items.length > 0 ? Math.max(...items.map(i => i.ageMinutes)) : 0;

    const decidedHist = hist.filter(h => h.leadTimeMinutes !== null);
    const avgLeadTime = decidedHist.length > 0 ? Math.round(decidedHist.reduce((s, h) => s + h.leadTimeMinutes!, 0) / decidedHist.length) : 0;

    const slaBreachCount = hist.filter(h => h.slaBreached).length;
    const slaBreachRate = hist.length > 0 ? Math.round((slaBreachCount / hist.length) * 100) : 0;

    const escalationCount = hist.filter(h => h.decision === "escalated").length;
    const escalationRate = hist.length > 0 ? Math.round((escalationCount / hist.length) * 100) : 0;

    const reapprovalCount = hist.filter(h => h.reapprovalCount > 0).length;
    const reapprovalRate = hist.length > 0 ? Math.round((reapprovalCount / hist.length) * 100) : 0;

    const dualPending = items.filter(i => i.dualApprovalRequired).length;
    const dualHist = decidedHist.filter(h => h.dualApprovalUsed && h.dualApprovalCompletionMinutes !== null);
    const avgDualLatency = dualHist.length > 0 ? Math.round(dualHist.reduce((s, h) => s + h.dualApprovalCompletionMinutes!, 0) / dualHist.length) : 0;

    // Risk score (composite)
    const riskScore = Math.min(100, Math.round(
      (slaBreachRate * 0.3) + (escalationRate * 0.25) + (reapprovalRate * 0.2) +
      (Math.min(100, oldestAge / 4.8) * 0.15) + (Math.min(100, pendingCount * 10) * 0.1)
    ));
    const riskLevel: BreakdownRecord["riskLevel"] = riskScore >= 70 ? "critical" : riskScore >= 50 ? "high" : riskScore >= 25 ? "medium" : "low";

    // Top blocker
    const blockerCounts = new Map<string, number>();
    for (const h of hist) {
      for (const reason of h.blockerReasons) {
        blockerCounts.set(reason, (blockerCounts.get(reason) || 0) + 1);
      }
    }
    let topBlocker = "";
    let topBlockerCount = 0;
    for (const [reason, count] of blockerCounts) {
      if (count > topBlockerCount) { topBlocker = reason; topBlockerCount = count; }
    }

    records.push({
      dimensionType: dimension,
      dimensionId: id,
      dimensionLabel: getDimensionLabel(id),
      pendingCount, oldestPendingAgeMinutes: oldestAge,
      avgLeadTimeMinutes: avgLeadTime,
      slaBreachCount, slaBreachRate,
      escalationCount, escalationRate,
      reapprovalCount, reapprovalRate,
      dualApprovalPendingCount: dualPending,
      avgDualApprovalLatencyMinutes: avgDualLatency,
      riskScore, riskLevel, topBlocker,
      drilldownFilterKey: dimension === "domain" ? "domain" : "assignee",
      drilldownFilterValue: id,
    });
  }

  // Sort by risk score descending
  records.sort((a, b) => b.riskScore - a.riskScore);

  return {
    dimension,
    records,
    totalGroups: records.length,
    highRiskCount: records.filter(r => r.riskLevel === "high" || r.riskLevel === "critical").length,
    criticalCount: records.filter(r => r.riskLevel === "critical").length,
    hottestGroup: records.length > 0 ? records[0] : null,
    generatedAt: new Date().toISOString(),
  };
}
