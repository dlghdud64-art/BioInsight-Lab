/**
 * P1-1 Slice-1C — PrismaBaselineRepository
 *
 * Singleton constraint: only one canonical baseline allowed.
 * Optimistic locking on updateBaseline via updatedAt comparison.
 */

import type { BaselineRepository } from "../repositories";
import type {
  RepositoryResult,
  PersistedBaseline,
  CreateBaselineInput,
  OptimisticUpdate,
} from "../types";
import { ok, fail } from "../types";
import { mapDbToBaseline } from "./mappers";
import { isUniqueConstraintError } from "./query-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

export class PrismaBaselineRepository implements BaselineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getCanonicalBaseline(): Promise<RepositoryResult<PersistedBaseline>> {
    try {
      const row = await this.prisma.stabilizationBaseline.findFirst({
        orderBy: { createdAt: "desc" },
      });
      if (!row) {
        return fail("NOT_FOUND", "No canonical baseline exists", "StabilizationBaseline");
      }
      return ok(mapDbToBaseline(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to query baseline", "StabilizationBaseline", e);
    }
  }

  async saveBaseline(input: CreateBaselineInput): Promise<RepositoryResult<PersistedBaseline>> {
    try {
      // Singleton: check if one already exists
      const existing = await this.prisma.stabilizationBaseline.findFirst();
      if (existing) {
        return fail("DUPLICATE", "Canonical baseline already exists. Use updateBaseline instead.", "StabilizationBaseline");
      }
      const row = await this.prisma.stabilizationBaseline.create({
        data: {
          baselineSource: input.baselineSource,
          baselineVersion: input.baselineVersion,
          baselineHash: input.baselineHash,
          lifecycleState: input.lifecycleState,
          releaseMode: input.releaseMode,
          baselineStatus: input.baselineStatus,
          activeSnapshotId: input.activeSnapshotId,
          rollbackSnapshotId: input.rollbackSnapshotId,
          freezeReason: input.freezeReason,
          activePathManifestId: input.activePathManifestId,
          policySetVersion: input.policySetVersion,
          routingRuleVersion: input.routingRuleVersion,
          authorityRegistryVersion: input.authorityRegistryVersion,
          stabilizationOnly: input.stabilizationOnly,
          featureExpansionAllowed: input.featureExpansionAllowed,
          experimentalPathAllowed: input.experimentalPathAllowed,
          structuralRefactorAllowed: input.structuralRefactorAllowed,
          devOnlyPathAllowed: input.devOnlyPathAllowed,
          emergencyRollbackAllowed: input.emergencyRollbackAllowed,
          containmentPriorityEnabled: input.containmentPriorityEnabled,
          auditStrictMode: input.auditStrictMode,
          mergeGateStrictMode: input.mergeGateStrictMode,
          canonicalSlot: input.canonicalSlot,
        },
      });
      return ok(mapDbToBaseline(row));
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return fail("DUPLICATE", "Canonical baseline already exists (concurrent create detected).", "StabilizationBaseline");
      }
      return fail("STORAGE_UNAVAILABLE", "Failed to save baseline", "StabilizationBaseline", e);
    }
  }

  async updateBaseline(update: OptimisticUpdate<PersistedBaseline>): Promise<RepositoryResult<PersistedBaseline>> {
    try {
      // Optimistic lock: WHERE id = X AND updatedAt = expectedUpdatedAt
      const { id, expectedUpdatedAt, patch } = update;

      // Remove non-updatable fields from patch
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeFields } = patch as Record<string, unknown>;

      const result = await this.prisma.stabilizationBaseline.updateMany({
        where: {
          id,
          updatedAt: expectedUpdatedAt,
        },
        data: safeFields,
      });

      if (result.count === 0) {
        // Determine if NOT_FOUND or CONFLICT
        const exists = await this.prisma.stabilizationBaseline.findUnique({ where: { id } });
        if (!exists) {
          return fail("NOT_FOUND", `Baseline id=${id} not found`, "StabilizationBaseline");
        }
        return fail(
          "OPTIMISTIC_LOCK_CONFLICT",
          `Baseline id=${id} was modified since last read (expected updatedAt=${expectedUpdatedAt.toISOString()}, actual=${exists.updatedAt.toISOString()})`,
          "StabilizationBaseline"
        );
      }

      // Re-fetch to return updated entity
      const updated = await this.prisma.stabilizationBaseline.findUnique({ where: { id } });
      return ok(mapDbToBaseline(updated));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to update baseline", "StabilizationBaseline", e);
    }
  }

  async findBaselineById(id: string): Promise<RepositoryResult<PersistedBaseline>> {
    try {
      const row = await this.prisma.stabilizationBaseline.findUnique({ where: { id } });
      if (!row) {
        return fail("NOT_FOUND", `Baseline id=${id} not found`, "StabilizationBaseline");
      }
      return ok(mapDbToBaseline(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find baseline", "StabilizationBaseline", e);
    }
  }

  async findBaselineByVersion(version: string): Promise<RepositoryResult<PersistedBaseline>> {
    try {
      const row = await this.prisma.stabilizationBaseline.findFirst({
        where: { baselineVersion: version },
      });
      if (!row) {
        return fail("NOT_FOUND", `Baseline version=${version} not found`, "StabilizationBaseline");
      }
      return ok(mapDbToBaseline(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find baseline by version", "StabilizationBaseline", e);
    }
  }
}
