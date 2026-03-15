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
import { logBridgeFailure } from "../persistence/bridge-logger";
import { StabilizationAuditOntologyAdapter } from "../ontology/stabilization-audit-adapter";
import { emitDiagnostic } from "../ontology/diagnostics";

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

  // Dual-write: repository first via ontology adapter (fire-and-forget), then legacy store
  try {
    const adapters = getPersistenceAdapters();
    const canonical = StabilizationAuditOntologyAdapter.fromLegacy(event);
    const input = StabilizationAuditOntologyAdapter.toRepositoryInput(canonical);
    adapters.stabilizationAudit.appendAuditEvent(input).catch(function (err: unknown) {
      logBridgeFailure("audit-events", "appendAuditEvent", err);
    });
  } catch (err) {
    logBridgeFailure("audit-events", "appendAuditEvent-bootstrap", err);
  }

  _auditEvents.push(event);
  return event;
}

/** @deprecated Use getAuditEventsFromRepo — legacy sync compat */
export function getAuditEvents(filter?: { eventType?: StabilizationAuditEventType; documentType?: string }): StabilizationAuditEvent[] {
  emitDiagnostic(
    "LEGACY_SYNC_COMPAT_PATH_USED",
    "audit-events", "stabilization-audit-adapter", "stabilization-audit",
    "legacy_to_canonical", "getAuditEvents:sync-compat",
    {}
  );
  if (!filter) return [..._auditEvents];

  return _auditEvents.filter((e: StabilizationAuditEvent) => {
    if (filter.eventType && e.eventType !== filter.eventType) return false;
    if (filter.documentType && e.documentType !== filter.documentType) return false;
    return true;
  });
}

// ── Repository-First Async Read ──

/**
 * Repository-first read with legacy fallback.
 * Maps PersistedStabilizationAuditEvent → StabilizationAuditEvent.
 */
export async function getAuditEventsFromRepo(
  filter?: { eventType?: StabilizationAuditEventType }
): Promise<StabilizationAuditEvent[]> {
  try {
    const adapters = getPersistenceAdapters();
    const result = filter && filter.eventType
      ? await adapters.stabilizationAudit.listAuditEventsByEventType(filter.eventType, { limit: 1000 })
      : await adapters.stabilizationAudit.listAuditEventsByCorrelationId("", { limit: 1000 });
    if (result.ok) {
      return result.data.items.map(function (d) {
        const canonical = StabilizationAuditOntologyAdapter.fromPersisted(d);
        return StabilizationAuditOntologyAdapter.toLegacy(canonical);
      });
    }
  } catch (err) {
    logBridgeFailure("audit-events", "getAuditEventsFromRepo", err);
  }
  // REPO_ONLY (P4-2): no fallback — deterministic empty with diagnostic
  emitDiagnostic(
    "REPO_ONLY_PATH_ENFORCED",
    "audit-events", "stabilization-audit-adapter", "stabilization-audit",
    "repository_to_canonical", "getAuditEventsFromRepo:repo-only-empty",
    { fallbackUsed: false }
  );
  return [];
}

// ── Direct Access Shutdown Guardrail (P3-5) ──

export function _assertNoDirectStoreAccess(caller: string): void {
  emitDiagnostic(
    "LEGACY_DIRECT_ACCESS_BLOCKED",
    "audit-events", "stabilization-audit-adapter", "stabilization-audit",
    "legacy_to_canonical", "_assertNoDirectStoreAccess:" + caller,
    { entityId: caller }
  );
  throw new Error(`DIRECT_STORE_ACCESS_BLOCKED: ${caller} must use repo-first API`);
}

/** 테스트용 — 상태 리셋 */
export function _resetAuditEvents(): void {
  _auditEvents.length = 0;
}
