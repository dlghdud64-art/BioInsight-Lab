// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass
/**
 * P3 Slice 2 — Authority + Incident Ontology Adapter Tests (12 tests)
 *
 * Validates authority + incident ontology adapters:
 * - Legacy shape normalization (field renames, type conversions)
 * - Roundtrip preservation (fromLegacy→toRepoInput→fromPersisted→toLegacy)
 * - Date normalization with diagnostics
 * - Repository-first path through adapter
 * - Legacy fallback diagnostic
 * - Alias constants
 * - Bridge route guardrail for new modules
 */

import { describe, it, expect, beforeEach } from "vitest";

var { AuthorityOntologyAdapter, toAuthorityPatch } = require("../core/ontology/authority-adapter");
var { IncidentOntologyAdapter } = require("../core/ontology/incident-adapter");
var { normalizeDateWithDiagnostic } = require("../core/ontology/date-normalizer");
var { AUTHORITY_ALIASES, INCIDENT_ALIASES } = require("../core/ontology/common-normalizers");
var { getDiagnosticLog, _resetDiagnostics, assertBridgeRoute } = require("../core/ontology/diagnostics");
var { createMemoryAdapters } = require("../core/persistence/memory");
var { registerAdapterFactory, _resetAdapterRegistry } = require("../core/persistence/factory");
var { bootstrapPersistence, _resetPersistenceBootstrap, getPersistenceAdapters } = require("../core/persistence/bootstrap");

// ── Test Fixtures ──

function buildLegacyAuthorityLine(overrides) {
  return Object.assign({
    authorityLineId: "auth-line-001",
    currentAuthorityId: "authority-A",
    authorityState: "ACTIVE",
    transferState: "TRANSFER_IDLE",
    pendingSuccessorId: null,
    revokedAuthorityIds: [],
    registryVersion: 3,
    baselineId: "bl-001",
    updatedAt: new Date("2026-03-15T10:00:00Z"),
    updatedBy: "operator-1",
    correlationId: "corr-auth-001",
  }, overrides || {});
}

function buildPersistedAuthorityLine(overrides) {
  return Object.assign({
    id: "db-id-auth-001",
    authorityLineId: "auth-line-001",
    currentAuthorityId: "authority-A",
    authorityState: "ACTIVE",
    transferState: "TRANSFER_IDLE",
    pendingSuccessorId: null,
    revokedAuthorityIds: [],
    registryVersion: "3",
    baselineId: "bl-001",
    correlationId: "corr-auth-001",
    updatedBy: "operator-1",
    createdAt: new Date("2026-03-15T09:00:00Z"),
    updatedAt: new Date("2026-03-15T10:00:00Z"),
  }, overrides || {});
}

function buildLegacyIncidentRecord(overrides) {
  return Object.assign({
    incidentId: "incident-001",
    reasonCode: "CONTAINMENT_FAILURE",
    correlationId: "corr-inc-001",
    actor: "operator-1",
    detail: "containment failed on stage 2",
    escalatedAt: new Date("2026-03-15T11:00:00Z"),
    acknowledged: false,
  }, overrides || {});
}

function buildPersistedIncident(overrides) {
  return Object.assign({
    id: "db-id-inc-001",
    incidentId: "incident-001",
    reasonCode: "CONTAINMENT_FAILURE",
    severity: "WARNING",
    status: "OPEN",
    correlationId: "corr-inc-001",
    baselineId: null,
    snapshotId: null,
    acknowledgedBy: null,
    acknowledgedAt: null,
    createdAt: new Date("2026-03-15T11:00:00Z"),
    updatedAt: new Date("2026-03-15T11:00:00Z"),
  }, overrides || {});
}

// ── Setup ──

beforeEach(function () {
  _resetDiagnostics();
});

// ══════════════════════════════════════════════════════════════════════════════
// OA-A1: Authority adapter fromLegacy normalizes legacy shape
// ══════════════════════════════════════════════════════════════════════════════

describe("P3 Slice 2 — Authority + Incident Ontology Adapters", function () {

  it("OA-A1: authority adapter fromLegacy normalizes legacy shape", function () {
    var legacy = buildLegacyAuthorityLine({ registryVersion: 5, baselineId: "" });
    var canonical = AuthorityOntologyAdapter.fromLegacy(legacy);

    // registryVersion: number → string
    expect(canonical.registryVersion).toBe("5");
    expect(typeof canonical.registryVersion).toBe("string");

    // empty baselineId → null
    expect(canonical.baselineId).toBeNull();

    // standard fields preserved
    expect(canonical.authorityLineId).toBe("auth-line-001");
    expect(canonical.currentAuthorityId).toBe("authority-A");
    expect(canonical.authorityState).toBe("ACTIVE");
    expect(canonical.transferState).toBe("TRANSFER_IDLE");

    // diagnostics emitted
    var diags = getDiagnosticLog({ adapterName: "authority-adapter" });
    expect(diags.length).toBeGreaterThanOrEqual(2);
    var types = diags.map(function (d) { return d.type; });
    expect(types).toContain("LEGACY_BRIDGE_TRANSLATION_APPLIED");
    expect(types).toContain("LEGACY_FIELD_MAPPING_APPLIED");
  });

  // ════════════════════════════════════════════════════════════════════════════
  // OA-A2: Authority adapter roundtrip preserves data
  // ════════════════════════════════════════════════════════════════════════════

  it("OA-A2: authority adapter roundtrip preserves data", function () {
    var legacy = buildLegacyAuthorityLine({
      registryVersion: 7,
      revokedAuthorityIds: ["old-auth-1"],
      pendingSuccessorId: "pending-auth",
    });

    // fromLegacy → toRepositoryInput → (simulate persist) → fromPersisted → toLegacy
    var canonical = AuthorityOntologyAdapter.fromLegacy(legacy);
    var input = AuthorityOntologyAdapter.toRepositoryInput(canonical);

    // Simulate persistence: add auto-generated fields
    var persisted = Object.assign({}, input, {
      id: "db-round-001",
      createdAt: new Date("2026-03-15T09:00:00Z"),
      updatedAt: legacy.updatedAt,
    });

    var canonical2 = AuthorityOntologyAdapter.fromPersisted(persisted);
    var roundtripped = AuthorityOntologyAdapter.toLegacy(canonical2);

    expect(roundtripped.authorityLineId).toBe(legacy.authorityLineId);
    expect(roundtripped.currentAuthorityId).toBe(legacy.currentAuthorityId);
    expect(roundtripped.registryVersion).toBe(legacy.registryVersion);
    expect(typeof roundtripped.registryVersion).toBe("number");
    expect(roundtripped.revokedAuthorityIds).toEqual(["old-auth-1"]);
    expect(roundtripped.pendingSuccessorId).toBe("pending-auth");
    expect(roundtripped.authorityState).toBe("ACTIVE");
  });

  // ════════════════════════════════════════════════════════════════════════════
  // OA-A3: Authority patch helper builds correct shape
  // ════════════════════════════════════════════════════════════════════════════

  it("OA-A3: authority patch helper builds correct shape", function () {
    var legacy = buildLegacyAuthorityLine();
    var canonical = AuthorityOntologyAdapter.fromLegacy(legacy);
    var patch = toAuthorityPatch(canonical, { transferState: "TRANSFER_REQUESTED" });

    expect(patch.transferState).toBe("TRANSFER_REQUESTED");
    expect(patch.currentAuthorityId).toBe("authority-A");
    expect(patch.registryVersion).toBe("3");
  });

  // ════════════════════════════════════════════════════════════════════════════
  // OA-I1: Incident adapter fromLegacy normalizes legacy shape
  // ════════════════════════════════════════════════════════════════════════════

  it("OA-I1: incident adapter fromLegacy normalizes legacy shape", function () {
    var legacy = buildLegacyIncidentRecord();
    var canonical = IncidentOntologyAdapter.fromLegacy(legacy);

    // acknowledged=false → status=OPEN
    expect(canonical.status).toBe("OPEN");
    // actor not set as acknowledgedBy when not acknowledged
    expect(canonical.acknowledgedBy).toBeNull();
    // escalatedAt → createdAt
    expect(canonical.createdAt).toEqual(legacy.escalatedAt);
    // severity hardcoded
    expect(canonical.severity).toBe("WARNING");

    // diagnostics
    var diags = getDiagnosticLog({ adapterName: "incident-adapter" });
    expect(diags.length).toBeGreaterThanOrEqual(2);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // OA-I2: Incident adapter acknowledged=true maps correctly
  // ════════════════════════════════════════════════════════════════════════════

  it("OA-I2: incident adapter acknowledged=true maps correctly", function () {
    var legacy = buildLegacyIncidentRecord({ acknowledged: true, actor: "ack-operator" });
    var canonical = IncidentOntologyAdapter.fromLegacy(legacy);

    expect(canonical.status).toBe("ACKNOWLEDGED");
    expect(canonical.acknowledgedBy).toBe("ack-operator");
  });

  // ════════════════════════════════════════════════════════════════════════════
  // OA-I3: Incident adapter roundtrip preserves data
  // ════════════════════════════════════════════════════════════════════════════

  it("OA-I3: incident adapter roundtrip preserves data", function () {
    var legacy = buildLegacyIncidentRecord();
    var canonical = IncidentOntologyAdapter.fromLegacy(legacy);
    var input = IncidentOntologyAdapter.toRepositoryInput(canonical);

    // Simulate persistence
    var persisted = Object.assign({}, input, {
      id: "db-inc-round-001",
      acknowledgedBy: null,
      acknowledgedAt: null,
      createdAt: legacy.escalatedAt,
      updatedAt: legacy.escalatedAt,
    });

    var canonical2 = IncidentOntologyAdapter.fromPersisted(persisted);
    var roundtripped = IncidentOntologyAdapter.toLegacy(canonical2);

    expect(roundtripped.incidentId).toBe(legacy.incidentId);
    expect(roundtripped.reasonCode).toBe(legacy.reasonCode);
    expect(roundtripped.correlationId).toBe(legacy.correlationId);
    expect(roundtripped.acknowledged).toBe(false);
    expect(roundtripped.escalatedAt).toEqual(legacy.escalatedAt);
    // detail is lost in persistence (legacy-only field)
    expect(roundtripped.detail).toBe("");
    // actor falls back to "system" when not acknowledged
    expect(roundtripped.actor).toBe("system");
  });

  // ════════════════════════════════════════════════════════════════════════════
  // OA-I4: Incident fromPersisted with acknowledged status
  // ════════════════════════════════════════════════════════════════════════════

  it("OA-I4: incident fromPersisted with acknowledged status", function () {
    var persisted = buildPersistedIncident({
      status: "ACKNOWLEDGED",
      acknowledgedBy: "ack-op",
      acknowledgedAt: new Date("2026-03-15T12:00:00Z"),
    });

    var canonical = IncidentOntologyAdapter.fromPersisted(persisted);
    var legacy = IncidentOntologyAdapter.toLegacy(canonical);

    expect(legacy.acknowledged).toBe(true);
    expect(legacy.actor).toBe("ack-op");
  });

  // ════════════════════════════════════════════════════════════════════════════
  // OA-D1: Date string normalization for authority updatedAt
  // ════════════════════════════════════════════════════════════════════════════

  it("OA-D1: date string normalization emits diagnostic", function () {
    var persisted = buildPersistedAuthorityLine({
      updatedAt: "2026-03-15T10:00:00Z",
    });

    var canonical = AuthorityOntologyAdapter.fromPersisted(persisted);
    expect(canonical.updatedAt).toBeInstanceOf(Date);

    var diags = getDiagnosticLog({ type: "DATE_NORMALIZATION_APPLIED" });
    expect(diags.length).toBeGreaterThanOrEqual(1);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // OA-RP1: Authority repo-first path uses adapter
  // ════════════════════════════════════════════════════════════════════════════

  it("OA-RP1: authority repo-first path uses adapter", async function () {
    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
    _resetDiagnostics();
    registerAdapterFactory("memory", createMemoryAdapters);
    await bootstrapPersistence({ adapterType: "memory" });

    var adapters = getPersistenceAdapters();

    // Save through adapter
    var legacy = buildLegacyAuthorityLine({ registryVersion: 10 });
    var canonical = AuthorityOntologyAdapter.fromLegacy(legacy);
    var input = AuthorityOntologyAdapter.toRepositoryInput(canonical);
    await adapters.authority.saveAuthorityLine(input);

    // Read back
    var result = await adapters.authority.findAuthorityLineByLineId("auth-line-001");
    expect(result.ok).toBe(true);

    // Verify persisted registryVersion is string
    expect(result.data.registryVersion).toBe("10");
    expect(typeof result.data.registryVersion).toBe("string");

    // Roundtrip through adapter
    var canonical2 = AuthorityOntologyAdapter.fromPersisted(result.data);
    var roundtripped = AuthorityOntologyAdapter.toLegacy(canonical2);
    expect(roundtripped.registryVersion).toBe(10);
    expect(typeof roundtripped.registryVersion).toBe("number");

    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // OA-RP2: Incident repo-first path uses adapter
  // ════════════════════════════════════════════════════════════════════════════

  it("OA-RP2: incident repo-first path uses adapter", async function () {
    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
    _resetDiagnostics();
    registerAdapterFactory("memory", createMemoryAdapters);
    await bootstrapPersistence({ adapterType: "memory" });

    var adapters = getPersistenceAdapters();

    // Save through adapter
    var legacy = buildLegacyIncidentRecord();
    var canonical = IncidentOntologyAdapter.fromLegacy(legacy);
    var input = IncidentOntologyAdapter.toRepositoryInput(canonical);
    await adapters.incident.createIncident(input);

    // Read back
    var result = await adapters.incident.findIncidentByIncidentId("incident-001");
    expect(result.ok).toBe(true);

    // Verify persisted fields
    expect(result.data.status).toBe("OPEN");
    expect(result.data.severity).toBe("WARNING");

    // Roundtrip through adapter
    var canonical2 = IncidentOntologyAdapter.fromPersisted(result.data);
    var roundtripped = IncidentOntologyAdapter.toLegacy(canonical2);
    expect(roundtripped.incidentId).toBe("incident-001");
    expect(roundtripped.acknowledged).toBe(false);

    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // OA-F1: Legacy fallback emits diagnostic (authority)
  // ════════════════════════════════════════════════════════════════════════════

  it("OA-F1: legacy fallback emits diagnostic for authority", async function () {
    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
    _resetDiagnostics();
    registerAdapterFactory("memory", createMemoryAdapters);
    await bootstrapPersistence({ adapterType: "memory" });

    // Import the actual function to test fallback
    var { getAuthorityLineFromRepo } = require("../core/authority/authority-registry");
    var result = await getAuthorityLineFromRepo("nonexistent-line");

    // Should return null (not in repo, not in memory)
    expect(result).toBeNull();

    // Should emit fallback diagnostic
    var diags = getDiagnosticLog({ type: "LEGACY_DIRECT_ACCESS_FALLBACK_USED", moduleName: "authority-registry" });
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags[0].fallbackUsed).toBe(true);

    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // OA-AL1: Alias constants are defined
  // ════════════════════════════════════════════════════════════════════════════

  it("OA-AL1: alias constants are defined for authority and incident", function () {
    expect(AUTHORITY_ALIASES.length).toBeGreaterThanOrEqual(1);
    expect(INCIDENT_ALIASES.length).toBeGreaterThanOrEqual(3);

    // Verify key mappings exist
    var incidentFields = INCIDENT_ALIASES.map(function (a) { return a.legacy; });
    expect(incidentFields).toContain("actor");
    expect(incidentFields).toContain("escalatedAt");
    expect(incidentFields).toContain("acknowledged(boolean)");
  });

  // ════════════════════════════════════════════════════════════════════════════
  // OA-BR1: Bridge route guardrail accepts new modules
  // ════════════════════════════════════════════════════════════════════════════

  it("OA-BR1: bridge route guardrail accepts authority-registry and incident-escalation", function () {
    _resetDiagnostics();

    // These should NOT emit contract violation (they are registered)
    assertBridgeRoute("authority-registry", "saveAuthorityLine");
    assertBridgeRoute("incident-escalation", "createIncident");

    var violations = getDiagnosticLog({ type: "ONTOLOGY_ADAPTER_CONTRACT_VIOLATION" });
    expect(violations.length).toBe(0);

    // Unregistered module should emit violation
    assertBridgeRoute("unknown-module", "someOp");
    var violations2 = getDiagnosticLog({ type: "ONTOLOGY_ADAPTER_CONTRACT_VIOLATION" });
    expect(violations2.length).toBe(1);
  });
});
