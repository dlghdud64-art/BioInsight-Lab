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
import { normalizeDate } from "../persistence/date-normalizer";

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

  // Dual-write: persist to repository (fire-and-forget)
  try {
    const adapters = getPersistenceAdapters();
    adapters.incident.createIncident({
      incidentId: record.incidentId,
      reasonCode: record.reasonCode,
      severity: "WARNING",
      status: "OPEN",
      correlationId: record.correlationId,
      baselineId: null,
      snapshotId: null,
    }).catch(function (err: unknown) {
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

export function getIncidents(): IncidentRecord[] {
  return [..._incidents];
}

export function hasUnacknowledgedIncidents(): boolean {
  return _incidents.some((i: IncidentRecord) => !i.acknowledged);
}

export function acknowledgeIncident(incidentId: string): boolean {
  const incident = _incidents.find((i: IncidentRecord) => i.incidentId === incidentId);
  if (incident) {
    incident.acknowledged = true;

    // Dual-write: persist acknowledgement to repository (fire-and-forget)
    try {
      const adapters = getPersistenceAdapters();
      adapters.incident.findIncidentByIncidentId(incidentId).then(function (result) {
        if (result.ok) {
          adapters.incident.acknowledgeIncident(
            incidentId,
            "system",
            result.data.updatedAt
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
        return {
          incidentId: d.incidentId,
          reasonCode: d.reasonCode,
          correlationId: d.correlationId,
          actor: d.acknowledgedBy || "system",
          detail: "",
          escalatedAt: normalizeDate(d.createdAt),
          acknowledged: d.status !== "OPEN",
        };
      });
    }
  } catch (err) {
    logBridgeFailure("incident-escalation", "getIncidentsFromRepo", err);
  }
  // Fallback to legacy store
  return [..._incidents];
}

/** 테스트용 */
export function _resetIncidents(): void {
  _incidents.length = 0;
}
