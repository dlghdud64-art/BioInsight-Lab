// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass
/**
 * P2-2 Slice A — Lock Hygiene / Sweeper Contract Tests
 *
 * 10 tests:
 * LA1:  expired lock classified as EXPIRED_LEASE
 * LA2:  expired lock with non-terminal recovery → STALE_LOCK
 * LA3:  owner/token mismatch → ORPHANED_LOCK
 * LA4:  terminal linked state → SAFE_RELEASE plan
 * LA5:  canonical baseline lock never auto-releases
 * LA6:  authority/recovery lock requires operator
 * LA7:  cleanup plan marks autoExecutable only for safe cases
 * LA8:  startup continuity can consume sweeper diagnostics
 * LA9:  lock hygiene audit events emitted
 * LA10: mixed lock set produces deterministic scan results
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
  evaluateLockResidue,
  buildLockCleanupPlan,
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
    baselineId: "bl-lock-test",
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

  createAuthorityLine("line-1", "auth-A", "bl-lock-test", "tester", "corr-setup");

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

/**
 * Inject a lock directly into the memory store with specific properties.
 * Useful for testing orphaned locks, specific target types, etc.
 */
function injectLock(opts) {
  var adapters = getPersistenceAdapters();
  // Access internal _store via acquire then manipulate
  // Instead, acquire normally then force-expire for stale locks
  return acquireLock({
    lockKey: opts.lockKey,
    lockOwner: opts.lockOwner || "test-owner",
    targetType: opts.targetType || "SNAPSHOT_RESTORE",
    reason: opts.reason || "test lock",
    correlationId: opts.correlationId || "corr-test",
    ttlMs: 1, // expire immediately
  }).then(function () {
    return wait(10); // ensure expired
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

describe("P2-2 Slice A: Lock Hygiene / Sweeper Contract", function () {

  beforeEach(function () {
    resetAll();
  });

  // LA1: expired lock classified as EXPIRED_LEASE
  it("LA1: expired lock classified as EXPIRED_LEASE", function () {
    setupLockdownState();

    return injectLock({
      lockKey: "lock:snapshot-restore:bl-test-1",
      lockOwner: "process-A",
      targetType: "SNAPSHOT_RESTORE",
    }).then(function () {
      return scanLockResidues();
    }).then(function (result) {
      expect(result.entries.length).toBeGreaterThanOrEqual(1);
      var snapshotEntry = result.entries.find(function (e) {
        return e.lockKey === "lock:snapshot-restore:bl-test-1";
      });
      expect(snapshotEntry).toBeTruthy();
      expect(snapshotEntry.hygieneState).toBe("EXPIRED_LEASE");
      expect(snapshotEntry.recommendedAction).toBe("SAFE_RELEASE");
    });
  });

  // LA2: expired lock with non-terminal recovery → STALE_LOCK
  it("LA2: expired lock with non-terminal recovery becomes STALE_LOCK", function () {
    setupLockdownState();

    // Create active recovery (non-terminal)
    var recoveryResult = requestRecovery({
      actor: "ops-admin",
      reason: "stale lock test",
      correlationId: "corr-la2",
      baselineId: "bl-lock-test",
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(recoveryResult.success).toBe(true);

    return wait(50).then(function () {
      return injectLock({
        lockKey: "lock:recovery:" + recoveryResult.recoveryId,
        lockOwner: "old-process",
        targetType: "INCIDENT_LOCKDOWN_RECOVERY",
        correlationId: "corr-la2",
      });
    }).then(function () {
      return scanLockResidues();
    }).then(function (result) {
      var recoveryEntry = result.entries.find(function (e) {
        return e.lockTarget === "INCIDENT_LOCKDOWN_RECOVERY";
      });
      expect(recoveryEntry).toBeTruthy();
      expect(recoveryEntry.hygieneState).toBe("STALE_LOCK");
      expect(recoveryEntry.reasonCode).toBe("EXPIRED_WITH_ACTIVE_RECOVERY");
      expect(recoveryEntry.requiresOperator).toBe(true);
    });
  });

  // LA3: owner/token mismatch → ORPHANED_LOCK
  it("LA3: missing owner produces ORPHANED_LOCK", function () {
    setupLockdownState();

    // Inject lock with empty owner by manipulating adapter store directly
    return injectLock({
      lockKey: "lock:orphan-test",
      lockOwner: "temp-owner",
      targetType: "SNAPSHOT_RESTORE",
    }).then(function () {
      // Directly manipulate the memory store to clear owner
      var adapters = getPersistenceAdapters();
      return adapters.lock.findByKey("lock:orphan-test").then(function (lock) {
        // We need to manipulate internal state — acquire with empty-ish owner
        // Instead, use evaluateLockResidue directly with a crafted lock object
        var orphanedLock = {
          id: "lock-orphan-1",
          lockKey: "lock:orphan-direct",
          lockOwner: "",
          lockToken: "",
          targetType: "SNAPSHOT_RESTORE",
          reason: "orphan test",
          correlationId: "corr-orphan",
          acquiredAt: new Date(Date.now() - 60000),
          expiresAt: new Date(Date.now() - 30000), // expired
        };

        var entry = evaluateLockResidue(
          orphanedLock,
          { hasActiveRecovery: false, activeRecoveryId: null, hasUnackedIncidents: false },
          "scan-test",
          new Date()
        );

        expect(entry.hygieneState).toBe("ORPHANED_LOCK");
        expect(entry.reasonCode).toBe("OWNER_TOKEN_MISSING");
        expect(entry.requiresOperator).toBe(true);
        expect(entry.diagnosticSeverity).toBe("ERROR");
      });
    });
  });

  // LA4: terminal linked state → SAFE_RELEASE plan
  it("LA4: expired recovery lock with no active recovery produces SAFE_RELEASE plan", function () {
    setupLockdownState();
    // No active recovery — all terminal

    return injectLock({
      lockKey: "lock:recovery:old-recovery",
      lockOwner: "old-process",
      targetType: "INCIDENT_LOCKDOWN_RECOVERY",
      correlationId: "corr-la4",
    }).then(function () {
      return scanLockResidues();
    }).then(function (result) {
      var plan = buildLockCleanupPlan(result);
      var recoveryPlan = plan.entries.find(function (e) {
        return e.lockKey === "lock:recovery:old-recovery";
      });
      expect(recoveryPlan).toBeTruthy();
      expect(recoveryPlan.autoExecutable).toBe(true);
      expect(recoveryPlan.requiresOperator).toBe(false);
      expect(recoveryPlan.riskLevel).toBe("LOW");
    });
  });

  // LA5: canonical baseline lock never auto-releases
  it("LA5: canonical baseline lock never auto-releases", function () {
    setupLockdownState();

    return injectLock({
      lockKey: "lock:canonical-baseline",
      lockOwner: "process-old",
      targetType: "CANONICAL_BASELINE",
    }).then(function () {
      return scanLockResidues();
    }).then(function (result) {
      var baselineEntry = result.entries.find(function (e) {
        return e.lockTarget === "CANONICAL_BASELINE";
      });
      expect(baselineEntry).toBeTruthy();
      expect(baselineEntry.hygieneState).toBe("LOCK_RESIDUE_REQUIRES_OPERATOR");
      expect(baselineEntry.requiresOperator).toBe(true);
      expect(baselineEntry.diagnosticSeverity).toBe("CRITICAL");

      var plan = buildLockCleanupPlan(result);
      var baselinePlan = plan.entries.find(function (e) {
        return e.lockKey === "lock:canonical-baseline";
      });
      expect(baselinePlan).toBeTruthy();
      expect(baselinePlan.autoExecutable).toBe(false);
      expect(baselinePlan.requiresOperator).toBe(true);
      expect(baselinePlan.riskLevel).toBe("CRITICAL");
    });
  });

  // LA6: authority lock requires operator review
  it("LA6: authority lock requires operator review", function () {
    setupLockdownState();

    return injectLock({
      lockKey: "lock:authority-line:line-1",
      lockOwner: "process-old",
      targetType: "AUTHORITY_LINE",
    }).then(function () {
      return scanLockResidues();
    }).then(function (result) {
      var authorityEntry = result.entries.find(function (e) {
        return e.lockTarget === "AUTHORITY_LINE";
      });
      expect(authorityEntry).toBeTruthy();
      expect(authorityEntry.hygieneState).toBe("LOCK_RESIDUE_REQUIRES_OPERATOR");
      expect(authorityEntry.recommendedAction).toBe("OPERATOR_REVIEW");
      expect(authorityEntry.requiresOperator).toBe(true);
    });
  });

  // LA7: cleanup plan marks autoExecutable only for safe cases
  it("LA7: cleanup plan autoExecutable only for safe cases", function () {
    setupLockdownState();

    // Inject mixed locks
    return Promise.all([
      injectLock({
        lockKey: "lock:snapshot-restore:bl-safe",
        lockOwner: "process-A",
        targetType: "SNAPSHOT_RESTORE",
      }),
      injectLock({
        lockKey: "lock:canonical-baseline",
        lockOwner: "process-B",
        targetType: "CANONICAL_BASELINE",
      }),
      injectLock({
        lockKey: "lock:recovery:old-recovery-2",
        lockOwner: "process-C",
        targetType: "INCIDENT_LOCKDOWN_RECOVERY",
      }),
    ]).then(function () {
      return scanLockResidues();
    }).then(function (result) {
      var plan = buildLockCleanupPlan(result);

      // Verify: only safe entries are autoExecutable
      plan.entries.forEach(function (entry) {
        if (entry.autoExecutable) {
          // Must be safe to clean or expired lease with SAFE_RELEASE
          expect(["LOCK_RESIDUE_SAFE_TO_CLEAN", "EXPIRED_LEASE"]).toContain(entry.hygieneState);
          expect(entry.requiresOperator).toBe(false);
        }
        if (entry.hygieneState === "LOCK_RESIDUE_REQUIRES_OPERATOR") {
          expect(entry.autoExecutable).toBe(false);
          expect(entry.requiresOperator).toBe(true);
        }
      });

      // canonical baseline must NOT be autoExecutable
      var baselinePlan = plan.entries.find(function (e) {
        return e.lockKey === "lock:canonical-baseline";
      });
      expect(baselinePlan).toBeTruthy();
      expect(baselinePlan.autoExecutable).toBe(false);
    });
  });

  // LA8: startup continuity can consume sweeper diagnostics
  it("LA8: startup can reference sweeper scan results", function () {
    setupLockdownState();

    // Create a recovery + stale recovery lock
    var recoveryResult = requestRecovery({
      actor: "ops-admin",
      reason: "startup integration test",
      correlationId: "corr-la8",
      baselineId: "bl-lock-test",
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(recoveryResult.success).toBe(true);

    return wait(50).then(function () {
      return injectLock({
        lockKey: "lock:recovery:" + recoveryResult.recoveryId,
        lockOwner: "old-process",
        targetType: "INCIDENT_LOCKDOWN_RECOVERY",
        correlationId: "corr-la8",
      });
    }).then(function () {
      // Run both scans
      return Promise.all([
        runStartupRecoveryScan(),
        scanLockResidues(),
      ]);
    }).then(function (results) {
      var startupResult = results[0];
      var sweepResult = results[1];

      // Both detect issues
      expect(startupResult.status).not.toBe("CLEAN_START");
      expect(sweepResult.entries.length).toBeGreaterThan(0);

      // Sweeper can enrich startup handoff — verify sweep has recovery lock entry
      var recoveryLockEntry = sweepResult.entries.find(function (e) {
        return e.lockTarget === "INCIDENT_LOCKDOWN_RECOVERY";
      });
      expect(recoveryLockEntry).toBeTruthy();

      // Startup handoff exists
      expect(startupResult.handoff).toBeTruthy();
      expect(startupResult.handoff.recoveryId).toBe(recoveryResult.recoveryId);
    });
  });

  // LA9: lock hygiene audit events emitted
  it("LA9: lock hygiene audit events are emitted", function () {
    setupLockdownState();
    _resetAuditEvents();

    return injectLock({
      lockKey: "lock:snapshot-restore:bl-events",
      lockOwner: "process-A",
      targetType: "SNAPSHOT_RESTORE",
    }).then(function () {
      _resetAuditEvents(); // Clear injection events
      return scanLockResidues();
    }).then(function (result) {
      expect(result.diagnosticEvents).toContain("LOCK_SWEEP_SCAN_COMPLETED");
      expect(result.diagnosticEvents).toContain("LOCK_RESIDUE_CLASSIFIED");

      // Verify audit store
      var events = getAuditEvents();
      var sweepEvents = events.filter(function (e) {
        return e.eventType === "LOCK_SWEEP_SCAN_COMPLETED" ||
          e.eventType === "LOCK_RESIDUE_CLASSIFIED" ||
          e.eventType === "LOCK_SAFE_RELEASE_RECOMMENDED";
      });
      expect(sweepEvents.length).toBeGreaterThanOrEqual(2);
    });
  });

  // LA10: mixed lock set produces deterministic scan results
  it("LA10: mixed lock set produces deterministic scan", function () {
    setupLockdownState();

    // Inject 3 different lock types
    return Promise.all([
      injectLock({
        lockKey: "lock:z-snapshot",
        lockOwner: "p1",
        targetType: "SNAPSHOT_RESTORE",
      }),
      injectLock({
        lockKey: "lock:a-authority",
        lockOwner: "p2",
        targetType: "AUTHORITY_LINE",
      }),
      injectLock({
        lockKey: "lock:m-recovery",
        lockOwner: "p3",
        targetType: "INCIDENT_LOCKDOWN_RECOVERY",
      }),
    ]).then(function () {
      return scanLockResidues();
    }).then(function (result) {
      expect(result.entries.length).toBeGreaterThanOrEqual(3);

      // Verify sorted by lockKey
      for (var i = 1; i < result.entries.length; i++) {
        expect(result.entries[i].lockKey >= result.entries[i - 1].lockKey).toBe(true);
      }

      // Verify summary counts
      expect(result.summary.total).toBeGreaterThanOrEqual(3);

      // Verify each has correct classification
      var authorityEntry = result.entries.find(function (e) { return e.lockKey === "lock:a-authority"; });
      var recoveryEntry = result.entries.find(function (e) { return e.lockKey === "lock:m-recovery"; });
      var snapshotEntry = result.entries.find(function (e) { return e.lockKey === "lock:z-snapshot"; });

      expect(authorityEntry.hygieneState).toBe("LOCK_RESIDUE_REQUIRES_OPERATOR");
      expect(recoveryEntry.hygieneState).toBe("LOCK_RESIDUE_SAFE_TO_CLEAN"); // no active recovery
      expect(snapshotEntry.hygieneState).toBe("EXPIRED_LEASE");
    });
  });
});
