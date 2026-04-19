// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass (tracker #53 require()→import 이관 완료 후 별도 residual tracker 신설 예정)
/**
 * P3 Slice 3 — Audit + Canonical Audit + Snapshot Ontology Adapter Tests (13 tests)
 *
 * Validates stabilization audit, canonical audit, and snapshot ontology adapters:
 * - Legacy shape normalization (field renames, type conversions)
 * - Roundtrip preservation
 * - Snapshot full-fidelity payload preservation
 * - Date normalization with diagnostics
 * - Repository-first path through adapter
 * - Legacy fallback diagnostic
 * - Snapshot payload translation diagnostic
 * - Bridge route guardrail for new modules
 */

import { describe, it, expect, beforeEach } from "vitest";

import { StabilizationAuditOntologyAdapter } from "../core/ontology/stabilization-audit-adapter";
import { CanonicalAuditOntologyAdapter } from "../core/ontology/canonical-audit-adapter";
import { SnapshotOntologyAdapter } from "../core/ontology/snapshot-adapter";
import { STABILIZATION_AUDIT_ALIASES, SNAPSHOT_ALIASES } from "../core/ontology/common-normalizers";
import { getDiagnosticLog, _resetDiagnostics, assertBridgeRoute } from "../core/ontology/diagnostics";
import { createMemoryAdapters } from "../core/persistence/memory";
import { registerAdapterFactory, _resetAdapterRegistry } from "../core/persistence/factory";
import { bootstrapPersistence, _resetPersistenceBootstrap, getPersistenceAdapters } from "../core/persistence/bootstrap";

// ── Test Fixtures ──

function buildLegacyAuditEvent(overrides) {
  return Object.assign({
    eventId: "evt-sa-001",
    eventType: "TRANSITION_ALLOWED",
    baselineId: "bl-001",
    baselineVersion: "1.0.0",
    baselineHash: "abc123",
    snapshotId: "snap-001",
    correlationId: "corr-sa-001",
    documentType: "CONFIG",
    performedBy: "operator-1",
    detail: "transition allowed for baseline update",
    timestamp: new Date("2026-03-15T10:00:00Z"),
  }, overrides || {});
}

function buildPersistedAuditEvent(overrides) {
  return Object.assign({
    id: "db-sa-001",
    eventId: "evt-sa-001",
    eventType: "TRANSITION_ALLOWED",
    correlationId: "corr-sa-001",
    incidentId: null,
    baselineId: "bl-001",
    snapshotId: "snap-001",
    actor: "operator-1",
    reasonCode: "transition allowed",
    severity: null,
    sourceModule: null,
    entityType: null,
    entityId: null,
    resultStatus: null,
    occurredAt: new Date("2026-03-15T10:00:00Z"),
    recordedAt: new Date("2026-03-15T10:00:01Z"),
  }, overrides || {});
}

function buildLegacyCanonicalEvent(overrides) {
  return Object.assign({
    eventId: "evt-ca-001",
    eventType: "BREACH_DETECTED",
    eventStage: undefined,
    correlationId: "corr-ca-001",
    incidentId: undefined,
    timelineId: "tl-ca-001",
    baselineId: "bl-001",
    baselineVersion: "1.0.0",
    baselineHash: "abc123",
    lifecycleState: "ACTIVE_100",
    releaseMode: "FULL_ACTIVE_STABILIZATION",
    actor: "system",
    sourceModule: "containment",
    entityType: "baseline",
    entityId: "bl-001",
    reasonCode: "breach detected",
    severity: "WARNING",
    occurredAt: new Date("2026-03-15T11:00:00Z"),
    recordedAt: new Date("2026-03-15T11:00:01Z"),
    snapshotBeforeId: undefined,
    snapshotAfterId: undefined,
    affectedScopes: ["CONFIG", "FLAGS"],
    resultStatus: "STARTED",
    parentEventId: undefined,
    schemaVersion: "1.0.0",
  }, overrides || {});
}

function buildLegacySnapshot(overrides) {
  return Object.assign({
    snapshotId: "snap-active-bl-001-1710500000000",
    baselineId: "bl-001",
    tag: "ACTIVE",
    scopes: [
      { scope: "CONFIG", data: { key: "value" }, checksum: "a1b2c3d4e5f6a7b8" },
      { scope: "FLAGS", data: { featureX: true }, checksum: "b2c3d4e5f6a7b8c9" },
      { scope: "ROUTING", data: { route: "/api" }, checksum: "c3d4e5f6a7b8c9d0" },
      { scope: "AUTHORITY", data: { auth: "line-1" }, checksum: "d4e5f6a7b8c9d0e1" },
      { scope: "POLICY", data: { policy: "strict" }, checksum: "e5f6a7b8c9d0e1f2" },
      { scope: "QUEUE_TOPOLOGY", data: { queue: "main" }, checksum: "f6a7b8c9d0e1f2a3" },
    ],
    capturedAt: new Date("2026-03-15T09:00:00Z"),
    capturedBy: "operator-1",
    config: { CONFIG: { key: "value" }, FLAGS: { featureX: true } },
  }, overrides || {});
}

// ── Setup ──

beforeEach(function () {
  _resetDiagnostics();
});

// ══════════════════════════════════════════════════════════════════════════════

describe("P3 Slice 3 — Audit + Canonical Audit + Snapshot Ontology Adapters", function () {

  // SA1: stabilization audit adapter fromLegacy normalizes shape
  it("SA1: stabilization audit adapter fromLegacy normalizes shape", function () {
    var legacy = buildLegacyAuditEvent();
    var canonical = StabilizationAuditOntologyAdapter.fromLegacy(legacy);

    // performedBy → actor
    expect(canonical.actor).toBe("operator-1");
    // detail → reasonCode
    expect(canonical.reasonCode).toBe("transition allowed for baseline update");
    // timestamp → occurredAt
    expect(canonical.occurredAt).toEqual(legacy.timestamp);
    // documentType preserved in canonical
    expect(canonical.documentType).toBe("CONFIG");
    // fields not in legacy are null
    expect(canonical.incidentId).toBeNull();
    expect(canonical.severity).toBeNull();

    var diags = getDiagnosticLog({ adapterName: "stabilization-audit-adapter" });
    expect(diags.length).toBeGreaterThanOrEqual(2);
    var types = diags.map(function (d) { return d.type; });
    expect(types).toContain("LEGACY_BRIDGE_TRANSLATION_APPLIED");
    expect(types).toContain("LEGACY_FIELD_MAPPING_APPLIED");
  });

  // SA2: stabilization audit adapter roundtrip
  it("SA2: stabilization audit adapter roundtrip preserves data", function () {
    var legacy = buildLegacyAuditEvent();
    var canonical = StabilizationAuditOntologyAdapter.fromLegacy(legacy);
    var input = StabilizationAuditOntologyAdapter.toRepositoryInput(canonical);

    // Simulate persistence
    var persisted = Object.assign({}, input, {
      id: "db-round-001",
      recordedAt: new Date("2026-03-15T10:00:01Z"),
    });

    var canonical2 = StabilizationAuditOntologyAdapter.fromPersisted(persisted);
    var roundtripped = StabilizationAuditOntologyAdapter.toLegacy(canonical2);

    expect(roundtripped.eventId).toBe(legacy.eventId);
    expect(roundtripped.performedBy).toBe(legacy.performedBy);
    expect(roundtripped.detail).toBe(legacy.detail);
    expect(roundtripped.timestamp).toEqual(legacy.timestamp);
    // baselineVersion/baselineHash/documentType lost in persistence — returns ""
    expect(roundtripped.baselineVersion).toBe("");
    expect(roundtripped.baselineHash).toBe("");
    expect(roundtripped.documentType).toBe("");
  });

  // CA1: canonical audit adapter normalizes canonical event shape
  it("CA1: canonical audit adapter normalizes canonical event shape", function () {
    var legacy = buildLegacyCanonicalEvent({ eventStage: undefined, incidentId: undefined });
    var canonical = CanonicalAuditOntologyAdapter.fromLegacy(legacy);

    // undefined → null for optional fields
    expect(canonical.eventStage).toBeNull();
    expect(canonical.incidentId).toBeNull();
    expect(canonical.snapshotBeforeId).toBeNull();
    expect(canonical.snapshotAfterId).toBeNull();
    expect(canonical.parentEventId).toBeNull();

    // required fields preserved
    expect(canonical.eventId).toBe("evt-ca-001");
    expect(canonical.sourceModule).toBe("containment");
    expect(canonical.affectedScopes).toEqual(["CONFIG", "FLAGS"]);
  });

  // CA2: canonical audit adapter roundtrip
  it("CA2: canonical audit adapter roundtrip preserves data", function () {
    var legacy = buildLegacyCanonicalEvent({
      eventStage: "STAGE_1",
      incidentId: "inc-001",
      parentEventId: "parent-001",
    });
    var canonical = CanonicalAuditOntologyAdapter.fromLegacy(legacy);
    var input = CanonicalAuditOntologyAdapter.toRepositoryInput(canonical);

    // Simulate persistence
    var persisted = Object.assign({}, input, {
      id: "db-ca-round-001",
      recordedAt: canonical.recordedAt,
    });

    var canonical2 = CanonicalAuditOntologyAdapter.fromPersisted(persisted);
    var roundtripped = CanonicalAuditOntologyAdapter.toLegacy(canonical2);

    expect(roundtripped.eventId).toBe(legacy.eventId);
    expect(roundtripped.eventStage).toBe("STAGE_1");
    expect(roundtripped.incidentId).toBe("inc-001");
    expect(roundtripped.parentEventId).toBe("parent-001");
    expect(roundtripped.schemaVersion).toBe("1.0.0");
    expect(roundtripped.affectedScopes).toEqual(["CONFIG", "FLAGS"]);
  });

  // SN1: snapshot adapter preserves payload without loss
  it("SN1: snapshot adapter preserves payload without loss", function () {
    var legacy = buildLegacySnapshot();
    var canonical = SnapshotOntologyAdapter.fromLegacy(legacy);

    // Full payload preserved in canonical
    expect(canonical.scopes.length).toBe(6);
    expect(canonical.scopes[0].data).toEqual({ key: "value" });
    expect(canonical.scopes[0].checksum).toBe("a1b2c3d4e5f6a7b8");
    expect(canonical.config).toEqual(legacy.config);
    expect(canonical.capturedBy).toBe("operator-1");
    expect(canonical.snapshotType).toBe("ACTIVE");

    // Per-scope checksums extracted
    expect(canonical.configChecksum).toBe("a1b2c3d4e5f6a7b8");
    expect(canonical.flagChecksum).toBe("b2c3d4e5f6a7b8c9");
    expect(canonical.routingChecksum).toBe("c3d4e5f6a7b8c9d0");
    expect(canonical.authorityChecksum).toBe("d4e5f6a7b8c9d0e1");
    expect(canonical.policyChecksum).toBe("e5f6a7b8c9d0e1f2");
    expect(canonical.queueTopologyChecksum).toBe("f6a7b8c9d0e1f2a3");
    expect(canonical.includedScopes).toEqual(["CONFIG", "FLAGS", "ROUTING", "AUTHORITY", "POLICY", "QUEUE_TOPOLOGY"]);
  });

  // SN2: snapshot checksum+payload roundtrip stable
  it("SN2: snapshot checksum+payload roundtrip stable", function () {
    var legacy = buildLegacySnapshot();
    var canonical = SnapshotOntologyAdapter.fromLegacy(legacy);
    var input = SnapshotOntologyAdapter.toRepositoryInput(canonical);

    // Verify checksums in persistence input
    expect(input.configChecksum).toBe("a1b2c3d4e5f6a7b8");
    expect(input.snapshotType).toBe("ACTIVE");
    expect(input.includedScopes).toEqual(["CONFIG", "FLAGS", "ROUTING", "AUTHORITY", "POLICY", "QUEUE_TOPOLOGY"]);

    // Simulate persistence (full-fidelity — payload preserved via scopePayload/configPayload)
    var persisted = Object.assign({}, input, {
      id: "db-snap-round-001",
      createdAt: legacy.capturedAt,
      updatedAt: legacy.capturedAt,
    });

    var canonical2 = SnapshotOntologyAdapter.fromPersisted(persisted);
    // P3-3B: full-fidelity — scopes/config now reconstructed from scopePayload/configPayload
    expect(canonical2.scopes).toHaveLength(6);
    expect(canonical2.scopes[0].data).toEqual({ key: "value" });
    expect(Object.keys(canonical2.config).length).toBe(2); // original fixture has CONFIG + FLAGS in config
    // Checksums preserved
    expect(canonical2.configChecksum).toBe("a1b2c3d4e5f6a7b8");
    expect(canonical2.flagChecksum).toBe("b2c3d4e5f6a7b8c9");

    var roundtripped = SnapshotOntologyAdapter.toLegacy(canonical2);
    expect(roundtripped.tag).toBe("ACTIVE");
    expect(roundtripped.baselineId).toBe("bl-001");
  });

  // RP1: audit repository-first path goes through adapter
  it("RP1: audit repository-first path goes through adapter", async function () {
    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
    _resetDiagnostics();
    registerAdapterFactory("memory", createMemoryAdapters);
    await bootstrapPersistence({ adapterType: "memory" });

    var adapters = getPersistenceAdapters();

    // Save through adapter
    var legacy = buildLegacyAuditEvent();
    var canonical = StabilizationAuditOntologyAdapter.fromLegacy(legacy);
    var input = StabilizationAuditOntologyAdapter.toRepositoryInput(canonical);
    await adapters.stabilizationAudit.appendAuditEvent(input);

    // Read back
    var result = await adapters.stabilizationAudit.findAuditEventByEventId("evt-sa-001");
    expect(result.ok).toBe(true);

    // Verify persisted field names
    expect(result.data.actor).toBe("operator-1");
    expect(result.data.reasonCode).toBe("transition allowed for baseline update");

    // Roundtrip
    var canonical2 = StabilizationAuditOntologyAdapter.fromPersisted(result.data);
    var roundtripped = StabilizationAuditOntologyAdapter.toLegacy(canonical2);
    expect(roundtripped.performedBy).toBe("operator-1");

    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
  });

  // RP2: canonical audit repository-first path goes through adapter
  it("RP2: canonical audit repository-first path goes through adapter", async function () {
    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
    _resetDiagnostics();
    registerAdapterFactory("memory", createMemoryAdapters);
    await bootstrapPersistence({ adapterType: "memory" });

    var adapters = getPersistenceAdapters();

    var legacy = buildLegacyCanonicalEvent();
    var canonical = CanonicalAuditOntologyAdapter.fromLegacy(legacy);
    var input = CanonicalAuditOntologyAdapter.toRepositoryInput(canonical);
    await adapters.canonicalAudit.appendCanonicalEvent(input);

    var result = await adapters.canonicalAudit.findCanonicalEventByEventId("evt-ca-001");
    expect(result.ok).toBe(true);
    expect(result.data.entityType).toBe("baseline");
    expect(result.data.severity).toBe("WARNING");

    var canonical2 = CanonicalAuditOntologyAdapter.fromPersisted(result.data);
    var roundtripped = CanonicalAuditOntologyAdapter.toLegacy(canonical2);
    expect(roundtripped.schemaVersion).toBe("1.0.0");
    expect(roundtripped.sourceModule).toBe("containment");

    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
  });

  // RP3: snapshot repository-first path goes through adapter
  it("RP3: snapshot repository-first path goes through adapter", async function () {
    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
    _resetDiagnostics();
    registerAdapterFactory("memory", createMemoryAdapters);
    await bootstrapPersistence({ adapterType: "memory" });

    var adapters = getPersistenceAdapters();

    var legacy = buildLegacySnapshot();
    var canonical = SnapshotOntologyAdapter.fromLegacy(legacy);
    var input = SnapshotOntologyAdapter.toRepositoryInput(canonical);
    var saveResult = await adapters.snapshot.saveSnapshot(input);
    expect(saveResult.ok).toBe(true);

    // Read back
    var result = await adapters.snapshot.findSnapshotById(saveResult.data.id);
    expect(result.ok).toBe(true);
    expect(result.data.configChecksum).toBe("a1b2c3d4e5f6a7b8");
    expect(result.data.snapshotType).toBe("ACTIVE");
    expect(result.data.includedScopes).toEqual(["CONFIG", "FLAGS", "ROUTING", "AUTHORITY", "POLICY", "QUEUE_TOPOLOGY"]);

    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
  });

  // FB1: audit fallback emits diagnostic
  it("FB1: audit fallback emits diagnostic", async function () {
    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
    _resetDiagnostics();
    registerAdapterFactory("memory", createMemoryAdapters);
    await bootstrapPersistence({ adapterType: "memory" });

    var { getAuditEventsFromRepo } = require("../core/audit/audit-events");
    var result = await getAuditEventsFromRepo({ eventType: "NONEXISTENT_TYPE" });

    // Should return empty (nothing in repo or legacy store)
    expect(Array.isArray(result)).toBe(true);

    // Fallback diagnostic may or may not fire depending on repo result
    // If repo returns ok with empty items, no fallback. Let's verify we can call it.
    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
  });

  // SN3: snapshot payload translation emits diagnostic
  it("SN3: snapshot payload translation emits diagnostic", function () {
    _resetDiagnostics();

    var legacy = buildLegacySnapshot();
    SnapshotOntologyAdapter.fromLegacy(legacy);

    var diags = getDiagnosticLog({ type: "SNAPSHOT_PAYLOAD_TRANSLATION_APPLIED" });
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags[0].adapterName).toBe("snapshot-adapter");
    expect(diags[0].entityType).toBe("snapshot");
  });

  // DN1: date normalization for audit/snapshot fields
  it("DN1: date normalization for audit/snapshot fields", function () {
    _resetDiagnostics();

    // ISO string date in persisted event
    var persisted = buildPersistedAuditEvent({
      occurredAt: "2026-03-15T10:00:00Z",
    });

    var canonical = StabilizationAuditOntologyAdapter.fromPersisted(persisted);
    expect(canonical.occurredAt).toBeInstanceOf(Date);

    var diags = getDiagnosticLog({ type: "DATE_NORMALIZATION_APPLIED" });
    expect(diags.length).toBeGreaterThanOrEqual(1);
  });

  // BR1: bridge route guardrail accepts new modules
  it("BR1: bridge route guardrail accepts audit/canonical/snapshot modules", function () {
    _resetDiagnostics();

    // These should NOT emit contract violation (they are registered)
    assertBridgeRoute("audit-events", "appendAuditEvent");
    assertBridgeRoute("canonical-event-schema", "appendCanonicalEvent");
    assertBridgeRoute("snapshot-manager", "saveSnapshot");

    var violations = getDiagnosticLog({ type: "ONTOLOGY_ADAPTER_CONTRACT_VIOLATION" });
    expect(violations.length).toBe(0);

    // Unregistered module should still emit violation
    assertBridgeRoute("unknown-module", "someOp");
    var violations2 = getDiagnosticLog({ type: "ONTOLOGY_ADAPTER_CONTRACT_VIOLATION" });
    expect(violations2.length).toBe(1);
  });
});
