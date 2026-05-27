/**
 * S2 — Rollback Precheck
 *
 * rollback 실행 전 검증.
 * 실패 시 rollback 실행하지 않고 incident escalation.
 */

import type { RollbackScope } from "../../types/stabilization";
import { getSnapshotFromRepo, verifySnapshotPairExists, computeScopeChecksum } from "../baseline/snapshot-manager";
import { isMutationFrozen } from "../containment/mutation-freeze";

export interface PrecheckResult {
  passed: boolean;
  checks: { name: string; passed: boolean; detail: string }[];
  reasonCode: string;
}

export async function runRollbackPrecheck(
  rollbackSnapshotId: string,
  activeSnapshotId: string
): Promise<PrecheckResult> {
  const checks: { name: string; passed: boolean; detail: string }[] = [];

  // 1. rollback snapshot exists
  const snap = await getSnapshotFromRepo(rollbackSnapshotId);
  checks.push({
    name: "rollback_snapshot_exists",
    passed: snap !== null,
    detail: snap ? `found: ${rollbackSnapshotId}` : `MISSING: ${rollbackSnapshotId}`,
  });

  // 2. rollback snapshot checksum valid
  if (snap) {
    const allChecksumValid = snap.scopes.every((s) => {
      const recomputed = computeScopeChecksum(s.scope, s.data);
      return recomputed === s.checksum;
    });
    checks.push({
      name: "snapshot_checksum_valid",
      passed: allChecksumValid,
      detail: allChecksumValid ? "all scope checksums valid" : "CHECKSUM_MISMATCH",
    });
  } else {
    checks.push({
      name: "snapshot_checksum_valid",
      passed: false,
      detail: "cannot verify — snapshot missing",
    });
  }

  // 3. snapshot pair exists
  const pairCheck = verifySnapshotPairExists(activeSnapshotId, rollbackSnapshotId);
  checks.push({
    name: "snapshot_pair_exists",
    passed: pairCheck.exists,
    detail: pairCheck.reason,
  });

  // 4. mutation freeze active
  const frozen = isMutationFrozen();
  checks.push({
    name: "mutation_freeze_active",
    passed: frozen,
    detail: frozen ? "mutation frozen" : "MUTATION_NOT_FROZEN — cannot rollback",
  });

  // 5. affected scope calculable
  if (snap) {
    const scopeCount = snap.scopes.length;
    checks.push({
      name: "affected_scope_calculable",
      passed: scopeCount > 0,
      detail: `${scopeCount} scopes available`,
    });
  } else {
    checks.push({
      name: "affected_scope_calculable",
      passed: false,
      detail: "no snapshot — cannot calculate scopes",
    });
  }

  const allPassed = checks.every((c) => c.passed);

  return {
    passed: allPassed,
    checks,
    reasonCode: allPassed ? "PRECHECK_PASSED" : "ROLLBACK_PRECHECK_FAILED",
  };
}
