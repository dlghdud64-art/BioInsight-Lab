/**
 * P1-1 Slice-1C — PrismaCanonicalAuditRepository
 *
 * Append-only. Supports reconstruction chain via parentEventId.
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
import { mapDbToCanonicalAuditEvent, stringArrayToJson } from "./mappers";
import { buildOrderBy, buildPagination, isUniqueConstraintError } from "./query-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

export class PrismaCanonicalAuditRepository implements CanonicalAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async appendCanonicalEvent(
    input: CreateCanonicalAuditEventInput
  ): Promise<RepositoryResult<PersistedCanonicalAuditEvent>> {
    try {
      const row = await this.prisma.canonicalAuditEvent.create({
        data: {
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
          occurredAt: input.occurredAt,
          // recordedAt: set by DB default (now())
          snapshotBeforeId: input.snapshotBeforeId,
          snapshotAfterId: input.snapshotAfterId,
          affectedScopes: stringArrayToJson(input.affectedScopes),
          resultStatus: input.resultStatus,
          parentEventId: input.parentEventId,
        },
      });
      return ok(mapDbToCanonicalAuditEvent(row));
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return fail("DUPLICATE", `Canonical event eventId=${input.eventId} already exists`, "CanonicalAuditEvent");
      }
      return fail("STORAGE_UNAVAILABLE", "Failed to append canonical event", "CanonicalAuditEvent", e);
    }
  }

  async findCanonicalEventByEventId(
    eventId: string
  ): Promise<RepositoryResult<PersistedCanonicalAuditEvent>> {
    try {
      const row = await this.prisma.canonicalAuditEvent.findUnique({
        where: { eventId },
      });
      if (!row) {
        return fail("NOT_FOUND", `Canonical event eventId=${eventId} not found`, "CanonicalAuditEvent");
      }
      return ok(mapDbToCanonicalAuditEvent(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find canonical event", "CanonicalAuditEvent", e);
    }
  }

  async listCanonicalEventsByCorrelationId(
    correlationId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    return this._listBy({ correlationId }, query);
  }

  async listCanonicalEventsByTimelineId(
    timelineId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    return this._listBy({ timelineId }, query);
  }

  async listCanonicalEventsByIncidentId(
    incidentId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    return this._listBy({ incidentId }, query);
  }

  async listCanonicalEventsByParentEventId(
    parentEventId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    return this._listBy({ parentEventId }, query);
  }

  // ── Private ──

  private async _listBy(
    where: Record<string, string>,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    try {
      const pagination = buildPagination(query);
      const orderBy = buildOrderBy(query, "occurredAt");
      const rows = await this.prisma.canonicalAuditEvent.findMany({
        where,
        orderBy,
        ...pagination,
      });
      const items = rows.map(mapDbToCanonicalAuditEvent);
      const nextCursor = items.length === (pagination.take ?? 100) ? items[items.length - 1].id : null;
      return ok({ items, nextCursor });
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to list canonical events", "CanonicalAuditEvent", e);
    }
  }
}
