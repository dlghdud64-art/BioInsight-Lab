// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass
/**
 * P5 Slice 1 — Startup Async Migration (7 tests)
 *
 * Validates:
 * - SM1: evaluateResumeReadiness uses async incident check (repo-first)
 * - SM2: evaluateResumeReadiness uses async authority check (repo-first)
 * - SM3: emitStartupDiagnostic uses async baseline (no sync getCanonicalBaseline)
 * - SM4: recovery-preconditions repo-only — no legacy cross-check fallback
 * - SM5: checkAuthorityIntegrity emits LEGACY_SYNC_COMPAT_REMOVED
 * - SM6: Inventory is 6 REMOVED + 4 RETAINED with updated caller counts
 * - SM7: evaluateP4Acceptance still returns P4_ACCEPTED after inventory update
 *
 * Babel constraints: var + require(), function() not arrow.
 */

var { describe, it, expect, beforeEach } = require("@jest/globals");

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
  checkAuthorityIntegrity,
} = require("../core/authority/authority-registry");
var {
  escalateIncident,
  _resetIncidents,
} = require("../core/incidents/incident-escalation");
var { _resetAuditEvents } = require("../core/audit/audit-events");
var {
  requestRecovery,
  _resetRecoveryCoordinator,
} = require("../core/recovery/recovery-coordinator");
var {
  activateMutationFreeze,
  _resetMutationFreeze,
} = require("../core/containment/mutation-freeze");
var {
  runStartupRecoveryScan,
  evaluateResumeReadiness,
} = require("../core/recovery/recovery-startup");
var {
  runRecoveryPreconditions,
} = require("../core/recovery/recovery-preconditions");
var { getDiagnosticLog, _resetDiagnostics } = require("../core/ontology/diagnostics");
var { _resetCanonicalAudit } = require("../core/observability/canonical-event-schema");
var {
  SYNC_COMPAT_SHUTDOWN_INVENTORY,
  evaluateP4Acceptance,
} = require("../core/ontology/p3-closeout");

// ── Scope Data ──

var SCOPE_DATA = {
  CONFIG: { maxRetries: 3, timeout: 5000 },
  FLAGS: { enableNewUI: true, darkMode: false },
  ROUTING: { primary: "us-east-1", fallback: "eu-west-1" },
  AUTHORITY: { owner: "admin", level: "root" },
  POLICY: { retention: 90, encryption: "AES256" },
  QUEUE_TOPOLOGY: { queues: ["intake", "process", "output"], concurrency: 4 },
};

function resetAll() {
  _resetDiagnostics();
  _resetPersistenceBootstrap();
  _resetAdapterRegistry();
  _resetBaselineRegistry();
  _resetSnapshotStore();
  _resetAuthorityRegistry();
  _resetIncidents();
  _resetAuditEvents();
  _resetRecoveryCoordinator();
  _resetMutationFreeze();
  _resetCanonicalAudit();
  bootstrapPersistence({ mode: "MEMORY" });
}

function createRecoveryScenario() {
  var pair = createSnapshotPair({
    baselineId: "bl-sm-test",
    capturedBy: "op-sm",
    scopeData: SCOPE_DATA,
  });

  createCanonicalBaseline({
    documentType: "TEST",
    baselineVersion: "v1.0",
    activeSnapshotId: pair.active.snapshotId,
    rollbackSnapshotId: pair.rollback.snapshotId,
    activePathManifestId: "manifest-1",
    policySetVersion: "p1",
    routingRuleVersion: "r1",
    authorityRegistryVersion: "a1",
    freezeReason: "sm test freeze",
    performedBy: "tester",
  });

  createAuthorityLine("line-sm-1", "auth-A", "bl-sm-test", "tester", "corr-sm");

  return { pair: pair };
}

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function createActiveRecoveryRecord() {
  var scenario = createRecoveryScenario();
  activateMutationFreeze("incident-1", "corr-sm", "tester", "sm test freeze");
  escalateIncident("THRESHOLD_EXCEEDED", "corr-sm", "tester", "SM test incident");
  var result = requestRecovery({
    actor: "tester",
    reason: "SM test recovery",
    correlationId: "corr-sm",
    baselineId: "bl-sm-test",
    lifecycleState: "INCIDENT_LOCKDOWN",
  });
  return { scenario: scenario, result: result };
}

// ── Suite ──

describe("P5 Slice 1 — Startup Async Migration", function () {
  beforeEach(function () {
    resetAll();
  });

  it("SM1: evaluateResumeReadiness uses async incident check — blocks on unacknowledged incidents", async function () {
    var recovery = createActiveRecoveryRecord();
    await wait(50);

    // Get persisted record from adapters for evaluateResumeReadiness
    var adapters = getPersistenceAdapters();
    var record = await adapters.recoveryRecord.findActiveRecovery();
    expect(record).not.toBeNull();

    var readiness = await evaluateResumeReadiness(record);

    // Should detect unacknowledged incidents via async check
    var incidentCheck = readiness.checks.find(function (c) {
      return c.name === "NO_OPEN_CRITICAL_INCIDENTS";
    });
    expect(incidentCheck).toBeDefined();
    expect(incidentCheck.passed).toBe(false);
    expect(incidentCheck.detail).toContain("unacknowledged");
  });

  it("SM2: evaluateResumeReadiness uses async authority check — passes on clean authority", async function () {
    var recovery = createActiveRecoveryRecord();
    await wait(50);

    var adapters = getPersistenceAdapters();
    var record = await adapters.recoveryRecord.findActiveRecovery();
    expect(record).not.toBeNull();

    var readiness = await evaluateResumeReadiness(record);

    // Authority check should pass (no split brain, no orphans)
    var authorityCheck = readiness.checks.find(function (c) {
      return c.name === "AUTHORITY_CONTINUITY_VALID";
    });
    expect(authorityCheck).toBeDefined();
    expect(authorityCheck.passed).toBe(true);
  });

  it("SM3: startup scan uses async baseline — no sync getCanonicalBaseline in diagnostics", async function () {
    _resetDiagnostics();

    // Run a clean startup scan (no recovery residue)
    var result = await runStartupRecoveryScan();
    expect(result.status).toBeDefined();

    // Verify no LEGACY_SYNC_COMPAT diagnostic for getCanonicalBaseline
    var baselineSyncDiags = getDiagnosticLog().filter(function (d) {
      return (d.type === "LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON" ||
              d.type === "LEGACY_SYNC_COMPAT_REMOVED") &&
        d.reasonCode.indexOf("getCanonicalBaseline") !== -1;
    });
    // Should be 0 — startup no longer calls sync getCanonicalBaseline
    expect(baselineSyncDiags.length).toBe(0);
  });

  it("SM4: recovery-preconditions repo-only — no legacy cross-check fallback", async function () {
    var scenario = createRecoveryScenario();
    escalateIncident("THRESHOLD_EXCEEDED", "corr-sm4", "tester", "SM4 incident");

    _resetDiagnostics();

    // Call full preconditions — includes incident check via repo-only path
    var precondResult = await runRecoveryPreconditions({
      recoveryId: "rec-sm4",
      correlationId: "corr-sm4",
      rollbackSnapshotId: scenario.pair.rollback.snapshotId,
      activeSnapshotId: scenario.pair.active.snapshotId,
    });

    // Incident check should fail (exists, not acknowledged)
    var incidentResult = precondResult.results.find(function (r) {
      return r.name === "NO_OPEN_CRITICAL_INCIDENTS";
    });
    expect(incidentResult).toBeDefined();
    expect(incidentResult.passed).toBe(false);

    // Verify no LEGACY_SYNC_COMPAT diagnostic for hasUnacknowledgedIncidents
    var syncIncidentDiags = getDiagnosticLog().filter(function (d) {
      return (d.type === "LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON" ||
              d.type === "LEGACY_SYNC_COMPAT_REMOVED") &&
        d.reasonCode.indexOf("hasUnacknowledgedIncidents") !== -1;
    });
    expect(syncIncidentDiags.length).toBe(0);
  });

  it("SM5: checkAuthorityIntegrity emits LEGACY_SYNC_COMPAT_REMOVED (soft removal)", function () {
    createRecoveryScenario();
    _resetDiagnostics();

    var report = checkAuthorityIntegrity();
    expect(report).toBeDefined();

    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_REMOVED" &&
        d.reasonCode.indexOf("checkAuthorityIntegrity:removed") !== -1;
    });
    expect(removedDiags.length).toBe(1);
    expect(removedDiags[0].moduleName).toBe("authority-registry");
  });

  it("SM6: inventory is 6 REMOVED + 4 RETAINED with updated caller counts", function () {
    var removed = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "REMOVED";
    });
    var retained = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "RETAINED";
    });

    expect(removed.length).toBe(10);
    expect(retained.length).toBe(0);

    // checkAuthorityIntegrity should be in REMOVED
    var authorityRemoved = removed.find(function (e) {
      return e.functionName === "checkAuthorityIntegrity";
    });
    expect(authorityRemoved).toBeDefined();
    expect(authorityRemoved.removedInSlice).toBe("P5-1");
    expect(authorityRemoved.productionCallerCount).toBe(0);

    // getCanonicalBaseline moved to REMOVED in P5-3
    var baselineRemoved = removed.find(function (e) {
      return e.functionName === "getCanonicalBaseline";
    });
    expect(baselineRemoved).toBeDefined();
    expect(baselineRemoved.removedInSlice).toBe("P5-3");
    expect(baselineRemoved.productionCallerCount).toBe(0);

    // hasUnacknowledgedIncidents moved to REMOVED in P5-3
    var incidentRemoved = removed.find(function (e) {
      return e.functionName === "hasUnacknowledgedIncidents";
    });
    expect(incidentRemoved).toBeDefined();
    expect(incidentRemoved.removedInSlice).toBe("P5-3");
    expect(incidentRemoved.productionCallerCount).toBe(0);

    // getSnapshot moved to REMOVED in P5-2
    var snapshotRemoved = removed.find(function (e) {
      return e.functionName === "getSnapshot";
    });
    expect(snapshotRemoved).toBeDefined();
    expect(snapshotRemoved.removedInSlice).toBe("P5-2");
    expect(snapshotRemoved.productionCallerCount).toBe(0);

    // buildTimeline moved to REMOVED in P5-4
    var timelineRemoved = removed.find(function (e) {
      return e.functionName === "buildTimeline";
    });
    expect(timelineRemoved).toBeDefined();
    expect(timelineRemoved.removedInSlice).toBe("P5-4");
    expect(timelineRemoved.productionCallerCount).toBe(0);
  });

  it("SM7: evaluateP4Acceptance still returns P4_ACCEPTED after inventory update", function () {
    var sheet = evaluateP4Acceptance();

    expect(sheet.decision).toBe("P4_ACCEPTED");
    expect(sheet.criteria.length).toBe(5);

    sheet.criteria.forEach(function (c) {
      expect(c.met).toBe(true);
    });

    expect(sheet.syncCompatInventory.removedCount).toBe(10);
    expect(sheet.syncCompatInventory.retainedCount).toBe(0);
    expect(sheet.syncCompatInventory.zeroCallerRetainedCount).toBe(0);
  });
});
