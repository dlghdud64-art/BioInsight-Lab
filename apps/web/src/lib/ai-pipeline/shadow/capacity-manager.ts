// @ts-nocheck — shadow pipeline: experimental code, type-check deferred
/**
 * Expansion Capacity Manager — 운영 용량 정량화
 *
 * Review Queue 잔여량, Open Incident 수, 최근 Rollback 횟수,
 * On-call 인력 상태를 수합하여 포트폴리오 용량 상태를 판정합니다.
 *
 * CAPACITY_OK: 정상 확장 가능
 * CAPACITY_TIGHT: 소규모/Low-risk만 허용
 * CAPACITY_BLOCKED: 전면 동결
 */

import { getReviewQueueStats } from "./review-ops-queue";
import { getAlertFeed } from "./alerting-service";
import { getAllRegistryEntries } from "./doctype-registry";

export type CapacityStatus = "CAPACITY_OK" | "CAPACITY_TIGHT" | "CAPACITY_BLOCKED";

export interface CapacityInput {
  reviewQueueCapacityPercent: number;
  reviewQueueOverdueCount: number;
  openIncidentCount: number;       // unacknowledged SEV0/SEV1
  recentRollbackCount: number;     // last 7 days
  oncallAvailable: boolean;
  oncallOverloaded: boolean;       // on-call handling 2+ incidents
  activeFreezeWindowExists: boolean;
}

export interface CapacityAssessment {
  status: CapacityStatus;
  score: number; // 0~100, lower = worse
  factors: { name: string; impact: string; value: number | boolean }[];
  allowedActions: string[];
  blockedActions: string[];
}

/**
 * 운영 용량 평가
 */
export function assessCapacity(input: CapacityInput): CapacityAssessment {
  const factors: CapacityAssessment["factors"] = [];
  let score = 100;

  // Freeze window = immediate block
  if (input.activeFreezeWindowExists) {
    factors.push({ name: "freezeWindow", impact: "BLOCKED", value: true });
    return {
      status: "CAPACITY_BLOCKED",
      score: 0,
      factors,
      allowedActions: ["MONITOR", "ROLLBACK"],
      blockedActions: ["PROMOTE", "LAUNCH", "ENABLE_AUTO_VERIFY"],
    };
  }

  // Review queue capacity
  if (input.reviewQueueCapacityPercent > 90) {
    score -= 40;
    factors.push({ name: "reviewQueueOverflow", impact: "CRITICAL", value: input.reviewQueueCapacityPercent });
  } else if (input.reviewQueueCapacityPercent > 70) {
    score -= 20;
    factors.push({ name: "reviewQueueHigh", impact: "HIGH", value: input.reviewQueueCapacityPercent });
  } else if (input.reviewQueueCapacityPercent > 50) {
    score -= 10;
    factors.push({ name: "reviewQueueModerate", impact: "MEDIUM", value: input.reviewQueueCapacityPercent });
  }

  // Overdue reviews
  if (input.reviewQueueOverdueCount > 20) {
    score -= 25;
    factors.push({ name: "overdueBacklog", impact: "CRITICAL", value: input.reviewQueueOverdueCount });
  } else if (input.reviewQueueOverdueCount > 10) {
    score -= 15;
    factors.push({ name: "overdueBacklog", impact: "HIGH", value: input.reviewQueueOverdueCount });
  }

  // Open incidents
  if (input.openIncidentCount > 0) {
    score -= input.openIncidentCount * 15;
    factors.push({ name: "openIncidents", impact: "CRITICAL", value: input.openIncidentCount });
  }

  // Recent rollbacks
  if (input.recentRollbackCount >= 3) {
    score -= 30;
    factors.push({ name: "frequentRollbacks", impact: "CRITICAL", value: input.recentRollbackCount });
  } else if (input.recentRollbackCount >= 1) {
    score -= 10;
    factors.push({ name: "recentRollback", impact: "MEDIUM", value: input.recentRollbackCount });
  }

  // On-call status
  if (!input.oncallAvailable) {
    score -= 30;
    factors.push({ name: "noOncall", impact: "CRITICAL", value: false });
  } else if (input.oncallOverloaded) {
    score -= 15;
    factors.push({ name: "oncallOverloaded", impact: "HIGH", value: true });
  }

  score = Math.max(score, 0);

  let status: CapacityStatus;
  let allowedActions: string[];
  let blockedActions: string[];

  if (score >= 60) {
    status = "CAPACITY_OK";
    allowedActions = ["PROMOTE", "LAUNCH", "ENABLE_AUTO_VERIFY", "MONITOR", "ROLLBACK"];
    blockedActions = [];
  } else if (score >= 30) {
    status = "CAPACITY_TIGHT";
    allowedActions = ["PROMOTE_LOW_RISK", "MONITOR", "ROLLBACK"];
    blockedActions = ["LAUNCH_HIGH_RISK", "ENABLE_AUTO_VERIFY"];
  } else {
    status = "CAPACITY_BLOCKED";
    allowedActions = ["MONITOR", "ROLLBACK"];
    blockedActions = ["PROMOTE", "LAUNCH", "ENABLE_AUTO_VERIFY"];
  }

  return { status, score, factors, allowedActions, blockedActions };
}

/**
 * 자동 용량 수합 — 현재 시스템 상태에서 CapacityInput 생성
 */
export function collectCapacityInput(params: {
  oncallAvailable: boolean;
  oncallOverloaded?: boolean;
  activeFreezeWindowExists?: boolean;
}): CapacityInput {
  const reviewStats = getReviewQueueStats();
  const alerts = getAlertFeed({ limit: 100 });
  const entries = getAllRegistryEntries();

  const openIncidents = alerts.filter(
    (a) => !a.acknowledged && (a.severity === "SEV0" || a.severity === "SEV1"),
  ).length;

  const recentRollbacks = entries.reduce((sum, e) => sum + e.rollbackCount, 0);

  return {
    reviewQueueCapacityPercent: reviewStats.capacityPercent,
    reviewQueueOverdueCount: reviewStats.overdue,
    openIncidentCount: openIncidents,
    recentRollbackCount: recentRollbacks,
    oncallAvailable: params.oncallAvailable,
    oncallOverloaded: params.oncallOverloaded ?? false,
    activeFreezeWindowExists: params.activeFreezeWindowExists ?? false,
  };
}
