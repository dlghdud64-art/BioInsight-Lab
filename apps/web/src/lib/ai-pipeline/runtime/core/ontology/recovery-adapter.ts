/**
 * P3 Slice 1 — Recovery Ontology Adapter
 *
 * Translates between:
 *   RecoveryRecord (legacy runtime) ↔ CanonicalRecoveryRecord ↔ PersistedRecoveryRecord
 *
 * This is a translation layer, not a passthrough wrapper.
 * Field renames, null normalization, date normalization, and diagnostics are built-in.
 */

import type { RecoveryRecord } from "../recovery/recovery-types";
import type { RecoveryState } from "../recovery/recovery-types";
import type { PersistedRecoveryRecord, CreateRecoveryRecordInput } from "../persistence/types";
import type { OntologyAdapter, CanonicalRecoveryRecord } from "./types";
import { normalizeDateWithDiagnostic, requireDateWithDiagnostic } from "./date-normalizer";
import { toNullable, normalizeArray, normalizeJson } from "./common-normalizers";
import { emitDiagnostic } from "./diagnostics";

const CTX = { adapterName: "recovery-adapter", entityType: "recovery" };

function ctx(record: { recoveryId?: string; correlationId?: string }) {
  return { ...CTX, entityId: record.recoveryId, correlationId: record.correlationId };
}

// ══════════════════════════════════════════════════════════════════════════════
// Adapter Implementation
// ══════════════════════════════════════════════════════════════════════════════

export const RecoveryOntologyAdapter: OntologyAdapter<
  RecoveryRecord,
  CanonicalRecoveryRecord,
  CreateRecoveryRecordInput,
  PersistedRecoveryRecord
> = {
  adapterName: "recovery-adapter",
  entityType: "recovery",

  /**
   * Legacy RecoveryRecord → CanonicalRecoveryRecord
   * Key renames: actor→operatorId, failReason→failureReasonCode, currentState→recoveryState
   */
  fromLegacy(record: RecoveryRecord): CanonicalRecoveryRecord {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "recovery-coordinator", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "fromLegacy",
      { entityId: record.recoveryId, correlationId: record.correlationId }
    );

    // Field alias: actor → operatorId
    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "recovery-coordinator", CTX.adapterName, CTX.entityType,
      "legacy_to_canonical", "actor→operatorId",
      { entityId: record.recoveryId }
    );

    const c = ctx(record);
    return {
      recoveryId: record.recoveryId,
      correlationId: record.correlationId,
      incidentId: toNullable(record.incidentId),
      baselineId: record.baselineId,
      lifecycleState: "INCIDENT_LOCKDOWN",
      releaseMode: "FULL_ACTIVE_STABILIZATION",
      recoveryState: record.currentState,
      recoveryStage: record.stages.length > 0
        ? record.stages[record.stages.length - 1].stage
        : null,
      operatorId: record.actor,
      overrideUsed: !!record.overrideMetadata,
      overrideReason: record.overrideMetadata ? record.overrideMetadata.overrideReason : null,
      signOffMetadata: record.overrideMetadata ? record.overrideMetadata.signOffMeta : null,
      startedAt: requireDateWithDiagnostic(record.startedAt, "startedAt", c),
      completedAt: normalizeDateWithDiagnostic(toNullable(record.completedAt), "completedAt", c),
      lastHeartbeatAt: null,
      failureReasonCode: toNullable(record.failReason),
      stageResults: record.stages.length > 0 ? record.stages : [],
      preconditionResults: record.preconditionResults.length > 0 ? record.preconditionResults : [],
      lockKey: null,
      lockToken: null,
    };
  },

  /**
   * CanonicalRecoveryRecord → CreateRecoveryRecordInput
   */
  toRepositoryInput(canonical: CanonicalRecoveryRecord): CreateRecoveryRecordInput {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "recovery-coordinator", CTX.adapterName, CTX.entityType,
      "canonical_to_repository", "toRepositoryInput",
      { entityId: canonical.recoveryId, correlationId: canonical.correlationId }
    );

    return {
      recoveryId: canonical.recoveryId,
      correlationId: canonical.correlationId,
      incidentId: canonical.incidentId,
      baselineId: canonical.baselineId,
      lifecycleState: canonical.lifecycleState,
      releaseMode: canonical.releaseMode,
      recoveryState: canonical.recoveryState,
      recoveryStage: canonical.recoveryStage,
      lockKey: canonical.lockKey,
      lockToken: canonical.lockToken,
      operatorId: canonical.operatorId,
      overrideUsed: canonical.overrideUsed,
      overrideReason: canonical.overrideReason,
      signOffMetadata: normalizeJson(canonical.signOffMetadata),
      startedAt: canonical.startedAt,
      completedAt: canonical.completedAt,
      lastHeartbeatAt: canonical.lastHeartbeatAt,
      failureReasonCode: canonical.failureReasonCode,
      stageResults: canonical.stageResults.length > 0 ? canonical.stageResults : null,
      preconditionResults: canonical.preconditionResults.length > 0 ? canonical.preconditionResults : null,
    };
  },

  /**
   * PersistedRecoveryRecord → CanonicalRecoveryRecord
   */
  fromPersisted(persisted: PersistedRecoveryRecord): CanonicalRecoveryRecord {
    emitDiagnostic(
      "LEGACY_BRIDGE_TRANSLATION_APPLIED",
      "recovery-coordinator", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "fromPersisted",
      { entityId: persisted.recoveryId, correlationId: persisted.correlationId }
    );

    const c = ctx(persisted);
    return {
      recoveryId: persisted.recoveryId,
      correlationId: persisted.correlationId,
      incidentId: persisted.incidentId,
      baselineId: persisted.baselineId,
      lifecycleState: persisted.lifecycleState,
      releaseMode: persisted.releaseMode,
      recoveryState: persisted.recoveryState as RecoveryState,
      recoveryStage: persisted.recoveryStage,
      operatorId: persisted.operatorId,
      overrideUsed: persisted.overrideUsed,
      overrideReason: persisted.overrideReason,
      signOffMetadata: normalizeJson(persisted.signOffMetadata),
      startedAt: requireDateWithDiagnostic(persisted.startedAt, "startedAt", c),
      completedAt: normalizeDateWithDiagnostic(persisted.completedAt, "completedAt", c),
      lastHeartbeatAt: normalizeDateWithDiagnostic(persisted.lastHeartbeatAt, "lastHeartbeatAt", c),
      failureReasonCode: persisted.failureReasonCode,
      stageResults: normalizeArray(persisted.stageResults),
      preconditionResults: normalizeArray(persisted.preconditionResults),
      lockKey: persisted.lockKey,
      lockToken: persisted.lockToken,
    };
  },

  /**
   * CanonicalRecoveryRecord → legacy RecoveryRecord
   * Reverse renames: operatorId→actor, failureReasonCode→failReason, recoveryState→currentState
   */
  toLegacy(canonical: CanonicalRecoveryRecord): RecoveryRecord {
    emitDiagnostic(
      "LEGACY_FIELD_MAPPING_APPLIED",
      "recovery-coordinator", CTX.adapterName, CTX.entityType,
      "repository_to_canonical", "operatorId→actor",
      { entityId: canonical.recoveryId }
    );

    return {
      recoveryId: canonical.recoveryId,
      correlationId: canonical.correlationId,
      actor: canonical.operatorId,
      reason: "",
      currentState: canonical.recoveryState,
      baselineId: canonical.baselineId,
      incidentId: canonical.incidentId || undefined,
      preconditionResults: normalizeArray(canonical.preconditionResults) as any[],
      stages: normalizeArray(canonical.stageResults) as any[],
      startedAt: canonical.startedAt,
      completedAt: canonical.completedAt || undefined,
      failReason: canonical.failureReasonCode || undefined,
    };
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// Patch Helper (for UPDATE operations)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build a repository patch from canonical record + optional overrides.
 * Used for optimistic-lock UPDATE operations.
 */
export function toRepositoryPatch(
  canonical: CanonicalRecoveryRecord,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    recoveryState: canonical.recoveryState,
    recoveryStage: canonical.recoveryStage,
    failureReasonCode: canonical.failureReasonCode,
    completedAt: canonical.completedAt,
    stageResults: canonical.stageResults.length > 0 ? canonical.stageResults : null,
    preconditionResults: canonical.preconditionResults.length > 0 ? canonical.preconditionResults : null,
    overrideUsed: canonical.overrideUsed,
    overrideReason: canonical.overrideReason,
    signOffMetadata: normalizeJson(canonical.signOffMetadata),
    lastHeartbeatAt: new Date(),
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
