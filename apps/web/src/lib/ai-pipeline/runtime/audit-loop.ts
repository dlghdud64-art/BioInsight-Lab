/**
 * P0-5: Audit / Observability / Incident Loop
 * AI 처리 로그, 비교 차이, 인시던트 자동 감지.
 *
 * Incident trigger 조건:
 * - 연속 3회 fallback (30분 이내)
 * - 신뢰도 30% 이상 급락 (1시간 이내)
 * - 동일 mismatch 5건 이상 (1시간 이내)
 * - 고지연 (15초 초과, 15분 이내)
 */

import { db } from "@/lib/db";
import type { AiProcessingLog } from "@prisma/client";

// ── Incident 타입 ──

export type IncidentType =
  | "CONSECUTIVE_FALLBACK"
  | "CONFIDENCE_DROP"
  | "REPEATED_MISMATCH"
  | "HIGH_LATENCY";

export interface IncidentTriggerCondition {
  type: IncidentType;
  threshold: number;
  windowMinutes: number;
}

export interface IncidentAlert {
  id: string;
  documentType: string;
  condition: IncidentTriggerCondition;
  detectedAt: Date;
  recentLogIds: string[];
  severity: "WARNING" | "CRITICAL";
  autoAction: "NONE" | "ROLLBACK_SUGGESTED" | "KILL_SWITCH_SUGGESTED";
}

/** 기본 인시던트 조건 */
export const DEFAULT_INCIDENT_CONDITIONS: IncidentTriggerCondition[] = [
  { type: "CONSECUTIVE_FALLBACK", threshold: 3, windowMinutes: 30 },
  { type: "CONFIDENCE_DROP", threshold: 0.3, windowMinutes: 60 },
  { type: "REPEATED_MISMATCH", threshold: 5, windowMinutes: 60 },
  { type: "HIGH_LATENCY", threshold: 15_000, windowMinutes: 15 },
];

// ── Processing Stats ──

export interface ProcessingStats {
  documentType: string;
  since: Date;
  totalProcessed: number;
  aiCount: number;
  fallbackCount: number;
  shadowCount: number;
  avgConfidence: number;
  avgLatencyMs: number;
  fallbackReasonBreakdown: Record<string, number>;
  mismatchCategoryBreakdown: Record<string, number>;
}

export interface DailySummary {
  date: string;
  organizationId: string;
  perDocType: ProcessingStats[];
  overall: {
    total: number;
    aiRate: number;
    fallbackRate: number;
    incidentCount: number;
    avgConfidence: number;
  };
}

// ── 처리 로그 기록 ──

export interface RecordProcessingParams {
  organizationId: string;
  documentType: string;
  ingestionEntryId?: string;
  processingPath: "AI" | "FALLBACK" | "SHADOW";
  fallbackReason?: string;
  confidence?: number;
  model?: string;
  latencyMs?: number;
  tokenUsage?: number;
  comparisonDiff?: object;
  mismatchCategory?: string;
  rollbackTriggered?: boolean;
}

/** AI 처리 결과를 DB에 기록 */
export async function recordProcessing(
  params: RecordProcessingParams
): Promise<AiProcessingLog> {
  return db.aiProcessingLog.create({
    data: {
      organizationId: params.organizationId,
      documentType: params.documentType,
      ingestionEntryId: params.ingestionEntryId ?? null,
      processingPath: params.processingPath,
      fallbackReason: (params.fallbackReason as "NONE") ?? "NONE",
      confidence: params.confidence ?? null,
      model: params.model ?? null,
      latencyMs: params.latencyMs ?? null,
      tokenUsage: params.tokenUsage ?? null,
      comparisonDiff: params.comparisonDiff ?? undefined,
      mismatchCategory: params.mismatchCategory ?? null,
      rollbackTriggered: params.rollbackTriggered ?? false,
      incidentTriggered: false,
    },
  });
}

// ── Incident 감지 ──

/** 최근 로그 기반 인시던트 조건 확인 */
export async function checkIncidentTriggers(
  documentType: string,
  conditions: IncidentTriggerCondition[] = DEFAULT_INCIDENT_CONDITIONS
): Promise<IncidentAlert[]> {
  const alerts: IncidentAlert[] = [];

  for (const condition of conditions) {
    const since = new Date(Date.now() - condition.windowMinutes * 60 * 1000);
    const logs = await db.aiProcessingLog.findMany({
      where: { documentType, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    if (logs.length === 0) continue;

    let triggered = false;
    let severity: "WARNING" | "CRITICAL" = "WARNING";
    let autoAction: "NONE" | "ROLLBACK_SUGGESTED" | "KILL_SWITCH_SUGGESTED" =
      "NONE";
    const recentLogIds: string[] = [];

    switch (condition.type) {
      case "CONSECUTIVE_FALLBACK": {
        // 최근 N건 연속 fallback
        let consecutive = 0;
        for (const log of logs) {
          if (log.processingPath === "FALLBACK") {
            consecutive++;
            recentLogIds.push(log.id);
          } else {
            break;
          }
        }
        if (consecutive >= condition.threshold) {
          triggered = true;
          severity = consecutive >= 5 ? "CRITICAL" : "WARNING";
          autoAction =
            consecutive >= 5 ? "KILL_SWITCH_SUGGESTED" : "ROLLBACK_SUGGESTED";
        }
        break;
      }

      case "CONFIDENCE_DROP": {
        // 신뢰도 급락 감지
        const confidences = logs
          .map((l: AiProcessingLog) => l.confidence)
          .filter((c: number | null): c is number => c !== null);
        if (confidences.length >= 2) {
          const recent = confidences.slice(0, Math.min(5, confidences.length));
          const older = confidences.slice(5, Math.min(15, confidences.length));
          if (recent.length > 0 && older.length > 0) {
            const recentAvg =
              recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
            const olderAvg =
              older.reduce((a: number, b: number) => a + b, 0) / older.length;
            if (olderAvg - recentAvg > condition.threshold) {
              triggered = true;
              severity = "WARNING";
              autoAction = "ROLLBACK_SUGGESTED";
              for (const log of logs.slice(0, 5)) recentLogIds.push(log.id);
            }
          }
        }
        break;
      }

      case "REPEATED_MISMATCH": {
        // 동일 mismatch 반복
        const mismatchLogs = logs.filter((l: AiProcessingLog) => l.mismatchCategory !== null);
        if (mismatchLogs.length >= condition.threshold) {
          triggered = true;
          severity = mismatchLogs.length >= 10 ? "CRITICAL" : "WARNING";
          autoAction = "ROLLBACK_SUGGESTED";
          for (const log of mismatchLogs.slice(0, 10))
            recentLogIds.push(log.id);
        }
        break;
      }

      case "HIGH_LATENCY": {
        // 고지연
        const slowLogs = logs.filter(
          (l: AiProcessingLog) => l.latencyMs !== null && l.latencyMs > condition.threshold
        );
        if (slowLogs.length >= 3) {
          triggered = true;
          severity = "WARNING";
          autoAction = "NONE";
          for (const log of slowLogs.slice(0, 5)) recentLogIds.push(log.id);
        }
        break;
      }
    }

    if (triggered) {
      alerts.push({
        id: `incident-${documentType}-${condition.type}-${Date.now()}`,
        documentType,
        condition,
        detectedAt: new Date(),
        recentLogIds,
        severity,
        autoAction,
      });
    }
  }

  return alerts;
}

// ── 통계 조회 ──

/** 특정 docType의 처리 통계 */
export async function getProcessingStats(
  documentType: string,
  since: Date
): Promise<ProcessingStats> {
  const logs = await db.aiProcessingLog.findMany({
    where: { documentType, createdAt: { gte: since } },
  });

  const aiLogs = logs.filter((l: AiProcessingLog) => l.processingPath === "AI");
  const fallbackLogs = logs.filter((l: AiProcessingLog) => l.processingPath === "FALLBACK");
  const shadowLogs = logs.filter((l: AiProcessingLog) => l.processingPath === "SHADOW");

  const confidences = logs
    .map((l: AiProcessingLog) => l.confidence)
    .filter((c: number | null): c is number => c !== null);
  const latencies = logs
    .map((l: AiProcessingLog) => l.latencyMs)
    .filter((v: number | null): v is number => v !== null);

  const fallbackReasonBreakdown: Record<string, number> = {};
  for (const log of fallbackLogs) {
    const reason = log.fallbackReason;
    fallbackReasonBreakdown[reason] =
      (fallbackReasonBreakdown[reason] || 0) + 1;
  }

  const mismatchCategoryBreakdown: Record<string, number> = {};
  for (const log of logs) {
    if (log.mismatchCategory) {
      mismatchCategoryBreakdown[log.mismatchCategory] =
        (mismatchCategoryBreakdown[log.mismatchCategory] || 0) + 1;
    }
  }

  return {
    documentType,
    since,
    totalProcessed: logs.length,
    aiCount: aiLogs.length,
    fallbackCount: fallbackLogs.length,
    shadowCount: shadowLogs.length,
    avgConfidence:
      confidences.length > 0
        ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
        : 0,
    avgLatencyMs:
      latencies.length > 0
        ? latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length
        : 0,
    fallbackReasonBreakdown,
    mismatchCategoryBreakdown,
  };
}

/** 일일 운영 요약 */
export async function getDailySummary(
  organizationId: string,
  date: Date
): Promise<DailySummary> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const logs = await db.aiProcessingLog.findMany({
    where: {
      organizationId,
      createdAt: { gte: dayStart, lte: dayEnd },
    },
  });

  // docType별 그룹핑
  const byDocType = new Map<string, typeof logs>();
  for (const log of logs) {
    const existing = byDocType.get(log.documentType) || [];
    existing.push(log);
    byDocType.set(log.documentType, existing);
  }

  const perDocType: ProcessingStats[] = [];
  for (const [docType, docLogs] of Array.from(byDocType.entries())) {
    const aiCount = docLogs.filter((l: AiProcessingLog) => l.processingPath === "AI").length;
    const fallbackCount = docLogs.filter(
      (l: AiProcessingLog) => l.processingPath === "FALLBACK"
    ).length;
    const shadowCount = docLogs.filter(
      (l: AiProcessingLog) => l.processingPath === "SHADOW"
    ).length;
    const confidences = docLogs
      .map((l: AiProcessingLog) => l.confidence)
      .filter((c: number | null): c is number => c !== null);
    const latencies = docLogs
      .map((l: AiProcessingLog) => l.latencyMs)
      .filter((v: number | null): v is number => v !== null);

    perDocType.push({
      documentType: docType,
      since: dayStart,
      totalProcessed: docLogs.length,
      aiCount,
      fallbackCount,
      shadowCount,
      avgConfidence:
        confidences.length > 0
          ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
          : 0,
      avgLatencyMs:
        latencies.length > 0
          ? latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length
          : 0,
      fallbackReasonBreakdown: {},
      mismatchCategoryBreakdown: {},
    });
  }

  const totalProcessed = logs.length;
  const totalAi = logs.filter((l: AiProcessingLog) => l.processingPath === "AI").length;
  const totalFallback = logs.filter(
    (l: AiProcessingLog) => l.processingPath === "FALLBACK"
  ).length;
  const totalIncidents = logs.filter((l: AiProcessingLog) => l.incidentTriggered).length;
  const allConfidences = logs
    .map((l: AiProcessingLog) => l.confidence)
    .filter((c: number | null): c is number => c !== null);

  return {
    date: dayStart.toISOString().split("T")[0]!,
    organizationId,
    perDocType,
    overall: {
      total: totalProcessed,
      aiRate: totalProcessed > 0 ? totalAi / totalProcessed : 0,
      fallbackRate: totalProcessed > 0 ? totalFallback / totalProcessed : 0,
      incidentCount: totalIncidents,
      avgConfidence:
        allConfidences.length > 0
          ? allConfidences.reduce((a: number, b: number) => a + b, 0) / allConfidences.length
          : 0,
    },
  };
}
