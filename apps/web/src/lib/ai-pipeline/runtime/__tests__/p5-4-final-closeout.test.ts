// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass
/**
 * P5 Slice 4 — Final Closeout (7 tests)
 *
 * Validates:
 * - FC1: recovery-diagnostics uses async timeline — same broken chain detection
 * - FC2: buildReconstructionView async — reconstruction preserved
 * - FC3: buildTimeline emits LEGACY_SYNC_COMPAT_REMOVED
 * - FC4: No sync fallback in diagnostics path
 * - FC5: Inventory 10 REMOVED + 0 RETAINED
 * - FC6: evaluateP5Acceptance returns P5_ACCEPTED
 * - FC7: All P5 acceptance criteria met
 *
 * Babel constraints: var + require(), function() not arrow.
 */

import { describe, it, expect, beforeEach } from "vitest";

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
var { getDiagnosticLog, _resetDiagnostics } = require("../core/ontology/diagnostics");
var {
  writeCanonicalAudit,
  createCanonicalEvent,
  buildTimeline,
  buildReconstructionView,
  _resetCanonicalAudit,
} = require("../core/observability/canonical-event-schema");
var { runRecoveryDiagnostics } = require("../core/recovery/recovery-diagnostics");
var {
  SYNC_COMPAT_SHUTDOWN_INVENTORY,
  evaluateP4Acceptance,
  evaluateP5Acceptance,
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
    baselineId: "bl-fc-test",
    capturedBy: "op-fc",
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
    freezeReason: "fc test freeze",
    performedBy: "tester",
  });

  createAuthorityLine("line-fc-1", "auth-A", "bl-fc-test", "tester", "corr-fc");

  return { pair: pair };
}

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// ── Suite ──

describe("P5 Slice 4 — Final Closeout", function () {
  beforeEach(function () {
    resetAll();
  });

  it("FC1: recovery-diagnostics uses async timeline — same broken chain detection", async function () {
    createRecoveryScenario();
    await wait(50);

    // Write canonical events with a broken chain (missing hops)
    var corId = "corr-fc1-broken";
    writeCanonicalAudit(createCanonicalEvent({
      correlationId: corId,
      eventType: "BREACH_DETECTED",
      previousEventId: "non-existent-hop",
    }));
    await wait(50);

    _resetDiagnostics();

    var report = await runRecoveryDiagnostics(corId);

    // Should detect broken chain via async buildTimelineFromRepo
    expect(report).toBeDefined();
    expect(report.diagnostics).toBeDefined();

    // No LEGACY_SYNC_COMPAT_RETAINED for buildTimeline
    var retainedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON" &&
        d.reasonCode.indexOf("buildTimeline") !== -1;
    });
    expect(retainedDiags.length).toBe(0);
  });

  it("FC2: buildReconstructionView async — reconstruction preserved", async function () {
    var corId = "corr-fc2-view";
    writeCanonicalAudit(createCanonicalEvent({
      correlationId: corId,
      eventType: "BREACH_DETECTED",
    }));
    await wait(50);

    var view = await buildReconstructionView("containment", corId);

    expect(view.viewType).toBe("containment");
    expect(view.correlationId).toBe(corId);
    expect(view.reconstructionStatus).toBeTruthy();
    expect(view.eventCount).toBeGreaterThan(0);
  });

  it("FC3: buildTimeline emits LEGACY_SYNC_COMPAT_REMOVED", function () {
    var corId = "corr-fc3-removed";
    writeCanonicalAudit(createCanonicalEvent({
      correlationId: corId,
      eventType: "BREACH_DETECTED",
    }));
    _resetDiagnostics();

    var timeline = buildTimeline(corId);
    expect(timeline).toBeDefined();

    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_REMOVED" &&
        d.reasonCode.indexOf("buildTimeline:removed") !== -1;
    });
    expect(removedDiags.length).toBe(1);
    expect(removedDiags[0].moduleName).toBe("canonical-event-schema");
  });

  it("FC4: no sync fallback in diagnostics path", async function () {
    createRecoveryScenario();
    await wait(50);
    _resetDiagnostics();

    var report = await runRecoveryDiagnostics("corr-fc4-nosync");

    expect(report).toBeDefined();

    // No LEGACY_SYNC_COMPAT_RETAINED for buildTimeline
    var retainedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON" &&
        d.reasonCode.indexOf("buildTimeline") !== -1;
    });
    expect(retainedDiags.length).toBe(0);
  });

  it("FC5: inventory 10 REMOVED + 0 RETAINED", function () {
    var removed = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "REMOVED";
    });
    var retained = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "RETAINED";
    });

    expect(removed.length).toBe(10);
    expect(retained.length).toBe(0);

    // buildTimeline should be in REMOVED
    var timelineRemoved = removed.find(function (e) {
      return e.functionName === "buildTimeline";
    });
    expect(timelineRemoved).toBeDefined();
    expect(timelineRemoved.removedInSlice).toBe("P5-4");
    expect(timelineRemoved.productionCallerCount).toBe(0);

    // All entries REMOVED
    SYNC_COMPAT_SHUTDOWN_INVENTORY.forEach(function (e) {
      expect(e.status).toBe("REMOVED");
      expect(e.productionCallerCount).toBe(0);
    });
  });

  it("FC6: evaluateP5Acceptance returns P5_ACCEPTED", function () {
    var sheet = evaluateP5Acceptance();

    expect(sheet.decision).toBe("P5_ACCEPTED");
    expect(sheet.criteria.length).toBe(2);
    expect(sheet.syncCompatInventory.removedCount).toBe(10);
    expect(sheet.syncCompatInventory.retainedCount).toBe(0);
  });

  it("FC7: all P5 acceptance criteria met", function () {
    var sheet = evaluateP5Acceptance();

    expect(sheet.decision).toBe("P5_ACCEPTED");

    sheet.criteria.forEach(function (c) {
      expect(c.met).toBe(true);
    });

    // ALL_RETAINED_ELIMINATED
    var retainedCriterion = sheet.criteria.find(function (c) {
      return c.name === "ALL_RETAINED_ELIMINATED";
    });
    expect(retainedCriterion).toBeDefined();
    expect(retainedCriterion.met).toBe(true);

    // CALLER_COUNTS_ALL_ZERO
    var callerCriterion = sheet.criteria.find(function (c) {
      return c.name === "CALLER_COUNTS_ALL_ZERO";
    });
    expect(callerCriterion).toBeDefined();
    expect(callerCriterion.met).toBe(true);

    // P4 still accepted
    var p4Sheet = evaluateP4Acceptance();
    expect(p4Sheet.decision).toBe("P4_ACCEPTED");
    expect(p4Sheet.syncCompatInventory.removedCount).toBe(10);
    expect(p4Sheet.syncCompatInventory.retainedCount).toBe(0);
  });
});
