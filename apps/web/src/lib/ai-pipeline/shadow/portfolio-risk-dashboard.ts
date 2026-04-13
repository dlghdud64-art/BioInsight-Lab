// @ts-nocheck — shadow pipeline: experimental code, type-check deferred
/**
 * Portfolio Risk Dashboard — 관제 및 주간 Expansion Council Report
 *
 * 모든 문서 타입의 Stage, Risk Tier, Readiness Score, Ops Load Impact,
 * 현재 Portfolio Mode를 한눈에 보여주는 어드민 뷰 데이터 소스
 */

import { getAllRegistryEntries } from "./doctype-registry";
import { getPortfolioMode } from "./expansion-policy";
import { getReviewQueueStats } from "./review-ops-queue";
import { getAlertFeed } from "./alerting-service";
import { getExclusionStats } from "./shared-exclusion-registry";
import { getQueueStats, getFullQueue } from "./promotion-queue";
import type { LifecycleState } from "./rollout-state-machine";
import type { RiskTier } from "./doctype-tiering";
import type { PortfolioMode } from "./expansion-policy";

// ── Dashboard Data ──

export interface PortfolioRiskDashboardData {
  generatedAt: string;
  portfolioMode: PortfolioMode;
  portfolioModeReason: string;

  docTypeEntries: {
    documentType: string;
    state: LifecycleState;
    isFirstDocType: boolean;
    autoVerifyEnabled: boolean;
    haltCount: number;
    rollbackCount: number;
  }[];

  promotionQueue: {
    total: number;
    queued: number;
    ready: number;
    blocked: number;
  };

  reviewQueue: {
    capacityPercent: number;
    overdueCount: number;
    avgResolutionHours: number;
  };

  exclusions: {
    total: number;
    active: number;
    bySource: Record<string, number>;
  };

  alerts: {
    recentCount: number;
    unacknowledgedSev0: number;
    unacknowledgedSev1: number;
  };

  overallRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export function getPortfolioRiskDashboard(): PortfolioRiskDashboardData {
  const entries = getAllRegistryEntries();
  const mode = getPortfolioMode();
  const reviewStats = getReviewQueueStats();
  const alerts = getAlertFeed({ limit: 100 });
  const exclusionStats = getExclusionStats();
  const queueStats = getQueueStats();

  const unackSev0 = alerts.filter((a) => a.severity === "SEV0" && !a.acknowledged).length;
  const unackSev1 = alerts.filter((a) => a.severity === "SEV1" && !a.acknowledged).length;

  let overallRisk: PortfolioRiskDashboardData["overallRisk"] = "LOW";
  if (unackSev0 > 0 || mode.current === "FREEZE") overallRisk = "CRITICAL";
  else if (unackSev1 > 0 || mode.current === "INCIDENT_CONTAINMENT") overallRisk = "HIGH";
  else if (mode.current === "SLOWDOWN" || reviewStats.capacityPercent > 80) overallRisk = "MEDIUM";

  return {
    generatedAt: new Date().toISOString(),
    portfolioMode: mode.current,
    portfolioModeReason: mode.reason,
    docTypeEntries: entries.map((e) => ({
      documentType: e.documentType,
      state: e.lifecycleState,
      isFirstDocType: e.isFirstDocType,
      autoVerifyEnabled: e.restrictedAutoVerifyEnabled,
      haltCount: e.haltCount,
      rollbackCount: e.rollbackCount,
    })),
    promotionQueue: {
      total: queueStats.total,
      queued: queueStats.queued,
      ready: queueStats.ready,
      blocked: queueStats.blocked,
    },
    reviewQueue: {
      capacityPercent: reviewStats.capacityPercent,
      overdueCount: reviewStats.overdue,
      avgResolutionHours: reviewStats.avgResolutionHours,
    },
    exclusions: {
      total: exclusionStats.total,
      active: exclusionStats.active,
      bySource: exclusionStats.bySource,
    },
    alerts: {
      recentCount: alerts.length,
      unacknowledgedSev0: unackSev0,
      unacknowledgedSev1: unackSev1,
    },
    overallRisk,
  };
}

// ── Weekly Expansion Council Report ──

export interface ExpansionCouncilReport {
  reportId: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;

  portfolioMode: PortfolioMode;
  overallRisk: string;

  blockedPromotions: {
    documentType: string;
    targetStage: string;
    blockReason: string | null;
  }[];

  nextRecommendedCandidates: {
    documentType: string;
    currentStage: LifecycleState;
    readinessScore: number;
    recommendation: string;
  }[];

  keyMetrics: {
    totalDocTypes: number;
    activeDocTypes: number;
    reviewCapacityPercent: number;
    overdueReviews: number;
    openIncidents: number;
    exclusionCount: number;
  };

  actionItems: string[];
}

export function generateExpansionCouncilReport(): ExpansionCouncilReport {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  const entries = getAllRegistryEntries();
  const mode = getPortfolioMode();
  const reviewStats = getReviewQueueStats();
  const alerts = getAlertFeed({ limit: 100 });
  const exclusionStats = getExclusionStats();
  const queue = getFullQueue();

  const blockedItems = queue
    .filter((q) => q.status === "BLOCKED")
    .map((q) => ({
      documentType: q.documentType,
      targetStage: q.targetStage,
      blockReason: q.blockReason,
    }));

  // Next candidates: SHADOW_ONLY or ACTIVE stages with no blocks
  const candidates = entries
    .filter((e) => ["SHADOW_ONLY", "ACTIVE_5", "ACTIVE_25"].includes(e.lifecycleState))
    .map((e) => ({
      documentType: e.documentType,
      currentStage: e.lifecycleState,
      readinessScore: 0, // would be computed from ops-load-scoring
      recommendation: e.haltCount === 0 && e.rollbackCount === 0 ? "승격 검토 가능" : "안정화 필요",
    }));

  const unackSev0 = alerts.filter((a) => a.severity === "SEV0" && !a.acknowledged).length;
  const overallRisk = unackSev0 > 0 ? "CRITICAL" : mode.current !== "NORMAL" ? "ELEVATED" : "NORMAL";

  const actionItems: string[] = [];
  if (blockedItems.length > 0) actionItems.push(`${blockedItems.length}건의 승격 요청이 차단 상태 — 사유 검토 필요`);
  if (reviewStats.overdue > 10) actionItems.push(`리뷰 백로그 ${reviewStats.overdue}건 초과 — 인력 배정 필요`);
  if (candidates.filter((c) => c.recommendation === "승격 검토 가능").length > 0) {
    actionItems.push("승격 가능한 후보 DocType 존재 — 다음 Council에서 결정");
  }
  if (mode.current === "FREEZE") actionItems.push("Portfolio FREEZE 상태 — 해제 조건 검토");

  return {
    reportId: `ECR-${now.toISOString().slice(0, 10)}`,
    periodStart: weekAgo.toISOString(),
    periodEnd: now.toISOString(),
    generatedAt: now.toISOString(),
    portfolioMode: mode.current,
    overallRisk,
    blockedPromotions: blockedItems,
    nextRecommendedCandidates: candidates,
    keyMetrics: {
      totalDocTypes: entries.length,
      activeDocTypes: entries.filter((e) => e.lifecycleState !== "OFF" && e.lifecycleState !== "SHADOW_ONLY").length,
      reviewCapacityPercent: reviewStats.capacityPercent,
      overdueReviews: reviewStats.overdue,
      openIncidents: unackSev0,
      exclusionCount: exclusionStats.active,
    },
    actionItems,
  };
}
