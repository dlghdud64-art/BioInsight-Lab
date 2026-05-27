/**
 * P1-1 Slice-1D — MemorySnapshotRepository
 *
 * In-memory Map-backed snapshot store. Immutable after creation
 * except for restoreVerificationStatus.
 */

import type { SnapshotRepository } from "../repositories";
import type {
  RepositoryResult,
  ListQuery,
  ListResult,
  PersistedSnapshot,
  CreateSnapshotInput,
} from "../types";
import { ok, fail } from "../types";
import { applyListQuery } from "./query-helpers";
import { monotoneNow } from "./clock";

let _idCounter = 0;
function nextId(): string {
  return "mem-snap-" + String(++_idCounter);
}

export class MemorySnapshotRepository implements SnapshotRepository {
  private _store = new Map<string, PersistedSnapshot>();

  async saveSnapshot(input: CreateSnapshotInput): Promise<RepositoryResult<PersistedSnapshot>> {
    const now = monotoneNow();
    const entity: PersistedSnapshot = {
      id: nextId(),
      baselineId: input.baselineId,
      snapshotType: input.snapshotType,
      configChecksum: input.configChecksum,
      flagChecksum: input.flagChecksum,
      routingChecksum: input.routingChecksum,
      authorityChecksum: input.authorityChecksum,
      policyChecksum: input.policyChecksum,
      queueTopologyChecksum: input.queueTopologyChecksum,
      includedScopes: [...input.includedScopes],
      restoreVerificationStatus: input.restoreVerificationStatus,
      scopePayload: input.scopePayload ?? null,
      configPayload: input.configPayload ?? null,
      capturedBy: input.capturedBy ?? null,
      snapshotId: input.snapshotId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this._store.set(entity.id, entity);
    return ok(this._clone(entity));
  }

  async findSnapshotById(id: string): Promise<RepositoryResult<PersistedSnapshot>> {
    const entry = this._store.get(id);
    if (!entry) {
      return fail("NOT_FOUND", `Snapshot id=${id} not found`, "StabilizationSnapshot");
    }
    return ok(this._clone(entry));
  }

  async findSnapshotBySnapshotId(snapshotId: string): Promise<RepositoryResult<PersistedSnapshot>> {
    const entry = Array.from(this._store.values()).find((s) => s.snapshotId === snapshotId);
    if (!entry) {
      return fail("NOT_FOUND", `Snapshot snapshotId=${snapshotId} not found`, "StabilizationSnapshot");
    }
    return ok(this._clone(entry));
  }

  async findSnapshotsByBaselineId(
    baselineId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedSnapshot>>> {
    const all = Array.from(this._store.values()).filter((s) => s.baselineId === baselineId);
    const result = applyListQuery(all, query, "createdAt");
    return ok({ items: result.items.map((i) => this._clone(i)), nextCursor: result.nextCursor });
  }

  async updateSnapshotRestoreVerification(
    id: string,
    status: string
  ): Promise<RepositoryResult<PersistedSnapshot>> {
    const entry = this._store.get(id);
    if (!entry) {
      return fail("NOT_FOUND", `Snapshot id=${id} not found`, "StabilizationSnapshot");
    }
    entry.restoreVerificationStatus = status;
    entry.updatedAt = monotoneNow();
    return ok(this._clone(entry));
  }

  private _clone(entity: PersistedSnapshot): PersistedSnapshot {
    return JSON.parse(JSON.stringify(entity));
  }

  _reset(): void {
    this._store.clear();
  }
}
