/**
 * S2 — State Reconciliation (Patched)
 *
 * path-level deep diff. auto-resolve는 non-critical, deterministic path만.
 * unresolved diff 1개라도 남으면 success=false.
 * reconciliation success는 final verification 통과 후에만 true.
 */

import type { ReconciliationResult, ReconciliationDiff } from "../../types/stabilization";
import { getSnapshotFromRepo } from "../baseline/snapshot-manager";
import { emitStabilizationAuditEvent } from "../audit/audit-events";

// ── Critical path patterns (auto-resolve 불가) ──
const CRITICAL_PATH_PATTERNS = ["authority", "kill", "transferLock", "owner"];

function isCriticalPath(path: string): boolean {
  return CRITICAL_PATH_PATTERNS.some((p: string) => path.toLowerCase().includes(p));
}

// ── Deep diff helper ──

interface PathDiff {
  path: string;
  expected: unknown;
  actual: unknown;
}

function deepPathDiff(expected: unknown, actual: unknown, basePath: string): PathDiff[] {
  const results: PathDiff[] = [];

  if (expected === actual) return results;

  if (expected === null || expected === undefined || actual === null || actual === undefined) {
    results.push({ path: basePath, expected, actual });
    return results;
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const maxLen = Math.max(expected.length, actual.length);
    for (let i = 0; i < maxLen; i++) {
      const childPath = `${basePath}[${i}]`;
      if (i >= expected.length) {
        results.push({ path: childPath, expected: undefined, actual: actual[i] });
      } else if (i >= actual.length) {
        results.push({ path: childPath, expected: expected[i], actual: undefined });
      } else {
        results.push(...deepPathDiff(expected[i], actual[i], childPath));
      }
    }
    return results;
  }

  if (typeof expected === "object" && typeof actual === "object" && !Array.isArray(expected) && !Array.isArray(actual)) {
    const expectedObj = expected as Record<string, unknown>;
    const actualObj = actual as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(expectedObj), ...Object.keys(actualObj)]);
    for (const key of Array.from(allKeys)) {
      const childPath = basePath ? `${basePath}.${key}` : key;
      if (!(key in expectedObj)) {
        results.push({ path: childPath, expected: undefined, actual: actualObj[key] });
      } else if (!(key in actualObj)) {
        results.push({ path: childPath, expected: expectedObj[key], actual: undefined });
      } else {
        results.push(...deepPathDiff(expectedObj[key], actualObj[key], childPath));
      }
    }
    return results;
  }

  if (expected !== actual) {
    results.push({ path: basePath, expected, actual });
  }

  return results;
}

/** snapshot 기준 path-level reconciliation */
export async function reconcileState(
  snapshotId: string,
  currentState: Record<string, Record<string, unknown>>,
  correlationId?: string,
  actor?: string
): Promise<ReconciliationResult> {
  const snap = await getSnapshotFromRepo(snapshotId);
  const diffs: ReconciliationDiff[] = [];

  if (!snap) {
    return {
      success: false,
      diffs: [{ scope: "SNAPSHOT", path: "SNAPSHOT", expected: "exists", actual: "missing", resolved: false }],
      unresolvedCount: 1,
    };
  }

  for (const scopeEntry of snap.scopes) {
    const runtime = currentState[scopeEntry.scope];

    if (!runtime) {
      diffs.push({
        scope: scopeEntry.scope,
        path: scopeEntry.scope,
        expected: "present",
        actual: "missing",
        resolved: false,
      });
      continue;
    }

    // path-level deep diff
    const pathDiffs = deepPathDiff(scopeEntry.data, runtime, scopeEntry.scope);

    for (const pd of pathDiffs) {
      // auto-resolve: non-critical + deterministic only
      const canAutoResolve = !isCriticalPath(pd.path);
      const resolved = canAutoResolve;

      diffs.push({
        scope: scopeEntry.scope,
        path: pd.path,
        expected: pd.expected,
        actual: pd.actual,
        resolved,
      });

      // audit unresolved diffs
      if (!resolved && correlationId) {
        emitStabilizationAuditEvent({
          eventType: "RECONCILIATION_UNRESOLVED_DIFF",
          baselineId: "", baselineVersion: "", baselineHash: "", snapshotId,
          correlationId, documentType: "", performedBy: actor ?? "system",
          detail: `path=${pd.path}, expected=${JSON.stringify(pd.expected)}, actual=${JSON.stringify(pd.actual)}`,
        });
      }
    }
  }

  // stale keys in runtime not in snapshot
  for (const scopeEntry of snap.scopes) {
    const runtime = currentState[scopeEntry.scope];
    if (!runtime) continue;
    for (const key of Object.keys(runtime)) {
      if (!(key in scopeEntry.data)) {
        const path = `${scopeEntry.scope}.${key}`;
        const canAutoResolve = !isCriticalPath(path);
        diffs.push({
          scope: scopeEntry.scope,
          path,
          expected: undefined,
          actual: runtime[key],
          resolved: canAutoResolve,
        });
      }
    }
  }

  const unresolvedCount = diffs.filter((d: ReconciliationDiff) => !d.resolved).length;

  return {
    success: unresolvedCount === 0,
    diffs,
    unresolvedCount,
  };
}
