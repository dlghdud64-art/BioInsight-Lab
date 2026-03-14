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
import { getPersistenceAdapters } from "../persistence";

// ── In-memory audit store (legacy — kept for backward compatibility) ──
// TODO(Slice-1F): remove legacy store, read from repository directly

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

  // Dual-write: repository first (fire-and-forget), then legacy store
  try {
    const adapters = getPersistenceAdapters();
    adapters.stabilizationAudit.appendAuditEvent({
      eventId: event.eventId,
      eventType: event.eventType,
      correlationId: event.correlationId,
      incidentId: null,
      baselineId: event.baselineId || null,
      snapshotId: event.snapshotId || null,
      actor: event.performedBy || null,
      reasonCode: event.detail || null,
      severity: null,
      sourceModule: null,
      entityType: null,
      entityId: null,
      resultStatus: null,
      occurredAt: event.timestamp,
    }).catch(function () {
      // bridge phase: repository write failure is non-fatal
    });
  } catch (_bridgeErr) {
    // bootstrap not ready yet — legacy path covers this
    // TODO(Slice-1F): remove legacy store, read from repository directly
  }

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
