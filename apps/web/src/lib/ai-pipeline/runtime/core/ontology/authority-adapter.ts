/**
 * P3 Slice 2 — Authority Ontology Adapter
 *
 * Translates between:
 *   AuthorityLine (legacy runtime) ↔ CanonicalAuthorityLine ↔ PersistedAuthorityLine
 *
 * Key translations:
 *   registryVersion: number (legacy) ↔ string (canonical/persisted)
 *   baselineId/updatedBy/correlationId: string (legacy) ↔ string|null (canonical/persisted)
 */

import type { AuthorityLine, AuthorityState, TransferState } from "../authority/authority-registry";
import type { PersistedAuthorityLine, CreateAuthorityLineInput } from "../persistence/types";
import type { OntologyAdapter, CanonicalAuthorityLine } from "./types";
import { requireDateWithDiagnostic } from "./date-normalizer";
import { toNullable, emptyToNull } from "./common-normalizers";
import { emitDiagnostic } from "./diagnostics";

const CTX = { adapterName: "authority-adapter", entityType: "authority" };

function ctx(record: { authorityLineId?: string; correlationId?: string | null }) {
  return { ...CTX, entityId: record.authorityLineId, correlationId: record.correlationId || undefined };
}

// ══════════════════════════════════════════════════════════════════════════════
// Adapter Implementation
// ══════════════════════════════════════════════════════════════════════════════

export const AuthorityOntologyAdapter: OntologyAdapter<
  AuthorityLine,
  CanonicalAuthorityLine,
  CreateAuthorityLineInput,
  PersistedAuthorityLine
> = {
  adapterName: "authority-adapter",
  entityType: "authority",

  /**
   * Legacy AuthorityLine → CanonicalAuthorityLine
   * registryVersion: number → string
   * empty string → null for nullable fields
   */
  fromLegacy(line: AuthorityLine): CanonicalAuthorityLine {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "authority-registry", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "fromLegacy",
      { entityId: line.authorityLineId, correlationId: line.correlationId }
    );

    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "authority-registry", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "registryVersion:number→string",
      { entityId: line.authorityLineId }
    );

    return {
      authorityLineId: line.authorityLineId,
      currentAuthorityId: line.currentAuthorityId,
      authorityState: line.authorityState,
      transferState: line.transferState,
      pendingSuccessorId: toNullable(line.pendingSuccessorId),
      revokedAuthorityIds: line.revokedAuthorityIds,
      registryVersion: String(line.registryVersion),
      baselineId: emptyToNull(line.baselineId),
      correlationId: emptyToNull(line.correlationId),
      updatedBy: emptyToNull(line.updatedBy),
      updatedAt: line.updatedAt,
    };
  },

  /**
   * CanonicalAuthorityLine → CreateAuthorityLineInput
   */
  toRepositoryInput(canonical: CanonicalAuthorityLine): CreateAuthorityLineInput {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "authority-registry", CTX.adapterName, CTX.entityType,
      "canonical_to_repository", "toRepositoryInput",
      { entityId: canonical.authorityLineId, correlationId: canonical.correlationId || undefined }
    );

    return {
      authorityLineId: canonical.authorityLineId,
      currentAuthorityId: canonical.currentAuthorityId,
      authorityState: canonical.authorityState,
      transferState: canonical.transferState,
      pendingSuccessorId: canonical.pendingSuccessorId,
      revokedAuthorityIds: canonical.revokedAuthorityIds,
      registryVersion: canonical.registryVersion,
      baselineId: canonical.baselineId,
      correlationId: canonical.correlationId,
      updatedBy: canonical.updatedBy,
    };
  },

  /**
   * PersistedAuthorityLine → CanonicalAuthorityLine
   */
  fromPersisted(persisted: PersistedAuthorityLine): CanonicalAuthorityLine {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "authority-registry", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "fromPersisted",
      { entityId: persisted.authorityLineId, correlationId: persisted.correlationId || undefined }
    );

    const c = ctx(persisted);
    return {
      authorityLineId: persisted.authorityLineId,
      currentAuthorityId: persisted.currentAuthorityId,
      authorityState: persisted.authorityState,
      transferState: persisted.transferState,
      pendingSuccessorId: persisted.pendingSuccessorId,
      revokedAuthorityIds: persisted.revokedAuthorityIds,
      registryVersion: persisted.registryVersion,
      baselineId: persisted.baselineId,
      correlationId: persisted.correlationId,
      updatedBy: persisted.updatedBy,
      updatedAt: requireDateWithDiagnostic(persisted.updatedAt, "updatedAt", c),
    };
  },

  /**
   * CanonicalAuthorityLine → legacy AuthorityLine
   * registryVersion: string → number
   * null → empty string for required legacy fields
   */
  toLegacy(canonical: CanonicalAuthorityLine): AuthorityLine {
    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "authority-registry", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "registryVersion:string→number",
      { entityId: canonical.authorityLineId }
    );

    return {
      authorityLineId: canonical.authorityLineId,
      currentAuthorityId: canonical.currentAuthorityId,
      authorityState: canonical.authorityState as AuthorityState,
      transferState: canonical.transferState as TransferState,
      pendingSuccessorId: canonical.pendingSuccessorId,
      revokedAuthorityIds: canonical.revokedAuthorityIds,
      registryVersion: Number(canonical.registryVersion),
      baselineId: canonical.baselineId || "",
      updatedAt: canonical.updatedAt,
      updatedBy: canonical.updatedBy || "",
      correlationId: canonical.correlationId || "",
    };
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// Patch Helper (for UPDATE operations)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build a repository patch from canonical authority line.
 * Used for optimistic-lock UPDATE operations (transfer state machine).
 */
export function toAuthorityPatch(
  canonical: CanonicalAuthorityLine,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    currentAuthorityId: canonical.currentAuthorityId,
    authorityState: canonical.authorityState,
    transferState: canonical.transferState,
    pendingSuccessorId: canonical.pendingSuccessorId,
    revokedAuthorityIds: canonical.revokedAuthorityIds,
    registryVersion: canonical.registryVersion,
    updatedBy: canonical.updatedBy,
    correlationId: canonical.correlationId,
  };
  if (overrides) {
    for (const key in overrides) {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) {
        patch[key] = overrides[key];
      }
    }
  }
  return patch;
}
