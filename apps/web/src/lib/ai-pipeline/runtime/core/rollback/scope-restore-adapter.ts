/**
 * S2 Patch — Scope Restore Adapter
 *
 * 7 scope 각각에 대해 snapshot 값을 실제 runtime state에 apply.
 * apply 실패 시 partial commit으로 간주 → incident escalation.
 * best-effort continue 금지.
 */

import type { RollbackScope, SnapshotScope } from "../../types/stabilization";
import { emitStabilizationAuditEvent } from "../audit/audit-events";

// ── In-memory Runtime State Store (single-instance) ──

const _runtimeState = new Map<string, Record<string, unknown>>();

export function initializeRuntimeState(state: Record<string, Record<string, unknown>>): void {
  _runtimeState.clear();
  for (const [scope, data] of Object.entries(state)) {
    _runtimeState.set(scope, JSON.parse(JSON.stringify(data)));
  }
}

export function getRuntimeScopeState(scope: string): Record<string, unknown> | null {
  const data = _runtimeState.get(scope);
  return data ? JSON.parse(JSON.stringify(data)) : null;
}

export function getAllRuntimeState(): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const [scope, data] of Array.from(_runtimeState.entries())) {
    result[scope] = JSON.parse(JSON.stringify(data));
  }
  return result;
}

// ── Scope Restore ──

export interface ScopeRestoreResult {
  scope: string;
  applied: boolean;
  verified: boolean;
  preState: Record<string, unknown> | null;
  postState: Record<string, unknown> | null;
  reason: string;
}

/**
 * snapshot data를 runtime state에 실제 apply.
 * apply 후 post-state verify까지 통과해야 성공.
 */
export function applyScopeRestore(
  scope: RollbackScope,
  snapshotData: Record<string, unknown>,
  correlationId: string,
  actor: string
): ScopeRestoreResult {
  const preState = getRuntimeScopeState(scope);

  emitStabilizationAuditEvent({
    eventType: "RESTORE_APPLY_STARTED",
    baselineId: "", baselineVersion: "", baselineHash: "", snapshotId: "",
    correlationId, documentType: "", performedBy: actor,
    detail: `scope=${scope}`,
  });

  try {
    // actual apply: overwrite runtime state with snapshot data
    _runtimeState.set(scope, JSON.parse(JSON.stringify(snapshotData)));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    emitStabilizationAuditEvent({
      eventType: "RESTORE_APPLY_FAILED",
      baselineId: "", baselineVersion: "", baselineHash: "", snapshotId: "",
      correlationId, documentType: "", performedBy: actor,
      detail: `scope=${scope}: ${msg}`,
    });
    return { scope, applied: false, verified: false, preState, postState: null, reason: `RESTORE_APPLY_FAILED: ${msg}` };
  }

  emitStabilizationAuditEvent({
    eventType: "RESTORE_APPLY_SUCCEEDED",
    baselineId: "", baselineVersion: "", baselineHash: "", snapshotId: "",
    correlationId, documentType: "", performedBy: actor,
    detail: `scope=${scope}`,
  });

  // post-state verification
  const postState = getRuntimeScopeState(scope);
  const verified = verifyScopeRestore(scope, snapshotData);

  if (verified) {
    emitStabilizationAuditEvent({
      eventType: "POST_RESTORE_VERIFY_PASSED",
      baselineId: "", baselineVersion: "", baselineHash: "", snapshotId: "",
      correlationId, documentType: "", performedBy: actor,
      detail: `scope=${scope}`,
    });
  } else {
    emitStabilizationAuditEvent({
      eventType: "POST_RESTORE_VERIFY_FAILED",
      baselineId: "", baselineVersion: "", baselineHash: "", snapshotId: "",
      correlationId, documentType: "", performedBy: actor,
      detail: `scope=${scope}: post-restore state mismatch`,
    });
  }

  return {
    scope,
    applied: true,
    verified,
    preState,
    postState,
    reason: verified ? "RESTORE_VERIFIED" : "POST_RESTORE_VERIFY_FAILED",
  };
}

/** deep-equal 기반 post-restore verification */
export function verifyScopeRestore(scope: string, expectedData: Record<string, unknown>): boolean {
  const current = _runtimeState.get(scope);
  if (!current) return false;
  return JSON.stringify(current) === JSON.stringify(expectedData);
}

/** 테스트용 */
export function _resetRuntimeState(): void {
  _runtimeState.clear();
}
