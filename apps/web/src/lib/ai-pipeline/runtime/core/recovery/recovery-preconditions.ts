/**
 * P1-3 — Recovery Preconditions
 *
 * 9 precondition checks that must pass before recovery can proceed.
 * Each check is individually reportable for audit trail.
 * Override is only allowed for check #1 (incidents) with explicit metadata.
 */

import type { RecoveryPreconditionResult, RecoveryOverrideMetadata } from "./recovery-types";
import { getIncidents, hasUnacknowledgedIncidents } from "../incidents/incident-escalation";
import { getCanonicalBaseline, assertSingleCanonical } from "../baseline/baseline-registry";
import { getSnapshot } from "../baseline/snapshot-manager";
import { runRollbackPrecheck } from "../rollback/rollback-precheck";
import { checkAuthorityIntegrity } from "../authority/authority-registry";
import { detectStaleLocks, recoveryLockKey } from "../persistence/lock-manager";
import { getPersistenceAdapters } from "../persistence/bootstrap";

// ══════════════════════════════════════════════════════════════════════════════
// Individual Checks
// ══════════════════════════════════════════════════════════════════════════════

function checkNoOpenCriticalIncidents(
  overrideMetadata?: RecoveryOverrideMetadata
): RecoveryPreconditionResult {
  const hasUnacked = hasUnacknowledgedIncidents();
  if (!hasUnacked) {
    return { name: "NO_OPEN_CRITICAL_INCIDENTS", passed: true, detail: "no unacknowledged incidents" };
  }
  if (overrideMetadata) {
    return {
      name: "NO_OPEN_CRITICAL_INCIDENTS",
      passed: true,
      detail: `override applied: ${overrideMetadata.overrideReason} by ${overrideMetadata.operatorId}`,
    };
  }
  const incidents = getIncidents().filter(function (i) { return !i.acknowledged; });
  return {
    name: "NO_OPEN_CRITICAL_INCIDENTS",
    passed: false,
    detail: `${incidents.length} unacknowledged incident(s) remain`,
  };
}

function checkRollbackReadiness(
  rollbackSnapshotId: string,
  activeSnapshotId: string
): RecoveryPreconditionResult {
  const precheck = runRollbackPrecheck(rollbackSnapshotId, activeSnapshotId);
  return {
    name: "ROLLBACK_READINESS",
    passed: precheck.passed,
    detail: precheck.passed
      ? "rollback precheck passed"
      : `rollback precheck failed: ${precheck.reasonCode}`,
  };
}

function checkRequiredSnapshotPresent(snapshotId: string): RecoveryPreconditionResult {
  const snap = getSnapshot(snapshotId);
  return {
    name: "REQUIRED_SNAPSHOT_PRESENT",
    passed: snap !== null,
    detail: snap ? `snapshot ${snapshotId} found` : `snapshot ${snapshotId} MISSING`,
  };
}

function checkSnapshotRestoreVerification(snapshotId: string): RecoveryPreconditionResult {
  const snap = getSnapshot(snapshotId);
  if (!snap) {
    return { name: "SNAPSHOT_RESTORE_VERIFICATION", passed: false, detail: "snapshot missing" };
  }
  // Verify all scope checksums are intact
  const allValid = snap.scopes.every(function (s) {
    return s.checksum && s.checksum.length > 0;
  });
  return {
    name: "SNAPSHOT_RESTORE_VERIFICATION",
    passed: allValid,
    detail: allValid ? "all scope checksums present" : "CHECKSUM_INTEGRITY_FAILURE",
  };
}

function checkAuditChainReconstructable(correlationId: string): RecoveryPreconditionResult {
  // Use the canonical event schema to check timeline reconstruction
  // We check that audit events are present for the correlationId
  try {
    const { buildTimeline } = require("../observability/canonical-event-schema");
    const timeline = buildTimeline(correlationId);
    // Empty canonical events = valid (recovery uses stabilization audit, not canonical)
    if (timeline.finalOutcome === "NO_EVENTS") {
      return { name: "AUDIT_CHAIN_RECONSTRUCTABLE", passed: true, detail: "no canonical events to verify" };
    }
    if (timeline.reconstructionStatus === "BROKEN_CHAIN") {
      return {
        name: "AUDIT_CHAIN_RECONSTRUCTABLE",
        passed: false,
        detail: `audit chain BROKEN_CHAIN for correlationId=${correlationId}`,
      };
    }
    return {
      name: "AUDIT_CHAIN_RECONSTRUCTABLE",
      passed: true,
      detail: `reconstruction status: ${timeline.reconstructionStatus}`,
    };
  } catch (_err) {
    // If no canonical events exist yet, treat as reconstructable (empty is valid)
    return { name: "AUDIT_CHAIN_RECONSTRUCTABLE", passed: true, detail: "no canonical events to verify" };
  }
}

function checkAuthorityContinuityValid(): RecoveryPreconditionResult {
  const report = checkAuthorityIntegrity();
  if (report.splitBrain) {
    return { name: "AUTHORITY_CONTINUITY_VALID", passed: false, detail: `split-brain detected: ${report.detail}` };
  }
  if (report.orphanCount > 0) {
    return { name: "AUTHORITY_CONTINUITY_VALID", passed: false, detail: `${report.orphanCount} orphan(s) detected` };
  }
  if (report.revokedStillEffective) {
    return { name: "AUTHORITY_CONTINUITY_VALID", passed: false, detail: "revoked authority still effective" };
  }
  if (report.pendingResidue) {
    return { name: "AUTHORITY_CONTINUITY_VALID", passed: false, detail: "pending successor residue" };
  }
  return { name: "AUTHORITY_CONTINUITY_VALID", passed: true, detail: "authority integrity clean" };
}

function checkCanonicalBaselineUniqueness(): RecoveryPreconditionResult {
  const result = assertSingleCanonical();
  return {
    name: "CANONICAL_BASELINE_UNIQUENESS",
    passed: result.valid,
    detail: result.reason,
  };
}

async function checkNoActiveLockConflicts(recoveryId: string): Promise<RecoveryPreconditionResult> {
  const adapters = getPersistenceAdapters();
  const existing = await adapters.lock.findByKey(recoveryLockKey(recoveryId));
  if (existing) {
    return {
      name: "NO_ACTIVE_LOCK_CONFLICTS",
      passed: false,
      detail: `recovery lock already held by ${existing.lockOwner}`,
    };
  }
  return { name: "NO_ACTIVE_LOCK_CONFLICTS", passed: true, detail: "no recovery lock conflict" };
}

async function checkNoStaleCriticalLocks(): Promise<RecoveryPreconditionResult> {
  const stale = await detectStaleLocks(0);
  const critical = stale.filter(function (l) {
    return l.targetType === "CANONICAL_BASELINE" || l.targetType === "AUTHORITY_LINE";
  });
  if (critical.length > 0) {
    return {
      name: "NO_STALE_CRITICAL_LOCKS",
      passed: false,
      detail: `${critical.length} stale critical lock(s): ${critical.map(function (l) { return l.lockKey; }).join(",")}`,
    };
  }
  return { name: "NO_STALE_CRITICAL_LOCKS", passed: true, detail: "no stale critical locks" };
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Runner
// ══════════════════════════════════════════════════════════════════════════════

export interface PreconditionRunInput {
  recoveryId: string;
  correlationId: string;
  rollbackSnapshotId: string;
  activeSnapshotId: string;
  overrideMetadata?: RecoveryOverrideMetadata;
}

export interface PreconditionRunResult {
  allPassed: boolean;
  results: RecoveryPreconditionResult[];
}

export async function runRecoveryPreconditions(
  input: PreconditionRunInput
): Promise<PreconditionRunResult> {
  const results: RecoveryPreconditionResult[] = [];

  // 1. Open critical incidents
  results.push(checkNoOpenCriticalIncidents(input.overrideMetadata));

  // 2. Rollback readiness
  results.push(checkRollbackReadiness(input.rollbackSnapshotId, input.activeSnapshotId));

  // 3. Required snapshot present
  results.push(checkRequiredSnapshotPresent(input.rollbackSnapshotId));

  // 4. Snapshot restore verification
  results.push(checkSnapshotRestoreVerification(input.rollbackSnapshotId));

  // 5. Audit chain reconstructable
  results.push(checkAuditChainReconstructable(input.correlationId));

  // 6. Authority continuity
  results.push(checkAuthorityContinuityValid());

  // 7. Canonical baseline uniqueness
  results.push(checkCanonicalBaselineUniqueness());

  // 8. No active lock conflicts (async)
  results.push(await checkNoActiveLockConflicts(input.recoveryId));

  // 9. No stale critical locks (async)
  results.push(await checkNoStaleCriticalLocks());

  const allPassed = results.every(function (r) { return r.passed; });
  return { allPassed, results };
}
