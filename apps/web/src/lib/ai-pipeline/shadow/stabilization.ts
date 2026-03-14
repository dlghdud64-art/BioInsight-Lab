/**
 * Full-Active Stabilization — ACTIVE_100 안정화 운영
 *
 * 1. Stabilization Dashboard: 일별/주별 트렌드 점검
 * 2. Long-Tail Anomaly Backlog: 벤더/템플릿/포맷 edge case 관리
 * 3. Standard Rollout Playbook: 재사용 가능한 기준 모델
 * 4. Operating State: FULL_ACTIVE_STABLE / FULL_ACTIVE_WITH_RESTRICTIONS
 */

import { db } from "@/lib/db";

// ── Operating State ──

export const OPERATING_STATES = [
  "FULL_ACTIVE_STABLE",
  "FULL_ACTIVE_WITH_RESTRICTIONS",
] as const;

export type OperatingState = (typeof OPERATING_STATES)[number];

// ── Stabilization Dashboard ──

export interface StabilizationTrend {
  date: string;
  totalProcessed: number;
  fallbackRate: number;
  mismatchRate: number;
  falseSafeCandidateCount: number;
  exclusionHitCount: number;
  criticalFieldConflictCount: number;
  latencyP95Ms: number;
  avgTokenUsage: number;
  reviewCandidateCount: number;
}

export interface StabilizationDashboard {
  documentType: string;
  operatingState: OperatingState;
  period: { from: string; to: string };
  dailyTrends: StabilizationTrend[];
  summary: {
    avgFallbackRate: number;
    avgMismatchRate: number;
    totalFalseSafeCandidates: number;
    totalExclusionHits: number;
    avgLatencyP95Ms: number;
    trendDirection: "IMPROVING" | "STABLE" | "DEGRADING";
    recommendation: string;
  };
}

export async function getStabilizationDashboard(
  documentType: string,
  days: number = 7,
): Promise<StabilizationDashboard> {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const to = new Date();

  const rows = (await db.$queryRawUnsafe(
    `SELECT
      DATE("createdAt") AS dt,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "fallbackReason" IS NOT NULL)::bigint AS fallback_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF')::bigint AS mismatch_count,
      COUNT(*) FILTER (WHERE "verificationByAi" = 'AUTO_VERIFIED' AND "verificationByRules" IS NOT NULL AND "verificationByRules" != 'AUTO_VERIFIED')::bigint AS false_safe,
      COUNT(*) FILTER (WHERE "isReviewCandidate" = true)::bigint AS review_candidates,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p95,
      COALESCE(AVG("tokenUsage") FILTER (WHERE "tokenUsage" IS NOT NULL), 0) AS avg_tokens
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3
      AND "processingPath" != 'rules'
    GROUP BY DATE("createdAt")
    ORDER BY dt ASC`,
    from, to, documentType,
  )) as {
    dt: Date; total: bigint; fallback_count: bigint; mismatch_count: bigint;
    false_safe: bigint; review_candidates: bigint; p95: number | null; avg_tokens: number;
  }[];

  const dailyTrends: StabilizationTrend[] = rows.map((r) => {
    const total = Number(r.total);
    const fallbackCount = Number(r.fallback_count);
    const mismatchCount = Number(r.mismatch_count);
    return {
      date: r.dt instanceof Date ? r.dt.toISOString().split("T")[0] : String(r.dt),
      totalProcessed: total,
      fallbackRate: total > 0 ? fallbackCount / total : 0,
      mismatchRate: total > 0 ? mismatchCount / total : 0,
      falseSafeCandidateCount: Number(r.false_safe),
      exclusionHitCount: 0,
      criticalFieldConflictCount: 0,
      latencyP95Ms: r.p95 ?? 0,
      avgTokenUsage: Number(r.avg_tokens),
      reviewCandidateCount: Number(r.review_candidates),
    };
  });

  // Summary
  const totalDays = dailyTrends.length || 1;
  const avgFallbackRate = dailyTrends.reduce((s, t) => s + t.fallbackRate, 0) / totalDays;
  const avgMismatchRate = dailyTrends.reduce((s, t) => s + t.mismatchRate, 0) / totalDays;
  const totalFalseSafe = dailyTrends.reduce((s, t) => s + t.falseSafeCandidateCount, 0);
  const avgLatency = dailyTrends.reduce((s, t) => s + t.latencyP95Ms, 0) / totalDays;

  // Trend direction
  let trendDirection: "IMPROVING" | "STABLE" | "DEGRADING" = "STABLE";
  if (dailyTrends.length >= 3) {
    const first = dailyTrends.slice(0, Math.ceil(totalDays / 2));
    const second = dailyTrends.slice(Math.ceil(totalDays / 2));
    const firstAvg = first.reduce((s, t) => s + t.mismatchRate, 0) / first.length;
    const secondAvg = second.reduce((s, t) => s + t.mismatchRate, 0) / second.length;
    if (secondAvg < firstAvg * 0.8) trendDirection = "IMPROVING";
    else if (secondAvg > firstAvg * 1.2) trendDirection = "DEGRADING";
  }

  // Operating state
  const operatingState: OperatingState = totalFalseSafe === 0 && avgMismatchRate < 0.02
    ? "FULL_ACTIVE_STABLE"
    : "FULL_ACTIVE_WITH_RESTRICTIONS";

  let recommendation: string;
  if (trendDirection === "DEGRADING") {
    recommendation = "품질 지표 악화 추세 — exclusion 또는 rollback 검토 필요";
  } else if (operatingState === "FULL_ACTIVE_STABLE") {
    recommendation = "안정 운영 — exclusion 완화 검토 가능";
  } else {
    recommendation = "제한 운영 유지 — 충분한 안정화 후 정책 완화 검토";
  }

  return {
    documentType,
    operatingState,
    period: { from: from.toISOString(), to: to.toISOString() },
    dailyTrends,
    summary: {
      avgFallbackRate,
      avgMismatchRate,
      totalFalseSafeCandidates: totalFalseSafe,
      totalExclusionHits: 0,
      avgLatencyP95Ms: avgLatency,
      trendDirection,
      recommendation,
    },
  };
}

// ── Long-Tail Anomaly Backlog ──

export interface LongTailAnomaly {
  type: string;
  description: string;
  count: number;
  priority: "P0" | "P1" | "P2";
  samples: string[];
  status: "OPEN" | "INVESTIGATING" | "RESOLVED";
}

export async function buildLongTailBacklog(
  documentType: string,
  from?: Date,
  to?: Date,
): Promise<LongTailAnomaly[]> {
  const startDate = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = to ?? new Date();
  const backlog: LongTailAnomaly[] = [];

  // 1. Vendor template drift (반복)
  const vendorDrift = (await db.$queryRawUnsafe(
    `SELECT "orgId", COUNT(*)::bigint AS cnt
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3
      AND "mismatchCategory" = 'DOC_TYPE_DIFF'
      AND "processingPath" != 'rules'
    GROUP BY "orgId"
    HAVING COUNT(*) >= 2
    ORDER BY cnt DESC LIMIT 10`,
    startDate, endDate, documentType,
  )) as { orgId: string; cnt: bigint }[];

  if (vendorDrift.length > 0) {
    backlog.push({
      type: "VENDOR_TEMPLATE_DRIFT",
      description: "특정 벤더에서 반복적 분류 drift",
      count: vendorDrift.reduce((s, r) => s + Number(r.cnt), 0),
      priority: "P1",
      samples: vendorDrift.map((r) => r.orgId),
      status: "OPEN",
    });
  }

  // 2. Classification ambiguity (rare)
  const ambiguity = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3
      AND "mismatchCategory" = 'UNKNOWN_CLASSIFICATION'
      AND "processingPath" != 'rules'`,
    startDate, endDate, documentType,
  )) as { cnt: bigint }[];

  const ambiguityCount = Number(ambiguity[0]?.cnt ?? 0);
  if (ambiguityCount > 0) {
    backlog.push({
      type: "RARE_CLASSIFICATION_AMBIGUITY",
      description: "간헐적 UNKNOWN 분류",
      count: ambiguityCount,
      priority: "P0",
      samples: [],
      status: "OPEN",
    });
  }

  // 3. Schema invalid (normalization edge case)
  const schemaInvalid = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3
      AND "mismatchCategory" = 'SCHEMA_INVALID_FALLBACK'
      AND "processingPath" != 'rules'`,
    startDate, endDate, documentType,
  )) as { cnt: bigint }[];

  const schemaCount = Number(schemaInvalid[0]?.cnt ?? 0);
  if (schemaCount > 0) {
    backlog.push({
      type: "NORMALIZATION_EDGE_CASE",
      description: "스키마 유효성 실패 (포맷 edge case)",
      count: schemaCount,
      priority: "P1",
      samples: [],
      status: "OPEN",
    });
  }

  // 4. High confidence mismatch (amount/date formatting)
  const highConfMismatch = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3
      AND "confidence" >= 0.95
      AND "mismatchCategory" NOT IN ('NO_DIFF', 'LOW_CONFIDENCE_FALLBACK')
      AND "processingPath" != 'rules'`,
    startDate, endDate, documentType,
  )) as { cnt: bigint }[];

  const highConfCount = Number(highConfMismatch[0]?.cnt ?? 0);
  if (highConfCount > 0) {
    backlog.push({
      type: "HIGH_CONFIDENCE_EDGE_CASE",
      description: "High confidence인데 mismatch — 포맷/정규화 문제 가능성",
      count: highConfCount,
      priority: "P1",
      samples: [],
      status: "OPEN",
    });
  }

  return backlog;
}

// ── Standard Rollout Playbook ──

export interface PlaybookStageGate {
  stage: string;
  criteria: string[];
  autoVerify: string;
  rollbackTrigger: string;
  minObservationPeriod: string;
}

export function generateStandardPlaybook(): PlaybookStageGate[] {
  return [
    {
      stage: "SHADOW_ONLY",
      criteria: [
        "comparison log 정상 기록",
        "mismatch rate < 10%",
        "unknown classification = 0",
        "org scope risk = 0",
        "최소 7일 관찰",
      ],
      autoVerify: "off",
      rollbackTrigger: "invariant 위반 즉시 OFF",
      minObservationPeriod: "7일",
    },
    {
      stage: "ACTIVE_5",
      criteria: [
        "high-risk = 0",
        "unknown = 0",
        "fallback rate < 5%",
        "mismatch rate < 8%",
        "halt = 0",
        "최소 50건 처리",
      ],
      autoVerify: "off",
      rollbackTrigger: "invariant 위반 → SHADOW_ONLY, halt → SHADOW_ONLY",
      minObservationPeriod: "3~7일",
    },
    {
      stage: "ACTIVE_25",
      criteria: [
        "high-risk = 0",
        "fallback rate < 3%",
        "mismatch rate < 5%",
        "timeout rate < 3%",
        "P95 latency < 3000ms",
        "최소 100건 처리",
        "anomaly hotspot 미감지",
      ],
      autoVerify: "off",
      rollbackTrigger: "high-risk → SHADOW_ONLY, halt → ACTIVE_5",
      minObservationPeriod: "5~7일",
    },
    {
      stage: "ACTIVE_50",
      criteria: [
        "모든 ACTIVE_25 기준 유지",
        "false-safe candidate = 0",
        "critical field conflict rate < 1%",
        "최소 200건 처리",
        "confidence band 안정",
      ],
      autoVerify: "restricted opt-in (0.99+ band, exclusion 적용)",
      rollbackTrigger: "false-safe → auto-verify off, high-risk → ACTIVE_5",
      minObservationPeriod: "7일",
    },
    {
      stage: "ACTIVE_100",
      criteria: [
        "모든 ACTIVE_50 기준 유지",
        "fallback rate < 2%",
        "mismatch rate < 3%",
        "auto-verify accuracy ≥ 99.5%",
        "최소 200건 처리",
        "long-tail anomaly 통제",
      ],
      autoVerify: "restricted 유지 또는 off",
      rollbackTrigger: "invariant → SHADOW_ONLY, quality 악화 → ACTIVE_25",
      minObservationPeriod: "7~14일",
    },
    {
      stage: "FULL_ACTIVE_STABLE",
      criteria: [
        "30일간 mismatch < 2%",
        "false-safe confirmed = 0",
        "long-tail backlog 통제",
        "exclusion 최소화",
        "trend STABLE or IMPROVING",
      ],
      autoVerify: "restricted band 보수적 유지",
      rollbackTrigger: "trend DEGRADING → restrictions 강화",
      minObservationPeriod: "지속 모니터링",
    },
  ];
}

// ── Policy Tightening/Loosening ──

export interface PolicyAdjustmentAdvice {
  type: "TIGHTEN" | "LOOSEN" | "HOLD";
  target: string;
  reason: string;
  recommendation: string;
}

export function evaluatePolicyAdjustments(
  dashboard: StabilizationDashboard,
  longTailBacklog: LongTailAnomaly[],
  daysSinceLastChange: number,
): PolicyAdjustmentAdvice[] {
  const advices: PolicyAdjustmentAdvice[] = [];

  // 완화 검토는 충분한 안정화 기간 이후에만
  const MIN_STABLE_DAYS = 14;

  if (dashboard.summary.trendDirection === "DEGRADING") {
    advices.push({
      type: "TIGHTEN",
      target: "exclusion_list",
      reason: "트렌드 악화",
      recommendation: "vendor/template exclusion 확대 검토",
    });
  }

  if (
    dashboard.operatingState === "FULL_ACTIVE_STABLE" &&
    daysSinceLastChange >= MIN_STABLE_DAYS &&
    longTailBacklog.filter((a) => a.status === "OPEN").length === 0
  ) {
    advices.push({
      type: "LOOSEN",
      target: "confidence_band",
      reason: `${daysSinceLastChange}일 안정 유지, open anomaly 0`,
      recommendation: "confidence band 하한 완화 검토 가능 (단, 보수적으로)",
    });
  }

  // Anomaly가 사라져도 바로 exclusion 해제하지 않음
  if (daysSinceLastChange < MIN_STABLE_DAYS) {
    advices.push({
      type: "HOLD",
      target: "all_policies",
      reason: `마지막 변경 후 ${daysSinceLastChange}일 — 최소 ${MIN_STABLE_DAYS}일 필요`,
      recommendation: "정책 변경 보류, 모니터링 유지",
    });
  }

  return advices;
}
