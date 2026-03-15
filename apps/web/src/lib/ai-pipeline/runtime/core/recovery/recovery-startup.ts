/**
 * P2-1 Slice C — Recovery Startup Continuity Contract
 *
 * Startup/restart recovery residue scan, operator handoff, resume/abort readiness.
 * Repository-first with memory fallback.
 * No auto-resume — operator manual decision only.
 */

import { getPersistenceAdapters } from "../persistence/bootstrap";
import { logBridgeFailure } from "../persistence/bridge-logger";
import { detectStaleLocks } from "../persistence/lock-manager";
import { scanLockResidues, buildLockCleanupPlan } from "../persistence/lock-hygiene";
import type { LockSweepResult, LockCleanupPlan } from "../persistence/lock-hygiene";
import { checkAuditChainReconstructable } from "./recovery-preconditions";
import { getRecoveryStatus } from "./recovery-coordinator";
import { hasUnacknowledgedIncidents } from "../incidents/incident-escalation";
import { checkAuthorityIntegrity } from "../authority/authority-registry";
import { getCanonicalBaseline, assertSingleCanonical } from "../baseline/baseline-registry";
import { getSnapshot } from "../baseline/snapshot-manager";
import { emitStabilizationAuditEvent } from "../audit/audit-events";
import type { PersistedRecoveryRecord } from "../persistence/types";

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export type StartupRecoveryStatus =
  | "CLEAN_START"
  | "RECOVERY_RESIDUE_DETECTED"
  | "RECOVERY_RESIDUE_WITH_STALE_LOCK"
  | "RECOVERY_RESIDUE_WITH_BROKEN_CHAIN";

export type RecommendedAction =
  | "MANUAL_VERIFY_AND_RESUME"
  | "MANUAL_VERIFY_AND_ABORT"
  | "CLEAR_STALE_LOCK_THEN_RETRY"
  | "ESCALATE_INCIDENT";

export type LockCleanupRecommendation =
  | "NO_ACTION"
  | "SAFE_RELEASE_AND_RETRY"
  | "OPERATOR_REVIEW_REQUIRED"
  | "ESCALATE_INCIDENT";

export interface LockHygieneSummary {
  staleLockCount: number;
  operatorReviewRequired: number;
  safeReleaseCandidates: number;
  criticalResiduePresent: boolean;
}

export interface OperatorHandoffPayload {
  recoveryId: string;
  currentRecoveryState: string;
  correlationId: string;
  incidentId: string | null;
  baselineId: string;
  lockKey: string | null;
  lockToken: string | null;
  startedAt: Date;
  lastHeartbeatAt: Date | null;
  failureReasonCode: string | null;
  reconstructionStatus: "RECONSTRUCTABLE" | "BROKEN_CHAIN" | "UNKNOWN";
  recommendedAction: RecommendedAction;
  lockCleanupRecommendation: LockCleanupRecommendation;
}

export interface ResumeReadinessResult {
  canResume: boolean;
  mustAbort: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  recommendedAction: RecommendedAction;
}

export interface StartupScanResult {
  status: StartupRecoveryStatus;
  reasonCode: string;
  operatorNote: string;
  handoff: OperatorHandoffPayload | null;
  resumeReadiness: ResumeReadinessResult | null;
  lockHygieneSummary: LockHygieneSummary | null;
  diagnosticEvents: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// Non-terminal state detection
// ══════════════════════════════════════════════════════════════════════════════

const NON_TERMINAL_STATES: readonly string[] = [
  "RECOVERY_REQUESTED",
  "RECOVERY_VALIDATED",
  "RECOVERY_LOCKED",
  "RECOVERY_EXECUTING",
  "RECOVERY_VERIFIED",
];

// ══════════════════════════════════════════════════════════════════════════════
// Diagnostic Event Helper
// ══════════════════════════════════════════════════════════════════════════════

function emitStartupDiagnostic(
  eventType: string,
  correlationId: string,
  performedBy: string,
  detail: string
): void {
  try {
    const baseline = getCanonicalBaseline();
    emitStabilizationAuditEvent({
      eventType: eventType as Parameters<typeof emitStabilizationAuditEvent>[0]["eventType"],
      baselineId: baseline ? baseline.baselineId : "",
      baselineVersion: baseline ? baseline.baselineVersion : "",
      baselineHash: baseline ? baseline.baselineHash : "",
      snapshotId: baseline ? baseline.rollbackSnapshotId : "",
      correlationId: correlationId,
      documentType: "",
      performedBy: performedBy,
      detail: detail,
    });
  } catch (_err) {
    // non-fatal — startup diagnostic emission failure should not block startup
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Resume / Abort Readiness Evaluation
// ══════════════════════════════════════════════════════════════════════════════

export async function evaluateResumeReadiness(
  activeRecord: PersistedRecoveryRecord
): Promise<ResumeReadinessResult> {
  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

  // 1. No open critical incidents
  const hasIncidents = hasUnacknowledgedIncidents();
  checks.push({
    name: "NO_OPEN_CRITICAL_INCIDENTS",
    passed: !hasIncidents,
    detail: hasIncidents ? "unacknowledged incidents remain" : "no open incidents",
  });

  // 2. No stale recovery lock
  let hasStaleLock = false;
  try {
    const staleLocks = await detectStaleLocks(0);
    const recoveryStale = staleLocks.filter(function (l) {
      return l.targetType === "INCIDENT_LOCKDOWN_RECOVERY";
    });
    hasStaleLock = recoveryStale.length > 0;
    checks.push({
      name: "NO_STALE_RECOVERY_LOCK",
      passed: !hasStaleLock,
      detail: hasStaleLock
        ? recoveryStale.length + " stale recovery lock(s)"
        : "no stale recovery locks",
    });
  } catch (_err) {
    checks.push({
      name: "NO_STALE_RECOVERY_LOCK",
      passed: false,
      detail: "lock store unavailable",
    });
  }

  // 3. Audit chain reconstructable
  let chainOk = true;
  try {
    const chainResult = checkAuditChainReconstructable(
      activeRecord.correlationId,
      { excludeFlows: ["recovery"] }
    );
    chainOk = chainResult.passed;
    checks.push({
      name: "AUDIT_CHAIN_RECONSTRUCTABLE",
      passed: chainResult.passed,
      detail: chainResult.detail,
    });
  } catch (_err) {
    chainOk = false;
    checks.push({
      name: "AUDIT_CHAIN_RECONSTRUCTABLE",
      passed: false,
      detail: "canonical module error",
    });
  }

  // 4. Authority continuity valid
  let authorityOk = true;
  try {
    const integrity = checkAuthorityIntegrity();
    authorityOk = !integrity.splitBrain && integrity.orphanCount === 0;
    checks.push({
      name: "AUTHORITY_CONTINUITY_VALID",
      passed: authorityOk,
      detail: authorityOk ? "authority integrity clean" : integrity.detail,
    });
  } catch (_err) {
    authorityOk = false;
    checks.push({
      name: "AUTHORITY_CONTINUITY_VALID",
      passed: false,
      detail: "authority registry unavailable",
    });
  }

  // 5. Canonical baseline unique
  let canonicalOk = true;
  try {
    const singleResult = assertSingleCanonical();
    canonicalOk = singleResult.valid;
    checks.push({
      name: "CANONICAL_BASELINE_UNIQUE",
      passed: singleResult.valid,
      detail: singleResult.reason,
    });
  } catch (_err) {
    canonicalOk = false;
    checks.push({
      name: "CANONICAL_BASELINE_UNIQUE",
      passed: false,
      detail: "baseline registry unavailable",
    });
  }

  // 6. Snapshot/rollback readiness
  let snapshotOk = false;
  try {
    const baseline = getCanonicalBaseline();
    if (baseline) {
      const rollbackSnap = getSnapshot(baseline.rollbackSnapshotId);
      snapshotOk = rollbackSnap !== null;
      checks.push({
        name: "SNAPSHOT_ROLLBACK_READY",
        passed: snapshotOk,
        detail: snapshotOk
          ? "rollback snapshot present"
          : "rollback snapshot MISSING for " + baseline.rollbackSnapshotId,
      });
    } else {
      checks.push({
        name: "SNAPSHOT_ROLLBACK_READY",
        passed: false,
        detail: "no canonical baseline available",
      });
    }
  } catch (_err) {
    checks.push({
      name: "SNAPSHOT_ROLLBACK_READY",
      passed: false,
      detail: "snapshot check failed",
    });
  }

  // Decision logic
  const allPassed = checks.every(function (c) { return c.passed; });

  if (allPassed) {
    return { canResume: true, mustAbort: false, checks, recommendedAction: "MANUAL_VERIFY_AND_RESUME" };
  }

  if (hasIncidents) {
    return { canResume: false, mustAbort: true, checks, recommendedAction: "ESCALATE_INCIDENT" };
  }

  if (hasStaleLock && chainOk && authorityOk && canonicalOk) {
    return { canResume: false, mustAbort: false, checks, recommendedAction: "CLEAR_STALE_LOCK_THEN_RETRY" };
  }

  return { canResume: false, mustAbort: true, checks, recommendedAction: "MANUAL_VERIFY_AND_ABORT" };
}

// ══════════════════════════════════════════════════════════════════════════════
// Operator Handoff Builder
// ══════════════════════════════════════════════════════════════════════════════

function buildOperatorHandoff(
  record: PersistedRecoveryRecord,
  reconstructionStatus: "RECONSTRUCTABLE" | "BROKEN_CHAIN" | "UNKNOWN",
  recommendedAction: RecommendedAction,
  lockCleanupRecommendation: LockCleanupRecommendation
): OperatorHandoffPayload {
  return {
    recoveryId: record.recoveryId,
    currentRecoveryState: record.recoveryState,
    correlationId: record.correlationId,
    incidentId: record.incidentId,
    baselineId: record.baselineId,
    lockKey: record.lockKey,
    lockToken: record.lockToken,
    startedAt: record.startedAt,
    lastHeartbeatAt: record.lastHeartbeatAt,
    failureReasonCode: record.failureReasonCode,
    reconstructionStatus: reconstructionStatus,
    recommendedAction: recommendedAction,
    lockCleanupRecommendation: lockCleanupRecommendation,
  };
}

function buildMemoryFallbackHandoff(
  memRecord: {
    recoveryId: string;
    correlationId: string;
    currentState: string;
    incidentId?: string;
    baselineId: string;
    startedAt: Date;
    failReason?: string;
  },
  recommendedAction: RecommendedAction
): OperatorHandoffPayload {
  return {
    recoveryId: memRecord.recoveryId,
    currentRecoveryState: memRecord.currentState,
    correlationId: memRecord.correlationId,
    incidentId: memRecord.incidentId || null,
    baselineId: memRecord.baselineId,
    lockKey: null,
    lockToken: null,
    startedAt: memRecord.startedAt,
    lastHeartbeatAt: null,
    failureReasonCode: memRecord.failReason || null,
    reconstructionStatus: "UNKNOWN",
    recommendedAction: recommendedAction,
    lockCleanupRecommendation: "NO_ACTION",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Startup Scan
// ══════════════════════════════════════════════════════════════════════════════

export async function runStartupRecoveryScan(): Promise<StartupScanResult> {
  const diagnosticEvents: string[] = [];

  // ── 1. Repository-first: find active (non-terminal) recovery ──
  let activeRecord: PersistedRecoveryRecord | null = null;
  let repoAvailable = true;

  try {
    const adapters = getPersistenceAdapters();
    activeRecord = await adapters.recoveryRecord.findActiveRecovery();
  } catch (err) {
    repoAvailable = false;
    logBridgeFailure("recovery-startup", "startup-scan", err);
  }

  // ── 2. No active record from repository ──
  if (!activeRecord && repoAvailable) {
    emitStartupDiagnostic(
      "RECOVERY_STARTUP_SCAN_COMPLETED",
      "",
      "system",
      "startup scan complete — no recovery residue"
    );
    diagnosticEvents.push("RECOVERY_STARTUP_SCAN_COMPLETED");

    return {
      status: "CLEAN_START",
      reasonCode: "NO_RECOVERY_RESIDUE",
      operatorNote: "Clean startup — no in-progress recovery detected.",
      handoff: null,
      resumeReadiness: null,
      lockHygieneSummary: null,
      diagnosticEvents: diagnosticEvents,
    };
  }

  // ── 3. Repository unavailable — memory fallback ──
  if (!activeRecord && !repoAvailable) {
    const memRecord = getRecoveryStatus();
    if (!memRecord) {
      emitStartupDiagnostic(
        "RECOVERY_STARTUP_SCAN_COMPLETED",
        "",
        "system",
        "startup scan complete — no recovery residue (repository unavailable, memory clean)"
      );
      diagnosticEvents.push("RECOVERY_STARTUP_SCAN_COMPLETED");

      return {
        status: "CLEAN_START",
        reasonCode: "NO_RECOVERY_RESIDUE_MEMORY_FALLBACK",
        operatorNote: "Clean startup (repository unavailable, memory fallback used). Verify repository connectivity.",
        handoff: null,
        resumeReadiness: null,
        lockHygieneSummary: null,
        diagnosticEvents: diagnosticEvents,
      };
    }

    // Memory has a non-terminal record
    const terminalStates = ["RECOVERY_RESTORED", "RECOVERY_FAILED", "RECOVERY_ESCALATED"];
    if (terminalStates.indexOf(memRecord.currentState) !== -1) {
      emitStartupDiagnostic(
        "RECOVERY_STARTUP_SCAN_COMPLETED",
        memRecord.correlationId,
        "system",
        "startup scan complete — recovery in terminal state " + memRecord.currentState + " (source=MEMORY_FALLBACK)"
      );
      diagnosticEvents.push("RECOVERY_STARTUP_SCAN_COMPLETED");

      return {
        status: "CLEAN_START",
        reasonCode: "RECOVERY_TERMINAL_MEMORY_FALLBACK",
        operatorNote: "Recovery in terminal state " + memRecord.currentState + " (source=MEMORY_FALLBACK).",
        handoff: null,
        resumeReadiness: null,
        lockHygieneSummary: null,
        diagnosticEvents: diagnosticEvents,
      };
    }

    // Non-terminal in memory — residue detected
    emitStartupDiagnostic(
      "RECOVERY_RESIDUE_DETECTED",
      memRecord.correlationId,
      "system",
      "recovery residue detected — " + memRecord.recoveryId + " in state " + memRecord.currentState + " (source=MEMORY_FALLBACK)"
    );
    diagnosticEvents.push("RECOVERY_RESIDUE_DETECTED");

    const handoff = buildMemoryFallbackHandoff(memRecord, "MANUAL_VERIFY_AND_ABORT");

    emitStartupDiagnostic(
      "RECOVERY_MANUAL_HANDOFF_CREATED",
      memRecord.correlationId,
      "system",
      "handoff created for " + memRecord.recoveryId + " (source=MEMORY_FALLBACK)"
    );
    diagnosticEvents.push("RECOVERY_MANUAL_HANDOFF_CREATED");

    return {
      status: "RECOVERY_RESIDUE_DETECTED",
      reasonCode: "RECOVERY_RESIDUE_MEMORY_FALLBACK",
      operatorNote: "Recovery residue detected (source=MEMORY_FALLBACK, repository unavailable). Manual verification required.",
      handoff: handoff,
      resumeReadiness: null,
      lockHygieneSummary: null,
      diagnosticEvents: diagnosticEvents,
    };
  }

  // ── 4. Active record found from repository ──
  const record = activeRecord!;

  emitStartupDiagnostic(
    "RECOVERY_RESIDUE_DETECTED",
    record.correlationId,
    "system",
    "recovery residue detected — " + record.recoveryId + " in state " + record.recoveryState
  );
  diagnosticEvents.push("RECOVERY_RESIDUE_DETECTED");

  // ── 4a. Check for stale locks ──
  let hasStaleRecoveryLock = false;
  try {
    const staleLocks = await detectStaleLocks(0);
    const recoveryStale = staleLocks.filter(function (l) {
      return l.targetType === "INCIDENT_LOCKDOWN_RECOVERY";
    });
    hasStaleRecoveryLock = recoveryStale.length > 0;
  } catch (_err) {
    // non-fatal
  }

  // ── 4b. Check audit chain ──
  let reconstructionStatus: "RECONSTRUCTABLE" | "BROKEN_CHAIN" | "UNKNOWN" = "UNKNOWN";
  let hasBrokenChain = false;
  try {
    const chainResult = checkAuditChainReconstructable(
      record.correlationId,
      { excludeFlows: ["recovery"] }
    );
    if (chainResult.passed) {
      reconstructionStatus = "RECONSTRUCTABLE";
    } else {
      reconstructionStatus = "BROKEN_CHAIN";
      hasBrokenChain = true;
    }
  } catch (_err) {
    reconstructionStatus = "UNKNOWN";
  }

  // ── 4c. Classify startup status ──
  let status: StartupRecoveryStatus;
  let reasonCode: string;
  let operatorNote: string;

  if (hasStaleRecoveryLock) {
    status = "RECOVERY_RESIDUE_WITH_STALE_LOCK";
    reasonCode = "STALE_RECOVERY_LOCK_PRESENT";
    operatorNote = "Recovery " + record.recoveryId + " in state " + record.recoveryState +
      " with stale recovery lock. Clear lock before retry.";
  } else if (hasBrokenChain) {
    status = "RECOVERY_RESIDUE_WITH_BROKEN_CHAIN";
    reasonCode = "AUDIT_CHAIN_BROKEN";
    operatorNote = "Recovery " + record.recoveryId + " in state " + record.recoveryState +
      " with broken audit chain. Manual verification required.";
  } else {
    status = "RECOVERY_RESIDUE_DETECTED";
    reasonCode = "NON_TERMINAL_RECOVERY_IN_PROGRESS";
    operatorNote = "Recovery " + record.recoveryId + " in state " + record.recoveryState +
      ". Evaluate resume readiness before proceeding.";
  }

  // ── 4d. Evaluate resume readiness ──
  const readiness = await evaluateResumeReadiness(record);

  emitStartupDiagnostic(
    "RECOVERY_RESUME_READINESS_EVALUATED",
    record.correlationId,
    "system",
    "resume readiness: canResume=" + readiness.canResume +
    " mustAbort=" + readiness.mustAbort +
    " recommended=" + readiness.recommendedAction
  );
  diagnosticEvents.push("RECOVERY_RESUME_READINESS_EVALUATED");

  // ── 4e. Emit abort recommendation if needed ──
  if (readiness.mustAbort) {
    emitStartupDiagnostic(
      "RECOVERY_ABORT_RECOMMENDED",
      record.correlationId,
      "system",
      "abort recommended for " + record.recoveryId + " reason=" + readiness.recommendedAction
    );
    diagnosticEvents.push("RECOVERY_ABORT_RECOMMENDED");
  }

  // ── 4f. Lock hygiene scan ──
  let lockHygieneSummary: LockHygieneSummary | null = null;
  let lockCleanupRecommendation: LockCleanupRecommendation = "NO_ACTION";
  try {
    const sweepResult = await scanLockResidues();
    if (sweepResult.entries.length > 0) {
      const criticalPresent = sweepResult.entries.some(function (e) {
        return e.hygieneState === "LOCK_RESIDUE_REQUIRES_OPERATOR";
      });
      lockHygieneSummary = {
        staleLockCount: sweepResult.summary.stale,
        operatorReviewRequired: sweepResult.summary.requiresOperator,
        safeReleaseCandidates: sweepResult.summary.safeToClean + sweepResult.summary.expired,
        criticalResiduePresent: criticalPresent,
      };

      // Determine cleanup recommendation
      if (hasUnacknowledgedIncidents()) {
        lockCleanupRecommendation = "ESCALATE_INCIDENT";
      } else if (sweepResult.summary.requiresOperator > 0 || criticalPresent) {
        lockCleanupRecommendation = "OPERATOR_REVIEW_REQUIRED";
      } else if (sweepResult.summary.safeToClean > 0 || sweepResult.summary.expired > 0) {
        lockCleanupRecommendation = "SAFE_RELEASE_AND_RETRY";
      }
    }
  } catch (_err) {
    // non-fatal — lock hygiene scan failure should not block startup
  }

  // ── 4g. Build handoff ──
  const handoff = buildOperatorHandoff(record, reconstructionStatus, readiness.recommendedAction, lockCleanupRecommendation);

  emitStartupDiagnostic(
    "RECOVERY_MANUAL_HANDOFF_CREATED",
    record.correlationId,
    "system",
    "handoff created for " + record.recoveryId + " action=" + readiness.recommendedAction +
    " lockCleanup=" + lockCleanupRecommendation
  );
  diagnosticEvents.push("RECOVERY_MANUAL_HANDOFF_CREATED");

  return {
    status: status,
    reasonCode: reasonCode,
    operatorNote: operatorNote,
    handoff: handoff,
    resumeReadiness: readiness,
    lockHygieneSummary: lockHygieneSummary,
    diagnosticEvents: diagnosticEvents,
  };
}
