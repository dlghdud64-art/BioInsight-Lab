/**
 * S2 — Post-Rollback Residue Scan
 *
 * rollback 후 residue 필수 검사.
 * residue 있으면 final success 처리 금지.
 */

import type { ResidueScanResult, ResidueEntry, RollbackScope, ResidueSeverity } from "../../types/stabilization";
import { getSnapshot } from "../baseline/snapshot-manager";

/** scope별 residue scan */
export function runResidueScan(
  snapshotId: string,
  currentState: Record<string, Record<string, unknown>>
): ResidueScanResult {
  const snap = getSnapshot(snapshotId);
  const residues: ResidueEntry[] = [];

  if (!snap) {
    residues.push({
      scope: "SNAPSHOT",
      description: `snapshot ${snapshotId} not found — cannot verify residues`,
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
        description: `${scopeEntry.scope} — no runtime state found (orphan scope)`,
        severity: "WARNING",
        reconcilable: true,
      });
      continue;
    }

    // Diff check
    const snapshotKeys = Object.keys(scopeEntry.data);
    const runtimeKeys = Object.keys(runtimeData);

    // stale keys in runtime
    for (const key of runtimeKeys) {
      if (!snapshotKeys.includes(key)) {
        residues.push({
          scope: scopeEntry.scope,
          description: `${scopeEntry.scope}.${key} — stale key not in snapshot`,
          severity: "WARNING",
          reconcilable: true,
        });
      }
    }

    // value mismatches
    for (const key of snapshotKeys) {
      const expected = JSON.stringify(scopeEntry.data[key]);
      const actual = JSON.stringify(runtimeData[key]);
      if (expected !== actual) {
        residues.push({
          scope: scopeEntry.scope,
          description: `${scopeEntry.scope}.${key} — value mismatch`,
          severity: key.includes("authority") || key.includes("kill") ? "CRITICAL" : "WARNING",
          reconcilable: true,
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
