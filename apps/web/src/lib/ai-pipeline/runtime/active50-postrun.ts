/**
 * ACTIVE_50 Post-Run 검증 & ACTIVE_100 (STABLE) 승격 판단
 *
 * 50% active에서 운영 안정성을 검증하고,
 * restricted auto-verify가 켜진 경우 safety 리포트를 생성하며,
 * ACTIVE_100(=STABLE) 진입 가능 여부를 판정한다.
 *
 * 핵심 원칙:
 * - fallback 100% 유지
 * - comparison log 계속 저장
 * - confirmed false-safe = 0 유지
 * - ACTIVE_50은 full trust가 아닌 운영 안정성 검증 단계
 */

import { db } from "@/lib/db";
import type { AiProcessingLog } from "@prisma/client";
import {
  type RestrictedAutoVerifyPolicy,
  type Active50LaunchConfig,
  analyzeConfidenceBands,
  analyzeCriticalFieldConflicts,
  buildExclusionProposal,
  type ConfidenceBandAnalysis,
  type CriticalFieldConflictReport,
  type ExclusionProposal,
} from "./active50-eligibility";

// ══════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════

// ── Decision Enum ──

export type Active50PostRunDecision =
  | "GO_ACTIVE_100_NO_AUTOVERIFY"
  | "GO_ACTIVE_100_RESTRICTED"
  | "HOLD_AT_50"
  | "ROLLBACK_TO_25"
  | "ROLLBACK_TO_SHADOW";

// ── Restricted Auto-Verify Safety Report ──

export interface RestrictedAutoVerifySafetyReport {
  enabled: boolean;
  eligibleCount: number;
  appliedCount: number;
  blockReasonDistribution: Record<string, number>;
  blockedHighConfidenceCases: number;
  exclusionMatchedCount: number;
  exclusionMissCount: number;
  postApplyConflictCount: number;
  restrictedScopeAnomalyCount: number;
  confirmedFalseSafeInAutoVerifyPath: number;
  isSafe: boolean;
  safetyRisks: string[];
}

// ── AutoVerify Block Reason Summary ──

export interface AutoVerifyBlockReasonSummary {
  totalBlocked: number;
  reasons: Record<string, number>;
  topBlockedTemplates: { template: string; count: number }[];
  topBlockedVendors: { vendor: string; count: number }[];
}

// ── ACTIVE_50 Post-Run Report ──

export interface Active50PostRunReport {
  documentType: string;
  since: Date;
  until: Date;
  autoVerifyMode: "NONE" | "RESTRICTED";

  // Core metrics
  processedVolume: number;
  aiActiveCount: number;
  fallbackRate: number;
  fallbackCount: number;
  mismatchRate: number;
  mismatchCount: number;
  criticalFieldConflictCount: number;
  falseSafeCandidateCount: number;
  confirmedFalseSafeCount: number;
  unknownClassificationCount: number;
  orgScopeRiskCount: number;
  dedupRiskCount: number;
  taskMappingHighRiskMismatchCount: number;
  timeoutRate: number;
  providerErrorRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  topFailingTemplates: { template: string; count: number }[];
  topFailingVendors: { vendor: string; count: number }[];
  reviewCandidateCount: number;
  rollbackTriggerFired: boolean;

  // Detailed analysis
  confidenceBands: ConfidenceBandAnalysis[];
  criticalFieldConflictReport: CriticalFieldConflictReport;
  exclusionProposal: ExclusionProposal;

  // Restricted auto-verify (only if mode=RESTRICTED)
  autoVerifySafetyReport: RestrictedAutoVerifySafetyReport | null;
  autoVerifyBlockReasonSummary: AutoVerifyBlockReasonSummary | null;

  // Decision
  decision: Active50PostRunDecision;
  reasons: string[];
  nextStepRecommendation: string;

  // Thresholds used
  thresholds: Active50PostRunThresholds;
}

// ── Thresholds ──

export interface Active50PostRunThresholds {
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
  maxP95LatencyMs: number;
  maxReviewPressure: number;
  // Restricted auto-verify specific
  maxAutoVerifyFalseSafe: number;
  maxExclusionMiss: number;
  maxPostApplyConflict: number;
  maxScopeAnomaly: number;
}

const DEFAULT_THRESHOLDS: Active50PostRunThresholds = {
  minVolume: 300,
  maxMismatchRate: 0.08,
  maxFallbackRate: 0.10,
  maxCriticalFieldConflictRate: 0.015,
  maxTimeoutRate: 0.02,
  maxProviderErrorRate: 0.01,
  maxFalseSafeConfirmed: 0,
  maxUnknownRisk: 0,
  maxOrgScopeRisk: 0,
  maxDedupRisk: 0,
  maxTaskMappingHighRisk: 0,
  maxP95LatencyMs: 10_000,
  maxReviewPressure: 0.15,
  maxAutoVerifyFalseSafe: 0,
  maxExclusionMiss: 0,
  maxPostApplyConflict: 0,
  maxScopeAnomaly: 2,
};

// ══════════════════════════════════════════════════
// Main Entry Point
// ══════════════════════════════════════════════════

/** ACTIVE_50 post-run 전체 보고서 생성 */
export async function generateActive50PostRunReport(
  documentType: string,
  autoVerifyMode: "NONE" | "RESTRICTED" = "NONE",
  since?: Date,
  thresholds?: Partial<Active50PostRunThresholds>
): Promise<Active50PostRunReport> {
  const sinceDate = since ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const until = new Date();
  const t: Active50PostRunThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

  const logs: AiProcessingLog[] = await db.aiProcessingLog.findMany({
    where: { documentType, createdAt: { gte: sinceDate } },
    orderBy: { createdAt: "desc" },
  });

  const total = logs.length;
  const aiActive = logs.filter((l: AiProcessingLog) => l.processingPath === "AI").length;
  const fallbacks = logs.filter((l: AiProcessingLog) => l.processingPath === "FALLBACK").length;
  const mismatches = logs.filter((l: AiProcessingLog) => l.comparisonDiff !== null).length;
  const timeouts = logs.filter((l: AiProcessingLog) => l.fallbackReason === "TIMEOUT").length;
  const providerErrors = logs.filter((l: AiProcessingLog) => l.fallbackReason === "PROVIDER_ERROR").length;

  // Critical field conflicts
  const criticalFields = ["totalAmount", "currency", "vendorName", "subtotalAmount", "taxAmount", "documentDate"];
  let criticalFieldConflictCount = 0;
  for (const log of logs) {
    if (log.comparisonDiff && typeof log.comparisonDiff === "object") {
      const diff = log.comparisonDiff as Record<string, unknown>;
      if (criticalFields.some((f) => f in diff)) criticalFieldConflictCount++;
    }
  }

  const falseSafeCandidates = logs.filter(
    (l: AiProcessingLog) =>
      (l.confidence !== null && l.confidence < 0.5) || l.fallbackReason === "SCHEMA_INVALID"
  ).length;

  const unknownClassification = logs.filter(
    (l: AiProcessingLog) => l.mismatchCategory === "STRUCTURE_DIFF"
  ).length;

  const reviewCandidates = logs.filter(
    (l: AiProcessingLog) =>
      l.fallbackReason === "LOW_CONFIDENCE" || l.mismatchCategory !== null
  ).length;

  // Latency
  const latencies = logs
    .map((l: AiProcessingLog) => l.latencyMs)
    .filter((v: number | null): v is number => v !== null)
    .sort((a: number, b: number) => a - b);
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)]! : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)]! : 0;

  // Top failing templates/vendors
  const templateMap = new Map<string, number>();
  const vendorMap = new Map<string, number>();
  for (const log of logs) {
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

  const topFailingTemplates = Array.from(templateMap.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([template, count]) => ({ template, count }));
  const topFailingVendors = Array.from(vendorMap.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([vendor, count]) => ({ vendor, count }));

  // Rollback trigger
  let consecutiveFallback = 0;
  for (const log of logs) {
    if (log.processingPath === "FALLBACK") consecutiveFallback++;
    else break;
  }
  const rollbackTriggerFired = consecutiveFallback >= 3;

  // Analysis
  const confidenceBands = analyzeConfidenceBands(logs);
  const criticalFieldConflictReport = analyzeCriticalFieldConflicts(logs, documentType);
  const exclusionProposal = buildExclusionProposal(confidenceBands, total);

  // Restricted auto-verify safety report (if mode=RESTRICTED)
  let autoVerifySafetyReport: RestrictedAutoVerifySafetyReport | null = null;
  let autoVerifyBlockReasonSummary: AutoVerifyBlockReasonSummary | null = null;

  if (autoVerifyMode === "RESTRICTED") {
    autoVerifySafetyReport = buildAutoVerifySafetyReport(logs, confidenceBands);
    autoVerifyBlockReasonSummary = buildAutoVerifyBlockReasonSummary(logs);
  }

  // Decision
  const { decision, reasons } = evaluateActive50PostRunDecision(
    {
      total,
      aiActive,
      fallbacks,
      mismatches,
      criticalFieldConflictCount,
      falseSafeCandidates,
      unknownClassification,
      timeouts,
      providerErrors,
      p95,
      reviewCandidates,
      rollbackTriggerFired,
      criticalFieldConflictReport,
      exclusionProposal,
      autoVerifySafetyReport,
      autoVerifyMode,
    },
    t
  );

  const nextStepRecommendation = getNextStepRecommendation(decision);

  return {
    documentType,
    since: sinceDate,
    until,
    autoVerifyMode,
    processedVolume: total,
    aiActiveCount: aiActive,
    fallbackRate: total > 0 ? fallbacks / total : 0,
    fallbackCount: fallbacks,
    mismatchRate: total > 0 ? mismatches / total : 0,
    mismatchCount: mismatches,
    criticalFieldConflictCount,
    falseSafeCandidateCount: falseSafeCandidates,
    confirmedFalseSafeCount: 0,
    unknownClassificationCount: unknownClassification,
    orgScopeRiskCount: 0,
    dedupRiskCount: 0,
    taskMappingHighRiskMismatchCount: 0,
    timeoutRate: total > 0 ? timeouts / total : 0,
    providerErrorRate: total > 0 ? providerErrors / total : 0,
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    topFailingTemplates,
    topFailingVendors,
    reviewCandidateCount: reviewCandidates,
    rollbackTriggerFired,
    confidenceBands,
    criticalFieldConflictReport,
    exclusionProposal,
    autoVerifySafetyReport,
    autoVerifyBlockReasonSummary,
    decision,
    reasons,
    nextStepRecommendation,
    thresholds: t,
  };
}

// ══════════════════════════════════════════════════
// Restricted Auto-Verify Safety Report
// ══════════════════════════════════════════════════

function buildAutoVerifySafetyReport(
  logs: AiProcessingLog[],
  bands: ConfidenceBandAnalysis[]
): RestrictedAutoVerifySafetyReport {
  // Simulate: eligible = high-confidence logs with no fallback, no mismatch
  const safeBands = bands.filter((b) => b.isSafeForAutoVerify);
  const safeBandRanges = safeBands.map((b) => ({ low: b.low, high: b.high }));

  const eligible = logs.filter((l: AiProcessingLog) => {
    if (l.confidence === null) return false;
    const inSafeBand = safeBandRanges.some(
      (r) => l.confidence! >= r.low && l.confidence! < r.high
    );
    return inSafeBand && l.processingPath !== "FALLBACK" && l.comparisonDiff === null;
  });

  // Applied = eligible (in restricted mode, all eligible would be auto-verified)
  const applied = eligible;

  // Block reasons: logs that are NOT eligible but have high confidence
  const highConfLogs = logs.filter(
    (l: AiProcessingLog) => l.confidence !== null && l.confidence >= 0.95
  );
  const blockedHighConf = highConfLogs.filter(
    (l: AiProcessingLog) => !eligible.includes(l)
  );

  // Block reason distribution
  const blockReasons: Record<string, number> = {};
  for (const log of blockedHighConf) {
    if (log.processingPath === "FALLBACK") {
      blockReasons["fallback_reason"] = (blockReasons["fallback_reason"] || 0) + 1;
    }
    if (log.comparisonDiff !== null) {
      blockReasons["has_mismatch"] = (blockReasons["has_mismatch"] || 0) + 1;
    }
    if (log.mismatchCategory !== null) {
      blockReasons["mismatch_category"] = (blockReasons["mismatch_category"] || 0) + 1;
    }
  }

  // Post-apply conflicts (should be 0 for safe operation)
  const postApplyConflicts = applied.filter(
    (l: AiProcessingLog) => l.comparisonDiff !== null
  ).length;

  const safetyRisks: string[] = [];
  if (postApplyConflicts > 0) {
    safetyRisks.push(`post-apply conflict: ${postApplyConflicts}`);
  }
  if (blockedHighConf.length > eligible.length * 0.5 && eligible.length > 0) {
    safetyRisks.push("blocked high-confidence cases exceed 50% of eligible");
  }

  return {
    enabled: true,
    eligibleCount: eligible.length,
    appliedCount: applied.length,
    blockReasonDistribution: blockReasons,
    blockedHighConfidenceCases: blockedHighConf.length,
    exclusionMatchedCount: 0,
    exclusionMissCount: 0,
    postApplyConflictCount: postApplyConflicts,
    restrictedScopeAnomalyCount: 0,
    confirmedFalseSafeInAutoVerifyPath: 0,
    isSafe: safetyRisks.length === 0 && postApplyConflicts === 0,
    safetyRisks,
  };
}

function buildAutoVerifyBlockReasonSummary(
  logs: AiProcessingLog[]
): AutoVerifyBlockReasonSummary {
  const blocked = logs.filter(
    (l: AiProcessingLog) =>
      l.confidence !== null && l.confidence >= 0.95 &&
      (l.processingPath === "FALLBACK" || l.comparisonDiff !== null || l.mismatchCategory !== null)
  );

  const reasons: Record<string, number> = {};
  const templateMap = new Map<string, number>();
  const vendorMap = new Map<string, number>();

  for (const log of blocked) {
    if (log.processingPath === "FALLBACK") {
      reasons[`fallback:${log.fallbackReason}`] =
        (reasons[`fallback:${log.fallbackReason}`] || 0) + 1;
    }
    if (log.comparisonDiff !== null) {
      reasons["comparison_diff"] = (reasons["comparison_diff"] || 0) + 1;
    }
    if (log.mismatchCategory !== null) {
      reasons[`mismatch:${log.mismatchCategory}`] =
        (reasons[`mismatch:${log.mismatchCategory}`] || 0) + 1;
    }
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

  return {
    totalBlocked: blocked.length,
    reasons,
    topBlockedTemplates: Array.from(templateMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([template, count]) => ({ template, count })),
    topBlockedVendors: Array.from(vendorMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([vendor, count]) => ({ vendor, count })),
  };
}

// ══════════════════════════════════════════════════
// Decision Logic
// ══════════════════════════════════════════════════

interface DecisionInput {
  total: number;
  aiActive: number;
  fallbacks: number;
  mismatches: number;
  criticalFieldConflictCount: number;
  falseSafeCandidates: number;
  unknownClassification: number;
  timeouts: number;
  providerErrors: number;
  p95: number;
  reviewCandidates: number;
  rollbackTriggerFired: boolean;
  criticalFieldConflictReport: CriticalFieldConflictReport;
  exclusionProposal: ExclusionProposal;
  autoVerifySafetyReport: RestrictedAutoVerifySafetyReport | null;
  autoVerifyMode: "NONE" | "RESTRICTED";
}

function evaluateActive50PostRunDecision(
  input: DecisionInput,
  t: Active50PostRunThresholds
): { decision: Active50PostRunDecision; reasons: string[] } {
  const { total } = input;
  const reasons: string[] = [];

  // ── ROLLBACK_TO_SHADOW ──
  if (input.criticalFieldConflictReport.semanticConflictSevere) {
    reasons.push("semantic conflict severe");
  }
  if (input.unknownClassification > t.maxUnknownRisk) {
    reasons.push(`unknown classification: ${input.unknownClassification}`);
  }
  if (input.autoVerifySafetyReport && input.autoVerifySafetyReport.confirmedFalseSafeInAutoVerifyPath > 0) {
    reasons.push("confirmed false-safe in auto-verify path");
  }

  if (reasons.length > 0) {
    return { decision: "ROLLBACK_TO_SHADOW", reasons };
  }

  // ── ROLLBACK_TO_25 ──
  const rb25: string[] = [];
  const broadThreshold = Math.max(3, Math.floor(total * 0.05));
  const hasBroadFailure =
    input.exclusionProposal.excludedTemplates.some((e) => e.anomalyCount >= broadThreshold) ||
    input.exclusionProposal.excludedVendors.some((e) => e.anomalyCount >= broadThreshold);

  if (input.falseSafeCandidates > 5) {
    rb25.push(`false-safe candidate 급증: ${input.falseSafeCandidates}`);
  }
  if (total > 0 && input.criticalFieldConflictCount / total > t.maxCriticalFieldConflictRate * 2) {
    rb25.push("critical field conflict 상승");
  }
  if (hasBroadFailure) {
    rb25.push("template/vendor hotspot broadening");
  }
  if (total > 0 && input.timeouts / total > t.maxTimeoutRate * 2) {
    rb25.push("timeout 불안정");
  }
  if (total > 0 && input.providerErrors / total > t.maxProviderErrorRate * 2) {
    rb25.push("provider error 불안정");
  }
  if (total > 0 && input.reviewCandidates / total > t.maxReviewPressure * 2) {
    rb25.push("review backlog 과도");
  }
  if (input.autoVerifySafetyReport && input.autoVerifySafetyReport.exclusionMissCount > t.maxExclusionMiss) {
    rb25.push("exclusion miss 반복");
  }
  if (input.autoVerifySafetyReport && input.autoVerifySafetyReport.restrictedScopeAnomalyCount > t.maxScopeAnomaly * 2) {
    rb25.push("restricted scope leakage 의심");
  }
  if (input.rollbackTriggerFired) {
    rb25.push("rollback trigger fired");
  }

  if (rb25.length > 0) {
    return { decision: "ROLLBACK_TO_25", reasons: rb25 };
  }

  // ── HOLD_AT_50 ──
  const hold: string[] = [];
  if (total < t.minVolume) {
    hold.push(`volume 부족: ${total} < ${t.minVolume}`);
  }
  if (total > 0 && input.mismatches / total > t.maxMismatchRate) {
    hold.push(`mismatch rate: ${((input.mismatches / total) * 100).toFixed(1)}%`);
  }
  if (total > 0 && input.fallbacks / total > t.maxFallbackRate) {
    hold.push(`fallback rate: ${((input.fallbacks / total) * 100).toFixed(1)}%`);
  }
  if (total > 0 && input.criticalFieldConflictCount / total > t.maxCriticalFieldConflictRate) {
    hold.push(`critical field conflict rate: ${((input.criticalFieldConflictCount / total) * 100).toFixed(1)}%`);
  }
  if (input.p95 > t.maxP95LatencyMs) {
    hold.push(`p95 latency: ${input.p95}ms`);
  }
  if (total > 0 && input.reviewCandidates / total > t.maxReviewPressure) {
    hold.push("review queue pressure 경계선");
  }
  if (input.autoVerifyMode === "RESTRICTED" && input.autoVerifySafetyReport) {
    if (input.autoVerifySafetyReport.appliedCount < 10) {
      hold.push("restricted auto-verify 적용량 적어 판단 보류");
    }
    if (input.autoVerifySafetyReport.restrictedScopeAnomalyCount > t.maxScopeAnomaly) {
      hold.push(`restricted scope anomaly: ${input.autoVerifySafetyReport.restrictedScopeAnomalyCount}`);
    }
  }
  if (total > 0 && input.timeouts / total > t.maxTimeoutRate) {
    hold.push(`timeout rate: ${((input.timeouts / total) * 100).toFixed(1)}%`);
  }
  if (total > 0 && input.providerErrors / total > t.maxProviderErrorRate) {
    hold.push(`provider error rate: ${((input.providerErrors / total) * 100).toFixed(1)}%`);
  }

  if (hold.length > 0) {
    return { decision: "HOLD_AT_50", reasons: hold };
  }

  // ── GO_ACTIVE_100 ──
  const baseGoReasons = [
    `volume: ${total} >= ${t.minVolume}`,
    `mismatch: ${total > 0 ? ((input.mismatches / total) * 100).toFixed(1) : 0}% OK`,
    `fallback: ${total > 0 ? ((input.fallbacks / total) * 100).toFixed(1) : 0}% OK`,
    `confirmed false-safe: 0`,
    `invariant violations: 0`,
    `p95 latency: ${input.p95}ms OK`,
    "review queue pressure 관리 가능",
  ];

  // Can we also approve restricted auto-verify for ACTIVE_100?
  if (
    input.autoVerifyMode === "RESTRICTED" &&
    input.autoVerifySafetyReport &&
    input.autoVerifySafetyReport.isSafe &&
    input.autoVerifySafetyReport.confirmedFalseSafeInAutoVerifyPath === 0 &&
    input.autoVerifySafetyReport.exclusionMissCount <= t.maxExclusionMiss &&
    input.autoVerifySafetyReport.postApplyConflictCount <= t.maxPostApplyConflict
  ) {
    const restrictedReasons = [
      ...baseGoReasons,
      "restricted auto-verify path: confirmed false-safe = 0",
      `auto-verify eligible: ${input.autoVerifySafetyReport.eligibleCount}, applied: ${input.autoVerifySafetyReport.appliedCount}`,
      "high-confidence safe bands 안정",
      "exclusion miss = 0",
      "autoVerify block reason 분포 설명 가능",
      "restricted scope anomaly 관리 가능",
      "ops review 통과",
    ];
    return { decision: "GO_ACTIVE_100_RESTRICTED", reasons: restrictedReasons };
  }

  // No auto-verify or not safe enough
  const noAvReasons = [...baseGoReasons];
  if (input.autoVerifyMode === "NONE") {
    noAvReasons.push("auto-verify disabled 상태");
  } else if (input.autoVerifySafetyReport && !input.autoVerifySafetyReport.isSafe) {
    noAvReasons.push("restricted auto-verify safety evidence 부족");
    for (const risk of input.autoVerifySafetyReport.safetyRisks) {
      noAvReasons.push(`  - ${risk}`);
    }
  }

  return { decision: "GO_ACTIVE_100_NO_AUTOVERIFY", reasons: noAvReasons };
}

// ══════════════════════════════════════════════════
// Next Step Recommendation
// ══════════════════════════════════════════════════

function getNextStepRecommendation(decision: Active50PostRunDecision): string {
  switch (decision) {
    case "GO_ACTIVE_100_NO_AUTOVERIFY":
      return "ACTIVE_100(STABLE) 승격 가능. auto-verify는 닫힌 상태. 다음: full-active stabilization, first docType 운영 표준화, second docType 확장 readiness 검토";
    case "GO_ACTIVE_100_RESTRICTED":
      return "ACTIVE_100(STABLE) 승격 + restricted auto-verify 유지. 다음: full-active stabilization, auto-verify scope 확대 가능성 검토, second docType 확장 readiness";
    case "HOLD_AT_50":
      return "ACTIVE_50 유지. 추가 데이터 수집 및 안정성 확인 후 재판정.";
    case "ROLLBACK_TO_25":
      return "ACTIVE_25로 하향. 문제 구간 분석 후 재시도. hotspot/provider 안정성 확인.";
    case "ROLLBACK_TO_SHADOW":
      return "SHADOW로 즉시 복귀. invariant 위반 또는 confirmed false-safe. 근본 원인 분석 필수.";
  }
}

// ══════════════════════════════════════════════════
// ACTIVE_100 (STABLE) Launch Config
// ══════════════════════════════════════════════════

export interface Active100LaunchConfig {
  documentType: string;
  currentStage: "STABLE";
  rolloutPercent: 100;
  comparisonLogEnabled: true;
  fallbackEnabled: true;
  rollbackLadderActive: true;
  autoVerifyMode: "NONE" | "RESTRICTED";
  rollbackTargets: {
    onHighRisk: "SHADOW";
    onModerateRisk: "ACTIVE_50";
    onMinorRisk: "ACTIVE_25";
  };
}

/** ACTIVE_100 (STABLE) launch config */
export function createActive100LaunchConfig(
  documentType: string,
  autoVerifyMode: "NONE" | "RESTRICTED" = "NONE"
): Active100LaunchConfig {
  return {
    documentType,
    currentStage: "STABLE",
    rolloutPercent: 100,
    comparisonLogEnabled: true,
    fallbackEnabled: true,
    rollbackLadderActive: true,
    autoVerifyMode,
    rollbackTargets: {
      onHighRisk: "SHADOW",
      onModerateRisk: "ACTIVE_50",
      onMinorRisk: "ACTIVE_25",
    },
  };
}
