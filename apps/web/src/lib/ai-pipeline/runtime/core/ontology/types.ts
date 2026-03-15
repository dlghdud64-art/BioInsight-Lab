/**
 * P3 Slice 1 — Ontology Adapter Types
 *
 * Generic adapter contract + canonical domain object types.
 * Each adapter translates between legacy runtime shapes,
 * canonical domain objects, and persistence entities.
 */

import type { RecoveryState } from "../recovery/recovery-types";

// ══════════════════════════════════════════════════════════════════════════════
// Adapter Direction
// ══════════════════════════════════════════════════════════════════════════════

export type AdapterDirection =
  | "legacy_to_canonical"
  | "canonical_to_repository"
  | "repository_to_canonical";

// ══════════════════════════════════════════════════════════════════════════════
// Diagnostic Types
// ══════════════════════════════════════════════════════════════════════════════

export type OntologyDiagnosticType =
  | "LEGACY_BRIDGE_TRANSLATION_APPLIED"
  | "LEGACY_DIRECT_ACCESS_FALLBACK_USED"
  | "DATE_NORMALIZATION_APPLIED"
  | "DATE_NORMALIZATION_FAILED"
  | "ONTOLOGY_ADAPTER_CONTRACT_VIOLATION"
  | "LEGACY_FIELD_MAPPING_APPLIED";

export interface OntologyDiagnosticEvent {
  type: OntologyDiagnosticType;
  moduleName: string;
  adapterName: string;
  entityType: string;
  entityId?: string;
  correlationId?: string;
  direction: AdapterDirection;
  reasonCode: string;
  fallbackUsed: boolean;
  timestamp: Date;
}

// ══════════════════════════════════════════════════════════════════════════════
// Generic Adapter Interface
// ══════════════════════════════════════════════════════════════════════════════

export interface OntologyAdapter<TLegacy, TCanonical, TCreateInput, TPersisted> {
  readonly adapterName: string;
  readonly entityType: string;
  fromLegacy(legacy: TLegacy): TCanonical;
  toRepositoryInput(canonical: TCanonical): TCreateInput;
  fromPersisted(persisted: TPersisted): TCanonical;
  toLegacy(canonical: TCanonical): TLegacy;
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Recovery Record
// ══════════════════════════════════════════════════════════════════════════════

export interface CanonicalRecoveryRecord {
  recoveryId: string;
  correlationId: string;
  incidentId: string | null;
  baselineId: string;
  lifecycleState: string;
  releaseMode: string;
  recoveryState: RecoveryState;
  recoveryStage: string | null;
  operatorId: string;
  overrideUsed: boolean;
  overrideReason: string | null;
  signOffMetadata: unknown;
  startedAt: Date;
  completedAt: Date | null;
  lastHeartbeatAt: Date | null;
  failureReasonCode: string | null;
  stageResults: unknown[];
  preconditionResults: unknown[];
  lockKey: string | null;
  lockToken: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Baseline
// ══════════════════════════════════════════════════════════════════════════════

export interface CanonicalBaseline {
  baselineId: string;
  baselineSource: string;
  baselineVersion: string;
  baselineHash: string;
  lifecycleState: string;
  releaseMode: string;
  baselineStatus: string;
  activeSnapshotId: string | null;
  rollbackSnapshotId: string | null;
  freezeReason: string | null;
  activePathManifestId: string | null;
  policySetVersion: string | null;
  routingRuleVersion: string | null;
  authorityRegistryVersion: string | null;
  canonicalSlot: string | null;
  stabilizationOnly: boolean;
  featureExpansionAllowed: boolean;
  experimentalPathAllowed: boolean;
  structuralRefactorAllowed: boolean;
  devOnlyPathAllowed: boolean;
  emergencyRollbackAllowed: boolean;
  containmentPriorityEnabled: boolean;
  auditStrictMode: boolean;
  mergeGateStrictMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}
