/**
 * Canary Promotion Gate — ACTIVE_N → ACTIVE_M 승격 판정
 *
 * 엄격한 Zero-risk 기반 Decision Matrix:
 *  - PROMOTE: High-risk 0, Unknown 0, AutoVerify 0, OrgScope 0, Dedup 0, TaskMapping 0
 *             + Fallback/Mismatch/Latency가 임계치 이내
 *  - HOLD:    High-risk 0이지만 경계선(Marginal) 지표 존재
 *  - ROLLBACK: High-risk 1건+ 또는 Invariant 위반 감지
 */

import { db } from "@/lib/db";
import { loadCanaryConfig, getDocTypeConfig } from "./canary-config";
import type { CanaryStage, MismatchCategory } from "./types";

// ── 승격 임계치 ──
export interface PromotionThresholds {
  minVolume: number;             // 최소 평가 모수
  maxFallbackRate: number;       // Fallback 허용 상한
  maxMismatchRate: number;       // Mismatch 허용 상한
  maxTimeoutRate: number;        // Timeout 허용 상한
  maxProviderErrorRate: number;  // Provider Error 허용 상한
  maxLatencyP95Ms: number;       // P95 레이턴시 상한
  marginalFallbackRate: number;  // HOLD 경계선
  marginalMismatchRate: number;  // HOLD 경계선
}

const DEFAULT_THRESHOLDS: PromotionThresholds = {
  minVolume: 50,
  maxFallbackRate: 0.03,
  maxMismatchRate: 0.05,
  maxTimeoutRate: 0.03,
  maxProviderErrorRate: 0.03,
  maxLatencyP95Ms: 3000,
  marginalFallbackRate: 0.05,
  marginalMismatchRate: 0.10,
};

export type PromotionDecision = "PROMOTE" | "HOLD" | "ROLLBACK";

export interface PromotionGateReport {
  documentType: string;
  currentStage: CanaryStage;
  targetStage: CanaryStage;
  evaluationPeriod: { from: string; to: string };

  // 볼륨
  totalProcessed: number;
  aiInvoked: number;
  canaryVolume: number;
  canaryRatio: number;

  // 품질 지표
  fallbackCount: number;
  fallbackRate: number;
  fallbackDistribution: { reason: string; count: number; pct: number }[];

  mismatchCount: number;
  mismatchRate: number;
  mismatchDistribution: { category: string; count: number; pct: number }[];

  // High-risk 상세
  highRiskBreakdown: {
    autoVerifyRisk: number;
    orgScopeBlocked: number;
    taskMappingDiff: number;
    unknownClassification: number;
    total: number;
  };

  // 에러 지표
  timeoutCount: number;
  timeoutRate: number;
  providerErrorCount: number;
  providerErrorRate: number;
  schemaInvalidCount: number;

  // 레이턴시 / 비용
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  avgTokenUsage: number;
  totalTokenUsage: number;

  // Halt 이력
  haltCount: number;

  // 판정
  decision: PromotionDecision;
  decisionReasons: string[];
  thresholds: PromotionThresholds;
}

export interface PromotionGateQuery {
  documentType: string;
  from?: Date;
  to?: Date;
  thresholds?: Partial<PromotionThresholds>;
}

export async function evaluatePromotionGate(
  query: PromotionGateQuery,
): Promise<PromotionGateReport> {
  const from = query.from ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = query.to ?? new Date();
  const thresholds = { ...DEFAULT_THRESHOLDS, ...query.thresholds };

  const canaryConfig = loadCanaryConfig();
  const docConfig = getDocTypeConfig(canaryConfig, query.documentType);

  const currentStage = docConfig.stage;
  const targetStage = resolveNextStage(currentStage);

  // ── 트래픽 집계 ──
  const trafficRows = (await db.$queryRawUnsafe(
    `SELECT
      "processingPath",
      COUNT(*)::bigint AS cnt
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3
    GROUP BY "processingPath"`,
    from, to, query.documentType,
  )) as { processingPath: string; cnt: bigint }[];

  const pathCounts: Record<string, number> = {};
  let totalProcessed = 0;
  for (const r of trafficRows) {
    const count = Number(r.cnt);
    pathCounts[r.processingPath] = count;
    totalProcessed += count;
  }

  const canaryVolume = (pathCounts["ai_active_canary"] ?? 0) + (pathCounts["ai_active_full"] ?? 0);
  const aiInvoked = totalProcessed - (pathCounts["rules"] ?? 0);

  // ── 품질 지표 ──
  const qualityRows = (await db.$queryRawUnsafe(
    `SELECT
      COUNT(*) FILTER (WHERE "fallbackReason" IS NOT NULL)::bigint AS fallback_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF')::bigint AS mismatch_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'AUTO_VERIFY_RISK')::bigint AS auto_verify_risk,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'ORG_SCOPE_BLOCKED')::bigint AS org_scope_blocked,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'TASK_MAPPING_DIFF')::bigint AS task_mapping_diff,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'UNKNOWN_CLASSIFICATION')::bigint AS unknown_class,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'TIMEOUT_FALLBACK')::bigint AS timeout_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'PROVIDER_ERROR_FALLBACK')::bigint AS provider_error,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'SCHEMA_INVALID_FALLBACK')::bigint AS schema_invalid,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p50,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p95,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p99,
      COALESCE(AVG("tokenUsage") FILTER (WHERE "tokenUsage" IS NOT NULL), 0) AS avg_tokens,
      COALESCE(SUM("tokenUsage") FILTER (WHERE "tokenUsage" IS NOT NULL), 0)::bigint AS total_tokens
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3`,
    from, to, query.documentType,
  )) as {
    fallback_count: bigint; mismatch_count: bigint;
    auto_verify_risk: bigint; org_scope_blocked: bigint;
    task_mapping_diff: bigint; unknown_class: bigint;
    timeout_count: bigint; provider_error: bigint; schema_invalid: bigint;
    p50: number | null; p95: number | null; p99: number | null;
    avg_tokens: number; total_tokens: bigint;
  }[];

  const q = qualityRows[0];
  const fallbackCount = Number(q?.fallback_count ?? 0);
  const mismatchCount = Number(q?.mismatch_count ?? 0);
  const autoVerifyRisk = Number(q?.auto_verify_risk ?? 0);
  const orgScopeBlocked = Number(q?.org_scope_blocked ?? 0);
  const taskMappingDiff = Number(q?.task_mapping_diff ?? 0);
  const unknownClassification = Number(q?.unknown_class ?? 0);
  const timeoutCount = Number(q?.timeout_count ?? 0);
  const providerErrorCount = Number(q?.provider_error ?? 0);
  const schemaInvalidCount = Number(q?.schema_invalid ?? 0);
  const highRiskTotal = autoVerifyRisk + orgScopeBlocked + taskMappingDiff;

  // ── Fallback 사유 분포 ──
  const fallbackDistRows = (await db.$queryRawUnsafe(
    `SELECT "fallbackReason" AS reason, COUNT(*)::bigint AS cnt
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3 AND "fallbackReason" IS NOT NULL
    GROUP BY "fallbackReason" ORDER BY cnt DESC LIMIT 10`,
    from, to, query.documentType,
  )) as { reason: string; cnt: bigint }[];

  // ── Mismatch 카테고리 분포 ──
  const mismatchDistRows = (await db.$queryRawUnsafe(
    `SELECT "mismatchCategory" AS cat, COUNT(*)::bigint AS cnt
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3 AND "mismatchCategory" != 'NO_DIFF'
    GROUP BY "mismatchCategory" ORDER BY cnt DESC LIMIT 10`,
    from, to, query.documentType,
  )) as { cat: string; cnt: bigint }[];

  // ── Halt 이력 카운트 ──
  const haltRows = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt
    FROM "CanaryHaltLog"
    WHERE "documentType" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3`,
    query.documentType, from, to,
  )) as { cnt: bigint }[];

  const haltCount = Number(haltRows[0]?.cnt ?? 0);

  // ── 비율 계산 ──
  const fallbackRate = aiInvoked > 0 ? fallbackCount / aiInvoked : 0;
  const mismatchRate = aiInvoked > 0 ? mismatchCount / aiInvoked : 0;
  const timeoutRate = aiInvoked > 0 ? timeoutCount / aiInvoked : 0;
  const providerErrorRate = aiInvoked > 0 ? providerErrorCount / aiInvoked : 0;

  // ── Decision Matrix ──
  const decisionReasons: string[] = [];
  let decision: PromotionDecision;

  // ROLLBACK 조건 (최우선)
  if (highRiskTotal > 0) {
    decision = "ROLLBACK";
    if (autoVerifyRisk > 0) decisionReasons.push(`AUTO_VERIFY_RISK: ${autoVerifyRisk}건`);
    if (orgScopeBlocked > 0) decisionReasons.push(`ORG_SCOPE_BLOCKED: ${orgScopeBlocked}건`);
    if (taskMappingDiff > 0) decisionReasons.push(`TASK_MAPPING_DIFF: ${taskMappingDiff}건`);
  } else if (unknownClassification > 0) {
    decision = "ROLLBACK";
    decisionReasons.push(`UNKNOWN_CLASSIFICATION: ${unknownClassification}건`);
  } else if (haltCount > 0) {
    decision = "ROLLBACK";
    decisionReasons.push(`Circuit Breaker Halt 발동: ${haltCount}건`);
  } else if (totalProcessed < thresholds.minVolume) {
    // 볼륨 부족
    decision = "HOLD";
    decisionReasons.push(`평가 모수 부족: ${totalProcessed}건 < ${thresholds.minVolume}건`);
  } else if (
    fallbackRate <= thresholds.maxFallbackRate &&
    mismatchRate <= thresholds.maxMismatchRate &&
    timeoutRate <= thresholds.maxTimeoutRate &&
    providerErrorRate <= thresholds.maxProviderErrorRate &&
    (q?.p95 ?? 0) <= thresholds.maxLatencyP95Ms
  ) {
    // 모든 지표 임계치 이내 → PROMOTE
    decision = "PROMOTE";
    decisionReasons.push("모든 Zero-risk 조건 충족");
    decisionReasons.push(`Fallback ${(fallbackRate * 100).toFixed(1)}% ≤ ${(thresholds.maxFallbackRate * 100).toFixed(0)}%`);
    decisionReasons.push(`Mismatch ${(mismatchRate * 100).toFixed(1)}% ≤ ${(thresholds.maxMismatchRate * 100).toFixed(0)}%`);
    decisionReasons.push(`P95 ${q?.p95?.toFixed(0) ?? 0}ms ≤ ${thresholds.maxLatencyP95Ms}ms`);
  } else {
    // 경계선 → HOLD
    decision = "HOLD";
    if (fallbackRate > thresholds.maxFallbackRate) {
      if (fallbackRate <= thresholds.marginalFallbackRate) {
        decisionReasons.push(`Fallback ${(fallbackRate * 100).toFixed(1)}% — 경계선 (허용: ${(thresholds.maxFallbackRate * 100).toFixed(0)}%, marginal: ${(thresholds.marginalFallbackRate * 100).toFixed(0)}%)`);
      } else {
        decisionReasons.push(`Fallback ${(fallbackRate * 100).toFixed(1)}% 초과`);
      }
    }
    if (mismatchRate > thresholds.maxMismatchRate) {
      if (mismatchRate <= thresholds.marginalMismatchRate) {
        decisionReasons.push(`Mismatch ${(mismatchRate * 100).toFixed(1)}% — 경계선`);
      } else {
        decisionReasons.push(`Mismatch ${(mismatchRate * 100).toFixed(1)}% 초과`);
      }
    }
    if (timeoutRate > thresholds.maxTimeoutRate) {
      decisionReasons.push(`Timeout ${(timeoutRate * 100).toFixed(1)}% 초과`);
    }
    if (providerErrorRate > thresholds.maxProviderErrorRate) {
      decisionReasons.push(`Provider Error ${(providerErrorRate * 100).toFixed(1)}% 초과`);
    }
    if ((q?.p95 ?? 0) > thresholds.maxLatencyP95Ms) {
      decisionReasons.push(`P95 ${q?.p95?.toFixed(0) ?? 0}ms > ${thresholds.maxLatencyP95Ms}ms`);
    }
  }

  return {
    documentType: query.documentType,
    currentStage,
    targetStage,
    evaluationPeriod: { from: from.toISOString(), to: to.toISOString() },
    totalProcessed,
    aiInvoked,
    canaryVolume,
    canaryRatio: totalProcessed > 0 ? canaryVolume / totalProcessed : 0,
    fallbackCount,
    fallbackRate,
    fallbackDistribution: fallbackDistRows.map((r: { reason: string; cnt: bigint }) => ({
      reason: r.reason,
      count: Number(r.cnt),
      pct: fallbackCount > 0 ? Number(r.cnt) / fallbackCount : 0,
    })),
    mismatchCount,
    mismatchRate,
    mismatchDistribution: mismatchDistRows.map((r: { cat: string; cnt: bigint }) => ({
      category: r.cat,
      count: Number(r.cnt),
      pct: mismatchCount > 0 ? Number(r.cnt) / mismatchCount : 0,
    })),
    highRiskBreakdown: {
      autoVerifyRisk,
      orgScopeBlocked,
      taskMappingDiff,
      unknownClassification,
      total: highRiskTotal + unknownClassification,
    },
    timeoutCount,
    timeoutRate,
    providerErrorCount,
    providerErrorRate,
    schemaInvalidCount,
    latencyP50Ms: q?.p50 ?? 0,
    latencyP95Ms: q?.p95 ?? 0,
    latencyP99Ms: q?.p99 ?? 0,
    avgTokenUsage: Number(q?.avg_tokens ?? 0),
    totalTokenUsage: Number(q?.total_tokens ?? 0),
    haltCount,
    decision,
    decisionReasons,
    thresholds,
  };
}

function resolveNextStage(current: CanaryStage): CanaryStage {
  const order: CanaryStage[] = ["OFF", "SHADOW_ONLY", "ACTIVE_5", "ACTIVE_25", "ACTIVE_50", "ACTIVE_100"];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : current;
}
