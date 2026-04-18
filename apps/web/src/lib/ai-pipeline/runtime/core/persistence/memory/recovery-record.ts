/**
 * P2-1 — MemoryRecoveryRecordRepository
 *
 * In-memory Map-backed recovery record store.
 * Optimistic locking on update operations.
 */

import type { RecoveryRecordRepository } from "../repositories";
import type {
  RepositoryResult,
  OptimisticUpdate,
  PersistedRecoveryRecord,
  CreateRecoveryRecordInput,
} from "../types";
import { ok, fail } from "../types";
import { monotoneNow } from "./clock";

const TERMINAL_STATES = ["RECOVERY_RESTORED", "RECOVERY_FAILED", "RECOVERY_ESCALATED"];

let _idCounter = 0;
function nextId(): string {
  return "mem-rr-" + String(++_idCounter);
}

export class MemoryRecoveryRecordRepository implements RecoveryRecordRepository {
  private _store = new Map<string, PersistedRecoveryRecord>();
  /** Secondary index: recoveryId → id */
  private _recoveryIdIndex = new Map<string, string>();
  /** Secondary index: correlationId → id */
  private _correlationIdIndex = new Map<string, string>();

  async saveRecoveryRecord(input: CreateRecoveryRecordInput): Promise<RepositoryResult<PersistedRecoveryRecord>> {
    if (this._recoveryIdIndex.has(input.recoveryId)) {
      return fail("DUPLICATE", `RecoveryRecord recoveryId=${input.recoveryId} already exists`, "StabilizationRecoveryRecord");
    }
    const now = monotoneNow();
    const entity: PersistedRecoveryRecord = {
      id: nextId(),
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
      createdAt: now,
      updatedAt: now,
    };
    this._store.set(entity.id, entity);
    this._recoveryIdIndex.set(entity.recoveryId, entity.id);
    this._correlationIdIndex.set(entity.correlationId, entity.id);
    return ok(entity);
  }

  async updateRecoveryRecord(update: OptimisticUpdate<PersistedRecoveryRecord>): Promise<RepositoryResult<PersistedRecoveryRecord>> {
    const existing = this._store.get(update.id);
    if (!existing) {
      return fail("NOT_FOUND", `RecoveryRecord id=${update.id} not found`, "StabilizationRecoveryRecord");
    }
    if (existing.updatedAt.getTime() !== update.expectedUpdatedAt.getTime()) {
      return fail(
        "OPTIMISTIC_LOCK_CONFLICT",
        `RecoveryRecord id=${update.id} was modified concurrently`,
        "StabilizationRecoveryRecord"
      );
    }
    const now = monotoneNow();
    const updated: PersistedRecoveryRecord = {
      ...existing,
      ...update.patch,
      id: existing.id,
      recoveryId: existing.recoveryId,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    this._store.set(updated.id, updated);
    return ok(updated);
  }

  async findByRecoveryId(recoveryId: string): Promise<RepositoryResult<PersistedRecoveryRecord>> {
    const id = this._recoveryIdIndex.get(recoveryId);
    if (!id) {
      return fail("NOT_FOUND", `RecoveryRecord recoveryId=${recoveryId} not found`, "StabilizationRecoveryRecord");
    }
    const entity = this._store.get(id);
    if (!entity) {
      return fail("NOT_FOUND", `RecoveryRecord recoveryId=${recoveryId} not found`, "StabilizationRecoveryRecord");
    }
    return ok(entity);
  }

  async findActiveRecovery(): Promise<PersistedRecoveryRecord | null> {
    for (const record of this._store.values()) {
      if (TERMINAL_STATES.indexOf(record.recoveryState) === -1 && !record.completedAt) {
        return record;
      }
    }
    return null;
  }

  async findByCorrelationId(correlationId: string): Promise<RepositoryResult<PersistedRecoveryRecord>> {
    const id = this._correlationIdIndex.get(correlationId);
    if (!id) {
      return fail("NOT_FOUND", `RecoveryRecord correlationId=${correlationId} not found`, "StabilizationRecoveryRecord");
    }
    const entity = this._store.get(id);
    if (!entity) {
      return fail("NOT_FOUND", `RecoveryRecord correlationId=${correlationId} not found`, "StabilizationRecoveryRecord");
    }
    return ok(entity);
  }
}
