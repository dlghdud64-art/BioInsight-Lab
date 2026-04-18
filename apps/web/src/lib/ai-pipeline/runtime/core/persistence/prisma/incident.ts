/**
 * P1-1 Slice-1C — PrismaIncidentRepository
 *
 * Incident status lifecycle: OPEN → ACKNOWLEDGED → ESCALATED → RESOLVED → CLOSED
 * Optimistic locking on status transitions and acknowledgement.
 */

import type { IncidentRepository } from "../repositories";
import type {
  RepositoryResult,
  ListQuery,
  ListResult,
  PersistedIncident,
  CreateIncidentInput,
  IncidentStatus,
} from "../types";
import { ok, fail, INCIDENT_STATUS_LIFECYCLE } from "../types";
import { mapDbToIncident } from "./mappers";
import { buildOrderBy, buildPagination, isUniqueConstraintError } from "./query-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

/** Validate that a status transition is allowed (forward-only in lifecycle) */
function isValidStatusTransition(from: string, to: IncidentStatus): boolean {
  const fromIdx = INCIDENT_STATUS_LIFECYCLE.indexOf(from as IncidentStatus);
  const toIdx = INCIDENT_STATUS_LIFECYCLE.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  // Must move forward, not backward
  return toIdx > fromIdx;
}

export class PrismaIncidentRepository implements IncidentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createIncident(input: CreateIncidentInput): Promise<RepositoryResult<PersistedIncident>> {
    try {
      const row = await this.prisma.stabilizationIncident.create({
        data: {
          incidentId: input.incidentId,
          reasonCode: input.reasonCode,
          severity: input.severity,
          status: input.status,
          correlationId: input.correlationId,
          baselineId: input.baselineId,
          snapshotId: input.snapshotId,
        },
      });
      return ok(mapDbToIncident(row));
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return fail("DUPLICATE", `Incident incidentId=${input.incidentId} already exists`, "StabilizationIncident");
      }
      return fail("STORAGE_UNAVAILABLE", "Failed to create incident", "StabilizationIncident", e);
    }
  }

  async findIncidentByIncidentId(incidentId: string): Promise<RepositoryResult<PersistedIncident>> {
    try {
      const row = await this.prisma.stabilizationIncident.findUnique({
        where: { incidentId },
      });
      if (!row) {
        return fail("NOT_FOUND", `Incident incidentId=${incidentId} not found`, "StabilizationIncident");
      }
      return ok(mapDbToIncident(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find incident", "StabilizationIncident", e);
    }
  }

  async updateIncidentStatus(
    incidentId: string,
    newStatus: IncidentStatus,
    expectedUpdatedAt: Date
  ): Promise<RepositoryResult<PersistedIncident>> {
    try {
      // Fetch current to validate transition
      const current = await this.prisma.stabilizationIncident.findUnique({
        where: { incidentId },
      });
      if (!current) {
        return fail("NOT_FOUND", `Incident incidentId=${incidentId} not found`, "StabilizationIncident");
      }

      if (!isValidStatusTransition(current.status, newStatus)) {
        return fail(
          "VALIDATION_FAILED",
          `Invalid status transition: ${current.status} → ${newStatus}`,
          "StabilizationIncident"
        );
      }

      // Optimistic lock: update only if updatedAt matches
      const result = await this.prisma.stabilizationIncident.updateMany({
        where: { incidentId, updatedAt: expectedUpdatedAt },
        data: { status: newStatus },
      });

      if (result.count === 0) {
        return fail(
          "OPTIMISTIC_LOCK_CONFLICT",
          `Incident incidentId=${incidentId} was modified since last read`,
          "StabilizationIncident"
        );
      }

      const updated = await this.prisma.stabilizationIncident.findUnique({ where: { incidentId } });
      return ok(mapDbToIncident(updated));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to update incident status", "StabilizationIncident", e);
    }
  }

  async acknowledgeIncident(
    incidentId: string,
    acknowledgedBy: string,
    expectedUpdatedAt: Date
  ): Promise<RepositoryResult<PersistedIncident>> {
    try {
      const current = await this.prisma.stabilizationIncident.findUnique({
        where: { incidentId },
      });
      if (!current) {
        return fail("NOT_FOUND", `Incident incidentId=${incidentId} not found`, "StabilizationIncident");
      }

      if (current.status !== "OPEN") {
        return fail(
          "VALIDATION_FAILED",
          `Can only acknowledge OPEN incidents, current status=${current.status}`,
          "StabilizationIncident"
        );
      }

      // Optimistic lock
      const result = await this.prisma.stabilizationIncident.updateMany({
        where: { incidentId, updatedAt: expectedUpdatedAt },
        data: {
          status: "ACKNOWLEDGED",
          acknowledgedBy,
          acknowledgedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return fail(
          "OPTIMISTIC_LOCK_CONFLICT",
          `Incident incidentId=${incidentId} was modified since last read`,
          "StabilizationIncident"
        );
      }

      const updated = await this.prisma.stabilizationIncident.findUnique({ where: { incidentId } });
      return ok(mapDbToIncident(updated));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to acknowledge incident", "StabilizationIncident", e);
    }
  }

  async listOpenIncidents(query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedIncident>>> {
    try {
      const pagination = buildPagination(query);
      const orderBy = buildOrderBy(query, "createdAt");
      const rows = await this.prisma.stabilizationIncident.findMany({
        where: { status: { in: ["OPEN", "ACKNOWLEDGED", "ESCALATED"] } },
        orderBy,
        ...pagination,
      });
      const items = rows.map(mapDbToIncident);
      const nextCursor = items.length === (pagination.take ?? 100) ? items[items.length - 1].id : null;
      return ok({ items, nextCursor });
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to list open incidents", "StabilizationIncident", e);
    }
  }

  async findByCorrelationId(
    correlationId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedIncident>>> {
    try {
      const pagination = buildPagination(query);
      const orderBy = buildOrderBy(query, "createdAt");
      const rows = await this.prisma.stabilizationIncident.findMany({
        where: { correlationId },
        orderBy,
        ...pagination,
      });
      const items = rows.map(mapDbToIncident);
      const nextCursor = items.length === (pagination.take ?? 100) ? items[items.length - 1].id : null;
      return ok({ items, nextCursor });
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to list incidents by correlation", "StabilizationIncident", e);
    }
  }

  async findByBaselineId(
    baselineId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedIncident>>> {
    try {
      const pagination = buildPagination(query);
      const orderBy = buildOrderBy(query, "createdAt");
      const rows = await this.prisma.stabilizationIncident.findMany({
        where: { baselineId },
        orderBy,
        ...pagination,
      });
      const items = rows.map(mapDbToIncident);
      const nextCursor = items.length === (pagination.take ?? 100) ? items[items.length - 1].id : null;
      return ok({ items, nextCursor });
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to list incidents by baseline", "StabilizationIncident", e);
    }
  }
}
