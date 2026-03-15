/**
 * S2 — Incident Escalation
 *
 * containment/rollback 실패 시 incident 승격.
 * incident 상태에서는 active runtime 정상 복귀 금지.
 */

import { randomUUID } from "crypto";
import { emitStabilizationAuditEvent } from "../audit/audit-events";
import { getPersistenceAdapters } from "../persistence";
import { logBridgeFailure } from "../persistence/bridge-logger";
import { withLock, incidentStreamLockKey } from "../persistence/lock-manager";
import { IncidentOntologyAdapter } from "../ontology/incident-adapter";
import { emitDiagnostic } from "../ontology/diagnostics";

export interface IncidentRecord {
  incidentId: string;
  reasonCode: string;
  correlationId: string;
  actor: string;
  detail: string;
  escalatedAt: Date;
  acknowledged: boolean;
}

const _incidents: IncidentRecord[] = [];

export function escalateIncident(
  reasonCode: string,
  correlationId: string,
  actor: string,
  detail: string
): IncidentRecord {
  const record: IncidentRecord = {
    incidentId: `incident-${randomUUID().slice(0, 8)}`,
    reasonCode,
    correlationId,
    actor,
    detail,
    escalatedAt: new Date(),
    acknowledged: false,
  };

  _incidents.push(record);

  // Dual-write: persist to repository via ontology adapter (fire-and-forget)
  try {
    const adapters = getPersistenceAdapters();
    const canonical = IncidentOntologyAdapter.fromLegacy(record);
    const input = IncidentOntologyAdapter.toRepositoryInput(canonical);
    adapters.incident.createIncident(input).catch(function (err: unknown) {
      logBridgeFailure("incident-escalation", "createIncident", err);
    });
  } catch (err) {
    logBridgeFailure("incident-escalation", "createIncident-bootstrap", err);
  }

  emitStabilizationAuditEvent({
    eventType: "INCIDENT_ESCALATED",
    baselineId: "",
    baselineVersion: "",
    baselineHash: "",
    snapshotId: "",
    correlationId,
    documentType: "",
    performedBy: actor,
    detail: `${reasonCode}: ${detail}`,
  });

  return record;
}

/**
 * P1-2: Async version with distributed lock on incident stream.
 * Prevents concurrent escalation on the same correlationId.
 */
export async function escalateIncidentAsync(
  reasonCode: string,
  correlationId: string,
  actor: string,
  detail: string
): Promise<{ record: IncidentRecord | null; lockBlocked: boolean; reason?: string }> {
  const lockResult = await withLock(
    incidentStreamLockKey(correlationId),
    actor,
    "INCIDENT_STREAM",
    "incident-escalation",
    correlationId,
    15_000, // 15s TTL
    async function () {
      return escalateIncident(reasonCode, correlationId, actor, detail);
    }
  );

  if (!lockResult.acquired) {
    return {
      record: null,
      lockBlocked: true,
      reason: `INCIDENT_STREAM_LOCK_REQUIRED: ${lockResult.message}`,
    };
  }

  return { record: lockResult.data, lockBlocked: false };
}

/** @deprecated RETAINED in P4-4 — use getIncidentsFromRepo. Removal: P5 */
export function getIncidents(): IncidentRecord[] {
  emitDiagnostic(
    "LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON",
    "incident-escalation", "incident-adapter", "incident",
    "legacy_to_canonical", "getIncidents:sync-compat",
    { retentionReason: "4 legacy test suites depend on sync API", shutdownPhase: "P5" }
  );
  return [..._incidents];
}

/** @deprecated RETAINED in P4-4 — use hasUnacknowledgedIncidentsFromRepo. Removal: P5 */
export function hasUnacknowledgedIncidents(): boolean {
  emitDiagnostic(
    "LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON",
    "incident-escalation", "incident-adapter", "incident",
    "legacy_to_canonical", "hasUnacknowledgedIncidents:sync-compat",
    { retentionReason: "4 production callers (preconditions, startup, lock-hygiene)", shutdownPhase: "P5" }
  );
  return _incidents.some((i: IncidentRecord) => !i.acknowledged);
}

/** @deprecated Prefer acknowledgeIncidentAsync for repo-first deterministic ack */
export function acknowledgeIncident(incidentId: string): boolean {
  emitDiagnostic(
    "INCIDENT_ACK_DELAY_DIAGNOSTIC",
    "incident-escalation", "incident-adapter", "incident",
    "legacy_to_canonical", "acknowledgeIncident:fire-and-forget",
    { entityId: incidentId, fallbackUsed: false, reasonCode: "FIRE_AND_FORGET_ACK" }
  );
  const incident = _incidents.find((i: IncidentRecord) => i.incidentId === incidentId);
  if (incident) {
    incident.acknowledged = true;

    // Dual-write: persist acknowledgement to repository (fire-and-forget)
    try {
      const adapters = getPersistenceAdapters();
      adapters.incident.findIncidentByIncidentId(incidentId).then(function (result) {
        if (result.ok) {
          const updatedAt = result.data.updatedAt instanceof Date
            ? result.data.updatedAt
            : new Date(result.data.updatedAt as unknown as string);
          adapters.incident.acknowledgeIncident(
            incidentId,
            "system",
            updatedAt
          ).catch(function (err: unknown) {
            logBridgeFailure("incident-escalation", "acknowledgeIncident", err);
          });
        }
      }).catch(function (err: unknown) {
        logBridgeFailure("incident-escalation", "findIncidentForAck", err);
      });
    } catch (err) {
      logBridgeFailure("incident-escalation", "acknowledgeIncident-bootstrap", err);
    }

    return true;
  }
  return false;
}

// ── Repository-First Async Ack (P4-4) ──

/**
 * Repo-first deterministic acknowledgement.
 * Awaits repo write before memory update — no fire-and-forget gap.
 */
export async function acknowledgeIncidentAsync(incidentId: string): Promise<{
  success: boolean;
  repoWriteMs: number;
  diagnostic: string;
}> {
  const start = Date.now();
  try {
    const adapters = getPersistenceAdapters();
    const findResult = await adapters.incident.findIncidentByIncidentId(incidentId);
    if (!findResult.ok) {
      emitDiagnostic(
        "INCIDENT_ACK_DELAY_DIAGNOSTIC",
        "incident-escalation", "incident-adapter", "incident",
        "repository_to_canonical", "acknowledgeIncidentAsync:not-found",
        { entityId: incidentId, fallbackUsed: false, reasonCode: "INCIDENT_NOT_FOUND_IN_REPO" }
      );
      return { success: false, repoWriteMs: Date.now() - start, diagnostic: "INCIDENT_NOT_FOUND_IN_REPO" };
    }
    const updatedAt = findResult.data.updatedAt instanceof Date
      ? findResult.data.updatedAt
      : new Date(findResult.data.updatedAt as unknown as string);
    const ackResult = await adapters.incident.acknowledgeIncident(incidentId, "system", updatedAt);
    if (!ackResult.ok) {
      emitDiagnostic(
        "INCIDENT_ACK_DELAY_DIAGNOSTIC",
        "incident-escalation", "incident-adapter", "incident",
        "repository_to_canonical", "acknowledgeIncidentAsync:repo-ack-failed",
        { entityId: incidentId, fallbackUsed: false, reasonCode: "REPO_ACK_FAILED" }
      );
      return { success: false, repoWriteMs: Date.now() - start, diagnostic: "REPO_ACK_FAILED" };
    }
    // Memory update AFTER repo success (repo-first)
    const incident = _incidents.find((i: IncidentRecord) => i.incidentId === incidentId);
    if (incident) {
      incident.acknowledged = true;
    }
    emitDiagnostic(
      "INCIDENT_ACK_TIMING_GAP_REDUCED",
      "incident-escalation", "incident-adapter", "incident",
      "repository_to_canonical", "acknowledgeIncidentAsync:success",
      { entityId: incidentId, fallbackUsed: false, reasonCode: "ACK_REPO_FIRST" }
    );
    return { success: true, repoWriteMs: Date.now() - start, diagnostic: "ACK_REPO_FIRST" };
  } catch (err) {
    logBridgeFailure("incident-escalation", "acknowledgeIncidentAsync", err);
    emitDiagnostic(
      "INCIDENT_ACK_DELAY_DIAGNOSTIC",
      "incident-escalation", "incident-adapter", "incident",
      "repository_to_canonical", "acknowledgeIncidentAsync:error",
      { entityId: incidentId, fallbackUsed: false, reasonCode: "ACK_ERROR" }
    );
    return { success: false, repoWriteMs: Date.now() - start, diagnostic: "ACK_ERROR" };
  }
}

// ── Repository-First Async Read ──

/**
 * Repository-first read with legacy fallback.
 * Maps PersistedIncident → IncidentRecord with Date normalization.
 */
export async function getIncidentsFromRepo(): Promise<IncidentRecord[]> {
  try {
    const adapters = getPersistenceAdapters();
    const result = await adapters.incident.listOpenIncidents({ limit: 1000 });
    if (result.ok) {
      return result.data.items.map(function (d) {
        const canonical = IncidentOntologyAdapter.fromPersisted(d);
        return IncidentOntologyAdapter.toLegacy(canonical);
      });
    }
  } catch (err) {
    logBridgeFailure("incident-escalation", "getIncidentsFromRepo", err);
  }
  // REPO_ONLY (P4-2): no fallback — deterministic empty with diagnostic
  emitDiagnostic(
    "REPO_ONLY_PATH_ENFORCED",
    "incident-escalation", "incident-adapter", "incident",
    "repository_to_canonical", "getIncidentsFromRepo:repo-only-empty",
    { fallbackUsed: false }
  );
  return [];
}

// ── Repository-First Async Unacknowledged Check (P3-5) ──

export async function hasUnacknowledgedIncidentsFromRepo(): Promise<boolean> {
  emitDiagnostic(
    "CONSUMER_CUTOVER_APPLIED",
    "incident-escalation", "incident-adapter", "incident",
    "repository_to_canonical", "hasUnacknowledgedIncidentsFromRepo:entry",
    {}
  );
  const incidents = await getIncidentsFromRepo();
  return incidents.some(function (i) { return !i.acknowledged; });
}

// ── Direct Access Shutdown Guardrail (P3-5) ──

export function _assertNoDirectStoreAccess(caller: string): void {
  emitDiagnostic(
    "LEGACY_DIRECT_ACCESS_BLOCKED",
    "incident-escalation", "incident-adapter", "incident",
    "legacy_to_canonical", "_assertNoDirectStoreAccess:" + caller,
    { entityId: caller }
  );
  throw new Error(`DIRECT_STORE_ACCESS_BLOCKED: ${caller} must use repo-first API`);
}

/** 테스트용 */
export function _resetIncidents(): void {
  _incidents.length = 0;
}
