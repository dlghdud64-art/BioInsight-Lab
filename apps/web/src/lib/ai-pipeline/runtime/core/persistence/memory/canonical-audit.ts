/**
 * P1-1 Slice-1D — MemoryCanonicalAuditRepository
 *
 * In-memory array-backed canonical audit event store. Append-only.
 * Supports reconstruction chain via parentEventId.
 *
 * Bridge note: mirrors the legacy `_auditLog[]` + `_writtenIds` Set.
 * TODO(Slice-1E): wire runtime callers to use this repository.
 */

import type { CanonicalAuditRepository } from "../repositories";
import type {
  RepositoryResult,
  ListQuery,
  ListResult,
  PersistedCanonicalAuditEvent,
  CreateCanonicalAuditEventInput,
} from "../types";
import { ok, fail } from "../types";
import { applyListQuery } from "./query-helpers";
import { monotoneNow } from "./clock";

let _idCounter = 0;
function nextId(): string {
  return "mem-cae-" + String(++_idCounter);
}

export class MemoryCanonicalAuditRepository implements CanonicalAuditRepository {
  private _store: PersistedCanonicalAuditEvent[] = [];
  private _eventIdSet = new Set<string>();

  async appendCanonicalEvent(
    input: CreateCanonicalAuditEventInput
  ): Promise<RepositoryResult<PersistedCanonicalAuditEvent>> {
    if (this._eventIdSet.has(input.eventId)) {
      return fail("DUPLICATE", `Canonical event eventId=${input.eventId} already exists`, "CanonicalAuditEvent");
    }
    const entity: PersistedCanonicalAuditEvent = {
      id: nextId(),
      eventId: input.eventId,
      eventType: input.eventType,
      eventStage: input.eventStage,
      correlationId: input.correlationId,
      incidentId: input.incidentId,
      timelineId: input.timelineId,
      baselineId: input.baselineId,
      baselineVersion: input.baselineVersion,
      baselineHash: input.baselineHash,
      lifecycleState: input.lifecycleState,
      releaseMode: input.releaseMode,
      actor: input.actor,
      sourceModule: input.sourceModule,
      entityType: input.entityType,
      entityId: input.entityId,
      reasonCode: input.reasonCode,
      severity: input.severity,
      occurredAt: new Date(input.occurredAt),
      recordedAt: monotoneNow(),
      snapshotBeforeId: input.snapshotBeforeId,
      snapshotAfterId: input.snapshotAfterId,
      affectedScopes: [...input.affectedScopes],
      resultStatus: input.resultStatus,
      parentEventId: input.parentEventId,
    };
    this._store.push(entity);
    this._eventIdSet.add(entity.eventId);
    return ok(this._clone(entity));
  }

  async findCanonicalEventByEventId(
    eventId: string
  ): Promise<RepositoryResult<PersistedCanonicalAuditEvent>> {
    const entry = this._store.find((e) => e.eventId === eventId);
    if (!entry) {
      return fail("NOT_FOUND", `Canonical event eventId=${eventId} not found`, "CanonicalAuditEvent");
    }
    return ok(this._clone(entry));
  }

  async listCanonicalEventsByCorrelationId(
    correlationId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    return this._listBy((e) => e.correlationId === correlationId, query);
  }

  async listCanonicalEventsByTimelineId(
    timelineId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    return this._listBy((e) => e.timelineId === timelineId, query);
  }

  async listCanonicalEventsByIncidentId(
    incidentId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    return this._listBy((e) => e.incidentId === incidentId, query);
  }

  async listCanonicalEventsByParentEventId(
    parentEventId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    return this._listBy((e) => e.parentEventId === parentEventId, query);
  }

  private async _listBy(
    predicate: (e: PersistedCanonicalAuditEvent) => boolean,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    const filtered = this._store.filter(predicate);
    const result = applyListQuery(filtered, query, "occurredAt");
    return ok({ items: result.items.map((i) => this._clone(i)), nextCursor: result.nextCursor });
  }

  private _clone(entity: PersistedCanonicalAuditEvent): PersistedCanonicalAuditEvent {
    return JSON.parse(JSON.stringify(entity));
  }

  _reset(): void {
    this._store.length = 0;
    this._eventIdSet.clear();
  }
}
