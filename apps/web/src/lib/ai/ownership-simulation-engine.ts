/**
 * Ownership Simulation / Impact Preview Engine
 *
 * ownership 변경 전 영향 미리보기.
 * policy simulation과 같은 레벨.
 *
 * SIMULATION MODES:
 * 1. backlog_redistribution — reassign 후 backlog 재분배 영향
 * 2. sla_risk_change — owner 변경 후 SLA breach risk 변동
 * 3. escalation_path_change — escalation 경로 변경 영향
 * 4. ownerless_impact — deactivate 후 ownerless 건 수
 * 5. overload_migration — reassign이 새 과부하를 만드는지
 * 6. transfer_impact — site/team transfer 전체 영향
 */

import type { OwnershipRecord, OwnershipType } from "./multi-team-ownership-engine";
import type { OwnerMetrics } from "./ownership-aware-governance-metrics";
import type { ApprovalInboxItemV2, ApprovalDomain } from "./approval-inbox-projection-v2-engine";

// ══════════════════════════════════════════════
// Simulation Result
// ══════════════════════════════════════════════

export interface OwnershipSimulationResult {
  simulationId: string;
  // Backlog redistribution
  backlogBefore: Record<string, number>; // ownerId → count
  backlogAfter: Record<string, number>;
  backlogDelta: Record<string, number>;
  // SLA risk
  slaBefore: { totalAtRisk: number; owners: string[] };
  slaAfter: { totalAtRisk: number; owners: string[] };
  slaRiskChange: "improved" | "worsened" | "neutral";
  // Escalation path
  escalationPathChanged: boolean;
  escalationPathBefore: string[];
  escalationPathAfter: string[];
  // Ownerless
  ownerlessBefore: number;
  ownerlessAfter: number;
  ownerlessDelta: number;
  newOwnerlessItems: string[];
  // Overload
  overloadedBefore: string[];
  overloadedAfter: string[];
  newOverloaded: string[];
  overloadResolved: string[];
  // Overall
  overallImpact: "positive" | "negative" | "neutral" | "mixed";
  warnings: string[];
  recommendations: string[];
  generatedAt: string;
}

// ══════════════════════════════════════════════
// Run Simulation
// ══════════════════════════════════════════════

export function simulateOwnershipChange(
  beforeRecords: OwnershipRecord[],
  afterRecords: OwnershipRecord[],
  inboxItems: ApprovalInboxItemV2[],
  currentOwnerMetrics: OwnerMetrics[],
): OwnershipSimulationResult {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // 1. Backlog redistribution
  const backlogBefore = computeBacklogDistribution(beforeRecords, inboxItems);
  const backlogAfter = computeBacklogDistribution(afterRecords, inboxItems);
  const backlogDelta: Record<string, number> = {};
  const allOwnerIds = new Set([...Object.keys(backlogBefore), ...Object.keys(backlogAfter)]);
  for (const id of allOwnerIds) {
    backlogDelta[id] = (backlogAfter[id] || 0) - (backlogBefore[id] || 0);
  }

  // 2. SLA risk
  const slaThreshold = 50; // load score > 50 = at risk
  const slaBefore = {
    totalAtRisk: currentOwnerMetrics.filter(m => m.loadScore > slaThreshold).length,
    owners: currentOwnerMetrics.filter(m => m.loadScore > slaThreshold).map(m => m.ownerId),
  };
  // Estimate after by adjusting load based on backlog delta
  const slaAfterOwners: string[] = [];
  for (const m of currentOwnerMetrics) {
    const delta = backlogDelta[m.ownerId] || 0;
    const estimatedLoad = m.loadScore + delta * 5;
    if (estimatedLoad > slaThreshold) slaAfterOwners.push(m.ownerId);
  }
  const slaAfter = { totalAtRisk: slaAfterOwners.length, owners: slaAfterOwners };
  const slaRiskChange: OwnershipSimulationResult["slaRiskChange"] =
    slaAfter.totalAtRisk < slaBefore.totalAtRisk ? "improved" :
    slaAfter.totalAtRisk > slaBefore.totalAtRisk ? "worsened" : "neutral";

  if (slaRiskChange === "worsened") warnings.push(`SLA risk 증가: ${slaBefore.totalAtRisk} → ${slaAfter.totalAtRisk}명`);

  // 3. Escalation path
  const escBefore = beforeRecords.filter(r => r.ownershipType === "escalation_owner" && r.active).map(r => r.ownerId);
  const escAfter = afterRecords.filter(r => r.ownershipType === "escalation_owner" && r.active).map(r => r.ownerId);
  const escalationPathChanged = JSON.stringify(escBefore.sort()) !== JSON.stringify(escAfter.sort());
  if (escalationPathChanged) warnings.push("에스컬레이션 경로 변경됨");

  // 4. Ownerless impact
  const ownerlessBefore = countOwnerless(beforeRecords, inboxItems);
  const ownerlessAfter = countOwnerless(afterRecords, inboxItems);
  const ownerlessDelta = ownerlessAfter - ownerlessBefore;
  if (ownerlessDelta > 0) warnings.push(`미지정 건 ${ownerlessDelta}건 증가`);
  if (ownerlessDelta > 3) recommendations.push("deactivate 전 대체 owner 배정 필요");

  const newOwnerlessItems: string[] = [];
  if (ownerlessDelta > 0) {
    // Simplified: items whose domain had active owner before but not after
    const beforeDomains = new Set(beforeRecords.filter(r => r.active).map(r => r.domain));
    const afterDomains = new Set(afterRecords.filter(r => r.active).map(r => r.domain));
    for (const item of inboxItems) {
      if (beforeDomains.has(item.domain) && !afterDomains.has(item.domain)) {
        newOwnerlessItems.push(item.inboxItemId);
      }
    }
  }

  // 5. Overload
  const overloadThreshold = 80;
  const overloadedBefore = currentOwnerMetrics.filter(m => m.loadScore >= overloadThreshold).map(m => m.ownerId);
  const overloadedAfter: string[] = [];
  for (const m of currentOwnerMetrics) {
    const delta = backlogDelta[m.ownerId] || 0;
    if (m.loadScore + delta * 5 >= overloadThreshold) overloadedAfter.push(m.ownerId);
  }
  const newOverloaded = overloadedAfter.filter(id => !overloadedBefore.includes(id));
  const overloadResolved = overloadedBefore.filter(id => !overloadedAfter.includes(id));

  if (newOverloaded.length > 0) warnings.push(`새 과부하 owner ${newOverloaded.length}명 발생`);
  if (overloadResolved.length > 0) recommendations.push(`${overloadResolved.length}명 과부하 해소`);

  // Overall impact
  let positiveSignals = 0;
  let negativeSignals = 0;
  if (slaRiskChange === "improved") positiveSignals++;
  if (slaRiskChange === "worsened") negativeSignals++;
  if (ownerlessDelta < 0) positiveSignals++;
  if (ownerlessDelta > 0) negativeSignals++;
  if (overloadResolved.length > 0) positiveSignals++;
  if (newOverloaded.length > 0) negativeSignals++;

  const overallImpact: OwnershipSimulationResult["overallImpact"] =
    positiveSignals > 0 && negativeSignals === 0 ? "positive" :
    negativeSignals > 0 && positiveSignals === 0 ? "negative" :
    positiveSignals > 0 && negativeSignals > 0 ? "mixed" : "neutral";

  return {
    simulationId: `ownsim_${Date.now().toString(36)}`,
    backlogBefore, backlogAfter, backlogDelta,
    slaBefore, slaAfter, slaRiskChange,
    escalationPathChanged, escalationPathBefore: escBefore, escalationPathAfter: escAfter,
    ownerlessBefore, ownerlessAfter, ownerlessDelta, newOwnerlessItems,
    overloadedBefore, overloadedAfter, newOverloaded, overloadResolved,
    overallImpact, warnings, recommendations,
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════

function computeBacklogDistribution(
  records: OwnershipRecord[],
  items: ApprovalInboxItemV2[],
): Record<string, number> {
  const dist: Record<string, number> = {};
  const activeOwners = records.filter(r => r.active && r.ownershipType === "approval_owner");

  for (const item of items) {
    // Find matching owner for this item's domain
    const matchingOwner = activeOwners.find(r =>
      (r.domain === item.domain || r.domain === "all" || r.domain === null)
    );
    const ownerId = item.assignedApprover || matchingOwner?.ownerId || "unassigned";
    dist[ownerId] = (dist[ownerId] || 0) + 1;
  }

  return dist;
}

function countOwnerless(
  records: OwnershipRecord[],
  items: ApprovalInboxItemV2[],
): number {
  const activeDomains = new Set(
    records.filter(r => r.active && r.ownershipType === "approval_owner").map(r => r.domain)
  );
  const hasAllDomain = records.some(r => r.active && r.ownershipType === "approval_owner" && (r.domain === "all" || r.domain === null));

  if (hasAllDomain) return 0;

  return items.filter(item => !activeDomains.has(item.domain) && !item.assignedApprover).length;
}
