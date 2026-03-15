/**
 * P1-1 Slice-1D — MemoryBaselineRepository
 *
 * In-memory Map-backed baseline store.
 * Singleton constraint: only one canonical baseline allowed.
 * Optimistic locking on updateBaseline via updatedAt comparison.
 *
 * Bridge note: mirrors the legacy `_canonicalBaseline` singleton pattern.
 * TODO(Slice-1E): wire runtime callers to use this repository instead of direct variable access.
 */

import type { BaselineRepository } from "../repositories";
import type {
  RepositoryResult,
  PersistedBaseline,
  CreateBaselineInput,
  OptimisticUpdate,
} from "../types";
import { ok, fail } from "../types";
import { monotoneNow } from "./clock";

let _idCounter = 0;
function nextId(): string {
  return "mem-bl-" + String(++_idCounter);
}

export class MemoryBaselineRepository implements BaselineRepository {
  private _store = new Map<string, PersistedBaseline>();

  async getCanonicalBaseline(): Promise<RepositoryResult<PersistedBaseline>> {
    // Return the most recently created baseline (singleton pattern)
    const entries = Array.from(this._store.values());
    if (entries.length === 0) {
      return fail("NOT_FOUND", "No canonical baseline exists", "StabilizationBaseline");
    }
    // Sort by createdAt desc, take first
    entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return ok(this._clone(entries[0]));
  }

  async saveBaseline(input: CreateBaselineInput): Promise<RepositoryResult<PersistedBaseline>> {
    // Singleton: reject if one already exists
    if (this._store.size > 0) {
      return fail("DUPLICATE", "Canonical baseline already exists. Use updateBaseline instead.", "StabilizationBaseline");
    }
    // P1-2: canonicalSlot uniqueness enforcement
    if (input.canonicalSlot) {
      for (const entry of Array.from(this._store.values())) {
        if (entry.canonicalSlot === input.canonicalSlot) {
          return fail("DUPLICATE", `Canonical slot "${input.canonicalSlot}" already occupied by baseline id=${entry.id}`, "StabilizationBaseline");
        }
      }
    }
    const now = monotoneNow();
    const entity: PersistedBaseline = {
      id: nextId(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this._store.set(entity.id, entity);
    return ok(this._clone(entity));
  }

  async updateBaseline(update: OptimisticUpdate<PersistedBaseline>): Promise<RepositoryResult<PersistedBaseline>> {
    const { id, expectedUpdatedAt, patch } = update;
    const existing = this._store.get(id);
    if (!existing) {
      return fail("NOT_FOUND", `Baseline id=${id} not found`, "StabilizationBaseline");
    }
    if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      return fail(
        "OPTIMISTIC_LOCK_CONFLICT",
        `Baseline id=${id} was modified (expected updatedAt=${expectedUpdatedAt.toISOString()}, actual=${existing.updatedAt.toISOString()})`,
        "StabilizationBaseline"
      );
    }
    // Apply patch (exclude id, createdAt, updatedAt)
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeFields } = patch as Record<string, unknown>;
    Object.assign(existing, safeFields, { updatedAt: monotoneNow() });
    return ok(this._clone(existing));
  }

  async findBaselineById(id: string): Promise<RepositoryResult<PersistedBaseline>> {
    const entry = this._store.get(id);
    if (!entry) {
      return fail("NOT_FOUND", `Baseline id=${id} not found`, "StabilizationBaseline");
    }
    return ok(this._clone(entry));
  }

  async findBaselineByVersion(version: string): Promise<RepositoryResult<PersistedBaseline>> {
    for (const entry of Array.from(this._store.values())) {
      if (entry.baselineVersion === version) {
        return ok(this._clone(entry));
      }
    }
    return fail("NOT_FOUND", `Baseline version=${version} not found`, "StabilizationBaseline");
  }

  /** Deep-clone to prevent external mutation of internal store */
  private _clone(entity: PersistedBaseline): PersistedBaseline {
    return JSON.parse(JSON.stringify(entity));
  }

  /** Test-only: reset store */
  _reset(): void {
    this._store.clear();
  }
}
