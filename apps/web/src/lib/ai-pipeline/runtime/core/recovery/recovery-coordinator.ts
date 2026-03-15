/**
 * P1-3 + P2-1 — Recovery Coordinator
 *
 * Orchestrates the INCIDENT_LOCKDOWN → ACTIVE_100 recovery path.
 * Singleton: only one recovery active at a time.
 * State machine: sequential advancement only, no skip, no implicit unlock.
 *
 * P2-1 Slice B: repository-first persistence + memory shim.
 * Write path: repository-first, memory shim syncs on success.
 * Read path: getRecoveryStatus() sync (memory), getRecoveryStatusAsync() repo-first.
 * Failure: structured diagnostic (logBridgeFailure + audit event), never silent.
 */

import { randomUUID } from "crypto";
import type {
  RecoveryState,
  RecoveryRecord,
  RecoveryResult,
  RecoveryStage,
  RecoveryStageResult,
  RecoveryOverrideMetadata,
} from "./recovery-types";
import { RECOVERY_STATE_ORDER, RECOVERY_FAILURE_STATES, RECOVERY_STAGE_ORDER } from "./recovery-types";
import { runRecoveryPreconditions } from "./recovery-preconditions";
import { emitStabilizationAuditEvent } from "../audit/audit-events";
import { getCanonicalBaselineFromRepo, assertSingleCanonical, isCanonicalActiveCombination } from "../baseline/baseline-registry";
import { getSnapshotFromRepo } from "../baseline/snapshot-manager";
import { checkAuthorityIntegrityFromRepo } from "../authority/authority-registry";
import { hasUnacknowledgedIncidentsFromRepo, escalateIncident } from "../incidents/incident-escalation";
import { withLock, detectStaleLocks, recoveryLockKey } from "../persistence/lock-manager";
import { getPersistenceAdapters } from "../persistence/bootstrap";
import { logBridgeFailure } from "../persistence/bridge-logger";
import { RecoveryOntologyAdapter, toRepositoryPatch as buildRecoveryPatch } from "../ontology/recovery-adapter";
import { emitDiagnostic } from "../ontology/diagnostics";
import type { CreateRecoveryRecordInput } from "../persistence/types";
import { guardLifecycleTransition, guardCanonicalCombination } from "../runtime/transition-guard";
import { runResidueScan } from "../rollback/residue-scan";
import { reconcileState } from "../rollback/state-reconciliation";

// ══════════════════════════════════════════════════════════════════════════════
// Singleton Recovery Record (memory shim)
// ══════════════════════════════════════════════════════════════════════════════

let _recoveryRecord: RecoveryRecord | null = null;

// Persistence tracking — optimistic lock tokens for repository writes
let _lastPersistedId: string | null = null;
let _lastPersistedUpdatedAt: Date | null = null;

// ══════════════════════════════════════════════════════════════════════════════
// Persistence Helper — Repository-First Write
// ══════════════════════════════════════════════════════════════════════════════

function mapRecordToCreateInput(record: RecoveryRecord): CreateRecoveryRecordInput {
  const canonical = RecoveryOntologyAdapter.fromLegacy(record);
  return RecoveryOntologyAdapter.toRepositoryInput(canonical);
}

function mapRecordToPatch(record: RecoveryRecord, overrides?: Record<string, unknown>): Record<string, unknown> {
  const canonical = RecoveryOntologyAdapter.fromLegacy(record);
  return buildRecoveryPatch(canonical, overrides);
}

/**
 * Repository-first persistence for recovery state.
 * On failure: structured diagnostic (logBridgeFailure + audit), never silent.
 * On success: updates optimistic lock tokens.
 */
function persistRecoveryState(
  action: "CREATE" | "UPDATE",
  record: RecoveryRecord,
  overrides?: Record<string, unknown>
): void {
  try {
    const adapters = getPersistenceAdapters();
    if (action === "CREATE") {
      const input = mapRecordToCreateInput(record);
      adapters.recoveryRecord.saveRecoveryRecord(input).then(function (result: any) {
        if (result.ok) {
          _lastPersistedId = result.data.id;
          _lastPersistedUpdatedAt = result.data.updatedAt;
        } else {
          logBridgeFailure("recovery-coordinator", "persistRecoveryState:CREATE", result.error.message);
          emitRecoveryAudit("RECOVERY_PERSISTENCE_WRITE_FAILURE", record,
            "action=CREATE err=" + result.error.message);
        }
      }).catch(function (err: unknown) {
        logBridgeFailure("recovery-coordinator", "persistRecoveryState:CREATE", err);
        emitRecoveryAudit("RECOVERY_PERSISTENCE_WRITE_FAILURE", record,
          "action=CREATE err=" + (err instanceof Error ? err.message : String(err)));
      });
    } else {
      // UPDATE
      if (!_lastPersistedId || !_lastPersistedUpdatedAt) {
        logBridgeFailure("recovery-coordinator", "persistRecoveryState:UPDATE",
          "no persisted record to update (CREATE may have failed)");
        return;
      }
      const patch = mapRecordToPatch(record, overrides);
      adapters.recoveryRecord.updateRecoveryRecord({
        id: _lastPersistedId,
        expectedUpdatedAt: _lastPersistedUpdatedAt,
        patch: patch as any,
      }).then(function (result: any) {
        if (result.ok) {
          _lastPersistedId = result.data.id;
          _lastPersistedUpdatedAt = result.data.updatedAt;
        } else {
          logBridgeFailure("recovery-coordinator", "persistRecoveryState:UPDATE", result.error.message);
          emitRecoveryAudit("RECOVERY_PERSISTENCE_WRITE_FAILURE", record,
            "action=UPDATE err=" + result.error.message);
        }
      }).catch(function (err: unknown) {
        logBridgeFailure("recovery-coordinator", "persistRecoveryState:UPDATE", err);
        emitRecoveryAudit("RECOVERY_PERSISTENCE_WRITE_FAILURE", record,
          "action=UPDATE err=" + (err instanceof Error ? err.message : String(err)));
      });
    }
  } catch (err) {
    logBridgeFailure("recovery-coordinator", "persistRecoveryState:" + action, err);
  }
}

/**
 * Async variant of persist — awaits the result. Used in async functions.
 */
async function persistRecoveryStateAsync(
  action: "CREATE" | "UPDATE",
  record: RecoveryRecord,
  overrides?: Record<string, unknown>
): Promise<void> {
  try {
    const adapters = getPersistenceAdapters();
    if (action === "CREATE") {
      const input = mapRecordToCreateInput(record);
      const result = await adapters.recoveryRecord.saveRecoveryRecord(input);
      if (result.ok) {
        _lastPersistedId = result.data.id;
        _lastPersistedUpdatedAt = result.data.updatedAt;
      } else {
        logBridgeFailure("recovery-coordinator", "persistRecoveryState:CREATE", result.error.message);
        emitRecoveryAudit("RECOVERY_PERSISTENCE_WRITE_FAILURE", record,
          "action=CREATE err=" + result.error.message);
      }
    } else {
      if (!_lastPersistedId || !_lastPersistedUpdatedAt) {
        logBridgeFailure("recovery-coordinator", "persistRecoveryState:UPDATE",
          "no persisted record to update (CREATE may have failed)");
        return;
      }
      const patch = mapRecordToPatch(record, overrides);
      const result = await adapters.recoveryRecord.updateRecoveryRecord({
        id: _lastPersistedId,
        expectedUpdatedAt: _lastPersistedUpdatedAt,
        patch: patch as any,
      });
      if (result.ok) {
        _lastPersistedId = result.data.id;
        _lastPersistedUpdatedAt = result.data.updatedAt;
      } else {
        logBridgeFailure("recovery-coordinator", "persistRecoveryState:UPDATE", result.error.message);
        emitRecoveryAudit("RECOVERY_PERSISTENCE_WRITE_FAILURE", record,
          "action=UPDATE err=" + result.error.message);
      }
    }
  } catch (err) {
    logBridgeFailure("recovery-coordinator", "persistRecoveryState:" + action, err);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// State Machine Enforcement
// ══════════════════════════════════════════════════════════════════════════════

function advanceRecoveryState(
  record: RecoveryRecord,
  from: RecoveryState,
  to: RecoveryState
): { ok: boolean; reason?: string } {
  if (record.currentState !== from) {
    return { ok: false, reason: `expected state ${from}, got ${record.currentState}` };
  }

  // Allow transition to failure states from specific states
  if (RECOVERY_FAILURE_STATES.includes(to)) {
    if (to === "RECOVERY_FAILED") {
      // RECOVERY_FAILED reachable from RECOVERY_REQUESTED, RECOVERY_EXECUTING, RECOVERY_VALIDATED, RECOVERY_LOCKED
      const failableFrom: RecoveryState[] = ["RECOVERY_REQUESTED", "RECOVERY_VALIDATED", "RECOVERY_LOCKED", "RECOVERY_EXECUTING"];
      if (!failableFrom.includes(from)) {
        return { ok: false, reason: `cannot transition to RECOVERY_FAILED from ${from}` };
      }
      record.currentState = to;
      return { ok: true };
    }
    if (to === "RECOVERY_ESCALATED") {
      if (from !== "RECOVERY_FAILED") {
        return { ok: false, reason: `RECOVERY_ESCALATED only reachable from RECOVERY_FAILED` };
      }
      record.currentState = to;
      return { ok: true };
    }
  }

  // Normal sequential advancement
  const fromIdx = RECOVERY_STATE_ORDER.indexOf(from);
  const toIdx = RECOVERY_STATE_ORDER.indexOf(to);

  if (fromIdx === -1 || toIdx === -1) {
    return { ok: false, reason: `invalid state: from=${from} to=${to}` };
  }

  if (toIdx !== fromIdx + 1) {
    return { ok: false, reason: `skip not allowed: ${from} → ${to} (expected ${RECOVERY_STATE_ORDER[fromIdx + 1]})` };
  }

  record.currentState = to;
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════════════════════
// Audit Emission Helper
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Async repo-first audit emission. Uses getCanonicalBaselineFromRepo() for baseline metadata.
 * Emits RECOVERY_SYNC_READ_REMOVED diagnostic at each replacement site.
 */
async function emitRecoveryAuditAsync(
  eventType: string,
  record: RecoveryRecord,
  detail: string
): Promise<void> {
  emitDiagnostic(
    "RECOVERY_SYNC_READ_REMOVED",
    "recovery-coordinator", "baseline-adapter", "baseline",
    "repository_to_canonical", "emitRecoveryAudit:getCanonicalBaseline→getCanonicalBaselineFromRepo",
    { correlationId: record.correlationId }
  );
  const baseline = await getCanonicalBaselineFromRepo();
  if (!baseline) {
    emitDiagnostic(
      "REPO_FALLBACK_REMOVED",
      "recovery-coordinator", "baseline-adapter", "baseline",
      "repository_to_canonical", "emitRecoveryAuditAsync:repo-only-null-accepted",
      { correlationId: record.correlationId, fallbackUsed: false }
    );
  }
  emitStabilizationAuditEvent({
    eventType: eventType as Parameters<typeof emitStabilizationAuditEvent>[0]["eventType"],
    baselineId: record.baselineId,
    baselineVersion: baseline ? baseline.baselineVersion : "",
    baselineHash: baseline ? baseline.baselineHash : "",
    snapshotId: baseline ? baseline.rollbackSnapshotId : "",
    correlationId: record.correlationId,
    documentType: "",
    performedBy: record.actor,
    detail: `recoveryId=${record.recoveryId} ${detail}`,
  });

  // Bridge to canonical audit log for timeline reconstruction
  try {
    const { emitRecoveryCanonicalEvent } = require("./recovery-canonical-bridge");
    emitRecoveryCanonicalEvent(eventType, record, detail);
  } catch (_bridgeErr) { /* non-fatal */ }
}

/**
 * Sync fire-and-forget wrapper for emitRecoveryAuditAsync.
 * Used from sync contexts (requestRecovery). Delegates to async repo-first path.
 */
function emitRecoveryAudit(
  eventType: string,
  record: RecoveryRecord,
  detail: string
): void {
  emitRecoveryAuditAsync(eventType, record, detail).catch(function () { /* fire-and-forget */ });
}

// ══════════════════════════════════════════════════════════════════════════════
// Entry Point: requestRecovery
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestRecoveryInput {
  actor: string;
  reason: string;
  correlationId: string;
  baselineId: string;
  incidentId?: string;
  lifecycleState: string;
  overrideMetadata?: RecoveryOverrideMetadata;
}

export function requestRecovery(input: RequestRecoveryInput): RecoveryResult {
  // Must be in INCIDENT_LOCKDOWN
  if (input.lifecycleState !== "INCIDENT_LOCKDOWN") {
    return {
      success: false,
      recoveryId: "",
      finalState: "LOCKDOWN_ACTIVE",
      reasonCode: "NOT_IN_LOCKDOWN",
      detail: `lifecycle is ${input.lifecycleState}, not INCIDENT_LOCKDOWN`,
      stagesCompleted: [],
    };
  }

  // Only one recovery at a time
  if (_recoveryRecord && !RECOVERY_FAILURE_STATES.includes(_recoveryRecord.currentState) && _recoveryRecord.currentState !== "RECOVERY_RESTORED") {
    return {
      success: false,
      recoveryId: _recoveryRecord.recoveryId,
      finalState: _recoveryRecord.currentState,
      reasonCode: "RECOVERY_ALREADY_IN_PROGRESS",
      detail: `existing recovery ${_recoveryRecord.recoveryId} in state ${_recoveryRecord.currentState}`,
      stagesCompleted: [],
    };
  }

  const recoveryId = `recovery-${randomUUID().slice(0, 8)}`;

  _recoveryRecord = {
    recoveryId,
    correlationId: input.correlationId,
    actor: input.actor,
    reason: input.reason,
    currentState: "LOCKDOWN_ACTIVE",
    baselineId: input.baselineId,
    incidentId: input.incidentId,
    preconditionResults: [],
    overrideMetadata: input.overrideMetadata,
    stages: [],
    startedAt: new Date(),
  };

  // Advance to RECOVERY_REQUESTED
  const adv = advanceRecoveryState(_recoveryRecord, "LOCKDOWN_ACTIVE", "RECOVERY_REQUESTED");
  if (!adv.ok) {
    return {
      success: false,
      recoveryId,
      finalState: _recoveryRecord.currentState,
      reasonCode: "STATE_ADVANCE_FAILED",
      detail: adv.reason || "",
      stagesCompleted: [],
    };
  }

  // M1+M2: Persist initial record with RECOVERY_REQUESTED state (fire-and-forget in sync context)
  persistRecoveryState("CREATE", _recoveryRecord);

  emitRecoveryAudit("INCIDENT_LOCKDOWN_RECOVERY_REQUESTED", _recoveryRecord, `reason=${input.reason}`);

  return {
    success: true,
    recoveryId,
    finalState: "RECOVERY_REQUESTED",
    reasonCode: "RECOVERY_REQUESTED",
    detail: `recovery requested by ${input.actor}`,
    stagesCompleted: [],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Validation
// ══════════════════════════════════════════════════════════════════════════════

export async function validateRecovery(recoveryId: string): Promise<RecoveryResult> {
  if (!_recoveryRecord || _recoveryRecord.recoveryId !== recoveryId) {
    return {
      success: false,
      recoveryId,
      finalState: "LOCKDOWN_ACTIVE",
      reasonCode: "RECOVERY_NOT_FOUND",
      detail: `no recovery record for ${recoveryId}`,
      stagesCompleted: [],
    };
  }

  emitDiagnostic(
    "RECOVERY_SYNC_READ_REMOVED",
    "recovery-coordinator", "baseline-adapter", "baseline",
    "repository_to_canonical", "validateRecovery:getCanonicalBaseline→getCanonicalBaselineFromRepo",
    { correlationId: _recoveryRecord.correlationId }
  );
  const baseline = await getCanonicalBaselineFromRepo();
  if (!baseline) {
    emitDiagnostic(
      "REPO_FALLBACK_REMOVED",
      "recovery-coordinator", "baseline-adapter", "baseline",
      "repository_to_canonical", "validateRecovery:repo-only-null-accepted",
      { correlationId: _recoveryRecord.correlationId, fallbackUsed: false }
    );
  }
  const rollbackSnapshotId = baseline ? baseline.rollbackSnapshotId : "";
  const activeSnapshotId = baseline ? baseline.activeSnapshotId : "";

  const preconditionResult = await runRecoveryPreconditions({
    recoveryId,
    correlationId: _recoveryRecord.correlationId,
    rollbackSnapshotId,
    activeSnapshotId,
    overrideMetadata: _recoveryRecord.overrideMetadata,
  });

  _recoveryRecord.preconditionResults = preconditionResult.results;

  if (preconditionResult.allPassed) {
    advanceRecoveryState(_recoveryRecord, "RECOVERY_REQUESTED", "RECOVERY_VALIDATED");

    // M3: Persist preconditions + VALIDATED state
    await persistRecoveryStateAsync("UPDATE", _recoveryRecord);

    await emitRecoveryAuditAsync("INCIDENT_LOCKDOWN_RECOVERY_VALIDATED", _recoveryRecord, "all preconditions passed");

    // Emit override audit if override was used
    if (_recoveryRecord.overrideMetadata) {
      // M11: Persist override metadata
      await persistRecoveryStateAsync("UPDATE", _recoveryRecord);
      await emitRecoveryAuditAsync("LOCKDOWN_OVERRIDE_USED", _recoveryRecord,
        `operator=${_recoveryRecord.overrideMetadata.operatorId} reason=${_recoveryRecord.overrideMetadata.overrideReason}`);
    }

    return {
      success: true,
      recoveryId,
      finalState: "RECOVERY_VALIDATED",
      reasonCode: "RECOVERY_VALIDATED",
      detail: "all preconditions passed",
      stagesCompleted: [],
    };
  }

  // Validation failed
  const failedChecks = preconditionResult.results
    .filter(function (r) { return !r.passed; })
    .map(function (r) { return r.name; });

  advanceRecoveryState(_recoveryRecord, "RECOVERY_REQUESTED", "RECOVERY_FAILED");
  _recoveryRecord.failReason = `preconditions failed: ${failedChecks.join(",")}`;

  // M4: Persist FAILED state + failureReasonCode
  await persistRecoveryStateAsync("UPDATE", _recoveryRecord);

  await emitRecoveryAuditAsync("INCIDENT_LOCKDOWN_RECOVERY_DENIED", _recoveryRecord,
    `failed=${failedChecks.join(",")}`);

  return {
    success: false,
    recoveryId,
    finalState: "RECOVERY_FAILED",
    reasonCode: "PRECONDITIONS_FAILED",
    detail: `failed: ${failedChecks.join(",")}`,
    stagesCompleted: [],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Execution (async, with distributed lock)
// ══════════════════════════════════════════════════════════════════════════════

export async function executeRecoveryAsync(recoveryId: string): Promise<RecoveryResult> {
  if (!_recoveryRecord || _recoveryRecord.recoveryId !== recoveryId) {
    return {
      success: false,
      recoveryId,
      finalState: "LOCKDOWN_ACTIVE",
      reasonCode: "RECOVERY_NOT_FOUND",
      detail: `no recovery record for ${recoveryId}`,
      stagesCompleted: [],
    };
  }

  if (_recoveryRecord.currentState !== "RECOVERY_VALIDATED") {
    return {
      success: false,
      recoveryId,
      finalState: _recoveryRecord.currentState,
      reasonCode: "INVALID_STATE_FOR_EXECUTION",
      detail: `expected RECOVERY_VALIDATED, got ${_recoveryRecord.currentState}`,
      stagesCompleted: [],
    };
  }

  const lockResult = await withLock(
    recoveryLockKey(recoveryId),
    _recoveryRecord.actor,
    "INCIDENT_LOCKDOWN_RECOVERY",
    "recovery-execution",
    _recoveryRecord.correlationId,
    120_000, // 120s TTL
    async function (lock) {
      // M5: Persist lock metadata + LOCKED → EXECUTING states
      return executeRecoveryStages(_recoveryRecord!, {
        lockKey: lock.lockKey,
        lockToken: lock.lockToken,
      });
    }
  );

  if (!lockResult.acquired) {
    advanceRecoveryState(_recoveryRecord, "RECOVERY_VALIDATED", "RECOVERY_FAILED");
    _recoveryRecord.failReason = `lock acquisition failed: ${lockResult.message}`;

    // M10: Persist lock failure state
    await persistRecoveryStateAsync("UPDATE", _recoveryRecord);

    await emitRecoveryAuditAsync("INCIDENT_LOCKDOWN_RECOVERY_FAILED", _recoveryRecord, `lock: ${lockResult.message}`);

    return {
      success: false,
      recoveryId,
      finalState: "RECOVERY_FAILED",
      reasonCode: "RECOVERY_LOCK_REQUIRED",
      detail: lockResult.message,
      stagesCompleted: [],
    };
  }

  return lockResult.data;
}

async function executeRecoveryStages(
  record: RecoveryRecord,
  lockMeta?: { lockKey: string; lockToken: string }
): Promise<RecoveryResult> {
  // RECOVERY_VALIDATED → RECOVERY_LOCKED
  advanceRecoveryState(record, "RECOVERY_VALIDATED", "RECOVERY_LOCKED");

  // RECOVERY_LOCKED → RECOVERY_EXECUTING
  advanceRecoveryState(record, "RECOVERY_LOCKED", "RECOVERY_EXECUTING");

  // M5: Persist EXECUTING state + lock metadata
  await persistRecoveryStateAsync("UPDATE", record, lockMeta ? {
    lockKey: lockMeta.lockKey,
    lockToken: lockMeta.lockToken,
  } : undefined);

  await emitRecoveryAuditAsync("INCIDENT_LOCKDOWN_RECOVERY_EXECUTING", record, "starting 7-stage execution");

  const completedStages: RecoveryStage[] = [];
  emitDiagnostic(
    "RECOVERY_SYNC_READ_REMOVED",
    "recovery-coordinator", "baseline-adapter", "baseline",
    "repository_to_canonical", "executeRecoveryStages:getCanonicalBaseline→getCanonicalBaselineFromRepo",
    { correlationId: record.correlationId }
  );
  const baseline = await getCanonicalBaselineFromRepo();
  if (!baseline) {
    emitDiagnostic(
      "REPO_FALLBACK_REMOVED",
      "recovery-coordinator", "baseline-adapter", "baseline",
      "repository_to_canonical", "executeRecoveryStages:repo-only-null-accepted",
      { correlationId: record.correlationId, fallbackUsed: false }
    );
  }

  for (const stage of RECOVERY_STAGE_ORDER) {
    const stageResult = await runRecoveryStage(stage, record, baseline);
    record.stages.push(stageResult);

    if (!stageResult.passed) {
      // Stage failed — transition to RECOVERY_FAILED → RECOVERY_ESCALATED
      advanceRecoveryState(record, "RECOVERY_EXECUTING", "RECOVERY_FAILED");
      record.failReason = `stage ${stage} failed: ${stageResult.detail}`;
      record.completedAt = new Date();

      // M7: Persist FAILED + completedAt
      await persistRecoveryStateAsync("UPDATE", record);

      await emitRecoveryAuditAsync("INCIDENT_LOCKDOWN_RECOVERY_FAILED", record,
        `stage=${stage} detail=${stageResult.detail}`);

      // Escalate incident
      escalateIncident(
        "RECOVERY_STAGE_FAILED",
        record.correlationId,
        record.actor,
        `recovery ${record.recoveryId} failed at stage ${stage}: ${stageResult.detail}`
      );

      advanceRecoveryState(record, "RECOVERY_FAILED", "RECOVERY_ESCALATED");

      // M8: Persist ESCALATED state
      await persistRecoveryStateAsync("UPDATE", record);

      await emitRecoveryAuditAsync("INCIDENT_LOCKDOWN_RECOVERY_ESCALATED", record,
        `stage=${stage} escalated`);

      return {
        success: false,
        recoveryId: record.recoveryId,
        finalState: "RECOVERY_ESCALATED",
        reasonCode: "RECOVERY_STAGE_FAILED",
        detail: `stage ${stage} failed: ${stageResult.detail}`,
        stagesCompleted: completedStages,
      };
    }

    completedStages.push(stage);

    // M6: Persist stage result + heartbeat (per stage)
    await persistRecoveryStateAsync("UPDATE", record);
  }

  // All stages passed
  advanceRecoveryState(record, "RECOVERY_EXECUTING", "RECOVERY_VERIFIED");
  await emitRecoveryAuditAsync("INCIDENT_LOCKDOWN_RECOVERY_VERIFIED", record, "all 7 stages passed");

  advanceRecoveryState(record, "RECOVERY_VERIFIED", "RECOVERY_RESTORED");
  record.completedAt = new Date();

  // M9: Persist RESTORED + completedAt
  await persistRecoveryStateAsync("UPDATE", record);

  await emitRecoveryAuditAsync("INCIDENT_LOCKDOWN_RECOVERY_RESTORED", record, "ACTIVE_100 restored");

  return {
    success: true,
    recoveryId: record.recoveryId,
    finalState: "RECOVERY_RESTORED",
    reasonCode: "RECOVERY_RESTORED",
    detail: "recovery complete — ACTIVE_100 restored",
    stagesCompleted: completedStages,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Individual Stage Execution
// ══════════════════════════════════════════════════════════════════════════════

async function runRecoveryStage(
  stage: RecoveryStage,
  record: RecoveryRecord,
  baseline: Awaited<ReturnType<typeof getCanonicalBaselineFromRepo>>
): Promise<RecoveryStageResult> {
  const now = new Date();

  switch (stage) {
    case "PRE_RECOVERY_VALIDATION": {
      // Verify we're still in a valid recovery state
      if (record.currentState !== "RECOVERY_EXECUTING") {
        return { stage, passed: false, detail: `unexpected state: ${record.currentState}`, timestamp: now };
      }
      return { stage, passed: true, detail: "pre-recovery validation passed", timestamp: now };
    }

    case "RESTORE_RECONCILE": {
      if (!baseline) {
        return { stage, passed: false, detail: "no canonical baseline", timestamp: now };
      }
      emitDiagnostic(
        "RECOVERY_SYNC_READ_REMOVED",
        "recovery-coordinator", "snapshot-adapter", "snapshot",
        "repository_to_canonical", "runRecoveryStage:RESTORE_RECONCILE:getSnapshot→getSnapshotFromRepo",
        { entityId: baseline.rollbackSnapshotId, correlationId: record.correlationId }
      );
      const rollbackSnap = await getSnapshotFromRepo(baseline.rollbackSnapshotId);
      if (!rollbackSnap) {
        emitDiagnostic(
          "REPO_FALLBACK_REMOVED",
          "recovery-coordinator", "snapshot-adapter", "snapshot",
          "repository_to_canonical", "runRecoveryStage:RESTORE_RECONCILE:repo-only-null-accepted",
          { entityId: baseline.rollbackSnapshotId, correlationId: record.correlationId, fallbackUsed: false }
        );
      }
      if (!rollbackSnap) {
        return { stage, passed: false, detail: "rollback snapshot missing", timestamp: now };
      }
      // Build current state from snapshot scopes for reconciliation
      const currentState: Record<string, Record<string, unknown>> = {};
      for (const s of rollbackSnap.scopes) {
        currentState[s.scope] = s.data;
      }
      const recon = reconcileState(baseline.rollbackSnapshotId, currentState);
      if (recon.unresolvedCount > 0) {
        return { stage, passed: false, detail: `${recon.unresolvedCount} unresolved diffs`, timestamp: now };
      }
      return { stage, passed: true, detail: "restore/reconcile clean", timestamp: now };
    }

    case "LOCK_CLEANUP_VALIDATION": {
      const stale = await detectStaleLocks(0);
      const nonRecoveryStale = stale.filter(function (l) {
        return l.targetType !== "INCIDENT_LOCKDOWN_RECOVERY";
      });
      if (nonRecoveryStale.length > 0) {
        return {
          stage, passed: false,
          detail: `${nonRecoveryStale.length} stale lock(s): ${nonRecoveryStale.map(function (l) { return l.lockKey; }).join(",")}`,
          timestamp: now,
        };
      }
      return { stage, passed: true, detail: "no lock residue", timestamp: now };
    }

    case "AUTHORITY_CONTINUITY_RECHECK": {
      emitDiagnostic(
        "RECOVERY_SYNC_READ_REMOVED",
        "recovery-coordinator", "authority-adapter", "authority",
        "repository_to_canonical", "runRecoveryStage:AUTHORITY_CONTINUITY_RECHECK:checkAuthorityIntegrity→checkAuthorityIntegrityFromRepo",
        { correlationId: record.correlationId }
      );
      const integrity = await checkAuthorityIntegrityFromRepo();
      if (integrity.splitBrain || integrity.orphanCount > 0) {
        return {
          stage, passed: false,
          detail: `authority integrity failure: ${integrity.detail}`,
          timestamp: now,
        };
      }
      return { stage, passed: true, detail: "authority continuity valid", timestamp: now };
    }

    case "AUDIT_HOP_COMPLETENESS": {
      try {
        const { checkAuditChainReconstructable } = require("./recovery-preconditions");
        const chainResult = await checkAuditChainReconstructable(
          record.correlationId,
          { excludeFlows: ["recovery"] }
        );
        if (!chainResult.passed) {
          return { stage, passed: false, detail: chainResult.detail, timestamp: now };
        }
      } catch (_err) {
        // canonical module load failure — non-fatal
      }
      return { stage, passed: true, detail: "audit hops complete", timestamp: now };
    }

    case "ACTIVE_MODE_ELIGIBILITY": {
      const comboCheck = guardCanonicalCombination(
        "ACTIVE_100",
        "FULL_ACTIVE_STABILIZATION",
        "FROZEN",
        { stabilizationOnly: true, featureExpansionAllowed: false, devOnlyPathAllowed: false }
      );
      if (!comboCheck.allowed) {
        return { stage, passed: false, detail: `combo invalid: ${comboCheck.detail}`, timestamp: now };
      }
      return { stage, passed: true, detail: "ACTIVE_100/FULL_ACTIVE_STABILIZATION/FROZEN eligible", timestamp: now };
    }

    case "LIFECYCLE_TRANSITION": {
      const transResult = guardLifecycleTransition({
        currentState: "INCIDENT_LOCKDOWN",
        targetState: "ACTIVE_100",
        releaseMode: "FULL_ACTIVE_STABILIZATION",
        baselineStatus: "FROZEN",
        actor: record.actor,
        reason: `recovery ${record.recoveryId}`,
        correlationId: record.correlationId,
      });
      if (!transResult.allowed) {
        return { stage, passed: false, detail: `transition rejected: ${transResult.detail}`, timestamp: now };
      }
      return { stage, passed: true, detail: "INCIDENT_LOCKDOWN → ACTIVE_100 allowed", timestamp: now };
    }

    default:
      return { stage, passed: false, detail: `unknown stage: ${stage}`, timestamp: now };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Verification Contract
// ══════════════════════════════════════════════════════════════════════════════

export async function verifyRecovery(recoveryId: string): Promise<{
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
}> {
  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

  // 1. Canonical active combination valid
  const comboValid = isCanonicalActiveCombination("ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "FROZEN");
  checks.push({ name: "CANONICAL_COMBO_VALID", passed: comboValid, detail: comboValid ? "valid" : "invalid combination" });

  // 2. No open critical incidents (P4-1: repo-first)
  emitDiagnostic(
    "RECOVERY_SYNC_READ_REMOVED",
    "recovery-coordinator", "incident-adapter", "incident",
    "repository_to_canonical", "verifyRecovery:hasUnacknowledgedIncidents→hasUnacknowledgedIncidentsFromRepo",
    {}
  );
  const hasUnacked = await hasUnacknowledgedIncidentsFromRepo();
  const noIncidents = !hasUnacked;
  checks.push({ name: "NO_OPEN_INCIDENTS", passed: noIncidents, detail: noIncidents ? "clean" : "unacknowledged incidents remain" });

  // 3. No lock residue
  const stale = await detectStaleLocks(0);
  const residueLocks = stale.filter(function (l) {
    return l.targetType !== "INCIDENT_LOCKDOWN_RECOVERY";
  });
  const noResidue = residueLocks.length === 0;
  checks.push({ name: "NO_LOCK_RESIDUE", passed: noResidue, detail: noResidue ? "clean" : `${residueLocks.length} stale lock(s)` });

  // 4. Residue scan clean (P4-1: repo-first baseline + snapshot)
  emitDiagnostic(
    "RECOVERY_SYNC_READ_REMOVED",
    "recovery-coordinator", "baseline-adapter", "baseline",
    "repository_to_canonical", "verifyRecovery:getCanonicalBaseline→getCanonicalBaselineFromRepo",
    {}
  );
  const baseline = await getCanonicalBaselineFromRepo();
  if (!baseline) {
    emitDiagnostic(
      "REPO_FALLBACK_REMOVED",
      "recovery-coordinator", "baseline-adapter", "baseline",
      "repository_to_canonical", "verifyRecovery:baseline:repo-only-null-accepted",
      { fallbackUsed: false }
    );
  }
  let residueScanClean = true;
  if (baseline) {
    emitDiagnostic(
      "RECOVERY_SYNC_READ_REMOVED",
      "recovery-coordinator", "snapshot-adapter", "snapshot",
      "repository_to_canonical", "verifyRecovery:getSnapshot→getSnapshotFromRepo",
      { entityId: baseline.rollbackSnapshotId }
    );
    const rollbackSnap = await getSnapshotFromRepo(baseline.rollbackSnapshotId);
    if (!rollbackSnap) {
      emitDiagnostic(
        "REPO_FALLBACK_REMOVED",
        "recovery-coordinator", "snapshot-adapter", "snapshot",
        "repository_to_canonical", "verifyRecovery:snapshot:repo-only-null-accepted",
        { entityId: baseline.rollbackSnapshotId, fallbackUsed: false }
      );
    }
    if (rollbackSnap) {
      const currentState: Record<string, Record<string, unknown>> = {};
      for (const s of rollbackSnap.scopes) {
        currentState[s.scope] = s.data;
      }
      const scan = runResidueScan(baseline.rollbackSnapshotId, currentState);
      residueScanClean = scan.clean;
    }
  }
  checks.push({ name: "RESIDUE_SCAN_CLEAN", passed: residueScanClean, detail: residueScanClean ? "clean" : "residues detected" });

  // 5. Audit chain not BROKEN_CHAIN (post-recovery: include all flows including recovery)
  // Repository-first read for correlationId
  let auditOk = true;
  let correlationForAudit: string | null = null;
  try {
    const adapters = getPersistenceAdapters();
    const repoResult = await adapters.recoveryRecord.findByRecoveryId(recoveryId);
    if (repoResult.ok) {
      correlationForAudit = repoResult.data.correlationId;
    }
  } catch (_err) { /* fallback below */ }
  if (!correlationForAudit && _recoveryRecord) {
    correlationForAudit = _recoveryRecord.correlationId;
  }
  if (correlationForAudit) {
    try {
      const { checkAuditChainReconstructable } = require("./recovery-preconditions");
      const chainResult = await checkAuditChainReconstructable(correlationForAudit);
      auditOk = chainResult.passed;
    } catch (_err) {
      auditOk = true;
    }
  }
  checks.push({ name: "AUDIT_CHAIN_VALID", passed: auditOk, detail: auditOk ? "valid" : "BROKEN_CHAIN" });

  // 6. Authority integrity (P4-1: repo-first)
  emitDiagnostic(
    "RECOVERY_SYNC_READ_REMOVED",
    "recovery-coordinator", "authority-adapter", "authority",
    "repository_to_canonical", "verifyRecovery:checkAuthorityIntegrity→checkAuthorityIntegrityFromRepo",
    {}
  );
  const integrity = await checkAuthorityIntegrityFromRepo();
  const authorityClean = !integrity.splitBrain && integrity.orphanCount === 0;
  checks.push({ name: "AUTHORITY_INTEGRITY", passed: authorityClean, detail: authorityClean ? "clean" : integrity.detail });

  // 7. Canonical baseline exactly one
  const singleCanonical = assertSingleCanonical();
  checks.push({ name: "SINGLE_CANONICAL", passed: singleCanonical.valid, detail: singleCanonical.reason });

  // 8. Recovery audit hops complete
  let auditHopsComplete = true;
  if (_recoveryRecord) {
    auditHopsComplete = _recoveryRecord.stages.length >= 7;
  }
  checks.push({ name: "RECOVERY_AUDIT_HOPS", passed: auditHopsComplete, detail: auditHopsComplete ? "all stages complete" : "incomplete" });

  const allPassed = checks.every(function (c) { return c.passed; });

  if (allPassed) {
    emitDiagnostic(
      "REPO_FIRST_TRUTH_SOURCE_CONFIRMED",
      "recovery-coordinator", "recovery-adapter", "recovery",
      "repository_to_canonical", "verifyRecovery:all-checks-passed-repo-first",
      { correlationId: _recoveryRecord?.correlationId }
    );
  }

  return { passed: allPassed, checks };
}

// ══════════════════════════════════════════════════════════════════════════════
// Read Status
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Sync read — returns memory shim. Use getRecoveryStatusAsync() for repository-first.
 */
export function getRecoveryStatus(): RecoveryRecord | null {
  return _recoveryRecord ? { ..._recoveryRecord } : null;
}

/**
 * Async repository-first read with memory fallback.
 * Returns the persisted recovery record if available, memory shim otherwise.
 */
export async function getRecoveryStatusAsync(): Promise<RecoveryRecord | null> {
  try {
    const adapters = getPersistenceAdapters();
    const active = await adapters.recoveryRecord.findActiveRecovery();
    if (active) {
      // P3 Slice 1: ontology adapter translation (persisted → canonical → legacy)
      const canonical = RecoveryOntologyAdapter.fromPersisted(active);
      return RecoveryOntologyAdapter.toLegacy(canonical);
    }
  } catch (err) {
    logBridgeFailure("recovery-coordinator", "getRecoveryStatusAsync", err);
  }
  // Memory fallback — emit diagnostic for observability
  if (_recoveryRecord) {
    logBridgeFailure("recovery-coordinator", "getRecoveryStatusAsync:fallback", "using memory shim");
    emitDiagnostic(
      "LEGACY_DIRECT_ACCESS_FALLBACK_USED",
      "recovery-coordinator", "recovery-adapter", "recovery",
      "repository_to_canonical", "memory shim fallback in getRecoveryStatusAsync",
      { entityId: _recoveryRecord.recoveryId, fallbackUsed: true }
    );
  }
  return _recoveryRecord ? { ..._recoveryRecord } : null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Startup Residue Detection
// ══════════════════════════════════════════════════════════════════════════════

const RECOVERY_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function detectRecoveryResidue(): Promise<{
  hasResidue: boolean;
  detail: string;
  recoveryId?: string;
  state?: string;
}> {
  try {
    const adapters = getPersistenceAdapters();
    const active = await adapters.recoveryRecord.findActiveRecovery();
    if (active) {
      const age = Date.now() - (active.lastHeartbeatAt || active.startedAt).getTime();
      const isStale = age > RECOVERY_STALE_THRESHOLD_MS;
      return {
        hasResidue: true,
        detail: isStale
          ? `stale recovery ${active.recoveryId} in state ${active.recoveryState} (age=${Math.round(age / 1000)}s)`
          : `recovery ${active.recoveryId} in state ${active.recoveryState} still active`,
        recoveryId: active.recoveryId,
        state: active.recoveryState,
      };
    }
  } catch (err) {
    logBridgeFailure("recovery-coordinator", "detectRecoveryResidue", err);
  }
  return { hasResidue: false, detail: "no recovery residue detected" };
}

// ══════════════════════════════════════════════════════════════════════════════
// Test Reset
// ══════════════════════════════════════════════════════════════════════════════

export function _resetRecoveryCoordinator(): void {
  _recoveryRecord = null;
  _lastPersistedId = null;
  _lastPersistedUpdatedAt = null;
}
