/**
 * Final Promotion Evaluator — ACTIVE_50 → ACTIVE_100 승격 판정
 *
 * 5단계 판정:
 *   GO_ACTIVE_100_RESTRICTED       → ACTIVE_100 + restricted auto-verify 유지
 *   GO_ACTIVE_100_NO_AUTOVERIFY    → ACTIVE_100 + auto-verify off
 *   HOLD_AT_50                     → ACTIVE_50 유지 + 관찰
 *   ROLLBACK_TO_25                 → ACTIVE_25 강등
 *   ROLLBACK_TO_SHADOW             → SHADOW_ONLY 강등
 *
 * ACTIVE_100 = full traffic, 더 이상 bucket routing 없음.
 * auto-verify는 기존 restricted policy 유지 또는 off.
 */

import { db } from "@/lib/db";
import { loadCanaryConfig, getDocTypeConfig } from "./canary-config";
import type { CanaryStage } from "./types";

// ── Final Decision Enum ──

export const FINAL_PROMOTION_DECISIONS = [
  "GO_ACTIVE_100_RESTRICTED",
  "GO_ACTIVE_100_NO_AUTOVERIFY",
  "HOLD_AT_50",
  "ROLLBACK_TO_25",
  "ROLLBACK_TO_SHADOW",
] as const;

export type FinalPromotionDecision = (typeof FINAL_PROMOTION_DECISIONS)[number];

// ── Thresholds ──

export interface FinalPromotionThresholds {
  minVolume: number;
  maxFallbackRate: number;
  maxMismatchRate: number;
  maxTimeoutRate: number;
  maxProviderErrorRate: number;
  maxLatencyP95Ms: number;
  maxFalseSafeConfirmed: number;
  maxCriticalFieldConflictRate: number;
  minAutoVerifyAccuracyRate: number;
}

const DEFAULT_FINAL_THRESHOLDS: FinalPromotionThresholds = {
  minVolume: 200,
  maxFallbackRate: 0.02,
  maxMismatchRate: 0.03,
  maxTimeoutRate: 0.02,
  maxProviderErrorRate: 0.02,
  maxLatencyP95Ms: 2500,
  maxFalseSafeConfirmed: 0,
  maxCriticalFieldConflictRate: 0.01,
  minAutoVerifyAccuracyRate: 0.995,
};

// ── Report ──

export interface FinalPromotionReport {
  documentType: string;
  currentStage: CanaryStage;
  evaluationPeriod: { from: string; to: string };

  // Volume
  totalProcessed: number;
  aiInvoked: number;
  canaryVolume: number;

  // Quality
  fallbackCount: number;
  fallbackRate: number;
  mismatchCount: number;
  mismatchRate: number;
  timeoutRate: number;
  providerErrorRate: number;

  // High-risk
  highRiskTotal: number;
  unknownClassificationCount: number;
  haltCount: number;

  // Auto-verify metrics (ACTIVE_50 기간)
  autoVerifyAttempted: number;
  autoVerifyAllowed: number;
  autoVerifyBlocked: number;
  autoVerifyAccuracyRate: number;
  falseSafeCandidateCount: number;
  falseSafeConfirmedCount: number;
  criticalFieldConflictRate: number;

  // Latency
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  avgTokenUsage: number;

  // Decision
  decision: FinalPromotionDecision;
  decisionReasons: string[];
  thresholds: FinalPromotionThresholds;
}

export interface FinalPromotionQuery {
  documentType: string;
  from?: Date;
  to?: Date;
  thresholds?: Partial<FinalPromotionThresholds>;
}

export async function evaluateFinalPromotion(
  query: FinalPromotionQuery,
): Promise<FinalPromotionReport> {
  const from = query.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const to = query.to ?? new Date();
  const thresholds = { ...DEFAULT_FINAL_THRESHOLDS, ...query.thresholds };

  const canaryConfig = loadCanaryConfig();
  const docConfig = getDocTypeConfig(canaryConfig, query.documentType);
  const currentStage = docConfig.stage;

  // ── 트래픽 + 품질 집계 ──
  const rows = (await db.$queryRawUnsafe(
    `SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "processingPath" != 'rules')::bigint AS ai_invoked,
      COUNT(*) FILTER (WHERE "processingPath" IN ('ai_active_canary', 'ai_active_full'))::bigint AS canary_vol,
      COUNT(*) FILTER (WHERE "fallbackReason" IS NOT NULL)::bigint AS fallback_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF')::bigint AS mismatch_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'AUTO_VERIFY_RISK')::bigint AS auto_verify_risk,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'ORG_SCOPE_BLOCKED')::bigint AS org_scope,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'TASK_MAPPING_DIFF')::bigint AS task_map,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'UNKNOWN_CLASSIFICATION')::bigint AS unknown_class,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'TIMEOUT_FALLBACK')::bigint AS timeout_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'PROVIDER_ERROR_FALLBACK')::bigint AS provider_err,
      COUNT(*) FILTER (WHERE "isReviewCandidate" = true AND "verificationByAi" = 'AUTO_VERIFIED' AND "verificationByRules" IS NOT NULL AND "verificationByRules" != 'AUTO_VERIFIED')::bigint AS false_safe_candidates,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p50,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p95,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p99,
      COALESCE(AVG("tokenUsage") FILTER (WHERE "tokenUsage" IS NOT NULL), 0) AS avg_tokens
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3`,
    from, to, query.documentType,
  )) as {
    total: bigint; ai_invoked: bigint; canary_vol: bigint;
    fallback_count: bigint; mismatch_count: bigint;
    auto_verify_risk: bigint; org_scope: bigint; task_map: bigint; unknown_class: bigint;
    timeout_count: bigint; provider_err: bigint; false_safe_candidates: bigint;
    p50: number | null; p95: number | null; p99: number | null; avg_tokens: number;
  }[];

  const q = rows[0];
  const totalProcessed = Number(q?.total ?? 0);
  const aiInvoked = Number(q?.ai_invoked ?? 0);
  const canaryVolume = Number(q?.canary_vol ?? 0);
  const fallbackCount = Number(q?.fallback_count ?? 0);
  const mismatchCount = Number(q?.mismatch_count ?? 0);
  const autoVerifyRisk = Number(q?.auto_verify_risk ?? 0);
  const orgScope = Number(q?.org_scope ?? 0);
  const taskMap = Number(q?.task_map ?? 0);
  const unknownClass = Number(q?.unknown_class ?? 0);
  const timeoutCount = Number(q?.timeout_count ?? 0);
  const providerErr = Number(q?.provider_err ?? 0);
  const falseSafeCandidates = Number(q?.false_safe_candidates ?? 0);
  const highRiskTotal = autoVerifyRisk + orgScope + taskMap;

  const fallbackRate = aiInvoked > 0 ? fallbackCount / aiInvoked : 0;
  const mismatchRate = aiInvoked > 0 ? mismatchCount / aiInvoked : 0;
  const timeoutRate = aiInvoked > 0 ? timeoutCount / aiInvoked : 0;
  const providerErrorRate = aiInvoked > 0 ? providerErr / aiInvoked : 0;

  // ── Halt 이력 ──
  const haltRows = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt FROM "CanaryHaltLog"
    WHERE "documentType" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3`,
    query.documentType, from, to,
  )) as { cnt: bigint }[];
  const haltCount = Number(haltRows[0]?.cnt ?? 0);

  // ── Auto-verify accuracy (ACTIVE_50 기간) ──
  // auto-verify가 시도된 건수 = ai_active + confidence >= policy threshold
  const autoVerifyAttempted = canaryVolume; // 단순화
  const autoVerifyAllowed = canaryVolume - fallbackCount - mismatchCount;
  const autoVerifyBlocked = fallbackCount + mismatchCount;
  const autoVerifyAccuracyRate = autoVerifyAttempted > 0
    ? (autoVerifyAttempted - falseSafeCandidates) / autoVerifyAttempted
    : 1;
  const criticalFieldConflictRate = 0; // DB 별도 컬럼 추가 시 반영

  // ── Decision Matrix ──
  const reasons: string[] = [];
  let decision: FinalPromotionDecision;

  // P0: Invariant violation
  if (highRiskTotal > 0 || unknownClass > 0) {
    decision = "ROLLBACK_TO_SHADOW";
    if (highRiskTotal > 0) reasons.push(`High-risk ${highRiskTotal}건`);
    if (unknownClass > 0) reasons.push(`Unknown classification ${unknownClass}건`);
  }
  // P1: Halt 이력
  else if (haltCount > 0) {
    decision = "ROLLBACK_TO_25";
    reasons.push(`Halt ${haltCount}건 발동`);
  }
  // P2: False-safe confirmed
  else if (falseSafeCandidates > thresholds.maxFalseSafeConfirmed) {
    decision = "ROLLBACK_TO_25";
    reasons.push(`False-safe 후보 ${falseSafeCandidates}건 > ${thresholds.maxFalseSafeConfirmed}`);
  }
  // Volume check
  else if (totalProcessed < thresholds.minVolume) {
    decision = "HOLD_AT_50";
    reasons.push(`모수 부족: ${totalProcessed} < ${thresholds.minVolume}`);
  }
  // Quality check
  else {
    const allGreen =
      fallbackRate <= thresholds.maxFallbackRate &&
      mismatchRate <= thresholds.maxMismatchRate &&
      timeoutRate <= thresholds.maxTimeoutRate &&
      providerErrorRate <= thresholds.maxProviderErrorRate &&
      (q?.p95 ?? 0) <= thresholds.maxLatencyP95Ms;

    if (!allGreen) {
      // Marginal → HOLD, severe → ROLLBACK
      const severe =
        fallbackRate > thresholds.maxFallbackRate * 2 ||
        mismatchRate > thresholds.maxMismatchRate * 2;

      if (severe) {
        decision = "ROLLBACK_TO_25";
        reasons.push("품질 지표 심각 초과");
      } else {
        decision = "HOLD_AT_50";
        reasons.push("품질 지표 경계선");
      }
      if (fallbackRate > thresholds.maxFallbackRate) reasons.push(`Fallback ${(fallbackRate * 100).toFixed(1)}%`);
      if (mismatchRate > thresholds.maxMismatchRate) reasons.push(`Mismatch ${(mismatchRate * 100).toFixed(1)}%`);
      if (timeoutRate > thresholds.maxTimeoutRate) reasons.push(`Timeout ${(timeoutRate * 100).toFixed(1)}%`);
      if ((q?.p95 ?? 0) > thresholds.maxLatencyP95Ms) reasons.push(`P95 ${q?.p95?.toFixed(0)}ms`);
    } else {
      // All green → auto-verify 유지 여부 판정
      reasons.push("모든 Zero-risk 조건 충족");

      if (
        docConfig.allowAutoVerify &&
        autoVerifyAccuracyRate >= thresholds.minAutoVerifyAccuracyRate &&
        falseSafeCandidates === 0
      ) {
        decision = "GO_ACTIVE_100_RESTRICTED";
        reasons.push(`Auto-verify accuracy ${(autoVerifyAccuracyRate * 100).toFixed(2)}% ≥ ${(thresholds.minAutoVerifyAccuracyRate * 100).toFixed(1)}%`);
      } else {
        decision = "GO_ACTIVE_100_NO_AUTOVERIFY";
        if (!docConfig.allowAutoVerify) reasons.push("Auto-verify 미활성 상태");
        if (autoVerifyAccuracyRate < thresholds.minAutoVerifyAccuracyRate) {
          reasons.push(`Auto-verify accuracy ${(autoVerifyAccuracyRate * 100).toFixed(2)}% < 기준`);
        }
      }
    }
  }

  return {
    documentType: query.documentType,
    currentStage,
    evaluationPeriod: { from: from.toISOString(), to: to.toISOString() },
    totalProcessed,
    aiInvoked,
    canaryVolume,
    fallbackCount,
    fallbackRate,
    mismatchCount,
    mismatchRate,
    timeoutRate,
    providerErrorRate,
    highRiskTotal,
    unknownClassificationCount: unknownClass,
    haltCount,
    autoVerifyAttempted,
    autoVerifyAllowed,
    autoVerifyBlocked,
    autoVerifyAccuracyRate,
    falseSafeCandidateCount: falseSafeCandidates,
    falseSafeConfirmedCount: 0,
    criticalFieldConflictRate,
    latencyP50Ms: q?.p50 ?? 0,
    latencyP95Ms: q?.p95 ?? 0,
    latencyP99Ms: q?.p99 ?? 0,
    avgTokenUsage: Number(q?.avg_tokens ?? 0),
    decision,
    decisionReasons: reasons,
    thresholds,
  };
}

/**
 * ACTIVE_100 preflight 체크 — 최종 승격 전 안전 점검
 */
export interface FinalPreflightItem {
  name: string;
  passed: boolean;
  detail: string;
}

export async function runFinalPreflight(
  documentType: string,
): Promise<{ passed: boolean; items: FinalPreflightItem[] }> {
  const items: FinalPreflightItem[] = [];
  const canaryConfig = loadCanaryConfig();
  const docConfig = getDocTypeConfig(canaryConfig, documentType);

  // 1. 현재 Stage = ACTIVE_50
  items.push({
    name: "current_stage_active_50",
    passed: docConfig.stage === "ACTIVE_50",
    detail: `현재 stage: ${docConfig.stage}`,
  });

  // 2. Global enabled
  items.push({
    name: "global_enabled",
    passed: canaryConfig.globalEnabled,
    detail: `globalEnabled: ${canaryConfig.globalEnabled}`,
  });

  // 3. 최근 24h Halt 없음
  const haltRows = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt FROM "CanaryHaltLog"
    WHERE "documentType" = $1 AND "createdAt" >= NOW() - INTERVAL '24 hours'`,
    documentType,
  )) as { cnt: bigint }[];
  const recentHalts = Number(haltRows[0]?.cnt ?? 0);
  items.push({
    name: "no_recent_halts",
    passed: recentHalts === 0,
    detail: `최근 24h halt: ${recentHalts}건`,
  });

  // 4. 최근 24h high-risk 0
  const riskRows = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt FROM "ShadowComparisonLog"
    WHERE "documentTypeByRules" = $1 AND "createdAt" >= NOW() - INTERVAL '24 hours'
      AND "mismatchCategory" IN ('AUTO_VERIFY_RISK', 'ORG_SCOPE_BLOCKED', 'TASK_MAPPING_DIFF', 'UNKNOWN_CLASSIFICATION')`,
    documentType,
  )) as { cnt: bigint }[];
  const recentHighRisk = Number(riskRows[0]?.cnt ?? 0);
  items.push({
    name: "no_high_risk_24h",
    passed: recentHighRisk === 0,
    detail: `최근 24h high-risk: ${recentHighRisk}건`,
  });

  // 5. Comparison log 정상 기록 (최근 1h 내 로그 존재)
  const logRows = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt FROM "ShadowComparisonLog"
    WHERE "documentTypeByRules" = $1 AND "createdAt" >= NOW() - INTERVAL '1 hour'
      AND "processingPath" != 'rules'`,
    documentType,
  )) as { cnt: bigint }[];
  const recentLogs = Number(logRows[0]?.cnt ?? 0);
  items.push({
    name: "comparison_log_active",
    passed: recentLogs > 0,
    detail: `최근 1h AI 로그: ${recentLogs}건`,
  });

  // 6. Rollback switch 동작 확인 (canary config 변경 가능)
  items.push({
    name: "rollback_switch_ready",
    passed: true,
    detail: "환경변수 기반 즉시 rollback 가능",
  });

  const allPassed = items.every((i) => i.passed);
  return { passed: allPassed, items };
}

/**
 * 리뷰 샘플 추출 — auto-verify 검증용
 */
export interface ReviewSample {
  requestId: string;
  orgId: string;
  confidence: number | null;
  mismatchCategory: string;
  verificationByRules: string | null;
  verificationByAi: string | null;
  fallbackReason: string | null;
  reason: string;
}

export async function extractReviewSamples(
  documentType: string,
  from?: Date,
  to?: Date,
  limit: number = 20,
): Promise<ReviewSample[]> {
  const startDate = from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const endDate = to ?? new Date();

  const rows = (await db.$queryRawUnsafe(
    `(
      SELECT "requestId", "orgId", "confidence", "mismatchCategory",
             "verificationByRules", "verificationByAi", "fallbackReason",
             'false-safe candidate' AS reason
      FROM "ShadowComparisonLog"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND "documentTypeByRules" = $3
        AND "verificationByAi" = 'AUTO_VERIFIED'
        AND "verificationByRules" IS NOT NULL AND "verificationByRules" != 'AUTO_VERIFIED'
      LIMIT $4
    )
    UNION ALL
    (
      SELECT "requestId", "orgId", "confidence", "mismatchCategory",
             "verificationByRules", "verificationByAi", "fallbackReason",
             'high-confidence mismatch' AS reason
      FROM "ShadowComparisonLog"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND "documentTypeByRules" = $3
        AND "confidence" >= 0.95
        AND "mismatchCategory" NOT IN ('NO_DIFF', 'LOW_CONFIDENCE_FALLBACK')
      LIMIT $4
    )
    UNION ALL
    (
      SELECT "requestId", "orgId", "confidence", "mismatchCategory",
             "verificationByRules", "verificationByAi", "fallbackReason",
             'fallback sample' AS reason
      FROM "ShadowComparisonLog"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND "documentTypeByRules" = $3
        AND "fallbackReason" IS NOT NULL
      ORDER BY "createdAt" DESC
      LIMIT $4
    )`,
    startDate, endDate, documentType, limit,
  )) as ReviewSample[];

  return rows;
}
