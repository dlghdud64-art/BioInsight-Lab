/**
 * P1-2 — Lock Repository Interface
 *
 * Distributed lock contract for multi-instance safety.
 * Both Memory and Prisma adapters implement this interface.
 */

import type { LockAcquireRequest, LockResult, PersistedLock } from "./lock-types";

export interface LockRepository {
  /**
   * Attempt atomic lock acquisition.
   * Returns LOCK_ACQUIRE_CONFLICT if key is held by another owner and not expired.
   * Auto-evicts expired locks before acquiring.
   */
  acquire(input: LockAcquireRequest): Promise<LockResult<PersistedLock>>;

  /**
   * Release a lock. Only succeeds if lockToken matches.
   * Returns LOCK_RELEASE_WITHOUT_OWNERSHIP on token mismatch.
   */
  release(lockKey: string, lockToken: string): Promise<LockResult<void>>;

  /**
   * Extend lock TTL. Only succeeds if lockToken matches and lock is not expired.
   * Returns LOCK_RENEW_AFTER_EXPIRY if already expired.
   * Returns LOCK_OWNER_MISMATCH if token doesn't match.
   */
  renew(lockKey: string, lockToken: string, ttlMs: number): Promise<LockResult<PersistedLock>>;

  /**
   * Diagnostic-only: force-expire a lock by setting expiresAt to past.
   * Does NOT auto-acquire for caller. Used for stale lock cleanup.
   */
  forceExpire(lockKey: string): Promise<LockResult<void>>;

  /**
   * Find a lock by key. Returns null if not found.
   */
  findByKey(lockKey: string): Promise<PersistedLock | null>;

  /**
   * Find locks whose expiresAt < now. Diagnostic/alerting only.
   */
  findStale(thresholdMs: number): Promise<PersistedLock[]>;
}
