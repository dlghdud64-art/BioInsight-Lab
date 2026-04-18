/**
 * P1-1 Slice-1D — MemoryStabilizationAuditRepository
 *
 * In-memory array-backed audit event store. Append-only.
 *
 * Bridge note: mirrors the legacy `_auditEvents[]` array.
 * TODO(Slice-1E): wire runtime callers to use this repository.
 */

import type { StabilizationAuditRepository } from "../repositories";
import type {
  RepositoryResult,
  ListQuery,
  ListResult,
  PersistedStabilizationAuditEvent,
  CreateStabilizationAuditEventInput,
} from "../types";
import { ok, fail } from "../types";
import { applyListQuery } from "./query-helpers";
import { monotoneNow } from "./clock";

let _idCounter = 0;
function nextId(): string {
  return "mem-sae-" + String(++_idCounter);
}

export class MemoryStabilizationAuditRepository implements StabilizationAuditRepository {
  private _store: PersistedStabilizationAuditEvent[] = [];
  /** Secondary index: eventId → array index (for dedup) */
  private _eventIdSet = new Set<string>();

  async appendAuditEvent(
    input: CreateStabilizationAuditEventInput
  ): Promise<RepositoryResult<PersistedStabilizationAuditEvent>> {
    if (this._eventIdSet.has(input.eventId)) {
      return fail("DUPLICATE", `Audit event eventId=${input.eventId} already exists`, "StabilizationAuditEvent");
    }
    const entity: PersistedStabilizationAuditEvent = {
      id: nextId(),
      eventId: input.eventId,
      eventType: input.eventType,
      correlationId: input.correlationId,
      incidentId: input.incidentId,
      baselineId: input.baselineId,
      snapshotId: input.snapshotId,
      actor: input.actor,
      reasonCode: input.reasonCode,
      severity: input.severity,
      sourceModule: input.sourceModule,
      entityType: input.entityType,
      entityId: input.entityId,
      resultStatus: input.resultStatus,
      occurredAt: new Date(input.occurredAt),
      recordedAt: monotoneNow(),
    };
    this._store.push(entity);
    this._eventIdSet.add(entity.eventId);
    return ok(this._clone(entity));
  }

  async findAuditEventByEventId(
    eventId: string
  ): Promise<RepositoryResult<PersistedStabilizationAuditEvent>> {
    const entry = this._store.find((e) => e.eventId === eventId);
    if (!entry) {
      return fail("NOT_FOUND", `Audit event eventId=${eventId} not found`, "StabilizationAuditEvent");
    }
    return ok(this._clone(entry));
  }

  async listAuditEventsByCorrelationId(
    correlationId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    return this._listBy((e) => e.correlationId === correlationId, query);
  }

  async listAuditEventsByIncidentId(
    incidentId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    return this._listBy((e) => e.incidentId === incidentId, query);
  }

  async listAuditEventsByBaselineId(
    baselineId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    return this._listBy((e) => e.baselineId === baselineId, query);
  }

  async listAuditEventsByEventType(
    eventType: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    return this._listBy((e) => e.eventType === eventType, query);
  }

  private async _listBy(
    predicate: (e: PersistedStabilizationAuditEvent) => boolean,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    const filtered = this._store.filter(predicate);
    const result = applyListQuery(filtered, query, "occurredAt");
    return ok({ items: result.items.map((i) => this._clone(i)), nextCursor: result.nextCursor });
  }

  private _clone(entity: PersistedStabilizationAuditEvent): PersistedStabilizationAuditEvent {
    return JSON.parse(JSON.stringify(entity));
  }

  _reset(): void {
    this._store.length = 0;
    this._eventIdSet.clear();
  }
}
