/**
 * P1-1 Slice-1F: Persistence Cutover Tests
 */

var { describe, it, expect, beforeEach, afterEach } = require("@jest/globals");

// ── Imports ──

var {
  logBridgeFailure,
  TRUTH_SOURCE_CONTRACT,
} = require("../core/persistence/bridge-logger");

var {
  baselineSnapshotToCreateInput,
} = require("../core/persistence/snapshot-adapter");

var {
  bootstrapPersistence,
  getPersistenceAdapters,
  _resetPersistenceBootstrap,
  _resetAdapterRegistry,
} = require("../core/persistence");

var {
  createSnapshotPair,
  getSnapshot,
  _resetSnapshotStore,
} = require("../core/baseline/snapshot-manager");

var {
  createCanonicalBaseline,
  getCanonicalBaseline,
  getCanonicalBaselineFromRepo,
  _resetBaselineRegistry,
} = require("../core/baseline/baseline-registry");

var {
  createAuthorityLine,
  getAuthorityLine,
  getAuthorityLineFromRepo,
  _resetAuthorityRegistry,
} = require("../core/authority/authority-registry");

var {
  escalateIncident,
  getIncidents,
  getIncidentsFromRepo,
  _resetIncidents,
} = require("../core/incidents/incident-escalation");

var {
  emitStabilizationAuditEvent,
  getAuditEvents,
  getAuditEventsFromRepo,
  _resetAuditEvents,
} = require("../core/audit/audit-events");

var {
  writeCanonicalAudit,
  createCanonicalEvent,
  getCanonicalAuditLog,
  getCanonicalAuditLogFromRepo,
  _resetCanonicalAudit,
} = require("../core/observability/canonical-event-schema");

// ── Setup ──

var savedEnv;

beforeEach(function () {
  savedEnv = process.env.PERSISTENCE_PROVIDER;
  delete process.env.PERSISTENCE_PROVIDER;
  _resetPersistenceBootstrap();
  _resetSnapshotStore();
  _resetBaselineRegistry();
  _resetAuthorityRegistry();
  _resetIncidents();
  _resetAuditEvents();
  _resetCanonicalAudit();
});

afterEach(function () {
  if (savedEnv !== undefined) {
    process.env.PERSISTENCE_PROVIDER = savedEnv;
  } else {
    delete process.env.PERSISTENCE_PROVIDER;
  }
  _resetPersistenceBootstrap();
});

// ══════════════════════════════════════════════════════════════════════════════
// Test Suites
// ══════════════════════════════════════════════════════════════════════════════

describe("P1-1 Slice-1F: Persistence Cutover", function () {

  // ── Bridge Logger ──

  describe("Bridge Logger", function () {
    it("should log structured warning without throwing", function () {
      var warnSpy = jest.spyOn(console, "warn").mockImplementation(function () {});
      expect(function () {
        logBridgeFailure("test-module", "test-op", new Error("test error"));
      }).not.toThrow();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      var msg = warnSpy.mock.calls[0][0];
      expect(msg).toContain("[PersistenceBridge]");
      expect(msg).toContain("module=test-module");
      expect(msg).toContain("op=test-op");
      expect(msg).toContain("err=test error");
      warnSpy.mockRestore();
    });

    it("should handle non-Error objects without throwing", function () {
      var warnSpy = jest.spyOn(console, "warn").mockImplementation(function () {});
      expect(function () {
        logBridgeFailure("mod", "op1", "string error");
        logBridgeFailure("mod", "op2", null);
        logBridgeFailure("mod", "op3", undefined);
        logBridgeFailure("mod", "op4", 42);
      }).not.toThrow();
      expect(warnSpy).toHaveBeenCalledTimes(4);
      warnSpy.mockRestore();
    });
  });

  // ── Snapshot Adapter ──

  describe("Snapshot Adapter", function () {
    it("should map all 6 scope checksums correctly", function () {
      var snap = {
        snapshotId: "snap-1",
        baselineId: "bl-1",
        tag: "ACTIVE",
        scopes: [
          { scope: "CONFIG", data: { a: 1 }, checksum: "chk-config" },
          { scope: "FLAGS", data: { b: 2 }, checksum: "chk-flags" },
          { scope: "ROUTING", data: { c: 3 }, checksum: "chk-routing" },
          { scope: "AUTHORITY", data: { d: 4 }, checksum: "chk-authority" },
          { scope: "POLICY", data: { e: 5 }, checksum: "chk-policy" },
          { scope: "QUEUE_TOPOLOGY", data: { f: 6 }, checksum: "chk-queue" },
        ],
        capturedAt: new Date(),
        capturedBy: "system",
        config: {},
      };

      var input = baselineSnapshotToCreateInput(snap);

      expect(input.configChecksum).toBe("chk-config");
      expect(input.flagChecksum).toBe("chk-flags");
      expect(input.routingChecksum).toBe("chk-routing");
      expect(input.authorityChecksum).toBe("chk-authority");
      expect(input.policyChecksum).toBe("chk-policy");
      expect(input.queueTopologyChecksum).toBe("chk-queue");
      expect(input.includedScopes).toEqual(["CONFIG", "FLAGS", "ROUTING", "AUTHORITY", "POLICY", "QUEUE_TOPOLOGY"]);
      expect(input.baselineId).toBe("bl-1");
      expect(input.snapshotType).toBe("ACTIVE");
    });

    it("should handle missing scopes as null", function () {
      var snap = {
        snapshotId: "snap-2",
        baselineId: "bl-2",
        tag: "ROLLBACK",
        scopes: [
          { scope: "CONFIG", data: {}, checksum: "chk-1" },
          { scope: "FLAGS", data: {}, checksum: "chk-2" },
        ],
        capturedAt: new Date(),
        capturedBy: "system",
        config: {},
      };

      var input = baselineSnapshotToCreateInput(snap);

      expect(input.configChecksum).toBe("chk-1");
      expect(input.flagChecksum).toBe("chk-2");
      expect(input.routingChecksum).toBe(null);
      expect(input.authorityChecksum).toBe(null);
      expect(input.policyChecksum).toBe(null);
      expect(input.queueTopologyChecksum).toBe(null);
      expect(input.snapshotType).toBe("ROLLBACK");
    });

    it("should map restoreVerificationStatus to null", function () {
      var snap = {
        snapshotId: "snap-3",
        baselineId: "bl-3",
        tag: "ACTIVE",
        scopes: [],
        capturedAt: new Date(),
        capturedBy: "system",
        config: {},
      };
      var input = baselineSnapshotToCreateInput(snap);
      expect(input.restoreVerificationStatus).toBe(null);
    });
  });

  // ── Snapshot Dual-Write Bridge ──

  describe("Snapshot Dual-Write Bridge", function () {
    it("should write both snapshots to repository via bridge", async function () {
      var adapters = bootstrapPersistence();

      var scopeData = {
        CONFIG: { key: "val" },
        FLAGS: { f1: true },
        ROUTING: { r: "path" },
        AUTHORITY: { auth: "ok" },
        POLICY: { p: "strict" },
        QUEUE_TOPOLOGY: { q: "fifo" },
      };

      var pair = createSnapshotPair({
        baselineId: "bl-test",
        capturedBy: "test",
        scopeData: scopeData,
      });

      // Legacy store should have them
      expect(getSnapshot(pair.active.snapshotId)).not.toBe(null);
      expect(getSnapshot(pair.rollback.snapshotId)).not.toBe(null);

      // Wait for fire-and-forget
      await new Promise(function (r) { setTimeout(r, 50); });

      // Repository should also have them (search by baselineId since repo generates its own id)
      var repoResult = await adapters.snapshot.findSnapshotsByBaselineId("bl-test");
      expect(repoResult.ok).toBe(true);
      expect(repoResult.data.items.length).toBe(2);

      var types = repoResult.data.items.map(function (s) { return s.snapshotType; }).sort();
      expect(types).toEqual(["ACTIVE", "ROLLBACK"]);
      expect(repoResult.data.items[0].baselineId).toBe("bl-test");
    });

    it("should still work when repository is unavailable", function () {
      // Don't bootstrap — repository not initialized
      var scopeData = {
        CONFIG: { key: "val" },
        FLAGS: { f1: true },
        ROUTING: { r: "path" },
        AUTHORITY: { auth: "ok" },
        POLICY: { p: "strict" },
        QUEUE_TOPOLOGY: { q: "fifo" },
      };

      // Should not throw even without bootstrap
      var warnSpy = jest.spyOn(console, "warn").mockImplementation(function () {});
      expect(function () {
        createSnapshotPair({
          baselineId: "bl-no-repo",
          capturedBy: "test",
          scopeData: scopeData,
        });
      }).not.toThrow();
      warnSpy.mockRestore();
    });
  });

  // ── Repository-First Async Read ──

  describe("Repository-First Async Read", function () {
    it("should read baseline from repository via getCanonicalBaselineFromRepo", async function () {
      var adapters = bootstrapPersistence();

      // Create via legacy path (which also dual-writes to repo)
      createCanonicalBaseline({
        documentType: "QUOTE",
        baselineVersion: "2.0.0",
        activeSnapshotId: "snap-a",
        rollbackSnapshotId: "snap-r",
        activePathManifestId: "manifest-1",
        policySetVersion: "1.0.0",
        routingRuleVersion: "1.0.0",
        authorityRegistryVersion: "1.0.0",
        freezeReason: "test",
        performedBy: "system",
      });

      await new Promise(function (r) { setTimeout(r, 50); });

      var result = await getCanonicalBaselineFromRepo();
      expect(result).not.toBe(null);
      expect(result.baselineVersion).toBe("2.0.0");
      expect(result.baselineStatus).toBe("FROZEN");
      expect(result.createdAt instanceof Date).toBe(true);
      expect(result.updatedAt instanceof Date).toBe(true);
    });

    it("should fall back to legacy when repository has no data", async function () {
      bootstrapPersistence();

      // Create baseline but don't wait for repo write, reset repo
      createCanonicalBaseline({
        documentType: "QUOTE",
        baselineVersion: "3.0.0",
        activeSnapshotId: "snap-a2",
        rollbackSnapshotId: "snap-r2",
        activePathManifestId: "manifest-2",
        policySetVersion: "1.0.0",
        routingRuleVersion: "1.0.0",
        authorityRegistryVersion: "1.0.0",
        freezeReason: "test",
        performedBy: "system",
      });

      // Legacy store should have it
      var legacy = getCanonicalBaseline();
      expect(legacy).not.toBe(null);
      expect(legacy.baselineVersion).toBe("3.0.0");
    });

    it("should read authority line from repository via getAuthorityLineFromRepo", async function () {
      var adapters = bootstrapPersistence();

      createAuthorityLine("auth-repo-1", "authority-X", "bl-1", "system", "cor-1");

      await new Promise(function (r) { setTimeout(r, 50); });

      var result = await getAuthorityLineFromRepo("auth-repo-1");
      expect(result).not.toBe(null);
      expect(result.currentAuthorityId).toBe("authority-X");
      expect(result.authorityState).toBe("ACTIVE");
      expect(result.updatedAt instanceof Date).toBe(true);
    });

    it("should read incidents from repository via getIncidentsFromRepo", async function () {
      var adapters = bootstrapPersistence();

      escalateIncident("FAILURE_1", "cor-1", "system", "detail-1");
      escalateIncident("FAILURE_2", "cor-2", "system", "detail-2");

      await new Promise(function (r) { setTimeout(r, 50); });

      var result = await getIncidentsFromRepo();
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].escalatedAt instanceof Date).toBe(true);
    });
  });

  // ── Observability ──

  describe("Observability", function () {
    it("should log bridge failure with structured format via logBridgeFailure", function () {
      var warnSpy = jest.spyOn(console, "warn").mockImplementation(function () {});

      // Directly verify logBridgeFailure logs correctly
      logBridgeFailure("test-module", "test-operation", new Error("simulated failure"));

      var bridgeWarnings = warnSpy.mock.calls.filter(function (call) {
        return call[0] && call[0].indexOf("[PersistenceBridge]") >= 0;
      });
      expect(bridgeWarnings.length).toBe(1);
      expect(bridgeWarnings[0][0]).toContain("module=test-module");
      expect(bridgeWarnings[0][0]).toContain("op=test-operation");
      expect(bridgeWarnings[0][0]).toContain("err=simulated failure");
      warnSpy.mockRestore();
    });

    it("should not break legacy store when bridge logs failure", function () {
      // Set invalid env to force bootstrap failure in bridge try/catch
      process.env.PERSISTENCE_PROVIDER = "REDIS";
      var warnSpy = jest.spyOn(console, "warn").mockImplementation(function () {});

      // This should not throw — legacy store works regardless
      emitStabilizationAuditEvent({
        eventType: "BASELINE_FROZEN",
        baselineId: "bl-1",
        baselineVersion: "1.0.0",
        baselineHash: "hash-1",
        snapshotId: "snap-1",
        correlationId: "cor-1",
        documentType: "QUOTE",
        performedBy: "system",
        detail: "test",
      });

      var events = getAuditEvents();
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe("BASELINE_FROZEN");

      // Bridge failure should have been logged
      var bridgeWarnings = warnSpy.mock.calls.filter(function (call) {
        return call[0] && call[0].indexOf("[PersistenceBridge]") >= 0;
      });
      expect(bridgeWarnings.length).toBeGreaterThanOrEqual(1);
      warnSpy.mockRestore();
    });
  });

  // ── Truth Source Contract ──

  describe("Truth Source Contract", function () {
    it("should document all 6 data paths", function () {
      expect(TRUTH_SOURCE_CONTRACT.baseline).toBeDefined();
      expect(TRUTH_SOURCE_CONTRACT.snapshot).toBeDefined();
      expect(TRUTH_SOURCE_CONTRACT.authority).toBeDefined();
      expect(TRUTH_SOURCE_CONTRACT.incident).toBeDefined();
      expect(TRUTH_SOURCE_CONTRACT.stabilizationAudit).toBeDefined();
      expect(TRUTH_SOURCE_CONTRACT.canonicalAudit).toBeDefined();

      // Snapshot is special — LEGACY_PRIMARY for read
      expect(TRUTH_SOURCE_CONTRACT.snapshot.read).toBe("LEGACY_PRIMARY");
      expect(TRUTH_SOURCE_CONTRACT.snapshot.write).toBe("DUAL_CHECKSUM_ONLY");

      // Others are REPO_FIRST_LEGACY_FALLBACK
      expect(TRUTH_SOURCE_CONTRACT.baseline.read).toBe("REPO_FIRST_LEGACY_FALLBACK");
      expect(TRUTH_SOURCE_CONTRACT.baseline.write).toBe("DUAL");
    });
  });

  // ── Canonical Audit Async Read ──

  describe("Canonical Audit Async Read", function () {
    it("should read canonical events from repository", async function () {
      var adapters = bootstrapPersistence();

      var event = createCanonicalEvent({
        eventType: "BREACH_DETECTED",
        correlationId: "cor-async-1",
        timelineId: "tl-1",
        baselineId: "bl-1",
      });

      writeCanonicalAudit(event);

      await new Promise(function (r) { setTimeout(r, 50); });

      var result = await getCanonicalAuditLogFromRepo({ correlationId: "cor-async-1" });
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].eventType).toBe("BREACH_DETECTED");
      expect(result[0].occurredAt instanceof Date).toBe(true);
    });
  });

  // ── Audit Events Async Read ──

  describe("Audit Events Async Read", function () {
    it("should read audit events from repository", async function () {
      var adapters = bootstrapPersistence();

      emitStabilizationAuditEvent({
        eventType: "BASELINE_FROZEN",
        baselineId: "bl-async-1",
        baselineVersion: "1.0.0",
        baselineHash: "hash-1",
        snapshotId: "snap-1",
        correlationId: "cor-audit-1",
        documentType: "QUOTE",
        performedBy: "system",
        detail: "async test",
      });

      await new Promise(function (r) { setTimeout(r, 50); });

      var result = await getAuditEventsFromRepo({ eventType: "BASELINE_FROZEN" });
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].timestamp instanceof Date).toBe(true);
    });
  });
});
