/**
 * P3 Slice 3+3B — Snapshot Ontology Adapter (Full-Fidelity)
 *
 * Translates between:
 *   BaselineSnapshot (legacy runtime) ↔ CanonicalSnapshot ↔ PersistedSnapshot
 *
 * Key design: full-fidelity payload across ALL directions.
 *   scopePayload/configPayload/capturedBy persisted alongside checksums.
 *
 * Key translations:
 *   tag (legacy) ↔ snapshotType (canonical/persisted)
 *   scopes[] full data preserved in scopePayload (Json column)
 *   capturedAt (legacy) ↔ createdAt (persisted)
 *   capturedBy preserved in persisted
 */

import type { BaselineSnapshot, SnapshotScopeEntry } from "../../types/stabilization";
import type { PersistedSnapshot, CreateSnapshotInput } from "../persistence/types";
import type { OntologyAdapter, CanonicalSnapshot, CanonicalSnapshotScope } from "./types";
import { requireDateWithDiagnostic } from "./date-normalizer";
import { emitDiagnostic } from "./diagnostics";

const CTX = { adapterName: "snapshot-adapter", entityType: "snapshot" };

/**
 * Extract the checksum for a given scope name from the canonical scopes array.
 */
function findScopeChecksum(scopes: CanonicalSnapshotScope[], scopeName: string): string | null {
  const entry = scopes.find(function (s) { return s.scope === scopeName; });
  return entry ? entry.checksum : null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Adapter Implementation
// ══════════════════════════════════════════════════════════════════════════════

export const SnapshotOntologyAdapter: OntologyAdapter<
  BaselineSnapshot,
  CanonicalSnapshot,
  CreateSnapshotInput,
  PersistedSnapshot
> = {
  adapterName: "snapshot-adapter",
  entityType: "snapshot",

  /**
   * Legacy BaselineSnapshot → CanonicalSnapshot
   * tag → snapshotType, extract per-scope checksums, preserve full payload
   */
  fromLegacy(snapshot: BaselineSnapshot): CanonicalSnapshot {
    emitDiagnostic(
      "SNAPSHOT_PAYLOAD_TRANSLATION_APPLIED",
      "snapshot-manager", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "fromLegacy:full-fidelity",
      { entityId: snapshot.snapshotId }
    );

    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "snapshot-manager", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "tag→snapshotType",
      { entityId: snapshot.snapshotId }
    );

    const scopes: CanonicalSnapshotScope[] = snapshot.scopes.map(function (s: SnapshotScopeEntry) {
      return { scope: s.scope, data: s.data, checksum: s.checksum };
    });

    return {
      snapshotId: snapshot.snapshotId,
      baselineId: snapshot.baselineId,
      snapshotType: snapshot.tag,
      scopes,
      config: snapshot.config,
      capturedAt: snapshot.capturedAt,
      capturedBy: snapshot.capturedBy,
      includedScopes: snapshot.scopes.map(function (s: SnapshotScopeEntry) { return s.scope; }),
      configChecksum: findScopeChecksum(scopes, "CONFIG"),
      flagChecksum: findScopeChecksum(scopes, "FLAGS"),
      routingChecksum: findScopeChecksum(scopes, "ROUTING"),
      authorityChecksum: findScopeChecksum(scopes, "AUTHORITY"),
      policyChecksum: findScopeChecksum(scopes, "POLICY"),
      queueTopologyChecksum: findScopeChecksum(scopes, "QUEUE_TOPOLOGY"),
      restoreVerificationStatus: null,
    };
  },

  /**
   * CanonicalSnapshot → CreateSnapshotInput
   * Full-fidelity: preserves scope payload, config, capturedBy alongside checksums
   */
  toRepositoryInput(canonical: CanonicalSnapshot): CreateSnapshotInput {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "snapshot-manager", CTX.adapterName, CTX.entityType,
      "canonical_to_repository", "toRepositoryInput:full-fidelity",
      { entityId: canonical.snapshotId }
    );

    return {
      snapshotId: canonical.snapshotId,
      snapshotType: canonical.snapshotType,
      baselineId: canonical.baselineId,
      scopePayload: canonical.scopes,
      configPayload: canonical.config,
      capturedBy: canonical.capturedBy || null,
      configChecksum: canonical.configChecksum,
      flagChecksum: canonical.flagChecksum,
      routingChecksum: canonical.routingChecksum,
      authorityChecksum: canonical.authorityChecksum,
      policyChecksum: canonical.policyChecksum,
      queueTopologyChecksum: canonical.queueTopologyChecksum,
      includedScopes: canonical.includedScopes,
      restoreVerificationStatus: canonical.restoreVerificationStatus,
    };
  },

  /**
   * PersistedSnapshot → CanonicalSnapshot
   * Full-fidelity: reconstructs scopes/config/capturedBy from persisted payload.
   * Falls back to empty for legacy rows without payload (emits FIDELITY diagnostic).
   */
  fromPersisted(persisted: PersistedSnapshot): CanonicalSnapshot {
    const c = { ...CTX, entityId: persisted.snapshotId || persisted.id };
    const hasPayload = persisted.scopePayload != null;

    if (!hasPayload) {
      emitDiagnostic(
        "SNAPSHOT_FIDELITY_CONTRACT_VIOLATION",
        "snapshot-manager", CTX.adapterName, CTX.entityType,
        "repository_to_canonical", "fromPersisted:degraded-null-payload",
        { entityId: c.entityId }
      );
    }

    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "snapshot-manager", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", hasPayload ? "fromPersisted:full-fidelity" : "fromPersisted:degraded",
      { entityId: c.entityId }
    );

    // Reconstruct scopes from payload (or empty for legacy rows)
    let scopes: CanonicalSnapshotScope[] = [];
    if (Array.isArray(persisted.scopePayload)) {
      scopes = (persisted.scopePayload as Array<Record<string, unknown>>).map(function (raw) {
        return {
          scope: String(raw.scope ?? ""),
          data: (raw.data && typeof raw.data === "object" ? raw.data : {}) as Record<string, unknown>,
          checksum: String(raw.checksum ?? ""),
        };
      });
    }

    // Reconstruct config from payload (or empty)
    const config = (persisted.configPayload && typeof persisted.configPayload === "object" && !Array.isArray(persisted.configPayload))
      ? persisted.configPayload as Record<string, unknown>
      : {};

    return {
      snapshotId: persisted.snapshotId || persisted.id,
      baselineId: persisted.baselineId,
      snapshotType: persisted.snapshotType,
      scopes,
      config,
      capturedAt: requireDateWithDiagnostic(persisted.createdAt, "createdAt", c),
      capturedBy: persisted.capturedBy || "",
      includedScopes: persisted.includedScopes || [],
      configChecksum: persisted.configChecksum,
      flagChecksum: persisted.flagChecksum,
      routingChecksum: persisted.routingChecksum,
      authorityChecksum: persisted.authorityChecksum,
      policyChecksum: persisted.policyChecksum,
      queueTopologyChecksum: persisted.queueTopologyChecksum,
      restoreVerificationStatus: persisted.restoreVerificationStatus,
    };
  },

  /**
   * CanonicalSnapshot → legacy BaselineSnapshot
   * snapshotType → tag, rebuild scopes from canonical data
   */
  toLegacy(canonical: CanonicalSnapshot): BaselineSnapshot {
    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "snapshot-manager", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "snapshotType→tag",
      { entityId: canonical.snapshotId }
    );

    const scopes: SnapshotScopeEntry[] = canonical.scopes.map(function (s: CanonicalSnapshotScope) {
      return { scope: s.scope as SnapshotScopeEntry["scope"], data: s.data, checksum: s.checksum };
    });

    return {
      snapshotId: canonical.snapshotId,
      baselineId: canonical.baselineId,
      tag: canonical.snapshotType as "ACTIVE" | "ROLLBACK",
      scopes,
      capturedAt: canonical.capturedAt,
      capturedBy: canonical.capturedBy,
      config: canonical.config,
    };
  },
};
