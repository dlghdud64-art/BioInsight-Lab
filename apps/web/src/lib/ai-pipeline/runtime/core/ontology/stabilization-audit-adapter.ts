/**
 * P3 Slice 3 — Stabilization Audit Ontology Adapter
 *
 * Translates between:
 *   StabilizationAuditEvent (legacy runtime) ↔ CanonicalStabilizationAudit ↔ PersistedStabilizationAuditEvent
 *
 * Key translations:
 *   performedBy (legacy) ↔ actor (canonical/persisted)
 *   detail (legacy) ↔ reasonCode (canonical/persisted)
 *   timestamp (legacy) ↔ occurredAt (canonical/persisted)
 *   documentType, baselineVersion, baselineHash are legacy-only (not persisted)
 */

import type { StabilizationAuditEvent } from "../../types/stabilization";
import type { PersistedStabilizationAuditEvent, CreateStabilizationAuditEventInput } from "../persistence/types";
import type { OntologyAdapter, CanonicalStabilizationAudit } from "./types";
import { requireDateWithDiagnostic } from "./date-normalizer";
import { emptyToNull } from "./common-normalizers";
import { emitDiagnostic } from "./diagnostics";

const CTX = { adapterName: "stabilization-audit-adapter", entityType: "stabilization-audit" };

function ctx(record: { eventId?: string; correlationId?: string }) {
  return { ...CTX, entityId: record.eventId, correlationId: record.correlationId };
}

// ══════════════════════════════════════════════════════════════════════════════
// Adapter Implementation
// ══════════════════════════════════════════════════════════════════════════════

export const StabilizationAuditOntologyAdapter: OntologyAdapter<
  StabilizationAuditEvent,
  CanonicalStabilizationAudit,
  CreateStabilizationAuditEventInput,
  PersistedStabilizationAuditEvent
> = {
  adapterName: "stabilization-audit-adapter",
  entityType: "stabilization-audit",

  /**
   * Legacy StabilizationAuditEvent → CanonicalStabilizationAudit
   * performedBy → actor, detail → reasonCode, timestamp → occurredAt
   */
  fromLegacy(event: StabilizationAuditEvent): CanonicalStabilizationAudit {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "audit-events", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "fromLegacy",
      { entityId: event.eventId, correlationId: event.correlationId }
    );

    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "audit-events", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "performedBy→actor,detail→reasonCode,timestamp→occurredAt",
      { entityId: event.eventId }
    );

    return {
      eventId: event.eventId,
      eventType: event.eventType,
      correlationId: event.correlationId,
      incidentId: null,
      baselineId: emptyToNull(event.baselineId),
      baselineVersion: emptyToNull(event.baselineVersion),
      baselineHash: emptyToNull(event.baselineHash),
      snapshotId: emptyToNull(event.snapshotId),
      actor: emptyToNull(event.performedBy),
      reasonCode: emptyToNull(event.detail),
      severity: null,
      sourceModule: null,
      entityType: null,
      entityId: null,
      resultStatus: null,
      occurredAt: event.timestamp,
      documentType: emptyToNull(event.documentType),
    };
  },

  /**
   * CanonicalStabilizationAudit → CreateStabilizationAuditEventInput
   * Drops documentType, baselineVersion, baselineHash (not in persistence schema)
   */
  toRepositoryInput(canonical: CanonicalStabilizationAudit): CreateStabilizationAuditEventInput {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "audit-events", CTX.adapterName, CTX.entityType,
      "canonical_to_repository", "toRepositoryInput",
      { entityId: canonical.eventId, correlationId: canonical.correlationId }
    );

    return {
      eventId: canonical.eventId,
      eventType: canonical.eventType,
      correlationId: canonical.correlationId,
      incidentId: canonical.incidentId,
      baselineId: canonical.baselineId,
      snapshotId: canonical.snapshotId,
      actor: canonical.actor,
      reasonCode: canonical.reasonCode,
      severity: canonical.severity,
      sourceModule: canonical.sourceModule,
      entityType: canonical.entityType,
      entityId: canonical.entityId,
      resultStatus: canonical.resultStatus,
      occurredAt: canonical.occurredAt,
    };
  },

  /**
   * PersistedStabilizationAuditEvent → CanonicalStabilizationAudit
   */
  fromPersisted(persisted: PersistedStabilizationAuditEvent): CanonicalStabilizationAudit {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "audit-events", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "fromPersisted",
      { entityId: persisted.eventId, correlationId: persisted.correlationId }
    );

    const c = ctx(persisted);
    return {
      eventId: persisted.eventId,
      eventType: persisted.eventType,
      correlationId: persisted.correlationId,
      incidentId: persisted.incidentId,
      baselineId: persisted.baselineId,
      baselineVersion: null,
      baselineHash: null,
      snapshotId: persisted.snapshotId,
      actor: persisted.actor,
      reasonCode: persisted.reasonCode,
      severity: persisted.severity,
      sourceModule: persisted.sourceModule,
      entityType: persisted.entityType,
      entityId: persisted.entityId,
      resultStatus: persisted.resultStatus,
      occurredAt: requireDateWithDiagnostic(persisted.occurredAt, "occurredAt", c),
      documentType: null,
    };
  },

  /**
   * CanonicalStabilizationAudit → legacy StabilizationAuditEvent
   * actor → performedBy, reasonCode → detail, occurredAt → timestamp
   */
  toLegacy(canonical: CanonicalStabilizationAudit): StabilizationAuditEvent {
    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "audit-events", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "actor→performedBy,reasonCode→detail,occurredAt→timestamp",
      { entityId: canonical.eventId }
    );

    return {
      eventId: canonical.eventId,
      eventType: canonical.eventType as StabilizationAuditEvent["eventType"],
      baselineId: canonical.baselineId || "",
      baselineVersion: canonical.baselineVersion || "",
      baselineHash: canonical.baselineHash || "",
      snapshotId: canonical.snapshotId || "",
      correlationId: canonical.correlationId,
      documentType: canonical.documentType || "",
      performedBy: canonical.actor || "",
      detail: canonical.reasonCode || "",
      timestamp: canonical.occurredAt,
    };
  },
};
