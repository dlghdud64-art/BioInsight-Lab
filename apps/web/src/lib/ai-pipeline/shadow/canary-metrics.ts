/**
 * Per-doc-type Canary Metrics
 *
 * 문서 타입 단위로 운영 지표를 집계.
 * 전체 평균이 아닌 개별 문서 타입별 현황 제공.
 */

import { db } from "@/lib/db";
import { loadCanaryConfig, getDocTypeConfig } from "./canary-config";
import type { DocTypeMetrics } from "./types";

interface MetricsQuery {
  orgId?: string;
  from?: Date;
  to?: Date;
}

export async function getPerDocTypeMetrics(query: MetricsQuery = {}): Promise<DocTypeMetrics[]> {
  const from = query.from ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = query.to ?? new Date();
  const canaryConfig = loadCanaryConfig();

  const whereClause = query.orgId
    ? `WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND "orgId" = $3`
    : `WHERE "createdAt" >= $1 AND "createdAt" <= $2`;
  const params: unknown[] = query.orgId ? [from, to, query.orgId] : [from, to];

  const rows = (await db.$queryRawUnsafe(
    `SELECT
      "documentTypeByRules" AS doc_type,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "processingPath" IN ('ai_active_canary', 'ai_active_full'))::bigint AS ai_active,
      COUNT(*) FILTER (WHERE "fallbackReason" IS NOT NULL)::bigint AS fallback_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF')::bigint AS mismatch_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" IN ('AUTO_VERIFY_RISK', 'ORG_SCOPE_BLOCKED', 'TASK_MAPPING_DIFF'))::bigint AS high_risk,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p50,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p95
    FROM "ShadowComparisonLog"
    ${whereClause} AND "documentTypeByRules" IS NOT NULL
    GROUP BY "documentTypeByRules"
    ORDER BY total DESC`,
    ...params,
  )) as {
    doc_type: string;
    total: bigint;
    ai_active: bigint;
    fallback_count: bigint;
    mismatch_count: bigint;
    high_risk: bigint;
    p50: number | null;
    p95: number | null;
  }[];

  return rows.map((r: { doc_type: string; total: bigint; ai_active: bigint; fallback_count: bigint; mismatch_count: bigint; high_risk: bigint; p50: number | null; p95: number | null }) => {
    const total = Number(r.total);
    const docConfig = getDocTypeConfig(canaryConfig, r.doc_type);

    return {
      docType: r.doc_type,
      currentStage: docConfig.stage,
      totalCount: total,
      aiActiveCount: Number(r.ai_active),
      fallbackCount: Number(r.fallback_count),
      fallbackRate: total > 0 ? Number(r.fallback_count) / total : 0,
      mismatchCount: Number(r.mismatch_count),
      mismatchRate: total > 0 ? Number(r.mismatch_count) / total : 0,
      highRiskCount: Number(r.high_risk),
      latencyP50Ms: r.p50 ?? 0,
      latencyP95Ms: r.p95 ?? 0,
    };
  });
}
