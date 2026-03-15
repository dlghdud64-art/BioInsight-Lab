/**
 * P1-1 Slice-1C — PrismaSnapshotRepository
 *
 * Snapshots are immutable after creation except for restoreVerificationStatus.
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
import { mapDbToSnapshot, stringArrayToJson } from "./mappers";
import { buildOrderBy, buildPagination } from "./query-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

export class PrismaSnapshotRepository implements SnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveSnapshot(input: CreateSnapshotInput): Promise<RepositoryResult<PersistedSnapshot>> {
    try {
      const row = await this.prisma.stabilizationSnapshot.create({
        data: {
          baselineId: input.baselineId,
          snapshotType: input.snapshotType,
          configChecksum: input.configChecksum,
          flagChecksum: input.flagChecksum,
          routingChecksum: input.routingChecksum,
          authorityChecksum: input.authorityChecksum,
          policyChecksum: input.policyChecksum,
          queueTopologyChecksum: input.queueTopologyChecksum,
          includedScopes: stringArrayToJson(input.includedScopes),
          restoreVerificationStatus: input.restoreVerificationStatus,
          scopePayload: input.scopePayload ?? undefined,
          configPayload: input.configPayload ?? undefined,
          capturedBy: input.capturedBy ?? undefined,
          snapshotId: input.snapshotId ?? undefined,
        },
      });
      return ok(mapDbToSnapshot(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to save snapshot", "StabilizationSnapshot", e);
    }
  }

  async findSnapshotById(id: string): Promise<RepositoryResult<PersistedSnapshot>> {
    try {
      const row = await this.prisma.stabilizationSnapshot.findUnique({ where: { id } });
      if (!row) {
        return fail("NOT_FOUND", `Snapshot id=${id} not found`, "StabilizationSnapshot");
      }
      return ok(mapDbToSnapshot(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find snapshot", "StabilizationSnapshot", e);
    }
  }

  async findSnapshotBySnapshotId(snapshotId: string): Promise<RepositoryResult<PersistedSnapshot>> {
    try {
      const row = await this.prisma.stabilizationSnapshot.findFirst({ where: { snapshotId } });
      if (!row) {
        return fail("NOT_FOUND", `Snapshot snapshotId=${snapshotId} not found`, "StabilizationSnapshot");
      }
      return ok(mapDbToSnapshot(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find snapshot by snapshotId", "StabilizationSnapshot", e);
    }
  }

  async findSnapshotsByBaselineId(
    baselineId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedSnapshot>>> {
    try {
      const pagination = buildPagination(query);
      const orderBy = buildOrderBy(query, "createdAt");

      const rows = await this.prisma.stabilizationSnapshot.findMany({
        where: { baselineId },
        orderBy,
        ...pagination,
      });

      const items = rows.map(mapDbToSnapshot);
      const nextCursor = items.length === (pagination.take ?? 100)
        ? items[items.length - 1].id
        : null;

      return ok({ items, nextCursor });
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to list snapshots", "StabilizationSnapshot", e);
    }
  }

  async updateSnapshotRestoreVerification(
    id: string,
    status: string
  ): Promise<RepositoryResult<PersistedSnapshot>> {
    try {
      const row = await this.prisma.stabilizationSnapshot.update({
        where: { id },
        data: { restoreVerificationStatus: status },
      });
      return ok(mapDbToSnapshot(row));
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "P2025") {
        return fail("NOT_FOUND", `Snapshot id=${id} not found`, "StabilizationSnapshot");
      }
      return fail("STORAGE_UNAVAILABLE", "Failed to update snapshot verification", "StabilizationSnapshot", e);
    }
  }
}
