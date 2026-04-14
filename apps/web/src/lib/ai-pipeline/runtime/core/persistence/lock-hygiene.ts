// @ts-nocheck — ai-pipeline runtime: ViewModel migration 진행 중, 임시 우회
/**
 * P2-2 Slice A — Lock Hygiene / Sweeper Contract
 *
 * On-demand lock residue scanner, classifier, and cleanup plan generator.
 * No background scheduler. No force release. No auto-cleanup.
 * Operator-facing diagnostics only.
 */

import { randomUUID } from "crypto";
import { getPersistenceAdapters } from "./bootstrap";
import { logBridgeFailure } from "./bridge-logger";
import { hasUnacknowledgedIncidentsFromRepo } from "../incidents/incident-escalation";
import { getCanonicalBaselineFromRepo } from "../baseline/baseline-registry";
import { emitStabilizationAuditEvent } from "../audit/audit-events";
import type { PersistedLock } from "./lock-types";

// ══════════════════════════════════════════════════════════════════════════════
// Cleanup Execution Types (P2-2 Slice B)
// ══════════════════════════════════════════════════════════════════════════════

export interface CleanupRequest {
  planId: string;
  lockKey: string;
  expectedHygieneState: LockHygieneState;
  operatorId: string;
  approvalReason: string;
}

export interface CleanupResult {
  executed: boolean;
  reasonCode: string;
  requiresEscalation: boolean;
  cleanupAuditId: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export type LockHygieneState =
  | "ACTIVE_LEASE"
  | "EXPIRED_LEASE"
  | "STALE_LOCK"
  | "ORPHANED_LOCK"
  | "LOCK_RESIDUE_REQUIRES_OPERATOR"
  | "LOCK_RESIDUE_SAFE_TO_CLEAN";

export type DiagnosticSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type LockRecommendedAction =
  | "NO_ACTION"
  | "RENEW_LEASE"
  | "MARK_STALE"
  | "SAFE_RELEASE"
  | "OPERATOR_REVIEW"
  | "ESCALATE_INCIDENT";

export interface LockScanEntry {
  scanId: string;
  scannedAt: Date;
  lockKey: string;
  lockTarget: string;
  lockOwner: string;
  lockToken: string;
  acquiredAt: Date;
  expiresAt: Date;
  linkedEntityId: string | null;
  linkedRecoveryId: string | null;
  linkedIncidentId: string | null;
  hygieneState: LockHygieneState;
  reasonCode: string;
  recommendedAction: LockRecommendedAction;
  requiresOperator: boolean;
  diagnosticSeverity: DiagnosticSeverity;
}

export interface LockSweepResult {
  scanId: string;
  scannedAt: Date;
  entries: LockScanEntry[];
  summary: {
    total: number;
    active: number;
    expired: number;
    stale: number;
    orphaned: number;
    requiresOperator: number;
    safeToClean: number;
  };
  diagnosticEvents: string[];
}

export interface LockCleanupPlanEntry {
  planId: string;
  scanId: string;
  lockKey: string;
  hygieneState: LockHygieneState;
  recommendedAction: LockRecommendedAction;
  autoExecutable: boolean;
  requiresOperator: boolean;
  cleanupReason: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  generatedAt: Date;
}

export interface LockCleanupPlan {
  planId: string;
  scanId: string;
  entries: LockCleanupPlanEntry[];
  generatedAt: Date;
  summary: {
    totalEntries: number;
    autoExecutable: number;
    requiresOperator: number;
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Context — pre-fetched once per sweep to avoid N+1
// ══════════════════════════════════════════════════════════════════════════════

interface SweepContext {
  hasActiveRecovery: boolean;
  activeRecoveryId: string | null;
  hasUnackedIncidents: boolean;
}

async function buildSweepContext(): Promise<SweepContext> {
  var hasActiveRecovery = false;
  var activeRecoveryId: string | null = null;
  var hasUnackedIncidents = false;

  try {
    var adapters = getPersistenceAdapters();
    var active = await adapters.recoveryRecord.findActiveRecovery();
    if (active) {
      hasActiveRecovery = true;
      activeRecoveryId = active.recoveryId;
    }
  } catch (_err) {
    // non-fatal — conservative default: assume active
    hasActiveRecovery = true;
  }

  try {
    hasUnackedIncidents = await hasUnacknowledgedIncidentsFromRepo();
  } catch (_err) {
    hasUnackedIncidents = true;
  }

  return { hasActiveRecovery, activeRecoveryId, hasUnackedIncidents };
}

// ══════════════════════════════════════════════════════════════════════════════
// Critical target types — never auto-release
// ══════════════════════════════════════════════════════════════════════════════

var CRITICAL_TARGETS: readonly string[] = ["CANONICAL_BASELINE", "AUTHORITY_LINE"];

// ══════════════════════════════════════════════════════════════════════════════
// Single Lock Classification
// ══════════════════════════════════════════════════════════════════════════════

export function evaluateLockResidue(
  lock: PersistedLock,
  context: SweepContext,
  scanId: string,
  scannedAt: Date
): LockScanEntry {
  var now = Date.now();
  var isExpired = lock.expiresAt.getTime() <= now;

  // Base entry
  var entry: LockScanEntry = {
    scanId: scanId,
    scannedAt: scannedAt,
    lockKey: lock.lockKey,
    lockTarget: lock.targetType,
    lockOwner: lock.lockOwner,
    lockToken: lock.lockToken,
    acquiredAt: lock.acquiredAt,
    expiresAt: lock.expiresAt,
    linkedEntityId: null,
    linkedRecoveryId: context.activeRecoveryId,
    linkedIncidentId: null,
    hygieneState: "ACTIVE_LEASE",
    reasonCode: "ACTIVE",
    recommendedAction: "NO_ACTION",
    requiresOperator: false,
    diagnosticSeverity: "INFO",
  };

  // 1. Active lease — no action needed
  if (!isExpired) {
    return entry;
  }

  // 2. Expired — check for orphan (missing owner/token)
  if (!lock.lockOwner || !lock.lockToken) {
    entry.hygieneState = "ORPHANED_LOCK";
    entry.reasonCode = "OWNER_TOKEN_MISSING";
    entry.recommendedAction = "OPERATOR_REVIEW";
    entry.requiresOperator = true;
    entry.diagnosticSeverity = "ERROR";
    return entry;
  }

  // 3. Critical target types — never auto-release
  if (CRITICAL_TARGETS.indexOf(lock.targetType) !== -1) {
    entry.hygieneState = "LOCK_RESIDUE_REQUIRES_OPERATOR";
    entry.reasonCode = "CRITICAL_TARGET_EXPIRED";
    entry.recommendedAction = "OPERATOR_REVIEW";
    entry.requiresOperator = true;
    entry.diagnosticSeverity = "CRITICAL";
    return entry;
  }

  // 4. Recovery lock classification
  if (lock.targetType === "INCIDENT_LOCKDOWN_RECOVERY") {
    if (context.hasActiveRecovery) {
      entry.hygieneState = "STALE_LOCK";
      entry.reasonCode = "EXPIRED_WITH_ACTIVE_RECOVERY";
      entry.recommendedAction = "OPERATOR_REVIEW";
      entry.requiresOperator = true;
      entry.diagnosticSeverity = "WARNING";
      return entry;
    }
    entry.hygieneState = "LOCK_RESIDUE_SAFE_TO_CLEAN";
    entry.reasonCode = "EXPIRED_NO_ACTIVE_RECOVERY";
    entry.recommendedAction = "SAFE_RELEASE";
    entry.requiresOperator = false;
    entry.diagnosticSeverity = "INFO";
    return entry;
  }

  // 5. Incident stream lock
  if (lock.targetType === "INCIDENT_STREAM") {
    if (context.hasUnackedIncidents) {
      entry.hygieneState = "STALE_LOCK";
      entry.reasonCode = "EXPIRED_WITH_OPEN_INCIDENTS";
      entry.recommendedAction = "OPERATOR_REVIEW";
      entry.requiresOperator = true;
      entry.diagnosticSeverity = "WARNING";
      return entry;
    }
    entry.hygieneState = "LOCK_RESIDUE_SAFE_TO_CLEAN";
    entry.reasonCode = "EXPIRED_NO_OPEN_INCIDENTS";
    entry.recommendedAction = "SAFE_RELEASE";
    entry.requiresOperator = false;
    entry.diagnosticSeverity = "INFO";
    return entry;
  }

  // 6. Snapshot restore — generally safe to clean
  if (lock.targetType === "SNAPSHOT_RESTORE") {
    entry.hygieneState = "EXPIRED_LEASE";
    entry.reasonCode = "SNAPSHOT_RESTORE_LEASE_EXPIRED";
    entry.recommendedAction = "SAFE_RELEASE";
    entry.requiresOperator = false;
    entry.diagnosticSeverity = "INFO";
    return entry;
  }

  // 7. Default: expired but unknown target — conservative
  entry.hygieneState = "EXPIRED_LEASE";
  entry.reasonCode = "LEASE_EXPIRED";
  entry.recommendedAction = "MARK_STALE";
  entry.requiresOperator = false;
  entry.diagnosticSeverity = "WARNING";
  return entry;
}

// ══════════════════════════════════════════════════════════════════════════════
// Diagnostic Event Helper
// ══════════════════════════════════════════════════════════════════════════════

function emitSweepDiagnostic(
  eventType: string,
  lockKey: string,
  detail: string
): void {
  try {
    getCanonicalBaselineFromRepo().then(function (baseline) {
      emitStabilizationAuditEvent({
        eventType: eventType as Parameters<typeof emitStabilizationAuditEvent>[0]["eventType"],
        baselineId: baseline ? baseline.baselineId : "",
        baselineVersion: baseline ? baseline.baselineVersion : "",
        baselineHash: baseline ? baseline.baselineHash : "",
        snapshotId: baseline ? baseline.rollbackSnapshotId : "",
        correlationId: lockKey,
        documentType: "",
        performedBy: "lock-hygiene-sweeper",
        detail: detail,
      });
    }).catch(function () { /* non-fatal */ });
  } catch (_err) {
    // non-fatal
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Full Sweep Scan
// ══════════════════════════════════════════════════════════════════════════════

export async function scanLockResidues(): Promise<LockSweepResult> {
  var scanId = randomUUID();
  var scannedAt = new Date();
  var diagnosticEvents: string[] = [];
  var entries: LockScanEntry[] = [];

  // 1. Fetch all expired locks
  var staleLocks: PersistedLock[] = [];
  try {
    var adapters = getPersistenceAdapters();
    staleLocks = await adapters.lock.findStale(0);
  } catch (err) {
    logBridgeFailure("lock-hygiene", "scanLockResidues", err);
    emitSweepDiagnostic(
      "LOCK_SWEEP_SCAN_COMPLETED",
      "",
      "scan failed — lock store unavailable"
    );
    diagnosticEvents.push("LOCK_SWEEP_SCAN_COMPLETED");
    return {
      scanId: scanId,
      scannedAt: scannedAt,
      entries: [],
      summary: { total: 0, active: 0, expired: 0, stale: 0, orphaned: 0, requiresOperator: 0, safeToClean: 0 },
      diagnosticEvents: diagnosticEvents,
    };
  }

  // 2. Build context once (N+1 prevention)
  var context = await buildSweepContext();

  // 3. Classify each lock
  for (var i = 0; i < staleLocks.length; i++) {
    var entry = evaluateLockResidue(staleLocks[i], context, scanId, scannedAt);
    entries.push(entry);
  }

  // 4. Sort deterministically by lockKey
  entries.sort(function (a, b) {
    if (a.lockKey < b.lockKey) return -1;
    if (a.lockKey > b.lockKey) return 1;
    return 0;
  });

  // 5. Compute summary
  var summary = {
    total: entries.length,
    active: 0,
    expired: 0,
    stale: 0,
    orphaned: 0,
    requiresOperator: 0,
    safeToClean: 0,
  };

  for (var j = 0; j < entries.length; j++) {
    var e = entries[j];
    switch (e.hygieneState) {
      case "ACTIVE_LEASE": summary.active++; break;
      case "EXPIRED_LEASE": summary.expired++; break;
      case "STALE_LOCK": summary.stale++; break;
      case "ORPHANED_LOCK": summary.orphaned++; break;
      case "LOCK_RESIDUE_REQUIRES_OPERATOR": summary.requiresOperator++; break;
      case "LOCK_RESIDUE_SAFE_TO_CLEAN": summary.safeToClean++; break;
    }
    if (e.requiresOperator) summary.requiresOperator++;
  }

  // Fix double-count: LOCK_RESIDUE_REQUIRES_OPERATOR already counted in requiresOperator
  // Re-compute properly
  summary.requiresOperator = 0;
  for (var k = 0; k < entries.length; k++) {
    if (entries[k].requiresOperator) summary.requiresOperator++;
  }

  // 6. Emit diagnostic events
  emitSweepDiagnostic(
    "LOCK_SWEEP_SCAN_COMPLETED",
    "",
    "scan complete — " + entries.length + " expired lock(s) found"
  );
  diagnosticEvents.push("LOCK_SWEEP_SCAN_COMPLETED");

  if (summary.stale > 0) {
    emitSweepDiagnostic(
      "STALE_LOCK_DETECTED",
      "",
      summary.stale + " stale lock(s) detected"
    );
    diagnosticEvents.push("STALE_LOCK_DETECTED");
  }

  if (summary.orphaned > 0) {
    emitSweepDiagnostic(
      "ORPHANED_LOCK_DETECTED",
      "",
      summary.orphaned + " orphaned lock(s) detected"
    );
    diagnosticEvents.push("ORPHANED_LOCK_DETECTED");
  }

  // Emit per-entry classification for non-active entries
  for (var m = 0; m < entries.length; m++) {
    if (entries[m].hygieneState !== "ACTIVE_LEASE") {
      emitSweepDiagnostic(
        "LOCK_RESIDUE_CLASSIFIED",
        entries[m].lockKey,
        entries[m].hygieneState + " — " + entries[m].reasonCode
      );
      diagnosticEvents.push("LOCK_RESIDUE_CLASSIFIED");
    }
  }

  if (summary.requiresOperator > 0) {
    emitSweepDiagnostic(
      "LOCK_OPERATOR_REVIEW_REQUIRED",
      "",
      summary.requiresOperator + " lock(s) require operator review"
    );
    diagnosticEvents.push("LOCK_OPERATOR_REVIEW_REQUIRED");
  }

  if (summary.safeToClean > 0) {
    emitSweepDiagnostic(
      "LOCK_SAFE_RELEASE_RECOMMENDED",
      "",
      summary.safeToClean + " lock(s) safe to release"
    );
    diagnosticEvents.push("LOCK_SAFE_RELEASE_RECOMMENDED");
  }

  return {
    scanId: scanId,
    scannedAt: scannedAt,
    entries: entries,
    summary: summary,
    diagnosticEvents: diagnosticEvents,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Cleanup Plan Generator
// ══════════════════════════════════════════════════════════════════════════════

export function buildLockCleanupPlan(sweepResult: LockSweepResult): LockCleanupPlan {
  var planId = randomUUID();
  var generatedAt = new Date();
  var planEntries: LockCleanupPlanEntry[] = [];

  for (var i = 0; i < sweepResult.entries.length; i++) {
    var entry = sweepResult.entries[i];

    // Skip active leases — no cleanup needed
    if (entry.hygieneState === "ACTIVE_LEASE") continue;

    var autoExecutable = false;
    var requiresOperator = true;
    var riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM";
    var cleanupReason = entry.reasonCode;

    switch (entry.hygieneState) {
      case "LOCK_RESIDUE_SAFE_TO_CLEAN":
        autoExecutable = true;
        requiresOperator = false;
        riskLevel = "LOW";
        cleanupReason = "expired lock with no linked active state — safe to release";
        break;

      case "EXPIRED_LEASE":
        if (entry.recommendedAction === "SAFE_RELEASE") {
          autoExecutable = true;
          requiresOperator = false;
          riskLevel = "LOW";
          cleanupReason = "expired lease — safe to release";
        } else {
          autoExecutable = false;
          requiresOperator = false;
          riskLevel = "MEDIUM";
          cleanupReason = "expired lease — mark stale for review";
        }
        break;

      case "STALE_LOCK":
        autoExecutable = false;
        requiresOperator = true;
        riskLevel = "MEDIUM";
        cleanupReason = "stale lock with linked active state — operator review required";
        break;

      case "ORPHANED_LOCK":
        autoExecutable = false;
        requiresOperator = true;
        riskLevel = "HIGH";
        cleanupReason = "orphaned lock — owner/token missing, operator review required";
        break;

      case "LOCK_RESIDUE_REQUIRES_OPERATOR":
        autoExecutable = false;
        requiresOperator = true;
        riskLevel = "CRITICAL";
        cleanupReason = "critical target lock — never auto-release, operator decision required";
        break;
    }

    planEntries.push({
      planId: planId,
      scanId: sweepResult.scanId,
      lockKey: entry.lockKey,
      hygieneState: entry.hygieneState,
      recommendedAction: entry.recommendedAction,
      autoExecutable: autoExecutable,
      requiresOperator: requiresOperator,
      cleanupReason: cleanupReason,
      riskLevel: riskLevel,
      generatedAt: generatedAt,
    });
  }

  // Emit cleanup plan created
  emitSweepDiagnostic(
    "LOCK_CLEANUP_PLAN_CREATED",
    "",
    "cleanup plan created — " + planEntries.length + " entries, " +
    planEntries.filter(function (e) { return e.autoExecutable; }).length + " auto-executable"
  );

  var autoCount = planEntries.filter(function (e) { return e.autoExecutable; }).length;
  var operatorCount = planEntries.filter(function (e) { return e.requiresOperator; }).length;

  return {
    planId: planId,
    scanId: sweepResult.scanId,
    entries: planEntries,
    generatedAt: generatedAt,
    summary: {
      totalEntries: planEntries.length,
      autoExecutable: autoCount,
      requiresOperator: operatorCount,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Operator Cleanup Execution (P2-2 Slice B)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Execute a cleanup action from a cleanup plan.
 * Only autoExecutable=true entries with SAFE_RELEASE can be executed.
 * Critical target locks (CANONICAL_BASELINE, AUTHORITY_LINE) are always denied.
 * Re-validates lock state before execution.
 */
export async function executeCleanup(
  plan: LockCleanupPlan,
  request: CleanupRequest
): Promise<CleanupResult> {
  var auditId = randomUUID();

  // Emit request event
  emitSweepDiagnostic(
    "LOCK_CLEANUP_EXECUTION_REQUESTED",
    request.lockKey,
    "cleanup requested by " + request.operatorId + " reason=" + request.approvalReason
  );

  // 1. Find plan entry
  var planEntry = null;
  for (var i = 0; i < plan.entries.length; i++) {
    if (plan.entries[i].lockKey === request.lockKey) {
      planEntry = plan.entries[i];
      break;
    }
  }

  if (!planEntry) {
    emitSweepDiagnostic(
      "LOCK_CLEANUP_DENIED",
      request.lockKey,
      "plan entry not found for lockKey=" + request.lockKey
    );
    return { executed: false, reasonCode: "PLAN_ENTRY_NOT_FOUND", requiresEscalation: false, cleanupAuditId: auditId };
  }

  // 2. Verify autoExecutable
  if (!planEntry.autoExecutable) {
    emitSweepDiagnostic(
      "LOCK_CLEANUP_DENIED",
      request.lockKey,
      "plan entry is not auto-executable — hygieneState=" + planEntry.hygieneState
    );
    return { executed: false, reasonCode: "NOT_AUTO_EXECUTABLE", requiresEscalation: planEntry.requiresOperator, cleanupAuditId: auditId };
  }

  // 3. Verify expectedHygieneState matches
  if (request.expectedHygieneState !== planEntry.hygieneState) {
    emitSweepDiagnostic(
      "LOCK_CLEANUP_DENIED",
      request.lockKey,
      "hygiene state mismatch — expected=" + request.expectedHygieneState + " actual=" + planEntry.hygieneState
    );
    return { executed: false, reasonCode: "HYGIENE_STATE_MISMATCH", requiresEscalation: false, cleanupAuditId: auditId };
  }

  // 4. Re-validate: lock still exists
  var adapters;
  var currentLock;
  try {
    adapters = getPersistenceAdapters();
    currentLock = await adapters.lock.findByKey(request.lockKey);
  } catch (err) {
    logBridgeFailure("lock-hygiene", "executeCleanup-findByKey", err);
    emitSweepDiagnostic(
      "LOCK_CLEANUP_REVALIDATION_FAILED",
      request.lockKey,
      "lock store unavailable during revalidation"
    );
    return { executed: false, reasonCode: "REVALIDATION_STORE_UNAVAILABLE", requiresEscalation: false, cleanupAuditId: auditId };
  }

  if (!currentLock) {
    emitSweepDiagnostic(
      "LOCK_CLEANUP_REVALIDATION_FAILED",
      request.lockKey,
      "lock no longer exists — already cleaned or released"
    );
    return { executed: false, reasonCode: "LOCK_ALREADY_REMOVED", requiresEscalation: false, cleanupAuditId: auditId };
  }

  // 5. Critical target guard — never auto-release
  if (CRITICAL_TARGETS.indexOf(currentLock.targetType) !== -1) {
    emitSweepDiagnostic(
      "LOCK_CLEANUP_DENIED",
      request.lockKey,
      "critical target lock — auto-release denied for " + currentLock.targetType
    );
    return { executed: false, reasonCode: "CRITICAL_TARGET_DENIED", requiresEscalation: true, cleanupAuditId: auditId };
  }

  // 6. Re-validate: check linked state hasn't changed
  var context = await buildSweepContext();
  var revalidatedEntry = evaluateLockResidue(currentLock, context, plan.scanId, new Date());

  // If re-classified state is stricter (requires operator now, or became stale)
  var safeStates: string[] = ["EXPIRED_LEASE", "LOCK_RESIDUE_SAFE_TO_CLEAN"];
  if (safeStates.indexOf(revalidatedEntry.hygieneState) === -1) {
    emitSweepDiagnostic(
      "LOCK_CLEANUP_REVALIDATION_FAILED",
      request.lockKey,
      "revalidation produced stricter state — was=" + planEntry.hygieneState + " now=" + revalidatedEntry.hygieneState
    );
    return { executed: false, reasonCode: "REVALIDATION_STRICTER", requiresEscalation: revalidatedEntry.requiresOperator, cleanupAuditId: auditId };
  }

  // 7. Execute: forceExpire
  try {
    var result = await adapters.lock.forceExpire(request.lockKey);
    if (!result.acquired) {
      emitSweepDiagnostic(
        "LOCK_CLEANUP_REVALIDATION_FAILED",
        request.lockKey,
        "forceExpire failed — " + result.message
      );
      return { executed: false, reasonCode: "FORCE_EXPIRE_FAILED", requiresEscalation: false, cleanupAuditId: auditId };
    }
  } catch (err) {
    logBridgeFailure("lock-hygiene", "executeCleanup-forceExpire", err);
    emitSweepDiagnostic(
      "LOCK_CLEANUP_REVALIDATION_FAILED",
      request.lockKey,
      "forceExpire threw — " + (err instanceof Error ? err.message : String(err))
    );
    return { executed: false, reasonCode: "FORCE_EXPIRE_ERROR", requiresEscalation: false, cleanupAuditId: auditId };
  }

  // 8. Success
  emitSweepDiagnostic(
    "LOCK_CLEANUP_EXECUTED",
    request.lockKey,
    "lock cleanup executed by " + request.operatorId + " — " + request.lockKey + " force-expired"
  );

  return { executed: true, reasonCode: "CLEANUP_EXECUTED", requiresEscalation: false, cleanupAuditId: auditId };
}
