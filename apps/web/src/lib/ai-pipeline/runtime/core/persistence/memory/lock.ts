/**
 * P1-2 — Memory Lock Repository
 *
 * In-memory implementation of LockRepository for development/testing.
 * Uses Map<lockKey, PersistedLock> with expiry-based eviction.
 */

import type { LockRepository } from "../lock-repository";
import type {
  LockAcquireRequest,
  LockResult,
  PersistedLock,
} from "../lock-types";
import { lockOk, lockFail } from "../lock-types";

let _idCounter = 0;

function generateId(): string {
  _idCounter += 1;
  return "lock_mem_" + _idCounter.toString(36) + "_" + Date.now().toString(36);
}

function generateToken(): string {
  return "tok_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function clone(lock: PersistedLock): PersistedLock {
  return JSON.parse(JSON.stringify(lock));
}

function reviveDates(lock: PersistedLock): PersistedLock {
  lock.acquiredAt = new Date(lock.acquiredAt);
  lock.expiresAt = new Date(lock.expiresAt);
  return lock;
}

export class MemoryLockRepository implements LockRepository {
  private _store: Map<string, PersistedLock> = new Map();

  async acquire(input: LockAcquireRequest): Promise<LockResult<PersistedLock>> {
    const existing = this._store.get(input.lockKey);
    const now = new Date();

    if (existing) {
      // Check if expired — auto-evict
      if (existing.expiresAt.getTime() <= now.getTime()) {
        this._store.delete(input.lockKey);
      } else if (existing.lockOwner !== input.lockOwner) {
        return lockFail(
          "LOCK_ACQUIRE_CONFLICT",
          `Lock "${input.lockKey}" held by "${existing.lockOwner}" until ${existing.expiresAt.toISOString()}`
        );
      } else {
        // Same owner re-acquiring — treat as renewal
        const renewed: PersistedLock = {
          ...existing,
          expiresAt: new Date(now.getTime() + input.ttlMs),
          reason: input.reason,
          correlationId: input.correlationId,
        };
        this._store.set(input.lockKey, renewed);
        return lockOk(reviveDates(clone(renewed)));
      }
    }

    const lock: PersistedLock = {
      id: generateId(),
      lockKey: input.lockKey,
      lockOwner: input.lockOwner,
      lockToken: generateToken(),
      targetType: input.targetType,
      reason: input.reason,
      correlationId: input.correlationId,
      acquiredAt: now,
      expiresAt: new Date(now.getTime() + input.ttlMs),
    };

    this._store.set(input.lockKey, lock);
    return lockOk(reviveDates(clone(lock)));
  }

  async release(lockKey: string, lockToken: string): Promise<LockResult<void>> {
    const existing = this._store.get(lockKey);
    if (!existing) {
      return lockFail("LOCK_RELEASE_WITHOUT_OWNERSHIP", `No lock found for key "${lockKey}"`);
    }
    if (existing.lockToken !== lockToken) {
      return lockFail(
        "LOCK_RELEASE_WITHOUT_OWNERSHIP",
        `Lock token mismatch for key "${lockKey}"`
      );
    }
    this._store.delete(lockKey);
    return lockOk(undefined as void);
  }

  async renew(lockKey: string, lockToken: string, ttlMs: number): Promise<LockResult<PersistedLock>> {
    const existing = this._store.get(lockKey);
    if (!existing) {
      return lockFail("LOCK_OWNER_MISMATCH", `No lock found for key "${lockKey}"`);
    }
    if (existing.lockToken !== lockToken) {
      return lockFail("LOCK_OWNER_MISMATCH", `Lock token mismatch for key "${lockKey}"`);
    }
    const now = new Date();
    if (existing.expiresAt.getTime() <= now.getTime()) {
      return lockFail("LOCK_RENEW_AFTER_EXPIRY", `Lock "${lockKey}" already expired at ${existing.expiresAt.toISOString()}`);
    }
    existing.expiresAt = new Date(now.getTime() + ttlMs);
    this._store.set(lockKey, existing);
    return lockOk(reviveDates(clone(existing)));
  }

  async forceExpire(lockKey: string): Promise<LockResult<void>> {
    const existing = this._store.get(lockKey);
    if (!existing) {
      return lockFail("LOCK_OWNER_MISMATCH", `No lock found for key "${lockKey}"`);
    }
    existing.expiresAt = new Date(0);
    return lockOk(undefined as void);
  }

  async findByKey(lockKey: string): Promise<PersistedLock | null> {
    const existing = this._store.get(lockKey);
    if (!existing) return null;
    return reviveDates(clone(existing));
  }

  async findStale(_thresholdMs: number): Promise<PersistedLock[]> {
    const now = new Date();
    const stale: PersistedLock[] = [];
    for (const lock of this._store.values()) {
      if (lock.expiresAt.getTime() < now.getTime()) {
        stale.push(reviveDates(clone(lock)));
      }
    }
    return stale;
  }

  /** Test-only: reset all locks */
  _reset(): void {
    this._store.clear();
    _idCounter = 0;
  }
}
