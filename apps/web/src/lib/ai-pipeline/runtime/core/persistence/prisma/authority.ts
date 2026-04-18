/**
 * P1-1 Slice-1C — PrismaAuthorityRepository
 *
 * 9-state transfer machine. Optimistic locking on updateAuthorityLine.
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
import { mapDbToAuthorityLine, stringArrayToJson } from "./mappers";
import { buildOrderBy, buildPagination, isUniqueConstraintError } from "./query-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

export class PrismaAuthorityRepository implements AuthorityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveAuthorityLine(input: CreateAuthorityLineInput): Promise<RepositoryResult<PersistedAuthorityLine>> {
    try {
      const row = await this.prisma.stabilizationAuthorityLine.create({
        data: {
          authorityLineId: input.authorityLineId,
          currentAuthorityId: input.currentAuthorityId,
          authorityState: input.authorityState,
          transferState: input.transferState,
          pendingSuccessorId: input.pendingSuccessorId,
          revokedAuthorityIds: stringArrayToJson(input.revokedAuthorityIds),
          registryVersion: input.registryVersion,
          baselineId: input.baselineId,
          correlationId: input.correlationId,
          updatedBy: input.updatedBy,
        },
      });
      return ok(mapDbToAuthorityLine(row));
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return fail("DUPLICATE", `Authority line authorityLineId=${input.authorityLineId} already exists`, "StabilizationAuthorityLine");
      }
      return fail("STORAGE_UNAVAILABLE", "Failed to save authority line", "StabilizationAuthorityLine", e);
    }
  }

  async findAuthorityLineById(id: string): Promise<RepositoryResult<PersistedAuthorityLine>> {
    try {
      const row = await this.prisma.stabilizationAuthorityLine.findUnique({ where: { id } });
      if (!row) {
        return fail("NOT_FOUND", `Authority line id=${id} not found`, "StabilizationAuthorityLine");
      }
      return ok(mapDbToAuthorityLine(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find authority line", "StabilizationAuthorityLine", e);
    }
  }

  async findAuthorityLineByLineId(authorityLineId: string): Promise<RepositoryResult<PersistedAuthorityLine>> {
    try {
      const row = await this.prisma.stabilizationAuthorityLine.findUnique({
        where: { authorityLineId },
      });
      if (!row) {
        return fail("NOT_FOUND", `Authority lineId=${authorityLineId} not found`, "StabilizationAuthorityLine");
      }
      return ok(mapDbToAuthorityLine(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find authority line by lineId", "StabilizationAuthorityLine", e);
    }
  }

  async updateAuthorityLine(update: OptimisticUpdate<PersistedAuthorityLine>): Promise<RepositoryResult<PersistedAuthorityLine>> {
    try {
      const { id, expectedUpdatedAt, patch } = update;

      // Prepare safe fields, handle revokedAuthorityIds JSON conversion
      const safeData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(patch)) {
        if (key === "id" || key === "createdAt" || key === "updatedAt") continue;
        if (key === "revokedAuthorityIds" && Array.isArray(value)) {
          safeData[key] = stringArrayToJson(value as string[]);
        } else {
          safeData[key] = value;
        }
      }

      const result = await this.prisma.stabilizationAuthorityLine.updateMany({
        where: { id, updatedAt: expectedUpdatedAt },
        data: safeData,
      });

      if (result.count === 0) {
        const exists = await this.prisma.stabilizationAuthorityLine.findUnique({ where: { id } });
        if (!exists) {
          return fail("NOT_FOUND", `Authority line id=${id} not found`, "StabilizationAuthorityLine");
        }
        return fail(
          "OPTIMISTIC_LOCK_CONFLICT",
          `Authority line id=${id} was modified (expected updatedAt=${expectedUpdatedAt.toISOString()}, actual=${exists.updatedAt.toISOString()})`,
          "StabilizationAuthorityLine"
        );
      }

      const updated = await this.prisma.stabilizationAuthorityLine.findUnique({ where: { id } });
      return ok(mapDbToAuthorityLine(updated));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to update authority line", "StabilizationAuthorityLine", e);
    }
  }

  async findByCorrelationId(
    correlationId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedAuthorityLine>>> {
    try {
      const pagination = buildPagination(query);
      const orderBy = buildOrderBy(query, "createdAt");
      const rows = await this.prisma.stabilizationAuthorityLine.findMany({
        where: { correlationId },
        orderBy,
        ...pagination,
      });
      const items = rows.map(mapDbToAuthorityLine);
      const nextCursor = items.length === (pagination.take ?? 100) ? items[items.length - 1].id : null;
      return ok({ items, nextCursor });
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to list authority lines by correlation", "StabilizationAuthorityLine", e);
    }
  }

  async findByBaselineId(
    baselineId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedAuthorityLine>>> {
    try {
      const pagination = buildPagination(query);
      const orderBy = buildOrderBy(query, "createdAt");
      const rows = await this.prisma.stabilizationAuthorityLine.findMany({
        where: { baselineId },
        orderBy,
        ...pagination,
      });
      const items = rows.map(mapDbToAuthorityLine);
      const nextCursor = items.length === (pagination.take ?? 100) ? items[items.length - 1].id : null;
      return ok({ items, nextCursor });
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to list authority lines by baseline", "StabilizationAuthorityLine", e);
    }
  }

  async listAllAuthorityLines(
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedAuthorityLine>>> {
    try {
      const pagination = buildPagination(query);
      const orderBy = buildOrderBy(query, "createdAt");
      const rows = await this.prisma.stabilizationAuthorityLine.findMany({
        orderBy,
        ...pagination,
      });
      const items = rows.map(mapDbToAuthorityLine);
      const nextCursor = items.length === (pagination.take ?? 100) ? items[items.length - 1].id : null;
      return ok({ items, nextCursor });
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to list all authority lines", "StabilizationAuthorityLine", e);
    }
  }
}
