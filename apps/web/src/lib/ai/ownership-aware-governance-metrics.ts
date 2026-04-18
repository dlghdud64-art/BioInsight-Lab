/**
 * Ownership-aware Governance Metrics — owner별 backlog/SLA/overload 분석
 *
 * ownership engine의 ResolvedOwner를 기반으로 owner별 운영 지표 계산.
 * unassigned/overloaded owner 탐지 포함.
 */

import type { ApprovalInboxItemV2, ApprovalDomain } from "./approval-inbox-projection-v2-engine";
import type { ApprovalHistoryRecord } from "./approval-governance-metrics-engine";
import type { ResolvedOwner, OwnershipType } from "./multi-team-ownership-engine";

// ── Owner Metrics ──
export interface OwnerMetrics {
  ownerId: string;
  ownerName: string;
  ownerRole: string;
  ownershipType: OwnershipType;
  // Backlog
  pendingCount: number;
  oldestPendingAgeMinutes: number;
  // Performance
  avgLeadTimeMinutes: number;
  completedCount: number;
  // SLA
  slaBreachCount: number;
  slaBreachRate: number;
  // Issues
  escalationCount: number;
  reapprovalCount: number;
  // Load
  loadScore: number; // 0-100
  loadLevel: "low" | "normal" | "high" | "overloaded";
  // Domain breakdown
  domainCounts: Record<string, number>;
}

// ── Owner Load Thresholds ──
const LOAD_THRESHOLDS = {
  overloaded: 80,
  high: 50,
  normal: 20,
};

// ── Compute Owner Metrics ──
export function computeOwnerMetrics(
  ownerId: string,
  ownerName: string,
  ownerRole: string,
  ownershipType: OwnershipType,
  inbox: ApprovalInboxItemV2[],
  history: ApprovalHistoryRecord[],
): OwnerMetrics {
  const ownerInbox = inbox.filter(i => i.assignedApprover === ownerId || i.assignedApprover === null);
  const ownerHistory = history.filter(h => h.decision !== "pending");

  const pendingCount = ownerInbox.length;
  const oldestAge = ownerInbox.length > 0 ? Math.max(...ownerInbox.map(i => i.ageMinutes)) : 0;

  const leadTimes = ownerHistory.filter(h => h.leadTimeMinutes !== null).map(h => h.leadTimeMinutes!);
  const avgLeadTime = leadTimes.length > 0 ? Math.round(leadTimes.reduce((s, v) => s + v, 0) / leadTimes.length) : 0;

  const slaBreachCount = ownerHistory.filter(h => h.slaBreached).length;
  const slaBreachRate = ownerHistory.length > 0 ? Math.round((slaBreachCount / ownerHistory.length) * 100) : 0;

  const escalationCount = ownerHistory.filter(h => h.decision === "escalated").length;
  const reapprovalCount = ownerHistory.filter(h => h.reapprovalCount > 0).length;

  // Load score
  const loadScore = Math.min(100, Math.round(
    pendingCount * 5 + (oldestAge / 60) * 2 + slaBreachRate * 0.5 + escalationCount * 3
  ));
  const loadLevel: OwnerMetrics["loadLevel"] =
    loadScore >= LOAD_THRESHOLDS.overloaded ? "overloaded" :
    loadScore >= LOAD_THRESHOLDS.high ? "high" :
    loadScore >= LOAD_THRESHOLDS.normal ? "normal" : "low";

  // Domain breakdown
  const domainCounts: Record<string, number> = {};
  for (const item of ownerInbox) {
    domainCounts[item.domain] = (domainCounts[item.domain] || 0) + 1;
  }

  return {
    ownerId, ownerName, ownerRole, ownershipType,
    pendingCount, oldestPendingAgeMinutes: oldestAge,
    avgLeadTimeMinutes: avgLeadTime,
    completedCount: ownerHistory.length,
    slaBreachCount, slaBreachRate,
    escalationCount, reapprovalCount,
    loadScore, loadLevel,
    domainCounts,
  };
}

// ── Unassigned Detection ──
export interface UnassignedDetection {
  items: ApprovalInboxItemV2[];
  count: number;
  domains: ApprovalDomain[];
  oldestAgeMinutes: number;
  urgentCount: number;
}

export function detectUnassignedItems(inbox: ApprovalInboxItemV2[]): UnassignedDetection {
  const unassigned = inbox.filter(i => !i.assignedApprover);
  const domains = [...new Set(unassigned.map(i => i.domain))];
  const urgent = unassigned.filter(i => i.urgencyLevel === "critical" || i.urgencyLevel === "high");

  return {
    items: unassigned,
    count: unassigned.length,
    domains,
    oldestAgeMinutes: unassigned.length > 0 ? Math.max(...unassigned.map(i => i.ageMinutes)) : 0,
    urgentCount: urgent.length,
  };
}

// ── Overloaded Owner Detection ──
export interface OverloadedOwnerDetection {
  overloadedOwners: OwnerMetrics[];
  totalOverloaded: number;
  avgLoadScore: number;
  recommendedRebalance: Array<{
    fromOwnerId: string;
    fromOwnerName: string;
    excessCount: number;
    suggestedAction: string;
  }>;
}

export function detectOverloadedOwners(ownerMetrics: OwnerMetrics[]): OverloadedOwnerDetection {
  const overloaded = ownerMetrics.filter(m => m.loadLevel === "overloaded");
  const avgLoad = ownerMetrics.length > 0
    ? Math.round(ownerMetrics.reduce((s, m) => s + m.loadScore, 0) / ownerMetrics.length)
    : 0;

  const recommendedRebalance = overloaded.map(m => {
    const avgPending = ownerMetrics.length > 0
      ? Math.round(ownerMetrics.reduce((s, o) => s + o.pendingCount, 0) / ownerMetrics.length)
      : 0;
    const excess = Math.max(0, m.pendingCount - avgPending);

    return {
      fromOwnerId: m.ownerId,
      fromOwnerName: m.ownerName,
      excessCount: excess,
      suggestedAction: excess > 0
        ? `${excess}건을 다른 담당자에게 재배정 권장`
        : "SLA breach 개선 필요 — 처리 속도 확인",
    };
  });

  return {
    overloadedOwners: overloaded,
    totalOverloaded: overloaded.length,
    avgLoadScore: avgLoad,
    recommendedRebalance,
  };
}

// ── Ownership Coverage Summary ──
export interface OwnershipCoverageSummary {
  totalItems: number;
  assignedCount: number;
  unassignedCount: number;
  coverageRate: number;
  ownerCount: number;
  overloadedCount: number;
  avgLoadScore: number;
  healthStatus: "healthy" | "attention" | "critical";
  generatedAt: string;
}

export function computeOwnershipCoverage(
  inbox: ApprovalInboxItemV2[],
  ownerMetrics: OwnerMetrics[],
): OwnershipCoverageSummary {
  const assigned = inbox.filter(i => i.assignedApprover).length;
  const unassigned = inbox.length - assigned;
  const coverageRate = inbox.length > 0 ? Math.round((assigned / inbox.length) * 100) : 100;
  const overloaded = ownerMetrics.filter(m => m.loadLevel === "overloaded").length;
  const avgLoad = ownerMetrics.length > 0
    ? Math.round(ownerMetrics.reduce((s, m) => s + m.loadScore, 0) / ownerMetrics.length)
    : 0;

  let healthStatus: OwnershipCoverageSummary["healthStatus"] = "healthy";
  if (unassigned > 5 || overloaded > 2 || coverageRate < 70) healthStatus = "critical";
  else if (unassigned > 0 || overloaded > 0 || coverageRate < 90) healthStatus = "attention";

  return {
    totalItems: inbox.length,
    assignedCount: assigned,
    unassignedCount: unassigned,
    coverageRate,
    ownerCount: ownerMetrics.length,
    overloadedCount: overloaded,
    avgLoadScore: avgLoad,
    healthStatus,
    generatedAt: new Date().toISOString(),
  };
}
