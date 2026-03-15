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
  | "LEGACY_FIELD_MAPPING_APPLIED"
  | "SNAPSHOT_PAYLOAD_TRANSLATION_APPLIED"
  | "SNAPSHOT_PAYLOAD_TRANSLATION_FAILED"
  | "SNAPSHOT_REPO_FIRST_READ_USED"
  | "SNAPSHOT_LEGACY_FALLBACK_USED"
  | "SNAPSHOT_FIDELITY_CONTRACT_VIOLATION";

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

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Authority Line (P3 Slice 2)
// ══════════════════════════════════════════════════════════════════════════════

export interface CanonicalAuthorityLine {
  authorityLineId: string;
  currentAuthorityId: string;
  authorityState: string;
  transferState: string;
  pendingSuccessorId: string | null;
  revokedAuthorityIds: string[];
  registryVersion: string;
  baselineId: string | null;
  correlationId: string | null;
  updatedBy: string | null;
  updatedAt: Date;
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Incident (P3 Slice 2)
// ══════════════════════════════════════════════════════════════════════════════

export interface CanonicalIncident {
  incidentId: string;
  reasonCode: string;
  severity: string;
  status: string;
  correlationId: string;
  baselineId: string | null;
  snapshotId: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Stabilization Audit (P3 Slice 3)
// ══════════════════════════════════════════════════════════════════════════════

export interface CanonicalStabilizationAudit {
  eventId: string;
  eventType: string;
  correlationId: string;
  incidentId: string | null;
  baselineId: string | null;
  baselineVersion: string | null;
  baselineHash: string | null;
  snapshotId: string | null;
  actor: string | null;
  reasonCode: string | null;
  severity: string | null;
  sourceModule: string | null;
  entityType: string | null;
  entityId: string | null;
  resultStatus: string | null;
  occurredAt: Date;
  documentType: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Audit Record (P3 Slice 3)
// ══════════════════════════════════════════════════════════════════════════════

export interface CanonicalAuditRecord {
  eventId: string;
  eventType: string;
  eventStage: string | null;
  correlationId: string;
  incidentId: string | null;
  timelineId: string;
  baselineId: string | null;
  baselineVersion: string | null;
  baselineHash: string | null;
  lifecycleState: string | null;
  releaseMode: string | null;
  actor: string | null;
  sourceModule: string;
  entityType: string;
  entityId: string;
  reasonCode: string;
  severity: string;
  occurredAt: Date;
  recordedAt: Date;
  snapshotBeforeId: string | null;
  snapshotAfterId: string | null;
  affectedScopes: string[];
  resultStatus: string;
  parentEventId: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Snapshot (P3 Slice 3) — full-fidelity payload
// ══════════════════════════════════════════════════════════════════════════════

export interface CanonicalSnapshotScope {
  scope: string;
  data: Record<string, unknown>;
  checksum: string;
}

export interface CanonicalSnapshot {
  snapshotId: string;
  baselineId: string;
  snapshotType: string;
  scopes: CanonicalSnapshotScope[];
  config: Record<string, unknown>;
  capturedAt: Date;
  capturedBy: string;
  includedScopes: string[];
  configChecksum: string | null;
  flagChecksum: string | null;
  routingChecksum: string | null;
  authorityChecksum: string | null;
  policyChecksum: string | null;
  queueTopologyChecksum: string | null;
  restoreVerificationStatus: string | null;
}
