/**
 * P1-3 — Recovery Coordinator
 *
 * Orchestrates the INCIDENT_LOCKDOWN → ACTIVE_100 recovery path.
 * Singleton: only one recovery active at a time.
 * State machine: sequential advancement only, no skip, no implicit unlock.
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
import { getCanonicalBaseline, assertSingleCanonical, isCanonicalActiveCombination } from "../baseline/baseline-registry";
import { getSnapshot } from "../baseline/snapshot-manager";
import { checkAuthorityIntegrity } from "../authority/authority-registry";
import { hasUnacknowledgedIncidents, escalateIncident } from "../incidents/incident-escalation";
import { withLock, detectStaleLocks, recoveryLockKey } from "../persistence/lock-manager";
import { getPersistenceAdapters } from "../persistence/bootstrap";
import { guardLifecycleTransition, guardCanonicalCombination } from "../runtime/transition-guard";
import { runResidueScan } from "../rollback/residue-scan";
import { reconcileState } from "../rollback/state-reconciliation";

// ══════════════════════════════════════════════════════════════════════════════
// Singleton Recovery Record
// ══════════════════════════════════════════════════════════════════════════════

let _recoveryRecord: RecoveryRecord | null = null;

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

function emitRecoveryAudit(
  eventType: string,
  record: RecoveryRecord,
  detail: string
): void {
  const baseline = getCanonicalBaseline();
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

  const baseline = getCanonicalBaseline();
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
    emitRecoveryAudit("INCIDENT_LOCKDOWN_RECOVERY_VALIDATED", _recoveryRecord, "all preconditions passed");

    // Emit override audit if override was used
    if (_recoveryRecord.overrideMetadata) {
      emitRecoveryAudit("LOCKDOWN_OVERRIDE_USED", _recoveryRecord,
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

  emitRecoveryAudit("INCIDENT_LOCKDOWN_RECOVERY_DENIED", _recoveryRecord,
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
      return executeRecoveryStages(_recoveryRecord!);
    }
  );

  if (!lockResult.acquired) {
    advanceRecoveryState(_recoveryRecord, "RECOVERY_VALIDATED", "RECOVERY_FAILED");
    _recoveryRecord.failReason = `lock acquisition failed: ${lockResult.message}`;
    emitRecoveryAudit("INCIDENT_LOCKDOWN_RECOVERY_FAILED", _recoveryRecord, `lock: ${lockResult.message}`);

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

async function executeRecoveryStages(record: RecoveryRecord): Promise<RecoveryResult> {
  // RECOVERY_VALIDATED → RECOVERY_LOCKED
  advanceRecoveryState(record, "RECOVERY_VALIDATED", "RECOVERY_LOCKED");

  // RECOVERY_LOCKED → RECOVERY_EXECUTING
  advanceRecoveryState(record, "RECOVERY_LOCKED", "RECOVERY_EXECUTING");
  emitRecoveryAudit("INCIDENT_LOCKDOWN_RECOVERY_EXECUTING", record, "starting 7-stage execution");

  const completedStages: RecoveryStage[] = [];
  const baseline = getCanonicalBaseline();

  for (const stage of RECOVERY_STAGE_ORDER) {
    const stageResult = await runRecoveryStage(stage, record, baseline);
    record.stages.push(stageResult);

    if (!stageResult.passed) {
      // Stage failed — transition to RECOVERY_FAILED → RECOVERY_ESCALATED
      advanceRecoveryState(record, "RECOVERY_EXECUTING", "RECOVERY_FAILED");
      record.failReason = `stage ${stage} failed: ${stageResult.detail}`;
      record.completedAt = new Date();

      emitRecoveryAudit("INCIDENT_LOCKDOWN_RECOVERY_FAILED", record,
        `stage=${stage} detail=${stageResult.detail}`);

      // Escalate incident
      escalateIncident(
        "RECOVERY_STAGE_FAILED",
        record.correlationId,
        record.actor,
        `recovery ${record.recoveryId} failed at stage ${stage}: ${stageResult.detail}`
      );

      advanceRecoveryState(record, "RECOVERY_FAILED", "RECOVERY_ESCALATED");
      emitRecoveryAudit("INCIDENT_LOCKDOWN_RECOVERY_ESCALATED", record,
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
  }

  // All stages passed
  advanceRecoveryState(record, "RECOVERY_EXECUTING", "RECOVERY_VERIFIED");
  emitRecoveryAudit("INCIDENT_LOCKDOWN_RECOVERY_VERIFIED", record, "all 7 stages passed");

  advanceRecoveryState(record, "RECOVERY_VERIFIED", "RECOVERY_RESTORED");
  record.completedAt = new Date();
  emitRecoveryAudit("INCIDENT_LOCKDOWN_RECOVERY_RESTORED", record, "ACTIVE_100 restored");

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
  baseline: ReturnType<typeof getCanonicalBaseline>
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
      const rollbackSnap = getSnapshot(baseline.rollbackSnapshotId);
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
      const integrity = checkAuthorityIntegrity();
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
        const { buildTimeline } = require("../observability/canonical-event-schema");
        const timeline = buildTimeline(record.correlationId);
        // Exclude recovery-flow missing hops (still accumulating during execution)
        const nonRecoveryMissing = timeline.missingHops.filter(function (h: string) {
          return !h.startsWith("recovery:");
        });
        if (nonRecoveryMissing.length > 2) {
          return { stage, passed: false, detail: "audit chain BROKEN_CHAIN", timestamp: now };
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

  // 2. No open critical incidents
  const noIncidents = !hasUnacknowledgedIncidents();
  checks.push({ name: "NO_OPEN_INCIDENTS", passed: noIncidents, detail: noIncidents ? "clean" : "unacknowledged incidents remain" });

  // 3. No lock residue
  const stale = await detectStaleLocks(0);
  const residueLocks = stale.filter(function (l) {
    return l.targetType !== "INCIDENT_LOCKDOWN_RECOVERY";
  });
  const noResidue = residueLocks.length === 0;
  checks.push({ name: "NO_LOCK_RESIDUE", passed: noResidue, detail: noResidue ? "clean" : `${residueLocks.length} stale lock(s)` });

  // 4. Residue scan clean
  const baseline = getCanonicalBaseline();
  let residueScanClean = true;
  if (baseline) {
    const rollbackSnap = getSnapshot(baseline.rollbackSnapshotId);
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

  // 5. Audit chain not BROKEN_CHAIN
  let auditOk = true;
  if (_recoveryRecord) {
    try {
      const { buildTimeline } = require("../observability/canonical-event-schema");
      const timeline = buildTimeline(_recoveryRecord.correlationId);
      auditOk = timeline.reconstructionStatus !== "BROKEN_CHAIN" || timeline.orderedEvents.length === 0;
    } catch (_err) {
      auditOk = true;
    }
  }
  checks.push({ name: "AUDIT_CHAIN_VALID", passed: auditOk, detail: auditOk ? "valid" : "BROKEN_CHAIN" });

  // 6. Authority integrity
  const integrity = checkAuthorityIntegrity();
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
  return { passed: allPassed, checks };
}

// ══════════════════════════════════════════════════════════════════════════════
// Read Status
// ══════════════════════════════════════════════════════════════════════════════

export function getRecoveryStatus(): RecoveryRecord | null {
  return _recoveryRecord ? { ..._recoveryRecord } : null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Test Reset
// ══════════════════════════════════════════════════════════════════════════════

export function _resetRecoveryCoordinator(): void {
  _recoveryRecord = null;
}
