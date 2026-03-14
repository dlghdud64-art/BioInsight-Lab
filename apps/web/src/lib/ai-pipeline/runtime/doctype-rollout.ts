/**
 * P0-2: DocumentType Rollout Spine
 * 문서 타입별 Canary 단계 관리 및 비교 로그.
 *
 * 승격 경로: SHADOW → ACTIVE_5 → ACTIVE_25 → ACTIVE_50 → STABLE
 * 단계 스킵 불가, KILLED 상태에서 직접 승격 불가 (kill switch 해제 후 SHADOW부터 재시작).
 */

import { db } from "@/lib/db";
import { CanaryStage, type CanaryConfig } from "@prisma/client";

// ── Mismatch 분류 ──

export enum MismatchCategory {
  FIELD_VALUE_DIFF = "FIELD_VALUE_DIFF",
  MISSING_FIELD = "MISSING_FIELD",
  EXTRA_FIELD = "EXTRA_FIELD",
  CONFIDENCE_GAP = "CONFIDENCE_GAP",
  ENTITY_LINK_DIFF = "ENTITY_LINK_DIFF",
  STRUCTURE_DIFF = "STRUCTURE_DIFF",
}

export interface ComparisonLogEntry {
  documentType: string;
  field: string;
  aiValue: unknown;
  ruleValue: unknown;
  category: MismatchCategory;
  timestamp: Date;
}

export interface ComparisonSummary {
  documentType: string;
  since: Date;
  totalComparisons: number;
  mismatchCount: number;
  mismatchRate: number;
  categoryBreakdown: Record<string, number>;
  avgConfidence: number;
  fallbackRate: number;
}

// ── 승격 경로 ──

const STAGE_PROGRESSION: Record<CanaryStage, CanaryStage | null> = {
  SHADOW: "ACTIVE_5",
  ACTIVE_5: "ACTIVE_25",
  ACTIVE_25: "ACTIVE_50",
  ACTIVE_50: "STABLE",
  STABLE: null,
  KILLED: null,
};

const STAGE_REGRESSION: Record<CanaryStage, CanaryStage> = {
  STABLE: "ACTIVE_50",
  ACTIVE_50: "ACTIVE_25",
  ACTIVE_25: "ACTIVE_5",
  ACTIVE_5: "SHADOW",
  SHADOW: "SHADOW",
  KILLED: "SHADOW",
};

/** 승격 경로 반환 */
export function getStageProgression(): Record<CanaryStage, CanaryStage | null> {
  return { ...STAGE_PROGRESSION };
}

// ── DocType Config 조회/생성 ──

export interface DocTypeCanaryState {
  documentType: string;
  stage: CanaryStage;
  confidenceThreshold: number;
  autoVerifyEnabled: boolean;
  killSwitchActive: boolean;
  updatedBy: string;
  updatedAt: Date;
}

/** docType의 현재 canary 상태 조회 */
export async function getDocTypeConfig(
  documentType: string
): Promise<DocTypeCanaryState | null> {
  const config = await db.canaryConfig.findUnique({
    where: { documentType },
  });
  if (!config) return null;
  return {
    documentType: config.documentType,
    stage: config.stage,
    confidenceThreshold: config.confidenceThreshold,
    autoVerifyEnabled: config.autoVerifyEnabled,
    killSwitchActive: config.killSwitchActive,
    updatedBy: config.updatedBy,
    updatedAt: config.updatedAt,
  };
}

/** canary config 없으면 기본값으로 생성 */
export async function ensureCanaryConfig(
  documentType: string,
  performedBy: string
): Promise<CanaryConfig> {
  return db.canaryConfig.upsert({
    where: { documentType },
    update: {},
    create: {
      documentType,
      stage: "SHADOW",
      confidenceThreshold: 0.8,
      autoVerifyEnabled: false,
      killSwitchActive: false,
      updatedBy: performedBy,
    },
  });
}

// ── 승격/강등/유지 ──

/** 다음 단계로 승격 */
export async function promoteStage(
  documentType: string,
  performedBy: string,
  reason: string
): Promise<CanaryConfig> {
  const config = await ensureCanaryConfig(documentType, performedBy);
  const nextStage = STAGE_PROGRESSION[config.stage];

  if (!nextStage) {
    throw new Error(
      `Cannot promote from ${config.stage}. Already at maximum or KILLED.`
    );
  }

  const updated = await db.canaryConfig.update({
    where: { documentType },
    data: { stage: nextStage, updatedBy: performedBy, reason },
  });

  await db.canaryApprovalRecord.create({
    data: {
      documentType,
      action: "PROMOTE",
      fromStage: config.stage,
      toStage: nextStage,
      performedBy,
      reason,
    },
  });

  return updated;
}

/** 이전 단계로 강등 (toShadow=true면 SHADOW로 즉시 복귀) */
export async function rollbackStage(
  documentType: string,
  performedBy: string,
  reason: string,
  toShadow: boolean = false
): Promise<CanaryConfig> {
  const config = await ensureCanaryConfig(documentType, performedBy);
  const targetStage = toShadow ? "SHADOW" : STAGE_REGRESSION[config.stage];

  const updated = await db.canaryConfig.update({
    where: { documentType },
    data: {
      stage: targetStage,
      killSwitchActive: false,
      updatedBy: performedBy,
      reason,
    },
  });

  await db.canaryApprovalRecord.create({
    data: {
      documentType,
      action: "ROLLBACK",
      fromStage: config.stage,
      toStage: targetStage,
      performedBy,
      reason,
    },
  });

  return updated;
}

/** 현재 단계 유지 (기록만) */
export async function holdStage(
  documentType: string,
  performedBy: string,
  reason: string
): Promise<void> {
  const config = await ensureCanaryConfig(documentType, performedBy);

  await db.canaryApprovalRecord.create({
    data: {
      documentType,
      action: "HOLD",
      fromStage: config.stage,
      toStage: config.stage,
      performedBy,
      reason,
    },
  });
}

// ── Kill Switch ──

/** kill switch 발동 (documentType=null → 전체) */
export async function activateKillSwitch(
  documentType: string | null,
  performedBy: string,
  reason: string
): Promise<void> {
  if (documentType) {
    await db.canaryConfig.upsert({
      where: { documentType },
      update: {
        stage: "KILLED",
        killSwitchActive: true,
        updatedBy: performedBy,
        reason,
      },
      create: {
        documentType,
        stage: "KILLED",
        killSwitchActive: true,
        confidenceThreshold: 0.8,
        autoVerifyEnabled: false,
        updatedBy: performedBy,
        reason,
      },
    });

    await db.canaryApprovalRecord.create({
      data: {
        documentType,
        action: "KILL_SWITCH_ON",
        fromStage: null,
        toStage: "KILLED",
        performedBy,
        reason,
      },
    });
  } else {
    // 전체 kill switch
    await db.canaryConfig.updateMany({
      data: { stage: "KILLED", killSwitchActive: true, updatedBy: performedBy },
    });

    await db.canaryApprovalRecord.create({
      data: {
        documentType: "ALL",
        action: "KILL_SWITCH_ON",
        fromStage: null,
        toStage: "KILLED",
        performedBy,
        reason,
      },
    });
  }
}

/** kill switch 해제 → SHADOW로 복귀 */
export async function deactivateKillSwitch(
  documentType: string,
  performedBy: string,
  reason: string
): Promise<void> {
  await db.canaryConfig.update({
    where: { documentType },
    data: {
      stage: "SHADOW",
      killSwitchActive: false,
      updatedBy: performedBy,
      reason,
    },
  });

  await db.canaryApprovalRecord.create({
    data: {
      documentType,
      action: "KILL_SWITCH_OFF",
      fromStage: "KILLED",
      toStage: "SHADOW",
      performedBy,
      reason,
    },
  });
}

// ── 비교 결과 분석 ──

/** AI vs rule-based 필드별 비교 */
export function compareResults(
  aiResult: unknown,
  ruleResult: unknown,
  documentType: string
): ComparisonLogEntry[] {
  if (!aiResult || !ruleResult) return [];

  const ai = aiResult as Record<string, unknown>;
  const rule = ruleResult as Record<string, unknown>;
  const entries: ComparisonLogEntry[] = [];
  const now = new Date();

  const allKeys = new Set([...Object.keys(ai), ...Object.keys(rule)]);
  for (const key of Array.from(allKeys)) {
    const hasAi = key in ai;
    const hasRule = key in rule;

    if (hasAi && !hasRule) {
      entries.push({
        documentType,
        field: key,
        aiValue: ai[key],
        ruleValue: undefined,
        category: MismatchCategory.EXTRA_FIELD,
        timestamp: now,
      });
    } else if (!hasAi && hasRule) {
      entries.push({
        documentType,
        field: key,
        aiValue: undefined,
        ruleValue: rule[key],
        category: MismatchCategory.MISSING_FIELD,
        timestamp: now,
      });
    } else if (JSON.stringify(ai[key]) !== JSON.stringify(rule[key])) {
      entries.push({
        documentType,
        field: key,
        aiValue: ai[key],
        ruleValue: rule[key],
        category: MismatchCategory.FIELD_VALUE_DIFF,
        timestamp: now,
      });
    }
  }

  return entries;
}

/** 비교 통계 조회 (최근 N 시간) */
export async function getComparisonSummary(
  documentType: string,
  since: Date
): Promise<ComparisonSummary> {
  const logs = await db.aiProcessingLog.findMany({
    where: { documentType, createdAt: { gte: since } },
    select: {
      processingPath: true,
      confidence: true,
      mismatchCategory: true,
      comparisonDiff: true,
    },
  });

  type LogRow = (typeof logs)[number];
  const total = logs.length;
  const mismatches = logs.filter((l: LogRow) => l.comparisonDiff !== null).length;
  const fallbacks = logs.filter((l: LogRow) => l.processingPath === "FALLBACK").length;
  const confidences = logs
    .map((l: LogRow) => l.confidence)
    .filter((c: number | null): c is number => c !== null);

  const categoryBreakdown: Record<string, number> = {};
  for (const log of logs) {
    if (log.mismatchCategory) {
      categoryBreakdown[log.mismatchCategory] =
        (categoryBreakdown[log.mismatchCategory] || 0) + 1;
    }
  }

  return {
    documentType,
    since,
    totalComparisons: total,
    mismatchCount: mismatches,
    mismatchRate: total > 0 ? mismatches / total : 0,
    categoryBreakdown,
    avgConfidence:
      confidences.length > 0
        ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
        : 0,
    fallbackRate: total > 0 ? fallbacks / total : 0,
  };
}
