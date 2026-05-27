/**
 * P1-2 — Lock Manager
 *
 * Higher-level lock operations: withLock(), key builders, audit emission.
 * Uses callback injection for audit to avoid circular imports.
 */

import type { LockAcquireRequest, LockResult, LockTarget, PersistedLock } from "./lock-types";
import { lockOk, lockFail } from "./lock-types";
import { getPersistenceAdapters } from "./bootstrap";

// ══════════════════════════════════════════════════════════════════════════════
// Audit Callback (injected to avoid circular dependency)
// ══════════════════════════════════════════════════════════════════════════════

type LockAuditCallback = (eventType: string, detail: string, correlationId: string) => void;

let _auditCallback: LockAuditCallback | null = null;

/**
 * Register a callback for lock audit events.
 * Called once at bootstrap to wire audit-events.emitStabilizationAuditEvent.
 */
export function registerLockAuditCallback(cb: LockAuditCallback): void {
  _auditCallback = cb;
}

function emitLockAudit(eventType: string, detail: string, correlationId: string): void {
  if (_auditCallback) {
    try {
      _auditCallback(eventType, detail, correlationId);
    } catch (_ignored) {
      // Never throw from audit emission
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Lock Key Builders
// ══════════════════════════════════════════════════════════════════════════════

export function canonicalBaselineLockKey(): string {
  return "lock:canonical-baseline";
}

export function authorityLineLockKey(authorityLineId: string): string {
  return "lock:authority-line:" + authorityLineId;
}

export function snapshotRestoreLockKey(baselineId: string): string {
  return "lock:snapshot-restore:" + baselineId;
}

export function incidentStreamLockKey(correlationId: string): string {
  return "lock:incident-stream:" + correlationId;
}

export function recoveryLockKey(recoveryId: string): string {
  return "lock:recovery:" + recoveryId;
}

// ══════════════════════════════════════════════════════════════════════════════
// withLock — Scoped lock pattern
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Acquire a lock, execute fn, then release. Returns LockResult.
 * - acquire failure → fn not called, returns reason code
 * - fn throws → lock released in finally, error re-thrown
 * - release failure → audit warning, no throw
 */
export async function withLock<T>(
  lockKey: string,
  owner: string,
  targetType: LockTarget,
  reason: string,
  correlationId: string,
  ttlMs: number,
  fn: (lock: PersistedLock) => Promise<T>
): Promise<LockResult<T>> {
  const adapters = getPersistenceAdapters();
  const repo = adapters.lock;

  const acquireResult = await repo.acquire({
    lockKey,
    lockOwner: owner,
    targetType,
    reason,
    correlationId,
    ttlMs,
  });

  if (!acquireResult.acquired) {
    emitLockAudit(
      "LOCK_ACQUIRE_CONFLICT",
      `lockKey=${lockKey} owner=${owner} reason=${acquireResult.reasonCode}: ${acquireResult.message}`,
      correlationId
    );
    return lockFail(acquireResult.reasonCode, acquireResult.message);
  }

  const lock = acquireResult.data;
  emitLockAudit(
    "LOCK_ACQUIRED",
    `lockKey=${lockKey} owner=${owner} targetType=${targetType} ttlMs=${ttlMs}`,
    correlationId
  );

  try {
    const result = await fn(lock);
    return lockOk(result);
  } finally {
    const releaseResult = await repo.release(lockKey, lock.lockToken);
    if (releaseResult.acquired) {
      emitLockAudit("LOCK_RELEASED", `lockKey=${lockKey} owner=${owner}`, correlationId);
    } else {
      // Release failed — emit diagnostic but do NOT throw
      emitLockAudit(
        "LOCK_RELEASE_WITHOUT_OWNERSHIP",
        `lockKey=${lockKey} owner=${owner} releaseErr=${releaseResult.message}`,
        correlationId
      );
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Explicit acquire/release (for multi-step flows)
// ══════════════════════════════════════════════════════════════════════════════

export async function acquireLock(request: LockAcquireRequest): Promise<LockResult<PersistedLock>> {
  const adapters = getPersistenceAdapters();
  const result = await adapters.lock.acquire(request);

  if (result.acquired) {
    emitLockAudit(
      "LOCK_ACQUIRED",
      `lockKey=${request.lockKey} owner=${request.lockOwner} targetType=${request.targetType}`,
      request.correlationId
    );
  } else {
    emitLockAudit(
      "LOCK_ACQUIRE_CONFLICT",
      `lockKey=${request.lockKey} owner=${request.lockOwner} reason=${result.reasonCode}`,
      request.correlationId
    );
  }

  return result;
}

export async function releaseLock(lockKey: string, lockToken: string, correlationId?: string): Promise<LockResult<void>> {
  const adapters = getPersistenceAdapters();
  const result = await adapters.lock.release(lockKey, lockToken);

  if (result.acquired) {
    emitLockAudit("LOCK_RELEASED", `lockKey=${lockKey}`, correlationId || "");
  } else {
    emitLockAudit(
      "LOCK_RELEASE_WITHOUT_OWNERSHIP",
      `lockKey=${lockKey} reason=${result.reasonCode}`,
      correlationId || ""
    );
  }

  return result;
}

export async function renewLock(lockKey: string, lockToken: string, ttlMs: number): Promise<LockResult<PersistedLock>> {
  const adapters = getPersistenceAdapters();
  return adapters.lock.renew(lockKey, lockToken, ttlMs);
}

// ══════════════════════════════════════════════════════════════════════════════
// Stale Lock Diagnostics (no auto-recovery)
// ══════════════════════════════════════════════════════════════════════════════

export async function detectStaleLocks(thresholdMs: number): Promise<PersistedLock[]> {
  const adapters = getPersistenceAdapters();
  const stale = await adapters.lock.findStale(thresholdMs);

  if (stale.length > 0) {
    emitLockAudit(
      "STALE_LOCK_DETECTED",
      `count=${stale.length} keys=[${stale.map(function (l) { return l.lockKey; }).join(",")}]`,
      ""
    );
  }

  return stale;
}
