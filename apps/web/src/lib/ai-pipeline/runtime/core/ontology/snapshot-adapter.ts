/**
 * P3 Slice 3 — Snapshot Ontology Adapter
 *
 * Translates between:
 *   BaselineSnapshot (legacy runtime) ↔ CanonicalSnapshot ↔ PersistedSnapshot
 *
 * Key design: full-fidelity payload in canonical, checksum-only in persistence.
 *
 * Key translations:
 *   tag (legacy) ↔ snapshotType (canonical/persisted)
 *   scopes[] full data (legacy/canonical) → checksums only (persisted)
 *   capturedAt (legacy) ↔ createdAt (persisted)
 *   capturedBy (legacy-only, not persisted)
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
   * Lossy: drops scope data, config, capturedBy — only checksums persisted
   */
  toRepositoryInput(canonical: CanonicalSnapshot): CreateSnapshotInput {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "snapshot-manager", CTX.adapterName, CTX.entityType,
      "canonical_to_repository", "toRepositoryInput:checksum-only",
      { entityId: canonical.snapshotId }
    );

    return {
      snapshotType: canonical.snapshotType,
      baselineId: canonical.baselineId,
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
   * Data not available from persistence — scopes/config are empty.
   * createdAt → capturedAt
   */
  fromPersisted(persisted: PersistedSnapshot): CanonicalSnapshot {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "snapshot-manager", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "fromPersisted:checksum-only",
      { entityId: persisted.id }
    );

    const c = { ...CTX, entityId: persisted.id };
    return {
      snapshotId: persisted.id,
      baselineId: persisted.baselineId,
      snapshotType: persisted.snapshotType,
      scopes: [],
      config: {},
      capturedAt: requireDateWithDiagnostic(persisted.createdAt, "createdAt", c),
      capturedBy: "",
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
