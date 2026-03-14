/**
 * S0 — Audit Events (Stabilization Seed)
 *
 * 모든 이벤트에 baselineId, baselineVersion, baselineHash, snapshotId, correlationId 포함
 */

import { randomUUID } from "crypto";
import type {
  StabilizationAuditEvent,
  StabilizationAuditEventType,
} from "../../types/stabilization";

// ── In-memory audit store (production에서는 DB) ──

const _auditEvents: StabilizationAuditEvent[] = [];

export interface EmitAuditEventInput {
  eventType: StabilizationAuditEventType;
  baselineId: string;
  baselineVersion: string;
  baselineHash: string;
  snapshotId: string;
  correlationId: string;
  documentType: string;
  performedBy: string;
  detail: string;
}

/** audit event 기록 */
export function emitStabilizationAuditEvent(input: EmitAuditEventInput): StabilizationAuditEvent {
  const event: StabilizationAuditEvent = {
    eventId: randomUUID(),
    eventType: input.eventType,
    baselineId: input.baselineId,
    baselineVersion: input.baselineVersion,
    baselineHash: input.baselineHash,
    snapshotId: input.snapshotId,
    correlationId: input.correlationId,
    documentType: input.documentType,
    performedBy: input.performedBy,
    detail: input.detail,
    timestamp: new Date(),
  };

  _auditEvents.push(event);
  return event;
}

/** audit event 조회 */
export function getAuditEvents(filter?: { eventType?: StabilizationAuditEventType; documentType?: string }): StabilizationAuditEvent[] {
  if (!filter) return [..._auditEvents];

  return _auditEvents.filter((e: StabilizationAuditEvent) => {
    if (filter.eventType && e.eventType !== filter.eventType) return false;
    if (filter.documentType && e.documentType !== filter.documentType) return false;
    return true;
  });
}

/** 테스트용 — 상태 리셋 */
export function _resetAuditEvents(): void {
  _auditEvents.length = 0;
}
