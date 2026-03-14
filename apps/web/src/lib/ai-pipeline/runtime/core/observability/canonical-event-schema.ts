/**
 * S5 — Canonical Event Schema + Audit Writer + Correlation Chain +
 *       Timeline Builder + Hop Validator + Reconstruction Contract
 */

import { randomUUID } from "crypto";
import { getPersistenceAdapters } from "../persistence";

// ── Canonical Event Schema ──

export type EventSeverity = "INFO" | "NOTICE" | "WARNING" | "ERROR" | "CRITICAL";
export type EventResultStatus = "ACCEPTED" | "DENIED" | "STARTED" | "COMPLETED" | "FAILED" | "ESCALATED" | "QUARANTINED";
export type ReconstructionStatus = "RECONSTRUCTABLE" | "PARTIALLY_RECONSTRUCTABLE" | "BROKEN_CHAIN";

export const SCHEMA_VERSION = "1.0.0";

export interface CanonicalEvent {
  eventId: string;
  eventType: string;
  eventStage?: string;
  correlationId: string;
  incidentId?: string;
  timelineId: string;
  baselineId: string;
  baselineVersion: string;
  baselineHash: string;
  lifecycleState: string;
  releaseMode: string;
  actor: string;
  sourceModule: string;
  entityType: string;
  entityId: string;
  reasonCode: string;
  severity: EventSeverity;
  occurredAt: Date;
  recordedAt: Date;
  snapshotBeforeId?: string;
  snapshotAfterId?: string;
  affectedScopes: string[];
  resultStatus: EventResultStatus;
  parentEventId?: string;
  schemaVersion: string;
}

// ── Required Fields ──

const REQUIRED_FIELDS: readonly (keyof CanonicalEvent)[] = [
  "eventId", "eventType", "correlationId", "timelineId", "baselineId",
  "baselineVersion", "baselineHash", "lifecycleState", "releaseMode",
  "actor", "sourceModule", "entityType", "entityId", "reasonCode",
  "severity", "occurredAt", "recordedAt", "resultStatus", "schemaVersion",
];

export interface EventValidationResult {
  valid: boolean;
  missingFields: string[];
  schemaVersionMatch: boolean;
}

export function validateCanonicalEvent(event: Partial<CanonicalEvent>): EventValidationResult {
  const missing: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (event[field] === undefined || event[field] === null || event[field] === "") {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0 && event.schemaVersion === SCHEMA_VERSION,
    missingFields: missing,
    schemaVersionMatch: event.schemaVersion === SCHEMA_VERSION,
  };
}

// ── Canonical Audit Writer (single entrypoint) ──

const _auditLog: CanonicalEvent[] = [];
const _writtenIds = new Set<string>();

export interface AuditWriteResult {
  written: boolean;
  reasonCode: string;
  eventId: string;
}

export function writeCanonicalAudit(event: CanonicalEvent): AuditWriteResult {
  // validation
  const validation = validateCanonicalEvent(event);
  if (!validation.valid) {
    return { written: false, reasonCode: `REQUIRED_FIELD_MISSING: ${validation.missingFields.join(",")}`, eventId: event.eventId ?? "" };
  }

  // correlation chain required
  if (!event.correlationId) {
    return { written: false, reasonCode: "MISSING_CORRELATION_BLOCKED", eventId: event.eventId };
  }

  // dedupe
  if (_writtenIds.has(event.eventId)) {
    // diagnostic
    _auditLog.push({ ...event, eventType: `DUPLICATE_${event.eventType}`, reasonCode: "DUPLICATE_AUDIT_DIAGNOSTIC" });
    return { written: false, reasonCode: "DUPLICATE_EVENT_DEDUPE", eventId: event.eventId };
  }

  _writtenIds.add(event.eventId);
  event.recordedAt = new Date();

  // Dual-write: repository first (fire-and-forget), then legacy store
  try {
    const adapters = getPersistenceAdapters();
    adapters.canonicalAudit.appendCanonicalEvent({
      eventId: event.eventId,
      eventType: event.eventType,
      eventStage: event.eventStage || null,
      correlationId: event.correlationId,
      incidentId: event.incidentId || null,
      timelineId: event.timelineId,
      baselineId: event.baselineId || null,
      baselineVersion: event.baselineVersion || null,
      baselineHash: event.baselineHash || null,
      lifecycleState: event.lifecycleState || null,
      releaseMode: event.releaseMode || null,
      actor: event.actor || null,
      sourceModule: event.sourceModule,
      entityType: event.entityType,
      entityId: event.entityId,
      reasonCode: event.reasonCode,
      severity: event.severity,
      occurredAt: event.occurredAt,
      snapshotBeforeId: event.snapshotBeforeId || null,
      snapshotAfterId: event.snapshotAfterId || null,
      affectedScopes: event.affectedScopes || [],
      resultStatus: event.resultStatus,
      parentEventId: event.parentEventId || null,
    }).catch(function () {
      // bridge phase: repository write failure is non-fatal
    });
  } catch (_bridgeErr) {
    // bootstrap not ready yet — legacy path covers this
    // TODO(Slice-1F): remove legacy store, read from repository directly
  }

  _auditLog.push(event);

  return { written: true, reasonCode: "AUDIT_WRITE_SUCCESS", eventId: event.eventId };
}

export function getCanonicalAuditLog(filter?: { correlationId?: string; timelineId?: string; eventType?: string }): CanonicalEvent[] {
  if (!filter) return [..._auditLog];
  return _auditLog.filter((e: CanonicalEvent) => {
    if (filter.correlationId && e.correlationId !== filter.correlationId) return false;
    if (filter.timelineId && e.timelineId !== filter.timelineId) return false;
    if (filter.eventType && e.eventType !== filter.eventType) return false;
    return true;
  });
}

// ── Hop Validator ──

export interface HopContract {
  flowName: string;
  requiredHops: string[];
}

const CONTAINMENT_FLOW_HOPS: readonly string[] = [
  "BREACH_DETECTED",
  "FINAL_CONTAINMENT_STARTED",
  "MUTATION_FROZEN",
  "ROLLBACK_PRECHECK_PASSED",
  "ROLLBACK_STEP_EXECUTED",
  "RESIDUE_SCAN_COMPLETED",
  "RECONCILIATION_COMPLETED",
  "CONTAINMENT_FINALIZED",
];

const ROUTING_FLOW_HOPS: readonly string[] = [
  "INTAKE_NORMALIZED",
  "ROUTING_DECISION_BUILT",
  "QUEUE_WRITE_SUCCEEDED",
];

const AUTHORITY_TRANSFER_FLOW_HOPS: readonly string[] = [
  "AUTHORITY_TRANSFER_REQUESTED",
  "AUTHORITY_TRANSFER_LOCKED",
  "AUTHORITY_REVOKED",
  "AUTHORITY_ACTIVATED",
  "AUTHORITY_CONTINUITY_VALIDATED",
];

export interface HopValidationResult {
  flowName: string;
  complete: boolean;
  missingHops: string[];
  presentHops: string[];
}

export function validateHops(flowName: string, correlationId: string): HopValidationResult {
  let requiredHops: readonly string[];
  switch (flowName) {
    case "containment": requiredHops = CONTAINMENT_FLOW_HOPS; break;
    case "routing": requiredHops = ROUTING_FLOW_HOPS; break;
    case "authority_transfer": requiredHops = AUTHORITY_TRANSFER_FLOW_HOPS; break;
    default: return { flowName, complete: false, missingHops: ["UNKNOWN_FLOW"], presentHops: [] };
  }

  const events = _auditLog.filter((e: CanonicalEvent) => e.correlationId === correlationId);
  const eventTypes = new Set(events.map((e: CanonicalEvent) => e.eventType));
  const present = requiredHops.filter((h: string) => eventTypes.has(h));
  const missing = requiredHops.filter((h: string) => !eventTypes.has(h));

  return {
    flowName,
    complete: missing.length === 0,
    missingHops: [...missing],
    presentHops: [...present],
  };
}

// ── Timeline Builder ──

export interface Timeline {
  timelineId: string;
  correlationId: string;
  incidentId?: string;
  rootEventId: string;
  orderedEvents: CanonicalEvent[];
  missingHops: string[];
  finalOutcome: string;
  residualRisk?: string;
  reconstructionStatus: ReconstructionStatus;
}

export function buildTimeline(correlationId: string): Timeline {
  const events = _auditLog
    .filter((e: CanonicalEvent) => e.correlationId === correlationId)
    .sort((a: CanonicalEvent, b: CanonicalEvent) => a.occurredAt.getTime() - b.occurredAt.getTime());

  if (events.length === 0) {
    return {
      timelineId: `tl-empty-${correlationId}`,
      correlationId,
      rootEventId: "",
      orderedEvents: [],
      missingHops: [],
      finalOutcome: "NO_EVENTS",
      reconstructionStatus: "BROKEN_CHAIN",
    };
  }

  const rootEvent = events[0]!;
  const lastEvent = events[events.length - 1]!;
  const incidentId = events.find((e: CanonicalEvent) => e.incidentId)?.incidentId;

  // check hops for relevant flows
  const allMissing: string[] = [];
  for (const flow of ["containment", "routing", "authority_transfer"]) {
    const hop = validateHops(flow, correlationId);
    if (hop.presentHops.length > 0 && !hop.complete) {
      allMissing.push(...hop.missingHops.map((m: string) => `${flow}:${m}`));
    }
  }

  let status: ReconstructionStatus;
  if (allMissing.length === 0) {
    status = "RECONSTRUCTABLE";
  } else if (allMissing.length <= 2) {
    status = "PARTIALLY_RECONSTRUCTABLE";
  } else {
    status = "BROKEN_CHAIN";
  }

  return {
    timelineId: rootEvent.timelineId,
    correlationId,
    incidentId,
    rootEventId: rootEvent.eventId,
    orderedEvents: events,
    missingHops: allMissing,
    finalOutcome: lastEvent.resultStatus,
    residualRisk: allMissing.length > 0 ? `${allMissing.length} missing hops` : undefined,
    reconstructionStatus: status,
  };
}

// ── Reconstruction Contract ──

export interface ReconstructionView {
  viewType: "incident" | "containment" | "routing" | "authority_succession";
  correlationId: string;
  finalOutcome: string;
  reasonCode: string;
  affectedScopes: string[];
  actor: string;
  missingHops: string[];
  reconstructionStatus: ReconstructionStatus;
  eventCount: number;
}

export function buildReconstructionView(
  viewType: "incident" | "containment" | "routing" | "authority_succession",
  correlationId: string
): ReconstructionView {
  const timeline = buildTimeline(correlationId);
  const lastEvent = timeline.orderedEvents[timeline.orderedEvents.length - 1];

  return {
    viewType,
    correlationId,
    finalOutcome: timeline.finalOutcome,
    reasonCode: lastEvent?.reasonCode ?? "NO_EVENTS",
    affectedScopes: lastEvent?.affectedScopes ?? [],
    actor: lastEvent?.actor ?? "unknown",
    missingHops: timeline.missingHops,
    reconstructionStatus: timeline.reconstructionStatus,
    eventCount: timeline.orderedEvents.length,
  };
}

/** 테스트용 */
export function _resetCanonicalAudit(): void {
  _auditLog.length = 0;
  _writtenIds.clear();
}

/** helper: create event with defaults */
export function createCanonicalEvent(overrides: Partial<CanonicalEvent>): CanonicalEvent {
  return {
    eventId: overrides.eventId ?? randomUUID(),
    eventType: overrides.eventType ?? "UNKNOWN",
    correlationId: overrides.correlationId ?? randomUUID(),
    timelineId: overrides.timelineId ?? `tl-${randomUUID().slice(0, 8)}`,
    baselineId: overrides.baselineId ?? "bl-default",
    baselineVersion: overrides.baselineVersion ?? "1.0.0",
    baselineHash: overrides.baselineHash ?? "hash",
    lifecycleState: overrides.lifecycleState ?? "ACTIVE_100",
    releaseMode: overrides.releaseMode ?? "FULL_ACTIVE_STABILIZATION",
    actor: overrides.actor ?? "system",
    sourceModule: overrides.sourceModule ?? "test",
    entityType: overrides.entityType ?? "test",
    entityId: overrides.entityId ?? "test-1",
    reasonCode: overrides.reasonCode ?? "TEST",
    severity: overrides.severity ?? "INFO",
    occurredAt: overrides.occurredAt ?? new Date(),
    recordedAt: overrides.recordedAt ?? new Date(),
    affectedScopes: overrides.affectedScopes ?? [],
    resultStatus: overrides.resultStatus ?? "COMPLETED",
    schemaVersion: overrides.schemaVersion ?? SCHEMA_VERSION,
    eventStage: overrides.eventStage,
    incidentId: overrides.incidentId,
    snapshotBeforeId: overrides.snapshotBeforeId,
    snapshotAfterId: overrides.snapshotAfterId,
    parentEventId: overrides.parentEventId,
  };
}
