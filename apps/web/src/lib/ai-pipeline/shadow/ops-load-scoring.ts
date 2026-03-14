/**
 * Ops Load Scoring — Portfolio Readiness Score 산출
 *
 * Stage Health, Fallback/Mismatch 안정성, Review Backlog 처리율 등을
 * 종합하여 Portfolio Readiness Score를 산출하고 큐 우선순위를 결정합니다.
 */

import type { LifecycleState } from "./rollout-state-machine";

// ── Types ──

export interface OpsLoadInput {
  documentType: string;
  currentStage: LifecycleState;

  // Stage Health 지표
  fallbackRate: number;      // 0~1
  mismatchRate: number;      // 0~1
  latencyP95Ms: number;

  // Review 지표
  reviewBacklogCount: number;
  reviewProcessingRate: number; // per day
  avgReviewResolutionHours: number;

  // Stability 지표
  daysSinceLastRollback: number;
  daysSinceLastHalt: number;
  consecutiveStableDays: number;

  // Volume
  dailyVolume: number;
}

export interface ReadinessScoreResult {
  documentType: string;
  totalScore: number;           // 0~100
  stageHealthScore: number;     // 0~30
  reviewCapacityScore: number;  // 0~25
  stabilityScore: number;       // 0~25
  volumeScore: number;          // 0~20
  factors: { name: string; score: number; max: number }[];
  recommendation: "PROMOTE_NOW" | "PROMOTE_WHEN_READY" | "HOLD" | "NEEDS_ATTENTION";
}

/**
 * Portfolio Readiness Score 산출
 */
export function computeReadinessScore(input: OpsLoadInput): ReadinessScoreResult {
  const factors: ReadinessScoreResult["factors"] = [];

  // ── Stage Health (0~30) ──
  let stageHealthScore = 30;

  // Fallback rate penalty
  if (input.fallbackRate > 0.1) stageHealthScore -= 15;
  else if (input.fallbackRate > 0.05) stageHealthScore -= 10;
  else if (input.fallbackRate > 0.02) stageHealthScore -= 5;
  factors.push({ name: "fallbackRate", score: Math.max(30 - (input.fallbackRate * 100), 0), max: 10 });

  // Mismatch rate penalty
  if (input.mismatchRate > 0.08) stageHealthScore -= 10;
  else if (input.mismatchRate > 0.04) stageHealthScore -= 5;
  factors.push({ name: "mismatchRate", score: Math.max(10 - (input.mismatchRate * 100), 0), max: 10 });

  // Latency penalty
  if (input.latencyP95Ms > 5000) stageHealthScore -= 5;
  else if (input.latencyP95Ms > 3000) stageHealthScore -= 2;
  factors.push({ name: "latencyP95", score: input.latencyP95Ms <= 3000 ? 10 : input.latencyP95Ms <= 5000 ? 7 : 3, max: 10 });

  stageHealthScore = Math.max(stageHealthScore, 0);

  // ── Review Capacity (0~25) ──
  let reviewCapacityScore = 25;

  // Backlog penalty
  if (input.reviewBacklogCount > 50) reviewCapacityScore -= 15;
  else if (input.reviewBacklogCount > 20) reviewCapacityScore -= 8;
  else if (input.reviewBacklogCount > 10) reviewCapacityScore -= 3;
  factors.push({ name: "reviewBacklog", score: Math.max(10 - Math.floor(input.reviewBacklogCount / 5), 0), max: 10 });

  // Processing rate vs backlog
  const processingRatio = input.reviewBacklogCount > 0
    ? input.reviewProcessingRate / input.reviewBacklogCount
    : 1;
  if (processingRatio < 0.5) reviewCapacityScore -= 10;
  else if (processingRatio < 1) reviewCapacityScore -= 5;
  factors.push({ name: "processingRate", score: Math.min(Math.round(processingRatio * 10), 10), max: 10 });

  // Resolution time
  if (input.avgReviewResolutionHours > 48) reviewCapacityScore -= 5;
  factors.push({ name: "resolutionTime", score: input.avgReviewResolutionHours <= 24 ? 5 : input.avgReviewResolutionHours <= 48 ? 3 : 0, max: 5 });

  reviewCapacityScore = Math.max(reviewCapacityScore, 0);

  // ── Stability (0~25) ──
  let stabilityScore = 0;

  // Days since last rollback
  if (input.daysSinceLastRollback >= 30) stabilityScore += 10;
  else if (input.daysSinceLastRollback >= 14) stabilityScore += 7;
  else if (input.daysSinceLastRollback >= 7) stabilityScore += 3;
  factors.push({ name: "daysSinceRollback", score: Math.min(input.daysSinceLastRollback, 30) / 3, max: 10 });

  // Days since last halt
  if (input.daysSinceLastHalt >= 14) stabilityScore += 8;
  else if (input.daysSinceLastHalt >= 7) stabilityScore += 4;
  factors.push({ name: "daysSinceHalt", score: Math.min(input.daysSinceLastHalt, 14) / 1.75, max: 8 });

  // Consecutive stable days
  if (input.consecutiveStableDays >= 14) stabilityScore += 7;
  else if (input.consecutiveStableDays >= 7) stabilityScore += 4;
  else if (input.consecutiveStableDays >= 3) stabilityScore += 2;
  factors.push({ name: "consecutiveStable", score: Math.min(input.consecutiveStableDays, 14) / 2, max: 7 });

  stabilityScore = Math.min(stabilityScore, 25);

  // ── Volume (0~20) ──
  let volumeScore = 0;

  if (input.dailyVolume >= 100) volumeScore = 20;
  else if (input.dailyVolume >= 50) volumeScore = 15;
  else if (input.dailyVolume >= 20) volumeScore = 10;
  else if (input.dailyVolume >= 5) volumeScore = 5;
  factors.push({ name: "dailyVolume", score: volumeScore, max: 20 });

  const totalScore = stageHealthScore + reviewCapacityScore + stabilityScore + volumeScore;

  let recommendation: ReadinessScoreResult["recommendation"];
  if (totalScore >= 80) recommendation = "PROMOTE_NOW";
  else if (totalScore >= 60) recommendation = "PROMOTE_WHEN_READY";
  else if (totalScore >= 40) recommendation = "HOLD";
  else recommendation = "NEEDS_ATTENTION";

  return {
    documentType: input.documentType,
    totalScore,
    stageHealthScore,
    reviewCapacityScore,
    stabilityScore,
    volumeScore,
    factors,
    recommendation,
  };
}

/**
 * 큐 우선순위 정렬을 위한 비교 함수
 */
export function compareByReadiness(a: ReadinessScoreResult, b: ReadinessScoreResult): number {
  return b.totalScore - a.totalScore;
}
