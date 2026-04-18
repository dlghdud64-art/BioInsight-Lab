/**
 * P1-3 — Recovery State Machine Types
 *
 * Defines the INCIDENT_LOCKDOWN → ACTIVE_100 recovery path contract.
 * Sequential state advancement only — no skip, no implicit unlock.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Recovery State
// ══════════════════════════════════════════════════════════════════════════════

export type RecoveryState =
  | "LOCKDOWN_ACTIVE"
  | "RECOVERY_REQUESTED"
  | "RECOVERY_VALIDATED"
  | "RECOVERY_LOCKED"
  | "RECOVERY_EXECUTING"
  | "RECOVERY_VERIFIED"
  | "RECOVERY_RESTORED"
  | "RECOVERY_FAILED"
  | "RECOVERY_ESCALATED";

/**
 * Ordered state sequence. advanceRecoveryState() enforces
 * that transitions follow this order exactly.
 * RECOVERY_FAILED and RECOVERY_ESCALATED are terminal branches.
 */
export const RECOVERY_STATE_ORDER: readonly RecoveryState[] = [
  "LOCKDOWN_ACTIVE",
  "RECOVERY_REQUESTED",
  "RECOVERY_VALIDATED",
  "RECOVERY_LOCKED",
  "RECOVERY_EXECUTING",
  "RECOVERY_VERIFIED",
  "RECOVERY_RESTORED",
] as const;

/** Terminal failure states — reachable from RECOVERY_REQUESTED, RECOVERY_EXECUTING */
export const RECOVERY_FAILURE_STATES: readonly RecoveryState[] = [
  "RECOVERY_FAILED",
  "RECOVERY_ESCALATED",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// Recovery Execution Stage
// ══════════════════════════════════════════════════════════════════════════════

export type RecoveryStage =
  | "PRE_RECOVERY_VALIDATION"
  | "RESTORE_RECONCILE"
  | "LOCK_CLEANUP_VALIDATION"
  | "AUTHORITY_CONTINUITY_RECHECK"
  | "AUDIT_HOP_COMPLETENESS"
  | "ACTIVE_MODE_ELIGIBILITY"
  | "LIFECYCLE_TRANSITION";

export const RECOVERY_STAGE_ORDER: readonly RecoveryStage[] = [
  "PRE_RECOVERY_VALIDATION",
  "RESTORE_RECONCILE",
  "LOCK_CLEANUP_VALIDATION",
  "AUTHORITY_CONTINUITY_RECHECK",
  "AUDIT_HOP_COMPLETENESS",
  "ACTIVE_MODE_ELIGIBILITY",
  "LIFECYCLE_TRANSITION",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// Precondition Result
// ══════════════════════════════════════════════════════════════════════════════

export interface RecoveryPreconditionResult {
  name: string;
  passed: boolean;
  detail: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Override Metadata
// ══════════════════════════════════════════════════════════════════════════════

export interface RecoveryOverrideMetadata {
  overrideReason: string;
  operatorId: string;
  signOffMeta: Record<string, string>;
  scope: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Stage Result
// ══════════════════════════════════════════════════════════════════════════════

export interface RecoveryStageResult {
  stage: RecoveryStage;
  passed: boolean;
  detail: string;
  timestamp: Date;
}

// ══════════════════════════════════════════════════════════════════════════════
// Recovery Record (singleton — one recovery at a time)
// ══════════════════════════════════════════════════════════════════════════════

export interface RecoveryRecord {
  recoveryId: string;
  correlationId: string;
  actor: string;
  reason: string;
  currentState: RecoveryState;
  baselineId: string;
  incidentId?: string;
  preconditionResults: RecoveryPreconditionResult[];
  overrideMetadata?: RecoveryOverrideMetadata;
  stages: RecoveryStageResult[];
  startedAt: Date;
  completedAt?: Date;
  failReason?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Recovery Result (returned from coordinator functions)
// ══════════════════════════════════════════════════════════════════════════════

export interface RecoveryResult {
  success: boolean;
  recoveryId: string;
  finalState: RecoveryState;
  reasonCode: string;
  detail: string;
  stagesCompleted: RecoveryStage[];
}
