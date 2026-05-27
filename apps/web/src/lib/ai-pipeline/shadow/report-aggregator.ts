/**
 * Shadow Report Aggregator
 *
 * ShadowComparisonLog를 집계하여 운영자가 Active Rollout 가능 여부를
 * 즉시 판단할 수 있는 보고서를 생성.
 */

import { db } from "@/lib/db";
import type { ShadowReport, MismatchCategory } from "./types";

interface ReportQuery {
  orgId?: string;
  from?: Date;
  to?: Date;
}

export async function generateShadowReport(query: ReportQuery = {}): Promise<ShadowReport> {
  const from = query.from ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = query.to ?? new Date();

  const whereClause = query.orgId
    ? `WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND "orgId" = $3`
    : `WHERE "createdAt" >= $1 AND "createdAt" <= $2`;
  const params: unknown[] = query.orgId ? [from, to, query.orgId] : [from, to];

  // 1. 기본 집계
  const statsRows = (await db.$queryRawUnsafe(
    `SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "documentTypeByAi" IS NOT NULL OR "fallbackReason" IS NOT NULL)::bigint AS ai_invoked,
      COUNT(*) FILTER (WHERE "fallbackReason" IS NOT NULL)::bigint AS fallback_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF')::bigint AS mismatch_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'AUTO_VERIFY_RISK')::bigint AS auto_verify_risk,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'UNKNOWN_CLASSIFICATION')::bigint AS unknown_classification,
      AVG("tokenUsage") AS avg_token
    FROM "ShadowComparisonLog"
    ${whereClause}`,
    ...params,
  )) as { total: bigint; ai_invoked: bigint; fallback_count: bigint; mismatch_count: bigint; auto_verify_risk: bigint; unknown_classification: bigint; avg_token: number | null }[];

  const stats = statsRows[0];
  const total = Number(stats.total);
  const aiInvoked = Number(stats.ai_invoked);
  const fallbackCount = Number(stats.fallback_count);
  const mismatchCount = Number(stats.mismatch_count);

  // 2. Latency P50/P95
  const latencyRows = (await db.$queryRawUnsafe(
    `SELECT
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "aiLatencyMs") AS p50,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "aiLatencyMs") AS p95
    FROM "ShadowComparisonLog"
    ${whereClause} AND "aiLatencyMs" IS NOT NULL`,
    ...params,
  )) as { p50: number | null; p95: number | null }[];

  // 3. Category breakdown
  const categoryRows = (await db.$queryRawUnsafe(
    `SELECT "mismatchCategory" AS category, COUNT(*)::bigint AS count
    FROM "ShadowComparisonLog"
    ${whereClause}
    GROUP BY "mismatchCategory"
    ORDER BY count DESC`,
    ...params,
  )) as { category: string; count: bigint }[];

  // 4. Top mismatch doc types
  const docTypeRows = (await db.$queryRawUnsafe(
    `SELECT "documentTypeByRules" AS doc_type, COUNT(*)::bigint AS count
    FROM "ShadowComparisonLog"
    ${whereClause} AND "mismatchCategory" != 'NO_DIFF' AND "documentTypeByRules" IS NOT NULL
    GROUP BY "documentTypeByRules"
    ORDER BY count DESC
    LIMIT 10`,
    ...params,
  )) as { doc_type: string; count: bigint }[];

  // 5. Top fallback reasons
  const fallbackRows = (await db.$queryRawUnsafe(
    `SELECT "fallbackReason" AS reason, COUNT(*)::bigint AS count
    FROM "ShadowComparisonLog"
    ${whereClause} AND "fallbackReason" IS NOT NULL
    GROUP BY "fallbackReason"
    ORDER BY count DESC
    LIMIT 10`,
    ...params,
  )) as { reason: string; count: bigint }[];

  return {
    period: { from, to },
    totalProcessed: total,
    aiInvoked,
    fallbackCount,
    fallbackRate: aiInvoked > 0 ? fallbackCount / aiInvoked : 0,
    mismatchCount,
    mismatchRate: aiInvoked > 0 ? mismatchCount / aiInvoked : 0,
    autoVerifyRiskCount: Number(stats.auto_verify_risk),
    unknownClassificationCount: Number(stats.unknown_classification),
    latencyP50Ms: latencyRows[0]?.p50 ?? 0,
    latencyP95Ms: latencyRows[0]?.p95 ?? 0,
    avgTokenUsage: stats.avg_token ?? 0,
    topMismatchDocTypes: docTypeRows.map((r: { doc_type: string; count: bigint }) => ({
      docType: r.doc_type,
      count: Number(r.count),
    })),
    topFallbackReasons: fallbackRows.map((r: { reason: string; count: bigint }) => ({
      reason: r.reason,
      count: Number(r.count),
    })),
    categoryBreakdown: categoryRows.map((r: { category: string; count: bigint }) => ({
      category: r.category as MismatchCategory,
      count: Number(r.count),
    })),
  };
}
