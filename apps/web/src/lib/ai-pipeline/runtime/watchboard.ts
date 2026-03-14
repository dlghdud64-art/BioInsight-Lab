/**
 * Watchboard Metrics
 * ACTIVE_5 / ACTIVE_25 / ACTIVE_50 운영 모니터링 메트릭 수집.
 * 운영자가 숫자만 보고 go/hold/rollback 판단 가능하도록 설계.
 */

import { db } from "@/lib/db";
import type { AiProcessingLog } from "@prisma/client";

// ── Watchboard Metrics ──

export interface WatchboardMetrics {
  documentType: string;
  stage: string;
  since: Date;
  until: Date;
  aiActiveCanaryCount: number;
  processedVolume: number;
  mismatchRate: number;
  mismatchCount: number;
  fallbackRate: number;
  fallbackCount: number;
  criticalFieldConflictCount: number;
  falseSafeCandidateCount: number;
  confirmedFalseSafeCount: number;
  unknownClassificationCount: number;
  reviewCandidateCount: number;
  timeoutRate: number;
  timeoutCount: number;
  providerErrorRate: number;
  providerErrorCount: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  topAnomalyTemplates: { template: string; count: number }[];
  topAnomalyVendors: { vendor: string; count: number }[];
  rollbackTriggerFired: boolean;
  orgScopeRiskCount: number;
  dedupRiskCount: number;
  taskMappingHighRiskMismatchCount: number;
  fallbackReasonBreakdown: Record<string, number>;
}

export interface WatchboardTrend {
  documentType: string;
  intervals: WatchboardInterval[];
}

export interface WatchboardInterval {
  since: Date;
  until: Date;
  aiActiveVolume: number;
  fallbackRate: number;
  mismatchRate: number;
  criticalFieldConflictCount: number;
  falseSafeCandidateCount: number;
  providerStability: number; // 1.0 = fully stable
  reviewQueuePressure: number;
  rollbackTriggerState: boolean;
}

// ── Watchboard 생성 ──

/** 특정 stage에서의 watchboard 메트릭 수집 */
export async function collectWatchboardMetrics(
  documentType: string,
  since?: Date
): Promise<WatchboardMetrics> {
  const sinceDate = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const until = new Date();

  const config = await db.canaryConfig.findUnique({ where: { documentType } });
  const stage = config?.stage ?? "UNKNOWN";

  const logs: AiProcessingLog[] = await db.aiProcessingLog.findMany({
    where: { documentType, createdAt: { gte: sinceDate } },
    orderBy: { createdAt: "desc" },
  });

  const total = logs.length;
  const aiActive = logs.filter((l: AiProcessingLog) => l.processingPath === "AI").length;
  const mismatches = logs.filter((l: AiProcessingLog) => l.comparisonDiff !== null).length;
  const fallbacks = logs.filter((l: AiProcessingLog) => l.processingPath === "FALLBACK").length;
  const timeouts = logs.filter((l: AiProcessingLog) => l.fallbackReason === "TIMEOUT").length;
  const providerErrors = logs.filter((l: AiProcessingLog) => l.fallbackReason === "PROVIDER_ERROR").length;

  // Critical field conflicts
  const criticalFields = ["totalAmount", "currency", "vendorName", "subtotalAmount", "taxAmount"];
  let criticalFieldConflictCount = 0;
  for (const log of logs) {
    if (log.comparisonDiff && typeof log.comparisonDiff === "object") {
      const diff = log.comparisonDiff as Record<string, unknown>;
      if (criticalFields.some((f) => f in diff)) criticalFieldConflictCount++;
    }
  }

  // False-safe candidates
  const falseSafeCandidates = logs.filter(
    (l: AiProcessingLog) =>
      (l.confidence !== null && l.confidence < 0.5) ||
      l.fallbackReason === "SCHEMA_INVALID"
  ).length;

  // Unknown classification
  const unknownClassification = logs.filter(
    (l: AiProcessingLog) => l.mismatchCategory === "STRUCTURE_DIFF"
  ).length;

  // Review candidates
  const reviewCandidates = logs.filter(
    (l: AiProcessingLog) =>
      l.fallbackReason === "LOW_CONFIDENCE" ||
      l.mismatchCategory !== null ||
      (l.processingPath === "SHADOW" && l.comparisonDiff !== null)
  ).length;

  // Latency percentiles
  const latencies = logs
    .map((l: AiProcessingLog) => l.latencyMs)
    .filter((v: number | null): v is number => v !== null)
    .sort((a: number, b: number) => a - b);
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)]! : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)]! : 0;

  // Top anomaly templates/vendors
  const templateAnomalies = new Map<string, number>();
  const vendorAnomalies = new Map<string, number>();
  for (const log of logs) {
    if (log.comparisonDiff && typeof log.comparisonDiff === "object") {
      const diff = log.comparisonDiff as Record<string, unknown>;
      if (diff.templateId && typeof diff.templateId === "string") {
        templateAnomalies.set(diff.templateId, (templateAnomalies.get(diff.templateId) || 0) + 1);
      }
      if (diff.vendorName && typeof diff.vendorName === "string") {
        vendorAnomalies.set(diff.vendorName, (vendorAnomalies.get(diff.vendorName) || 0) + 1);
      }
    }
  }

  const topAnomalyTemplates = Array.from(templateAnomalies.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([template, count]) => ({ template, count }));

  const topAnomalyVendors = Array.from(vendorAnomalies.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([vendor, count]) => ({ vendor, count }));

  // Rollback trigger check
  const consecutiveFallbacks = countConsecutiveFallbacks(logs);
  const rollbackTriggerFired = consecutiveFallbacks >= 3;

  // Fallback reason breakdown
  const fallbackReasonBreakdown: Record<string, number> = {};
  for (const log of logs) {
    if (log.fallbackReason !== "NONE") {
      fallbackReasonBreakdown[log.fallbackReason] =
        (fallbackReasonBreakdown[log.fallbackReason] || 0) + 1;
    }
  }

  return {
    documentType,
    stage,
    since: sinceDate,
    until,
    aiActiveCanaryCount: aiActive,
    processedVolume: total,
    mismatchRate: total > 0 ? mismatches / total : 0,
    mismatchCount: mismatches,
    fallbackRate: total > 0 ? fallbacks / total : 0,
    fallbackCount: fallbacks,
    criticalFieldConflictCount,
    falseSafeCandidateCount: falseSafeCandidates,
    confirmedFalseSafeCount: 0, // manual confirmation required
    unknownClassificationCount: unknownClassification,
    reviewCandidateCount: reviewCandidates,
    timeoutRate: total > 0 ? timeouts / total : 0,
    timeoutCount: timeouts,
    providerErrorRate: total > 0 ? providerErrors / total : 0,
    providerErrorCount: providerErrors,
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    topAnomalyTemplates,
    topAnomalyVendors,
    rollbackTriggerFired,
    orgScopeRiskCount: 0,
    dedupRiskCount: 0,
    taskMappingHighRiskMismatchCount: 0,
    fallbackReasonBreakdown,
  };
}

/** Watchboard trend 생성 (시간대별 구간) */
export async function collectWatchboardTrend(
  documentType: string,
  intervalHours: number = 4,
  spanHours: number = 24
): Promise<WatchboardTrend> {
  const intervals: WatchboardInterval[] = [];
  const now = Date.now();
  const totalIntervals = Math.ceil(spanHours / intervalHours);

  for (let i = 0; i < totalIntervals; i++) {
    const until = new Date(now - i * intervalHours * 60 * 60 * 1000);
    const since = new Date(until.getTime() - intervalHours * 60 * 60 * 1000);

    const logs: AiProcessingLog[] = await db.aiProcessingLog.findMany({
      where: { documentType, createdAt: { gte: since, lte: until } },
    });

    const total = logs.length;
    const aiActive = logs.filter((l: AiProcessingLog) => l.processingPath === "AI").length;
    const fallbacks = logs.filter((l: AiProcessingLog) => l.processingPath === "FALLBACK").length;
    const mismatches = logs.filter((l: AiProcessingLog) => l.comparisonDiff !== null).length;
    const providerErrors = logs.filter((l: AiProcessingLog) => l.fallbackReason === "PROVIDER_ERROR").length;
    const reviewCandidates = logs.filter(
      (l: AiProcessingLog) => l.fallbackReason === "LOW_CONFIDENCE" || l.mismatchCategory !== null
    ).length;

    const criticalFields = ["totalAmount", "currency", "vendorName", "subtotalAmount", "taxAmount"];
    let criticalCount = 0;
    let falseSafeCount = 0;
    for (const log of logs) {
      if (log.comparisonDiff && typeof log.comparisonDiff === "object") {
        const diff = log.comparisonDiff as Record<string, unknown>;
        if (criticalFields.some((f) => f in diff)) criticalCount++;
      }
      if (log.confidence !== null && log.confidence < 0.5) falseSafeCount++;
    }

    intervals.push({
      since,
      until,
      aiActiveVolume: aiActive,
      fallbackRate: total > 0 ? fallbacks / total : 0,
      mismatchRate: total > 0 ? mismatches / total : 0,
      criticalFieldConflictCount: criticalCount,
      falseSafeCandidateCount: falseSafeCount,
      providerStability: total > 0 ? 1 - providerErrors / total : 1,
      reviewQueuePressure: total > 0 ? reviewCandidates / total : 0,
      rollbackTriggerState: countConsecutiveFallbacks(logs) >= 3,
    });
  }

  return { documentType, intervals };
}

// ── Helper ──

function countConsecutiveFallbacks(logs: AiProcessingLog[]): number {
  let count = 0;
  for (const log of logs) {
    if (log.processingPath === "FALLBACK") {
      count++;
    } else {
      break;
    }
  }
  return count;
}
