// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass
/**
 * P5 Slice 3 — Lock-Hygiene / Baseline-Validator Async Migration (7 tests)
 *
 * Validates:
 * - LB1: validateBaselineAtBoot async — validation semantics preserved
 * - LB2: lock-hygiene async baseline — sweep diagnostic uses repo-first
 * - LB3: lock-hygiene async incident — guard semantics preserved
 * - LB4: No sync fallback in hygiene/validator paths
 * - LB5: getCanonicalBaseline emits LEGACY_SYNC_COMPAT_REMOVED
 * - LB6: hasUnacknowledgedIncidents emits LEGACY_SYNC_COMPAT_REMOVED
 * - LB7: Inventory 9 REMOVED + 1 RETAINED
 *
 * Babel constraints: var + require(), function() not arrow.
 */

import { describe, it, expect, beforeEach } from "vitest";

var { getDiagnosticLog, _resetDiagnostics } = require("../core/ontology/diagnostics");
var { createMemoryAdapters } = require("../core/persistence/memory");
var { registerAdapterFactory, _resetAdapterRegistry } = require("../core/persistence/factory");
var { bootstrapPersistence, _resetPersistenceBootstrap } = require("../core/persistence/bootstrap");
var {
  createSnapshotPair,
  _resetSnapshotStore,
} = require("../core/baseline/snapshot-manager");
var {
  createCanonicalBaseline,
  getCanonicalBaseline,
  _resetBaselineRegistry,
} = require("../core/baseline/baseline-registry");
var {
  validateBaselineAtBoot,
} = require("../core/baseline/baseline-validator");
var {
  createAuthorityLine,
  _resetAuthorityRegistry,
} = require("../core/authority/authority-registry");
var {
  hasUnacknowledgedIncidents,
  escalateIncident,
  _resetIncidents,
} = require("../core/incidents/incident-escalation");
var {
  scanLockResidues,
} = require("../core/persistence/lock-hygiene");
var {
  _resetAuditEvents,
} = require("../core/audit/audit-events");
var {
  _resetCanonicalAudit,
} = require("../core/observability/canonical-event-schema");
var {
  _resetRecoveryCoordinator,
} = require("../core/recovery/recovery-coordinator");
var {
  _resetMutationFreeze,
} = require("../core/containment/mutation-freeze");
var {
  SYNC_COMPAT_SHUTDOWN_INVENTORY,
  evaluateP4Acceptance,
} = require("../core/ontology/p3-closeout");

// ── Test Fixtures ──

var SCOPE_DATA = {
  CONFIG: { maxRetries: 3, timeout: 5000 },
  FLAGS: { enableNewUI: true, darkMode: false },
  ROUTING: { primary: "us-east-1", fallback: "eu-west-1" },
  AUTHORITY: { owner: "admin", level: "root" },
  POLICY: { retention: 90, encryption: "AES256" },
  QUEUE_TOPOLOGY: { queues: ["intake", "process", "output"], concurrency: 4 },
};

function setupAll() {
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
  registerAdapterFactory(createMemoryAdapters);
  bootstrapPersistence();
}

function createFullScenario() {
  var pair = createSnapshotPair({
    baselineId: "bl-lb-test",
    capturedBy: "op-lb",
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
    freezeReason: "lb test freeze",
    performedBy: "tester",
  });

  createAuthorityLine("line-lb-1", "auth-A", "bl-lb-test", "tester", "corr-lb");

  return { pair: pair, baseline: baseline };
}

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// ── Suite ──

describe("P5 Slice 3 — Lock-Hygiene / Baseline-Validator Async Migration", function () {
  beforeEach(function () {
    setupAll();
  });

  it("LB1: validateBaselineAtBoot async — validation semantics preserved", async function () {
    var scenario = createFullScenario();
    await wait(50);

    var runtimeState = {
      lifecycleState: scenario.baseline.lifecycleState,
      releaseMode: scenario.baseline.releaseMode,
      baselineStatus: scenario.baseline.baselineStatus,
      baselineHash: scenario.baseline.baselineHash,
    };
    var policy = {
      stabilizationOnly: true,
      featureExpansionAllowed: false,
      devOnlyPathAllowed: false,
    };

    var result = await validateBaselineAtBoot(runtimeState, policy);

    // All checks should pass with correct runtime state
    expect(result.valid).toBe(true);
    expect(result.blocksActiveRuntime).toBe(false);
    expect(result.checks.length).toBeGreaterThanOrEqual(5);

    // Verify specific checks
    var uniqueCheck = result.checks.find(function (c) {
      return c.name === "canonical_baseline_uniqueness";
    });
    expect(uniqueCheck).toBeDefined();
    expect(uniqueCheck.passed).toBe(true);

    var hashCheck = result.checks.find(function (c) {
      return c.name === "baseline_hash_match";
    });
    expect(hashCheck).toBeDefined();
    expect(hashCheck.passed).toBe(true);
  });

  it("LB2: lock-hygiene async baseline — sweep diagnostic uses repo-first", async function () {
    createFullScenario();
    await wait(50);
    _resetDiagnostics();

    // scanLockResidues internally calls emitSweepDiagnostic which now uses getCanonicalBaselineFromRepo
    var result = await scanLockResidues();

    // Should complete without errors
    expect(result.scanId).toBeDefined();
    expect(result.scannedAt).toBeInstanceOf(Date);

    // No LEGACY_SYNC_COMPAT_RETAINED diagnostic for getCanonicalBaseline
    var retainedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON" &&
        d.reasonCode.indexOf("getCanonicalBaseline") !== -1;
    });
    expect(retainedDiags.length).toBe(0);
  });

  it("LB3: lock-hygiene async incident — guard semantics preserved", async function () {
    createFullScenario();
    escalateIncident("THRESHOLD_EXCEEDED", "corr-lb3", "tester", "LB3 test incident");
    await wait(50);
    _resetDiagnostics();

    var result = await scanLockResidues();

    // Should complete without errors
    expect(result.scanId).toBeDefined();

    // No LEGACY_SYNC_COMPAT_RETAINED diagnostic for hasUnacknowledgedIncidents
    var retainedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON" &&
        d.reasonCode.indexOf("hasUnacknowledgedIncidents") !== -1;
    });
    expect(retainedDiags.length).toBe(0);
  });

  it("LB4: no sync fallback in hygiene/validator paths", async function () {
    createFullScenario();
    await wait(50);
    _resetDiagnostics();

    // Run validator (async path)
    var runtimeState = {
      lifecycleState: "ACTIVE_100",
      releaseMode: "FULL_ACTIVE_STABILIZATION",
      baselineStatus: "FROZEN",
      baselineHash: "dummy",
    };
    var policy = {
      stabilizationOnly: true,
      featureExpansionAllowed: false,
      devOnlyPathAllowed: false,
    };
    await validateBaselineAtBoot(runtimeState, policy);

    // Run hygiene (async path)
    await scanLockResidues();

    // Should have zero LEGACY_SYNC_COMPAT_RETAINED for getCanonicalBaseline or hasUnacknowledgedIncidents
    var retainedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON" &&
        (d.reasonCode.indexOf("getCanonicalBaseline") !== -1 ||
         d.reasonCode.indexOf("hasUnacknowledgedIncidents") !== -1);
    });
    expect(retainedDiags.length).toBe(0);
  });

  it("LB5: getCanonicalBaseline emits LEGACY_SYNC_COMPAT_REMOVED", function () {
    createFullScenario();
    _resetDiagnostics();

    var baseline = getCanonicalBaseline();
    expect(baseline).not.toBeNull();

    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_REMOVED" &&
        d.reasonCode.indexOf("getCanonicalBaseline:removed") !== -1;
    });
    expect(removedDiags.length).toBe(1);
    expect(removedDiags[0].moduleName).toBe("baseline-registry");
  });

  it("LB6: hasUnacknowledgedIncidents emits LEGACY_SYNC_COMPAT_REMOVED", function () {
    createFullScenario();
    _resetDiagnostics();

    var result = hasUnacknowledgedIncidents();
    expect(typeof result).toBe("boolean");

    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_REMOVED" &&
        d.reasonCode.indexOf("hasUnacknowledgedIncidents:removed") !== -1;
    });
    expect(removedDiags.length).toBe(1);
    expect(removedDiags[0].moduleName).toBe("incident-escalation");
  });

  it("LB7: inventory 10 REMOVED + 0 RETAINED", function () {
    var removed = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "REMOVED";
    });
    var retained = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "RETAINED";
    });

    expect(removed.length).toBe(10);
    expect(retained.length).toBe(0);

    // getCanonicalBaseline should be in REMOVED
    var baselineRemoved = removed.find(function (e) {
      return e.functionName === "getCanonicalBaseline";
    });
    expect(baselineRemoved).toBeDefined();
    expect(baselineRemoved.removedInSlice).toBe("P5-3");
    expect(baselineRemoved.productionCallerCount).toBe(0);

    // hasUnacknowledgedIncidents should be in REMOVED
    var incidentRemoved = removed.find(function (e) {
      return e.functionName === "hasUnacknowledgedIncidents";
    });
    expect(incidentRemoved).toBeDefined();
    expect(incidentRemoved.removedInSlice).toBe("P5-3");
    expect(incidentRemoved.productionCallerCount).toBe(0);

    // buildTimeline now REMOVED in P5-4
    var timelineRemoved = removed.find(function (e) {
      return e.functionName === "buildTimeline";
    });
    expect(timelineRemoved).toBeDefined();
    expect(timelineRemoved.removedInSlice).toBe("P5-4");
    expect(timelineRemoved.productionCallerCount).toBe(0);

    // P4 acceptance still valid
    var sheet = evaluateP4Acceptance();
    expect(sheet.decision).toBe("P4_ACCEPTED");
    expect(sheet.syncCompatInventory.removedCount).toBe(10);
    expect(sheet.syncCompatInventory.retainedCount).toBe(0);
  });
});
