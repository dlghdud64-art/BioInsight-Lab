
/**
 * Auto-Verify Policy Engine — 제한적 opt-in auto-verify 판정
 *
 * 3계층 구조:
 *  1. Runtime Gate: 개별 요청에 대해 auto-verify 허용 여부 판정
 *  2. Eligibility Evaluator: 데이터 기반 6단계 eligibility 평가
 *  3. False-Safe Detector: AI가 자동 승인하면 안 되는 패턴 식별
 *
 * 기본 정책: allowAutoVerify=false (global default)
 * opt-in 조건: documentType + confidence band + exclusion + semantic gate 전부 통과
 */

import { db } from "@/lib/db";
import type {
  DocTypeCanaryConfig,
  AutoVerifyPolicy,
  AutoVerifyBlockReason,
  AutoVerifyEligibilityDecision,
} from "./types";

// ── 1. Runtime Gate ──

export interface AutoVerifyInput {
  documentType: string;
  confidence: number | null;
  schemaValid: boolean;
  orgId: string;
  templateFingerprint?: string;
  hasCriticalFieldConflict?: boolean;
  hasClassificationAmbiguity?: boolean;
  hasFallbackReason?: boolean;
  isFalseSafeCandidate?: boolean;
}

export interface AutoVerifyDecision {
  allowed: boolean;
  blockReason: AutoVerifyBlockReason | null;
  detail: string;
}

/**
 * 런타임에서 개별 요청의 auto-verify 허용 여부를 multi-gate로 판정.
 * 모든 gate를 순서대로 통과해야 allowed=true.
 */
export function evaluateAutoVerify(
  docConfig: DocTypeCanaryConfig,
  input: AutoVerifyInput,
): AutoVerifyDecision {
  // Gate 1: Global policy
  if (!docConfig.allowAutoVerify) {
    return block("POLICY_DISABLED", "allowAutoVerify=false");
  }

  const policy = docConfig.autoVerifyPolicy;
  if (!policy) {
    return block("POLICY_DISABLED", "autoVerifyPolicy 미설정");
  }

  // Gate 2: Stage eligibility (ACTIVE_50+ only)
  const activeStages = ["ACTIVE_50", "ACTIVE_100"];
  if (!activeStages.includes(docConfig.stage)) {
    return block("STAGE_NOT_ELIGIBLE", `stage=${docConfig.stage} — ACTIVE_50+ 필요`);
  }

  // Gate 3: UNKNOWN 문서 타입 절대 금지
  if (input.documentType === "UNKNOWN") {
    return block("UNKNOWN_DOC_TYPE", "UNKNOWN 문서 auto-verify 금지");
  }

  // Gate 4: Confidence
  if (input.confidence === null || input.confidence < policy.minConfidence) {
    return block("CONFIDENCE_TOO_LOW", `confidence ${input.confidence ?? "null"} < ${policy.minConfidence}`);
  }

  // Gate 5: Schema valid
  if (policy.onlyIfSchemaValid && !input.schemaValid) {
    return block("SCHEMA_INVALID", "schemaValid=false");
  }

  // Gate 6: Fallback reason
  if (policy.requireNoFallbackReason && input.hasFallbackReason) {
    return block("FALLBACK_TRIGGERED", "fallbackReason 존재");
  }

  // Gate 7: Critical field conflict
  if (policy.onlyIfNoCriticalFieldConflict && input.hasCriticalFieldConflict) {
    return block("CRITICAL_FIELD_CONFLICT", "critical field conflict 감지");
  }

  // Gate 8: Classification ambiguity
  if (policy.requireNoClassificationAmbiguity && input.hasClassificationAmbiguity) {
    return block("CLASSIFICATION_AMBIGUOUS", "classification ambiguity 감지");
  }

  // Gate 9: Vendor exclusion
  if (policy.excludedVendors.includes(input.orgId)) {
    return block("VENDOR_EXCLUDED", `excludedVendor: ${input.orgId}`);
  }

  // Gate 10: Template exclusion
  if (input.templateFingerprint && policy.excludedTemplates.includes(input.templateFingerprint)) {
    return block("TEMPLATE_EXCLUDED", `excludedTemplate: ${input.templateFingerprint}`);
  }

  // Gate 11: False-safe risk
  if (input.isFalseSafeCandidate) {
    if (policy.rollbackOnFirstFalseSafe) {
      return block("FALSE_SAFE_RISK", "false-safe 후보 감지 — 차단");
    }
  }

  return { allowed: true, blockReason: null, detail: "모든 gate 통과" };
}

function block(reason: AutoVerifyBlockReason, detail: string): AutoVerifyDecision {
  return { allowed: false, blockReason: reason, detail };
}

// ── 2. Eligibility Evaluator (데이터 기반 6단계) ──

export interface EligibilityResult {
  documentType: string;
  decision: AutoVerifyEligibilityDecision;
  evaluationPeriod: { from: string; to: string };

  // 누적 지표
  totalAiInvoked: number;
  invariantViolations: {
    autoVerifyRisk: number;
    orgScopeBlocked: number;
    unknownClassification: number;
    taskMappingDiff: number;
    total: number;
  };

  // Verification 안정성
  verificationDiffCount: number;
  verificationDiffRate: number;

  // False-safe
  falseSafeCandidateCount: number;
  falseSafeConfirmedCount: number;

  // Confidence band 분석
  confidenceBands: ConfidenceBandAnalysis[];

  // Exclusion 후보
  suggestedExcludedVendors: string[];
  suggestedExcludedTemplates: string[];
  vendorHotspotCount: number;
  templateHotspotCount: number;

  // 판정
  suggestedMinConfidence: number | null;
  eligibilityReasons: string[];
  suggestedPolicy: AutoVerifyPolicy | null;
}

export interface ConfidenceBandAnalysis {
  band: string;
  lower: number;
  upper: number;
  processedCount: number;
  mismatchRate: number;
  fallbackRate: number;
  manualReviewCandidateRate: number;
  criticalFieldConflictRate: number;
  falseSafeRiskCount: number;
}

export interface EligibilityQuery {
  documentType: string;
  from?: Date;
  to?: Date;
}

export async function evaluateAutoVerifyEligibility(
  query: EligibilityQuery,
): Promise<EligibilityResult> {
  const from = query.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const to = query.to ?? new Date();

  // ── 누적 위험 지표 ──
  const riskRows = (await db.$queryRawUnsafe(
    `SELECT
      COUNT(*) FILTER (WHERE "processingPath" != 'rules')::bigint AS ai_invoked,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'AUTO_VERIFY_RISK')::bigint AS auto_verify_risk,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'VERIFICATION_DIFF')::bigint AS ver_diff,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'ORG_SCOPE_BLOCKED')::bigint AS org_scope,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'UNKNOWN_CLASSIFICATION')::bigint AS unknown_class,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'TASK_MAPPING_DIFF')::bigint AS task_map_diff,
      COUNT(*) FILTER (WHERE "isReviewCandidate" = true AND "verificationByAi" = 'AUTO_VERIFIED' AND "verificationByRules" != 'AUTO_VERIFIED')::bigint AS false_safe_candidates
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3`,
    from, to, query.documentType,
  )) as {
    ai_invoked: bigint; auto_verify_risk: bigint; ver_diff: bigint;
    org_scope: bigint; unknown_class: bigint; task_map_diff: bigint;
    false_safe_candidates: bigint;
  }[];

  const r = riskRows[0];
  const totalAiInvoked = Number(r?.ai_invoked ?? 0);
  const autoVerifyRisk = Number(r?.auto_verify_risk ?? 0);
  const verDiff = Number(r?.ver_diff ?? 0);
  const orgScope = Number(r?.org_scope ?? 0);
  const unknownClass = Number(r?.unknown_class ?? 0);
  const taskMapDiff = Number(r?.task_map_diff ?? 0);
  const falseSafeCandidates = Number(r?.false_safe_candidates ?? 0);
  const invariantTotal = autoVerifyRisk + orgScope + unknownClass + taskMapDiff;

  // ── Confidence band 분석 (세분화) ──
  const BANDS = [
    { band: "0.995+", lower: 0.995, upper: 1.01 },
    { band: "0.99–0.995", lower: 0.99, upper: 0.995 },
    { band: "0.97–0.99", lower: 0.97, upper: 0.99 },
    { band: "0.95–0.97", lower: 0.95, upper: 0.97 },
    { band: "below threshold", lower: 0, upper: 0.95 },
  ];

  const confRows = (await db.$queryRawUnsafe(
    `SELECT "confidence", "mismatchCategory", "fallbackReason",
            "isReviewCandidate", "verificationByRules", "verificationByAi"
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3
      AND "confidence" IS NOT NULL AND "processingPath" != 'rules'`,
    from, to, query.documentType,
  )) as {
    confidence: number; mismatchCategory: string; fallbackReason: string | null;
    isReviewCandidate: boolean; verificationByRules: string | null; verificationByAi: string | null;
  }[];

  const confidenceBands: ConfidenceBandAnalysis[] = BANDS.map((b) => {
    const inBand = confRows.filter(
      (cr: { confidence: number }) => cr.confidence >= b.lower && cr.confidence < b.upper,
    );
    const cnt = inBand.length;
    const mismatch = inBand.filter((cr: { mismatchCategory: string }) => cr.mismatchCategory !== "NO_DIFF").length;
    const fallback = inBand.filter((cr: { fallbackReason: string | null }) => cr.fallbackReason !== null).length;
    const review = inBand.filter((cr: { isReviewCandidate: boolean }) => cr.isReviewCandidate).length;
    const falseSafe = inBand.filter(
      (cr: { verificationByAi: string | null; verificationByRules: string | null }) =>
        cr.verificationByAi === "AUTO_VERIFIED" && cr.verificationByRules !== null && cr.verificationByRules !== "AUTO_VERIFIED",
    ).length;

    return {
      band: b.band,
      lower: b.lower,
      upper: b.upper,
      processedCount: cnt,
      mismatchRate: cnt > 0 ? mismatch / cnt : 0,
      fallbackRate: cnt > 0 ? fallback / cnt : 0,
      manualReviewCandidateRate: cnt > 0 ? review / cnt : 0,
      criticalFieldConflictRate: 0, // DB에 별도 필드 없을 경우 0
      falseSafeRiskCount: falseSafe,
    };
  });

  // ── Vendor/Template hotspot ──
  const vendorHotspots = (await db.$queryRawUnsafe(
    `SELECT "orgId", COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF')::bigint AS mismatch
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3 AND "processingPath" != 'rules'
    GROUP BY "orgId"
    HAVING COUNT(*) >= 3 AND COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF')::float / COUNT(*) >= 0.3
    ORDER BY mismatch DESC LIMIT 10`,
    from, to, query.documentType,
  )) as { orgId: string; total: bigint; mismatch: bigint }[];

  const suggestedExcludedVendors = vendorHotspots.map((h: { orgId: string }) => h.orgId);

  // ── 6단계 판정 ──
  const reasons: string[] = [];
  let decision: AutoVerifyEligibilityDecision;

  // Priority 1: ROLLBACK_REQUIRED
  if (invariantTotal > 0) {
    decision = "ROLLBACK_REQUIRED";
    if (autoVerifyRisk > 0) reasons.push(`AUTO_VERIFY_RISK: ${autoVerifyRisk}건`);
    if (orgScope > 0) reasons.push(`ORG_SCOPE_BLOCKED: ${orgScope}건`);
    if (unknownClass > 0) reasons.push(`UNKNOWN_CLASSIFICATION: ${unknownClass}건`);
    if (taskMapDiff > 0) reasons.push(`TASK_MAPPING_DIFF: ${taskMapDiff}건`);
  }
  // Priority 2: Volume check
  else if (totalAiInvoked < 100) {
    decision = "HOLD_REVIEW";
    reasons.push(`AI 처리 모수 ${totalAiInvoked}건 < 100건`);
  }
  // Priority 3: False-safe + instability
  else {
    const verDiffRate = totalAiInvoked > 0 ? verDiff / totalAiInvoked : 0;
    const topBand = confidenceBands[0]; // 0.995+
    const secondBand = confidenceBands[1]; // 0.99-0.995
    const topBandSafe = topBand.processedCount >= 5 && topBand.mismatchRate === 0 && topBand.falseSafeRiskCount === 0;
    const secondBandSafe = secondBand.processedCount >= 5 && secondBand.mismatchRate === 0 && secondBand.falseSafeRiskCount === 0;

    if (falseSafeCandidates > 0 && suggestedExcludedVendors.length === 0) {
      // Broad false-safe → NOT_ELIGIBLE
      decision = "NOT_ELIGIBLE";
      reasons.push(`False-safe 후보 ${falseSafeCandidates}건 — 통제 불가`);
    } else if (verDiffRate > 0.05) {
      decision = "NOT_ELIGIBLE";
      reasons.push(`Verification Diff ${(verDiffRate * 100).toFixed(1)}% > 5%`);
    } else if (!topBandSafe && !secondBandSafe) {
      decision = "HOLD_REVIEW";
      reasons.push("Confidence 0.99+ 구간 안정성 부족");
    } else if (suggestedExcludedVendors.length > 0 && vendorHotspots.length > 0) {
      // Vendor 제외로 통제 가능
      if (falseSafeCandidates > 0) {
        decision = "ELIGIBLE_WITH_VENDOR_EXCLUSIONS";
        reasons.push(`Vendor ${suggestedExcludedVendors.length}개 제외 시 통제 가능`);
      } else {
        decision = "ELIGIBLE_WITH_VENDOR_EXCLUSIONS";
        reasons.push(`Vendor hotspot ${vendorHotspots.length}개 — 제외 후 opt-in 가능`);
      }
    } else if (topBandSafe && !secondBandSafe) {
      decision = "ELIGIBLE_RESTRICTED";
      reasons.push("0.995+ 구간만 안전 — 매우 제한적 opt-in");
    } else if (topBandSafe && secondBandSafe) {
      decision = "ELIGIBLE_RESTRICTED";
      reasons.push("0.99+ 구간 안정 — 제한적 opt-in 가능");
    } else {
      decision = "HOLD_REVIEW";
      reasons.push("추가 관찰 필요");
    }
  }

  // ── 정책안 ──
  let suggestedMinConfidence: number | null = null;
  let suggestedPolicy: AutoVerifyPolicy | null = null;

  if (decision === "ELIGIBLE_RESTRICTED" || decision === "ELIGIBLE_WITH_VENDOR_EXCLUSIONS" || decision === "ELIGIBLE_WITH_TEMPLATE_EXCLUSIONS") {
    // 안전한 최저 confidence 경계 찾기
    for (const b of confidenceBands) {
      if (b.processedCount >= 5 && b.mismatchRate === 0 && b.falseSafeRiskCount === 0) {
        suggestedMinConfidence = b.lower;
      } else {
        break;
      }
    }
    if (suggestedMinConfidence === null) suggestedMinConfidence = 0.995;

    suggestedPolicy = {
      minConfidence: suggestedMinConfidence,
      onlyIfSchemaValid: true,
      onlyIfNoCriticalFieldConflict: true,
      requireNoClassificationAmbiguity: true,
      requireNoFallbackReason: true,
      requireStableTemplateHistory: true,
      maxRecentAnomalyRate: 0.05,
      rollbackOnFirstFalseSafe: true,
      excludedTemplates: [],
      excludedVendors: suggestedExcludedVendors,
    };
  }

  return {
    documentType: query.documentType,
    decision,
    evaluationPeriod: { from: from.toISOString(), to: to.toISOString() },
    totalAiInvoked,
    invariantViolations: {
      autoVerifyRisk,
      orgScopeBlocked: orgScope,
      unknownClassification: unknownClass,
      taskMappingDiff: taskMapDiff,
      total: invariantTotal,
    },
    verificationDiffCount: verDiff,
    verificationDiffRate: totalAiInvoked > 0 ? verDiff / totalAiInvoked : 0,
    falseSafeCandidateCount: falseSafeCandidates,
    falseSafeConfirmedCount: 0, // 별도 confirmed 필드 필요
    confidenceBands,
    suggestedExcludedVendors,
    suggestedExcludedTemplates: [],
    vendorHotspotCount: vendorHotspots.length,
    templateHotspotCount: 0,
    suggestedMinConfidence,
    eligibilityReasons: reasons,
    suggestedPolicy,
  };
}

// ── 3. False-Safe Detector ──

export interface FalseSafePattern {
  type: string;
  description: string;
  count: number;
  severity: "HIGH" | "MEDIUM";
  samples: string[];
}

export async function detectFalseSafePatterns(
  documentType: string,
  from?: Date,
  to?: Date,
): Promise<FalseSafePattern[]> {
  const startDate = from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const endDate = to ?? new Date();
  const patterns: FalseSafePattern[] = [];

  // Pattern 1: AI=AUTO_VERIFIED but Rules=REVIEW_NEEDED/MISMATCH
  const p1Rows = (await db.$queryRawUnsafe(
    `SELECT "requestId", "confidence", "orgId"
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3
      AND "verificationByAi" = 'AUTO_VERIFIED'
      AND "verificationByRules" IS NOT NULL
      AND "verificationByRules" != 'AUTO_VERIFIED'
      AND "processingPath" != 'rules'`,
    startDate, endDate, documentType,
  )) as { requestId: string; confidence: number; orgId: string }[];

  if (p1Rows.length > 0) {
    patterns.push({
      type: "AI_AUTO_VS_RULES_MANUAL",
      description: "AI는 자동 승인 가능으로 판단했지만 Rules는 수동 리뷰 필요",
      count: p1Rows.length,
      severity: "HIGH",
      samples: p1Rows.slice(0, 5).map((r: { requestId: string }) => r.requestId),
    });
  }

  // Pattern 2: High confidence + mismatch
  const p2Rows = (await db.$queryRawUnsafe(
    `SELECT "requestId", "confidence", "mismatchCategory"
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3
      AND "confidence" >= 0.95
      AND "mismatchCategory" NOT IN ('NO_DIFF', 'LOW_CONFIDENCE_FALLBACK')
      AND "processingPath" != 'rules'`,
    startDate, endDate, documentType,
  )) as { requestId: string; confidence: number; mismatchCategory: string }[];

  if (p2Rows.length > 0) {
    patterns.push({
      type: "HIGH_CONFIDENCE_MISMATCH",
      description: "Confidence 0.95+인데 Rules와 불일치",
      count: p2Rows.length,
      severity: "HIGH",
      samples: p2Rows.slice(0, 5).map((r: { requestId: string }) => r.requestId),
    });
  }

  // Pattern 3: Repeated vendor classification drift
  const p3Rows = (await db.$queryRawUnsafe(
    `SELECT "orgId", COUNT(*)::bigint AS drift_count
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3
      AND "mismatchCategory" = 'DOC_TYPE_DIFF'
      AND "processingPath" != 'rules'
    GROUP BY "orgId"
    HAVING COUNT(*) >= 2
    ORDER BY drift_count DESC LIMIT 5`,
    startDate, endDate, documentType,
  )) as { orgId: string; drift_count: bigint }[];

  if (p3Rows.length > 0) {
    patterns.push({
      type: "REPEATED_VENDOR_DRIFT",
      description: "특정 벤더에서 반복적인 분류 drift 발생",
      count: p3Rows.reduce((s, r: { drift_count: bigint }) => s + Number(r.drift_count), 0),
      severity: "MEDIUM",
      samples: p3Rows.map((r: { orgId: string }) => r.orgId),
    });
  }

  return patterns;
}
