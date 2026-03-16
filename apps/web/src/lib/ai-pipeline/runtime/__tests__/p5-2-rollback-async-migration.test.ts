/**
 * P5 Slice 2 — Rollback Subsystem Async Migration (7 tests)
 *
 * Validates:
 * - RA1: runRollbackPrecheck async — returns same result via repo
 * - RA2: buildRollbackPlan async — plan structure preserved
 * - RA3: executeRollbackPlan async — execution semantics preserved
 * - RA4: runResidueScan async — residue detection preserved
 * - RA5: reconcileState async — reconciliation semantics preserved
 * - RA6: Inventory is 7 REMOVED + 3 RETAINED with getSnapshot REMOVED P5-2
 * - RA7: evaluateP4Acceptance still returns P4_ACCEPTED after inventory update
 *
 * Babel constraints: var + require(), function() not arrow.
 */

var { describe, it, expect, beforeEach } = require("@jest/globals");

var {
  _resetPersistenceBootstrap,
  bootstrapPersistence,
} = require("../core/persistence/bootstrap");
var { _resetAdapterRegistry } = require("../core/persistence/factory");
var {
  createCanonicalBaseline,
  _resetBaselineRegistry,
} = require("../core/baseline/baseline-registry");
var {
  createSnapshotPair,
  _resetSnapshotStore,
  getSnapshot,
} = require("../core/baseline/snapshot-manager");
var {
  createAuthorityLine,
  _resetAuthorityRegistry,
} = require("../core/authority/authority-registry");
var { _resetIncidents } = require("../core/incidents/incident-escalation");
var { _resetAuditEvents } = require("../core/audit/audit-events");
var { _resetRecoveryCoordinator } = require("../core/recovery/recovery-coordinator");
var {
  activateMutationFreeze,
  deactivateMutationFreeze,
  _resetMutationFreeze,
} = require("../core/containment/mutation-freeze");
var { _resetCanonicalAudit } = require("../core/observability/canonical-event-schema");
var { getDiagnosticLog, _resetDiagnostics } = require("../core/ontology/diagnostics");
var {
  initializeRuntimeState,
  _resetRuntimeState,
} = require("../core/rollback/scope-restore-adapter");

var { runRollbackPrecheck } = require("../core/rollback/rollback-precheck");
var { buildRollbackPlan } = require("../core/rollback/rollback-plan-builder");
var { executeRollbackPlan } = require("../core/rollback/rollback-executor");
var { runResidueScan } = require("../core/rollback/residue-scan");
var { reconcileState } = require("../core/rollback/state-reconciliation");

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
  _resetRuntimeState();
  bootstrapPersistence({ mode: "MEMORY" });
}

function createTestScenario() {
  var pair = createSnapshotPair({
    baselineId: "bl-ra-test",
    capturedBy: "op-ra",
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
    freezeReason: "ra test freeze",
    performedBy: "tester",
  });

  createAuthorityLine("line-ra-1", "auth-A", "bl-ra-test", "tester", "corr-ra");

  return { pair: pair };
}

// ── Suite ──

describe("P5 Slice 2 — Rollback Subsystem Async Migration", function () {
  beforeEach(function () {
    resetAll();
  });

  it("RA1: runRollbackPrecheck async — returns same result via repo", async function () {
    var scenario = createTestScenario();
    activateMutationFreeze("incident-1", "corr-ra", "tester", "ra test freeze");

    var result = await runRollbackPrecheck(
      scenario.pair.rollback.snapshotId,
      scenario.pair.active.snapshotId
    );

    expect(result.passed).toBe(true);
    expect(result.reasonCode).toBe("PRECHECK_PASSED");
    expect(result.checks.length).toBeGreaterThanOrEqual(4);

    var snapshotCheck = result.checks.find(function (c) {
      return c.name === "rollback_snapshot_exists";
    });
    expect(snapshotCheck).toBeDefined();
    expect(snapshotCheck.passed).toBe(true);

    deactivateMutationFreeze();
  });

  it("RA2: buildRollbackPlan async — plan structure preserved", async function () {
    var scenario = createTestScenario();

    var plan = await buildRollbackPlan(
      "bl-ra-test",
      scenario.pair.rollback.snapshotId,
      "TEST_BREACH"
    );

    expect(plan.planId).toBeDefined();
    expect(plan.baselineId).toBe("bl-ra-test");
    expect(plan.snapshotId).toBe(scenario.pair.rollback.snapshotId);
    expect(plan.affectedScopes.length).toBeGreaterThan(0);
    expect(plan.orderedSteps.length).toBe(plan.affectedScopes.length);

    plan.orderedSteps.forEach(function (step) {
      expect(step.status).toBe("PENDING");
      expect(step.restoreVerified).toBe(false);
    });
  });

  it("RA3: executeRollbackPlan async — execution semantics preserved", async function () {
    var scenario = createTestScenario();
    initializeRuntimeState(SCOPE_DATA);
    activateMutationFreeze("incident-1", "corr-ra", "tester", "ra test freeze");

    var plan = await buildRollbackPlan(
      "bl-ra-test",
      scenario.pair.rollback.snapshotId,
      "TEST_BREACH"
    );

    var result = await executeRollbackPlan(plan, "corr-ra", "tester");

    expect(result.success).toBe(true);
    expect(result.stepsExecuted).toBe(plan.orderedSteps.length);

    plan.orderedSteps.forEach(function (step) {
      expect(step.status).toBe("EXECUTED");
      expect(step.restoreVerified).toBe(true);
    });

    deactivateMutationFreeze();
  });

  it("RA4: runResidueScan async — residue detection preserved", async function () {
    var scenario = createTestScenario();

    // Clean state — should have no residue
    var cleanResult = await runResidueScan(
      scenario.pair.rollback.snapshotId,
      SCOPE_DATA
    );
    expect(cleanResult.clean).toBe(true);
    expect(cleanResult.hasCritical).toBe(false);

    // Mismatched state — should detect residue
    var mismatchState = {
      CONFIG: { maxRetries: 99, timeout: 5000 },
      FLAGS: { enableNewUI: true, darkMode: false },
      ROUTING: { primary: "us-east-1", fallback: "eu-west-1" },
      AUTHORITY: { owner: "admin", level: "root" },
      POLICY: { retention: 90, encryption: "AES256" },
      QUEUE_TOPOLOGY: { queues: ["intake", "process", "output"], concurrency: 4 },
    };
    var dirtyResult = await runResidueScan(
      scenario.pair.rollback.snapshotId,
      mismatchState
    );
    expect(dirtyResult.clean).toBe(false);
    expect(dirtyResult.residues.length).toBeGreaterThan(0);
  });

  it("RA5: reconcileState async — reconciliation semantics preserved", async function () {
    var scenario = createTestScenario();

    // Clean state — should reconcile successfully
    var cleanRecon = await reconcileState(
      scenario.pair.rollback.snapshotId,
      SCOPE_DATA
    );
    expect(cleanRecon.success).toBe(true);
    expect(cleanRecon.unresolvedCount).toBe(0);

    // Authority mismatch — should detect unresolved critical diff
    var authorityMismatch = {
      CONFIG: { maxRetries: 3, timeout: 5000 },
      FLAGS: { enableNewUI: true, darkMode: false },
      ROUTING: { primary: "us-east-1", fallback: "eu-west-1" },
      AUTHORITY: { owner: "hacker", level: "root" },
      POLICY: { retention: 90, encryption: "AES256" },
      QUEUE_TOPOLOGY: { queues: ["intake", "process", "output"], concurrency: 4 },
    };
    var failedRecon = await reconcileState(
      scenario.pair.rollback.snapshotId,
      authorityMismatch
    );
    expect(failedRecon.success).toBe(false);
    expect(failedRecon.unresolvedCount).toBeGreaterThan(0);
  });

  it("RA6: inventory is 10 REMOVED + 0 RETAINED with getSnapshot REMOVED P5-2", function () {
    var removed = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "REMOVED";
    });
    var retained = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "RETAINED";
    });

    expect(removed.length).toBe(10);
    expect(retained.length).toBe(0);

    // getSnapshot should be in REMOVED
    var snapshotRemoved = removed.find(function (e) {
      return e.functionName === "getSnapshot";
    });
    expect(snapshotRemoved).toBeDefined();
    expect(snapshotRemoved.removedInSlice).toBe("P5-2");
    expect(snapshotRemoved.productionCallerCount).toBe(0);
  });

  it("RA7: evaluateP4Acceptance still returns P4_ACCEPTED after inventory update", function () {
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
