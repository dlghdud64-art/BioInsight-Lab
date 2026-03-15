/**
 * P1 Closeout — Recovery Canonical Bridge
 *
 * Bridges recovery events into the canonical audit log so that
 * buildTimeline() can reconstruct recovery flows.
 */

import { createCanonicalEvent, writeCanonicalAudit } from "../observability/canonical-event-schema";
import { logBridgeFailure } from "../persistence/bridge-logger";
import type { RecoveryRecord } from "./recovery-types";
import type { EventSeverity, EventResultStatus } from "../observability/canonical-event-schema";

function mapResultStatus(eventType: string): EventResultStatus {
  switch (eventType) {
    case "INCIDENT_LOCKDOWN_RECOVERY_REQUESTED": return "STARTED";
    case "INCIDENT_LOCKDOWN_RECOVERY_VALIDATED": return "ACCEPTED";
    case "INCIDENT_LOCKDOWN_RECOVERY_EXECUTING": return "STARTED";
    case "INCIDENT_LOCKDOWN_RECOVERY_VERIFIED":  return "COMPLETED";
    case "INCIDENT_LOCKDOWN_RECOVERY_RESTORED":  return "COMPLETED";
    case "INCIDENT_LOCKDOWN_RECOVERY_FAILED":    return "FAILED";
    case "INCIDENT_LOCKDOWN_RECOVERY_ESCALATED": return "ESCALATED";
    case "INCIDENT_LOCKDOWN_RECOVERY_DENIED":    return "DENIED";
    case "INCIDENT_LOCKDOWN_RECOVERY_OVERRIDE":  return "ACCEPTED";
    default: return "STARTED";
  }
}

function mapSeverity(eventType: string): EventSeverity {
  if (eventType.includes("FAILED")) return "ERROR";
  if (eventType.includes("ESCALATED")) return "CRITICAL";
  if (eventType.includes("OVERRIDE")) return "WARNING";
  return "INFO";
}

export function emitRecoveryCanonicalEvent(
  eventType: string,
  record: RecoveryRecord,
  detail: string
): void {
  try {
    const event = createCanonicalEvent({
      eventType: eventType,
      correlationId: record.correlationId,
      timelineId: record.timelineId || "tl-" + record.correlationId.slice(0, 8),
      baselineId: record.baselineId,
      lifecycleState: "INCIDENT_LOCKDOWN",
      releaseMode: "FULL_ACTIVE_STABILIZATION",
      actor: record.actor,
      sourceModule: "recovery-coordinator",
      entityType: "recovery",
      entityId: record.recoveryId,
      reasonCode: detail,
      severity: mapSeverity(eventType),
      resultStatus: mapResultStatus(eventType),
      incidentId: record.incidentId,
    });
    writeCanonicalAudit(event);
  } catch (err) {
    logBridgeFailure("recovery-canonical-bridge", "emitRecoveryCanonicalEvent", err);
  }
}
