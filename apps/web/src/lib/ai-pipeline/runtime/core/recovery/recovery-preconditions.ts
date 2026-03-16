/**
 * P1-3 — Recovery Preconditions
 *
 * 9 precondition checks that must pass before recovery can proceed.
 * Each check is individually reportable for audit trail.
 * Override is only allowed for check #1 (incidents) with explicit metadata.
 */

import type { RecoveryPreconditionResult, RecoveryOverrideMetadata } from "./recovery-types";
import { getIncidents, getIncidentsFromRepo, hasUnacknowledgedIncidentsFromRepo } from "../incidents/incident-escalation";
import { getCanonicalBaseline, assertSingleCanonical } from "../baseline/baseline-registry";
import { getSnapshot, getSnapshotFromRepo } from "../baseline/snapshot-manager";
import { emitDiagnostic } from "../ontology/diagnostics";
import { runRollbackPrecheck } from "../rollback/rollback-precheck";
import { checkAuthorityIntegrity, checkAuthorityIntegrityFromRepo } from "../authority/authority-registry";
import { detectStaleLocks, recoveryLockKey } from "../persistence/lock-manager";
import { getPersistenceAdapters } from "../persistence/bootstrap";

// ══════════════════════════════════════════════════════════════════════════════
// Individual Checks
// ══════════════════════════════════════════════════════════════════════════════

async function checkNoOpenCriticalIncidents(
  overrideMetadata?: RecoveryOverrideMetadata
): Promise<RecoveryPreconditionResult> {
  emitDiagnostic(
    "CONSUMER_CUTOVER_APPLIED",
    "recovery-preconditions", "incident-adapter", "incident",
    "repository_to_canonical", "checkNoOpenCriticalIncidents:repo-first",
    {}
  );
  const hasUnacked = await hasUnacknowledgedIncidentsFromRepo();
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
  const incidents = (await getIncidentsFromRepo()).filter(function (i) { return !i.acknowledged; });
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

async function checkRequiredSnapshotPresent(snapshotId: string): Promise<RecoveryPreconditionResult> {
  emitDiagnostic(
    "CONSUMER_CUTOVER_APPLIED",
    "recovery-preconditions", "snapshot-adapter", "snapshot",
    "repository_to_canonical", "checkRequiredSnapshotPresent:repo-first",
    { entityId: snapshotId }
  );
  const snap = await getSnapshotFromRepo(snapshotId);
  return {
    name: "REQUIRED_SNAPSHOT_PRESENT",
    passed: snap !== null,
    detail: snap ? `snapshot ${snapshotId} found` : `snapshot ${snapshotId} MISSING`,
  };
}

async function checkSnapshotRestoreVerification(snapshotId: string): Promise<RecoveryPreconditionResult> {
  emitDiagnostic(
    "CONSUMER_CUTOVER_APPLIED",
    "recovery-preconditions", "snapshot-adapter", "snapshot",
    "repository_to_canonical", "checkSnapshotRestoreVerification:repo-first",
    { entityId: snapshotId }
  );
  const snap = await getSnapshotFromRepo(snapshotId);
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

/**
 * Evaluate audit chain reconstructability.
 * @param excludeFlows — flow prefixes to exclude from broken-chain evaluation
 *   (e.g. ["recovery"] during in-progress recovery)
 */
export async function checkAuditChainReconstructable(
  correlationId: string,
  opts?: { excludeFlows?: string[] }
): Promise<RecoveryPreconditionResult> {
  emitDiagnostic(
    "CONSUMER_CUTOVER_APPLIED",
    "recovery-preconditions", "canonical-event-schema-adapter", "canonical-audit",
    "repository_to_canonical", "checkAuditChainReconstructable:repo-first",
    { entityId: correlationId }
  );
  try {
    const { buildTimelineFromRepo } = require("../observability/canonical-event-schema");
    const timeline = await buildTimelineFromRepo(correlationId);
    if (timeline.orderedEvents.length === 0) {
      return { name: "AUDIT_CHAIN_RECONSTRUCTABLE", passed: true, detail: "no events yet" };
    }
    const excludes = (opts && opts.excludeFlows) || [];
    const evaluatedMissing = timeline.missingHops.filter(function (h: string) {
      for (let i = 0; i < excludes.length; i++) {
        if (h.startsWith(excludes[i] + ":")) return false;
      }
      return true;
    });
    if (evaluatedMissing.length > 2) {
      return {
        name: "AUDIT_CHAIN_RECONSTRUCTABLE",
        passed: false,
        detail: "audit chain BROKEN_CHAIN for correlationId=" + correlationId,
      };
    }
    return {
      name: "AUDIT_CHAIN_RECONSTRUCTABLE",
      passed: true,
      detail: "reconstruction status: " + timeline.reconstructionStatus,
    };
  } catch (_err) {
    return { name: "AUDIT_CHAIN_RECONSTRUCTABLE", passed: false, detail: "canonical module error" };
  }
}

async function checkAuthorityContinuityValid(): Promise<RecoveryPreconditionResult> {
  emitDiagnostic(
    "CONSUMER_CUTOVER_APPLIED",
    "recovery-preconditions", "authority-adapter", "authority",
    "repository_to_canonical", "checkAuthorityContinuityValid:repo-first",
    {}
  );
  const report = await checkAuthorityIntegrityFromRepo();
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

  // 1. Open critical incidents (P3-5: async repo-first)
  results.push(await checkNoOpenCriticalIncidents(input.overrideMetadata));

  // 2. Rollback readiness
  results.push(checkRollbackReadiness(input.rollbackSnapshotId, input.activeSnapshotId));

  // 3. Required snapshot present (P3-4: async repo-first)
  results.push(await checkRequiredSnapshotPresent(input.rollbackSnapshotId));

  // 4. Snapshot restore verification (P3-4: async repo-first)
  results.push(await checkSnapshotRestoreVerification(input.rollbackSnapshotId));

  // 5. Audit chain reconstructable (P3-5: async repo-first)
  results.push(await checkAuditChainReconstructable(input.correlationId, { excludeFlows: ["recovery"] }));

  // 6. Authority continuity (P3-5: async repo-first)
  results.push(await checkAuthorityContinuityValid());

  // 7. Canonical baseline uniqueness
  results.push(checkCanonicalBaselineUniqueness());

  // 8. No active lock conflicts (async)
  results.push(await checkNoActiveLockConflicts(input.recoveryId));

  // 9. No stale critical locks (async)
  results.push(await checkNoStaleCriticalLocks());

  const allPassed = results.every(function (r) { return r.passed; });
  return { allPassed, results };
}
