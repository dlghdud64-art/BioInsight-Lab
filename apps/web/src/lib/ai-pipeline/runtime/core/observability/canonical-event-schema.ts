/**
 * S5 — Canonical Event Schema + Audit Writer + Correlation Chain +
 *       Timeline Builder + Hop Validator + Reconstruction Contract
 */

import { randomUUID } from "crypto";
import { getPersistenceAdapters } from "../persistence";
import { logBridgeFailure } from "../persistence/bridge-logger";
import { CanonicalAuditOntologyAdapter } from "../ontology/canonical-audit-adapter";
import { emitDiagnostic } from "../ontology/diagnostics";

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

  // Dual-write: repository first via ontology adapter (fire-and-forget), then legacy store
  try {
    const adapters = getPersistenceAdapters();
    const canonicalRecord = CanonicalAuditOntologyAdapter.fromLegacy(event);
    const input = CanonicalAuditOntologyAdapter.toRepositoryInput(canonicalRecord);
    adapters.canonicalAudit.appendCanonicalEvent(input).catch(function (err: unknown) {
      logBridgeFailure("canonical-event-schema", "appendCanonicalEvent", err);
    });
  } catch (err) {
    logBridgeFailure("canonical-event-schema", "appendCanonicalEvent-bootstrap", err);
  }

  _auditLog.push(event);

  return { written: true, reasonCode: "AUDIT_WRITE_SUCCESS", eventId: event.eventId };
}

/** @deprecated Use getCanonicalAuditLogFromRepo — legacy sync compat */
export function getCanonicalAuditLog(filter?: { correlationId?: string; timelineId?: string; eventType?: string }): CanonicalEvent[] {
  emitDiagnostic(
    "LEGACY_SYNC_COMPAT_PATH_USED",
    "canonical-event-schema", "canonical-audit-adapter", "canonical-audit",
    "legacy_to_canonical", "getCanonicalAuditLog:sync-compat",
    {}
  );
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

export const RECOVERY_FLOW_HOPS: readonly string[] = [
  "INCIDENT_LOCKDOWN_RECOVERY_REQUESTED",
  "INCIDENT_LOCKDOWN_RECOVERY_VALIDATED",
  "INCIDENT_LOCKDOWN_RECOVERY_EXECUTING",
  "INCIDENT_LOCKDOWN_RECOVERY_VERIFIED",
  "INCIDENT_LOCKDOWN_RECOVERY_RESTORED",
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
    case "recovery": requiredHops = RECOVERY_FLOW_HOPS; break;
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

/** @deprecated Use buildTimelineFromRepo — legacy sync compat */
export function buildTimeline(correlationId: string): Timeline {
  emitDiagnostic(
    "LEGACY_SYNC_COMPAT_PATH_USED",
    "canonical-event-schema", "canonical-audit-adapter", "canonical-audit",
    "legacy_to_canonical", "buildTimeline:sync-compat",
    {}
  );
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
  for (const flow of ["containment", "routing", "authority_transfer", "recovery"]) {
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

// ── Repository-First Async Read ──

/**
 * Repository-first read with legacy fallback.
 * Maps PersistedCanonicalAuditEvent → CanonicalEvent.
 */
export async function getCanonicalAuditLogFromRepo(
  filter?: { correlationId?: string; timelineId?: string; eventType?: string }
): Promise<CanonicalEvent[]> {
  try {
    const adapters = getPersistenceAdapters();
    let result;
    if (filter && filter.correlationId) {
      result = await adapters.canonicalAudit.listCanonicalEventsByCorrelationId(filter.correlationId, { limit: 1000 });
    } else if (filter && filter.timelineId) {
      result = await adapters.canonicalAudit.listCanonicalEventsByTimelineId(filter.timelineId, { limit: 1000 });
    } else {
      result = await adapters.canonicalAudit.listCanonicalEventsByCorrelationId("", { limit: 1000 });
    }
    if (result.ok) {
      return result.data.items.map(function (d) {
        const canonicalRecord = CanonicalAuditOntologyAdapter.fromPersisted(d);
        return CanonicalAuditOntologyAdapter.toLegacy(canonicalRecord);
      });
    }
  } catch (err) {
    logBridgeFailure("canonical-event-schema", "getCanonicalAuditLogFromRepo", err);
  }
  // REPO_ONLY (P4-2): no fallback — deterministic empty with diagnostic
  emitDiagnostic(
    "REPO_ONLY_PATH_ENFORCED",
    "canonical-event-schema", "canonical-audit-adapter", "canonical-audit",
    "repository_to_canonical", "getCanonicalAuditLogFromRepo:repo-only-empty",
    { fallbackUsed: false }
  );
  return [];
}

// ── Repository-First Async Timeline Builder (P3-5) ──

/**
 * Repository-first timeline builder.
 * Uses getCanonicalAuditLogFromRepo to fetch events, then applies same
 * sorting + hop validation + reconstruction logic.
 */
export async function buildTimelineFromRepo(correlationId: string): Promise<Timeline> {
  emitDiagnostic(
    "CONSUMER_CUTOVER_APPLIED",
    "canonical-event-schema", "canonical-audit-adapter", "canonical-audit",
    "repository_to_canonical", "buildTimelineFromRepo:entry",
    { entityId: correlationId }
  );

  const repoEvents = await getCanonicalAuditLogFromRepo({ correlationId });

  const events = repoEvents
    .filter(function (e) { return e.correlationId === correlationId; })
    .sort(function (a, b) { return a.occurredAt.getTime() - b.occurredAt.getTime(); });

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
  const incidentId = events.find(function (e) { return e.incidentId; })?.incidentId;

  // Hop validation using repo events (inline to avoid calling sync validateHops which reads _auditLog)
  const allMissing: string[] = [];
  const flowHopMap: Record<string, readonly string[]> = {
    containment: CONTAINMENT_FLOW_HOPS,
    routing: ROUTING_FLOW_HOPS,
    authority_transfer: AUTHORITY_TRANSFER_FLOW_HOPS,
    recovery: RECOVERY_FLOW_HOPS,
  };

  const eventTypes = new Set(events.map(function (e) { return e.eventType; }));
  for (const flow of ["containment", "routing", "authority_transfer", "recovery"]) {
    const requiredHops = flowHopMap[flow] || [];
    const present = requiredHops.filter(function (h) { return eventTypes.has(h); });
    const missing = requiredHops.filter(function (h) { return !eventTypes.has(h); });
    if (present.length > 0 && missing.length > 0) {
      allMissing.push(...missing.map(function (m) { return flow + ":" + m; }));
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

// ── Direct Access Shutdown Guardrail (P3-5) ──

export function _assertNoDirectStoreAccess(caller: string): void {
  emitDiagnostic(
    "LEGACY_DIRECT_ACCESS_BLOCKED",
    "canonical-event-schema", "canonical-audit-adapter", "canonical-audit",
    "legacy_to_canonical", "_assertNoDirectStoreAccess:" + caller,
    { entityId: caller }
  );
  throw new Error(`DIRECT_STORE_ACCESS_BLOCKED: ${caller} must use repo-first API`);
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
