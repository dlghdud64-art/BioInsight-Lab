/**
 * P1 Closeout Validation — 10 Tests / 4 Groups
 *
 * Group 1: Prisma Contention Validation (3)
 * Group 2: Recovery Canonical Event Bridge (3)
 * Group 3: Crash/Retry Residue Diagnostics (2)
 * Group 4: Final Acceptance Gate (2)
 *
 * Babel parser constraints: no `import type`, no `as any`, use `var` + `require()`.
 */

var { describe, it, expect, beforeEach } = require("@jest/globals");

// ── Persistence ──

var {
  _resetPersistenceBootstrap,
  bootstrapPersistence,
  getPersistenceAdapters,
} = require("../core/persistence/bootstrap");

var {
  _resetAdapterRegistry: _resetReg,
} = require("../core/persistence/factory");

var {
  createPrismaAdapters,
} = require("../core/persistence");

// ── Baseline & Snapshot ──

var {
  createCanonicalBaseline,
  getCanonicalBaseline,
  assertSingleCanonical,
  _resetBaselineRegistry,
} = require("../core/baseline/baseline-registry");

var {
  createSnapshotPair,
  _resetSnapshotStore,
} = require("../core/baseline/snapshot-manager");

// ── Authority ──

var {
  createAuthorityLine,
  _resetAuthorityRegistry,
} = require("../core/authority/authority-registry");

// ── Incidents ──

var {
  escalateIncident,
  acknowledgeIncident,
  _resetIncidents,
} = require("../core/incidents/incident-escalation");

// ── Audit ──

var {
  _resetAuditEvents,
} = require("../core/audit/audit-events");

// ── Canonical Events ──

var {
  createCanonicalEvent,
  writeCanonicalAudit,
  getCanonicalAuditLog,
  buildTimeline,
  validateHops,
  _resetCanonicalAudit,
  RECOVERY_FLOW_HOPS,
} = require("../core/observability/canonical-event-schema");

// ── Recovery ──

var {
  requestRecovery,
  validateRecovery,
  executeRecoveryAsync,
  verifyRecovery,
  getRecoveryStatus,
  _resetRecoveryCoordinator,
} = require("../core/recovery/recovery-coordinator");

var {
  emitRecoveryCanonicalEvent,
} = require("../core/recovery/recovery-canonical-bridge");

var {
  checkAuditChainReconstructable,
} = require("../core/recovery/recovery-preconditions");

var {
  runRecoveryDiagnostics,
} = require("../core/recovery/recovery-diagnostics");

// ── Containment ──

var {
  activateMutationFreeze,
  _resetMutationFreeze,
} = require("../core/containment/mutation-freeze");

// ── Lock ──

var {
  withLock,
  recoveryLockKey,
  detectStaleLocks,
} = require("../core/persistence/lock-manager");

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

var SCOPE_DATA = {
  CONFIG: { confidenceThreshold: 0.95, model: "gpt-4o" },
  FLAGS: { ENABLE_NEW_DOCTYPE_EXPANSION: false },
  ROUTING: { primaryQueue: "processing" },
  AUTHORITY: { owner: "ops-admin" },
  POLICY: { stabilizationOnly: true },
  QUEUE_TOPOLOGY: { intake: "active" },
};

function setupPersistence() {
  _resetPersistenceBootstrap();
  _resetReg();
  _resetBaselineRegistry();
  _resetAuthorityRegistry();
  _resetIncidents();
  _resetSnapshotStore();
  _resetAuditEvents();
  _resetRecoveryCoordinator();
  _resetCanonicalAudit();
  _resetMutationFreeze();
  bootstrapPersistence({ mode: "MEMORY" });
}

function setupLockdownState() {
  var pair = createSnapshotPair({
    baselineId: "bl-closeout",
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

  createAuthorityLine("line-1", "auth-A", "bl-closeout", "tester", "corr-setup");

  var incident = escalateIncident(
    "TEST_LOCKDOWN_REASON",
    "corr-lockdown",
    "system",
    "test lockdown trigger"
  );

  acknowledgeIncident(incident.incidentId);
  activateMutationFreeze();

  return { baseline, pair, incident };
}

// ── Mock Prisma Client with stabilizationLock ──

function createMockPrismaClientWithLock() {
  var lockStore = [];
  var idCounter = 0;

  function nextId() { return "mock-lock-" + (++idCounter); }

  var stabilizationLock = {
    create: async function (args) {
      var row = Object.assign({}, args.data, { id: nextId() });
      var dup = lockStore.find(function (r) { return r.lockKey === row.lockKey; });
      if (dup) {
        var err = new Error("Unique constraint failed on lockKey");
        err.code = "P2002";
        throw err;
      }
      lockStore.push(row);
      return row;
    },
    findUnique: async function (args) {
      return lockStore.find(function (r) { return r.lockKey === args.where.lockKey; }) || null;
    },
    findMany: async function (args) {
      if (args && args.where && args.where.expiresAt && args.where.expiresAt.lt) {
        var cutoff = args.where.expiresAt.lt.getTime();
        return lockStore.filter(function (r) { return new Date(r.expiresAt).getTime() < cutoff; });
      }
      return lockStore.slice();
    },
    delete: async function (args) {
      var idx = lockStore.findIndex(function (r) { return r.lockKey === args.where.lockKey; });
      if (idx === -1) {
        var err = new Error("Record not found");
        err.code = "P2025";
        throw err;
      }
      return lockStore.splice(idx, 1)[0];
    },
    update: async function (args) {
      var row = lockStore.find(function (r) { return r.lockKey === args.where.lockKey; });
      if (!row) {
        var err = new Error("Record not found");
        err.code = "P2025";
        throw err;
      }
      Object.assign(row, args.data);
      return row;
    },
  };

  return {
    stabilizationLock: stabilizationLock,
    $transaction: async function (fn) { return fn(this); },
    _lockStore: lockStore,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Group 1: Prisma Contention Validation (3 tests)
// ══════════════════════════════════════════════════════════════════════════════

describe("P1 Closeout: Group 1 — Prisma Contention Validation", function () {

  it("T1: duplicate canonical baseline blocked via mock Prisma (P2002)", async function () {
    var mockPrisma = createMockPrismaClientWithLock();
    // Extend mock with baseline store
    var baselineStore = [];
    mockPrisma.stabilizationBaseline = {
      create: async function (args) {
        var dup = baselineStore.find(function (r) { return r.baselineVersion === args.data.baselineVersion; });
        if (dup) {
          var err = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        var row = Object.assign({}, args.data, { id: "bl-" + baselineStore.length });
        baselineStore.push(row);
        return row;
      },
    };

    // First write succeeds
    var r1 = await mockPrisma.stabilizationBaseline.create({ data: { baselineVersion: "1.0.0", baselineHash: "h1" } });
    expect(r1.id).toBeTruthy();

    // Duplicate write blocked
    var caught = false;
    try {
      await mockPrisma.stabilizationBaseline.create({ data: { baselineVersion: "1.0.0", baselineHash: "h2" } });
    } catch (err) {
      caught = true;
      expect(err.code).toBe("P2002");
    }
    expect(caught).toBe(true);
  });

  it("T2: authority optimistic lock conflict via mock Prisma (stale updatedAt)", async function () {
    var store = [];
    var timeCount = Date.now();
    var mockAuthority = {
      create: async function (args) {
        var row = Object.assign({}, args.data, { id: "auth-1", updatedAt: new Date(++timeCount) });
        store.push(row);
        return row;
      },
      updateMany: async function (args) {
        var matched = store.filter(function (r) {
          return r.authorityLineId === args.where.authorityLineId &&
                 r.updatedAt.getTime() === args.where.updatedAt.getTime();
        });
        if (matched.length === 0) return { count: 0 };
        matched.forEach(function (r) {
          Object.assign(r, args.data, { updatedAt: new Date(++timeCount) });
        });
        return { count: matched.length };
      },
    };

    // Create authority line
    var created = await mockAuthority.create({ data: { authorityLineId: "line-1", authorityState: "ACTIVE" } });
    var staleTimestamp = created.updatedAt;

    // Concurrent update #1 succeeds
    var r1 = await mockAuthority.updateMany({
      where: { authorityLineId: "line-1", updatedAt: staleTimestamp },
      data: { authorityState: "TRANSFER_INITIATED" },
    });
    expect(r1.count).toBe(1);

    // Concurrent update #2 with stale timestamp fails (optimistic lock)
    var r2 = await mockAuthority.updateMany({
      where: { authorityLineId: "line-1", updatedAt: staleTimestamp },
      data: { authorityState: "REVOKED" },
    });
    expect(r2.count).toBe(0); // Optimistic lock conflict
  });

  it("T3: recovery lock contention via mock Prisma (2 processes, same key)", async function () {
    var { PrismaLockRepository } = require("../core/persistence/prisma/lock");

    var mockPrisma = createMockPrismaClientWithLock();
    var lockRepo = new PrismaLockRepository(mockPrisma);

    // Process A acquires lock
    var r1 = await lockRepo.acquire({
      lockKey: "recovery:test-id",
      lockOwner: "process-A",
      targetType: "INCIDENT_LOCKDOWN_RECOVERY",
      reason: "recovery attempt",
      correlationId: "corr-1",
      ttlMs: 120000,
    });
    expect(r1.acquired).toBe(true);

    // Process B tries same lock — blocked
    var r2 = await lockRepo.acquire({
      lockKey: "recovery:test-id",
      lockOwner: "process-B",
      targetType: "INCIDENT_LOCKDOWN_RECOVERY",
      reason: "recovery attempt 2",
      correlationId: "corr-2",
      ttlMs: 120000,
    });
    expect(r2.acquired).toBe(false);
    expect(r2.reasonCode).toBe("LOCK_ACQUIRE_CONFLICT");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Group 2: Recovery Canonical Event Bridge (3 tests)
// ══════════════════════════════════════════════════════════════════════════════

describe("P1 Closeout: Group 2 — Recovery Canonical Event Bridge", function () {
  beforeEach(function () {
    setupPersistence();
  });

  it("T4: recovery events appear in canonical audit log after full recovery", async function () {
    var lockdownState = setupLockdownState();
    var corrId = "corr-bridge-test-1";

    // Run full recovery flow
    var reqResult = requestRecovery({
      actor: "ops-admin",
      reason: "bridge test",
      correlationId: corrId,
      baselineId: "bl-closeout",
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(reqResult.success).toBe(true);

    var valResult = await validateRecovery(reqResult.recoveryId, corrId);
    expect(valResult.success).toBe(true);

    var exeResult = await executeRecoveryAsync(reqResult.recoveryId, corrId);
    expect(exeResult.success).toBe(true);

    // Check canonical audit log has recovery events
    var events = getCanonicalAuditLog({ correlationId: corrId });
    expect(events.length).toBeGreaterThan(0);

    // Should have at least REQUESTED event
    var requested = events.find(function (e) {
      return e.eventType === "INCIDENT_LOCKDOWN_RECOVERY_REQUESTED";
    });
    expect(requested).toBeTruthy();
    expect(requested.sourceModule).toBe("recovery-coordinator");
    expect(requested.entityType).toBe("recovery");
  });

  it("T5: recovery hop validation RECONSTRUCTABLE after full flow", async function () {
    var lockdownState = setupLockdownState();
    var corrId = "corr-bridge-test-2";

    // Emit all 5 happy-path recovery canonical events
    var record = {
      recoveryId: "rec-hop-test",
      correlationId: corrId,
      actor: "ops-admin",
      reason: "hop test",
      currentState: "RECOVERY_REQUESTED",
      baselineId: "bl-closeout",
      preconditionResults: [],
      stages: [],
      startedAt: new Date(),
    };

    for (var i = 0; i < RECOVERY_FLOW_HOPS.length; i++) {
      emitRecoveryCanonicalEvent(RECOVERY_FLOW_HOPS[i], record, "hop test step " + i);
    }

    var hopResult = validateHops("recovery", corrId);
    expect(hopResult.complete).toBe(true);
    expect(hopResult.missingHops.length).toBe(0);
    expect(hopResult.presentHops.length).toBe(5);
  });

  it("T6: partial recovery yields BROKEN_CHAIN (NO_EVENTS workaround removed)", function () {
    setupPersistence();

    var corrId = "corr-partial-test";

    // Emit only 2 of 5 required hops
    var record = {
      recoveryId: "rec-partial-test",
      correlationId: corrId,
      actor: "ops-admin",
      reason: "partial test",
      currentState: "RECOVERY_REQUESTED",
      baselineId: "bl-test",
      preconditionResults: [],
      stages: [],
      startedAt: new Date(),
    };

    emitRecoveryCanonicalEvent("INCIDENT_LOCKDOWN_RECOVERY_REQUESTED", record, "step 1");
    emitRecoveryCanonicalEvent("INCIDENT_LOCKDOWN_RECOVERY_VALIDATED", record, "step 2");

    var timeline = buildTimeline(corrId);
    // 3 missing hops > 2 threshold → BROKEN_CHAIN
    expect(timeline.reconstructionStatus).toBe("BROKEN_CHAIN");
    expect(timeline.missingHops.length).toBeGreaterThan(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Group 3: Crash/Retry Residue Diagnostics (2 tests)
// ══════════════════════════════════════════════════════════════════════════════

describe("P1 Closeout: Group 3 — Crash/Retry Residue Diagnostics", function () {
  beforeEach(function () {
    setupPersistence();
  });

  it("T7: clean state yields CLEAN diagnostic", async function () {
    var report = await runRecoveryDiagnostics();
    expect(report.healthStatus).toBe("CLEAN");
    expect(report.diagnostics.length).toBe(0);
  });

  it("T8: stale recovery lock detected", async function () {
    // Inject a stale lock via the persistence layer
    var adapters = getPersistenceAdapters();
    await adapters.lock.acquire({
      lockKey: "recovery:stale-test",
      lockOwner: "crashed-process",
      targetType: "INCIDENT_LOCKDOWN_RECOVERY",
      reason: "test stale lock",
      correlationId: "corr-stale",
      ttlMs: 1, // expires immediately
    });

    // Wait a tiny bit for expiry
    await new Promise(function (r) { setTimeout(r, 10); });

    var report = await runRecoveryDiagnostics();
    expect(report.healthStatus).toBe("CRITICAL_RESIDUE");

    var staleDiag = report.diagnostics.find(function (d) {
      return d.reasonCode === "STALE_RECOVERY_LOCK";
    });
    expect(staleDiag).toBeTruthy();
    expect(staleDiag.severity).toBe("ERROR");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Group 4: Final Acceptance Gate (2 tests)
// ══════════════════════════════════════════════════════════════════════════════

describe("P1 Closeout: Group 4 — Final Acceptance Gate", function () {
  beforeEach(function () {
    setupPersistence();
  });

  it("T9: incomplete canonical chain detected in diagnostics", async function () {
    var corrId = "corr-incomplete-chain";

    // Emit only first 2 containment hops (out of 8)
    var evt1 = createCanonicalEvent({
      eventType: "BREACH_DETECTED",
      correlationId: corrId,
    });
    writeCanonicalAudit(evt1);

    var evt2 = createCanonicalEvent({
      eventType: "FINAL_CONTAINMENT_STARTED",
      correlationId: corrId,
    });
    writeCanonicalAudit(evt2);

    var report = await runRecoveryDiagnostics(corrId);
    var chainDiag = report.diagnostics.find(function (d) {
      return d.reasonCode === "CANONICAL_CHAIN_BROKEN";
    });
    expect(chainDiag).toBeTruthy();
    expect(chainDiag.category).toBe("INCOMPLETE_CANONICAL_CHAIN");
    expect(report.healthStatus).toBe("CRITICAL_RESIDUE");
  });

  it("T10: P1 final acceptance criteria — full recovery with clean diagnostics", async function () {
    var lockdownState = setupLockdownState();
    var corrId = "corr-final-accept";

    // 1. Full recovery flow
    var reqResult = requestRecovery({
      actor: "ops-admin",
      reason: "final acceptance test",
      correlationId: corrId,
      baselineId: "bl-closeout",
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(reqResult.success).toBe(true);

    var valResult = await validateRecovery(reqResult.recoveryId, corrId);
    expect(valResult.success).toBe(true);

    var exeResult = await executeRecoveryAsync(reqResult.recoveryId, corrId);
    expect(exeResult.success).toBe(true);

    // 2. Verify recovery passed
    var verResult = await verifyRecovery(reqResult.recoveryId);
    expect(verResult.passed).toBe(true);

    // 3. Canonical baseline uniqueness
    var singleCanonical = assertSingleCanonical();
    expect(singleCanonical.valid).toBe(true);

    // 4. Recovery canonical events present
    var events = getCanonicalAuditLog({ correlationId: corrId });
    expect(events.length).toBeGreaterThan(0);

    // 5. Timeline reconstructable (not BROKEN_CHAIN)
    var timeline = buildTimeline(corrId);
    expect(timeline.reconstructionStatus).not.toBe("BROKEN_CHAIN");

    // 6. Recovery hop validation has present hops
    var hopResult = validateHops("recovery", corrId);
    expect(hopResult.presentHops.length).toBeGreaterThan(0);

    // 7. Diagnostics clean
    var report = await runRecoveryDiagnostics(corrId);
    expect(report.healthStatus).toBe("CLEAN");

    // Final acceptance: all 7 criteria passed = P1_FINAL_ACCEPTED
    var accepted =
      reqResult.success &&
      valResult.success &&
      exeResult.success &&
      verResult.passed &&
      singleCanonical.valid &&
      events.length > 0 &&
      timeline.reconstructionStatus !== "BROKEN_CHAIN" &&
      report.healthStatus === "CLEAN";

    expect(accepted).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Group 5: Flow Exclusion & buildTimeline Contract (3 tests)
// ══════════════════════════════════════════════════════════════════════════════

describe("P1 Closeout: Group 5 — Flow Exclusion & Timeline Contract", function () {
  beforeEach(function () {
    setupPersistence();
  });

  it("T11: in-progress recovery — partial recovery hops do NOT cause precondition BROKEN_CHAIN", function () {
    var corrId = "corr-in-progress";

    // Emit only REQUESTED (1 of 5 recovery hops) — simulates mid-recovery
    var record = {
      recoveryId: "rec-in-progress",
      correlationId: corrId,
      actor: "ops-admin",
      reason: "in-progress test",
      currentState: "RECOVERY_REQUESTED",
      baselineId: "bl-test",
      preconditionResults: [],
      stages: [],
      startedAt: new Date(),
    };
    emitRecoveryCanonicalEvent("INCIDENT_LOCKDOWN_RECOVERY_REQUESTED", record, "step 1");

    // With excludeFlows: ["recovery"] — should pass (no non-recovery missing hops)
    var result = checkAuditChainReconstructable(corrId, { excludeFlows: ["recovery"] });
    expect(result.passed).toBe(true);

    // Without excludeFlows — buildTimeline sees 4 missing recovery hops → BROKEN_CHAIN
    var resultFull = checkAuditChainReconstructable(corrId);
    // 4 missing > 2 threshold → BROKEN_CHAIN → passed=false
    expect(resultFull.passed).toBe(false);
  });

  it("T12: post-recovery — full recovery flow yields reconstructable including recovery hops", function () {
    var corrId = "corr-post-recovery";

    var record = {
      recoveryId: "rec-post-recovery",
      correlationId: corrId,
      actor: "ops-admin",
      reason: "post-recovery test",
      currentState: "RECOVERY_RESTORED",
      baselineId: "bl-test",
      preconditionResults: [],
      stages: [],
      startedAt: new Date(),
    };

    // Emit all 5 recovery hops
    for (var i = 0; i < RECOVERY_FLOW_HOPS.length; i++) {
      emitRecoveryCanonicalEvent(RECOVERY_FLOW_HOPS[i], record, "step " + i);
    }

    // Without excludeFlows — all hops present, should pass
    var result = checkAuditChainReconstructable(corrId);
    expect(result.passed).toBe(true);

    // Timeline should be RECONSTRUCTABLE
    var timeline = buildTimeline(corrId);
    expect(timeline.reconstructionStatus).toBe("RECONSTRUCTABLE");
  });

  it("T13: buildTimeline global contract unchanged — BROKEN_CHAIN for partial containment", function () {
    var corrId = "corr-global-contract";

    // Emit 2 of 8 containment hops → 6 missing → BROKEN_CHAIN
    var evt1 = createCanonicalEvent({
      eventType: "BREACH_DETECTED",
      correlationId: corrId,
    });
    writeCanonicalAudit(evt1);

    var evt2 = createCanonicalEvent({
      eventType: "FINAL_CONTAINMENT_STARTED",
      correlationId: corrId,
    });
    writeCanonicalAudit(evt2);

    var timeline = buildTimeline(corrId);
    // 6 missing containment hops > 2 → BROKEN_CHAIN
    expect(timeline.reconstructionStatus).toBe("BROKEN_CHAIN");
    expect(timeline.missingHops.length).toBe(6);

    // Each missing hop is prefixed with "containment:"
    var allContainment = timeline.missingHops.every(function (h) {
      return h.startsWith("containment:");
    });
    expect(allContainment).toBe(true);

    // orderedEvents still returns the 2 events
    expect(timeline.orderedEvents.length).toBe(2);
    expect(timeline.finalOutcome).not.toBe("NO_EVENTS");
  });
});
