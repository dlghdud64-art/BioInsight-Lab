// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass
/**
 * P4 Slice 1 — Recovery Coordinator Sync Read Shutdown (7 tests)
 *
 * Validates:
 * - RS1: validateRecovery uses getCanonicalBaselineFromRepo (RECOVERY_SYNC_READ_REMOVED)
 * - RS2: executeRecoveryStages uses getCanonicalBaselineFromRepo (RECOVERY_SYNC_READ_REMOVED)
 * - RS3: RESTORE_RECONCILE stage uses getSnapshotFromRepo (RECOVERY_SYNC_READ_REMOVED)
 * - RS4: AUTHORITY_CONTINUITY_RECHECK stage uses checkAuthorityIntegrityFromRepo
 * - RS5: verifyRecovery uses hasUnacknowledgedIncidentsFromRepo + getCanonicalBaselineFromRepo + getSnapshotFromRepo + checkAuthorityIntegrityFromRepo
 * - RS6: emitRecoveryAudit fires async repo-first baseline lookup
 * - RS7: full recovery E2E emits REPO_FIRST_TRUTH_SOURCE_CONFIRMED on verify success
 */

var { describe, it, expect, beforeEach } = require("@jest/globals");

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
  _resetBaselineRegistry,
} = require("../core/baseline/baseline-registry");
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
} = require("../core/audit/audit-events");
var {
  _resetCanonicalAudit,
} = require("../core/observability/canonical-event-schema");
var {
  requestRecovery,
  validateRecovery,
  executeRecoveryAsync,
  verifyRecovery,
  _resetRecoveryCoordinator,
} = require("../core/recovery/recovery-coordinator");
var {
  activateMutationFreeze,
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
  _resetCanonicalAudit();
  registerAdapterFactory(createMemoryAdapters);
  bootstrapPersistence();
}

function createFullScenario() {
  var pair = createSnapshotPair({
    baselineId: "bl-rs-test",
    capturedBy: "op-rs",
    scopeData: SCOPE_DATA,
  });

  var baseline = createCanonicalBaseline({
    documentType: "TEST",
    baselineVersion: "v1.0",
    activeSnapshotId: pair.active.snapshotId,
    rollbackSnapshotId: pair.rollback.snapshotId,
    activePathManifestId: "m1",
    policySetVersion: "p1",
    routingRuleVersion: "r1",
    authorityRegistryVersion: "a1",
    freezeReason: "rs test",
    performedBy: "tester",
  });

  createAuthorityLine("line-rs", "auth-A", baseline.baselineId, "tester", "corr-rs");

  return { pair: pair, baseline: baseline };
}

function setupRecoveryScenario() {
  var scenario = createFullScenario();

  // Create incident to enter lockdown
  var incident = escalateIncident(
    "RECOVERY_STAGE_FAILED",
    "corr-rs",
    "tester",
    "test incident for recovery"
  );

  // Acknowledge the incident so preconditions pass
  acknowledgeIncident(incident.incidentId, "tester");

  // Activate mutation freeze (rollback precheck requires this)
  activateMutationFreeze();

  return scenario;
}

// ── Suite ──

describe("P4 Slice 1 — Recovery Coordinator Sync Read Shutdown", function () {
  beforeEach(function () {
    setupAll();
  });

  it("RS1: validateRecovery uses getCanonicalBaselineFromRepo (RECOVERY_SYNC_READ_REMOVED)", async function () {
    var scenario = setupRecoveryScenario();

    // Wait for dual-write propagation
    await new Promise(function (r) { setTimeout(r, 100); });
    _resetDiagnostics();

    var reqResult = requestRecovery({
      actor: "tester",
      reason: "rs1 test",
      correlationId: "corr-rs1",
      baselineId: scenario.baseline.baselineId,
      lifecycleState: "INCIDENT_LOCKDOWN",
    });

    expect(reqResult.success).toBe(true);
    _resetDiagnostics();

    var valResult = await validateRecovery(reqResult.recoveryId);

    // Should have RECOVERY_SYNC_READ_REMOVED for baseline lookup
    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "RECOVERY_SYNC_READ_REMOVED"
        && d.moduleName === "recovery-coordinator"
        && d.reasonCode.includes("validateRecovery:getCanonicalBaseline");
    });
    expect(removedDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("RS2: executeRecoveryStages uses getCanonicalBaselineFromRepo (RECOVERY_SYNC_READ_REMOVED)", async function () {
    var scenario = setupRecoveryScenario();
    await new Promise(function (r) { setTimeout(r, 100); });

    var reqResult = requestRecovery({
      actor: "tester",
      reason: "rs2 test",
      correlationId: "corr-rs2",
      baselineId: scenario.baseline.baselineId,
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(reqResult.success).toBe(true);

    var valResult = await validateRecovery(reqResult.recoveryId);
    expect(valResult.success).toBe(true);
    _resetDiagnostics();

    var execResult = await executeRecoveryAsync(reqResult.recoveryId);

    // Should have RECOVERY_SYNC_READ_REMOVED for executeRecoveryStages baseline
    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "RECOVERY_SYNC_READ_REMOVED"
        && d.reasonCode.includes("executeRecoveryStages:getCanonicalBaseline");
    });
    expect(removedDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("RS3: RESTORE_RECONCILE stage uses getSnapshotFromRepo (RECOVERY_SYNC_READ_REMOVED)", async function () {
    var scenario = setupRecoveryScenario();
    await new Promise(function (r) { setTimeout(r, 100); });

    var reqResult = requestRecovery({
      actor: "tester",
      reason: "rs3 test",
      correlationId: "corr-rs3",
      baselineId: scenario.baseline.baselineId,
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(reqResult.success).toBe(true);

    var valResult = await validateRecovery(reqResult.recoveryId);
    expect(valResult.success).toBe(true);
    _resetDiagnostics();

    var execResult = await executeRecoveryAsync(reqResult.recoveryId);

    // Should have RECOVERY_SYNC_READ_REMOVED for snapshot in RESTORE_RECONCILE
    var snapshotDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "RECOVERY_SYNC_READ_REMOVED"
        && d.entityType === "snapshot"
        && d.reasonCode.includes("RESTORE_RECONCILE");
    });
    expect(snapshotDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("RS4: AUTHORITY_CONTINUITY_RECHECK stage uses checkAuthorityIntegrityFromRepo", async function () {
    var scenario = setupRecoveryScenario();
    await new Promise(function (r) { setTimeout(r, 100); });

    var reqResult = requestRecovery({
      actor: "tester",
      reason: "rs4 test",
      correlationId: "corr-rs4",
      baselineId: scenario.baseline.baselineId,
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(reqResult.success).toBe(true);

    var valResult = await validateRecovery(reqResult.recoveryId);
    expect(valResult.success).toBe(true);
    _resetDiagnostics();

    var execResult = await executeRecoveryAsync(reqResult.recoveryId);

    // Should have RECOVERY_SYNC_READ_REMOVED for authority in AUTHORITY_CONTINUITY_RECHECK
    var authorityDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "RECOVERY_SYNC_READ_REMOVED"
        && d.entityType === "authority"
        && d.reasonCode.includes("AUTHORITY_CONTINUITY_RECHECK");
    });
    expect(authorityDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("RS5: verifyRecovery uses all 4 repo-first replacements", async function () {
    var scenario = setupRecoveryScenario();
    await new Promise(function (r) { setTimeout(r, 100); });

    var reqResult = requestRecovery({
      actor: "tester",
      reason: "rs5 test",
      correlationId: "corr-rs5",
      baselineId: scenario.baseline.baselineId,
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(reqResult.success).toBe(true);

    var valResult = await validateRecovery(reqResult.recoveryId);
    expect(valResult.success).toBe(true);

    var execResult = await executeRecoveryAsync(reqResult.recoveryId);
    _resetDiagnostics();

    var verification = await verifyRecovery(reqResult.recoveryId);

    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "RECOVERY_SYNC_READ_REMOVED";
    });

    // Should have removals for: incidents, baseline, snapshot, authority
    var incidentRemoved = removedDiags.some(function (d) {
      return d.reasonCode.includes("verifyRecovery:hasUnacknowledgedIncidents");
    });
    var baselineRemoved = removedDiags.some(function (d) {
      return d.reasonCode.includes("verifyRecovery:getCanonicalBaseline");
    });
    var snapshotRemoved = removedDiags.some(function (d) {
      return d.reasonCode.includes("verifyRecovery:getSnapshot");
    });
    var authorityRemoved = removedDiags.some(function (d) {
      return d.reasonCode.includes("verifyRecovery:checkAuthorityIntegrity");
    });

    expect(incidentRemoved).toBe(true);
    expect(baselineRemoved).toBe(true);
    expect(snapshotRemoved).toBe(true);
    expect(authorityRemoved).toBe(true);
  });

  it("RS6: emitRecoveryAudit fires async repo-first baseline lookup", async function () {
    var scenario = setupRecoveryScenario();
    await new Promise(function (r) { setTimeout(r, 100); });
    _resetDiagnostics();

    // requestRecovery calls emitRecoveryAudit which is fire-and-forget async
    var reqResult = requestRecovery({
      actor: "tester",
      reason: "rs6 test",
      correlationId: "corr-rs6",
      baselineId: scenario.baseline.baselineId,
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(reqResult.success).toBe(true);

    // Wait for fire-and-forget to complete
    await new Promise(function (r) { setTimeout(r, 200); });

    // emitRecoveryAuditAsync should have emitted RECOVERY_SYNC_READ_REMOVED
    var auditDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "RECOVERY_SYNC_READ_REMOVED"
        && d.reasonCode.includes("emitRecoveryAudit:getCanonicalBaseline");
    });
    expect(auditDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("RS7: full recovery E2E emits REPO_FIRST_TRUTH_SOURCE_CONFIRMED on verify success", async function () {
    var scenario = setupRecoveryScenario();
    await new Promise(function (r) { setTimeout(r, 100); });

    var reqResult = requestRecovery({
      actor: "tester",
      reason: "rs7 test",
      correlationId: "corr-rs7",
      baselineId: scenario.baseline.baselineId,
      lifecycleState: "INCIDENT_LOCKDOWN",
    });
    expect(reqResult.success).toBe(true);

    var valResult = await validateRecovery(reqResult.recoveryId);
    expect(valResult.success).toBe(true);

    var execResult = await executeRecoveryAsync(reqResult.recoveryId);
    expect(execResult.success).toBe(true);
    _resetDiagnostics();

    var verification = await verifyRecovery(reqResult.recoveryId);
    expect(verification.passed).toBe(true);

    // Should have REPO_FIRST_TRUTH_SOURCE_CONFIRMED
    var confirmedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "REPO_FIRST_TRUTH_SOURCE_CONFIRMED";
    });
    expect(confirmedDiags.length).toBeGreaterThanOrEqual(1);
    expect(confirmedDiags[0].moduleName).toBe("recovery-coordinator");
  });
});
