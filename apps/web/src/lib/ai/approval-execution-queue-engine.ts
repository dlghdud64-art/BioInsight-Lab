/**
 * Approval Execution Queue Engine — approved → applied 사이의 실행 큐
 *
 * approved 상태와 applied 상태 사이를 분리한 현재 lifecycle에서,
 * 그 사이의 작업면을 제공.
 *
 * EXECUTION STATES:
 * queued → executing → completed | partial_failure | failed | rolled_back
 *
 * FEATURES:
 * - staged apply (batch 단위 적용)
 * - partial failure handling (일부 scope만 실패)
 * - rollback scope (전체 또는 실패 scope만)
 * - execution audit trail
 */

import type { OwnershipChangeRequest, OwnershipChangeStatus } from "./ownership-governance-lifecycle-engine";

// ── Execution Status ──
export type ExecutionStatus = "queued" | "executing" | "completed" | "partial_failure" | "failed" | "rolled_back";

// ── Execution Item ──
export interface ExecutionQueueItem {
  executionId: string;
  changeRequestId: string;
  status: ExecutionStatus;
  // Scope
  totalScopes: number;
  completedScopes: number;
  failedScopes: number;
  // Staged apply
  staged: boolean;
  currentStage: number;
  totalStages: number;
  // Details
  scopeResults: ScopeExecutionResult[];
  // Timing
  queuedAt: string;
  executionStartedAt: string | null;
  executionCompletedAt: string | null;
  // Actor
  executedBy: string | null;
  // Rollback
  rollbackScope: "full" | "failed_only" | null;
  rolledBackAt: string | null;
  rolledBackBy: string | null;
}

export interface ScopeExecutionResult {
  scopeId: string;
  scopeLabel: string;
  status: "pending" | "applied" | "failed" | "rolled_back";
  appliedAt: string | null;
  failureReason: string;
  affectedRecordIds: string[];
}

// ── Queue Actions ──
export type ExecutionAction = "enqueue" | "start_execution" | "complete_scope" | "fail_scope" | "complete_all" | "rollback";

export interface ExecutionActionPayload {
  action: ExecutionAction;
  actor: string;
  scopeId?: string;
  failureReason?: string;
  rollbackScope?: "full" | "failed_only";
  timestamp: string;
}

export interface ExecutionResult {
  applied: boolean;
  rejectedReason: string | null;
  updatedItem: ExecutionQueueItem;
  events: ExecutionEvent[];
}

// ── Create Queue Item ──
export function createExecutionQueueItem(
  changeRequest: OwnershipChangeRequest,
  scopes: Array<{ scopeId: string; scopeLabel: string; recordIds: string[] }>,
): ExecutionQueueItem {
  const now = new Date().toISOString();
  return {
    executionId: `exec_${Date.now().toString(36)}`,
    changeRequestId: changeRequest.changeRequestId,
    status: "queued",
    totalScopes: scopes.length,
    completedScopes: 0, failedScopes: 0,
    staged: scopes.length > 1,
    currentStage: 0, totalStages: scopes.length,
    scopeResults: scopes.map(s => ({
      scopeId: s.scopeId, scopeLabel: s.scopeLabel,
      status: "pending", appliedAt: null, failureReason: "",
      affectedRecordIds: s.recordIds,
    })),
    queuedAt: now,
    executionStartedAt: null, executionCompletedAt: null,
    executedBy: null,
    rollbackScope: null, rolledBackAt: null, rolledBackBy: null,
  };
}

// ── Apply Execution Action ──
export function applyExecutionAction(
  item: ExecutionQueueItem,
  payload: ExecutionActionPayload,
): ExecutionResult {
  const now = payload.timestamp;
  const events: ExecutionEvent[] = [];
  const reject = (reason: string): ExecutionResult => {
    events.push({ type: "execution_rejected", executionId: item.executionId, reason, actor: payload.actor, timestamp: now });
    return { applied: false, rejectedReason: reason, updatedItem: item, events };
  };

  let u = { ...item, scopeResults: item.scopeResults.map(s => ({ ...s })) };

  switch (payload.action) {
    case "enqueue":
      // Already done in create
      break;

    case "start_execution": {
      if (u.status !== "queued") return reject(`실행 시작 불가: ${u.status}`);
      u.status = "executing";
      u.executionStartedAt = now;
      u.executedBy = payload.actor;
      u.currentStage = 1;
      events.push({ type: "execution_started", executionId: u.executionId, reason: `${u.totalScopes} scopes`, actor: payload.actor, timestamp: now });
      break;
    }

    case "complete_scope": {
      if (u.status !== "executing") return reject(`scope 완료 불가: ${u.status}`);
      if (!payload.scopeId) return reject("scopeId 필수");
      const scope = u.scopeResults.find(s => s.scopeId === payload.scopeId);
      if (!scope) return reject(`scope ${payload.scopeId} not found`);
      if (scope.status !== "pending") return reject(`scope 이미 처리됨: ${scope.status}`);
      scope.status = "applied";
      scope.appliedAt = now;
      u.completedScopes++;
      u.currentStage = u.completedScopes + u.failedScopes;
      events.push({ type: "scope_completed", executionId: u.executionId, reason: `${payload.scopeId} applied`, actor: payload.actor, timestamp: now });
      break;
    }

    case "fail_scope": {
      if (u.status !== "executing") return reject(`scope 실패 기록 불가: ${u.status}`);
      if (!payload.scopeId) return reject("scopeId 필수");
      const scope = u.scopeResults.find(s => s.scopeId === payload.scopeId);
      if (!scope) return reject(`scope ${payload.scopeId} not found`);
      scope.status = "failed";
      scope.failureReason = payload.failureReason || "Unknown failure";
      u.failedScopes++;
      u.currentStage = u.completedScopes + u.failedScopes;
      events.push({ type: "scope_failed", executionId: u.executionId, reason: `${payload.scopeId}: ${scope.failureReason}`, actor: payload.actor, timestamp: now });
      break;
    }

    case "complete_all": {
      if (u.status !== "executing") return reject(`완료 불가: ${u.status}`);
      const pending = u.scopeResults.filter(s => s.status === "pending");
      if (pending.length > 0) return reject(`${pending.length}개 scope 미처리`);
      u.status = u.failedScopes > 0 ? "partial_failure" : "completed";
      u.executionCompletedAt = now;
      events.push({ type: "execution_completed", executionId: u.executionId, reason: `${u.completedScopes} completed, ${u.failedScopes} failed`, actor: payload.actor, timestamp: now });
      break;
    }

    case "rollback": {
      if (u.status !== "completed" && u.status !== "partial_failure") return reject(`롤백 불가: ${u.status}`);
      const scope = payload.rollbackScope || "full";
      if (scope === "full") {
        u.scopeResults.forEach(s => { if (s.status === "applied") s.status = "rolled_back"; });
      } else {
        u.scopeResults.forEach(s => { if (s.status === "failed") s.status = "rolled_back"; });
      }
      u.status = "rolled_back";
      u.rollbackScope = scope;
      u.rolledBackAt = now;
      u.rolledBackBy = payload.actor;
      events.push({ type: "execution_rolled_back", executionId: u.executionId, reason: `Rollback scope: ${scope}`, actor: payload.actor, timestamp: now });
      break;
    }

    default:
      return reject(`Unknown action: ${payload.action}`);
  }

  return { applied: true, rejectedReason: null, updatedItem: u, events };
}

// ── Events ──
export type ExecutionEventType = "execution_started" | "scope_completed" | "scope_failed" | "execution_completed" | "execution_rolled_back" | "execution_rejected";
export interface ExecutionEvent { type: ExecutionEventType; executionId: string; reason: string; actor: string; timestamp: string; }
