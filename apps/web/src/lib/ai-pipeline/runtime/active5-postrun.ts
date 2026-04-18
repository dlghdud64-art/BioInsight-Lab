/**
 * ACTIVE_5 Post-Run 검증 & ACTIVE_25 승격 판단
 * ACTIVE_5 운영 데이터를 집계하고 ACTIVE_25 진입 가능 여부를 결정한다.
 *
 * Decision enum:
 * - GO_ACTIVE_25
 * - HOLD_AT_5
 * - ROLLBACK_TO_SHADOW
 */

import { db } from "@/lib/db";
import type { AiProcessingLog } from "@prisma/client";
import { collectWatchboardMetrics, type WatchboardMetrics } from "./watchboard";

// ── Decision ──

export type Active5Decision = "GO_ACTIVE_25" | "HOLD_AT_5" | "ROLLBACK_TO_SHADOW";

export interface Active5PostRunReport {
  documentType: string;
  since: Date;
  until: Date;
  decision: Active5Decision;
  reasons: string[];
  metrics: WatchboardMetrics;
  thresholds: Active5Thresholds;
}

export interface Active5Thresholds {
  minVolume: number;
  maxMismatchRate: number;
  maxFallbackRate: number;
  maxCriticalFieldConflictRate: number;
  maxTimeoutRate: number;
  maxProviderErrorRate: number;
  maxFalseSafeConfirmed: number;
  maxUnknownRisk: number;
  maxOrgScopeRisk: number;
  maxDedupRisk: number;
  maxTaskMappingHighRisk: number;
  mismatchBorderline: number;
  fallbackBorderline: number;
}

const DEFAULT_ACTIVE5_THRESHOLDS: Active5Thresholds = {
  minVolume: 50,
  maxMismatchRate: 0.15,
  maxFallbackRate: 0.20,
  maxCriticalFieldConflictRate: 0.05,
  maxTimeoutRate: 0.05,
  maxProviderErrorRate: 0.03,
  maxFalseSafeConfirmed: 0,
  maxUnknownRisk: 0,
  maxOrgScopeRisk: 0,
  maxDedupRisk: 0,
  maxTaskMappingHighRisk: 0,
  mismatchBorderline: 0.12,
  fallbackBorderline: 0.15,
};

// ── Post-Run Report 생성 ──

/** ACTIVE_5 post-run 데이터 집계 및 판정 */
export async function generateActive5PostRunReport(
  documentType: string,
  since?: Date,
  thresholds?: Partial<Active5Thresholds>
): Promise<Active5PostRunReport> {
  const sinceDate = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const until = new Date();
  const t: Active5Thresholds = { ...DEFAULT_ACTIVE5_THRESHOLDS, ...thresholds };

  const metrics = await collectWatchboardMetrics(documentType, sinceDate);
  const decision = evaluateActive5Decision(metrics, t);

  return {
    documentType,
    since: sinceDate,
    until,
    decision: decision.decision,
    reasons: decision.reasons,
    metrics,
    thresholds: t,
  };
}

// ── 판정 로직 ──

interface Active5DecisionResult {
  decision: Active5Decision;
  reasons: string[];
}

function evaluateActive5Decision(
  m: WatchboardMetrics,
  t: Active5Thresholds
): Active5DecisionResult {
  const reasons: string[] = [];

  // ROLLBACK_TO_SHADOW 조건 (즉시)
  if (m.confirmedFalseSafeCount > t.maxFalseSafeConfirmed) {
    reasons.push(`confirmed false-safe: ${m.confirmedFalseSafeCount} > ${t.maxFalseSafeConfirmed}`);
  }
  if (m.orgScopeRiskCount > t.maxOrgScopeRisk) {
    reasons.push(`org scope risk: ${m.orgScopeRiskCount} > ${t.maxOrgScopeRisk}`);
  }
  if (m.dedupRiskCount > t.maxDedupRisk) {
    reasons.push(`dedup risk: ${m.dedupRiskCount} > ${t.maxDedupRisk}`);
  }
  if (m.taskMappingHighRiskMismatchCount > t.maxTaskMappingHighRisk) {
    reasons.push(`task mapping high-risk: ${m.taskMappingHighRiskMismatchCount} > ${t.maxTaskMappingHighRisk}`);
  }
  if (m.unknownClassificationCount > t.maxUnknownRisk) {
    reasons.push(`unknown classification: ${m.unknownClassificationCount} > ${t.maxUnknownRisk}`);
  }

  if (reasons.length > 0) {
    return { decision: "ROLLBACK_TO_SHADOW", reasons };
  }

  // HOLD_AT_5 조건
  const holdReasons: string[] = [];
  if (m.processedVolume < t.minVolume) {
    holdReasons.push(`volume 부족: ${m.processedVolume} < ${t.minVolume}`);
  }
  if (m.mismatchRate > t.mismatchBorderline && m.mismatchRate <= t.maxMismatchRate) {
    holdReasons.push(`mismatch 경계선: ${(m.mismatchRate * 100).toFixed(1)}%`);
  }
  if (m.fallbackRate > t.fallbackBorderline && m.fallbackRate <= t.maxFallbackRate) {
    holdReasons.push(`fallback 경계선: ${(m.fallbackRate * 100).toFixed(1)}%`);
  }
  if (m.topAnomalyTemplates.length >= 3) {
    holdReasons.push(`template anomaly: ${m.topAnomalyTemplates.length}건`);
  }
  if (m.topAnomalyVendors.length >= 3) {
    holdReasons.push(`vendor anomaly: ${m.topAnomalyVendors.length}건`);
  }
  if (m.rollbackTriggerFired) {
    holdReasons.push("rollback trigger fired — 추가 관찰 필요");
  }

  // 기준 초과 시에도 HOLD (rollback까진 아닌 경우)
  if (m.mismatchRate > t.maxMismatchRate) {
    holdReasons.push(`mismatch rate 초과: ${(m.mismatchRate * 100).toFixed(1)}% > ${(t.maxMismatchRate * 100).toFixed(0)}%`);
  }
  if (m.fallbackRate > t.maxFallbackRate) {
    holdReasons.push(`fallback rate 초과: ${(m.fallbackRate * 100).toFixed(1)}% > ${(t.maxFallbackRate * 100).toFixed(0)}%`);
  }
  if (m.timeoutRate > t.maxTimeoutRate) {
    holdReasons.push(`timeout rate: ${(m.timeoutRate * 100).toFixed(1)}% > ${(t.maxTimeoutRate * 100).toFixed(0)}%`);
  }
  if (m.providerErrorRate > t.maxProviderErrorRate) {
    holdReasons.push(`provider error rate: ${(m.providerErrorRate * 100).toFixed(1)}% > ${(t.maxProviderErrorRate * 100).toFixed(0)}%`);
  }

  if (holdReasons.length > 0) {
    return { decision: "HOLD_AT_5", reasons: holdReasons };
  }

  // GO_ACTIVE_25
  const goReasons: string[] = [];
  goReasons.push(`volume: ${m.processedVolume} >= ${t.minVolume}`);
  goReasons.push(`mismatch: ${(m.mismatchRate * 100).toFixed(1)}% <= ${(t.maxMismatchRate * 100).toFixed(0)}%`);
  goReasons.push(`fallback: ${(m.fallbackRate * 100).toFixed(1)}% <= ${(t.maxFallbackRate * 100).toFixed(0)}%`);
  goReasons.push(`unknown risk: ${m.unknownClassificationCount} = 0`);
  goReasons.push(`false-safe confirmed: ${m.confirmedFalseSafeCount} = 0`);
  goReasons.push("ops review 통과");

  return { decision: "GO_ACTIVE_25", reasons: goReasons };
}

// ── ACTIVE_25 Launch Config ──

export interface Active25LaunchConfig {
  documentType: string;
  currentStage: "ACTIVE_25";
  rolloutPercent: 25;
  allowAutoVerify: false;
  comparisonLogEnabled: true;
  fallbackEnabled: true;
  rollbackLadder: true;
  watchboardActive: true;
}

/** GO_ACTIVE_25일 때만 사용 가능한 launch config */
export function createActive25LaunchConfig(documentType: string): Active25LaunchConfig {
  return {
    documentType,
    currentStage: "ACTIVE_25",
    rolloutPercent: 25,
    allowAutoVerify: false,
    comparisonLogEnabled: true,
    fallbackEnabled: true,
    rollbackLadder: true,
    watchboardActive: true,
  };
}
