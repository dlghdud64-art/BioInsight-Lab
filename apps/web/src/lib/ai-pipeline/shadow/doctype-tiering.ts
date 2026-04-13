// @ts-nocheck — shadow pipeline: experimental code, type-check deferred
/**
 * DocType Tiering — 4단계 위험도 등급 분류
 *
 * TIER_1_STABLE: 안정적, 동시 승격 제한 없음
 * TIER_2_MODERATE: 보통 위험, 동시 승격 3개까지
 * TIER_3_ELEVATED: 높은 위험, 동시 승격 1개까지
 * TIER_4_HIGH_VARIANCE: 매우 높은 위험, 동시 승격 금지 (단독만 허용)
 *
 * 규칙: 동시에 TIER_3 이상 2개 승격 금지
 */

import { db } from "@@/lib/db";

export type RiskTier = "TIER_1_STABLE" | "TIER_2_MODERATE" | "TIER_3_ELEVATED" | "TIER_4_HIGH_VARIANCE";

export interface TieringInput {
  documentType: string;
  templateDiversity: number;      // unique template count
  vendorDiversity: number;        // unique vendor count
  historicalConflictRate: number;  // 0~1
  falseSafeHistory: number;       // total false-safe incidents
  rollbackHistory: number;        // total rollbacks
  avgConfidence: number;          // 0~1
  totalVolume: number;            // total processed
}

export interface TieringResult {
  documentType: string;
  tier: RiskTier;
  score: number; // 0~100, higher = more risky
  factors: { name: string; contribution: number }[];
}

/**
 * DocType 위험도 등급 산출
 */
export function classifyDocTypeTier(input: TieringInput): TieringResult {
  const factors: { name: string; contribution: number }[] = [];
  let score = 0;

  // Template diversity: high = more risk
  const templateScore = Math.min(input.templateDiversity * 2, 20);
  factors.push({ name: "templateDiversity", contribution: templateScore });
  score += templateScore;

  // Vendor diversity: high = more risk
  const vendorScore = Math.min(input.vendorDiversity * 1.5, 15);
  factors.push({ name: "vendorDiversity", contribution: vendorScore });
  score += vendorScore;

  // Historical conflict rate
  const conflictScore = input.historicalConflictRate * 25;
  factors.push({ name: "conflictRate", contribution: conflictScore });
  score += conflictScore;

  // False-safe history: any = significant risk
  const falseSafeScore = Math.min(input.falseSafeHistory * 10, 20);
  factors.push({ name: "falseSafeHistory", contribution: falseSafeScore });
  score += falseSafeScore;

  // Rollback history
  const rollbackScore = Math.min(input.rollbackHistory * 5, 10);
  factors.push({ name: "rollbackHistory", contribution: rollbackScore });
  score += rollbackScore;

  // Low confidence = more risk
  const confidenceScore = (1 - input.avgConfidence) * 10;
  factors.push({ name: "lowConfidence", contribution: confidenceScore });
  score += confidenceScore;

  // Low volume = less data = more risk for unknowns
  const volumeRisk = input.totalVolume < 100 ? 5 : input.totalVolume < 500 ? 2 : 0;
  if (volumeRisk > 0) {
    factors.push({ name: "lowVolume", contribution: volumeRisk });
    score += volumeRisk;
  }

  score = Math.round(Math.min(score, 100));

  let tier: RiskTier;
  if (score <= 20) tier = "TIER_1_STABLE";
  else if (score <= 45) tier = "TIER_2_MODERATE";
  else if (score <= 70) tier = "TIER_3_ELEVATED";
  else tier = "TIER_4_HIGH_VARIANCE";

  return { documentType: input.documentType, tier, score, factors };
}

/**
 * 동시 승격 허용 여부 검증
 *
 * 규칙:
 * - TIER_4: 단독 승격만 허용
 * - TIER_3 이상 동시 2개 승격 금지
 * - TIER_2: 동시 3개까지
 * - TIER_1: 제한 없음
 */
export function validateConcurrentPromotion(
  candidateTier: RiskTier,
  currentlyPromoting: { documentType: string; tier: RiskTier }[],
): { allowed: boolean; reason: string | null } {
  // TIER_4는 단독만
  if (candidateTier === "TIER_4_HIGH_VARIANCE" && currentlyPromoting.length > 0) {
    return { allowed: false, reason: "TIER_4 문서 타입은 단독 승격만 허용됩니다" };
  }

  // 기존에 TIER_4가 승격 중이면 추가 불가
  if (currentlyPromoting.some((p) => p.tier === "TIER_4_HIGH_VARIANCE")) {
    return { allowed: false, reason: "TIER_4 문서 타입이 승격 중이므로 추가 승격 불가" };
  }

  // TIER_3 이상 동시 2개 금지
  const highTierCount = currentlyPromoting.filter(
    (p) => p.tier === "TIER_3_ELEVATED" || p.tier === "TIER_4_HIGH_VARIANCE",
  ).length;
  const candidateIsHighTier = candidateTier === "TIER_3_ELEVATED" || candidateTier === "TIER_4_HIGH_VARIANCE";

  if (candidateIsHighTier && highTierCount >= 1) {
    return { allowed: false, reason: "TIER_3 이상 동시 2개 승격 금지" };
  }
  if (!candidateIsHighTier && highTierCount >= 1 && currentlyPromoting.length >= 2) {
    return { allowed: false, reason: "고위험 승격 진행 중 — 추가 승격 제한" };
  }

  // TIER_2 동시 3개까지
  if (currentlyPromoting.length >= 3) {
    return { allowed: false, reason: "동시 승격 최대 3개 초과" };
  }

  return { allowed: true, reason: null };
}

// ── Tier Labels ──

export const TIER_LABELS: Record<RiskTier, { name: string; color: string; description: string }> = {
  TIER_1_STABLE: { name: "Stable", color: "green", description: "안정적 — 제한 없는 승격 가능" },
  TIER_2_MODERATE: { name: "Moderate", color: "yellow", description: "보통 위험 — 동시 승격 3개까지" },
  TIER_3_ELEVATED: { name: "Elevated", color: "orange", description: "높은 위험 — 동시 승격 1개까지" },
  TIER_4_HIGH_VARIANCE: { name: "High Variance", color: "red", description: "매우 높은 위험 — 단독 승격만" },
};
