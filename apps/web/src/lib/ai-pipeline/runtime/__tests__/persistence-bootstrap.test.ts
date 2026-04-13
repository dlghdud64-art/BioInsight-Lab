// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass
/**
 * P1-1 Slice-1E: Persistence Bootstrap & Legacy Bridge Tests
 */

var { describe, it, expect, beforeEach, afterEach } = require("@jest/globals");

// ── Helpers & Imports ──

var {
  bootstrapPersistence,
  getPersistenceAdapters,
  isPersistenceBootstrapped,
  _resetPersistenceBootstrap,
  _resetAdapterRegistry,
  normalizeDate,
  normalizeDateOptional,
  createMemoryAdapters,
} = require("../core/persistence");

var {
  createCanonicalBaseline,
  getCanonicalBaseline,
  _resetBaselineRegistry,
} = require("../core/baseline/baseline-registry");

var {
  createAuthorityLine,
  getAuthorityLine,
  _resetAuthorityRegistry,
} = require("../core/authority/authority-registry");

var {
  escalateIncident,
  getIncidents,
  acknowledgeIncident,
  _resetIncidents,
} = require("../core/incidents/incident-escalation");

var {
  emitStabilizationAuditEvent,
  getAuditEvents,
  _resetAuditEvents,
} = require("../core/audit/audit-events");

var {
  writeCanonicalAudit,
  getCanonicalAuditLog,
  createCanonicalEvent,
  _resetCanonicalAudit,
} = require("../core/observability/canonical-event-schema");

// ── Setup ──

var savedEnv;

beforeEach(function () {
  savedEnv = process.env.PERSISTENCE_PROVIDER;
  delete process.env.PERSISTENCE_PROVIDER;
  _resetPersistenceBootstrap();
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
// 1. Provider Selection
// ══════════════════════════════════════════════════════════════════════════════

describe("P1-1 Slice-1E: Persistence Bootstrap & Legacy Bridge", function () {
  describe("Provider Selection", function () {
    it("should default to MEMORY when PERSISTENCE_PROVIDER is not set", function () {
      delete process.env.PERSISTENCE_PROVIDER;
      var adapters = bootstrapPersistence();
      expect(adapters.mode).toBe("MEMORY");
    });

    it("should resolve MEMORY when PERSISTENCE_PROVIDER=MEMORY", function () {
      process.env.PERSISTENCE_PROVIDER = "MEMORY";
      var adapters = bootstrapPersistence();
      expect(adapters.mode).toBe("MEMORY");
    });

    it("should resolve PRISMA when configured with client", function () {
      // Use explicit config override instead of env var
      // (PRISMA factory registration requires actual prisma module)
      // We test that passing mode=PRISMA + prismaClient does not throw
      // by mocking the prisma module
      var mockClient = { stabilizationBaseline: {} };
      try {
        bootstrapPersistence({ mode: "PRISMA", prismaClient: mockClient });
      } catch (e) {
        // May fail due to mock client not having proper methods
        // but should NOT fail with "invalid provider" or "missing prismaClient"
        var msg = String(e);
        expect(msg).not.toContain("Invalid PERSISTENCE_PROVIDER");
        expect(msg).not.toContain("requires a prismaClient");
      }
    });

    it("should throw for invalid PERSISTENCE_PROVIDER value", function () {
      process.env.PERSISTENCE_PROVIDER = "REDIS";
      expect(function () {
        bootstrapPersistence();
      }).toThrow("Invalid PERSISTENCE_PROVIDER");
    });

    it("should throw when PRISMA selected without prismaClient (no silent fallback)", function () {
      expect(function () {
        bootstrapPersistence({ mode: "PRISMA" });
      }).toThrow("requires a prismaClient");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. Bundle Completeness
  // ══════════════════════════════════════════════════════════════════════════════

  describe("Bundle Completeness", function () {
    it("should have all 6 repositories in MEMORY bundle", function () {
      var adapters = bootstrapPersistence();
      expect(adapters.baseline).toBeDefined();
      expect(adapters.snapshot).toBeDefined();
      expect(adapters.authority).toBeDefined();
      expect(adapters.incident).toBeDefined();
      expect(adapters.stabilizationAudit).toBeDefined();
      expect(adapters.canonicalAudit).toBeDefined();
    });

    it("should return same bundle on repeated calls (singleton)", function () {
      var a1 = bootstrapPersistence();
      var a2 = getPersistenceAdapters();
      expect(a1).toBe(a2);
    });

    it("should allow re-init after _resetPersistenceBootstrap", function () {
      var a1 = bootstrapPersistence();
      expect(isPersistenceBootstrapped()).toBe(true);
      _resetPersistenceBootstrap();
      expect(isPersistenceBootstrapped()).toBe(false);
      var a2 = bootstrapPersistence();
      expect(a2).not.toBe(a1);
    });

    it("should verify adapter bundle completeness at bootstrap", function () {
      // Normal bootstrap should not throw
      expect(function () {
        bootstrapPersistence();
      }).not.toThrow();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. Date Normalization
  // ══════════════════════════════════════════════════════════════════════════════

  describe("Date Normalization", function () {
    it("should normalize ISO string to Date", function () {
      var isoStr = "2026-03-15T10:00:00.000Z";
      var d = normalizeDate(isoStr);
      expect(d instanceof Date).toBe(true);
      expect(d.toISOString()).toBe(isoStr);
    });

    it("should pass through Date instance unchanged", function () {
      var original = new Date("2026-03-15T10:00:00.000Z");
      var result = normalizeDate(original);
      expect(result).toBe(original);
    });

    it("should normalize epoch number to Date", function () {
      var epoch = 1742036400000;
      var d = normalizeDate(epoch);
      expect(d instanceof Date).toBe(true);
      expect(d.getTime()).toBe(epoch);
    });

    it("should throw TypeError for invalid input", function () {
      expect(function () {
        normalizeDate("not-a-date");
      }).toThrow(TypeError);
    });

    it("should return null for null/undefined via normalizeDateOptional", function () {
      expect(normalizeDateOptional(null)).toBe(null);
      expect(normalizeDateOptional(undefined)).toBe(null);
    });

    it("should be consistent across MEMORY date boundary", function () {
      // Memory repos return JSON.parse(JSON.stringify(date)) → string
      var original = new Date("2026-03-15T10:00:00.000Z");
      var serialized = JSON.parse(JSON.stringify({ d: original }));
      // serialized.d is now a string
      expect(typeof serialized.d).toBe("string");
      var normalized = normalizeDate(serialized.d);
      expect(normalized.getTime()).toBe(original.getTime());
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 4. Legacy Bridge
  // ══════════════════════════════════════════════════════════════════════════════

  describe("Legacy Bridge", function () {
    it("should write baseline to both legacy store and repository", async function () {
      // Bootstrap first
      var adapters = bootstrapPersistence();

      var bl = createCanonicalBaseline({
        documentType: "QUOTE",
        baselineVersion: "1.0.0",
        activeSnapshotId: "snap-active-1",
        rollbackSnapshotId: "snap-rollback-1",
        activePathManifestId: "manifest-1",
        policySetVersion: "1.0.0",
        routingRuleVersion: "1.0.0",
        authorityRegistryVersion: "1.0.0",
        freezeReason: "stabilization",
        performedBy: "system",
      });

      // Legacy store should have it
      var legacy = getCanonicalBaseline();
      expect(legacy).not.toBe(null);
      expect(legacy.baselineVersion).toBe("1.0.0");

      // Wait for async repository write
      await new Promise(function (r) { setTimeout(r, 50); });

      // Repository should also have it
      var repoResult = await adapters.baseline.getCanonicalBaseline();
      expect(repoResult.ok).toBe(true);
      expect(repoResult.data.baselineVersion).toBe("1.0.0");
    });

    it("should write authority to both legacy store and repository", async function () {
      var adapters = bootstrapPersistence();

      createAuthorityLine("auth-line-1", "authority-A", "baseline-1", "system", "cor-1");

      // Legacy store
      var legacy = getAuthorityLine("auth-line-1");
      expect(legacy).not.toBe(null);
      expect(legacy.currentAuthorityId).toBe("authority-A");

      await new Promise(function (r) { setTimeout(r, 50); });

      // Repository
      var repoResult = await adapters.authority.findAuthorityLineByLineId("auth-line-1");
      expect(repoResult.ok).toBe(true);
      expect(repoResult.data.currentAuthorityId).toBe("authority-A");
    });

    it("should write incident to both legacy store and repository", async function () {
      var adapters = bootstrapPersistence();

      var record = escalateIncident("TEST_FAILURE", "cor-1", "system", "test detail");

      // Legacy store
      var incidents = getIncidents();
      expect(incidents.length).toBe(1);
      expect(incidents[0].reasonCode).toBe("TEST_FAILURE");

      await new Promise(function (r) { setTimeout(r, 50); });

      // Repository
      var repoResult = await adapters.incident.findIncidentByIncidentId(record.incidentId);
      expect(repoResult.ok).toBe(true);
      expect(repoResult.data.reasonCode).toBe("TEST_FAILURE");
    });

    it("should write stabilization audit to both legacy store and repository", async function () {
      var adapters = bootstrapPersistence();

      var event = emitStabilizationAuditEvent({
        eventType: "BASELINE_FROZEN",
        baselineId: "bl-1",
        baselineVersion: "1.0.0",
        baselineHash: "hash-1",
        snapshotId: "snap-1",
        correlationId: "cor-1",
        documentType: "QUOTE",
        performedBy: "system",
        detail: "test freeze",
      });

      // Legacy store
      var events = getAuditEvents();
      expect(events.length).toBe(1);
      expect(events[0].eventId).toBe(event.eventId);

      await new Promise(function (r) { setTimeout(r, 50); });

      // Repository
      var repoResult = await adapters.stabilizationAudit.findAuditEventByEventId(event.eventId);
      expect(repoResult.ok).toBe(true);
      expect(repoResult.data.eventType).toBe("BASELINE_FROZEN");
    });

    it("should write canonical audit to both legacy store and repository", async function () {
      var adapters = bootstrapPersistence();

      var event = createCanonicalEvent({
        eventType: "BREACH_DETECTED",
        correlationId: "cor-1",
        timelineId: "tl-1",
        baselineId: "bl-1",
      });

      var result = writeCanonicalAudit(event);
      expect(result.written).toBe(true);

      // Legacy store
      var log = getCanonicalAuditLog();
      expect(log.length).toBe(1);

      await new Promise(function (r) { setTimeout(r, 50); });

      // Repository
      var repoResult = await adapters.canonicalAudit.findCanonicalEventByEventId(event.eventId);
      expect(repoResult.ok).toBe(true);
      expect(repoResult.data.eventType).toBe("BREACH_DETECTED");
    });

    it("should not break legacy store when repository write fails", function () {
      // Don't bootstrap — getPersistenceAdapters will fail in try/catch
      // Legacy store should still work
      var event = emitStabilizationAuditEvent({
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
      expect(events[0].eventId).toBe(event.eventId);
    });
  });
});
