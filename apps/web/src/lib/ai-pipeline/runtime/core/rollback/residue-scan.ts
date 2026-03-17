/**
 * S2 — Post-Rollback Residue Scan (Patched)
 *
 * deep diff: nested object / array / scalar path-level 검사.
 * critical mismatch 하나라도 남으면 final success 금지.
 */

import type { ResidueScanResult, ResidueEntry, RollbackScope, ResidueSeverity } from "../../types/stabilization";
import { getSnapshotFromRepo } from "../baseline/snapshot-manager";
import { emitStabilizationAuditEvent } from "../audit/audit-events";

// ── Critical key patterns ──
const CRITICAL_KEY_PATTERNS = ["authority", "kill", "transferLock", "owner"];

function isCriticalPath(path: string): boolean {
  return CRITICAL_KEY_PATTERNS.some((p: string) => path.toLowerCase().includes(p));
}

function classifySeverity(path: string, scope: string): ResidueSeverity {
  if (scope === "AUTHORITY" || isCriticalPath(path)) return "CRITICAL";
  if (scope === "POLICY" || scope === "ROUTING") return "WARNING";
  return "WARNING";
}

// ── Deep Diff Engine ──

interface DeepDiffEntry {
  path: string;
  expected: unknown;
  actual: unknown;
}

function deepDiff(expected: unknown, actual: unknown, basePath: string): DeepDiffEntry[] {
  const results: DeepDiffEntry[] = [];

  if (expected === actual) return results;

  // null / undefined
  if (expected === null || expected === undefined || actual === null || actual === undefined) {
    results.push({ path: basePath, expected, actual });
    return results;
  }

  // array diff
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const maxLen = Math.max(expected.length, actual.length);
    for (let i = 0; i < maxLen; i++) {
      const childPath = `${basePath}[${i}]`;
      if (i >= expected.length) {
        results.push({ path: childPath, expected: undefined, actual: actual[i] });
      } else if (i >= actual.length) {
        results.push({ path: childPath, expected: expected[i], actual: undefined });
      } else {
        results.push(...deepDiff(expected[i], actual[i], childPath));
      }
    }
    return results;
  }

  // object diff (non-array)
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
        results.push(...deepDiff(expectedObj[key], actualObj[key], childPath));
      }
    }
    return results;
  }

  // scalar mismatch
  if (expected !== actual) {
    results.push({ path: basePath, expected, actual });
  }

  return results;
}

/** scope별 deep residue scan */
export async function runResidueScan(
  snapshotId: string,
  currentState: Record<string, Record<string, unknown>>,
  correlationId?: string,
  actor?: string
): Promise<ResidueScanResult> {
  const snap = await getSnapshotFromRepo(snapshotId);
  const residues: ResidueEntry[] = [];

  if (!snap) {
    residues.push({
      scope: "SNAPSHOT",
      path: "",
      description: `snapshot ${snapshotId} not found — cannot verify residues`,
      expectedValue: "exists",
      actualValue: "missing",
      severity: "CRITICAL",
      reconcilable: false,
    });
    return { clean: false, residues, hasCritical: true };
  }

  for (const scopeEntry of snap.scopes) {
    const runtimeData = currentState[scopeEntry.scope];

    if (!runtimeData) {
      residues.push({
        scope: scopeEntry.scope,
        path: scopeEntry.scope,
        description: `${scopeEntry.scope} — no runtime state found (orphan scope)`,
        expectedValue: "present",
        actualValue: "missing",
        severity: "WARNING",
        reconcilable: true,
      });
      continue;
    }

    // deep diff: snapshot vs runtime
    const diffs = deepDiff(scopeEntry.data, runtimeData, scopeEntry.scope);

    for (const diff of diffs) {
      const severity = classifySeverity(diff.path, scopeEntry.scope);
      residues.push({
        scope: scopeEntry.scope,
        path: diff.path,
        description: `${diff.path} — value mismatch`,
        expectedValue: diff.expected,
        actualValue: diff.actual,
        severity,
        reconcilable: severity !== "CRITICAL",
      });

      // audit deep diff detection
      if (correlationId) {
        emitStabilizationAuditEvent({
          eventType: "DEEP_RESIDUE_DIFF_DETECTED",
          baselineId: "", baselineVersion: "", baselineHash: "", snapshotId,
          correlationId, documentType: "", performedBy: actor ?? "system",
          detail: `path=${diff.path}, expected=${JSON.stringify(diff.expected)}, actual=${JSON.stringify(diff.actual)}, severity=${severity}`,
        });
      }
    }
  }

  const hasCritical = residues.some((r: ResidueEntry) => r.severity === "CRITICAL");

  return {
    clean: residues.length === 0,
    residues,
    hasCritical,
  };
}
