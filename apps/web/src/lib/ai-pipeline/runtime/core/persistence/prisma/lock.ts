/**
 * P1-2 — Prisma Lock Repository
 *
 * PostgreSQL-backed distributed lock using StabilizationLock table.
 * Uses unique constraint on lockKey for atomic acquisition.
 */

import type { LockRepository } from "../lock-repository";
import type {
  LockAcquireRequest,
  LockResult,
  PersistedLock,
  LockTarget,
} from "../lock-types";
import { lockOk, lockFail } from "../lock-types";
import { isUniqueConstraintError } from "./query-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

function mapDbToLock(row: Record<string, unknown>): PersistedLock {
  return {
    id: row.id as string,
    lockKey: row.lockKey as string,
    lockOwner: row.lockOwner as string,
    lockToken: row.lockToken as string,
    targetType: row.targetType as LockTarget,
    reason: row.reason as string,
    correlationId: row.correlationId as string,
    acquiredAt: new Date(row.acquiredAt as string | number | Date),
    expiresAt: new Date(row.expiresAt as string | number | Date),
  };
}

function generateToken(): string {
  return "tok_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class PrismaLockRepository implements LockRepository {
  private prisma: PrismaClient;

  constructor(prismaClient: unknown) {
    this.prisma = prismaClient;
  }

  async acquire(input: LockAcquireRequest): Promise<LockResult<PersistedLock>> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.ttlMs);
    const lockToken = generateToken();

    try {
      const created = await this.prisma.stabilizationLock.create({
        data: {
          lockKey: input.lockKey,
          lockOwner: input.lockOwner,
          lockToken,
          targetType: input.targetType,
          reason: input.reason,
          correlationId: input.correlationId,
          expiresAt,
        },
      });
      return lockOk(mapDbToLock(created));
    } catch (e: unknown) {
      if (!isUniqueConstraintError(e)) {
        throw e;
      }
    }

    // Unique constraint violation — check if existing lock is expired
    const existing = await this.prisma.stabilizationLock.findUnique({
      where: { lockKey: input.lockKey },
    });

    if (!existing) {
      // Race: someone else deleted it between our create and findUnique
      // Retry once
      try {
        const created = await this.prisma.stabilizationLock.create({
          data: {
            lockKey: input.lockKey,
            lockOwner: input.lockOwner,
            lockToken,
            targetType: input.targetType,
            reason: input.reason,
            correlationId: input.correlationId,
            expiresAt,
          },
        });
        return lockOk(mapDbToLock(created));
      } catch (_retryErr: unknown) {
        return lockFail(
          "LOCK_ACQUIRE_CONFLICT",
          `Lock "${input.lockKey}" could not be acquired (race condition)`
        );
      }
    }

    const existingExpiry = new Date(existing.expiresAt);
    if (existingExpiry.getTime() > now.getTime() && existing.lockOwner !== input.lockOwner) {
      return lockFail(
        "LOCK_ACQUIRE_CONFLICT",
        `Lock "${input.lockKey}" held by "${existing.lockOwner}" until ${existingExpiry.toISOString()}`
      );
    }

    // Expired or same owner — delete and re-create in transaction
    try {
      const result = await this.prisma.$transaction(async (tx: PrismaClient) => {
        await tx.stabilizationLock.delete({ where: { lockKey: input.lockKey } });
        return tx.stabilizationLock.create({
          data: {
            lockKey: input.lockKey,
            lockOwner: input.lockOwner,
            lockToken,
            targetType: input.targetType,
            reason: input.reason,
            correlationId: input.correlationId,
            expiresAt,
          },
        });
      });
      return lockOk(mapDbToLock(result));
    } catch (_txErr: unknown) {
      return lockFail(
        "LOCK_ACQUIRE_CONFLICT",
        `Lock "${input.lockKey}" could not be acquired (transaction failed)`
      );
    }
  }

  async release(lockKey: string, lockToken: string): Promise<LockResult<void>> {
    const existing = await this.prisma.stabilizationLock.findUnique({
      where: { lockKey },
    });

    if (!existing) {
      return lockFail(
        "LOCK_RELEASE_WITHOUT_OWNERSHIP",
        `No lock found for key "${lockKey}"`
      );
    }

    if (existing.lockToken !== lockToken) {
      return lockFail(
        "LOCK_RELEASE_WITHOUT_OWNERSHIP",
        `Lock token mismatch for key "${lockKey}"`
      );
    }

    await this.prisma.stabilizationLock.delete({ where: { lockKey } });
    return lockOk(undefined as void);
  }

  async renew(lockKey: string, lockToken: string, ttlMs: number): Promise<LockResult<PersistedLock>> {
    const existing = await this.prisma.stabilizationLock.findUnique({
      where: { lockKey },
    });

    if (!existing) {
      return lockFail("LOCK_OWNER_MISMATCH", `No lock found for key "${lockKey}"`);
    }

    if (existing.lockToken !== lockToken) {
      return lockFail("LOCK_OWNER_MISMATCH", `Lock token mismatch for key "${lockKey}"`);
    }

    const now = new Date();
    if (new Date(existing.expiresAt).getTime() <= now.getTime()) {
      return lockFail(
        "LOCK_RENEW_AFTER_EXPIRY",
        `Lock "${lockKey}" already expired at ${new Date(existing.expiresAt).toISOString()}`
      );
    }

    const newExpiry = new Date(now.getTime() + ttlMs);
    const updated = await this.prisma.stabilizationLock.update({
      where: { lockKey },
      data: { expiresAt: newExpiry },
    });

    return lockOk(mapDbToLock(updated));
  }

  async forceExpire(lockKey: string): Promise<LockResult<void>> {
    const existing = await this.prisma.stabilizationLock.findUnique({
      where: { lockKey },
    });

    if (!existing) {
      return lockFail("LOCK_OWNER_MISMATCH", `No lock found for key "${lockKey}"`);
    }

    await this.prisma.stabilizationLock.update({
      where: { lockKey },
      data: { expiresAt: new Date(0) },
    });

    return lockOk(undefined as void);
  }

  async findByKey(lockKey: string): Promise<PersistedLock | null> {
    const row = await this.prisma.stabilizationLock.findUnique({
      where: { lockKey },
    });
    return row ? mapDbToLock(row) : null;
  }

  async findStale(_thresholdMs: number): Promise<PersistedLock[]> {
    const rows = await this.prisma.stabilizationLock.findMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return rows.map(mapDbToLock);
  }
}
