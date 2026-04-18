// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass
/**
 * P2-2 Slice B — Lock Hygiene Startup/Cleanup Integration Tests
 *
 * 11 tests:
 * LB1:  startup scan includes lock hygiene summary
 * LB2:  recovery handoff includes cleanup recommendation
 * LB3:  operator cleanup executes only autoExecutable safe plan
 * LB4:  canonical baseline cleanup denied
 * LB5:  authority lock cleanup denied
 * LB6:  stale lock with active recovery not auto-cleanable
 * LB7:  cleanup revalidation failure blocks execution
 * LB8:  cleanup execution emits audit events
 * LB9:  safe release actually removes eligible lock
 * LB10: denied cleanup emits diagnostic
 * LB11: startup/recovery enriched decision deterministic
 *
 * Babel constraints: var + require(), no `import type`, no `as any`.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
var {
  _resetPersistenceBootstrap,
  bootstrapPersistence,
  getPersistenceAdapters,
} = require("../core/persistence/bootstrap");

var { _resetAdapterRegistry } = require("../core/persistence/factory");

var {
  createCanonicalBaseline,
  _resetBaselineRegistry,
} = require("../core/baseline/baseline-registry");

var {
  createSnapshotPair,
  _resetSnapshotStore,
} = require("../core/baseline/snapshot-manager");

var {
  createAuthorityLine,
  _resetAuthorityRegistry,
} = require("../core/authority/authority-registry");

var {
  escalateIncident,
  acknowledgeIncident,
  _resetIncidents,
} = require("../core/incidents/incident-escalation");

var {
  _resetAuditEvents,
  getAuditEvents,
} = require("../core/audit/audit-events");

var {
  requestRecovery,
  _resetRecoveryCoordinator,
} = require("../core/recovery/recovery-coordinator");

var {
  activateMutationFreeze,
  _resetMutationFreeze,
} = require("../core/containment/mutation-freeze");

var { acquireLock } = require("../core/persistence/lock-manager");

var {
  scanLockResidues,
  buildLockCleanupPlan,
  executeCleanup,
} = require("../core/persistence/lock-hygiene");

var {
  runStartupRecoveryScan,
} = require("../core/recovery/recovery-startup");

// ── Scope Data ──

var SCOPE_DATA = {
  CONFIG: { confidenceThreshold: 0.95, model: "gpt-4o" },
  FLAGS: { ENABLE_NEW_DOCTYPE_EXPANSION: false },
  ROUTING: { primaryQueue: "processing" },
  AUTHORITY: { owner: "ops-admin" },
  POLICY: { stabilizationOnly: true },
  QUEUE_TOPOLOGY: { intake: "active" },
};

// ── Setup ──

function resetAll() {
  _resetPersistenceBootstrap();
  _resetAdapterRegistry();
  _resetBaselineRegistry();
  _resetAuthorityRegistry();
  _resetIncidents();
  _resetSnapshotStore();
  _resetAuditEvents();
  _resetRecoveryCoordinator();
  _resetMutationFreeze();
  bootstrapPersistence({ mode: "MEMORY" });
}

function setupLockdownState() {
  var pair = createSnapshotPair({
    baselineId: "bl-cleanup-test",
    capturedBy: "test",
    scopeData: SCOPE_DATA,
  });

  var baseline = createCanonicalBaseline({
    documentType: "TEST",
    baselineVersion: "v1.0",
    activeSnapshotId: pair.active.snapshotId,
    rollbackSnapshotId: pair.rollback.snapshotId,
    activePathManifestId: "manifest-1",
    policySetVersion: "p1",
    routingRuleVersion: "r1",
    authorityRegistryVersion: "a1",
    freezeReason: "test freeze",
    performedBy: "tester",
  });

  createAuthorityLine("line-1", "auth-A", "bl-cleanup-test", "tester", "corr-setup");

  var incident = escalateIncident(
    "TEST_LOCKDOWN_REASON",
    "corr-lockdown",
    "system",
    "test lockdown trigger"
  );
  acknowledgeIncident(incident.incidentId);
  activateMutationFreeze();

  return { baseline: baseline, pair: pair, incident: incident };
}

function wait(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function injectLock(opts) {
  return acquireLock({
    lockKey: opts.lockKey,
    lockOwner: opts.lockOwner || "test-owner",
    targetType: opts.targetType || "SNAPSHOT_RESTORE",
    reason: opts.reason || "test lock",
    correlationId: opts.correlationId || "corr-test",
    ttlMs: 1,
  }).then(function () {
    return wait(10);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

describe("P2-2 Slice B: Lock Hygiene Startup/Cleanup Integration", function () {

  beforeEach(function () {
    resetAll();
  });

  // LB1: startup scan includes lock hygiene summary
  it("LB1: startup scan includes lock hygiene summary when locks present", function () {
    setupLockdownState();

    // Create recovery residue + expired lock
    var result = requestRecovery({
      actor: "ops-admin",
      reason: "hygiene test",
      correlationId: "corr-lb1",
      baselineId: "bl-cleanup-test",
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(result.success).toBe(true);

    return wait(50).then(function () {
      return injectLock({
        lockKey: "lock:snapshot-restore:bl-lb1",
        lockOwner: "old-process",
        targetType: "SNAPSHOT_RESTORE",
      });
    }).then(function () {
      return runStartupRecoveryScan();
    }).then(function (scan) {
      expect(scan.lockHygieneSummary).toBeTruthy();
      expect(scan.lockHygieneSummary).toHaveProperty("staleLockCount");
      expect(scan.lockHygieneSummary).toHaveProperty("operatorReviewRequired");
      expect(scan.lockHygieneSummary).toHaveProperty("safeReleaseCandidates");
      expect(scan.lockHygieneSummary).toHaveProperty("criticalResiduePresent");
      expect(scan.lockHygieneSummary.safeReleaseCandidates).toBeGreaterThanOrEqual(1);
    });
  });

  // LB2: recovery handoff includes cleanup recommendation
  it("LB2: recovery handoff includes lockCleanupRecommendation", function () {
    setupLockdownState();

    var result = requestRecovery({
      actor: "ops-admin",
      reason: "handoff test",
      correlationId: "corr-lb2",
      baselineId: "bl-cleanup-test",
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(result.success).toBe(true);

    return wait(50).then(function () {
      return injectLock({
        lockKey: "lock:snapshot-restore:bl-lb2",
        lockOwner: "old-process",
        targetType: "SNAPSHOT_RESTORE",
      });
    }).then(function () {
      return runStartupRecoveryScan();
    }).then(function (scan) {
      expect(scan.handoff).toBeTruthy();
      expect(scan.handoff.lockCleanupRecommendation).toBeTruthy();
      expect(["NO_ACTION", "SAFE_RELEASE_AND_RETRY", "OPERATOR_REVIEW_REQUIRED", "ESCALATE_INCIDENT"])
        .toContain(scan.handoff.lockCleanupRecommendation);
    });
  });

  // LB3: operator cleanup executes only autoExecutable safe plan
  it("LB3: operator cleanup executes for autoExecutable safe plan", function () {
    setupLockdownState();

    return injectLock({
      lockKey: "lock:snapshot-restore:bl-safe",
      lockOwner: "process-A",
      targetType: "SNAPSHOT_RESTORE",
    }).then(function () {
      return scanLockResidues();
    }).then(function (sweep) {
      var plan = buildLockCleanupPlan(sweep);
      var safeEntry = plan.entries.find(function (e) { return e.autoExecutable; });
      expect(safeEntry).toBeTruthy();

      return executeCleanup(plan, {
        planId: plan.planId,
        lockKey: safeEntry.lockKey,
        expectedHygieneState: safeEntry.hygieneState,
        operatorId: "ops-admin",
        approvalReason: "safe cleanup test",
      });
    }).then(function (result) {
      expect(result.executed).toBe(true);
      expect(result.reasonCode).toBe("CLEANUP_EXECUTED");
      expect(result.requiresEscalation).toBe(false);
    });
  });

  // LB4: canonical baseline cleanup denied
  it("LB4: canonical baseline lock cleanup is denied", function () {
    setupLockdownState();

    return injectLock({
      lockKey: "lock:canonical-baseline",
      lockOwner: "process-old",
      targetType: "CANONICAL_BASELINE",
    }).then(function () {
      return scanLockResidues();
    }).then(function (sweep) {
      var plan = buildLockCleanupPlan(sweep);
      var baselineEntry = plan.entries.find(function (e) {
        return e.lockKey === "lock:canonical-baseline";
      });
      expect(baselineEntry).toBeTruthy();
      expect(baselineEntry.autoExecutable).toBe(false);

      // Try to execute anyway
      return executeCleanup(plan, {
        planId: plan.planId,
        lockKey: "lock:canonical-baseline",
        expectedHygieneState: "LOCK_RESIDUE_REQUIRES_OPERATOR",
        operatorId: "ops-admin",
        approvalReason: "attempting canonical cleanup",
      });
    }).then(function (result) {
      expect(result.executed).toBe(false);
      expect(result.reasonCode).toBe("NOT_AUTO_EXECUTABLE");
    });
  });

  // LB5: authority lock cleanup denied
  it("LB5: authority lock cleanup is denied", function () {
    setupLockdownState();

    return injectLock({
      lockKey: "lock:authority-line:line-1",
      lockOwner: "process-old",
      targetType: "AUTHORITY_LINE",
    }).then(function () {
      return scanLockResidues();
    }).then(function (sweep) {
      var plan = buildLockCleanupPlan(sweep);

      return executeCleanup(plan, {
        planId: plan.planId,
        lockKey: "lock:authority-line:line-1",
        expectedHygieneState: "LOCK_RESIDUE_REQUIRES_OPERATOR",
        operatorId: "ops-admin",
        approvalReason: "attempting authority cleanup",
      });
    }).then(function (result) {
      expect(result.executed).toBe(false);
      expect(result.reasonCode).toBe("NOT_AUTO_EXECUTABLE");
    });
  });

  // LB6: stale lock with active recovery not auto-cleanable
  it("LB6: stale recovery lock with active recovery not auto-cleanable", function () {
    setupLockdownState();

    // Create active recovery
    var recoveryResult = requestRecovery({
      actor: "ops-admin",
      reason: "stale lock test",
      correlationId: "corr-lb6",
      baselineId: "bl-cleanup-test",
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(recoveryResult.success).toBe(true);

    return wait(50).then(function () {
      return injectLock({
        lockKey: "lock:recovery:" + recoveryResult.recoveryId,
        lockOwner: "old-process",
        targetType: "INCIDENT_LOCKDOWN_RECOVERY",
        correlationId: "corr-lb6",
      });
    }).then(function () {
      return scanLockResidues();
    }).then(function (sweep) {
      var plan = buildLockCleanupPlan(sweep);
      var recoveryEntry = plan.entries.find(function (e) {
        return e.lockKey.indexOf("lock:recovery:") === 0;
      });
      expect(recoveryEntry).toBeTruthy();
      expect(recoveryEntry.autoExecutable).toBe(false);
      expect(recoveryEntry.requiresOperator).toBe(true);
    });
  });

  // LB7: cleanup revalidation failure blocks execution
  it("LB7: cleanup revalidation blocks when state becomes stricter", function () {
    setupLockdownState();

    // First: create a safe recovery lock (no active recovery)
    return injectLock({
      lockKey: "lock:recovery:old-recovery-lb7",
      lockOwner: "process-old",
      targetType: "INCIDENT_LOCKDOWN_RECOVERY",
      correlationId: "corr-lb7",
    }).then(function () {
      return scanLockResidues();
    }).then(function (sweep) {
      var plan = buildLockCleanupPlan(sweep);
      var safeEntry = plan.entries.find(function (e) {
        return e.lockKey === "lock:recovery:old-recovery-lb7";
      });
      expect(safeEntry).toBeTruthy();
      expect(safeEntry.autoExecutable).toBe(true);

      // Now create an active recovery BEFORE executing cleanup
      var recoveryResult = requestRecovery({
        actor: "ops-admin",
        reason: "revalidation test",
        correlationId: "corr-lb7-new",
        baselineId: "bl-cleanup-test",
        lifecycleState: "INCIDENT_LOCKDOWN",
      });
      expect(recoveryResult.success).toBe(true);

      return wait(50).then(function () {
        // Execute cleanup — should fail because revalidation will find active recovery
        return executeCleanup(plan, {
          planId: plan.planId,
          lockKey: "lock:recovery:old-recovery-lb7",
          expectedHygieneState: "LOCK_RESIDUE_SAFE_TO_CLEAN",
          operatorId: "ops-admin",
          approvalReason: "revalidation test",
        });
      });
    }).then(function (result) {
      expect(result.executed).toBe(false);
      expect(result.reasonCode).toBe("REVALIDATION_STRICTER");
    });
  });

  // LB8: cleanup execution emits audit events
  it("LB8: cleanup execution emits audit events", function () {
    setupLockdownState();
    _resetAuditEvents();

    return injectLock({
      lockKey: "lock:snapshot-restore:bl-audit",
      lockOwner: "process-A",
      targetType: "SNAPSHOT_RESTORE",
    }).then(function () {
      _resetAuditEvents();
      return scanLockResidues();
    }).then(function (sweep) {
      _resetAuditEvents();
      var plan = buildLockCleanupPlan(sweep);
      _resetAuditEvents();

      return executeCleanup(plan, {
        planId: plan.planId,
        lockKey: "lock:snapshot-restore:bl-audit",
        expectedHygieneState: "EXPIRED_LEASE",
        operatorId: "ops-admin",
        approvalReason: "audit test",
      });
    }).then(function (result) {
      expect(result.executed).toBe(true);

      var events = getAuditEvents();
      var requestedEvents = events.filter(function (e) {
        return e.eventType === "LOCK_CLEANUP_EXECUTION_REQUESTED";
      });
      var executedEvents = events.filter(function (e) {
        return e.eventType === "LOCK_CLEANUP_EXECUTED";
      });
      expect(requestedEvents.length).toBeGreaterThanOrEqual(1);
      expect(executedEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // LB9: safe release actually removes eligible lock
  it("LB9: safe release force-expires the lock", function () {
    setupLockdownState();

    return injectLock({
      lockKey: "lock:snapshot-restore:bl-release",
      lockOwner: "process-A",
      targetType: "SNAPSHOT_RESTORE",
    }).then(function () {
      return scanLockResidues();
    }).then(function (sweep) {
      var plan = buildLockCleanupPlan(sweep);

      return executeCleanup(plan, {
        planId: plan.planId,
        lockKey: "lock:snapshot-restore:bl-release",
        expectedHygieneState: "EXPIRED_LEASE",
        operatorId: "ops-admin",
        approvalReason: "release test",
      });
    }).then(function (result) {
      expect(result.executed).toBe(true);

      // Verify lock is force-expired (expiresAt = epoch 0)
      var adapters = getPersistenceAdapters();
      return adapters.lock.findByKey("lock:snapshot-restore:bl-release");
    }).then(function (lock) {
      if (lock) {
        // If still present, expiresAt should be epoch 0
        expect(lock.expiresAt.getTime()).toBe(0);
      }
      // Lock might be auto-evicted — either way, it's cleaned
    });
  });

  // LB10: denied cleanup emits diagnostic
  it("LB10: denied cleanup emits LOCK_CLEANUP_DENIED event", function () {
    setupLockdownState();

    return injectLock({
      lockKey: "lock:canonical-baseline",
      lockOwner: "process-old",
      targetType: "CANONICAL_BASELINE",
    }).then(function () {
      return scanLockResidues();
    }).then(function (sweep) {
      var plan = buildLockCleanupPlan(sweep);
      _resetAuditEvents();

      return executeCleanup(plan, {
        planId: plan.planId,
        lockKey: "lock:canonical-baseline",
        expectedHygieneState: "LOCK_RESIDUE_REQUIRES_OPERATOR",
        operatorId: "ops-admin",
        approvalReason: "denied test",
      });
    }).then(function (result) {
      expect(result.executed).toBe(false);

      var events = getAuditEvents();
      var deniedEvents = events.filter(function (e) {
        return e.eventType === "LOCK_CLEANUP_DENIED";
      });
      expect(deniedEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // LB11: startup/recovery enriched decision deterministic
  it("LB11: startup enriched decision is deterministic", function () {
    setupLockdownState();

    var result = requestRecovery({
      actor: "ops-admin",
      reason: "deterministic test",
      correlationId: "corr-lb11",
      baselineId: "bl-cleanup-test",
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(result.success).toBe(true);

    return wait(50).then(function () {
      return injectLock({
        lockKey: "lock:snapshot-restore:bl-lb11",
        lockOwner: "old-process",
        targetType: "SNAPSHOT_RESTORE",
      });
    }).then(function () {
      // Run twice
      return Promise.all([
        runStartupRecoveryScan(),
        runStartupRecoveryScan(),
      ]);
    }).then(function (results) {
      var scan1 = results[0];
      var scan2 = results[1];

      expect(scan1.status).toBe(scan2.status);
      expect(scan1.handoff.lockCleanupRecommendation).toBe(scan2.handoff.lockCleanupRecommendation);

      if (scan1.lockHygieneSummary && scan2.lockHygieneSummary) {
        expect(scan1.lockHygieneSummary.staleLockCount).toBe(scan2.lockHygieneSummary.staleLockCount);
        expect(scan1.lockHygieneSummary.criticalResiduePresent).toBe(scan2.lockHygieneSummary.criticalResiduePresent);
      }
    });
  });
});
