/**
 * P1-1 Slice-1C — PrismaStabilizationAuditRepository
 *
 * Append-only. No update or delete operations.
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
import { mapDbToStabilizationAuditEvent } from "./mappers";
import { buildOrderBy, buildPagination, isUniqueConstraintError } from "./query-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

export class PrismaStabilizationAuditRepository implements StabilizationAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async appendAuditEvent(
    input: CreateStabilizationAuditEventInput
  ): Promise<RepositoryResult<PersistedStabilizationAuditEvent>> {
    try {
      const row = await this.prisma.stabilizationAuditEvent.create({
        data: {
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
          occurredAt: input.occurredAt,
          // recordedAt: set by DB default (now())
        },
      });
      return ok(mapDbToStabilizationAuditEvent(row));
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return fail("DUPLICATE", `Audit event eventId=${input.eventId} already exists`, "StabilizationAuditEvent");
      }
      return fail("STORAGE_UNAVAILABLE", "Failed to append audit event", "StabilizationAuditEvent", e);
    }
  }

  async findAuditEventByEventId(
    eventId: string
  ): Promise<RepositoryResult<PersistedStabilizationAuditEvent>> {
    try {
      const row = await this.prisma.stabilizationAuditEvent.findUnique({
        where: { eventId },
      });
      if (!row) {
        return fail("NOT_FOUND", `Audit event eventId=${eventId} not found`, "StabilizationAuditEvent");
      }
      return ok(mapDbToStabilizationAuditEvent(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find audit event", "StabilizationAuditEvent", e);
    }
  }

  async listAuditEventsByCorrelationId(
    correlationId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    return this._listBy({ correlationId }, query);
  }

  async listAuditEventsByIncidentId(
    incidentId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    return this._listBy({ incidentId }, query);
  }

  async listAuditEventsByBaselineId(
    baselineId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    return this._listBy({ baselineId }, query);
  }

  async listAuditEventsByEventType(
    eventType: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    return this._listBy({ eventType }, query);
  }

  // ── Private ──

  private async _listBy(
    where: Record<string, string>,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    try {
      const pagination = buildPagination(query);
      const orderBy = buildOrderBy(query, "occurredAt");
      const rows = await this.prisma.stabilizationAuditEvent.findMany({
        where,
        orderBy,
        ...pagination,
      });
      const items = rows.map(mapDbToStabilizationAuditEvent);
      const nextCursor = items.length === (pagination.take ?? 100) ? items[items.length - 1].id : null;
      return ok({ items, nextCursor });
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to list audit events", "StabilizationAuditEvent", e);
    }
  }
}
