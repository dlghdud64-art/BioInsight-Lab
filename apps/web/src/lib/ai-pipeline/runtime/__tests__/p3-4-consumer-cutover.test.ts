// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass
/**
 * P3 Slice 4 — Consumer Cutover to Repo-First Async (8 tests)
 *
 * Validates:
 * - evaluateResumeReadiness uses repo-first snapshot read
 * - evaluateResumeReadiness uses repo-first canonical baseline
 * - recovery precondition check #3 uses repo-first snapshot
 * - recovery precondition check #4 uses repo-first snapshot
 * - validateBaselineAtBootFromRepo uses repo-first reads
 * - legacy sync getSnapshot emits LEGACY_SYNC_COMPAT_PATH_USED
 * - legacy sync canEnterActiveRuntime emits LEGACY_SYNC_COMPAT_PATH_USED
 * - _assertNoDirectStoreAccess throws and emits diagnostic
 */

import { describe, it, expect, beforeEach } from "vitest";

var { getDiagnosticLog, _resetDiagnostics } = require("../core/ontology/diagnostics");
var { createMemoryAdapters } = require("../core/persistence/memory");
var { registerAdapterFactory, _resetAdapterRegistry } = require("../core/persistence/factory");
var { bootstrapPersistence, _resetPersistenceBootstrap, getPersistenceAdapters } = require("../core/persistence/bootstrap");
var {
  createSnapshotPair,
  getSnapshot,
  getSnapshotFromRepo,
  canEnterActiveRuntime,
  canEnterActiveRuntimeFromRepo,
  _resetSnapshotStore,
  _assertNoDirectStoreAccess,
} = require("../core/baseline/snapshot-manager");
var {
  createCanonicalBaseline,
  getCanonicalBaseline,
  getCanonicalBaselineFromRepo,
  assertSingleCanonical,
  _resetBaselineRegistry,
} = require("../core/baseline/baseline-registry");
var {
  validateBaselineAtBoot,
  validateBaselineAtBootFromRepo,
} = require("../core/baseline/baseline-validator");
var {
  runRecoveryPreconditions,
} = require("../core/recovery/recovery-preconditions");
var {
  evaluateResumeReadiness,
} = require("../core/recovery/recovery-startup");
var {
  createAuthorityLine,
  _resetAuthorityRegistry,
} = require("../core/authority/authority-registry");
var {
  _resetIncidents,
} = require("../core/incidents/incident-escalation");
var {
  _resetAuditEvents,
} = require("../core/audit/audit-events");
var {
  _resetRecoveryCoordinator,
} = require("../core/recovery/recovery-coordinator");
var {
  _resetMutationFreeze,
} = require("../core/containment/mutation-freeze");

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
  registerAdapterFactory(createMemoryAdapters);
  bootstrapPersistence();
}

function createFullScenario() {
  var pair = createSnapshotPair({
    baselineId: "bl-cutover-test",
    capturedBy: "op-cutover",
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
    freezeReason: "cutover test freeze",
    performedBy: "tester",
  });

  createAuthorityLine("line-1", "auth-A", "bl-cutover-test", "tester", "corr-cutover");

  return { pair: pair, baseline: baseline };
}

// ── Suite ──

describe("P3 Slice 4 — Consumer Cutover to Repo-First Async", function () {
  beforeEach(function () {
    setupAll();
  });

  it("CC1: evaluateResumeReadiness uses repo-first snapshot read", async function () {
    var scenario = createFullScenario();

    // Wait for async dual-write
    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    // Build a mock active recovery record
    var mockRecord = {
      recoveryId: "rec-cc1",
      correlationId: "corr-cc1",
      incidentId: null,
      baselineId: "bl-cutover-test",
      recoveryState: "RECOVERY_VALIDATED",
      lockKey: null,
      lockToken: null,
      startedAt: new Date(),
      lastHeartbeatAt: null,
      failureReasonCode: null,
      releaseMode: "FULL_ACTIVE_STABILIZATION",
      recoveryStage: null,
      operatorId: "tester",
      overrideUsed: false,
      overrideReason: null,
      signOffMetadata: null,
      completedAt: null,
      stageResults: [],
      preconditionResults: [],
    };

    var result = await evaluateResumeReadiness(mockRecord);

    // Should have emitted CONSUMER_CUTOVER_APPLIED for snapshot check
    var cutoverDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "CONSUMER_CUTOVER_APPLIED" &&
        d.reasonCode.indexOf("evaluateResumeReadiness") !== -1;
    });
    expect(cutoverDiags.length).toBeGreaterThanOrEqual(1);

    // Should have used repo-first path (SNAPSHOT_REPO_FIRST_READ_USED)
    var repoFirstDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "SNAPSHOT_REPO_FIRST_READ_USED";
    });
    expect(repoFirstDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("CC2: evaluateResumeReadiness uses repo-first canonical baseline", async function () {
    var scenario = createFullScenario();

    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    var mockRecord = {
      recoveryId: "rec-cc2",
      correlationId: "corr-cc2",
      incidentId: null,
      baselineId: "bl-cutover-test",
      recoveryState: "RECOVERY_VALIDATED",
      lockKey: null,
      lockToken: null,
      startedAt: new Date(),
      lastHeartbeatAt: null,
      failureReasonCode: null,
      releaseMode: "FULL_ACTIVE_STABILIZATION",
      recoveryStage: null,
      operatorId: "tester",
      overrideUsed: false,
      overrideReason: null,
      signOffMetadata: null,
      completedAt: null,
      stageResults: [],
      preconditionResults: [],
    };

    var result = await evaluateResumeReadiness(mockRecord);

    // The evaluateResumeReadiness now calls getCanonicalBaselineFromRepo
    // which emits LEGACY_BRIDGE_TRANSLATION_APPLIED via adapter chain
    var cutoverDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "CONSUMER_CUTOVER_APPLIED" &&
        d.reasonCode.indexOf("evaluateResumeReadiness") !== -1;
    });
    expect(cutoverDiags.length).toBeGreaterThanOrEqual(1);

    // Check that snapshot rollback readiness check passed (baseline was found via repo)
    var rollbackCheck = result.checks.find(function (c) {
      return c.name === "SNAPSHOT_ROLLBACK_READY";
    });
    expect(rollbackCheck).toBeDefined();
    expect(rollbackCheck.passed).toBe(true);
  });

  it("CC3: recovery precondition check #3 uses repo-first snapshot", async function () {
    var scenario = createFullScenario();

    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    var result = await runRecoveryPreconditions({
      recoveryId: "rec-cc3",
      correlationId: "corr-cc3",
      rollbackSnapshotId: scenario.pair.rollback.snapshotId,
      activeSnapshotId: scenario.pair.active.snapshotId,
    });

    // Check #3: REQUIRED_SNAPSHOT_PRESENT should pass
    var check3 = result.results.find(function (r) {
      return r.name === "REQUIRED_SNAPSHOT_PRESENT";
    });
    expect(check3).toBeDefined();
    expect(check3.passed).toBe(true);

    // Should have emitted CONSUMER_CUTOVER_APPLIED for check #3
    var cutoverDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "CONSUMER_CUTOVER_APPLIED" &&
        d.reasonCode.indexOf("checkRequiredSnapshotPresent") !== -1;
    });
    expect(cutoverDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("CC4: recovery precondition check #4 uses repo-first snapshot", async function () {
    var scenario = createFullScenario();

    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    var result = await runRecoveryPreconditions({
      recoveryId: "rec-cc4",
      correlationId: "corr-cc4",
      rollbackSnapshotId: scenario.pair.rollback.snapshotId,
      activeSnapshotId: scenario.pair.active.snapshotId,
    });

    // Check #4: SNAPSHOT_RESTORE_VERIFICATION should pass
    var check4 = result.results.find(function (r) {
      return r.name === "SNAPSHOT_RESTORE_VERIFICATION";
    });
    expect(check4).toBeDefined();
    expect(check4.passed).toBe(true);

    // Should have emitted CONSUMER_CUTOVER_APPLIED for check #4
    var cutoverDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "CONSUMER_CUTOVER_APPLIED" &&
        d.reasonCode.indexOf("checkSnapshotRestoreVerification") !== -1;
    });
    expect(cutoverDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("CC5: validateBaselineAtBootFromRepo uses repo-first reads", async function () {
    var scenario = createFullScenario();

    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

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

    var result = await validateBaselineAtBootFromRepo(runtimeState, policy);

    // Should have emitted CONSUMER_CUTOVER_APPLIED
    var cutoverDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "CONSUMER_CUTOVER_APPLIED" &&
        d.reasonCode.indexOf("validateBaselineAtBootFromRepo") !== -1;
    });
    expect(cutoverDiags.length).toBeGreaterThanOrEqual(1);

    // All checks should pass with correct runtime state
    expect(result.valid).toBe(true);
    expect(result.blocksActiveRuntime).toBe(false);
  });

  it("CC6: legacy sync getSnapshot emits LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON (P4-4)", function () {
    var scenario = createFullScenario();
    _resetDiagnostics();

    // Call retained legacy sync API
    var snap = getSnapshot(scenario.pair.active.snapshotId);
    expect(snap).not.toBeNull();

    // Should have emitted REMOVED diagnostic (P5-2 soft removal)
    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_REMOVED" &&
        d.reasonCode.indexOf("getSnapshot:removed") !== -1;
    });
    expect(removedDiags.length).toBe(1);
    expect(removedDiags[0].moduleName).toBe("snapshot-manager");
  });

  it("CC7: legacy sync canEnterActiveRuntime throws SYNC_COMPAT_REMOVED (P4-4)", function () {
    var scenario = createFullScenario();
    _resetDiagnostics();

    // Call removed legacy sync API — should throw
    expect(function () {
      canEnterActiveRuntime(
        scenario.pair.active.snapshotId,
        scenario.pair.rollback.snapshotId
      );
    }).toThrow("SYNC_COMPAT_REMOVED");

    // Should have emitted REMOVED diagnostic before throw
    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_REMOVED" &&
        d.reasonCode.indexOf("canEnterActiveRuntime:removed") !== -1;
    });
    expect(removedDiags.length).toBe(1);
    expect(removedDiags[0].moduleName).toBe("snapshot-manager");
  });

  it("CC8: _assertNoDirectStoreAccess throws and emits diagnostic", function () {
    _resetDiagnostics();

    expect(function () {
      _assertNoDirectStoreAccess("test-caller-module");
    }).toThrow("DIRECT_STORE_ACCESS_BLOCKED: test-caller-module must use repo-first API");

    // Should have emitted LEGACY_DIRECT_ACCESS_BLOCKED
    var blockedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_DIRECT_ACCESS_BLOCKED";
    });
    expect(blockedDiags.length).toBe(1);
    expect(blockedDiags[0].moduleName).toBe("snapshot-manager");
    expect(blockedDiags[0].reasonCode).toContain("test-caller-module");
  });
});
