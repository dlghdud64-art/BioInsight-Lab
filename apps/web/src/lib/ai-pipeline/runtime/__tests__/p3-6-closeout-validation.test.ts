/**
 * P3 Slice 6 — Closeout Validation (6 tests)
 *
 * Validates:
 * - CL1: ontology coverage summary — all 7 entity types covered
 * - CL2: repo-first truth source acceptance criteria — all 7 criteria met
 * - CL3: legacy shutdown inventory generation — all items have required fields
 * - CL4: compat usage diagnostic aggregation — tracks compat vs repo-first
 * - CL5: direct access guardrail coverage — all 6 modules guarded
 * - CL6: P3 final acceptance evaluation — decision is ACCEPTED_WITH_DEFERRED_RISKS
 */

var { describe, it, expect, beforeEach } = require("@jest/globals");

var { getDiagnosticLog, _resetDiagnostics } = require("../core/ontology/diagnostics");
var { createMemoryAdapters } = require("../core/persistence/memory");
var { registerAdapterFactory, _resetAdapterRegistry } = require("../core/persistence/factory");
var { bootstrapPersistence, _resetPersistenceBootstrap } = require("../core/persistence/bootstrap");
var {
  createSnapshotPair,
  getSnapshot,
  getSnapshotFromRepo,
  _resetSnapshotStore,
  _assertNoDirectStoreAccess: _assertSnapshotGuard,
} = require("../core/baseline/snapshot-manager");
var {
  createCanonicalBaseline,
  getCanonicalBaseline,
  _resetBaselineRegistry,
  _assertNoDirectStoreAccess: _assertBaselineGuard,
} = require("../core/baseline/baseline-registry");
var {
  createAuthorityLine,
  checkAuthorityIntegrity,
  _resetAuthorityRegistry,
  _assertNoDirectStoreAccess: _assertAuthorityGuard,
} = require("../core/authority/authority-registry");
var {
  _resetIncidents,
  _assertNoDirectStoreAccess: _assertIncidentGuard,
} = require("../core/incidents/incident-escalation");
var {
  _resetAuditEvents,
  _assertNoDirectStoreAccess: _assertAuditGuard,
} = require("../core/audit/audit-events");
var {
  _resetCanonicalAudit,
  _assertNoDirectStoreAccess: _assertCanonicalAuditGuard,
} = require("../core/observability/canonical-event-schema");
var {
  _resetRecoveryCoordinator,
} = require("../core/recovery/recovery-coordinator");
var {
  _resetMutationFreeze,
} = require("../core/containment/mutation-freeze");

var {
  ONTOLOGY_ADAPTER_REGISTRY,
  REPO_FIRST_CONSUMER_REGISTRY,
  DEPRECATED_SYNC_REGISTRY,
  DIRECT_ACCESS_GUARDRAIL_REGISTRY,
  LEGACY_SHUTDOWN_PLAN,
  getCompatUsageSummary,
  evaluateP3Acceptance,
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

// ── Suite ──

describe("P3 Slice 6 — Closeout Validation", function () {
  beforeEach(function () {
    setupAll();
  });

  it("CL1: ontology coverage summary — all 7 entity types covered", function () {
    // Verify adapter registry covers all 7 entity types
    expect(ONTOLOGY_ADAPTER_REGISTRY.length).toBe(7);

    var entityTypes = ONTOLOGY_ADAPTER_REGISTRY.map(function (a) { return a.entityType; });
    expect(entityTypes).toContain("recovery");
    expect(entityTypes).toContain("baseline");
    expect(entityTypes).toContain("authority");
    expect(entityTypes).toContain("incident");
    expect(entityTypes).toContain("stabilization-audit");
    expect(entityTypes).toContain("canonical-audit");
    expect(entityTypes).toContain("snapshot");

    // Each adapter should have all required fields
    for (var i = 0; i < ONTOLOGY_ADAPTER_REGISTRY.length; i++) {
      var entry = ONTOLOGY_ADAPTER_REGISTRY[i];
      expect(entry.adapterName).toBeTruthy();
      expect(entry.moduleName).toBeTruthy();
      expect(entry.bridgeRoute).toBeTruthy();
    }

    // Repo-first consumers should cover all entity types
    expect(REPO_FIRST_CONSUMER_REGISTRY.length).toBeGreaterThanOrEqual(12);
    var consumerEntityTypes = new Set(
      REPO_FIRST_CONSUMER_REGISTRY.map(function (c) { return c.entityType; })
    );
    expect(consumerEntityTypes.size).toBeGreaterThanOrEqual(5);
  });

  it("CL2: repo-first truth source acceptance criteria — all 7 criteria met", function () {
    var sheet = evaluateP3Acceptance();

    // All 7 acceptance criteria should be met
    expect(sheet.acceptanceCriteria.length).toBe(7);
    for (var i = 0; i < sheet.acceptanceCriteria.length; i++) {
      var criterion = sheet.acceptanceCriteria[i];
      expect(criterion.met).toBe(true);
      expect(criterion.evidence).toBeTruthy();
    }

    // Specific criteria checks
    var criteriaNames = sheet.acceptanceCriteria.map(function (c) { return c.name; });
    expect(criteriaNames).toContain("CORE_READ_WRITE_REPO_FIRST");
    expect(criteriaNames).toContain("CANONICAL_TRANSLATION_VIA_ADAPTER");
    expect(criteriaNames).toContain("DIRECT_RAW_STORE_ACCESS_BLOCKED");
    expect(criteriaNames).toContain("COMPAT_PATHS_DEPRECATED_WITH_DIAGNOSTIC");
    expect(criteriaNames).toContain("SNAPSHOT_RESTORE_READINESS_REPO_FIRST");
    expect(criteriaNames).toContain("ALL_7_ENTITY_TYPES_BEHIND_ADAPTER");
    expect(criteriaNames).toContain("NO_BLOCKING_CONTRACT_DRIFT");

    // All slices should be passed
    for (var j = 0; j < sheet.sliceStatuses.length; j++) {
      expect(sheet.sliceStatuses[j].status).toBe("PASSED");
    }
  });

  it("CL3: legacy shutdown inventory generation — all items have required fields", function () {
    expect(LEGACY_SHUTDOWN_PLAN.length).toBeGreaterThanOrEqual(10);

    for (var i = 0; i < LEGACY_SHUTDOWN_PLAN.length; i++) {
      var item = LEGACY_SHUTDOWN_PLAN[i];
      expect(item.pathName).toBeTruthy();
      expect(item.moduleName).toBeTruthy();
      expect(item.whyStillPresent).toBeTruthy();
      expect(item.riskIfKept).toBeTruthy();
      expect(["P4", "P5"]).toContain(item.shutdownPhase);
      expect(item.shutdownPrecondition).toBeTruthy();
    }

    // Should have both P4 and P5 items
    var p4Items = LEGACY_SHUTDOWN_PLAN.filter(function (i) { return i.shutdownPhase === "P4"; });
    var p5Items = LEGACY_SHUTDOWN_PLAN.filter(function (i) { return i.shutdownPhase === "P5"; });
    expect(p4Items.length).toBeGreaterThanOrEqual(8);
    expect(p5Items.length).toBeGreaterThanOrEqual(2);

    // Deprecated sync registry should have 10 entries
    expect(DEPRECATED_SYNC_REGISTRY.length).toBe(10);
    for (var j = 0; j < DEPRECATED_SYNC_REGISTRY.length; j++) {
      var syncEntry = DEPRECATED_SYNC_REGISTRY[j];
      expect(syncEntry.functionName).toBeTruthy();
      expect(syncEntry.replacedBy).toBeTruthy();
      expect(syncEntry.diagnosticReasonCode).toContain("sync-compat");
    }
  });

  it("CL4: compat usage diagnostic aggregation — tracks compat vs repo-first", async function () {
    // Create scenario that exercises both compat and repo-first paths
    var pair = createSnapshotPair({
      baselineId: "bl-cl4",
      capturedBy: "op-cl4",
      scopeData: SCOPE_DATA,
    });
    createCanonicalBaseline({
      documentType: "TEST",
      baselineVersion: "v1.0",
      activeSnapshotId: pair.active.snapshotId,
      rollbackSnapshotId: pair.rollback.snapshotId,
      activePathManifestId: "m1",
      policySetVersion: "p1",
      routingRuleVersion: "r1",
      authorityRegistryVersion: "a1",
      freezeReason: "cl4 test",
      performedBy: "tester",
    });
    createAuthorityLine("line-cl4", "auth-A", "bl-cl4", "tester", "corr-cl4");

    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    // Exercise retained compat paths (getSnapshot + getCanonicalBaseline emit RETAINED)
    // checkAuthorityIntegrity now emits REMOVED (P5-1 soft removal)
    getSnapshot(pair.active.snapshotId);
    getCanonicalBaseline();
    checkAuthorityIntegrity();

    // Exercise repo-first paths
    await getSnapshotFromRepo(pair.active.snapshotId);

    var summary = getCompatUsageSummary();

    // Should have tracked retained compat calls (2 RETAINED + 1 REMOVED)
    expect(summary.totalSyncCompatRetained).toBeGreaterThanOrEqual(2);

    // Should have tracked repo-first usage
    expect(summary.totalRepoFirstUsed).toBeGreaterThanOrEqual(1);

    // byModule should have entries
    expect(Object.keys(summary.byModule).length).toBeGreaterThanOrEqual(2);

    // snapshot-manager should show retained compat and repo-first
    var snapshotModule = summary.byModule["snapshot-manager"];
    expect(snapshotModule).toBeDefined();
    expect(snapshotModule.syncCompatRetained).toBeGreaterThanOrEqual(1);
    expect(snapshotModule.repoFirstUsed).toBeGreaterThanOrEqual(1);
  });

  it("CL5: direct access guardrail coverage — all 6 modules guarded", function () {
    expect(DIRECT_ACCESS_GUARDRAIL_REGISTRY.length).toBe(6);

    // Verify each module's guard function actually works
    var guards = [
      { name: "snapshot-manager", fn: _assertSnapshotGuard },
      { name: "baseline-registry", fn: _assertBaselineGuard },
      { name: "authority-registry", fn: _assertAuthorityGuard },
      { name: "incident-escalation", fn: _assertIncidentGuard },
      { name: "audit-events", fn: _assertAuditGuard },
      { name: "canonical-event-schema", fn: _assertCanonicalAuditGuard },
    ];

    for (var i = 0; i < guards.length; i++) {
      var guard = guards[i];
      _resetDiagnostics();

      expect(function () {
        guard.fn("test-cl5-" + guard.name);
      }).toThrow("DIRECT_STORE_ACCESS_BLOCKED");

      // Each should emit LEGACY_DIRECT_ACCESS_BLOCKED
      var diags = getDiagnosticLog().filter(function (d) {
        return d.type === "LEGACY_DIRECT_ACCESS_BLOCKED";
      });
      expect(diags.length).toBe(1);
      expect(diags[0].reasonCode).toContain("test-cl5-" + guard.name);
    }
  });

  it("CL6: P3 final acceptance evaluation — ACCEPTED_WITH_DEFERRED_RISKS", function () {
    var sheet = evaluateP3Acceptance();

    // Decision should be ACCEPTED_WITH_DEFERRED_RISKS (legacy shutdown items remain)
    expect(sheet.decision).toBe("P3_ACCEPTED_WITH_DEFERRED_RISKS");
    expect(sheet.decisionReason).toContain("All criteria met");
    expect(sheet.decisionReason).toContain("legacy paths deferred");

    // Coverage numbers
    expect(sheet.ontologyCoverage.totalEntityTypes).toBe(7);
    expect(sheet.ontologyCoverage.coveredEntityTypes).toBe(7);
    expect(sheet.ontologyCoverage.totalRepoFirstConsumers).toBe(13);
    expect(sheet.ontologyCoverage.totalDeprecatedSyncPaths).toBe(10);
    expect(sheet.ontologyCoverage.totalDirectAccessGuardrails).toBe(6);

    // Shutdown items
    expect(sheet.legacyShutdownItemCount).toBeGreaterThanOrEqual(10);
    expect(sheet.legacyShutdownP4Count).toBeGreaterThanOrEqual(8);
    expect(sheet.legacyShutdownP5Count).toBeGreaterThanOrEqual(2);

    // All slices passed
    expect(sheet.sliceStatuses.length).toBe(6);
    for (var i = 0; i < sheet.sliceStatuses.length; i++) {
      expect(sheet.sliceStatuses[i].status).toBe("PASSED");
    }

    // evaluatedAt should be recent
    expect(sheet.evaluatedAt).toBeInstanceOf(Date);
  });
});
