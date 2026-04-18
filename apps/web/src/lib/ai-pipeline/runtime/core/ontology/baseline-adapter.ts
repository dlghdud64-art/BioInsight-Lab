/**
 * P3 Slice 1 — Baseline Ontology Adapter
 *
 * Translates between:
 *   BaselineRegistry (legacy runtime) ↔ CanonicalBaseline ↔ PersistedBaseline
 *
 * Key renames: canonicalBaselineId ↔ baselineId ↔ id (DB PK)
 * Empty string ↔ null normalization for optional string fields.
 */

import type { BaselineRegistry, LifecycleState, ReleaseMode, BaselineStatus } from "../../types/stabilization";
import type { PersistedBaseline, CreateBaselineInput } from "../persistence/types";
import type { OntologyAdapter, CanonicalBaseline } from "./types";
import { normalizeDateWithDiagnostic, requireDateWithDiagnostic } from "./date-normalizer";
import { emptyToNull, nullToEmpty } from "./common-normalizers";
import { emitDiagnostic } from "./diagnostics";

const CTX = { adapterName: "baseline-adapter", entityType: "baseline" };

function ctx(record: { canonicalBaselineId?: string; baselineId?: string }) {
  return { ...CTX, entityId: record.canonicalBaselineId || record.baselineId };
}

// ══════════════════════════════════════════════════════════════════════════════
// Adapter Implementation
// ══════════════════════════════════════════════════════════════════════════════

export const BaselineOntologyAdapter: OntologyAdapter<
  BaselineRegistry,
  CanonicalBaseline,
  CreateBaselineInput,
  PersistedBaseline
> = {
  adapterName: "baseline-adapter",
  entityType: "baseline",

  /**
   * Legacy BaselineRegistry → CanonicalBaseline
   * Key rename: canonicalBaselineId → baselineId
   * Empty strings → null for optional fields
   */
  fromLegacy(registry: BaselineRegistry): CanonicalBaseline {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "baseline-registry", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "fromLegacy",
      { entityId: registry.canonicalBaselineId }
    );

    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "baseline-registry", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "canonicalBaselineId→baselineId",
      { entityId: registry.canonicalBaselineId }
    );

    const c = ctx(registry);
    return {
      baselineId: registry.canonicalBaselineId,
      baselineSource: registry.baselineSource,
      baselineVersion: registry.baselineVersion,
      baselineHash: registry.baselineHash,
      lifecycleState: registry.lifecycleState,
      releaseMode: registry.releaseMode,
      baselineStatus: registry.baselineStatus,
      activeSnapshotId: emptyToNull(registry.activeSnapshotId),
      rollbackSnapshotId: emptyToNull(registry.rollbackSnapshotId),
      freezeReason: emptyToNull(registry.freezeReason),
      activePathManifestId: emptyToNull(registry.activePathManifestId),
      policySetVersion: emptyToNull(registry.policySetVersion),
      routingRuleVersion: emptyToNull(registry.routingRuleVersion),
      authorityRegistryVersion: emptyToNull(registry.authorityRegistryVersion),
      canonicalSlot: "CANONICAL",
      stabilizationOnly: true,
      featureExpansionAllowed: false,
      experimentalPathAllowed: false,
      structuralRefactorAllowed: false,
      devOnlyPathAllowed: false,
      emergencyRollbackAllowed: true,
      containmentPriorityEnabled: true,
      auditStrictMode: true,
      mergeGateStrictMode: true,
      createdAt: requireDateWithDiagnostic(registry.createdAt, "createdAt", c),
      updatedAt: requireDateWithDiagnostic(registry.updatedAt, "updatedAt", c),
    };
  },

  /**
   * CanonicalBaseline → CreateBaselineInput (omits id/createdAt/updatedAt)
   */
  toRepositoryInput(canonical: CanonicalBaseline): CreateBaselineInput {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "baseline-registry", CTX.adapterName, CTX.entityType,
      "canonical_to_repository", "toRepositoryInput",
      { entityId: canonical.baselineId }
    );

    return {
      baselineSource: canonical.baselineSource,
      baselineVersion: canonical.baselineVersion,
      baselineHash: canonical.baselineHash,
      lifecycleState: canonical.lifecycleState,
      releaseMode: canonical.releaseMode,
      baselineStatus: canonical.baselineStatus,
      activeSnapshotId: canonical.activeSnapshotId,
      rollbackSnapshotId: canonical.rollbackSnapshotId,
      freezeReason: canonical.freezeReason,
      activePathManifestId: canonical.activePathManifestId,
      policySetVersion: canonical.policySetVersion,
      routingRuleVersion: canonical.routingRuleVersion,
      authorityRegistryVersion: canonical.authorityRegistryVersion,
      stabilizationOnly: canonical.stabilizationOnly,
      featureExpansionAllowed: canonical.featureExpansionAllowed,
      experimentalPathAllowed: canonical.experimentalPathAllowed,
      structuralRefactorAllowed: canonical.structuralRefactorAllowed,
      devOnlyPathAllowed: canonical.devOnlyPathAllowed,
      emergencyRollbackAllowed: canonical.emergencyRollbackAllowed,
      containmentPriorityEnabled: canonical.containmentPriorityEnabled,
      auditStrictMode: canonical.auditStrictMode,
      mergeGateStrictMode: canonical.mergeGateStrictMode,
      canonicalSlot: canonical.canonicalSlot,
    };
  },

  /**
   * PersistedBaseline → CanonicalBaseline
   * Key rename: id → baselineId
   */
  fromPersisted(persisted: PersistedBaseline): CanonicalBaseline {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "baseline-registry", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "fromPersisted",
      { entityId: persisted.id }
    );

    const c = { ...CTX, entityId: persisted.id };
    return {
      baselineId: persisted.id,
      baselineSource: persisted.baselineSource,
      baselineVersion: persisted.baselineVersion,
      baselineHash: persisted.baselineHash,
      lifecycleState: persisted.lifecycleState,
      releaseMode: persisted.releaseMode,
      baselineStatus: persisted.baselineStatus,
      activeSnapshotId: persisted.activeSnapshotId,
      rollbackSnapshotId: persisted.rollbackSnapshotId,
      freezeReason: persisted.freezeReason,
      activePathManifestId: persisted.activePathManifestId,
      policySetVersion: persisted.policySetVersion,
      routingRuleVersion: persisted.routingRuleVersion,
      authorityRegistryVersion: persisted.authorityRegistryVersion,
      canonicalSlot: persisted.canonicalSlot,
      stabilizationOnly: persisted.stabilizationOnly,
      featureExpansionAllowed: persisted.featureExpansionAllowed,
      experimentalPathAllowed: persisted.experimentalPathAllowed,
      structuralRefactorAllowed: persisted.structuralRefactorAllowed,
      devOnlyPathAllowed: persisted.devOnlyPathAllowed,
      emergencyRollbackAllowed: persisted.emergencyRollbackAllowed,
      containmentPriorityEnabled: persisted.containmentPriorityEnabled,
      auditStrictMode: persisted.auditStrictMode,
      mergeGateStrictMode: persisted.mergeGateStrictMode,
      createdAt: requireDateWithDiagnostic(persisted.createdAt, "createdAt", c),
      updatedAt: requireDateWithDiagnostic(persisted.updatedAt, "updatedAt", c),
    };
  },

  /**
   * CanonicalBaseline → legacy BaselineRegistry
   * Key rename: baselineId → canonicalBaselineId
   * null → empty string for optional string fields
   */
  toLegacy(canonical: CanonicalBaseline): BaselineRegistry {
    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "baseline-registry", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "baselineId→canonicalBaselineId",
      { entityId: canonical.baselineId }
    );

    return {
      canonicalBaselineId: canonical.baselineId,
      baselineVersion: canonical.baselineVersion,
      baselineHash: canonical.baselineHash,
      baselineSource: "PACKAGE1_COMPLETE_NEW_AI_INTEGRATED",
      baselineStatus: canonical.baselineStatus as BaselineStatus,
      lifecycleState: canonical.lifecycleState as LifecycleState,
      releaseMode: canonical.releaseMode as ReleaseMode,
      activeSnapshotId: nullToEmpty(canonical.activeSnapshotId),
      rollbackSnapshotId: nullToEmpty(canonical.rollbackSnapshotId),
      freezeReason: nullToEmpty(canonical.freezeReason),
      activePathManifestId: nullToEmpty(canonical.activePathManifestId),
      policySetVersion: nullToEmpty(canonical.policySetVersion),
      routingRuleVersion: nullToEmpty(canonical.routingRuleVersion),
      authorityRegistryVersion: nullToEmpty(canonical.authorityRegistryVersion),
      documentType: "",
      createdAt: canonical.createdAt,
      updatedAt: canonical.updatedAt,
    };
  },
};
