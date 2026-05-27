/**
 * P2-1 — PrismaRecoveryRecordRepository
 *
 * Prisma-backed recovery record persistence.
 * Optimistic locking via updatedAt WHERE clause.
 */

import type { RecoveryRecordRepository } from "../repositories";
import type {
  RepositoryResult,
  OptimisticUpdate,
  PersistedRecoveryRecord,
  CreateRecoveryRecordInput,
} from "../types";
import { ok, fail } from "../types";
import { isUniqueConstraintError } from "./query-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

const TERMINAL_STATES = ["RECOVERY_RESTORED", "RECOVERY_FAILED", "RECOVERY_ESCALATED"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbToRecoveryRecord(row: any): PersistedRecoveryRecord {
  return {
    id: row.id,
    recoveryId: row.recoveryId,
    correlationId: row.correlationId,
    incidentId: row.incidentId ?? null,
    baselineId: row.baselineId,
    lifecycleState: row.lifecycleState,
    releaseMode: row.releaseMode,
    recoveryState: row.recoveryState,
    recoveryStage: row.recoveryStage ?? null,
    lockKey: row.lockKey ?? null,
    lockToken: row.lockToken ?? null,
    operatorId: row.operatorId,
    overrideUsed: row.overrideUsed,
    overrideReason: row.overrideReason ?? null,
    signOffMetadata: row.signOffMetadata ?? null,
    startedAt: new Date(row.startedAt),
    completedAt: row.completedAt ? new Date(row.completedAt) : null,
    lastHeartbeatAt: row.lastHeartbeatAt ? new Date(row.lastHeartbeatAt) : null,
    failureReasonCode: row.failureReasonCode ?? null,
    stageResults: row.stageResults ?? null,
    preconditionResults: row.preconditionResults ?? null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export class PrismaRecoveryRecordRepository implements RecoveryRecordRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveRecoveryRecord(input: CreateRecoveryRecordInput): Promise<RepositoryResult<PersistedRecoveryRecord>> {
    try {
      const row = await this.prisma.stabilizationRecoveryRecord.create({
        data: {
          recoveryId: input.recoveryId,
          correlationId: input.correlationId,
          incidentId: input.incidentId,
          baselineId: input.baselineId,
          lifecycleState: input.lifecycleState,
          releaseMode: input.releaseMode,
          recoveryState: input.recoveryState,
          recoveryStage: input.recoveryStage,
          lockKey: input.lockKey,
          lockToken: input.lockToken,
          operatorId: input.operatorId,
          overrideUsed: input.overrideUsed,
          overrideReason: input.overrideReason,
          signOffMetadata: input.signOffMetadata,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          lastHeartbeatAt: input.lastHeartbeatAt,
          failureReasonCode: input.failureReasonCode,
          stageResults: input.stageResults,
          preconditionResults: input.preconditionResults,
        },
      });
      return ok(mapDbToRecoveryRecord(row));
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return fail("DUPLICATE", `RecoveryRecord recoveryId=${input.recoveryId} already exists`, "StabilizationRecoveryRecord");
      }
      return fail("STORAGE_UNAVAILABLE", "Failed to create recovery record", "StabilizationRecoveryRecord", e);
    }
  }

  async updateRecoveryRecord(update: OptimisticUpdate<PersistedRecoveryRecord>): Promise<RepositoryResult<PersistedRecoveryRecord>> {
    try {
      const { id, expectedUpdatedAt, patch } = update;
      // Optimistic lock: WHERE id + updatedAt match
      const result = await this.prisma.stabilizationRecoveryRecord.updateMany({
        where: { id, updatedAt: expectedUpdatedAt },
        data: patch,
      });
      if (result.count === 0) {
        // Check if record exists at all
        const exists = await this.prisma.stabilizationRecoveryRecord.findUnique({ where: { id } });
        if (!exists) {
          return fail("NOT_FOUND", `RecoveryRecord id=${id} not found`, "StabilizationRecoveryRecord");
        }
        return fail("OPTIMISTIC_LOCK_CONFLICT", `RecoveryRecord id=${id} was modified concurrently`, "StabilizationRecoveryRecord");
      }
      // Re-fetch after update
      const updated = await this.prisma.stabilizationRecoveryRecord.findUnique({ where: { id } });
      return ok(mapDbToRecoveryRecord(updated));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to update recovery record", "StabilizationRecoveryRecord", e);
    }
  }

  async findByRecoveryId(recoveryId: string): Promise<RepositoryResult<PersistedRecoveryRecord>> {
    try {
      const row = await this.prisma.stabilizationRecoveryRecord.findUnique({
        where: { recoveryId },
      });
      if (!row) {
        return fail("NOT_FOUND", `RecoveryRecord recoveryId=${recoveryId} not found`, "StabilizationRecoveryRecord");
      }
      return ok(mapDbToRecoveryRecord(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find recovery record", "StabilizationRecoveryRecord", e);
    }
  }

  async findActiveRecovery(): Promise<PersistedRecoveryRecord | null> {
    try {
      const row = await this.prisma.stabilizationRecoveryRecord.findFirst({
        where: {
          recoveryState: { notIn: TERMINAL_STATES },
          completedAt: null,
        },
        orderBy: { startedAt: "desc" },
      });
      return row ? mapDbToRecoveryRecord(row) : null;
    } catch (_e) {
      return null;
    }
  }

  async findByCorrelationId(correlationId: string): Promise<RepositoryResult<PersistedRecoveryRecord>> {
    try {
      const row = await this.prisma.stabilizationRecoveryRecord.findFirst({
        where: { correlationId },
      });
      if (!row) {
        return fail("NOT_FOUND", `RecoveryRecord correlationId=${correlationId} not found`, "StabilizationRecoveryRecord");
      }
      return ok(mapDbToRecoveryRecord(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find recovery record", "StabilizationRecoveryRecord", e);
    }
  }
}
