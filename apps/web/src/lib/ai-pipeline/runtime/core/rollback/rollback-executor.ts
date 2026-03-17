/**
 * S2 — Rollback Executor (Patched)
 *
 * plan 기반 결정론적 rollback.
 * step별 pre-state capture → apply restore → post-state verify.
 * post-state verify 실패 시 step 성공 처리 금지.
 * idempotent: EXECUTED + restoreVerified인 step만 skip.
 * best-effort continue 금지.
 */

import type { RollbackPlan, RollbackStep, RollbackScope } from "../../types/stabilization";
import { emitStabilizationAuditEvent } from "../audit/audit-events";
import { isMutationFrozen } from "../containment/mutation-freeze";
import { getSnapshotFromRepo } from "../baseline/snapshot-manager";
import { applyScopeRestore } from "./scope-restore-adapter";
import { withLock, snapshotRestoreLockKey } from "../persistence/lock-manager";

export interface ExecutorResult {
  success: boolean;
  stepsExecuted: number;
  failedStep: RollbackStep | null;
  reason: string;
}

export async function executeRollbackPlan(plan: RollbackPlan, correlationId: string, actor: string): Promise<ExecutorResult> {
  // mutation freeze 필수
  if (!isMutationFrozen()) {
    return {
      success: false,
      stepsExecuted: 0,
      failedStep: null,
      reason: "ROLLBACK_BLOCKED: mutation freeze not active",
    };
  }

  const snap = await getSnapshotFromRepo(plan.snapshotId);
  let stepsExecuted = 0;

  for (const step of plan.orderedSteps) {
    // idempotent: EXECUTED + restoreVerified → skip
    if (step.status === "EXECUTED" && step.restoreVerified) {
      stepsExecuted++;
      continue;
    }

    // precondition: previous steps must be EXECUTED + verified
    if (step.order > 0) {
      const prev = plan.orderedSteps[step.order - 1];
      if (prev && (prev.status !== "EXECUTED" || !prev.restoreVerified)) {
        step.status = "FAILED";
        return {
          success: false,
          stepsExecuted,
          failedStep: step,
          reason: `ROLLBACK_STEP_PRECONDITION_FAILED: step ${step.order} (${step.scope}) — previous step not executed or not verified`,
        };
      }
    }

    // resolve snapshot data for this scope
    const scopeData = resolveScopeData(step.scope, snap);

    if (scopeData) {
      // actual restore via adapter
      const restoreResult = applyScopeRestore(step.scope, scopeData, correlationId, actor);

      if (!restoreResult.applied) {
        step.status = "FAILED";
        step.restoreVerified = false;
        return {
          success: false,
          stepsExecuted,
          failedStep: step,
          reason: `RESTORE_APPLY_FAILED: step ${step.order} (${step.scope}) — ${restoreResult.reason}`,
        };
      }

      if (!restoreResult.verified) {
        step.status = "FAILED";
        step.restoreVerified = false;
        return {
          success: false,
          stepsExecuted,
          failedStep: step,
          reason: `POST_RESTORE_VERIFY_FAILED: step ${step.order} (${step.scope}) — post-state mismatch`,
        };
      }
    }

    // mark executed + verified
    step.status = "EXECUTED";
    step.restoreVerified = true;
    stepsExecuted++;

    emitStabilizationAuditEvent({
      eventType: "ROLLBACK_STEP_EXECUTED",
      baselineId: plan.baselineId,
      baselineVersion: "",
      baselineHash: "",
      snapshotId: plan.snapshotId,
      correlationId,
      documentType: "",
      performedBy: actor,
      detail: `step ${step.order}: ${step.scope} restored + verified`,
    });
  }

  const allVerified = plan.orderedSteps.every((s: RollbackStep) => s.status === "EXECUTED" && s.restoreVerified);

  return {
    success: allVerified,
    stepsExecuted,
    failedStep: null,
    reason: allVerified ? "ROLLBACK_COMPLETE_ALL_VERIFIED" : "ROLLBACK_PARTIAL",
  };
}

/**
 * P1-2: Async version with distributed lock.
 * Prevents concurrent rollback on the same baseline.
 */
export async function executeRollbackPlanAsync(
  plan: RollbackPlan,
  correlationId: string,
  actor: string
): Promise<ExecutorResult> {
  const lockResult = await withLock(
    snapshotRestoreLockKey(plan.baselineId),
    actor,
    "SNAPSHOT_RESTORE",
    "rollback-execution",
    correlationId,
    60_000, // 60s TTL
    async function () {
      return await executeRollbackPlan(plan, correlationId, actor);
    }
  );

  if (!lockResult.acquired) {
    return {
      success: false,
      stepsExecuted: 0,
      failedStep: null,
      reason: `SNAPSHOT_RESTORE_LOCK_REQUIRED: ${lockResult.message}`,
    };
  }

  return lockResult.data;
}

/** snapshot에서 scope에 해당하는 data를 가져오기 */
function resolveScopeData(
  scope: RollbackScope,
  snap: Awaited<ReturnType<typeof getSnapshotFromRepo>>
): Record<string, unknown> | null {
  if (!snap) return null;
  // ACTIVE_RUNTIME_STATE는 snapshot에 직접 없음 — 전체 config 사용
  if (scope === "ACTIVE_RUNTIME_STATE") {
    return snap.config as Record<string, unknown>;
  }
  const entry = snap.scopes.find((s) => s.scope === scope);
  return entry ? entry.data : null;
}
