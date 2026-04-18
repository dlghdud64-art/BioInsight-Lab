/**
 * P1-2 — Distributed Lock Types & Reason Codes
 *
 * Type definitions for the distributed lock contract.
 * Separate from RepositoryResult to keep lock-specific
 * reason codes distinct from generic repo error codes.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Lock Target
// ══════════════════════════════════════════════════════════════════════════════

export type LockTarget =
  | "CANONICAL_BASELINE"
  | "AUTHORITY_LINE"
  | "INCIDENT_STREAM"
  | "SNAPSHOT_RESTORE"
  | "INCIDENT_LOCKDOWN_RECOVERY";

// ══════════════════════════════════════════════════════════════════════════════
// Persisted Lock
// ══════════════════════════════════════════════════════════════════════════════

export interface PersistedLock {
  id: string;
  lockKey: string;
  lockOwner: string;
  lockToken: string;
  targetType: LockTarget;
  reason: string;
  correlationId: string;
  acquiredAt: Date;
  expiresAt: Date;
}

// ══════════════════════════════════════════════════════════════════════════════
// Lock Acquire Request
// ══════════════════════════════════════════════════════════════════════════════

export interface LockAcquireRequest {
  lockKey: string;
  lockOwner: string;
  targetType: LockTarget;
  reason: string;
  correlationId: string;
  /** Time-to-live in milliseconds */
  ttlMs: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// Lock Result (discriminated union)
// ══════════════════════════════════════════════════════════════════════════════

export type LockResult<T> =
  | { acquired: true; data: T }
  | { acquired: false; reasonCode: LockReasonCode; message: string };

// ── Result Constructors ──

export function lockOk<T>(data: T): LockResult<T> {
  return { acquired: true, data };
}

export function lockFail<T>(
  reasonCode: LockReasonCode,
  message: string
): LockResult<T> {
  return { acquired: false, reasonCode, message };
}

// ══════════════════════════════════════════════════════════════════════════════
// Lock Reason Codes
// ══════════════════════════════════════════════════════════════════════════════

export type LockReasonCode =
  | "LOCK_ACQUIRE_CONFLICT"
  | "LOCK_OWNER_MISMATCH"
  | "LOCK_EXPIRED"
  | "LOCK_RENEW_AFTER_EXPIRY"
  | "LOCK_RELEASE_WITHOUT_OWNERSHIP"
  | "DUPLICATE_CANONICAL_BASELINE_BLOCKED"
  | "AUTHORITY_MUTATION_REQUIRES_LOCK"
  | "SNAPSHOT_RESTORE_LOCK_REQUIRED"
  | "INCIDENT_STREAM_LOCK_REQUIRED"
  | "RECOVERY_LOCK_REQUIRED";

export const LOCK_REASON_CODES = {
  LOCK_ACQUIRE_CONFLICT: "LOCK_ACQUIRE_CONFLICT" as const,
  LOCK_OWNER_MISMATCH: "LOCK_OWNER_MISMATCH" as const,
  LOCK_EXPIRED: "LOCK_EXPIRED" as const,
  LOCK_RENEW_AFTER_EXPIRY: "LOCK_RENEW_AFTER_EXPIRY" as const,
  LOCK_RELEASE_WITHOUT_OWNERSHIP: "LOCK_RELEASE_WITHOUT_OWNERSHIP" as const,
  DUPLICATE_CANONICAL_BASELINE_BLOCKED: "DUPLICATE_CANONICAL_BASELINE_BLOCKED" as const,
  AUTHORITY_MUTATION_REQUIRES_LOCK: "AUTHORITY_MUTATION_REQUIRES_LOCK" as const,
  SNAPSHOT_RESTORE_LOCK_REQUIRED: "SNAPSHOT_RESTORE_LOCK_REQUIRED" as const,
  INCIDENT_STREAM_LOCK_REQUIRED: "INCIDENT_STREAM_LOCK_REQUIRED" as const,
  RECOVERY_LOCK_REQUIRED: "RECOVERY_LOCK_REQUIRED" as const,
};
