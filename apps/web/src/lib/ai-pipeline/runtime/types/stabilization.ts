/**
 * S0 — Stabilization Types
 * canonical baseline source: PACKAGE1_COMPLETE_NEW_AI_INTEGRATED
 */

// ── Enums ──

export type LifecycleState =
  | "SHADOW"
  | "ACTIVE_5"
  | "ACTIVE_25"
  | "ACTIVE_50"
  | "ACTIVE_100"
  | "KILLED";

export type ReleaseMode =
  | "CANARY_ROLLOUT"
  | "FULL_ACTIVE_STABILIZATION"
  | "POST_STABILIZATION";

export type BaselineStatus =
  | "UNFROZEN"
  | "FROZEN"
  | "INVALIDATED";

// ── Snapshot Scope ──

export type SnapshotScope =
  | "CONFIG"
  | "FLAGS"
  | "ROUTING"
  | "AUTHORITY"
  | "POLICY"
  | "QUEUE_TOPOLOGY";

export const ALL_SNAPSHOT_SCOPES: readonly SnapshotScope[] = [
  "CONFIG",
  "FLAGS",
  "ROUTING",
  "AUTHORITY",
  "POLICY",
  "QUEUE_TOPOLOGY",
] as const;

// ── Baseline Snapshot ──

export interface BaselineSnapshot {
  snapshotId: string;
  baselineId: string;
  tag: "ACTIVE" | "ROLLBACK";
  scopes: SnapshotScopeEntry[];
  capturedAt: Date;
  capturedBy: string;
  config: Record<string, unknown>;
}

export interface SnapshotScopeEntry {
  scope: SnapshotScope;
  data: Record<string, unknown>;
  checksum: string;
}

// ── Baseline Registry ──

export interface BaselineRegistry {
  canonicalBaselineId: string;
  baselineVersion: string;
  baselineHash: string;
  baselineSource: "PACKAGE1_COMPLETE_NEW_AI_INTEGRATED";
  baselineStatus: BaselineStatus;
  lifecycleState: LifecycleState;
  releaseMode: ReleaseMode;
  activeSnapshotId: string;
  rollbackSnapshotId: string;
  freezeReason: string;
  activePathManifestId: string;
  policySetVersion: string;
  routingRuleVersion: string;
  authorityRegistryVersion: string;
  documentType: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Stabilization Change Policy ──

export type AllowedChangeClass =
  | "ROLLBACK_RELIABILITY_FIX"
  | "CONTAINMENT_HARDENING"
  | "ROUTING_INTEGRITY_FIX"
  | "AUTHORITY_CONSISTENCY_FIX"
  | "AUDIT_COMPLETENESS_FIX"
  | "OBSERVABILITY_FIX";

export type BlockedChangeClass =
  | "NEW_FEATURE"
  | "EXPERIMENTAL_FLAG"
  | "LARGE_REFACTOR"
  | "UX_SCOPE_EXPANSION"
  | "NAMING_ONLY_CHANGE"
  | "LAYOUT_CHURN";

export interface ChangeRequestMetadata {
  stabilizationTag: string;
  changeClass: AllowedChangeClass;
  justification: string;
  rollbackImpact: string;
  auditLink: string;
}

export interface StabilizationChangePolicy {
  stabilizationOnly: true;
  featureExpansionAllowed: false;
  experimentalPathAllowed: false;
  structuralRefactorAllowed: false;
  devOnlyPathAllowed: false;
  emergencyRollbackAllowed: true;
  containmentPriorityEnabled: true;
  auditStrictMode: true;
  mergeGateStrictMode: true;
  allowedChangeClasses: readonly AllowedChangeClass[];
  blockedChangeClasses: readonly BlockedChangeClass[];
}

export const DEFAULT_STABILIZATION_POLICY: StabilizationChangePolicy = {
  stabilizationOnly: true,
  featureExpansionAllowed: false,
  experimentalPathAllowed: false,
  structuralRefactorAllowed: false,
  devOnlyPathAllowed: false,
  emergencyRollbackAllowed: true,
  containmentPriorityEnabled: true,
  auditStrictMode: true,
  mergeGateStrictMode: true,
  allowedChangeClasses: [
    "ROLLBACK_RELIABILITY_FIX",
    "CONTAINMENT_HARDENING",
    "ROUTING_INTEGRITY_FIX",
    "AUTHORITY_CONSISTENCY_FIX",
    "AUDIT_COMPLETENESS_FIX",
    "OBSERVABILITY_FIX",
  ],
  blockedChangeClasses: [
    "NEW_FEATURE",
    "EXPERIMENTAL_FLAG",
    "LARGE_REFACTOR",
    "UX_SCOPE_EXPANSION",
    "NAMING_ONLY_CHANGE",
    "LAYOUT_CHURN",
  ],
} as const;

// ── Baseline Validation Result ──

export interface BaselineValidationResult {
  valid: boolean;
  checks: BaselineValidationCheck[];
  blocksActiveRuntime: boolean;
  incidentRequired: boolean;
}

export interface BaselineValidationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

// ── Merge Gate ──

export interface MergeGateResult {
  allowed: boolean;
  reason: string;
  missingFields: string[];
}

// ── Audit Events ──

export type StabilizationAuditEventType =
  | "BASELINE_FREEZE"
  | "RELEASE_MODE_CHANGED"
  | "SNAPSHOT_PAIR_CREATED"
  | "FREEZE_GATE_ENABLED"
  | "BOOT_VALIDATION_PASSED"
  | "BOOT_VALIDATION_FAILED";

export interface StabilizationAuditEvent {
  eventId: string;
  eventType: StabilizationAuditEventType;
  baselineId: string;
  baselineVersion: string;
  baselineHash: string;
  snapshotId: string;
  correlationId: string;
  documentType: string;
  performedBy: string;
  detail: string;
  timestamp: Date;
}
