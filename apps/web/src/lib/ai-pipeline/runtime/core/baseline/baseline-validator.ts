/**
 * S0 — Baseline Validator (Boot-time Validation)
 *
 * 부팅 시 검증:
 * - runtime state vs persisted baseline state 일치
 * - baseline hash 일치
 * - snapshot pair 존재
 * - freeze flag enforcement
 * - canonical baseline uniqueness
 *
 * 실패 시 active runtime 진입 차단 또는 incident 승격.
 * silent pass 절대 금지.
 */

import type {
  BaselineRegistry,
  BaselineValidationResult,
  BaselineValidationCheck,
  StabilizationChangePolicy,
  DEFAULT_STABILIZATION_POLICY,
} from "../../types/stabilization";
import {
  getCanonicalBaseline,
  assertSingleCanonical,
  computeBaselineHash,
  isCanonicalActiveCombination,
} from "./baseline-registry";
import { verifySnapshotPairExists, restoreDryRun } from "./snapshot-manager";

export function validateBaselineAtBoot(
  runtimeState: {
    lifecycleState: string;
    releaseMode: string;
    baselineStatus: string;
    baselineHash: string;
  },
  policy: { stabilizationOnly: boolean; featureExpansionAllowed: boolean; devOnlyPathAllowed: boolean }
): BaselineValidationResult {
  const checks: BaselineValidationCheck[] = [];

  // 1. canonical baseline uniqueness
  const singleCheck = assertSingleCanonical();
  checks.push({
    name: "canonical_baseline_uniqueness",
    passed: singleCheck.valid,
    detail: singleCheck.reason,
  });

  const baseline = getCanonicalBaseline();

  // 2. canonical active baseline combination
  if (baseline) {
    const validCombo = isCanonicalActiveCombination(
      baseline.lifecycleState,
      baseline.releaseMode,
      baseline.baselineStatus
    );
    checks.push({
      name: "canonical_active_combination",
      passed: validCombo,
      detail: validCombo
        ? "ACTIVE_100 + FULL_ACTIVE_STABILIZATION + FROZEN"
        : `invalid: ${baseline.lifecycleState}/${baseline.releaseMode}/${baseline.baselineStatus}`,
    });
  } else {
    checks.push({
      name: "canonical_active_combination",
      passed: false,
      detail: "no canonical baseline found",
    });
  }

  // 3. runtime state vs persisted state
  if (baseline) {
    const stateMatch =
      runtimeState.lifecycleState === baseline.lifecycleState &&
      runtimeState.releaseMode === baseline.releaseMode &&
      runtimeState.baselineStatus === baseline.baselineStatus;
    checks.push({
      name: "runtime_vs_persisted_state",
      passed: stateMatch,
      detail: stateMatch
        ? "match"
        : `mismatch: runtime(${runtimeState.lifecycleState}/${runtimeState.releaseMode}/${runtimeState.baselineStatus}) ` +
          `vs persisted(${baseline.lifecycleState}/${baseline.releaseMode}/${baseline.baselineStatus})`,
    });
  } else {
    checks.push({
      name: "runtime_vs_persisted_state",
      passed: false,
      detail: "no persisted baseline to compare",
    });
  }

  // 4. baseline hash match
  if (baseline) {
    const hashMatch = runtimeState.baselineHash === baseline.baselineHash;
    checks.push({
      name: "baseline_hash_match",
      passed: hashMatch,
      detail: hashMatch
        ? `hash: ${baseline.baselineHash.slice(0, 12)}...`
        : `mismatch: runtime(${runtimeState.baselineHash.slice(0, 12)}) vs persisted(${baseline.baselineHash.slice(0, 12)})`,
    });
  } else {
    checks.push({
      name: "baseline_hash_match",
      passed: false,
      detail: "no baseline hash to verify",
    });
  }

  // 5. snapshot pair existence
  if (baseline) {
    const pairCheck = verifySnapshotPairExists(
      baseline.activeSnapshotId,
      baseline.rollbackSnapshotId
    );
    checks.push({
      name: "snapshot_pair_exists",
      passed: pairCheck.exists,
      detail: pairCheck.reason,
    });
  } else {
    checks.push({
      name: "snapshot_pair_exists",
      passed: false,
      detail: "no baseline — cannot check snapshot pair",
    });
  }

  // 6. freeze flag enforcement
  const freezeEnforced =
    policy.stabilizationOnly === true &&
    policy.featureExpansionAllowed === false &&
    policy.devOnlyPathAllowed === false;
  checks.push({
    name: "freeze_flag_enforcement",
    passed: freezeEnforced,
    detail: freezeEnforced
      ? "stabilizationOnly=true, featureExpansion=false, devOnly=false"
      : `violation: stabilizationOnly=${policy.stabilizationOnly}, ` +
        `featureExpansion=${policy.featureExpansionAllowed}, devOnly=${policy.devOnlyPathAllowed}`,
  });

  // Final result
  const allPassed = checks.every((c: BaselineValidationCheck) => c.passed);

  return {
    valid: allPassed,
    checks,
    blocksActiveRuntime: !allPassed,
    incidentRequired: checks.some(
      (c: BaselineValidationCheck) =>
        !c.passed &&
        (c.name === "baseline_hash_match" || c.name === "canonical_active_combination" || c.name === "runtime_vs_persisted_state")
    ),
  };
}
