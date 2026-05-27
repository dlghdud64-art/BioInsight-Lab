/**
 * Second DocumentType Rollout — 두 번째 문서 타입 카나리 확장
 *
 * 핵심 원칙:
 *  - 동시에 여러 새 documentType을 올리지 않음
 *  - 첫 타입 플레이북을 복제하되 더 보수적으로
 *  - 첫 타입 안정화가 second launch 선행조건
 *
 * ACTIVE_25 승격 evaluator 포함:
 *   GO_ACTIVE_25       → 25% 승격 가능
 *   HOLD_AT_5           → 5% 유지 관찰
 *   ROLLBACK_TO_SHADOW  → shadow 복귀
 */

import { db } from "@/lib/db";
import { loadCanaryConfig, getDocTypeConfig } from "./canary-config";
import type { CanaryStage } from "./types";
import { CANARY_STAGES } from "./types";

// ── Second Candidate Selection ──

export interface SecondCandidateReport {
  documentType: string;
  totalVolume: number;
  mismatchRate: number;
  fallbackRate: number;
  unknownRisk: number;
  orgScopeRisk: number;
  taskMappingHighRisk: number;
  falseSafeHighRisk: number;
  templateDriftCount: number;
  vendorHotspotCount: number;
  recommendation: "READY" | "NOT_READY";
  reason: string;
}

export async function selectSecondCandidate(
  excludeDocType: string,
  from?: Date,
  to?: Date,
): Promise<SecondCandidateReport[]> {
  const startDate = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = to ?? new Date();

  const rows = (await db.$queryRawUnsafe(
    `SELECT
      "documentTypeByRules" AS doc_type,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF')::bigint AS mismatch,
      COUNT(*) FILTER (WHERE "fallbackReason" IS NOT NULL)::bigint AS fallback,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'UNKNOWN_CLASSIFICATION')::bigint AS unknown_risk,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'ORG_SCOPE_BLOCKED')::bigint AS org_scope,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'TASK_MAPPING_DIFF')::bigint AS task_map,
      COUNT(*) FILTER (WHERE "verificationByAi" = 'AUTO_VERIFIED' AND "verificationByRules" IS NOT NULL AND "verificationByRules" != 'AUTO_VERIFIED')::bigint AS false_safe
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" != $3
      AND "processingPath" IN ('ai_shadow', 'rules')
      AND "documentTypeByRules" IS NOT NULL
    GROUP BY "documentTypeByRules"
    HAVING COUNT(*) >= 20
    ORDER BY COUNT(*) DESC
    LIMIT 10`,
    startDate, endDate, excludeDocType,
  )) as {
    doc_type: string; total: bigint; mismatch: bigint; fallback: bigint;
    unknown_risk: bigint; org_scope: bigint; task_map: bigint; false_safe: bigint;
  }[];

  return rows.map((r) => {
    const total = Number(r.total);
    const mismatch = Number(r.mismatch);
    const fallback = Number(r.fallback);
    const unknownRisk = Number(r.unknown_risk);
    const orgScope = Number(r.org_scope);
    const taskMap = Number(r.task_map);
    const falseSafe = Number(r.false_safe);
    const mismatchRate = total > 0 ? mismatch / total : 0;
    const fallbackRate = total > 0 ? fallback / total : 0;

    const ready =
      unknownRisk === 0 &&
      orgScope === 0 &&
      taskMap === 0 &&
      falseSafe === 0 &&
      total >= 50 &&
      mismatchRate < 0.1;

    return {
      documentType: r.doc_type,
      totalVolume: total,
      mismatchRate,
      fallbackRate,
      unknownRisk,
      orgScopeRisk: orgScope,
      taskMappingHighRisk: taskMap,
      falseSafeHighRisk: falseSafe,
      templateDriftCount: 0,
      vendorHotspotCount: 0,
      recommendation: ready ? "READY" as const : "NOT_READY" as const,
      reason: ready
        ? "모든 필수 조건 충족 — ACTIVE_5 후보"
        : buildNotReadyReason(unknownRisk, orgScope, taskMap, falseSafe, total, mismatchRate),
    };
  });
}

function buildNotReadyReason(
  unknown: number, orgScope: number, taskMap: number,
  falseSafe: number, volume: number, mismatchRate: number,
): string {
  const parts: string[] = [];
  if (unknown > 0) parts.push(`unknown ${unknown}`);
  if (orgScope > 0) parts.push(`org scope ${orgScope}`);
  if (taskMap > 0) parts.push(`task mapping ${taskMap}`);
  if (falseSafe > 0) parts.push(`false-safe ${falseSafe}`);
  if (volume < 50) parts.push(`volume 부족 ${volume}`);
  if (mismatchRate >= 0.1) parts.push(`mismatch ${(mismatchRate * 100).toFixed(1)}%`);
  return parts.join(", ");
}

// ── Parallel Ops Rule ──

export interface ParallelOpsCheck {
  canProceed: boolean;
  reasons: string[];
}

export async function checkParallelOpsReadiness(
  firstDocType: string,
  secondDocType: string,
): Promise<ParallelOpsCheck> {
  const reasons: string[] = [];
  let canProceed = true;

  const canaryConfig = loadCanaryConfig();
  const firstConfig = getDocTypeConfig(canaryConfig, firstDocType);

  // 1. 첫 타입이 unstable이면 두 번째 타입 승격 금지
  const firstStageIdx = CANARY_STAGES.indexOf(firstConfig.stage);
  if (firstStageIdx < 5) { // ACTIVE_100 = index 5
    // 첫 타입이 ACTIVE_100 미만이면 경고
    reasons.push(`첫 타입 ${firstDocType} 아직 ${firstConfig.stage} — 안정화 미완료`);
    // 단, ACTIVE_50 이상이면 proceed 허용
    if (firstStageIdx < 4) { // ACTIVE_50 = index 4
      canProceed = false;
      reasons.push("첫 타입 ACTIVE_50 미달 — 두 번째 타입 승격 불가");
    }
  }

  // 2. 첫 타입 최근 halt 확인
  const haltRows = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt FROM "CanaryHaltLog"
    WHERE "documentType" = $1 AND "createdAt" >= NOW() - INTERVAL '7 days'`,
    firstDocType,
  )) as { cnt: bigint }[];
  const recentHalts = Number(haltRows[0]?.cnt ?? 0);
  if (recentHalts > 0) {
    canProceed = false;
    reasons.push(`첫 타입 최근 7일 halt ${recentHalts}건 — 두 번째 타입 launch 보류`);
  }

  // 3. 동시에 여러 새 타입이 ACTIVE가 아니어야 함
  const activeNewTypes = Object.entries(canaryConfig.docTypes)
    .filter(([dt, cfg]) =>
      dt !== firstDocType &&
      dt !== secondDocType &&
      CANARY_STAGES.indexOf(cfg.stage) >= 2, // ACTIVE_5+
    );
  if (activeNewTypes.length > 0) {
    canProceed = false;
    reasons.push(`이미 Active 중인 다른 타입: ${activeNewTypes.map(([dt, c]) => `${dt}(${c.stage})`).join(", ")}`);
  }

  if (canProceed) {
    reasons.push("parallel ops 조건 충족");
  }

  return { canProceed, reasons };
}

// ── Tightened Launch Config ──

export interface TightenedLaunchConfig {
  documentType: string;
  stage: CanaryStage;
  allowAutoVerify: boolean;
  minConfidence: number;
  maxFallbackRateAlert: number;
  maxMismatchRateAlert: number;
  reviewSamplingRate: number;
  timeoutAlertThreshold: number;
  providerErrorAlertThreshold: number;
  minObservationVolume: number;
}

export function generateTightenedConfig(documentType: string): TightenedLaunchConfig {
  return {
    documentType,
    stage: "ACTIVE_5",
    allowAutoVerify: false,
    minConfidence: 0.85,     // 첫 타입 0.8보다 보수적
    maxFallbackRateAlert: 0.04, // 첫 타입 0.05보다 보수적
    maxMismatchRateAlert: 0.07, // 첫 타입 0.08보다 보수적
    reviewSamplingRate: 0.3,    // 첫 타입 0.2보다 높은 샘플링
    timeoutAlertThreshold: 0.02,
    providerErrorAlertThreshold: 0.02,
    minObservationVolume: 80,   // 첫 타입 50보다 보수적
  };
}

// ── ACTIVE_25 승격 Evaluator ──

export const SECOND_PROMOTION_DECISIONS = [
  "GO_ACTIVE_25",
  "HOLD_AT_5",
  "ROLLBACK_TO_SHADOW",
] as const;

export type SecondPromotionDecision = (typeof SECOND_PROMOTION_DECISIONS)[number];

export interface SecondPromotionThresholds {
  minVolume: number;
  maxFallbackRate: number;
  maxMismatchRate: number;
  maxTimeoutRate: number;
  maxProviderErrorRate: number;
  maxLatencyP95Ms: number;
}

const DEFAULT_SECOND_THRESHOLDS: SecondPromotionThresholds = {
  minVolume: 80,
  maxFallbackRate: 0.04,
  maxMismatchRate: 0.06,
  maxTimeoutRate: 0.03,
  maxProviderErrorRate: 0.03,
  maxLatencyP95Ms: 3000,
};

export interface SecondPromotionReport {
  documentType: string;
  currentStage: CanaryStage;
  evaluationPeriod: { from: string; to: string };

  totalProcessed: number;
  aiInvoked: number;

  fallbackRate: number;
  mismatchRate: number;
  timeoutRate: number;
  providerErrorRate: number;

  highRiskTotal: number;
  unknownClassificationCount: number;
  falseSafeCandidateCount: number;
  falseSafeConfirmedCount: number;
  criticalFieldConflictCount: number;

  latencyP50Ms: number;
  latencyP95Ms: number;
  avgTokenUsage: number;

  haltCount: number;

  // Anomaly
  topAnomalyVendors: string[];
  topAnomalyTemplates: string[];
  reviewCandidateCount: number;

  decision: SecondPromotionDecision;
  decisionReasons: string[];
  thresholds: SecondPromotionThresholds;

  // Parallel ops
  firstDocTypeStable: boolean;
  parallelOpsOk: boolean;
}

export async function evaluateSecondPromotion(
  documentType: string,
  firstDocType: string,
  from?: Date,
  to?: Date,
  thresholds?: Partial<SecondPromotionThresholds>,
): Promise<SecondPromotionReport> {
  const startDate = from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const endDate = to ?? new Date();
  const t = { ...DEFAULT_SECOND_THRESHOLDS, ...thresholds };

  const canaryConfig = loadCanaryConfig();
  const docConfig = getDocTypeConfig(canaryConfig, documentType);

  // ── 집계 ──
  const rows = (await db.$queryRawUnsafe(
    `SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "processingPath" != 'rules')::bigint AS ai_invoked,
      COUNT(*) FILTER (WHERE "fallbackReason" IS NOT NULL)::bigint AS fallback,
      COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF')::bigint AS mismatch,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'AUTO_VERIFY_RISK')::bigint AS av_risk,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'ORG_SCOPE_BLOCKED')::bigint AS org_scope,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'TASK_MAPPING_DIFF')::bigint AS task_map,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'UNKNOWN_CLASSIFICATION')::bigint AS unknown_class,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'TIMEOUT_FALLBACK')::bigint AS timeout,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'PROVIDER_ERROR_FALLBACK')::bigint AS prov_err,
      COUNT(*) FILTER (WHERE "verificationByAi" = 'AUTO_VERIFIED' AND "verificationByRules" IS NOT NULL AND "verificationByRules" != 'AUTO_VERIFIED')::bigint AS false_safe,
      COUNT(*) FILTER (WHERE "isReviewCandidate" = true)::bigint AS review_candidates,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p50,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "aiLatencyMs") FILTER (WHERE "aiLatencyMs" IS NOT NULL) AS p95,
      COALESCE(AVG("tokenUsage") FILTER (WHERE "tokenUsage" IS NOT NULL), 0) AS avg_tokens
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3`,
    startDate, endDate, documentType,
  )) as {
    total: bigint; ai_invoked: bigint; fallback: bigint; mismatch: bigint;
    av_risk: bigint; org_scope: bigint; task_map: bigint; unknown_class: bigint;
    timeout: bigint; prov_err: bigint; false_safe: bigint; review_candidates: bigint;
    p50: number | null; p95: number | null; avg_tokens: number;
  }[];

  const q = rows[0];
  const totalProcessed = Number(q?.total ?? 0);
  const aiInvoked = Number(q?.ai_invoked ?? 0);
  const fallbackCount = Number(q?.fallback ?? 0);
  const mismatchCount = Number(q?.mismatch ?? 0);
  const avRisk = Number(q?.av_risk ?? 0);
  const orgScope = Number(q?.org_scope ?? 0);
  const taskMap = Number(q?.task_map ?? 0);
  const unknownClass = Number(q?.unknown_class ?? 0);
  const timeoutCount = Number(q?.timeout ?? 0);
  const provErrCount = Number(q?.prov_err ?? 0);
  const falseSafe = Number(q?.false_safe ?? 0);
  const reviewCandidates = Number(q?.review_candidates ?? 0);
  const highRiskTotal = avRisk + orgScope + taskMap;

  const fallbackRate = aiInvoked > 0 ? fallbackCount / aiInvoked : 0;
  const mismatchRate = aiInvoked > 0 ? mismatchCount / aiInvoked : 0;
  const timeoutRate = aiInvoked > 0 ? timeoutCount / aiInvoked : 0;
  const providerErrorRate = aiInvoked > 0 ? provErrCount / aiInvoked : 0;

  // Halt
  const haltRows = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt FROM "CanaryHaltLog"
    WHERE "documentType" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3`,
    documentType, startDate, endDate,
  )) as { cnt: bigint }[];
  const haltCount = Number(haltRows[0]?.cnt ?? 0);

  // Vendor anomalies
  const vendorAnomalies = (await db.$queryRawUnsafe(
    `SELECT "orgId" FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND "documentTypeByRules" = $3
      AND "mismatchCategory" NOT IN ('NO_DIFF', 'LOW_CONFIDENCE_FALLBACK')
      AND "processingPath" != 'rules'
    GROUP BY "orgId" HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC LIMIT 5`,
    startDate, endDate, documentType,
  )) as { orgId: string }[];

  // Parallel ops check
  const parallelOps = await checkParallelOpsReadiness(firstDocType, documentType);

  // ── Decision Matrix ──
  const reasons: string[] = [];
  let decision: SecondPromotionDecision;

  // ROLLBACK_TO_SHADOW 조건
  if (highRiskTotal > 0 || unknownClass > 0) {
    decision = "ROLLBACK_TO_SHADOW";
    if (avRisk > 0) reasons.push(`AUTO_VERIFY_RISK: ${avRisk}`);
    if (orgScope > 0) reasons.push(`ORG_SCOPE_BLOCKED: ${orgScope}`);
    if (taskMap > 0) reasons.push(`TASK_MAPPING_DIFF: ${taskMap}`);
    if (unknownClass > 0) reasons.push(`UNKNOWN_CLASSIFICATION: ${unknownClass}`);
  } else if (falseSafe > 0) {
    decision = "ROLLBACK_TO_SHADOW";
    reasons.push(`Confirmed false-safe: ${falseSafe}`);
  } else if (haltCount > 0) {
    decision = "ROLLBACK_TO_SHADOW";
    reasons.push(`Halt ${haltCount}건`);
  }
  // HOLD_AT_5 조건
  else if (totalProcessed < t.minVolume) {
    decision = "HOLD_AT_5";
    reasons.push(`Volume 부족: ${totalProcessed} < ${t.minVolume}`);
  } else if (!parallelOps.canProceed) {
    decision = "HOLD_AT_5";
    reasons.push(...parallelOps.reasons);
  } else {
    // 품질 체크
    const allGreen =
      fallbackRate <= t.maxFallbackRate &&
      mismatchRate <= t.maxMismatchRate &&
      timeoutRate <= t.maxTimeoutRate &&
      providerErrorRate <= t.maxProviderErrorRate &&
      (q?.p95 ?? 0) <= t.maxLatencyP95Ms;

    if (allGreen) {
      decision = "GO_ACTIVE_25";
      reasons.push("모든 조건 충족 — ACTIVE_25 승격 가능");
      reasons.push(`Fallback ${(fallbackRate * 100).toFixed(1)}%, Mismatch ${(mismatchRate * 100).toFixed(1)}%`);
    } else {
      decision = "HOLD_AT_5";
      if (fallbackRate > t.maxFallbackRate) reasons.push(`Fallback ${(fallbackRate * 100).toFixed(1)}%`);
      if (mismatchRate > t.maxMismatchRate) reasons.push(`Mismatch ${(mismatchRate * 100).toFixed(1)}%`);
      if (timeoutRate > t.maxTimeoutRate) reasons.push(`Timeout ${(timeoutRate * 100).toFixed(1)}%`);
      if (providerErrorRate > t.maxProviderErrorRate) reasons.push(`Provider Error ${(providerErrorRate * 100).toFixed(1)}%`);
      if ((q?.p95 ?? 0) > t.maxLatencyP95Ms) reasons.push(`P95 ${q?.p95?.toFixed(0)}ms`);
    }
  }

  return {
    documentType,
    currentStage: docConfig.stage,
    evaluationPeriod: { from: startDate.toISOString(), to: endDate.toISOString() },
    totalProcessed,
    aiInvoked,
    fallbackRate,
    mismatchRate,
    timeoutRate,
    providerErrorRate,
    highRiskTotal,
    unknownClassificationCount: unknownClass,
    falseSafeCandidateCount: falseSafe,
    falseSafeConfirmedCount: 0,
    criticalFieldConflictCount: 0,
    latencyP50Ms: q?.p50 ?? 0,
    latencyP95Ms: q?.p95 ?? 0,
    avgTokenUsage: Number(q?.avg_tokens ?? 0),
    haltCount,
    topAnomalyVendors: vendorAnomalies.map((v) => v.orgId),
    topAnomalyTemplates: [],
    reviewCandidateCount: reviewCandidates,
    decision,
    decisionReasons: reasons,
    thresholds: t,
    firstDocTypeStable: parallelOps.canProceed,
    parallelOpsOk: parallelOps.canProceed,
  };
}

/**
 * ACTIVE_25 preflight — 두 번째 타입 승격 전 안전 점검
 */
export async function runSecondDocTypePreflight(
  documentType: string,
  firstDocType: string,
): Promise<{ passed: boolean; items: { name: string; passed: boolean; detail: string }[] }> {
  const items: { name: string; passed: boolean; detail: string }[] = [];

  const canaryConfig = loadCanaryConfig();
  const docConfig = getDocTypeConfig(canaryConfig, documentType);
  const firstConfig = getDocTypeConfig(canaryConfig, firstDocType);

  // 1. 현재 stage = ACTIVE_5
  items.push({
    name: "current_stage_active_5",
    passed: docConfig.stage === "ACTIVE_5",
    detail: `현재: ${docConfig.stage}`,
  });

  // 2. allowAutoVerify = false
  items.push({
    name: "auto_verify_disabled",
    passed: !docConfig.allowAutoVerify,
    detail: `allowAutoVerify: ${docConfig.allowAutoVerify}`,
  });

  // 3. First type stable (ACTIVE_50+)
  const firstStageIdx = CANARY_STAGES.indexOf(firstConfig.stage);
  items.push({
    name: "first_type_stable",
    passed: firstStageIdx >= 4,
    detail: `첫 타입 ${firstDocType}: ${firstConfig.stage}`,
  });

  // 4. First type 최근 halt 0
  const haltRows = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt FROM "CanaryHaltLog"
    WHERE "documentType" = $1 AND "createdAt" >= NOW() - INTERVAL '7 days'`,
    firstDocType,
  )) as { cnt: bigint }[];
  const firstHalts = Number(haltRows[0]?.cnt ?? 0);
  items.push({
    name: "first_type_no_recent_halts",
    passed: firstHalts === 0,
    detail: `첫 타입 최근 7일 halt: ${firstHalts}`,
  });

  // 5. Second type 최근 high-risk 0
  const riskRows = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt FROM "ShadowComparisonLog"
    WHERE "documentTypeByRules" = $1 AND "createdAt" >= NOW() - INTERVAL '24 hours'
      AND "mismatchCategory" IN ('AUTO_VERIFY_RISK', 'ORG_SCOPE_BLOCKED', 'TASK_MAPPING_DIFF', 'UNKNOWN_CLASSIFICATION')`,
    documentType,
  )) as { cnt: bigint }[];
  items.push({
    name: "no_high_risk_24h",
    passed: Number(riskRows[0]?.cnt ?? 0) === 0,
    detail: `최근 24h high-risk: ${Number(riskRows[0]?.cnt ?? 0)}`,
  });

  // 6. Comparison log 정상
  const logRows = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt FROM "ShadowComparisonLog"
    WHERE "documentTypeByRules" = $1 AND "createdAt" >= NOW() - INTERVAL '1 hour'`,
    documentType,
  )) as { cnt: bigint }[];
  items.push({
    name: "comparison_log_active",
    passed: Number(logRows[0]?.cnt ?? 0) > 0,
    detail: `최근 1h 로그: ${Number(logRows[0]?.cnt ?? 0)}건`,
  });

  // 7. Global enabled
  items.push({
    name: "global_enabled",
    passed: canaryConfig.globalEnabled,
    detail: `globalEnabled: ${canaryConfig.globalEnabled}`,
  });

  return { passed: items.every((i) => i.passed), items };
}

/**
 * 리뷰 샘플 추출 — 두 번째 타입 검증용
 */
export async function extractSecondDocTypeReviewSamples(
  documentType: string,
  from?: Date,
  to?: Date,
  limit: number = 20,
): Promise<{
  requestId: string;
  orgId: string;
  confidence: number | null;
  mismatchCategory: string;
  fallbackReason: string | null;
  reason: string;
}[]> {
  const startDate = from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const endDate = to ?? new Date();

  const rows = (await db.$queryRawUnsafe(
    `(
      SELECT "requestId", "orgId", "confidence", "mismatchCategory", "fallbackReason",
             'mismatch sample' AS reason
      FROM "ShadowComparisonLog"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND "documentTypeByRules" = $3
        AND "mismatchCategory" != 'NO_DIFF' AND "processingPath" != 'rules'
      ORDER BY "createdAt" DESC LIMIT $4
    )
    UNION ALL
    (
      SELECT "requestId", "orgId", "confidence", "mismatchCategory", "fallbackReason",
             'fallback sample' AS reason
      FROM "ShadowComparisonLog"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND "documentTypeByRules" = $3
        AND "fallbackReason" IS NOT NULL AND "processingPath" != 'rules'
      ORDER BY "createdAt" DESC LIMIT $4
    )
    UNION ALL
    (
      SELECT "requestId", "orgId", "confidence", "mismatchCategory", "fallbackReason",
             'high confidence blocked' AS reason
      FROM "ShadowComparisonLog"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND "documentTypeByRules" = $3
        AND "confidence" >= 0.95 AND "mismatchCategory" != 'NO_DIFF'
        AND "processingPath" != 'rules'
      ORDER BY "createdAt" DESC LIMIT $4
    )`,
    startDate, endDate, documentType, limit,
  )) as { requestId: string; orgId: string; confidence: number | null; mismatchCategory: string; fallbackReason: string | null; reason: string }[];

  return rows;
}
