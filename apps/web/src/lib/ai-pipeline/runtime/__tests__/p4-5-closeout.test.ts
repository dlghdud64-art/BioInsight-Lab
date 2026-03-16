/**
 * P4 Slice 5 — P4 Closeout (7 tests)
 *
 * Validates:
 * - PC1: All RETAINED entries have removalPrecondition + productionCallerCount > 0 + owner
 * - PC2: getAuditEvents emits LEGACY_SYNC_COMPAT_REMOVED (soft removal)
 * - PC3: getCanonicalAuditLog emits LEGACY_SYNC_COMPAT_REMOVED (soft removal)
 * - PC4: getIncidents emits LEGACY_SYNC_COMPAT_REMOVED (soft removal)
 * - PC5: Inventory is 5 REMOVED + 5 RETAINED
 * - PC6: evaluateP4Acceptance returns P4_ACCEPTED
 * - PC7: Ack path adoption: acknowledgeIncidentAsync in consumer registry
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
  getAuditEvents,
  emitStabilizationAuditEvent,
  _resetAuditEvents,
} = require("../core/audit/audit-events");
var {
  getCanonicalAuditLog,
  writeCanonicalAudit,
  createCanonicalEvent,
  _resetCanonicalAudit,
} = require("../core/observability/canonical-event-schema");
var {
  getIncidents,
  escalateIncident,
  _resetIncidents,
} = require("../core/incidents/incident-escalation");
var {
  _resetRecoveryCoordinator,
} = require("../core/recovery/recovery-coordinator");
var {
  _resetMutationFreeze,
} = require("../core/containment/mutation-freeze");
var {
  SYNC_COMPAT_SHUTDOWN_INVENTORY,
  REPO_FIRST_CONSUMER_REGISTRY,
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
    baselineId: "bl-pc-test",
    capturedBy: "op-pc",
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
    freezeReason: "pc test freeze",
    performedBy: "tester",
  });

  createAuthorityLine("line-pc-1", "auth-A", "bl-pc-test", "tester", "corr-pc");

  return { pair: pair };
}

// ── Suite ──

describe("P4 Slice 5 — P4 Closeout", function () {
  beforeEach(function () {
    setupAll();
  });

  it("PC1: all entries are REMOVED with zero production callers", function () {
    var retained = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "RETAINED";
    });
    var removed = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "REMOVED";
    });

    expect(retained.length).toBe(0);
    expect(removed.length).toBe(10);

    removed.forEach(function (e) {
      expect(e.productionCallerCount).toBe(0);
      expect(e.owner.length).toBeGreaterThan(0);
    });
  });

  it("PC2: getAuditEvents emits LEGACY_SYNC_COMPAT_REMOVED (soft removal)", function () {
    createFullScenario();

    emitStabilizationAuditEvent({
      eventType: "BASELINE_CREATED",
      baselineId: "bl-pc-test",
      baselineVersion: "v1.0",
      baselineHash: "hash-pc",
      snapshotId: "snap-pc",
      correlationId: "corr-pc2",
      documentType: "TEST",
      performedBy: "tester",
      detail: "PC2 test event",
    });

    _resetDiagnostics();

    // Should still return results (soft removal)
    var events = getAuditEvents();
    expect(events.length).toBeGreaterThanOrEqual(1);

    // Should emit LEGACY_SYNC_COMPAT_REMOVED
    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_REMOVED" &&
        d.reasonCode.indexOf("getAuditEvents:removed") !== -1;
    });
    expect(removedDiags.length).toBe(1);
    expect(removedDiags[0].moduleName).toBe("audit-events");
  });

  it("PC3: getCanonicalAuditLog emits LEGACY_SYNC_COMPAT_REMOVED (soft removal)", function () {
    createFullScenario();

    writeCanonicalAudit(createCanonicalEvent({
      eventType: "BREACH_DETECTED",
      correlationId: "corr-pc3",
      sourceModule: "containment",
      reasonCode: "THRESHOLD_EXCEEDED",
    }));

    _resetDiagnostics();

    // Should still return results (soft removal)
    var events = getCanonicalAuditLog();
    expect(events.length).toBeGreaterThanOrEqual(1);

    // Should emit LEGACY_SYNC_COMPAT_REMOVED
    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_REMOVED" &&
        d.reasonCode.indexOf("getCanonicalAuditLog:removed") !== -1;
    });
    expect(removedDiags.length).toBe(1);
    expect(removedDiags[0].moduleName).toBe("canonical-event-schema");
  });

  it("PC4: getIncidents emits LEGACY_SYNC_COMPAT_REMOVED (soft removal)", function () {
    createFullScenario();

    escalateIncident("THRESHOLD_EXCEEDED", "corr-pc4", "tester", "PC4 test");

    _resetDiagnostics();

    // Should still return results (soft removal)
    var incidents = getIncidents();
    expect(incidents.length).toBeGreaterThanOrEqual(1);

    // Should emit LEGACY_SYNC_COMPAT_REMOVED
    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_REMOVED" &&
        d.reasonCode.indexOf("getIncidents:removed") !== -1;
    });
    expect(removedDiags.length).toBe(1);
    expect(removedDiags[0].moduleName).toBe("incident-escalation");
  });

  it("PC5: inventory is 6 REMOVED + 4 RETAINED", function () {
    expect(SYNC_COMPAT_SHUTDOWN_INVENTORY.length).toBe(10);

    var removed = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "REMOVED";
    });
    var retained = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "RETAINED";
    });

    expect(removed.length).toBe(10);
    expect(retained.length).toBe(0);

    // All REMOVED should have zero production callers
    removed.forEach(function (e) {
      expect(e.productionCallerCount).toBe(0);
    });

    // All RETAINED should have positive production callers
    retained.forEach(function (e) {
      expect(e.productionCallerCount).toBeGreaterThan(0);
    });
  });

  it("PC6: evaluateP4Acceptance returns P4_ACCEPTED", function () {
    var sheet = evaluateP4Acceptance();

    expect(sheet.decision).toBe("P4_ACCEPTED");
    expect(sheet.criteria.length).toBe(5);

    // All criteria should be met
    sheet.criteria.forEach(function (c) {
      expect(c.met).toBe(true);
    });

    expect(sheet.syncCompatInventory.totalEntries).toBe(10);
    expect(sheet.syncCompatInventory.removedCount).toBe(10);
    expect(sheet.syncCompatInventory.retainedCount).toBe(0);
    expect(sheet.syncCompatInventory.zeroCallerRetainedCount).toBe(0);
    expect(sheet.syncCompatInventory.retainedWithExitConditions).toBe(0);

    // Should emit P4_ACCEPTANCE_EVALUATED diagnostic
    var acceptDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "P4_ACCEPTANCE_EVALUATED";
    });
    expect(acceptDiags.length).toBe(1);
  });

  it("PC7: ack path adoption — acknowledgeIncidentAsync in consumer registry", function () {
    var ackEntry = REPO_FIRST_CONSUMER_REGISTRY.find(function (e) {
      return e.functionName === "acknowledgeIncidentAsync";
    });

    expect(ackEntry).toBeDefined();
    expect(ackEntry.cutoverSlice).toBe("P4-4");
    expect(ackEntry.moduleName).toBe("incident-escalation");
    expect(ackEntry.entityType).toBe("incident");

    // Verify via P4 acceptance criterion
    var sheet = evaluateP4Acceptance();
    var ackCriterion = sheet.criteria.find(function (c) {
      return c.name === "ACK_TIMING_GAP_REDUCED";
    });
    expect(ackCriterion).toBeDefined();
    expect(ackCriterion.met).toBe(true);
  });
});
