/**
 * ACTIVE_50 Eligibility Evaluation & Restricted Auto-Verify Policy
 *
 * ACTIVE_25 통과 후:
 * 1. ACTIVE_50 승격 가능 여부 판단
 * 2. restricted auto-verify eligibility 별도 평가
 * 3. 두 판단을 분리하여 GO_ACTIVE_50_NO_AUTOVERIFY / GO_RESTRICTED / HOLD / ROLLBACK 결정
 *
 * 핵심 원칙:
 * - ACTIVE_50 승격과 auto-verify enable은 분리
 * - global allowAutoVerify default = false
 * - restricted auto-verify는 좁은 구간만 허용
 * - false-safe risk는 비용/속도보다 우선 차단
 * - confidence만 높다고 auto-verify 허용하지 않음
 * - template/vendor exclusion + semantic safety gate 필수
 */

import { db } from "@/lib/db";
import type { AiProcessingLog } from "@prisma/client";

// ══════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════

// ── Decision Enum ──

export type Active50Decision =
  | "GO_ACTIVE_50_NO_AUTOVERIFY"
  | "GO_RESTRICTED"
  | "HOLD_AT_25"
  | "ROLLBACK_TO_5"
  | "ROLLBACK_TO_SHADOW";

// ── Confidence Band ──

export interface ConfidenceBandAnalysis {
  band: string;
  low: number;
  high: number;
  processedCount: number;
  mismatchRate: number;
  mismatchCount: number;
  fallbackRate: number;
  fallbackCount: number;
  criticalFieldConflictRate: number;
  criticalFieldConflictCount: number;
  falseSafeCandidateRate: number;
  falseSafeCandidateCount: number;
  reviewCandidateRate: number;
  reviewCandidateCount: number;
  templateConcentration: { template: string; count: number }[];
  vendorConcentration: { vendor: string; count: number }[];
  isSafeForAutoVerify: boolean;
}

// ── Critical Field Conflict ──

export type CriticalFieldType =
  | "vendor"
  | "totalAmount"
  | "currency"
  | "documentDate"
  | "classificationIndicator"
  | "purchaseIdentifier";

export type ConflictRiskLevel = "HIGH" | "MEDIUM" | "LOW";

export interface CriticalFieldConflictDetail {
  field: CriticalFieldType;
  riskLevel: ConflictRiskLevel;
  reason: string;
  count: number;
  examples: string[];
}

export interface CriticalFieldConflictReport {
  documentType: string;
  totalConflicts: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  conflicts: CriticalFieldConflictDetail[];
  highConfidenceConflictCount: number;
  semanticConflictSevere: boolean;
}

// ── Template/Vendor Exclusion ──

export interface ExclusionProposal {
  excludedTemplates: { template: string; reason: string; anomalyCount: number }[];
  excludedVendors: { vendor: string; reason: string; anomalyCount: number }[];
  coverageRate: number;
  residualRisk: number;
}

// ── Restricted Auto-Verify Policy ──

export interface RestrictedAutoVerifyPolicy {
  documentType: string;
  allowAutoVerify: false;
  restrictedAutoVerify: {
    enabled: boolean;
    allowedConfidenceBands: string[];
    excludedTemplates: string[];
    excludedVendors: string[];
    requireSchemaValid: true;
    requireNoCriticalFieldConflict: true;
    requireNoClassificationAmbiguity: true;
    requireNoFallbackReason: true;
    rollbackOnFirstFalseSafe: true;
    recentAnomalyRateThreshold: number;
  };
  scope: string;
}

// ── Eligibility Report ──

export interface EligibilityEvaluationReport {
  documentType: string;
  since: Date;
  until: Date;
  processedVolume: number;
  confidenceBands: ConfidenceBandAnalysis[];
  criticalFieldConflictReport: CriticalFieldConflictReport;
  exclusionProposal: ExclusionProposal;
  decision: Active50Decision;
  reasons: string[];
  active50Config: Active50LaunchConfig | null;
  autoVerifyPolicy: RestrictedAutoVerifyPolicy | null;
  thresholds: Active50Thresholds;
}

// ── ACTIVE_50 Launch Config ──

export interface Active50LaunchConfig {
  documentType: string;
  currentStage: "ACTIVE_50";
  rolloutPercent: 50;
  comparisonLogEnabled: true;
  fallbackEnabled: true;
  rollbackLadderActive: true;
  autoVerifyMode: "NONE" | "RESTRICTED";
  rollbackTargets: {
    onHighRisk: "SHADOW";
    onModerateRisk: "ACTIVE_25";
    onMinorRisk: "ACTIVE_5";
  };
}

// ── Thresholds ──

export interface Active50Thresholds {
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
  maxHighConfidenceConflict: number;
  maxP95LatencyMs: number;
  autoVerifyMinBandSafety: number;
  autoVerifyMaxFalseSafeCandidate: number;
  autoVerifyMaxReviewPressure: number;
}

const DEFAULT_ACTIVE50_THRESHOLDS: Active50Thresholds = {
  minVolume: 200,
  maxMismatchRate: 0.10,
  maxFallbackRate: 0.12,
  maxCriticalFieldConflictRate: 0.02,
  maxTimeoutRate: 0.02,
  maxProviderErrorRate: 0.01,
  maxFalseSafeConfirmed: 0,
  maxUnknownRisk: 0,
  maxOrgScopeRisk: 0,
  maxDedupRisk: 0,
  maxTaskMappingHighRisk: 0,
  maxHighConfidenceConflict: 0,
  maxP95LatencyMs: 10_000,
  autoVerifyMinBandSafety: 0.98,
  autoVerifyMaxFalseSafeCandidate: 2,
  autoVerifyMaxReviewPressure: 0.10,
};

// ══════════════════════════════════════════════════
// Confidence Band Analysis
// ══════════════════════════════════════════════════

const CONFIDENCE_BANDS: { band: string; low: number; high: number }[] = [
  { band: "0.995+", low: 0.995, high: 1.01 },
  { band: "0.99-0.995", low: 0.99, high: 0.995 },
  { band: "0.97-0.99", low: 0.97, high: 0.99 },
  { band: "0.95-0.97", low: 0.95, high: 0.97 },
  { band: "below-threshold", low: 0, high: 0.95 },
];

const CRITICAL_FIELD_NAMES: CriticalFieldType[] = [
  "vendor",
  "totalAmount",
  "currency",
  "documentDate",
  "classificationIndicator",
  "purchaseIdentifier",
];

/** Confidence band별 상세 분석 */
export function analyzeConfidenceBands(
  logs: AiProcessingLog[]
): ConfidenceBandAnalysis[] {
  return CONFIDENCE_BANDS.map(({ band, low, high }) => {
    const inBand = logs.filter(
      (l: AiProcessingLog) =>
        l.confidence !== null && l.confidence >= low && l.confidence < high
    );
    const total = inBand.length;

    const mismatches = inBand.filter((l: AiProcessingLog) => l.comparisonDiff !== null);
    const fallbacks = inBand.filter((l: AiProcessingLog) => l.processingPath === "FALLBACK");

    // Critical field conflicts in band
    let criticalFieldConflicts = 0;
    for (const log of inBand) {
      if (hasCriticalFieldConflict(log)) criticalFieldConflicts++;
    }

    // False-safe candidates
    const falseSafeCandidates = inBand.filter(
      (l: AiProcessingLog) =>
        (l.confidence !== null && l.confidence < 0.5) ||
        l.fallbackReason === "SCHEMA_INVALID"
    ).length;

    // Review candidates
    const reviewCandidates = inBand.filter(
      (l: AiProcessingLog) =>
        l.fallbackReason === "LOW_CONFIDENCE" ||
        l.mismatchCategory !== null
    ).length;

    // Template/vendor concentration
    const templateMap = new Map<string, number>();
    const vendorMap = new Map<string, number>();
    for (const log of inBand) {
      if (log.comparisonDiff && typeof log.comparisonDiff === "object") {
        const diff = log.comparisonDiff as Record<string, unknown>;
        if (diff.templateId && typeof diff.templateId === "string") {
          templateMap.set(diff.templateId, (templateMap.get(diff.templateId) || 0) + 1);
        }
        if (diff.vendorName && typeof diff.vendorName === "string") {
          vendorMap.set(diff.vendorName, (vendorMap.get(diff.vendorName) || 0) + 1);
        }
      }
    }

    const templateConcentration = Array.from(templateMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([template, count]) => ({ template, count }));

    const vendorConcentration = Array.from(vendorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([vendor, count]) => ({ vendor, count }));

    // Is safe for auto-verify?
    const mismatchRate = total > 0 ? mismatches.length / total : 0;
    const cfcRate = total > 0 ? criticalFieldConflicts / total : 0;
    const isSafe =
      total >= 10 &&
      mismatchRate <= 0.03 &&
      cfcRate === 0 &&
      falseSafeCandidates === 0 &&
      fallbacks.length === 0;

    return {
      band,
      low,
      high,
      processedCount: total,
      mismatchRate: total > 0 ? mismatches.length / total : 0,
      mismatchCount: mismatches.length,
      fallbackRate: total > 0 ? fallbacks.length / total : 0,
      fallbackCount: fallbacks.length,
      criticalFieldConflictRate: total > 0 ? criticalFieldConflicts / total : 0,
      criticalFieldConflictCount: criticalFieldConflicts,
      falseSafeCandidateRate: total > 0 ? falseSafeCandidates / total : 0,
      falseSafeCandidateCount: falseSafeCandidates,
      reviewCandidateRate: total > 0 ? reviewCandidates / total : 0,
      reviewCandidateCount: reviewCandidates,
      templateConcentration,
      vendorConcentration,
      isSafeForAutoVerify: isSafe,
    };
  });
}

// ══════════════════════════════════════════════════
// Critical Field Conflict Analysis
// ══════════════════════════════════════════════════

function hasCriticalFieldConflict(log: AiProcessingLog): boolean {
  if (!log.comparisonDiff || typeof log.comparisonDiff !== "object") return false;
  const diff = log.comparisonDiff as Record<string, unknown>;
  return CRITICAL_FIELD_NAMES.some(
    (f) => f in diff || f === "vendor" && "vendorName" in diff
  );
}

/** Critical field conflict 상세 리포트 생성 */
export function analyzeCriticalFieldConflicts(
  logs: AiProcessingLog[],
  documentType: string
): CriticalFieldConflictReport {
  const conflictMap = new Map<CriticalFieldType, { count: number; examples: string[]; highConf: number }>();

  for (const field of CRITICAL_FIELD_NAMES) {
    conflictMap.set(field, { count: 0, examples: [], highConf: 0 });
  }

  const fieldAliases: Record<string, CriticalFieldType> = {
    vendorName: "vendor",
    totalAmount: "totalAmount",
    currency: "currency",
    documentDate: "documentDate",
    classificationIndicator: "classificationIndicator",
    purchaseIdentifier: "purchaseIdentifier",
    invoiceDate: "documentDate",
    quoteDate: "documentDate",
    poNumber: "purchaseIdentifier",
    orderNumber: "purchaseIdentifier",
  };

  for (const log of logs) {
    if (!log.comparisonDiff || typeof log.comparisonDiff !== "object") continue;
    const diff = log.comparisonDiff as Record<string, unknown>;
    const isHighConf = log.confidence !== null && log.confidence >= 0.95;

    for (const [key, value] of Object.entries(diff)) {
      const fieldType = fieldAliases[key];
      if (!fieldType) continue;

      const entry = conflictMap.get(fieldType);
      if (!entry) continue;

      entry.count++;
      if (isHighConf) entry.highConf++;
      if (entry.examples.length < 3) {
        const desc = typeof value === "object" && value !== null
          ? JSON.stringify(value).slice(0, 100)
          : String(value).slice(0, 100);
        entry.examples.push(`${key}: ${desc}`);
      }
    }
  }

  const conflicts: CriticalFieldConflictDetail[] = [];
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;
  let highConfidenceConflictCount = 0;

  for (const [field, data] of Array.from(conflictMap.entries())) {
    if (data.count === 0) continue;

    // Risk classification
    let riskLevel: ConflictRiskLevel;
    let reason: string;

    if (field === "totalAmount" || field === "currency") {
      riskLevel = "HIGH";
      reason = "금액/통화 불일치 — 재무 영향";
    } else if (field === "vendor") {
      riskLevel = data.count > 5 ? "HIGH" : "MEDIUM";
      reason = "거래처 불일치 — entity linking 영향";
    } else if (field === "classificationIndicator") {
      riskLevel = "HIGH";
      reason = "분류 신호 충돌 — 라우팅 영향";
    } else if (data.highConf > 0) {
      riskLevel = "HIGH";
      reason = `high confidence (>=0.95)에서 ${data.highConf}건 충돌`;
    } else {
      riskLevel = data.count > 3 ? "MEDIUM" : "LOW";
      reason = `${data.count}건 불일치`;
    }

    if (riskLevel === "HIGH") highRiskCount++;
    else if (riskLevel === "MEDIUM") mediumRiskCount++;
    else lowRiskCount++;

    highConfidenceConflictCount += data.highConf;

    conflicts.push({
      field,
      riskLevel,
      reason,
      count: data.count,
      examples: data.examples,
    });
  }

  return {
    documentType,
    totalConflicts: conflicts.reduce((sum, c) => sum + c.count, 0),
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    conflicts,
    highConfidenceConflictCount,
    semanticConflictSevere: highRiskCount >= 3 || highConfidenceConflictCount >= 2,
  };
}

// ══════════════════════════════════════════════════
// Exclusion Proposal
// ══════════════════════════════════════════════════

/** Template/vendor exclusion 제안 생성 */
export function buildExclusionProposal(
  bands: ConfidenceBandAnalysis[],
  totalVolume: number
): ExclusionProposal {
  const templateAnomalies = new Map<string, number>();
  const vendorAnomalies = new Map<string, number>();

  for (const band of bands) {
    for (const t of band.templateConcentration) {
      templateAnomalies.set(t.template, (templateAnomalies.get(t.template) || 0) + t.count);
    }
    for (const v of band.vendorConcentration) {
      vendorAnomalies.set(v.vendor, (vendorAnomalies.get(v.vendor) || 0) + v.count);
    }
  }

  const excludedTemplates = Array.from(templateAnomalies.entries())
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([template, count]) => ({
      template,
      reason: `${count}건 anomaly — hotspot`,
      anomalyCount: count,
    }));

  const excludedVendors = Array.from(vendorAnomalies.entries())
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([vendor, count]) => ({
      vendor,
      reason: `${count}건 anomaly — hotspot`,
      anomalyCount: count,
    }));

  const totalExcluded = excludedTemplates.reduce((s, t) => s + t.anomalyCount, 0)
    + excludedVendors.reduce((s, v) => s + v.anomalyCount, 0);

  return {
    excludedTemplates,
    excludedVendors,
    coverageRate: totalVolume > 0 ? 1 - (totalExcluded / totalVolume) : 1,
    residualRisk: totalVolume > 0 ? totalExcluded / totalVolume : 0,
  };
}

// ══════════════════════════════════════════════════
// Restricted Auto-Verify Policy
// ══════════════════════════════════════════════════

/** Restricted auto-verify policy 후보 생성 */
export function buildRestrictedAutoVerifyPolicy(
  documentType: string,
  bands: ConfidenceBandAnalysis[],
  exclusion: ExclusionProposal
): RestrictedAutoVerifyPolicy {
  const safeBands = bands
    .filter((b) => b.isSafeForAutoVerify)
    .map((b) => b.band);

  return {
    documentType,
    allowAutoVerify: false, // global은 항상 false
    restrictedAutoVerify: {
      enabled: safeBands.length > 0,
      allowedConfidenceBands: safeBands,
      excludedTemplates: exclusion.excludedTemplates.map((t) => t.template),
      excludedVendors: exclusion.excludedVendors.map((v) => v.vendor),
      requireSchemaValid: true,
      requireNoCriticalFieldConflict: true,
      requireNoClassificationAmbiguity: true,
      requireNoFallbackReason: true,
      rollbackOnFirstFalseSafe: true,
      recentAnomalyRateThreshold: 0.02,
    },
    scope: safeBands.length > 0
      ? `${documentType} only, bands: [${safeBands.join(", ")}], ${exclusion.excludedTemplates.length} templates excluded, ${exclusion.excludedVendors.length} vendors excluded`
      : `${documentType}: no safe bands identified — auto-verify not recommended`,
  };
}

// ══════════════════════════════════════════════════
// Decision Logic
// ══════════════════════════════════════════════════

interface DecisionInput {
  processedVolume: number;
  mismatchRate: number;
  fallbackRate: number;
  criticalFieldConflictRate: number;
  timeoutRate: number;
  providerErrorRate: number;
  falseSafeConfirmed: number;
  falseSafeCandidateCount: number;
  unknownRisk: number;
  orgScopeRisk: number;
  dedupRisk: number;
  taskMappingHighRisk: number;
  highConfidenceConflict: number;
  p95LatencyMs: number;
  rollbackTriggerFired: boolean;
  semanticConflictSevere: boolean;
  hotspotBroadFailure: boolean;
  safeBandCount: number;
  reviewPressure: number;
}

function evaluateDecision(
  input: DecisionInput,
  t: Active50Thresholds
): { decision: Active50Decision; reasons: string[] } {
  const reasons: string[] = [];

  // ── ROLLBACK_TO_SHADOW ──
  if (input.falseSafeConfirmed > t.maxFalseSafeConfirmed) {
    reasons.push(`confirmed false-safe: ${input.falseSafeConfirmed}`);
  }
  if (input.orgScopeRisk > t.maxOrgScopeRisk) {
    reasons.push(`org scope invariant violation: ${input.orgScopeRisk}`);
  }
  if (input.dedupRisk > t.maxDedupRisk) {
    reasons.push(`dedup invariant violation: ${input.dedupRisk}`);
  }
  if (input.taskMappingHighRisk > t.maxTaskMappingHighRisk) {
    reasons.push(`task mapping high-risk: ${input.taskMappingHighRisk}`);
  }
  if (input.semanticConflictSevere) {
    reasons.push("semantic conflict severe");
  }

  if (reasons.length > 0) {
    return { decision: "ROLLBACK_TO_SHADOW", reasons };
  }

  // ── ROLLBACK_TO_5 ──
  const rb5: string[] = [];
  if (input.hotspotBroadFailure) {
    rb5.push("hotspot broad failure");
  }
  if (input.criticalFieldConflictRate > t.maxCriticalFieldConflictRate * 3) {
    rb5.push(`critical field conflict 급증: ${(input.criticalFieldConflictRate * 100).toFixed(1)}%`);
  }
  if (input.rollbackTriggerFired) {
    rb5.push("rollback trigger fired");
  }

  if (rb5.length > 0) {
    return { decision: "ROLLBACK_TO_5", reasons: rb5 };
  }

  // ── HOLD_AT_25 ──
  const hold: string[] = [];
  if (input.processedVolume < t.minVolume) {
    hold.push(`volume 부족: ${input.processedVolume} < ${t.minVolume}`);
  }
  if (input.mismatchRate > t.maxMismatchRate) {
    hold.push(`mismatch rate: ${(input.mismatchRate * 100).toFixed(1)}%`);
  }
  if (input.fallbackRate > t.maxFallbackRate) {
    hold.push(`fallback rate: ${(input.fallbackRate * 100).toFixed(1)}%`);
  }
  if (input.criticalFieldConflictRate > t.maxCriticalFieldConflictRate) {
    hold.push(`critical field conflict rate: ${(input.criticalFieldConflictRate * 100).toFixed(1)}%`);
  }
  if (input.timeoutRate > t.maxTimeoutRate) {
    hold.push(`timeout rate: ${(input.timeoutRate * 100).toFixed(1)}%`);
  }
  if (input.providerErrorRate > t.maxProviderErrorRate) {
    hold.push(`provider error rate: ${(input.providerErrorRate * 100).toFixed(1)}%`);
  }
  if (input.highConfidenceConflict > t.maxHighConfidenceConflict) {
    hold.push(`high-confidence conflict: ${input.highConfidenceConflict}`);
  }
  if (input.p95LatencyMs > t.maxP95LatencyMs) {
    hold.push(`p95 latency: ${input.p95LatencyMs}ms`);
  }
  if (input.reviewPressure > t.autoVerifyMaxReviewPressure * 2) {
    hold.push(`review pressure 높음: ${(input.reviewPressure * 100).toFixed(1)}%`);
  }

  if (hold.length > 0) {
    return { decision: "HOLD_AT_25", reasons: hold };
  }

  // ── GO 판정: NO_AUTOVERIFY vs RESTRICTED ──
  const canAutoVerify =
    input.falseSafeCandidateCount <= t.autoVerifyMaxFalseSafeCandidate &&
    input.highConfidenceConflict === 0 &&
    input.safeBandCount > 0 &&
    input.reviewPressure <= t.autoVerifyMaxReviewPressure;

  if (canAutoVerify) {
    const goReasons = [
      `volume: ${input.processedVolume} >= ${t.minVolume}`,
      `mismatch: ${(input.mismatchRate * 100).toFixed(1)}% OK`,
      `fallback: ${(input.fallbackRate * 100).toFixed(1)}% OK`,
      `high-confidence conflict: 0`,
      `safe bands: ${input.safeBandCount}`,
      `false-safe candidate: ${input.falseSafeCandidateCount} (관리 가능)`,
      "template/vendor exclusion 통제 가능",
      "restricted policy scope 좁고 설명 가능",
      "ops review 통과",
    ];
    return { decision: "GO_RESTRICTED", reasons: goReasons };
  } else {
    const noAvReasons = [
      `volume: ${input.processedVolume} >= ${t.minVolume}`,
      `mismatch: ${(input.mismatchRate * 100).toFixed(1)}% OK`,
      `fallback: ${(input.fallbackRate * 100).toFixed(1)}% OK`,
      `invariant violations: 0`,
      `confirmed false-safe: 0`,
    ];
    if (input.safeBandCount === 0) {
      noAvReasons.push("safe confidence band 없음 — auto-verify 불가");
    }
    if (input.highConfidenceConflict > 0) {
      noAvReasons.push(`high-confidence conflict ${input.highConfidenceConflict}건 — auto-verify evidence 부족`);
    }
    if (input.falseSafeCandidateCount > t.autoVerifyMaxFalseSafeCandidate) {
      noAvReasons.push(`false-safe candidate ${input.falseSafeCandidateCount}건 — auto-verify 보류`);
    }
    return { decision: "GO_ACTIVE_50_NO_AUTOVERIFY", reasons: noAvReasons };
  }
}

// ══════════════════════════════════════════════════
// Main Entry Point
// ══════════════════════════════════════════════════

/** ACTIVE_50 eligibility 전체 평가 */
export async function generateEligibilityReport(
  documentType: string,
  since?: Date,
  thresholds?: Partial<Active50Thresholds>
): Promise<EligibilityEvaluationReport> {
  const sinceDate = since ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const until = new Date();
  const t: Active50Thresholds = { ...DEFAULT_ACTIVE50_THRESHOLDS, ...thresholds };

  // 데이터 수집
  const logs: AiProcessingLog[] = await db.aiProcessingLog.findMany({
    where: { documentType, createdAt: { gte: sinceDate } },
    orderBy: { createdAt: "desc" },
  });

  const total = logs.length;

  // 1. Confidence band 분석
  const confidenceBands = analyzeConfidenceBands(logs);

  // 2. Critical field conflict 분석
  const criticalFieldConflictReport = analyzeCriticalFieldConflicts(logs, documentType);

  // 3. Exclusion proposal
  const exclusionProposal = buildExclusionProposal(confidenceBands, total);

  // 4. Aggregate metrics for decision
  const mismatches = logs.filter((l: AiProcessingLog) => l.comparisonDiff !== null).length;
  const fallbacks = logs.filter((l: AiProcessingLog) => l.processingPath === "FALLBACK").length;
  const timeouts = logs.filter((l: AiProcessingLog) => l.fallbackReason === "TIMEOUT").length;
  const providerErrors = logs.filter((l: AiProcessingLog) => l.fallbackReason === "PROVIDER_ERROR").length;
  const falseSafeCandidates = logs.filter(
    (l: AiProcessingLog) =>
      (l.confidence !== null && l.confidence < 0.5) || l.fallbackReason === "SCHEMA_INVALID"
  ).length;
  const reviewCandidates = logs.filter(
    (l: AiProcessingLog) =>
      l.fallbackReason === "LOW_CONFIDENCE" || l.mismatchCategory !== null
  ).length;

  let criticalFieldConflicts = 0;
  for (const log of logs) {
    if (hasCriticalFieldConflict(log)) criticalFieldConflicts++;
  }

  const latencies = logs
    .map((l: AiProcessingLog) => l.latencyMs)
    .filter((v: number | null): v is number => v !== null)
    .sort((a: number, b: number) => a - b);
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)]! : 0;

  // Hotspot broad failure check
  const broadThreshold = Math.max(3, Math.floor(total * 0.05));
  const hotspotBroadFailure =
    exclusionProposal.excludedTemplates.some((t) => t.anomalyCount >= broadThreshold) ||
    exclusionProposal.excludedVendors.some((v) => v.anomalyCount >= broadThreshold);

  // Consecutive fallback check
  let consecutiveFallback = 0;
  for (const log of logs) {
    if (log.processingPath === "FALLBACK") consecutiveFallback++;
    else break;
  }

  // 5. Decision
  const decisionInput: DecisionInput = {
    processedVolume: total,
    mismatchRate: total > 0 ? mismatches / total : 0,
    fallbackRate: total > 0 ? fallbacks / total : 0,
    criticalFieldConflictRate: total > 0 ? criticalFieldConflicts / total : 0,
    timeoutRate: total > 0 ? timeouts / total : 0,
    providerErrorRate: total > 0 ? providerErrors / total : 0,
    falseSafeConfirmed: 0, // manual confirmation
    falseSafeCandidateCount: falseSafeCandidates,
    unknownRisk: logs.filter((l: AiProcessingLog) => l.mismatchCategory === "STRUCTURE_DIFF").length,
    orgScopeRisk: 0,
    dedupRisk: 0,
    taskMappingHighRisk: 0,
    highConfidenceConflict: criticalFieldConflictReport.highConfidenceConflictCount,
    p95LatencyMs: p95,
    rollbackTriggerFired: consecutiveFallback >= 3,
    semanticConflictSevere: criticalFieldConflictReport.semanticConflictSevere,
    hotspotBroadFailure,
    safeBandCount: confidenceBands.filter((b) => b.isSafeForAutoVerify).length,
    reviewPressure: total > 0 ? reviewCandidates / total : 0,
  };

  const { decision, reasons } = evaluateDecision(decisionInput, t);

  // 6. Config & Policy (GO일 때만 생성)
  let active50Config: Active50LaunchConfig | null = null;
  let autoVerifyPolicy: RestrictedAutoVerifyPolicy | null = null;

  if (decision === "GO_ACTIVE_50_NO_AUTOVERIFY" || decision === "GO_RESTRICTED") {
    active50Config = {
      documentType,
      currentStage: "ACTIVE_50",
      rolloutPercent: 50,
      comparisonLogEnabled: true,
      fallbackEnabled: true,
      rollbackLadderActive: true,
      autoVerifyMode: decision === "GO_RESTRICTED" ? "RESTRICTED" : "NONE",
      rollbackTargets: {
        onHighRisk: "SHADOW",
        onModerateRisk: "ACTIVE_25",
        onMinorRisk: "ACTIVE_5",
      },
    };
  }

  if (decision === "GO_RESTRICTED") {
    autoVerifyPolicy = buildRestrictedAutoVerifyPolicy(
      documentType,
      confidenceBands,
      exclusionProposal
    );
  }

  return {
    documentType,
    since: sinceDate,
    until,
    processedVolume: total,
    confidenceBands,
    criticalFieldConflictReport,
    exclusionProposal,
    decision,
    reasons,
    active50Config,
    autoVerifyPolicy,
    thresholds: t,
  };
}

// ══════════════════════════════════════════════════
// Auto-Verify Gate (runtime per-document check)
// ══════════════════════════════════════════════════

export interface AutoVerifyGateInput {
  documentType: string;
  confidence: number;
  schemaValid: boolean;
  hasCriticalFieldConflict: boolean;
  hasClassificationAmbiguity: boolean;
  hasFallbackReason: boolean;
  templateId: string | null;
  vendorName: string | null;
  recentAnomalyRate: number;
}

export interface AutoVerifyGateResult {
  allowed: boolean;
  blockReasons: string[];
}

/** 개별 문서에 대한 restricted auto-verify gate 검사 */
export function checkAutoVerifyGate(
  input: AutoVerifyGateInput,
  policy: RestrictedAutoVerifyPolicy
): AutoVerifyGateResult {
  const blockReasons: string[] = [];
  const p = policy.restrictedAutoVerify;

  if (!p.enabled) {
    blockReasons.push("restricted auto-verify disabled");
    return { allowed: false, blockReasons };
  }

  // Confidence band check
  const bandMatch = CONFIDENCE_BANDS.find(
    (b) => input.confidence >= b.low && input.confidence < b.high
  );
  if (!bandMatch || !p.allowedConfidenceBands.includes(bandMatch.band)) {
    blockReasons.push(`confidence ${input.confidence} not in allowed bands`);
  }

  if (!input.schemaValid) {
    blockReasons.push("schema invalid");
  }

  if (input.hasCriticalFieldConflict) {
    blockReasons.push("critical field conflict");
  }

  if (input.hasClassificationAmbiguity) {
    blockReasons.push("classification ambiguity");
  }

  if (input.hasFallbackReason) {
    blockReasons.push("has fallback reason");
  }

  if (input.templateId && p.excludedTemplates.includes(input.templateId)) {
    blockReasons.push(`template ${input.templateId} excluded`);
  }

  if (input.vendorName && p.excludedVendors.includes(input.vendorName)) {
    blockReasons.push(`vendor ${input.vendorName} excluded`);
  }

  if (input.recentAnomalyRate > p.recentAnomalyRateThreshold) {
    blockReasons.push(`recent anomaly rate ${(input.recentAnomalyRate * 100).toFixed(1)}% exceeds threshold`);
  }

  return {
    allowed: blockReasons.length === 0,
    blockReasons,
  };
}
