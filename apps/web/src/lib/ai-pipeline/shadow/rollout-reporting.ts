/**
 * Rollout Reporting — 자동 보고서 세트
 *
 * 6종 표준 보고서:
 *  1. Stage Health Report
 *  2. Promotion Readiness Report
 *  3. Restricted Auto-Verify Safety Report
 *  4. Stabilization Trend Report
 *  5. Rollback Incident Report
 *  6. Second DocType Expansion Readiness Report
 */

import { evaluatePromotionGate } from "./promotion-gate";
import { evaluateFinalPromotion, extractReviewSamples } from "./final-promotion";
import { evaluateAutoVerifyEligibility, detectFalseSafePatterns } from "./auto-verify-policy";
import { getStabilizationDashboard, buildLongTailBacklog } from "./stabilization";
import { analyzeAnomalies } from "./anomaly-analyzer";
import { evaluateSecondPromotion, selectSecondCandidate, checkParallelOpsReadiness } from "./second-doctype-rollout";
import { getRegistryEntry, getFirstDocTypeState, getAllRegistryEntries } from "./doctype-registry";
import type { LifecycleState } from "./rollout-state-machine";

export type ReportType =
  | "STAGE_HEALTH"
  | "PROMOTION_READINESS"
  | "AUTO_VERIFY_SAFETY"
  | "STABILIZATION_TREND"
  | "ROLLBACK_INCIDENT"
  | "SECOND_DOCTYPE_READINESS";

export interface ReportEnvelope {
  reportType: ReportType;
  documentType: string;
  generatedAt: string;
  data: unknown;
}

/**
 * Stage Health Report — 현재 상태 + 품질 지표 요약
 */
export async function generateStageHealthReport(documentType: string): Promise<ReportEnvelope> {
  const entry = getRegistryEntry(documentType);
  const gate = await evaluatePromotionGate({ documentType });
  const anomalies = await analyzeAnomalies({ documentType });

  return {
    reportType: "STAGE_HEALTH",
    documentType,
    generatedAt: new Date().toISOString(),
    data: {
      registry: entry,
      promotionGate: {
        decision: gate.decision,
        fallbackRate: gate.fallbackRate,
        mismatchRate: gate.mismatchRate,
        highRiskTotal: gate.highRiskBreakdown.total,
        haltCount: gate.haltCount,
        latencyP95Ms: gate.latencyP95Ms,
      },
      anomalySummary: anomalies.riskSummary,
    },
  };
}

/**
 * Promotion Readiness Report — 승격 가능 여부 평가
 */
export async function generatePromotionReadinessReport(documentType: string): Promise<ReportEnvelope> {
  const entry = getRegistryEntry(documentType);
  const gate = await evaluatePromotionGate({ documentType });

  let finalPromo = null;
  if (entry?.lifecycleState === "ACTIVE_50") {
    finalPromo = await evaluateFinalPromotion({ documentType });
  }

  return {
    reportType: "PROMOTION_READINESS",
    documentType,
    generatedAt: new Date().toISOString(),
    data: {
      currentStage: entry?.lifecycleState,
      promotionGate: {
        decision: gate.decision,
        reasons: gate.decisionReasons,
        volume: gate.totalProcessed,
        thresholds: gate.thresholds,
      },
      finalPromotion: finalPromo ? {
        decision: finalPromo.decision,
        reasons: finalPromo.decisionReasons,
      } : null,
    },
  };
}

/**
 * Restricted Auto-Verify Safety Report
 */
export async function generateAutoVerifySafetyReport(documentType: string): Promise<ReportEnvelope> {
  const eligibility = await evaluateAutoVerifyEligibility({ documentType });
  const falseSafe = await detectFalseSafePatterns(documentType);
  const samples = await extractReviewSamples(documentType);

  return {
    reportType: "AUTO_VERIFY_SAFETY",
    documentType,
    generatedAt: new Date().toISOString(),
    data: {
      eligibility: {
        decision: eligibility.decision,
        reasons: eligibility.eligibilityReasons,
        suggestedPolicy: eligibility.suggestedPolicy,
        confidenceBands: eligibility.confidenceBands,
      },
      falseSafePatterns: falseSafe,
      reviewSampleCount: samples.length,
      reviewSamples: samples.slice(0, 10),
    },
  };
}

/**
 * Stabilization Trend Report
 */
export async function generateStabilizationReport(documentType: string): Promise<ReportEnvelope> {
  const dashboard = await getStabilizationDashboard(documentType, 14);
  const backlog = await buildLongTailBacklog(documentType);

  return {
    reportType: "STABILIZATION_TREND",
    documentType,
    generatedAt: new Date().toISOString(),
    data: {
      operatingState: dashboard.operatingState,
      trendDirection: dashboard.summary.trendDirection,
      summary: dashboard.summary,
      dailyTrends: dashboard.dailyTrends,
      longTailBacklog: backlog,
    },
  };
}

/**
 * Rollback Incident Report
 */
export async function generateRollbackIncidentReport(documentType: string): Promise<ReportEnvelope> {
  // DB에서 최근 halt 이력 조회는 다른 모듈에서 처리
  const gate = await evaluatePromotionGate({ documentType });

  return {
    reportType: "ROLLBACK_INCIDENT",
    documentType,
    generatedAt: new Date().toISOString(),
    data: {
      haltCount: gate.haltCount,
      highRiskBreakdown: gate.highRiskBreakdown,
      mismatchDistribution: gate.mismatchDistribution,
      fallbackDistribution: gate.fallbackDistribution,
    },
  };
}

/**
 * Second DocType Expansion Readiness Report
 */
export async function generateSecondDocTypeReport(
  firstDocType: string,
): Promise<ReportEnvelope> {
  const candidates = await selectSecondCandidate(firstDocType);
  const parallelOps = candidates.length > 0
    ? await checkParallelOpsReadiness(firstDocType, candidates[0].documentType)
    : null;
  const firstState = getFirstDocTypeState();

  return {
    reportType: "SECOND_DOCTYPE_READINESS",
    documentType: firstDocType,
    generatedAt: new Date().toISOString(),
    data: {
      firstDocType: {
        state: firstState?.lifecycleState,
        operatingState: firstState?.currentOperatingState,
        stable: firstState ? firstState.lifecycleState === "FULL_ACTIVE_STABLE" : false,
      },
      candidates: candidates.map((c) => ({
        documentType: c.documentType,
        volume: c.totalVolume,
        mismatchRate: c.mismatchRate,
        recommendation: c.recommendation,
        reason: c.reason,
      })),
      parallelOps: parallelOps ? {
        canProceed: parallelOps.canProceed,
        reasons: parallelOps.reasons,
      } : null,
    },
  };
}

/**
 * 전체 포트폴리오 현황 요약
 */
export function getPortfolioSummary(): {
  totalDocTypes: number;
  byState: Record<string, number>;
  entries: { documentType: string; state: LifecycleState; autoVerify: boolean }[];
} {
  const entries = getAllRegistryEntries();
  const byState: Record<string, number> = {};

  for (const e of entries) {
    byState[e.lifecycleState] = (byState[e.lifecycleState] ?? 0) + 1;
  }

  return {
    totalDocTypes: entries.length,
    byState,
    entries: entries.map((e) => ({
      documentType: e.documentType,
      state: e.lifecycleState,
      autoVerify: e.restrictedAutoVerifyEnabled,
    })),
  };
}
