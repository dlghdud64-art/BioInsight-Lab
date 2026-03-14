/**
 * P1-1 Slice-1D — MemoryAuthorityRepository
 *
 * In-memory Map-backed authority line store.
 * Optimistic locking on updateAuthorityLine via updatedAt comparison.
 *
 * Bridge note: mirrors the legacy `_registry` Map pattern.
 * TODO(Slice-1E): wire runtime callers to use this repository.
 */

import type { AuthorityRepository } from "../repositories";
import type {
  RepositoryResult,
  ListQuery,
  ListResult,
  PersistedAuthorityLine,
  CreateAuthorityLineInput,
  OptimisticUpdate,
} from "../types";
import { ok, fail } from "../types";
import { applyListQuery } from "./query-helpers";
import { monotoneNow } from "./clock";

let _idCounter = 0;
function nextId(): string {
  return "mem-auth-" + String(++_idCounter);
}

export class MemoryAuthorityRepository implements AuthorityRepository {
  private _store = new Map<string, PersistedAuthorityLine>();
  /** Secondary index: authorityLineId → id */
  private _lineIdIndex = new Map<string, string>();

  async saveAuthorityLine(input: CreateAuthorityLineInput): Promise<RepositoryResult<PersistedAuthorityLine>> {
    if (this._lineIdIndex.has(input.authorityLineId)) {
      return fail("DUPLICATE", `Authority line authorityLineId=${input.authorityLineId} already exists`, "StabilizationAuthorityLine");
    }
    const now = monotoneNow();
    const entity: PersistedAuthorityLine = {
      id: nextId(),
      authorityLineId: input.authorityLineId,
      currentAuthorityId: input.currentAuthorityId,
      authorityState: input.authorityState,
      transferState: input.transferState,
      pendingSuccessorId: input.pendingSuccessorId,
      revokedAuthorityIds: [...input.revokedAuthorityIds],
      registryVersion: input.registryVersion,
      baselineId: input.baselineId,
      correlationId: input.correlationId,
      updatedBy: input.updatedBy,
      createdAt: now,
      updatedAt: now,
    };
    this._store.set(entity.id, entity);
    this._lineIdIndex.set(entity.authorityLineId, entity.id);
    return ok(this._clone(entity));
  }

  async findAuthorityLineById(id: string): Promise<RepositoryResult<PersistedAuthorityLine>> {
    const entry = this._store.get(id);
    if (!entry) {
      return fail("NOT_FOUND", `Authority line id=${id} not found`, "StabilizationAuthorityLine");
    }
    return ok(this._clone(entry));
  }

  async findAuthorityLineByLineId(authorityLineId: string): Promise<RepositoryResult<PersistedAuthorityLine>> {
    const id = this._lineIdIndex.get(authorityLineId);
    if (!id) {
      return fail("NOT_FOUND", `Authority lineId=${authorityLineId} not found`, "StabilizationAuthorityLine");
    }
    return this.findAuthorityLineById(id);
  }

  async updateAuthorityLine(update: OptimisticUpdate<PersistedAuthorityLine>): Promise<RepositoryResult<PersistedAuthorityLine>> {
    const { id, expectedUpdatedAt, patch } = update;
    const existing = this._store.get(id);
    if (!existing) {
      return fail("NOT_FOUND", `Authority line id=${id} not found`, "StabilizationAuthorityLine");
    }
    if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      return fail(
        "OPTIMISTIC_LOCK_CONFLICT",
        `Authority line id=${id} was modified (expected updatedAt=${expectedUpdatedAt.toISOString()}, actual=${existing.updatedAt.toISOString()})`,
        "StabilizationAuthorityLine"
      );
    }
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeFields } = patch as Record<string, unknown>;
    Object.assign(existing, safeFields, { updatedAt: monotoneNow() });
    return ok(this._clone(existing));
  }

  async findByCorrelationId(
    correlationId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedAuthorityLine>>> {
    const filtered = Array.from(this._store.values()).filter((a) => a.correlationId === correlationId);
    const result = applyListQuery(filtered, query, "createdAt");
    return ok({ items: result.items.map((i) => this._clone(i)), nextCursor: result.nextCursor });
  }

  async findByBaselineId(
    baselineId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedAuthorityLine>>> {
    const filtered = Array.from(this._store.values()).filter((a) => a.baselineId === baselineId);
    const result = applyListQuery(filtered, query, "createdAt");
    return ok({ items: result.items.map((i) => this._clone(i)), nextCursor: result.nextCursor });
  }

  private _clone(entity: PersistedAuthorityLine): PersistedAuthorityLine {
    return JSON.parse(JSON.stringify(entity));
  }

  _reset(): void {
    this._store.clear();
    this._lineIdIndex.clear();
  }
}
