/**
 * P3 Slice 3 — Canonical Audit Ontology Adapter
 *
 * Translates between:
 *   CanonicalEvent (legacy runtime) ↔ CanonicalAuditRecord ↔ PersistedCanonicalAuditEvent
 *
 * Key translations:
 *   optional fields (eventStage?, incidentId?, etc.) ↔ string | null
 *   schemaVersion (legacy-only, not persisted)
 */

import type { CanonicalEvent, EventSeverity, EventResultStatus } from "../observability/canonical-event-schema";
import type { PersistedCanonicalAuditEvent, CreateCanonicalAuditEventInput } from "../persistence/types";
import type { OntologyAdapter, CanonicalAuditRecord } from "./types";
import { requireDateWithDiagnostic } from "./date-normalizer";
import { toNullable, normalizeArray } from "./common-normalizers";
import { emitDiagnostic } from "./diagnostics";

const SCHEMA_VERSION = "1.0.0";
const CTX = { adapterName: "canonical-audit-adapter", entityType: "canonical-audit" };

function ctx(record: { eventId?: string; correlationId?: string }) {
  return { ...CTX, entityId: record.eventId, correlationId: record.correlationId };
}

// ══════════════════════════════════════════════════════════════════════════════
// Adapter Implementation
// ══════════════════════════════════════════════════════════════════════════════

export const CanonicalAuditOntologyAdapter: OntologyAdapter<
  CanonicalEvent,
  CanonicalAuditRecord,
  CreateCanonicalAuditEventInput,
  PersistedCanonicalAuditEvent
> = {
  adapterName: "canonical-audit-adapter",
  entityType: "canonical-audit",

  /**
   * Legacy CanonicalEvent → CanonicalAuditRecord
   * undefined → null for optional fields, drop schemaVersion
   */
  fromLegacy(event: CanonicalEvent): CanonicalAuditRecord {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "canonical-event-schema", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "fromLegacy",
      { entityId: event.eventId, correlationId: event.correlationId }
    );

    return {
      eventId: event.eventId,
      eventType: event.eventType,
      eventStage: toNullable(event.eventStage) as string | null,
      correlationId: event.correlationId,
      incidentId: toNullable(event.incidentId) as string | null,
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
      recordedAt: event.recordedAt,
      snapshotBeforeId: toNullable(event.snapshotBeforeId) as string | null,
      snapshotAfterId: toNullable(event.snapshotAfterId) as string | null,
      affectedScopes: event.affectedScopes || [],
      resultStatus: event.resultStatus,
      parentEventId: toNullable(event.parentEventId) as string | null,
    };
  },

  /**
   * CanonicalAuditRecord → CreateCanonicalAuditEventInput
   */
  toRepositoryInput(canonical: CanonicalAuditRecord): CreateCanonicalAuditEventInput {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "canonical-event-schema", CTX.adapterName, CTX.entityType,
      "canonical_to_repository", "toRepositoryInput",
      { entityId: canonical.eventId, correlationId: canonical.correlationId }
    );

    return {
      eventId: canonical.eventId,
      eventType: canonical.eventType,
      eventStage: canonical.eventStage,
      correlationId: canonical.correlationId,
      incidentId: canonical.incidentId,
      timelineId: canonical.timelineId,
      baselineId: canonical.baselineId,
      baselineVersion: canonical.baselineVersion,
      baselineHash: canonical.baselineHash,
      lifecycleState: canonical.lifecycleState,
      releaseMode: canonical.releaseMode,
      actor: canonical.actor,
      sourceModule: canonical.sourceModule,
      entityType: canonical.entityType,
      entityId: canonical.entityId,
      reasonCode: canonical.reasonCode,
      severity: canonical.severity,
      occurredAt: canonical.occurredAt,
      snapshotBeforeId: canonical.snapshotBeforeId,
      snapshotAfterId: canonical.snapshotAfterId,
      affectedScopes: canonical.affectedScopes,
      resultStatus: canonical.resultStatus,
      parentEventId: canonical.parentEventId,
    };
  },

  /**
   * PersistedCanonicalAuditEvent → CanonicalAuditRecord
   */
  fromPersisted(persisted: PersistedCanonicalAuditEvent): CanonicalAuditRecord {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "canonical-event-schema", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "fromPersisted",
      { entityId: persisted.eventId, correlationId: persisted.correlationId }
    );

    const c = ctx(persisted);
    return {
      eventId: persisted.eventId,
      eventType: persisted.eventType,
      eventStage: persisted.eventStage,
      correlationId: persisted.correlationId,
      incidentId: persisted.incidentId,
      timelineId: persisted.timelineId,
      baselineId: persisted.baselineId,
      baselineVersion: persisted.baselineVersion,
      baselineHash: persisted.baselineHash,
      lifecycleState: persisted.lifecycleState,
      releaseMode: persisted.releaseMode,
      actor: persisted.actor,
      sourceModule: persisted.sourceModule,
      entityType: persisted.entityType,
      entityId: persisted.entityId,
      reasonCode: persisted.reasonCode,
      severity: persisted.severity,
      occurredAt: requireDateWithDiagnostic(persisted.occurredAt, "occurredAt", c),
      recordedAt: requireDateWithDiagnostic(persisted.recordedAt, "recordedAt", c),
      snapshotBeforeId: persisted.snapshotBeforeId,
      snapshotAfterId: persisted.snapshotAfterId,
      affectedScopes: normalizeArray(persisted.affectedScopes),
      resultStatus: persisted.resultStatus,
      parentEventId: persisted.parentEventId,
    };
  },

  /**
   * CanonicalAuditRecord → legacy CanonicalEvent
   * null → undefined for optional fields, add schemaVersion
   */
  toLegacy(canonical: CanonicalAuditRecord): CanonicalEvent {
    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "canonical-event-schema", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "null→undefined,add:schemaVersion",
      { entityId: canonical.eventId }
    );

    return {
      eventId: canonical.eventId,
      eventType: canonical.eventType,
      eventStage: canonical.eventStage || undefined,
      correlationId: canonical.correlationId,
      incidentId: canonical.incidentId || undefined,
      timelineId: canonical.timelineId,
      baselineId: canonical.baselineId || "",
      baselineVersion: canonical.baselineVersion || "",
      baselineHash: canonical.baselineHash || "",
      lifecycleState: canonical.lifecycleState || "",
      releaseMode: canonical.releaseMode || "",
      actor: canonical.actor || "",
      sourceModule: canonical.sourceModule,
      entityType: canonical.entityType,
      entityId: canonical.entityId,
      reasonCode: canonical.reasonCode,
      severity: canonical.severity as EventSeverity,
      occurredAt: canonical.occurredAt,
      recordedAt: canonical.recordedAt,
      snapshotBeforeId: canonical.snapshotBeforeId || undefined,
      snapshotAfterId: canonical.snapshotAfterId || undefined,
      affectedScopes: canonical.affectedScopes,
      resultStatus: canonical.resultStatus as EventResultStatus,
      parentEventId: canonical.parentEventId || undefined,
      schemaVersion: SCHEMA_VERSION,
    };
  },
};
