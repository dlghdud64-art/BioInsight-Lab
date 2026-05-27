/**
 * Business Operating Views & Observability — 업무 리더 대시보드 데이터 모델
 *
 * 단순 기술 로그(API 200/500)가 아닌,
 * 비즈니스 관점의 대시보드 데이터를 추출합니다.
 */

import { getSystemHealthSummary } from "./system-registry";
import { getReconciliationStats } from "./reconciliation-engine";
import { getEventLog, getDeadLetterQueue } from "./event-bus-contracts";

// ── Procurement Operations View ──

export interface ProcurementOpsView {
  generatedAt: string;
  totalDocumentsProcessed: number;
  matchedToPO: number;
  unmatchedDocuments: number;
  pendingVendorMapping: number;
  blockedReasons: { reason: string; count: number }[];
  avgMatchLatencyMs: number;
}

/**
 * 구매 운영 뷰 데이터 — 구매 차단 사유 등
 */
export function getProcurementOpsView(): ProcurementOpsView {
  // Production: DB 쿼리로 실제 데이터 수집
  return {
    generatedAt: new Date().toISOString(),
    totalDocumentsProcessed: 0,
    matchedToPO: 0,
    unmatchedDocuments: 0,
    pendingVendorMapping: 0,
    blockedReasons: [],
    avgMatchLatencyMs: 0,
  };
}

// ── Finance Evidence View ──

export interface FinanceEvidenceView {
  generatedAt: string;
  totalInvoicesVerified: number;
  autoVerifiedCount: number;
  manualReviewCount: number;
  pendingBudgetApproval: number;
  budgetBreachCount: number;
  evidenceChainsSealed: number;
  evidenceChainsOpen: number;
}

export function getFinanceEvidenceView(): FinanceEvidenceView {
  return {
    generatedAt: new Date().toISOString(),
    totalInvoicesVerified: 0,
    autoVerifiedCount: 0,
    manualReviewCount: 0,
    pendingBudgetApproval: 0,
    budgetBreachCount: 0,
    evidenceChainsSealed: 0,
    evidenceChainsOpen: 0,
  };
}

// ── Integration KPI/SLA Metrics ──

export interface IntegrationKPIMetrics {
  generatedAt: string;
  systemHealth: {
    total: number;
    healthy: number;
    degraded: number;
    down: number;
  };
  reconciliation: {
    total: number;
    matched: number;
    mismatched: number;
    retryPending: number;
    escalated: number;
  };
  eventBus: {
    totalEvents: number;
    deadLetterCount: number;
    avgEventLagMs: number;
  };
  slaCompliance: {
    uptimePercent: number;
    reconciliationSlaMetPercent: number;
    eventDeliverySuccessPercent: number;
  };
}

/**
 * 전사 생태계 연동 건강 상태 KPI/SLA 집계
 */
export function getIntegrationKPIMetrics(): IntegrationKPIMetrics {
  const systemHealth = getSystemHealthSummary();
  const reconciliation = getReconciliationStats();
  const events = getEventLog(1000);
  const dlq = getDeadLetterQueue();

  const totalEvents = events.length;
  const deliveredEvents = totalEvents - dlq.length;

  return {
    generatedAt: new Date().toISOString(),
    systemHealth: {
      total: systemHealth.total,
      healthy: systemHealth.healthy,
      degraded: systemHealth.degraded,
      down: systemHealth.down,
    },
    reconciliation: {
      total: reconciliation.total,
      matched: reconciliation.matched,
      mismatched: reconciliation.mismatched,
      retryPending: reconciliation.retryPending,
      escalated: reconciliation.escalated,
    },
    eventBus: {
      totalEvents,
      deadLetterCount: dlq.length,
      avgEventLagMs: 0, // production: computed from event timestamps
    },
    slaCompliance: {
      uptimePercent: systemHealth.total > 0
        ? Math.round((systemHealth.healthy / systemHealth.total) * 100)
        : 100,
      reconciliationSlaMetPercent: reconciliation.total > 0
        ? Math.round((reconciliation.matched / reconciliation.total) * 100)
        : 100,
      eventDeliverySuccessPercent: totalEvents > 0
        ? Math.round((deliveredEvents / totalEvents) * 100)
        : 100,
    },
  };
}
