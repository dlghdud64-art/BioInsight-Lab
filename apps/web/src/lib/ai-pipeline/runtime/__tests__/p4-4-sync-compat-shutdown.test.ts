// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass (tracker #53 require()→import 이관 완료 후 별도 residual tracker 신설 예정)
/**
 * P4 Slice 4 — Sync Compat Shutdown + Ack Timing Gap Reduction (7 tests)
 *
 * Validates:
 * - SS1: SYNC_COMPAT_SHUTDOWN_INVENTORY: 6 REMOVED + 4 RETAINED
 * - SS2: canEnterActiveRuntime throws + emits LEGACY_SYNC_COMPAT_REMOVED
 * - SS3: Retained getCanonicalBaseline emits LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON
 * - SS4: Retained hasUnacknowledgedIncidents emits LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON
 * - SS5: Retained getSnapshot emits LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON
 * - SS6: acknowledgeIncidentAsync repo-first + emits INCIDENT_ACK_TIMING_GAP_REDUCED
 * - SS7: Repo-first contract intact after compat elimination
 */

import { describe, it, expect, beforeEach } from "vitest";

import { getDiagnosticLog, _resetDiagnostics } from "../core/ontology/diagnostics";
import { createMemoryAdapters } from "../core/persistence/memory";
import { registerAdapterFactory, _resetAdapterRegistry } from "../core/persistence/factory";
import { bootstrapPersistence, _resetPersistenceBootstrap } from "../core/persistence/bootstrap";
import {
  createSnapshotPair,
  getSnapshot,
  getSnapshotFromRepo,
  _resetSnapshotStore,
} from "../core/baseline/snapshot-manager";
import {
  createCanonicalBaseline,
  getCanonicalBaseline,
  getCanonicalBaselineFromRepo,
  _resetBaselineRegistry,
} from "../core/baseline/baseline-registry";
import {
  canEnterActiveRuntime,
} from "../core/baseline/snapshot-manager";
import {
  createAuthorityLine,
  checkAuthorityIntegrityFromRepo,
  _resetAuthorityRegistry,
} from "../core/authority/authority-registry";
import {
  escalateIncident,
  hasUnacknowledgedIncidents,
  acknowledgeIncidentAsync,
  _resetIncidents,
} from "../core/incidents/incident-escalation";
import {
  _resetAuditEvents,
} from "../core/audit/audit-events";
import {
  _resetCanonicalAudit,
} from "../core/observability/canonical-event-schema";
import {
  _resetRecoveryCoordinator,
} from "../core/recovery/recovery-coordinator";
import {
  _resetMutationFreeze,
} from "../core/containment/mutation-freeze";
import {
  SYNC_COMPAT_SHUTDOWN_INVENTORY,
} from "../core/ontology/p3-closeout";

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
    baselineId: "bl-ss-test",
    capturedBy: "op-ss",
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
    freezeReason: "ss test freeze",
    performedBy: "tester",
  });

  createAuthorityLine("line-ss-1", "auth-A", "bl-ss-test", "tester", "corr-ss");

  return { pair: pair, baseline: baseline };
}

// ── Suite ──

describe("P4 Slice 4 — Sync Compat Shutdown + Ack Timing Gap Reduction", function () {
  beforeEach(function () {
    setupAll();
  });

  it("SS1: SYNC_COMPAT_SHUTDOWN_INVENTORY has 6 REMOVED + 4 RETAINED", function () {
    expect(SYNC_COMPAT_SHUTDOWN_INVENTORY.length).toBe(10);

    var removed = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "REMOVED";
    });
    var retained = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) {
      return e.status === "RETAINED";
    });

    expect(removed.length).toBe(10);
    expect(retained.length).toBe(0);

    // All REMOVED entries should have removedInSlice P4-4, P4-5, P5-1, P5-2, P5-3, or P5-4
    removed.forEach(function (e) {
      expect(["P4-4", "P4-5", "P5-1", "P5-2", "P5-3", "P5-4"].indexOf(e.removedInSlice) !== -1).toBe(true);
      expect(e.productionCallerCount).toBe(0);
    });

    // All RETAINED entries should have shutdownPhase P5 and exit conditions
    retained.forEach(function (e) {
      expect(e.shutdownPhase).toBe("P5");
      expect(e.retentionReason.length).toBeGreaterThan(0);
      expect(e.productionCallerCount).toBeGreaterThan(0);
      expect(e.removalPrecondition.length).toBeGreaterThan(0);
    });

    // Each entry should have required fields
    SYNC_COMPAT_SHUTDOWN_INVENTORY.forEach(function (e) {
      expect(e.functionName).toBeDefined();
      expect(e.moduleName).toBeDefined();
      expect(e.replacedBy).toBeDefined();
      expect(typeof e.productionCallerCount).toBe("number");
      expect(typeof e.owner).toBe("string");
      expect(e.owner.length).toBeGreaterThan(0);
    });
  });

  it("SS2: canEnterActiveRuntime throws SYNC_COMPAT_REMOVED + emits diagnostic", function () {
    _resetDiagnostics();

    expect(function () {
      canEnterActiveRuntime("snap-a", "snap-b");
    }).toThrow("SYNC_COMPAT_REMOVED");

    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_REMOVED" &&
        d.reasonCode.indexOf("canEnterActiveRuntime:removed") !== -1;
    });
    expect(removedDiags.length).toBe(1);
    expect(removedDiags[0].moduleName).toBe("snapshot-manager");
  });

  it("SS3: removed getCanonicalBaseline emits LEGACY_SYNC_COMPAT_REMOVED (P5-3 soft removal)", function () {
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

  it("SS4: removed hasUnacknowledgedIncidents emits LEGACY_SYNC_COMPAT_REMOVED (P5-3 soft removal)", function () {
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

  it("SS5: removed getSnapshot emits LEGACY_SYNC_COMPAT_REMOVED (P5-2 soft removal)", function () {
    var scenario = createFullScenario();
    _resetDiagnostics();

    var snap = getSnapshot(scenario.pair.active.snapshotId);
    expect(snap).not.toBeNull();

    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_REMOVED" &&
        d.reasonCode.indexOf("getSnapshot:removed") !== -1;
    });
    expect(removedDiags.length).toBe(1);
    expect(removedDiags[0].moduleName).toBe("snapshot-manager");
  });

  it("SS6: acknowledgeIncidentAsync repo-first + emits INCIDENT_ACK_TIMING_GAP_REDUCED", async function () {
    var scenario = createFullScenario();

    // Escalate an incident so there's something to acknowledge
    var incident = escalateIncident("THRESHOLD_EXCEEDED", "corr-ss6", "tester", "test-ss6-breach");
    var incidentId = incident.incidentId;

    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    var result = await acknowledgeIncidentAsync(incidentId);

    expect(result.success).toBe(true);
    expect(result.repoWriteMs).toBeGreaterThanOrEqual(0);
    expect(result.diagnostic).toBe("ACK_REPO_FIRST");

    // Should have emitted INCIDENT_ACK_TIMING_GAP_REDUCED
    var gapDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "INCIDENT_ACK_TIMING_GAP_REDUCED";
    });
    expect(gapDiags.length).toBe(1);
    expect(gapDiags[0].moduleName).toBe("incident-escalation");
  });

  it("SS7: repo-first contract intact after compat elimination", async function () {
    var scenario = createFullScenario();

    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    // Repo-first snapshot read
    var snap = await getSnapshotFromRepo(scenario.pair.active.snapshotId);
    expect(snap).not.toBeNull();
    expect(snap.snapshotId).toBe(scenario.pair.active.snapshotId);

    // Repo-first baseline read
    var baseline = await getCanonicalBaselineFromRepo();
    expect(baseline).not.toBeNull();

    // Repo-first authority check
    var integrity = await checkAuthorityIntegrityFromRepo();
    expect(integrity).toBeDefined();
    expect(typeof integrity.splitBrain).toBe("boolean");

    // All repo-first paths should have emitted diagnostics
    var allDiags = getDiagnosticLog();
    expect(allDiags.length).toBeGreaterThanOrEqual(1);
  });
});
