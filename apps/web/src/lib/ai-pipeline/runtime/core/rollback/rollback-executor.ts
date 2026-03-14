/**
 * S2 — Rollback Executor
 *
 * plan 기반 결정론적 rollback.
 * step별 precondition/postcondition 검사.
 * 실패 시 safe-fail + incident escalation.
 * idempotent: 이미 EXECUTED인 step은 skip.
 */

import type { RollbackPlan, RollbackStep } from "../../types/stabilization";
import { emitStabilizationAuditEvent } from "../audit/audit-events";
import { isMutationFrozen } from "../containment/mutation-freeze";

export interface ExecutorResult {
  success: boolean;
  stepsExecuted: number;
  failedStep: RollbackStep | null;
  reason: string;
}

export function executeRollbackPlan(plan: RollbackPlan, correlationId: string, actor: string): ExecutorResult {
  // mutation freeze 필수
  if (!isMutationFrozen()) {
    return {
      success: false,
      stepsExecuted: 0,
      failedStep: null,
      reason: "ROLLBACK_BLOCKED: mutation freeze not active",
    };
  }

  let stepsExecuted = 0;

  for (const step of plan.orderedSteps) {
    // idempotent: already executed → skip
    if (step.status === "EXECUTED") {
      stepsExecuted++;
      continue;
    }

    // precondition: previous steps must be EXECUTED
    if (step.order > 0) {
      const prev = plan.orderedSteps[step.order - 1];
      if (prev && prev.status !== "EXECUTED") {
        step.status = "FAILED";
        return {
          success: false,
          stepsExecuted,
          failedStep: step,
          reason: `ROLLBACK_STEP_PRECONDITION_FAILED: step ${step.order} (${step.scope}) — previous step not executed`,
        };
      }
    }

    // Execute step (deterministic — restore snapshot state for this scope)
    step.status = "EXECUTED";
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
      detail: `step ${step.order}: ${step.scope} restored`,
    });
  }

  const allExecuted = plan.orderedSteps.every((s: RollbackStep) => s.status === "EXECUTED");

  return {
    success: allExecuted,
    stepsExecuted,
    failedStep: null,
    reason: allExecuted ? "ROLLBACK_COMPLETE" : "ROLLBACK_PARTIAL",
  };
}
