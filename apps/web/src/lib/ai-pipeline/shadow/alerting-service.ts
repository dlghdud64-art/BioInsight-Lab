/**
 * Alerting Service — 구조화된 운영 이벤트 알림
 *
 * 이벤트 유형별 severity, impact, recommendedAction 포함.
 * control plane에서 1급 개념으로 사용.
 */

import type { CanaryStage } from "./types";
import type { LifecycleState } from "./rollout-state-machine";

// ── Alert Event Types ──

export const ALERT_EVENT_TYPES = [
  "INVARIANT_VIOLATION",
  "UNKNOWN_AUTO_VERIFY_ATTEMPT",
  "CONFIRMED_FALSE_SAFE",
  "CRITICAL_FIELD_CONFLICT_SPIKE",
  "SCHEMA_INVALID_SPIKE",
  "TIMEOUT_PROVIDER_SPIKE",
  "FALLBACK_SPIKE",
  "ANOMALY_CLUSTER_GROWTH",
  "RESTRICTED_AUTO_VERIFY_KILL",
  "ROLLBACK_TRIGGERED",
  "APPROVAL_PENDING_TOO_LONG",
  "CERTIFICATION_FAILED",
  "STABILIZATION_DEGRADING",
] as const;

export type AlertEventType = (typeof ALERT_EVENT_TYPES)[number];

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  documentType: string;
  stage: LifecycleState;
  eventType: AlertEventType;
  impact: string;
  recommendedAction: string;
  sampleIds: string[];
  triggeredAt: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

// In-memory alert feed (production: event queue / DB)
const alertFeed: Alert[] = [];
let alertIdCounter = 0;

/**
 * Alert 발행
 */
export function emitAlert(params: {
  severity: AlertSeverity;
  documentType: string;
  stage: LifecycleState;
  eventType: AlertEventType;
  impact: string;
  recommendedAction: string;
  sampleIds?: string[];
}): Alert {
  const alert: Alert = {
    id: `alert-${++alertIdCounter}`,
    severity: params.severity,
    documentType: params.documentType,
    stage: params.stage,
    eventType: params.eventType,
    impact: params.impact,
    recommendedAction: params.recommendedAction,
    sampleIds: params.sampleIds ?? [],
    triggeredAt: new Date().toISOString(),
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null,
  };

  alertFeed.push(alert);

  // Console log for observability
  console.error(
    `[ALERT] ${alert.severity} | ${alert.documentType} (${alert.stage}) | ${alert.eventType} | ${alert.impact}`,
  );

  return alert;
}

/**
 * Alert acknowledge
 */
export function acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
  const alert = alertFeed.find((a) => a.id === alertId);
  if (!alert) return false;
  alert.acknowledged = true;
  alert.acknowledgedBy = acknowledgedBy;
  alert.acknowledgedAt = new Date().toISOString();
  return true;
}

/**
 * Alert feed 조회
 */
export function getAlertFeed(params?: {
  documentType?: string;
  severity?: AlertSeverity;
  acknowledged?: boolean;
  limit?: number;
}): Alert[] {
  let results = [...alertFeed];

  if (params?.documentType) {
    results = results.filter((a) => a.documentType === params.documentType);
  }
  if (params?.severity) {
    results = results.filter((a) => a.severity === params.severity);
  }
  if (params?.acknowledged !== undefined) {
    results = results.filter((a) => a.acknowledged === params.acknowledged);
  }

  results.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());

  return results.slice(0, params?.limit ?? 50);
}

// ── Convenience Emitters ──

export function alertInvariantViolation(
  documentType: string, stage: LifecycleState, category: string, requestIds: string[],
): Alert {
  return emitAlert({
    severity: "CRITICAL",
    documentType,
    stage,
    eventType: "INVARIANT_VIOLATION",
    impact: `${category} 위반 — 즉시 강등 필요`,
    recommendedAction: "ROLLBACK_TO_SHADOW",
    sampleIds: requestIds,
  });
}

export function alertFalseSafe(
  documentType: string, stage: LifecycleState, count: number, requestIds: string[],
): Alert {
  return emitAlert({
    severity: "CRITICAL",
    documentType,
    stage,
    eventType: "CONFIRMED_FALSE_SAFE",
    impact: `False-safe ${count}건 — auto-verify 즉시 비활성 필요`,
    recommendedAction: "RESTRICTED_AUTO_VERIFY_KILL",
    sampleIds: requestIds,
  });
}

export function alertRollback(
  documentType: string, from: LifecycleState, to: LifecycleState, reason: string,
): Alert {
  return emitAlert({
    severity: "HIGH",
    documentType,
    stage: from,
    eventType: "ROLLBACK_TRIGGERED",
    impact: `${from} → ${to} 롤백: ${reason}`,
    recommendedAction: "INVESTIGATE_AND_STABILIZE",
  });
}

export function alertApprovalPending(
  documentType: string, stage: LifecycleState, pendingSinceHours: number,
): Alert {
  return emitAlert({
    severity: pendingSinceHours > 24 ? "HIGH" : "MEDIUM",
    documentType,
    stage,
    eventType: "APPROVAL_PENDING_TOO_LONG",
    impact: `승인 대기 ${pendingSinceHours.toFixed(0)}시간`,
    recommendedAction: "REVIEW_AND_APPROVE_OR_REJECT",
  });
}
