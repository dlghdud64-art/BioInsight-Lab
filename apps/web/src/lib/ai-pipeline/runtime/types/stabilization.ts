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

// ── S1: Runtime Gate Lock Types ──

export type S1LifecycleState =
  | "PRE_ACTIVE"
  | "ACTIVE_25"
  | "ACTIVE_50"
  | "ACTIVE_75"
  | "ACTIVE_100"
  | "INCIDENT_LOCKDOWN";

export type S1ReleaseMode =
  | "NORMAL"
  | "FULL_ACTIVE_STABILIZATION"
  | "EMERGENCY_ROLLBACK";

// ── Action Permission ──

export type AllowedAction =
  | "EMERGENCY_ROLLBACK_START"
  | "EMERGENCY_ROLLBACK_EXECUTE"
  | "EMERGENCY_ROLLBACK_FINALIZE"
  | "FINAL_CONTAINMENT_START"
  | "FINAL_CONTAINMENT_EXECUTE"
  | "FINAL_CONTAINMENT_FINALIZE"
  | "AUDIT_FLUSH"
  | "AUDIT_RECONCILE"
  | "OBSERVABILITY_SYNC"
  | "STABILIZATION_VALIDATION_RUN"
  | "INCIDENT_ESCALATE"
  | "INCIDENT_ACK"
  | "READ_ONLY_STATUS_REFRESH";

export type BlockedAction =
  | "FEATURE_ENABLE"
  | "FEATURE_EXPAND"
  | "EXPERIMENTAL_PATH_ENABLE"
  | "STRUCTURAL_REFACTOR_APPLY"
  | "UX_SCOPE_EXPAND"
  | "ROUTING_OVERRIDE_UNVERIFIED"
  | "AUTHORITY_OVERRIDE_DIRECT"
  | "DEV_PATH_EXECUTE"
  | "HOTPATCH_WITHOUT_STABILIZATION_TAG"
  | "SILENT_RECOVERY";

export type RuntimeAction = AllowedAction | BlockedAction | string;

// ── Transition Request/Result ──

export interface TransitionRequest {
  currentState: S1LifecycleState;
  targetState: S1LifecycleState;
  releaseMode: S1ReleaseMode;
  baselineStatus: BaselineStatus;
  actor: string;
  reason: string;
  correlationId: string;
}

export interface TransitionResult {
  allowed: boolean;
  reasonCode: string;
  detail: string;
}

// ── Action Permission Result ──

export interface ActionPermissionResult {
  allowed: boolean;
  action: string;
  reasonCode: string;
  detail: string;
}

// ── Reject Event ──

export interface RejectEvent {
  reasonCode: string;
  currentState: S1LifecycleState;
  targetState: S1LifecycleState | null;
  releaseMode: S1ReleaseMode;
  baselineStatus: BaselineStatus;
  requestedAction: string;
  actor: string;
  correlationId: string;
  timestamp: Date;
}

// ── Audit Events ──

export type StabilizationAuditEventType =
  | "BASELINE_FREEZE"
  | "RELEASE_MODE_CHANGED"
  | "SNAPSHOT_PAIR_CREATED"
  | "FREEZE_GATE_ENABLED"
  | "BOOT_VALIDATION_PASSED"
  | "BOOT_VALIDATION_FAILED"
  | "TRANSITION_ALLOWED"
  | "TRANSITION_REJECTED"
  | "ACTION_ALLOWED"
  | "ACTION_DENIED"
  | "INVALID_COMBINATION_REJECTED"
  | "DEV_PATH_BLOCKED"
  | "INCIDENT_ESCALATED";

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
