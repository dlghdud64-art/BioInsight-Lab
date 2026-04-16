/**
 * Portfolio Dashboard & Weekly Council Report
 *
 * 전체 포트폴리오 관제 데이터 소스 및 주간 리포트 생성기
 */

import { getAllRegistryEntries, getFirstDocTypeState } from "./doctype-registry";
import { getReviewQueueStats } from "./review-ops-queue";
import { getAlertFeed } from "./alerting-service";
import { getActiveFreezeWindows } from "./launch-readiness-gate";
import type { LifecycleState } from "./rollout-state-machine";
import type { ReviewQueueStats } from "./review-ops-queue";
import type { FreezeWindow } from "./launch-readiness-gate";

// ── Dashboard Types ──

export interface PortfolioDashboardData {
  generatedAt: string;
  summary: {
    totalDocTypes: number;
    activeDocTypes: number;
    byState: Record<string, number>;
  };
  docTypes: DocTypeDashboardEntry[];
  reviewQueue: ReviewQueueStats;
  activeFreezeWindows: FreezeWindow[];
  recentAlerts: { severity: string; eventType: string; documentType: string; timestamp: string }[];
  healthIndicator: "GREEN" | "YELLOW" | "RED";
}

export interface DocTypeDashboardEntry {
  documentType: string;
  lifecycleState: LifecycleState;
  isFirstDocType: boolean;
  autoVerifyEnabled: boolean;
  lastTransitionAt: string | null;
  haltCount: number;
  rollbackCount: number;
}

/**
 * 포트폴리오 대시보드 데이터 생성
 */
export function getPortfolioDashboardData(): PortfolioDashboardData {
  const entries = getAllRegistryEntries();
  const reviewStats = getReviewQueueStats();
  const alerts = getAlertFeed({ limit: 20 });
  const freezeWindows = getActiveFreezeWindows();

  const byState: Record<string, number> = {};
  const docTypes: DocTypeDashboardEntry[] = [];

  for (const entry of entries) {
    byState[entry.lifecycleState] = (byState[entry.lifecycleState] ?? 0) + 1;
    docTypes.push({
      documentType: entry.documentType,
      lifecycleState: entry.lifecycleState,
      isFirstDocType: entry.isFirstDocType,
      autoVerifyEnabled: entry.restrictedAutoVerifyEnabled,
      lastTransitionAt: entry.lastTransitionAt,
      haltCount: entry.haltCount,
      rollbackCount: entry.rollbackCount,
    });
  }

  const activeDocTypes = entries.filter((e) => e.lifecycleState !== "OFF" && e.lifecycleState !== "SHADOW_ONLY").length;

  // Health indicator
  const hasSev0 = alerts.some((a) => a.severity === "SEV0" && !a.acknowledged);
  const hasSev1 = alerts.some((a) => a.severity === "SEV1" && !a.acknowledged);
  const reviewOverloaded = reviewStats.capacityPercent > 80;
  const healthIndicator = hasSev0 ? "RED" : (hasSev1 || reviewOverloaded || freezeWindows.length > 0) ? "YELLOW" : "GREEN";

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalDocTypes: entries.length,
      activeDocTypes,
      byState,
    },
    docTypes,
    reviewQueue: reviewStats,
    activeFreezeWindows: freezeWindows,
    recentAlerts: alerts.slice(0, 10).map((a) => ({
      severity: a.severity,
      eventType: a.eventType,
      documentType: a.documentType,
      timestamp: a.timestamp,
    })),
    healthIndicator,
  };
}

// ── Weekly Council Report ──

export interface WeeklyCouncilReport {
  reportId: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  portfolioHealth: "GREEN" | "YELLOW" | "RED";
  sections: {
    stateOverview: { documentType: string; state: LifecycleState; trend: string }[];
    promotionCandidates: { documentType: string; currentState: LifecycleState; readiness: string }[];
    incidentSummary: { count: number; sev0: number; sev1: number; sev2: number; sev3: number };
    reviewMetrics: {
      totalProcessed: number;
      avgResolutionHours: number;
      overdueCount: number;
      falseSafeCount: number;
    };
    rollbackHistory: { documentType: string; from: string; to: string; reason: string }[];
    recommendations: string[];
  };
}

/**
 * 주간 Council Report 생성
 */
export function generateWeeklyCouncilReport(): WeeklyCouncilReport {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  const entries = getAllRegistryEntries();
  const alerts = getAlertFeed({ limit: 1000 });
  const reviewStats = getReviewQueueStats();

  // Alert counts by severity
  const weekAlerts = alerts.filter((a) => new Date(a.timestamp) >= weekAgo);
  const sev0 = weekAlerts.filter((a) => a.severity === "SEV0").length;
  const sev1 = weekAlerts.filter((a) => a.severity === "SEV1").length;
  const sev2 = weekAlerts.filter((a) => a.severity === "SEV2").length;
  const sev3 = weekAlerts.filter((a) => a.severity === "SEV3").length;

  // Promotion candidates
  const promotionCandidates = entries
    .filter((e) => ["ACTIVE_5", "ACTIVE_25", "ACTIVE_50"].includes(e.lifecycleState))
    .map((e) => ({
      documentType: e.documentType,
      currentState: e.lifecycleState,
      readiness: e.haltCount === 0 ? "READY" : "NEEDS_REVIEW",
    }));

  // Recommendations
  const recommendations: string[] = [];
  if (sev0 > 0) recommendations.push("SEV0 인시던트 발생 — 원인 분석 및 재발 방지 조치 우선");
  if (reviewStats.overdue > 10) recommendations.push(`리뷰 백로그 과적(${reviewStats.overdue}건 초과) — 리뷰 인력 증원 검토`);
  if (promotionCandidates.filter((c) => c.readiness === "READY").length > 0) {
    recommendations.push("승격 준비 완료된 DocType 존재 — 다음 승격 일정 수립");
  }
  const firstState = getFirstDocTypeState();
  if (firstState?.lifecycleState === "FULL_ACTIVE_STABLE") {
    recommendations.push("First DocType STABLE — Second DocType 확장 검토 가능");
  }

  return {
    reportId: `WCR-${now.toISOString().slice(0, 10)}`,
    periodStart: weekAgo.toISOString(),
    periodEnd: now.toISOString(),
    generatedAt: now.toISOString(),
    portfolioHealth: sev0 > 0 ? "RED" : sev1 > 0 ? "YELLOW" : "GREEN",
    sections: {
      stateOverview: entries.map((e) => ({
        documentType: e.documentType,
        state: e.lifecycleState,
        trend: e.lifecycleState === "FULL_ACTIVE_STABLE" ? "STABLE" : "ACTIVE",
      })),
      promotionCandidates,
      incidentSummary: { count: weekAlerts.length, sev0, sev1, sev2, sev3 },
      reviewMetrics: {
        totalProcessed: reviewStats.resolved,
        avgResolutionHours: reviewStats.avgResolutionHours,
        overdueCount: reviewStats.overdue,
        falseSafeCount: 0, // would come from DB query in production
      },
      rollbackHistory: [], // would come from audit log in production
      recommendations,
    },
  };
}

// ── Daily Ops Summary ──

export interface DailyOpsSummary {
  date: string;
  alertCount: number;
  reviewsProcessed: number;
  reviewsPending: number;
  promotionsRequested: number;
  rollbacksExecuted: number;
  autoVerifyDecisions: number;
  status: "NORMAL" | "ELEVATED" | "CRITICAL";
}

export function generateDailyOpsSummary(): DailyOpsSummary {
  const alerts = getAlertFeed({ limit: 500 });
  const reviewStats = getReviewQueueStats();
  const today = new Date().toISOString().slice(0, 10);

  const todayAlerts = alerts.filter((a) => a.timestamp.startsWith(today));
  const hasCritical = todayAlerts.some((a) => a.severity === "SEV0" || a.severity === "SEV1");

  return {
    date: today,
    alertCount: todayAlerts.length,
    reviewsProcessed: reviewStats.resolved,
    reviewsPending: reviewStats.open + reviewStats.inProgress,
    promotionsRequested: 0, // would come from approval store
    rollbacksExecuted: 0, // would come from audit log
    autoVerifyDecisions: 0, // would come from comparison log
    status: hasCritical ? "CRITICAL" : todayAlerts.length > 5 ? "ELEVATED" : "NORMAL",
  };
}
