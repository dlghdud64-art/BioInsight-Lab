/**
 * P3 Slice 2 — Incident Ontology Adapter
 *
 * Translates between:
 *   IncidentRecord (legacy runtime) ↔ CanonicalIncident ↔ PersistedIncident
 *
 * Key translations:
 *   actor (legacy) ↔ acknowledgedBy (persisted) — only when acknowledged
 *   escalatedAt (legacy) ↔ createdAt (persisted)
 *   acknowledged: boolean (legacy) ↔ status: string (persisted)
 *   detail (legacy only, not persisted)
 */

import type { IncidentRecord } from "../incidents/incident-escalation";
import type { PersistedIncident, CreateIncidentInput } from "../persistence/types";
import type { OntologyAdapter, CanonicalIncident } from "./types";
import { normalizeDateWithDiagnostic, requireDateWithDiagnostic } from "./date-normalizer";
import { emitDiagnostic } from "./diagnostics";

const CTX = { adapterName: "incident-adapter", entityType: "incident" };

function ctx(record: { incidentId?: string; correlationId?: string }) {
  return { ...CTX, entityId: record.incidentId, correlationId: record.correlationId };
}

// ══════════════════════════════════════════════════════════════════════════════
// Adapter Implementation
// ══════════════════════════════════════════════════════════════════════════════

export const IncidentOntologyAdapter: OntologyAdapter<
  IncidentRecord,
  CanonicalIncident,
  CreateIncidentInput,
  PersistedIncident
> = {
  adapterName: "incident-adapter",
  entityType: "incident",

  /**
   * Legacy IncidentRecord → CanonicalIncident
   * actor → acknowledgedBy (only when acknowledged)
   * escalatedAt → createdAt
   * acknowledged: boolean → status: string
   */
  fromLegacy(record: IncidentRecord): CanonicalIncident {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "incident-escalation", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "fromLegacy",
      { entityId: record.incidentId, correlationId: record.correlationId }
    );

    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "incident-escalation", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "acknowledged:boolean→status,escalatedAt→createdAt",
      { entityId: record.incidentId }
    );

    return {
      incidentId: record.incidentId,
      reasonCode: record.reasonCode,
      severity: "WARNING",
      status: record.acknowledged ? "ACKNOWLEDGED" : "OPEN",
      correlationId: record.correlationId,
      baselineId: null,
      snapshotId: null,
      acknowledgedBy: record.acknowledged ? record.actor : null,
      acknowledgedAt: null,
      createdAt: record.escalatedAt,
    };
  },

  /**
   * CanonicalIncident → CreateIncidentInput
   * Omits id, createdAt, updatedAt, acknowledgedBy, acknowledgedAt
   */
  toRepositoryInput(canonical: CanonicalIncident): CreateIncidentInput {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "incident-escalation", CTX.adapterName, CTX.entityType,
      "canonical_to_repository", "toRepositoryInput",
      { entityId: canonical.incidentId, correlationId: canonical.correlationId }
    );

    return {
      incidentId: canonical.incidentId,
      reasonCode: canonical.reasonCode,
      severity: canonical.severity,
      status: canonical.status,
      correlationId: canonical.correlationId,
      baselineId: canonical.baselineId,
      snapshotId: canonical.snapshotId,
    };
  },

  /**
   * PersistedIncident → CanonicalIncident
   */
  fromPersisted(persisted: PersistedIncident): CanonicalIncident {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "incident-escalation", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "fromPersisted",
      { entityId: persisted.incidentId, correlationId: persisted.correlationId }
    );

    const c = ctx(persisted);
    return {
      incidentId: persisted.incidentId,
      reasonCode: persisted.reasonCode,
      severity: persisted.severity,
      status: persisted.status,
      correlationId: persisted.correlationId,
      baselineId: persisted.baselineId,
      snapshotId: persisted.snapshotId,
      acknowledgedBy: persisted.acknowledgedBy,
      acknowledgedAt: normalizeDateWithDiagnostic(persisted.acknowledgedAt, "acknowledgedAt", c),
      createdAt: requireDateWithDiagnostic(persisted.createdAt, "createdAt", c),
    };
  },

  /**
   * CanonicalIncident → legacy IncidentRecord
   * acknowledgedBy → actor
   * createdAt → escalatedAt
   * status → acknowledged: boolean
   */
  toLegacy(canonical: CanonicalIncident): IncidentRecord {
    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "incident-escalation", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "status→acknowledged,createdAt→escalatedAt",
      { entityId: canonical.incidentId }
    );

    return {
      incidentId: canonical.incidentId,
      reasonCode: canonical.reasonCode,
      correlationId: canonical.correlationId,
      actor: canonical.acknowledgedBy || "system",
      detail: "",
      escalatedAt: canonical.createdAt,
      acknowledged: canonical.status !== "OPEN",
    };
  },
};
