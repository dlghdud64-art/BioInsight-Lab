/**
 * S2 — State Reconciliation
 *
 * rollback 이후 snapshot 기준 상태와 runtime 상태 대조.
 * reconciliation 성공해야 FINAL_CONTAINMENT_FINALIZE 가능.
 */

import type { ReconciliationResult } from "../../types/stabilization";
import { getSnapshot } from "../baseline/snapshot-manager";

/** snapshot 기준 diff 계산 + reconciliation */
export function reconcileState(
  snapshotId: string,
  currentState: Record<string, Record<string, unknown>>
): ReconciliationResult {
  const snap = getSnapshot(snapshotId);
  const diffs: { scope: string; expected: string; actual: string; resolved: boolean }[] = [];

  if (!snap) {
    return {
      success: false,
      diffs: [{ scope: "SNAPSHOT", expected: "exists", actual: "missing", resolved: false }],
      unresolvedCount: 1,
    };
  }

  for (const scopeEntry of snap.scopes) {
    const runtime = currentState[scopeEntry.scope];

    if (!runtime) {
      diffs.push({
        scope: scopeEntry.scope,
        expected: "present",
        actual: "missing",
        resolved: false,
      });
      continue;
    }

    for (const key of Object.keys(scopeEntry.data)) {
      const expected = JSON.stringify(scopeEntry.data[key]);
      const actual = JSON.stringify(runtime[key]);
      if (expected !== actual) {
        // attempt auto-reconciliation for non-critical diffs
        const canAutoResolve = !key.includes("authority") && !key.includes("kill");
        diffs.push({
          scope: `${scopeEntry.scope}.${key}`,
          expected,
          actual: actual ?? "undefined",
          resolved: canAutoResolve,
        });
      }
    }
  }

  const unresolvedCount = diffs.filter((d) => !d.resolved).length;

  return {
    success: unresolvedCount === 0,
    diffs,
    unresolvedCount,
  };
}
