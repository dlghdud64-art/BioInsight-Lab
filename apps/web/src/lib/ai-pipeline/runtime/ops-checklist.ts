/**
 * P0-6: Human Ops Minimum
 * 리뷰 큐, 런치/롤백 체크리스트, 일일 요약, 런북.
 */

import { db } from "@/lib/db";
import type { AiProcessingLog } from "@prisma/client";

// ── Review Candidate Queue ──

export interface ReviewCandidate {
  ingestionEntryId: string;
  documentType: string;
  confidence: number;
  reason: string;
  createdAt: Date;
}

/** AI confidence < threshold 또는 mismatch 건 목록 */
export async function getReviewQueue(
  organizationId: string,
  limit: number = 50
): Promise<ReviewCandidate[]> {
  const logs = await db.aiProcessingLog.findMany({
    where: {
      organizationId,
      ingestionEntryId: { not: null },
      OR: [
        { fallbackReason: "LOW_CONFIDENCE" },
        { mismatchCategory: { not: null } },
        { processingPath: "SHADOW", comparisonDiff: { not: undefined } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs.map((log: AiProcessingLog) => ({
    ingestionEntryId: log.ingestionEntryId ?? "",
    documentType: log.documentType,
    confidence: log.confidence ?? 0,
    reason: log.fallbackReason !== "NONE"
      ? log.fallbackReason
      : log.mismatchCategory
        ? `MISMATCH: ${log.mismatchCategory}`
        : "SHADOW_DIFF",
    createdAt: log.createdAt,
  }));
}

// ── Checklist ──

export interface ChecklistItem {
  id: string;
  category: string;
  description: string;
  required: boolean;
}

/** Canary 시작 전 런치 체크리스트 */
export function getLaunchChecklist(documentType: string): ChecklistItem[] {
  return [
    {
      id: "env-openai-key",
      category: "Environment",
      description: "OPENAI_API_KEY 환경변수가 설정되어 있는가?",
      required: true,
    },
    {
      id: "env-feature-flag",
      category: "Environment",
      description: "ENABLE_INGESTION_RUNTIME이 true인가?",
      required: true,
    },
    {
      id: "canary-config",
      category: "Config",
      description: `${documentType} CanaryConfig가 DB에 존재하는가?`,
      required: true,
    },
    {
      id: "shadow-baseline",
      category: "Data",
      description: `${documentType}에 대해 최소 50건의 shadow 비교 데이터가 있는가?`,
      required: true,
    },
    {
      id: "mismatch-rate",
      category: "Quality",
      description: "Shadow mode mismatch rate가 20% 이하인가?",
      required: true,
    },
    {
      id: "avg-confidence",
      category: "Quality",
      description: "평균 AI confidence가 0.75 이상인가?",
      required: true,
    },
    {
      id: "fallback-healthy",
      category: "Fallback",
      description: "Rule-based fallback 경로가 정상 동작하는가?",
      required: true,
    },
    {
      id: "kill-switch-tested",
      category: "Safety",
      description: "Kill switch를 한번 발동-해제 테스트했는가?",
      required: true,
    },
    {
      id: "rollback-tested",
      category: "Safety",
      description: "Rollback 시나리오를 한번 테스트했는가?",
      required: false,
    },
    {
      id: "ops-contact",
      category: "Ops",
      description: "장애 시 연락할 담당자가 지정되어 있는가?",
      required: false,
    },
  ];
}

/** 롤백 시 확인 체크리스트 */
export function getRollbackChecklist(documentType: string): ChecklistItem[] {
  return [
    {
      id: "active-requests",
      category: "In-flight",
      description: `${documentType} 처리 중인 요청이 있는지 확인`,
      required: true,
    },
    {
      id: "fallback-path",
      category: "Fallback",
      description: "Rule-based fallback이 정상인지 확인",
      required: true,
    },
    {
      id: "pending-verifications",
      category: "Verification",
      description: "Auto-verify 대기 중인 건이 있는지 확인",
      required: true,
    },
    {
      id: "notify-team",
      category: "Communication",
      description: "운영팀에 롤백 사실 알림",
      required: false,
    },
    {
      id: "record-reason",
      category: "Audit",
      description: "롤백 사유를 기록",
      required: true,
    },
  ];
}

// ── Daily Ops Report ──

export interface DailyOpsReport {
  date: string;
  organizationId: string;
  metrics: {
    documentType: string;
    totalProcessed: number;
    aiUsed: number;
    fallbackCount: number;
    avgConfidence: number;
    mismatchCount: number;
  }[];
  incidents: string[];
  reviewQueueSize: number;
  recommendation: "PROMOTE" | "HOLD" | "ROLLBACK" | "INSUFFICIENT_DATA";
}

/** 일일 운영 보고서 생성 */
export async function generateDailyOpsReport(
  organizationId: string,
  date?: Date
): Promise<DailyOpsReport> {
  const targetDate = date ?? new Date();
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const logs = await db.aiProcessingLog.findMany({
    where: {
      organizationId,
      createdAt: { gte: dayStart, lte: dayEnd },
    },
  });

  // docType별 집계
  const byDocType = new Map<string, typeof logs>();
  for (const log of logs) {
    const existing = byDocType.get(log.documentType) || [];
    existing.push(log);
    byDocType.set(log.documentType, existing);
  }

  const metrics = Array.from(byDocType.entries()).map(([docType, docLogs]) => {
    const confidences = docLogs
      .map((l: AiProcessingLog) => l.confidence)
      .filter((c: number | null): c is number => c !== null);
    return {
      documentType: docType,
      totalProcessed: docLogs.length,
      aiUsed: docLogs.filter((l: AiProcessingLog) => l.processingPath === "AI").length,
      fallbackCount: docLogs.filter((l: AiProcessingLog) => l.processingPath === "FALLBACK").length,
      avgConfidence:
        confidences.length > 0
          ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
          : 0,
      mismatchCount: docLogs.filter((l: AiProcessingLog) => l.mismatchCategory !== null).length,
    };
  });

  // 인시던트 수집
  const incidentLogs = logs.filter((l: AiProcessingLog) => l.incidentTriggered);
  const incidents = incidentLogs.map(
    (l: AiProcessingLog) => `${l.documentType}: ${l.fallbackReason} at ${l.createdAt.toISOString()}`
  );

  // Review queue 크기
  const reviewQueueSize = logs.filter(
    (l: AiProcessingLog) => l.fallbackReason === "LOW_CONFIDENCE" || l.mismatchCategory !== null
  ).length;

  // 추천 판단
  let recommendation: DailyOpsReport["recommendation"] = "INSUFFICIENT_DATA";
  if (logs.length >= 10) {
    const totalFallbackRate =
      logs.filter((l: AiProcessingLog) => l.processingPath === "FALLBACK").length / logs.length;
    const totalMismatchRate =
      logs.filter((l: AiProcessingLog) => l.mismatchCategory !== null).length / logs.length;

    if (totalFallbackRate > 0.3 || totalMismatchRate > 0.3) {
      recommendation = "ROLLBACK";
    } else if (totalFallbackRate > 0.1 || totalMismatchRate > 0.15) {
      recommendation = "HOLD";
    } else {
      recommendation = "PROMOTE";
    }
  }

  return {
    date: dayStart.toISOString().split("T")[0]!,
    organizationId,
    metrics,
    incidents,
    reviewQueueSize,
    recommendation,
  };
}

// ── Runbook ──

export interface RunbookEntry {
  id: string;
  title: string;
  steps: string[];
}

/** 운영 런북 */
export function getRunbook(): RunbookEntry[] {
  return [
    {
      id: "kill-switch",
      title: "Kill Switch 발동",
      steps: [
        "POST /api/ai-ops/kill-switch { activate: true, reason: '...' }",
        "모든 AI 처리가 즉시 rule-based fallback으로 전환됨",
        "원인 분석 후 해제: POST /api/ai-ops/kill-switch { activate: false, documentType: '...', reason: '...' }",
        "해제 시 SHADOW 모드로 복귀 (ACTIVE로 바로 가지 않음)",
      ],
    },
    {
      id: "rollback",
      title: "Stage 롤백",
      steps: [
        "POST /api/ai-ops/rollback { documentType: '...', reason: '...' }",
        "한 단계 뒤로 이동 (ACTIVE_25 → ACTIVE_5)",
        "긴급 시 toShadow: true로 SHADOW까지 즉시 복귀",
        "롤백 사유 반드시 기록",
      ],
    },
    {
      id: "incident-response",
      title: "인시던트 대응",
      steps: [
        "GET /api/ai-ops/status 로 현황 확인",
        "연속 fallback 3회 이상 → rollback 고려",
        "연속 fallback 5회 이상 → kill switch 고려",
        "신뢰도 급락 → shadow 모드로 전환 후 원인 분석",
        "mismatch 급증 → 모델 또는 프롬프트 변경 확인",
      ],
    },
    {
      id: "daily-ops",
      title: "일일 운영",
      steps: [
        "매일 GET /api/ai-ops/status 확인",
        "review queue 건수 확인 → 높으면 threshold 조정 고려",
        "fallback rate > 30% → HOLD 또는 ROLLBACK",
        "confidence 추이 확인 → 하락세면 모델 점검",
      ],
    },
  ];
}
