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
  | "READ_ONLY_STATUS_REFRESH"
  | "RECOVERY_START"
  | "RECOVERY_EXECUTE"
  | "RECOVERY_VERIFY";

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

// ── S2: Containment / Rollback Hardening Types ──

export type BreachType =
  | "UNAUTHORIZED_STATE_MUTATION"
  | "INVALID_ROUTING_MUTATION"
  | "AUTHORITY_INCONSISTENCY"
  | "POLICY_EVALUATION_BREACH"
  | "ACTIVE_RUNTIME_INVARIANT_BREAK"
  | "ROLLBACK_PRECONDITION_FAILURE"
  | "PARTIAL_COMMIT_DETECTION"
  | "DEV_TEST_EXPERIMENTAL_CONTAMINATION";

export type ContainmentStage =
  | "FINAL_CONTAINMENT_START"
  | "ACTIVE_MUTATION_FREEZE"
  | "SIDE_EFFECT_EMISSION_STOP"
  | "ROLLBACK_PRECHECK"
  | "ROLLBACK_EXECUTE"
  | "POST_ROLLBACK_RESIDUE_SCAN"
  | "STATE_RECONCILIATION"
  | "FINAL_CONTAINMENT_FINALIZE";

export const CONTAINMENT_STAGE_ORDER: readonly ContainmentStage[] = [
  "FINAL_CONTAINMENT_START",
  "ACTIVE_MUTATION_FREEZE",
  "SIDE_EFFECT_EMISSION_STOP",
  "ROLLBACK_PRECHECK",
  "ROLLBACK_EXECUTE",
  "POST_ROLLBACK_RESIDUE_SCAN",
  "STATE_RECONCILIATION",
  "FINAL_CONTAINMENT_FINALIZE",
] as const;

export type ContainmentCompletionState =
  | "CONTAINED_AND_RESTORED"
  | "CONTAINED_WITH_INCIDENT_ESCALATION"
  | "CONTAINMENT_FAILED_LOCKDOWN";

export type RollbackScope =
  | "CONFIG"
  | "FLAGS"
  | "ROUTING"
  | "AUTHORITY"
  | "POLICY"
  | "QUEUE_TOPOLOGY"
  | "ACTIVE_RUNTIME_STATE";

export interface BreachEntry {
  breachId: string;
  breachType: BreachType;
  correlationId: string;
  incidentId: string;
  actor: string;
  mutatedScope: string;
  detectedAt: Date;
  detail: string;
}

export interface RollbackPlan {
  planId: string;
  baselineId: string;
  snapshotId: string;
  affectedScopes: RollbackScope[];
  orderedSteps: RollbackStep[];
  reasonCode: string;
  createdAt: Date;
}

export interface RollbackStep {
  scope: RollbackScope;
  order: number;
  precondition: string;
  postcondition: string;
  status: "PENDING" | "EXECUTED" | "FAILED";
  restoreVerified: boolean;
}

export type ResidueSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface ResidueEntry {
  scope: RollbackScope | string;
  path: string;
  description: string;
  expectedValue: unknown;
  actualValue: unknown;
  severity: ResidueSeverity;
  reconcilable: boolean;
}

export interface ResidueScanResult {
  clean: boolean;
  residues: ResidueEntry[];
  hasCritical: boolean;
}

export interface ReconciliationDiff {
  scope: string;
  path: string;
  expected: unknown;
  actual: unknown;
  resolved: boolean;
}

export interface ReconciliationResult {
  success: boolean;
  diffs: ReconciliationDiff[];
  unresolvedCount: number;
}

export interface ContainmentResult {
  completionState: ContainmentCompletionState;
  breachEntry: BreachEntry;
  stagesCompleted: ContainmentStage[];
  rollbackPlan: RollbackPlan | null;
  residueScan: ResidueScanResult | null;
  reconciliation: ReconciliationResult | null;
  incidentEscalated: boolean;
  reason: string;
}

// ── S3: Intake / Routing Integrity Types ──

export type IntakeClassification =
  | "STABILIZATION_VALIDATION"
  | "FINAL_CONTAINMENT"
  | "EMERGENCY_ROLLBACK"
  | "AUDIT_RECONCILIATION"
  | "OBSERVABILITY_SYNC"
  | "INCIDENT_WORKFLOW"
  | "READ_ONLY_STATUS"
  | "DEAD_LETTER_CANDIDATE"
  | "REJECTED_INTAKE";

export type IntakeTerminalOutcome =
  | "ENQUEUED"
  | "DEAD_LETTERED"
  | "REJECTED";

export type QueueDestination =
  | "STABILIZATION_QUEUE"
  | "CONTAINMENT_QUEUE"
  | "ROLLBACK_QUEUE"
  | "AUDIT_QUEUE"
  | "INCIDENT_QUEUE"
  | "STATUS_QUEUE"
  | "DEAD_LETTER_QUEUE";

export interface CanonicalIntake {
  intakeId: string;
  intakeType: string;
  sourceChannel: string;
  requestedAction: string;
  actor: string;
  payloadChecksum: string;
  correlationId: string;
  incidentId?: string;
  receivedAt: Date;
  schemaVersion: string;
  requestedPriority: string;
  requestedDestination?: string;
}

export interface RoutingDecisionObject {
  routingDecisionId: string;
  intakeId: string;
  classification: IntakeClassification;
  resolvedDestination: QueueDestination;
  decisionReason: string;
  reasonCode: string;
  decidedBy: string;
  decidedAt: Date;
  policyVersion: string;
  lifecycleState: string;
  releaseMode: string;
  isVerified: boolean;
  requiresDeadLetter: boolean;
  deadLetterReason?: string;
}

export interface IntakeTraceEvent {
  intakeId: string;
  routingDecisionId?: string;
  correlationId: string;
  incidentId?: string;
  actor: string;
  intakeType: string;
  requestedAction: string;
  requestedDestination?: string;
  resolvedDestination?: string;
  classification?: string;
  reasonCode: string;
  lifecycleState: string;
  releaseMode: string;
  policyVersion: string;
  queueReceiptId?: string;
  stage: string;
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
  | "INCIDENT_ESCALATED"
  | "BREACH_DETECTED"
  | "CONTAINMENT_STARTED"
  | "MUTATION_FROZEN"
  | "ROLLBACK_PRECHECK_PASSED"
  | "ROLLBACK_PRECHECK_FAILED"
  | "ROLLBACK_PLAN_BUILT"
  | "ROLLBACK_STEP_EXECUTED"
  | "RESTORE_APPLY_STARTED"
  | "RESTORE_APPLY_SUCCEEDED"
  | "RESTORE_APPLY_FAILED"
  | "POST_RESTORE_VERIFY_PASSED"
  | "POST_RESTORE_VERIFY_FAILED"
  | "RESIDUE_SCAN_COMPLETED"
  | "DEEP_RESIDUE_DIFF_DETECTED"
  | "RECONCILIATION_COMPLETED"
  | "RECONCILIATION_UNRESOLVED_DIFF"
  | "CONTAINMENT_FINALIZED"
  | "AUTHORITY_TRANSFER_REQUESTED"
  | "AUTHORITY_TRANSFER_LOCKED"
  | "AUTHORITY_FROZEN"
  | "AUTHORITY_REVOKED"
  | "AUTHORITY_ACTIVATED"
  | "AUTHORITY_CONTINUITY_VALIDATED"
  | "AUTHORITY_TRANSFER_ROLLED_BACK"
  | "AUTHORITY_TRANSFER_ESCALATED"
  | "AUTHORITY_TRANSFER_FINALIZED"
  | "LOCK_ACQUIRED"
  | "LOCK_RELEASED"
  | "LOCK_ACQUIRE_CONFLICT"
  | "LOCK_EXPIRED"
  | "LOCK_RENEW_AFTER_EXPIRY"
  | "LOCK_RELEASE_WITHOUT_OWNERSHIP"
  | "STALE_LOCK_DETECTED"
  | "DUPLICATE_CANONICAL_BASELINE_BLOCKED"
  | "INCIDENT_LOCKDOWN_RECOVERY_REQUESTED"
  | "INCIDENT_LOCKDOWN_RECOVERY_VALIDATED"
  | "INCIDENT_LOCKDOWN_RECOVERY_DENIED"
  | "INCIDENT_LOCKDOWN_RECOVERY_EXECUTING"
  | "INCIDENT_LOCKDOWN_RECOVERY_VERIFIED"
  | "INCIDENT_LOCKDOWN_RECOVERY_RESTORED"
  | "INCIDENT_LOCKDOWN_RECOVERY_FAILED"
  | "INCIDENT_LOCKDOWN_RECOVERY_ESCALATED"
  | "LOCKDOWN_OVERRIDE_USED";

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
