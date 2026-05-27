/**
 * Canary Launch Watchboard — 실시간 관제 지표
 *
 * ACTIVE_5 런칭 후 문서 타입 단위 실시간 모니터링 지표 집계.
 * - processed vs ai_active_canary 비율 (5% 유지 확인)
 * - fallback / mismatch / high-risk / timeout / provider error
 * - p50 / p95 latency
 * - review candidate count
 * - top failing templates/vendors
 * - halt event 이력
 */

import { db } from "@/lib/db";
import { loadCanaryConfig, getDocTypeConfig } from "./canary-config";
import type { CanaryStage, MismatchCategory } from "./types";

export interface WatchboardMetrics {
  documentType: string;
  currentStage: CanaryStage;
  period: { from: string; to: string };

  // 트래픽 분포
  totalProcessed: number;
  aiActiveCanaryCount: number;
  aiShadowCount: number;
  rulesOnlyCount: number;
  aiFallbackCount: number;
  canaryRatio: number; // aiActiveCanaryCount / totalProcessed

  // 품질 지표
  fallbackCount: number;
  fallbackRate: number;
  mismatchCount: number;
  mismatchRate: number;
  highRiskCount: number;
  highRiskCategories: { category: string; count: number }[];

  // 에러 지표
  timeoutCount: number;
  timeoutRate: number;
  providerErrorCount: number;
  providerErrorRate: number;
  schemaInvalidCount: number;

  // 레이턴시
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;

  // 리뷰
  reviewCandidateCount: number;

  // Top failing
  topMismatchCategories: { category: string; count: number }[];
  topFallbackReasons: { reason: string; count: number }[];

  // Halt 이력
  haltEvents: {
    id: string;
    previousStage: string;
    haltedToStage: string;
    reason: string;
    triggerCategory: string | null;
    createdAt: string;
  }[];

  // 가동 상태
  healthStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  healthReasons: string[];
}

export interface WatchboardQuery {
  documentType: string;
  from?: Date;
  to?: Date;
  orgId?: string;
}

export async function getWatchboardMetrics(query: WatchboardQuery): Promise<WatchboardMetrics> {
  const from = query.from ?? new Date(Date.now() - 60 * 60 * 1000); // 기본 1시간
  const to = query.to ?? new Date();
  const canaryConfig = loadCanaryConfig();
  const docConfig = getDocTypeConfig(canaryConfig, query.documentType);

  const orgFilter = query.orgId ? ` AND "orgId" = $3` : "";
  const params: unknown[] = query.orgId ? [from, to, query.orgId] : [from, to];

  // ── 트래픽 분포 ──
  const trafficRows = (await db.$queryRawUnsafe(
    `SELECT
      "processingPath",
      COUNT(*)::bigint AS cnt
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = '${query.documentType}'
      ${orgFilter}
    GROUP BY "processingPath"`,
    ...params,
  )) as { processingPath: string; cnt: bigint }[];

  const pathCounts: Record<string, number> = {};
  let totalProcessed = 0;
  for (const r of trafficRows) {
    const count = Number(r.cnt);
    pathCounts[r.processingPath] = count;
    totalProcessed += count;
  }

  const aiActiveCanaryCount = pathCounts["ai_active_canary"] ?? 0;
  const aiShadowCount = pathCounts["ai_shadow"] ?? 0;
  const rulesOnlyCount = pathCounts["rules"] ?? 0;
  const aiFallbackCount = pathCounts["ai_fallback"] ?? 0;

  // ── 품질 지표 ──
  const qualityRows = (await db.$queryRawUnsafe(
    `SELECT
      COUNT(*) FILTER (WHERE "fallbackReason" IS NOT NULL)::bigint AS fallback_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF')::bigint AS mismatch_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" IN ('AUTO_VERIFY_RISK', 'ORG_SCOPE_BLOCKED', 'TASK_MAPPING_DIFF'))::bigint AS high_risk,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'TIMEOUT_FALLBACK')::bigint AS timeout_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'PROVIDER_ERROR_FALLBACK')::bigint AS provider_error_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'SCHEMA_INVALID_FALLBACK')::bigint AS schema_invalid_count,
      COUNT(*) FILTER (WHERE "isReviewCandidate" = true)::bigint AS review_count,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p50,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p95,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p99
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = '${query.documentType}'
      ${orgFilter}`,
    ...params,
  )) as {
    fallback_count: bigint;
    mismatch_count: bigint;
    high_risk: bigint;
    timeout_count: bigint;
    provider_error_count: bigint;
    schema_invalid_count: bigint;
    review_count: bigint;
    p50: number | null;
    p95: number | null;
    p99: number | null;
  }[];

  const q = qualityRows[0];
  const fallbackCount = Number(q?.fallback_count ?? 0);
  const mismatchCount = Number(q?.mismatch_count ?? 0);
  const highRiskCount = Number(q?.high_risk ?? 0);
  const timeoutCount = Number(q?.timeout_count ?? 0);
  const providerErrorCount = Number(q?.provider_error_count ?? 0);
  const schemaInvalidCount = Number(q?.schema_invalid_count ?? 0);
  const reviewCandidateCount = Number(q?.review_count ?? 0);
  const aiInvoked = totalProcessed - rulesOnlyCount;

  // ── High-risk 카테고리 상세 ──
  const highRiskRows = (await db.$queryRawUnsafe(
    `SELECT "mismatchCategory" AS cat, COUNT(*)::bigint AS cnt
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = '${query.documentType}'
      AND "mismatchCategory" IN ('AUTO_VERIFY_RISK', 'ORG_SCOPE_BLOCKED', 'TASK_MAPPING_DIFF')
      ${orgFilter}
    GROUP BY "mismatchCategory"
    ORDER BY cnt DESC`,
    ...params,
  )) as { cat: string; cnt: bigint }[];

  // ── Top mismatch categories ──
  const mismatchRows = (await db.$queryRawUnsafe(
    `SELECT "mismatchCategory" AS cat, COUNT(*)::bigint AS cnt
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = '${query.documentType}'
      AND "mismatchCategory" != 'NO_DIFF'
      ${orgFilter}
    GROUP BY "mismatchCategory"
    ORDER BY cnt DESC
    LIMIT 10`,
    ...params,
  )) as { cat: string; cnt: bigint }[];

  // ── Top fallback reasons ──
  const fallbackRows = (await db.$queryRawUnsafe(
    `SELECT "fallbackReason" AS reason, COUNT(*)::bigint AS cnt
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = '${query.documentType}'
      AND "fallbackReason" IS NOT NULL
      ${orgFilter}
    GROUP BY "fallbackReason"
    ORDER BY cnt DESC
    LIMIT 10`,
    ...params,
  )) as { reason: string; cnt: bigint }[];

  // ── Halt 이력 ──
  const haltRows = (await db.$queryRawUnsafe(
    `SELECT "id", "previousStage", "haltedToStage", "reason", "triggerCategory", "createdAt"
    FROM "CanaryHaltLog"
    WHERE "documentType" = '${query.documentType}'
      AND "createdAt" >= $1 AND "createdAt" <= $2
    ORDER BY "createdAt" DESC
    LIMIT 20`,
    ...params,
  )) as {
    id: string;
    previousStage: string;
    haltedToStage: string;
    reason: string;
    triggerCategory: string | null;
    createdAt: Date;
  }[];

  // ── Health Status 판정 ──
  const healthReasons: string[] = [];
  let healthStatus: "HEALTHY" | "DEGRADED" | "CRITICAL" = "HEALTHY";

  if (highRiskCount > 0) {
    healthStatus = "CRITICAL";
    healthReasons.push(`High-risk 이벤트 ${highRiskCount}건 감지`);
  }
  if (haltRows.length > 0) {
    healthStatus = "CRITICAL";
    healthReasons.push(`Halt 이벤트 ${haltRows.length}건 발생`);
  }
  if (aiInvoked > 0 && fallbackCount / aiInvoked > 0.1) {
    if (healthStatus !== "CRITICAL") healthStatus = "DEGRADED";
    healthReasons.push(`Fallback rate ${((fallbackCount / aiInvoked) * 100).toFixed(1)}% > 10%`);
  }
  if (aiInvoked > 0 && mismatchCount / aiInvoked > 0.15) {
    if (healthStatus !== "CRITICAL") healthStatus = "DEGRADED";
    healthReasons.push(`Mismatch rate ${((mismatchCount / aiInvoked) * 100).toFixed(1)}% > 15%`);
  }
  if (timeoutCount > 3) {
    if (healthStatus !== "CRITICAL") healthStatus = "DEGRADED";
    healthReasons.push(`Timeout ${timeoutCount}건 > 3건`);
  }
  if (healthReasons.length === 0) {
    healthReasons.push("모든 지표 정상 범위");
  }

  return {
    documentType: query.documentType,
    currentStage: docConfig.stage,
    period: { from: from.toISOString(), to: to.toISOString() },
    totalProcessed,
    aiActiveCanaryCount,
    aiShadowCount,
    rulesOnlyCount,
    aiFallbackCount,
    canaryRatio: totalProcessed > 0 ? aiActiveCanaryCount / totalProcessed : 0,
    fallbackCount,
    fallbackRate: aiInvoked > 0 ? fallbackCount / aiInvoked : 0,
    mismatchCount,
    mismatchRate: aiInvoked > 0 ? mismatchCount / aiInvoked : 0,
    highRiskCount,
    highRiskCategories: highRiskRows.map((r: { cat: string; cnt: bigint }) => ({
      category: r.cat,
      count: Number(r.cnt),
    })),
    timeoutCount,
    timeoutRate: aiInvoked > 0 ? timeoutCount / aiInvoked : 0,
    providerErrorCount,
    providerErrorRate: aiInvoked > 0 ? providerErrorCount / aiInvoked : 0,
    schemaInvalidCount,
    latencyP50Ms: q?.p50 ?? 0,
    latencyP95Ms: q?.p95 ?? 0,
    latencyP99Ms: q?.p99 ?? 0,
    reviewCandidateCount,
    topMismatchCategories: mismatchRows.map((r: { cat: string; cnt: bigint }) => ({
      category: r.cat,
      count: Number(r.cnt),
    })),
    topFallbackReasons: fallbackRows.map((r: { reason: string; cnt: bigint }) => ({
      reason: r.reason,
      count: Number(r.cnt),
    })),
    haltEvents: haltRows.map((r) => ({
      id: r.id,
      previousStage: r.previousStage,
      haltedToStage: r.haltedToStage,
      reason: r.reason,
      triggerCategory: r.triggerCategory,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
    healthStatus,
    healthReasons,
  };
}

/**
 * Canary Run Summary — 24시간 요약 자동 생성
 */
export interface CanaryRunSummary {
  documentType: string;
  stage: CanaryStage;
  periodHours: number;
  processedVolume: number;
  canaryVolume: number;
  canaryRatio: number;
  fallbackSummary: { count: number; rate: number; topReasons: string[] };
  mismatchSummary: { count: number; rate: number; topCategories: string[] };
  highRiskEvents: number;
  haltTriggered: boolean;
  haltCount: number;
  latency: { p50: number; p95: number; p99: number };
  recommendedAction: "PROMOTE" | "HOLD" | "ROLLBACK";
  recommendationReason: string;
}

export async function generateCanaryRunSummary(
  documentType: string,
  periodHours: number = 24,
): Promise<CanaryRunSummary> {
  const from = new Date(Date.now() - periodHours * 60 * 60 * 1000);
  const metrics = await getWatchboardMetrics({ documentType, from });
  const canaryConfig = loadCanaryConfig();
  const docConfig = getDocTypeConfig(canaryConfig, documentType);

  // Recommended Action 결정
  let action: "PROMOTE" | "HOLD" | "ROLLBACK" = "HOLD";
  let reason: string;

  if (metrics.highRiskCount > 0 || metrics.haltEvents.length > 0) {
    action = "ROLLBACK";
    reason = `High-risk ${metrics.highRiskCount}건, Halt ${metrics.haltEvents.length}건 — 즉시 SHADOW_ONLY 강등 권고`;
  } else if (metrics.totalProcessed < 50) {
    action = "HOLD";
    reason = `처리량 ${metrics.totalProcessed}건 부족 (최소 50건 필요) — 데이터 누적 대기`;
  } else if (metrics.fallbackRate > 0.05) {
    action = "HOLD";
    reason = `Fallback rate ${(metrics.fallbackRate * 100).toFixed(1)}% > 5% — 안정화 필요`;
  } else if (metrics.mismatchRate > 0.1) {
    action = "HOLD";
    reason = `Mismatch rate ${(metrics.mismatchRate * 100).toFixed(1)}% > 10% — 분석 필요`;
  } else if (metrics.timeoutRate > 0.03) {
    action = "HOLD";
    reason = `Timeout rate ${(metrics.timeoutRate * 100).toFixed(1)}% > 3% — 성능 개선 필요`;
  } else if (
    metrics.totalProcessed >= 100 &&
    metrics.fallbackRate <= 0.03 &&
    metrics.mismatchRate <= 0.05 &&
    metrics.highRiskCount === 0
  ) {
    action = "PROMOTE";
    reason = `${metrics.totalProcessed}건 처리, Fallback ${(metrics.fallbackRate * 100).toFixed(1)}%, Mismatch ${(metrics.mismatchRate * 100).toFixed(1)}% — ACTIVE_25 승격 가능`;
  } else {
    action = "HOLD";
    reason = "기준 미달 항목 존재 — 추가 관찰 필요";
  }

  return {
    documentType,
    stage: docConfig.stage,
    periodHours,
    processedVolume: metrics.totalProcessed,
    canaryVolume: metrics.aiActiveCanaryCount,
    canaryRatio: metrics.canaryRatio,
    fallbackSummary: {
      count: metrics.fallbackCount,
      rate: metrics.fallbackRate,
      topReasons: metrics.topFallbackReasons.slice(0, 3).map((r) => r.reason),
    },
    mismatchSummary: {
      count: metrics.mismatchCount,
      rate: metrics.mismatchRate,
      topCategories: metrics.topMismatchCategories.slice(0, 3).map((c) => c.category),
    },
    highRiskEvents: metrics.highRiskCount,
    haltTriggered: metrics.haltEvents.length > 0,
    haltCount: metrics.haltEvents.length,
    latency: {
      p50: metrics.latencyP50Ms,
      p95: metrics.latencyP95Ms,
      p99: metrics.latencyP99Ms,
    },
    recommendedAction: action,
    recommendationReason: reason,
  };
}
