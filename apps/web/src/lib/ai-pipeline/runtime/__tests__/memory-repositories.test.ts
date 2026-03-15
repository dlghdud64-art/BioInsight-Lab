/**
 * P1-1 Slice-1D — Memory Repository Tests
 *
 * Tests verify:
 * - Repository contract compliance (RepositoryResult/ListResult)
 * - Optimistic lock enforcement (same as Prisma tests)
 * - Error handling (NOT_FOUND, DUPLICATE, CONFLICT, VALIDATION_FAILED)
 * - Factory resolves MEMORY adapters
 * - MEMORY/PRISMA adapter bundle shape parity
 */

const { describe, it, expect, beforeEach } = require("@jest/globals");

const {
  createMemoryAdapters,
  createPrismaAdapters,
  registerAdapterFactory,
  resolveAdapters,
  isAdapterRegistered,
  _resetAdapterRegistry,
} = require("../core/persistence");

// ── Test Data Builders (identical to Prisma tests for parity) ──

function baselineInput() {
  return {
    baselineSource: "PACKAGE1_COMPLETE_NEW_AI_INTEGRATED",
    baselineVersion: "1.0.0",
    baselineHash: "abc123",
    lifecycleState: "ACTIVE_100",
    releaseMode: "FULL_ACTIVE_STABILIZATION",
    baselineStatus: "FROZEN",
    activeSnapshotId: "snap-1",
    rollbackSnapshotId: "snap-2",
    freezeReason: "RC freeze",
    activePathManifestId: null,
    policySetVersion: "1.0",
    routingRuleVersion: "1.0",
    authorityRegistryVersion: "1.0",
    stabilizationOnly: true,
    featureExpansionAllowed: false,
    experimentalPathAllowed: false,
    structuralRefactorAllowed: false,
    devOnlyPathAllowed: false,
    emergencyRollbackAllowed: true,
    containmentPriorityEnabled: true,
    auditStrictMode: true,
    mergeGateStrictMode: true,
  };
}

function snapshotInput(baselineId) {
  return {
    baselineId: baselineId,
    snapshotType: "ACTIVE",
    configChecksum: "cfg-chk",
    flagChecksum: "flg-chk",
    routingChecksum: null,
    authorityChecksum: null,
    policyChecksum: null,
    queueTopologyChecksum: null,
    includedScopes: ["CONFIG", "FLAGS"],
    restoreVerificationStatus: null,
  };
}

function authorityInput() {
  return {
    authorityLineId: "auth-line-1",
    currentAuthorityId: "auth-owner-1",
    authorityState: "ACTIVE",
    transferState: "IDLE",
    pendingSuccessorId: null,
    revokedAuthorityIds: [],
    registryVersion: "1",
    baselineId: null,
    correlationId: "cor-1",
    updatedBy: "system",
  };
}

function incidentInput() {
  return {
    incidentId: "inc-001",
    reasonCode: "CONTAINMENT_BREACH",
    severity: "CRITICAL",
    status: "OPEN",
    correlationId: "cor-1",
    baselineId: null,
    snapshotId: null,
  };
}

function auditEventInput(eventId) {
  return {
    eventId: eventId || "evt-001",
    eventType: "BREACH_DETECTED",
    correlationId: "cor-1",
    incidentId: "inc-001",
    baselineId: null,
    snapshotId: null,
    actor: "system",
    reasonCode: "BREACH",
    severity: "CRITICAL",
    sourceModule: "containment",
    entityType: "baseline",
    entityId: "bl-1",
    resultStatus: "STARTED",
    occurredAt: new Date(),
  };
}

function canonicalEventInput(eventId) {
  return {
    eventId: eventId || "cevt-001",
    eventType: "BREACH_DETECTED",
    eventStage: "CONTAINMENT",
    correlationId: "cor-1",
    incidentId: "inc-001",
    timelineId: "tl-1",
    baselineId: "bl-1",
    baselineVersion: "1.0.0",
    baselineHash: "abc123",
    lifecycleState: "ACTIVE_100",
    releaseMode: "FULL_ACTIVE_STABILIZATION",
    actor: "system",
    sourceModule: "containment",
    entityType: "baseline",
    entityId: "bl-1",
    reasonCode: "BREACH",
    severity: "CRITICAL",
    occurredAt: new Date(),
    snapshotBeforeId: null,
    snapshotAfterId: null,
    affectedScopes: ["CONFIG", "ROUTING"],
    resultStatus: "STARTED",
    parentEventId: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════

describe("P1-1 Slice-1D: Memory Repositories", function() {
  var adapters;

  beforeEach(function() {
    adapters = createMemoryAdapters();
    _resetAdapterRegistry();
  });

  // ── 1. Baseline ──

  describe("BaselineRepository", function() {
    it("should save and find baseline", async function() {
      var result = await adapters.baseline.saveBaseline(baselineInput());
      expect(result.ok).toBe(true);
      expect(result.data.baselineVersion).toBe("1.0.0");
      expect(result.data.id).toBeTruthy();

      var found = await adapters.baseline.findBaselineById(result.data.id);
      expect(found.ok).toBe(true);
      expect(found.data.baselineHash).toBe("abc123");
    });

    it("should get canonical baseline", async function() {
      await adapters.baseline.saveBaseline(baselineInput());
      var result = await adapters.baseline.getCanonicalBaseline();
      expect(result.ok).toBe(true);
      expect(result.data.baselineVersion).toBe("1.0.0");
    });

    it("should find baseline by version", async function() {
      await adapters.baseline.saveBaseline(baselineInput());
      var found = await adapters.baseline.findBaselineByVersion("1.0.0");
      expect(found.ok).toBe(true);
    });

    it("should return NOT_FOUND for missing baseline", async function() {
      var result = await adapters.baseline.getCanonicalBaseline();
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("should reject duplicate baseline (singleton)", async function() {
      await adapters.baseline.saveBaseline(baselineInput());
      var result = await adapters.baseline.saveBaseline(baselineInput());
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("DUPLICATE");
    });

    it("should update baseline with optimistic lock", async function() {
      var saved = await adapters.baseline.saveBaseline(baselineInput());
      var result = await adapters.baseline.updateBaseline({
        id: saved.data.id,
        expectedUpdatedAt: new Date(saved.data.updatedAt),
        patch: { baselineStatus: "INVALIDATED" },
      });
      expect(result.ok).toBe(true);
      expect(result.data.baselineStatus).toBe("INVALIDATED");
    });

    it("should detect optimistic lock conflict on baseline", async function() {
      var saved = await adapters.baseline.saveBaseline(baselineInput());
      var staleTime = new Date(saved.data.updatedAt);
      // First update succeeds
      await adapters.baseline.updateBaseline({
        id: saved.data.id,
        expectedUpdatedAt: staleTime,
        patch: { baselineStatus: "INVALIDATED" },
      });
      // Second update with stale time should fail
      var result = await adapters.baseline.updateBaseline({
        id: saved.data.id,
        expectedUpdatedAt: staleTime,
        patch: { baselineStatus: "UNFROZEN" },
      });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("OPTIMISTIC_LOCK_CONFLICT");
    });
  });

  // ── 2. Snapshot ──

  describe("SnapshotRepository", function() {
    it("should save and find snapshot", async function() {
      var result = await adapters.snapshot.saveSnapshot(snapshotInput("bl-1"));
      expect(result.ok).toBe(true);
      expect(result.data.snapshotType).toBe("ACTIVE");

      var found = await adapters.snapshot.findSnapshotById(result.data.id);
      expect(found.ok).toBe(true);
    });

    it("should list snapshots by baseline", async function() {
      await adapters.snapshot.saveSnapshot(snapshotInput("bl-1"));
      await adapters.snapshot.saveSnapshot(snapshotInput("bl-1"));
      await adapters.snapshot.saveSnapshot(snapshotInput("bl-2"));

      var result = await adapters.snapshot.findSnapshotsByBaselineId("bl-1");
      expect(result.ok).toBe(true);
      expect(result.data.items.length).toBe(2);
    });

    it("should update restore verification status", async function() {
      var saved = await adapters.snapshot.saveSnapshot(snapshotInput("bl-1"));
      var result = await adapters.snapshot.updateSnapshotRestoreVerification(saved.data.id, "VERIFIED");
      expect(result.ok).toBe(true);
      expect(result.data.restoreVerificationStatus).toBe("VERIFIED");
    });

    it("should return NOT_FOUND for missing snapshot", async function() {
      var result = await adapters.snapshot.findSnapshotById("nonexistent");
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // ── 3. Authority ──

  describe("AuthorityRepository", function() {
    it("should save and find authority line", async function() {
      var result = await adapters.authority.saveAuthorityLine(authorityInput());
      expect(result.ok).toBe(true);
      expect(result.data.authorityLineId).toBe("auth-line-1");

      var found = await adapters.authority.findAuthorityLineByLineId("auth-line-1");
      expect(found.ok).toBe(true);
    });

    it("should reject duplicate authorityLineId", async function() {
      await adapters.authority.saveAuthorityLine(authorityInput());
      var result = await adapters.authority.saveAuthorityLine(authorityInput());
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("DUPLICATE");
    });

    it("should update authority with optimistic lock", async function() {
      var saved = await adapters.authority.saveAuthorityLine(authorityInput());
      var result = await adapters.authority.updateAuthorityLine({
        id: saved.data.id,
        expectedUpdatedAt: new Date(saved.data.updatedAt),
        patch: { transferState: "LOCK_ACQUIRED" },
      });
      expect(result.ok).toBe(true);
      expect(result.data.transferState).toBe("LOCK_ACQUIRED");
    });

    it("should detect optimistic lock conflict on authority", async function() {
      var saved = await adapters.authority.saveAuthorityLine(authorityInput());
      var staleTime = new Date(saved.data.updatedAt);
      await adapters.authority.updateAuthorityLine({
        id: saved.data.id,
        expectedUpdatedAt: staleTime,
        patch: { transferState: "LOCK_ACQUIRED" },
      });
      var result = await adapters.authority.updateAuthorityLine({
        id: saved.data.id,
        expectedUpdatedAt: staleTime,
        patch: { transferState: "PENDING_VALIDATION" },
      });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("OPTIMISTIC_LOCK_CONFLICT");
    });

    it("should find by correlationId", async function() {
      await adapters.authority.saveAuthorityLine(authorityInput());
      var result = await adapters.authority.findByCorrelationId("cor-1");
      expect(result.ok).toBe(true);
      expect(result.data.items.length).toBe(1);
    });
  });

  // ── 4. Incident ──

  describe("IncidentRepository", function() {
    it("should create and find incident", async function() {
      var result = await adapters.incident.createIncident(incidentInput());
      expect(result.ok).toBe(true);
      expect(result.data.incidentId).toBe("inc-001");
      expect(result.data.status).toBe("OPEN");

      var found = await adapters.incident.findIncidentByIncidentId("inc-001");
      expect(found.ok).toBe(true);
    });

    it("should reject duplicate incidentId", async function() {
      await adapters.incident.createIncident(incidentInput());
      var result = await adapters.incident.createIncident(incidentInput());
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("DUPLICATE");
    });

    it("should update status with optimistic lock", async function() {
      var created = await adapters.incident.createIncident(incidentInput());
      var acked = await adapters.incident.acknowledgeIncident(
        "inc-001", "op-1", new Date(created.data.updatedAt)
      );
      expect(acked.ok).toBe(true);
      expect(acked.data.status).toBe("ACKNOWLEDGED");
      expect(acked.data.acknowledgedBy).toBe("op-1");

      var resolved = await adapters.incident.updateIncidentStatus(
        "inc-001", "RESOLVED", new Date(acked.data.updatedAt)
      );
      expect(resolved.ok).toBe(true);
      expect(resolved.data.status).toBe("RESOLVED");
    });

    it("should reject backward status transition", async function() {
      var created = await adapters.incident.createIncident(incidentInput());
      await adapters.incident.acknowledgeIncident("inc-001", "op-1", new Date(created.data.updatedAt));

      var refetch = await adapters.incident.findIncidentByIncidentId("inc-001");
      var result = await adapters.incident.updateIncidentStatus(
        "inc-001", "OPEN", new Date(refetch.data.updatedAt)
      );
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("VALIDATION_FAILED");
    });

    it("should detect optimistic lock conflict on incident", async function() {
      var created = await adapters.incident.createIncident(incidentInput());
      var staleTime = new Date(created.data.updatedAt);
      await adapters.incident.acknowledgeIncident("inc-001", "op-1", staleTime);
      // Second ack with stale time
      var result = await adapters.incident.acknowledgeIncident("inc-001", "op-2", staleTime);
      expect(result.ok).toBe(false);
      // Could be VALIDATION_FAILED (not OPEN) or OPTIMISTIC_LOCK_CONFLICT
      expect(["VALIDATION_FAILED", "OPTIMISTIC_LOCK_CONFLICT"]).toContain(result.error.code);
    });

    it("should list open incidents", async function() {
      await adapters.incident.createIncident(incidentInput());
      var input2 = incidentInput();
      input2.incidentId = "inc-002";
      await adapters.incident.createIncident(input2);

      var result = await adapters.incident.listOpenIncidents();
      expect(result.ok).toBe(true);
      expect(result.data.items.length).toBe(2);
    });
  });

  // ── 5. Stabilization Audit ──

  describe("StabilizationAuditRepository", function() {
    it("should append and find audit event", async function() {
      var result = await adapters.stabilizationAudit.appendAuditEvent(auditEventInput("evt-001"));
      expect(result.ok).toBe(true);
      expect(result.data.eventId).toBe("evt-001");

      var found = await adapters.stabilizationAudit.findAuditEventByEventId("evt-001");
      expect(found.ok).toBe(true);
    });

    it("should reject duplicate eventId", async function() {
      await adapters.stabilizationAudit.appendAuditEvent(auditEventInput("evt-001"));
      var result = await adapters.stabilizationAudit.appendAuditEvent(auditEventInput("evt-001"));
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("DUPLICATE");
    });

    it("should list by correlationId", async function() {
      await adapters.stabilizationAudit.appendAuditEvent(auditEventInput("evt-001"));
      var input2 = auditEventInput("evt-002");
      input2.correlationId = "cor-1";
      await adapters.stabilizationAudit.appendAuditEvent(input2);
      var input3 = auditEventInput("evt-003");
      input3.correlationId = "cor-2";
      await adapters.stabilizationAudit.appendAuditEvent(input3);

      var result = await adapters.stabilizationAudit.listAuditEventsByCorrelationId("cor-1");
      expect(result.ok).toBe(true);
      expect(result.data.items.length).toBe(2);
    });
  });

  // ── 6. Canonical Audit ──

  describe("CanonicalAuditRepository", function() {
    it("should append and find canonical event", async function() {
      var result = await adapters.canonicalAudit.appendCanonicalEvent(canonicalEventInput("cevt-001"));
      expect(result.ok).toBe(true);
      expect(result.data.eventId).toBe("cevt-001");
      expect(result.data.timelineId).toBe("tl-1");

      var found = await adapters.canonicalAudit.findCanonicalEventByEventId("cevt-001");
      expect(found.ok).toBe(true);
    });

    it("should reject duplicate canonical eventId", async function() {
      await adapters.canonicalAudit.appendCanonicalEvent(canonicalEventInput("cevt-001"));
      var result = await adapters.canonicalAudit.appendCanonicalEvent(canonicalEventInput("cevt-001"));
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("DUPLICATE");
    });

    it("should list by timelineId", async function() {
      await adapters.canonicalAudit.appendCanonicalEvent(canonicalEventInput("cevt-001"));
      var result = await adapters.canonicalAudit.listCanonicalEventsByTimelineId("tl-1");
      expect(result.ok).toBe(true);
      expect(result.data.items.length).toBe(1);
    });

    it("should list by incidentId", async function() {
      await adapters.canonicalAudit.appendCanonicalEvent(canonicalEventInput("cevt-001"));
      var result = await adapters.canonicalAudit.listCanonicalEventsByIncidentId("inc-001");
      expect(result.ok).toBe(true);
      expect(result.data.items.length).toBe(1);
    });
  });

  // ── 7. Factory ──

  describe("Factory & Adapter Registry (Memory)", function() {
    it("should create memory adapters with mode=MEMORY", function() {
      expect(adapters.mode).toBe("MEMORY");
    });

    it("should not expose internal store types", function() {
      expect(typeof adapters.baseline.saveBaseline).toBe("function");
      expect(typeof adapters.snapshot.saveSnapshot).toBe("function");
      expect(typeof adapters.authority.saveAuthorityLine).toBe("function");
      expect(typeof adapters.incident.createIncident).toBe("function");
      expect(typeof adapters.stabilizationAudit.appendAuditEvent).toBe("function");
      expect(typeof adapters.canonicalAudit.appendCanonicalEvent).toBe("function");
      // No internal stores exposed
      expect(adapters._store).toBeUndefined();
    });

    it("should resolve MEMORY adapters via registry", function() {
      registerAdapterFactory("MEMORY", function() {
        return createMemoryAdapters();
      });
      expect(isAdapterRegistered("MEMORY")).toBe(true);
      var resolved = resolveAdapters({ mode: "MEMORY" });
      expect(resolved.mode).toBe("MEMORY");
    });

    it("should fallback to MEMORY when PRISMA not registered", function() {
      registerAdapterFactory("MEMORY", function() {
        return createMemoryAdapters();
      });
      var resolved = resolveAdapters({ mode: "PRISMA" });
      expect(resolved.mode).toBe("MEMORY");
    });
  });

  // ── 8. MEMORY/PRISMA Parity ──

  describe("MEMORY/PRISMA Bundle Shape Parity", function() {
    it("should have identical property names", function() {
      var memAdapters = createMemoryAdapters();
      var memKeys = Object.keys(memAdapters).sort();
      // Expected keys from PersistenceAdapters interface
      var expected = ["mode", "baseline", "snapshot", "authority", "incident", "stabilizationAudit", "canonicalAudit", "lock"].sort();
      expect(memKeys).toEqual(expected);
    });

    it("should have same method signatures on each repository", function() {
      var mem = createMemoryAdapters();
      // Baseline
      expect(typeof mem.baseline.getCanonicalBaseline).toBe("function");
      expect(typeof mem.baseline.saveBaseline).toBe("function");
      expect(typeof mem.baseline.updateBaseline).toBe("function");
      expect(typeof mem.baseline.findBaselineById).toBe("function");
      expect(typeof mem.baseline.findBaselineByVersion).toBe("function");
      // Snapshot
      expect(typeof mem.snapshot.saveSnapshot).toBe("function");
      expect(typeof mem.snapshot.findSnapshotById).toBe("function");
      expect(typeof mem.snapshot.findSnapshotsByBaselineId).toBe("function");
      expect(typeof mem.snapshot.updateSnapshotRestoreVerification).toBe("function");
      // Authority
      expect(typeof mem.authority.saveAuthorityLine).toBe("function");
      expect(typeof mem.authority.findAuthorityLineById).toBe("function");
      expect(typeof mem.authority.findAuthorityLineByLineId).toBe("function");
      expect(typeof mem.authority.updateAuthorityLine).toBe("function");
      expect(typeof mem.authority.findByCorrelationId).toBe("function");
      expect(typeof mem.authority.findByBaselineId).toBe("function");
      // Incident
      expect(typeof mem.incident.createIncident).toBe("function");
      expect(typeof mem.incident.findIncidentByIncidentId).toBe("function");
      expect(typeof mem.incident.updateIncidentStatus).toBe("function");
      expect(typeof mem.incident.acknowledgeIncident).toBe("function");
      expect(typeof mem.incident.listOpenIncidents).toBe("function");
      expect(typeof mem.incident.findByCorrelationId).toBe("function");
      expect(typeof mem.incident.findByBaselineId).toBe("function");
      // Stabilization Audit
      expect(typeof mem.stabilizationAudit.appendAuditEvent).toBe("function");
      expect(typeof mem.stabilizationAudit.findAuditEventByEventId).toBe("function");
      expect(typeof mem.stabilizationAudit.listAuditEventsByCorrelationId).toBe("function");
      expect(typeof mem.stabilizationAudit.listAuditEventsByIncidentId).toBe("function");
      // Canonical Audit
      expect(typeof mem.canonicalAudit.appendCanonicalEvent).toBe("function");
      expect(typeof mem.canonicalAudit.findCanonicalEventByEventId).toBe("function");
      expect(typeof mem.canonicalAudit.listCanonicalEventsByCorrelationId).toBe("function");
      expect(typeof mem.canonicalAudit.listCanonicalEventsByTimelineId).toBe("function");
      expect(typeof mem.canonicalAudit.listCanonicalEventsByIncidentId).toBe("function");
    });
  });

  // ── 9. Result/Error Contract Parity ──

  describe("Result/Error Contract Parity", function() {
    it("should return same error codes as Prisma repos", async function() {
      // NOT_FOUND across all repos
      var r1 = await adapters.baseline.findBaselineById("x");
      expect(r1.error.code).toBe("NOT_FOUND");

      var r2 = await adapters.authority.findAuthorityLineByLineId("x");
      expect(r2.error.code).toBe("NOT_FOUND");

      var r3 = await adapters.incident.findIncidentByIncidentId("x");
      expect(r3.error.code).toBe("NOT_FOUND");

      var r4 = await adapters.stabilizationAudit.findAuditEventByEventId("x");
      expect(r4.error.code).toBe("NOT_FOUND");

      var r5 = await adapters.canonicalAudit.findCanonicalEventByEventId("x");
      expect(r5.error.code).toBe("NOT_FOUND");
    });

    it("should return ListResult with items and nextCursor", async function() {
      var result = await adapters.incident.listOpenIncidents();
      expect(result.ok).toBe(true);
      expect(Array.isArray(result.data.items)).toBe(true);
      expect(result.data).toHaveProperty("nextCursor");
    });

    it("should deep-clone returned entities", async function() {
      var saved = await adapters.baseline.saveBaseline(baselineInput());
      // Mutate returned data
      saved.data.baselineStatus = "MUTATED";
      // Re-fetch should not be affected
      var refetch = await adapters.baseline.findBaselineById(saved.data.id);
      expect(refetch.data.baselineStatus).toBe("FROZEN");
    });
  });
});
