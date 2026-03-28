/**
 * Approval Priority Ranking v2 Engine — inbox items 우선순위 정렬
 *
 * approver가 "지금 무엇을 먼저 봐야 하는가"를 판단할 수 있도록 정렬.
 *
 * RANKING FACTORS (가중치 순):
 * 1. urgency level (critical > high > medium > low) — 40%
 * 2. snapshot expiry proximity — 20%
 * 3. SLA breach status — 15%
 * 4. risk tier (tier3 > tier2 > tier1) — 10%
 * 5. reapproval / escalation status — 10%
 * 6. age — 5%
 *
 * OUTPUT: ranked list with score + rank reason
 */

import type { ApprovalInboxItemV2, ApprovalUrgencyLevel, ApprovalDomain } from "./approval-inbox-projection-v2-engine";
import type { ActionRiskTier } from "./dispatch-v2-permission-policy-engine";

// ── Ranking Score Breakdown ──
export interface ApprovalRankingScore {
  totalScore: number;
  urgencyScore: number;
  expiryScore: number;
  slaScore: number;
  riskTierScore: number;
  statusScore: number;
  ageScore: number;
  rankReason: string;
}

// ── Ranked Item ──
export interface RankedApprovalItemV2 {
  rank: number;
  item: ApprovalInboxItemV2;
  score: ApprovalRankingScore;
}

// ── Weight Configuration ──
const WEIGHTS = {
  urgency: 40,
  expiry: 20,
  sla: 15,
  riskTier: 10,
  status: 10,
  age: 5,
};

// ── Score Maps ──
const URGENCY_SCORES: Record<ApprovalUrgencyLevel, number> = { critical: 100, high: 75, medium: 50, low: 25 };
const RISK_TIER_SCORES: Record<ActionRiskTier, number> = { tier3_irreversible: 100, tier2_org_impact: 60, tier1_routine: 20 };

// ── Compute Score ──
function computeItemScore(item: ApprovalInboxItemV2, now: Date): ApprovalRankingScore {
  // 1. Urgency
  const urgencyScore = URGENCY_SCORES[item.urgencyLevel];

  // 2. Expiry proximity (0-100, higher = more urgent)
  let expiryScore = 0;
  if (item.snapshotExpiresAt) {
    const timeToExpiry = new Date(item.snapshotExpiresAt).getTime() - now.getTime();
    const hoursToExpiry = timeToExpiry / (60 * 60 * 1000);
    if (hoursToExpiry <= 0) expiryScore = 100; // already expired
    else if (hoursToExpiry <= 1) expiryScore = 90;
    else if (hoursToExpiry <= 2) expiryScore = 70;
    else if (hoursToExpiry <= 4) expiryScore = 50;
    else if (hoursToExpiry <= 8) expiryScore = 30;
    else if (hoursToExpiry <= 12) expiryScore = 15;
    else expiryScore = 5;
  }

  // 3. SLA breach
  const slaScore = item.slaBreached ? 100 : (item.ageMinutes > 360 ? 50 : (item.ageMinutes > 120 ? 25 : 0));

  // 4. Risk tier
  const riskTierScore = RISK_TIER_SCORES[item.riskTier];

  // 5. Status (reapproval/escalation/invalidation boost)
  let statusScore = 0;
  if (item.itemStatus === "reapproval_required") statusScore = 80;
  else if (item.itemStatus === "escalation_pending") statusScore = 90;
  else if (item.itemStatus === "expired_needs_action") statusScore = 100;
  else if (item.snapshotInvalidated) statusScore = 70;
  else if (item.sodViolationDetected) statusScore = 60;
  else if (item.itemStatus === "change_requested") statusScore = 40;
  else if (item.itemStatus === "pending_review") statusScore = 20;
  else if (item.itemStatus === "in_review") statusScore = 10;

  // 6. Age (logarithmic — older items gradually surface)
  const ageScore = Math.min(100, Math.floor(Math.log2(Math.max(1, item.ageMinutes / 30)) * 20));

  // Weighted total
  const totalScore = Math.round(
    (urgencyScore * WEIGHTS.urgency +
      expiryScore * WEIGHTS.expiry +
      slaScore * WEIGHTS.sla +
      riskTierScore * WEIGHTS.riskTier +
      statusScore * WEIGHTS.status +
      ageScore * WEIGHTS.age) / 100
  );

  // Rank reason
  const reasons: string[] = [];
  if (urgencyScore >= 75) reasons.push(`urgency=${item.urgencyLevel}`);
  if (expiryScore >= 70) reasons.push("snapshot 만료 임박");
  if (slaScore >= 50) reasons.push("SLA 초과");
  if (riskTierScore >= 60) reasons.push(`risk=${item.riskTier}`);
  if (statusScore >= 60) reasons.push(`status=${item.itemStatus}`);
  if (item.sodViolationDetected) reasons.push("SoD 위반");
  if (item.escalationRequired) reasons.push("escalation 필요");

  return {
    totalScore,
    urgencyScore, expiryScore, slaScore, riskTierScore, statusScore, ageScore,
    rankReason: reasons.length > 0 ? reasons.join(" · ") : "일반 대기",
  };
}

// ── Rank All Items ──
export function rankApprovalInboxItems(
  items: ApprovalInboxItemV2[],
  now: Date = new Date(),
): RankedApprovalItemV2[] {
  const scored = items.map(item => ({
    item,
    score: computeItemScore(item, now),
  }));

  // Sort by totalScore descending
  scored.sort((a, b) => b.score.totalScore - a.score.totalScore);

  return scored.map((s, idx) => ({
    rank: idx + 1,
    item: s.item,
    score: s.score,
  }));
}

// ── Filter Helpers ──
export function filterByDomain(items: RankedApprovalItemV2[], domain: ApprovalDomain): RankedApprovalItemV2[] {
  return items.filter(i => i.item.domain === domain);
}

export function filterByUrgency(items: RankedApprovalItemV2[], minUrgency: ApprovalUrgencyLevel): RankedApprovalItemV2[] {
  const urgencyOrder: ApprovalUrgencyLevel[] = ["low", "medium", "high", "critical"];
  const minIdx = urgencyOrder.indexOf(minUrgency);
  return items.filter(i => urgencyOrder.indexOf(i.item.urgencyLevel) >= minIdx);
}

export function filterByAssignee(items: RankedApprovalItemV2[], approverId: string): RankedApprovalItemV2[] {
  return items.filter(i => i.item.assignedApprover === approverId || i.item.assignedApprover === null);
}

export function filterEscalationPending(items: RankedApprovalItemV2[]): RankedApprovalItemV2[] {
  return items.filter(i => i.item.escalationRequired);
}

export function filterReapprovalRequired(items: RankedApprovalItemV2[]): RankedApprovalItemV2[] {
  return items.filter(i => i.item.itemStatus === "reapproval_required" || i.item.snapshotInvalidated);
}

export function filterSnapshotExpiring(items: RankedApprovalItemV2[]): RankedApprovalItemV2[] {
  return items.filter(i => i.item.snapshotExpiringSoon);
}
