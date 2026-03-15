/**
 * P1-1 Slice-1C — Prisma ↔ Domain Mapping Layer
 *
 * Maps between Prisma DB row shapes and PersistedXxx domain types.
 * JSON/array/date/null handling rules are centralized here.
 *
 * Rules:
 * - JSON columns (JSONB) → string[] via explicit parse
 * - Date columns → Date objects (Prisma handles natively)
 * - null → null (no undefined in DB layer)
 * - DB row shape never leaks past this file
 */

import type {
  PersistedBaseline,
  PersistedSnapshot,
  PersistedAuthorityLine,
  PersistedIncident,
  PersistedStabilizationAuditEvent,
  PersistedCanonicalAuditEvent,
} from "../types";

// ══════════════════════════════════════════════════════════════════════════════
// Generic JSON helpers
// ══════════════════════════════════════════════════════════════════════════════

/** Safely parse a JSONB column that should be string[] */
export function jsonToStringArray(json: unknown): string[] {
  if (Array.isArray(json)) return json.map(String);
  if (typeof json === "string") {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // fall through
    }
  }
  return [];
}

/** Convert string[] to JSON-compatible value for Prisma JSONB write */
export function stringArrayToJson(arr: string[]): unknown {
  return arr;
}

// ══════════════════════════════════════════════════════════════════════════════
// Baseline Mapper
// ══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbToBaseline(row: any): PersistedBaseline {
  return {
    id: row.id,
    baselineSource: row.baselineSource,
    baselineVersion: row.baselineVersion,
    baselineHash: row.baselineHash,
    lifecycleState: row.lifecycleState,
    releaseMode: row.releaseMode,
    baselineStatus: row.baselineStatus,
    activeSnapshotId: row.activeSnapshotId ?? null,
    rollbackSnapshotId: row.rollbackSnapshotId ?? null,
    freezeReason: row.freezeReason ?? null,
    activePathManifestId: row.activePathManifestId ?? null,
    policySetVersion: row.policySetVersion ?? null,
    routingRuleVersion: row.routingRuleVersion ?? null,
    authorityRegistryVersion: row.authorityRegistryVersion ?? null,
    stabilizationOnly: row.stabilizationOnly,
    featureExpansionAllowed: row.featureExpansionAllowed,
    experimentalPathAllowed: row.experimentalPathAllowed,
    structuralRefactorAllowed: row.structuralRefactorAllowed,
    devOnlyPathAllowed: row.devOnlyPathAllowed,
    emergencyRollbackAllowed: row.emergencyRollbackAllowed,
    containmentPriorityEnabled: row.containmentPriorityEnabled,
    auditStrictMode: row.auditStrictMode,
    mergeGateStrictMode: row.mergeGateStrictMode,
    canonicalSlot: row.canonicalSlot ?? null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Snapshot Mapper
// ══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbToSnapshot(row: any): PersistedSnapshot {
  return {
    id: row.id,
    baselineId: row.baselineId,
    snapshotType: row.snapshotType,
    configChecksum: row.configChecksum ?? null,
    flagChecksum: row.flagChecksum ?? null,
    routingChecksum: row.routingChecksum ?? null,
    authorityChecksum: row.authorityChecksum ?? null,
    policyChecksum: row.policyChecksum ?? null,
    queueTopologyChecksum: row.queueTopologyChecksum ?? null,
    includedScopes: jsonToStringArray(row.includedScopes),
    restoreVerificationStatus: row.restoreVerificationStatus ?? null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Authority Line Mapper
// ══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbToAuthorityLine(row: any): PersistedAuthorityLine {
  return {
    id: row.id,
    authorityLineId: row.authorityLineId,
    currentAuthorityId: row.currentAuthorityId,
    authorityState: row.authorityState,
    transferState: row.transferState,
    pendingSuccessorId: row.pendingSuccessorId ?? null,
    revokedAuthorityIds: jsonToStringArray(row.revokedAuthorityIds),
    registryVersion: row.registryVersion,
    baselineId: row.baselineId ?? null,
    correlationId: row.correlationId ?? null,
    updatedBy: row.updatedBy ?? null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Incident Mapper
// ══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbToIncident(row: any): PersistedIncident {
  return {
    id: row.id,
    incidentId: row.incidentId,
    reasonCode: row.reasonCode,
    severity: row.severity,
    status: row.status,
    correlationId: row.correlationId,
    baselineId: row.baselineId ?? null,
    snapshotId: row.snapshotId ?? null,
    acknowledgedBy: row.acknowledgedBy ?? null,
    acknowledgedAt: row.acknowledgedAt ? new Date(row.acknowledgedAt) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Stabilization Audit Event Mapper
// ══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbToStabilizationAuditEvent(row: any): PersistedStabilizationAuditEvent {
  return {
    id: row.id,
    eventId: row.eventId,
    eventType: row.eventType,
    correlationId: row.correlationId,
    incidentId: row.incidentId ?? null,
    baselineId: row.baselineId ?? null,
    snapshotId: row.snapshotId ?? null,
    actor: row.actor ?? null,
    reasonCode: row.reasonCode ?? null,
    severity: row.severity ?? null,
    sourceModule: row.sourceModule ?? null,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    resultStatus: row.resultStatus ?? null,
    occurredAt: new Date(row.occurredAt),
    recordedAt: new Date(row.recordedAt),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Audit Event Mapper
// ══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbToCanonicalAuditEvent(row: any): PersistedCanonicalAuditEvent {
  return {
    id: row.id,
    eventId: row.eventId,
    eventType: row.eventType,
    eventStage: row.eventStage ?? null,
    correlationId: row.correlationId,
    incidentId: row.incidentId ?? null,
    timelineId: row.timelineId,
    baselineId: row.baselineId ?? null,
    baselineVersion: row.baselineVersion ?? null,
    baselineHash: row.baselineHash ?? null,
    lifecycleState: row.lifecycleState ?? null,
    releaseMode: row.releaseMode ?? null,
    actor: row.actor ?? null,
    sourceModule: row.sourceModule,
    entityType: row.entityType,
    entityId: row.entityId,
    reasonCode: row.reasonCode,
    severity: row.severity,
    occurredAt: new Date(row.occurredAt),
    recordedAt: new Date(row.recordedAt),
    snapshotBeforeId: row.snapshotBeforeId ?? null,
    snapshotAfterId: row.snapshotAfterId ?? null,
    affectedScopes: jsonToStringArray(row.affectedScopes),
    resultStatus: row.resultStatus,
    parentEventId: row.parentEventId ?? null,
  };
}
