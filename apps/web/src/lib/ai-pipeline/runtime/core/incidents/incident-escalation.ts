/**
 * S2 — Incident Escalation
 *
 * containment/rollback 실패 시 incident 승격.
 * incident 상태에서는 active runtime 정상 복귀 금지.
 */

import { randomUUID } from "crypto";
import { emitStabilizationAuditEvent } from "../audit/audit-events";

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
    return true;
  }
  return false;
}

/** 테스트용 */
export function _resetIncidents(): void {
  _incidents.length = 0;
}
