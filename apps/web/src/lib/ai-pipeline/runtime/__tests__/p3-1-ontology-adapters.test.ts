// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass
/**
 * P3 Slice 1 — Ontology Adapter Tests (12 tests)
 *
 * Validates recovery + baseline ontology adapters:
 * - Legacy shape normalization
 * - Roundtrip preservation
 * - Date normalization with diagnostics
 * - Repository-first path through adapter
 * - Legacy fallback diagnostic
 * - Common normalizers
 * - Bridge route guardrail
 */

import { describe, it, expect, beforeEach } from "vitest";

var { RecoveryOntologyAdapter, toRepositoryPatch } = require("../core/ontology/recovery-adapter");
var { BaselineOntologyAdapter } = require("../core/ontology/baseline-adapter");
var { normalizeDateWithDiagnostic } = require("../core/ontology/date-normalizer");
var { toNullable, normalizeId, normalizeEnum, normalizeArray, emptyToNull, nullToEmpty } = require("../core/ontology/common-normalizers");
var { getDiagnosticLog, _resetDiagnostics, assertBridgeRoute } = require("../core/ontology/diagnostics");
var { createMemoryAdapters } = require("../core/persistence/memory");
var { registerAdapterFactory, _resetAdapterRegistry } = require("../core/persistence/factory");
var { bootstrapPersistence, _resetPersistenceBootstrap, getPersistenceAdapters } = require("../core/persistence/bootstrap");

// ── Test Fixtures ──

function buildLegacyRecoveryRecord(overrides) {
  return Object.assign({
    recoveryId: "rec-oa-001",
    correlationId: "corr-oa-001",
    actor: "operator-1",
    reason: "test recovery",
    currentState: "RECOVERY_REQUESTED",
    baselineId: "bl-oa-001",
    incidentId: undefined,
    preconditionResults: [{ name: "check-1", passed: true, detail: "ok" }],
    overrideMetadata: undefined,
    stages: [],
    startedAt: new Date("2026-03-15T10:00:00Z"),
    completedAt: undefined,
    failReason: undefined,
  }, overrides || {});
}

function buildLegacyBaseline(overrides) {
  return Object.assign({
    canonicalBaselineId: "baseline-test-001",
    baselineVersion: "1.0.0",
    baselineHash: "abc123",
    baselineSource: "PACKAGE1_COMPLETE_NEW_AI_INTEGRATED",
    baselineStatus: "FROZEN",
    lifecycleState: "ACTIVE_100",
    releaseMode: "FULL_ACTIVE_STABILIZATION",
    activeSnapshotId: "snap-a",
    rollbackSnapshotId: "snap-r",
    freezeReason: "initial freeze",
    activePathManifestId: "",
    policySetVersion: "v1",
    routingRuleVersion: "v1",
    authorityRegistryVersion: "v1",
    documentType: "STABILIZATION",
    createdAt: new Date("2026-03-15T09:00:00Z"),
    updatedAt: new Date("2026-03-15T09:00:00Z"),
  }, overrides || {});
}

function buildPersistedRecovery(overrides) {
  return Object.assign({
    id: "mem-rec-001",
    recoveryId: "rec-oa-001",
    correlationId: "corr-oa-001",
    incidentId: null,
    baselineId: "bl-oa-001",
    lifecycleState: "INCIDENT_LOCKDOWN",
    releaseMode: "FULL_ACTIVE_STABILIZATION",
    recoveryState: "RECOVERY_REQUESTED",
    recoveryStage: null,
    lockKey: null,
    lockToken: null,
    operatorId: "operator-1",
    overrideUsed: false,
    overrideReason: null,
    signOffMetadata: null,
    startedAt: new Date("2026-03-15T10:00:00Z"),
    completedAt: null,
    lastHeartbeatAt: null,
    failureReasonCode: null,
    stageResults: null,
    preconditionResults: [{ name: "check-1", passed: true, detail: "ok" }],
    createdAt: new Date("2026-03-15T10:00:00Z"),
    updatedAt: new Date("2026-03-15T10:00:01Z"),
  }, overrides || {});
}

function buildPersistedBaseline(overrides) {
  return Object.assign({
    id: "mem-bl-001",
    baselineSource: "PACKAGE1_COMPLETE_NEW_AI_INTEGRATED",
    baselineVersion: "1.0.0",
    baselineHash: "abc123",
    lifecycleState: "ACTIVE_100",
    releaseMode: "FULL_ACTIVE_STABILIZATION",
    baselineStatus: "FROZEN",
    activeSnapshotId: "snap-a",
    rollbackSnapshotId: "snap-r",
    freezeReason: "initial freeze",
    activePathManifestId: null,
    policySetVersion: "v1",
    routingRuleVersion: "v1",
    authorityRegistryVersion: "v1",
    stabilizationOnly: true,
    featureExpansionAllowed: false,
    experimentalPathAllowed: false,
    structuralRefactorAllowed: false,
    devOnlyPathAllowed: false,
    emergencyRollbackAllowed: true,
    containmentPriorityEnabled: true,
    auditStrictMode: true,
    mergeGateStrictMode: true,
    canonicalSlot: "CANONICAL",
    createdAt: new Date("2026-03-15T09:00:00Z"),
    updatedAt: new Date("2026-03-15T09:00:00Z"),
  }, overrides || {});
}

// ══════════════════════════════════════════════════════════════════════════════

describe("P3 Slice 1 — Ontology Adapters", function () {
  beforeEach(function () {
    _resetDiagnostics();
  });

  // ── OA1: Recovery adapter fromLegacy normalizes legacy shape ──

  it("OA1: recovery adapter fromLegacy maps actor→operatorId and normalizes undefined→null", function () {
    var legacy = buildLegacyRecoveryRecord({
      actor: "admin-user",
      failReason: "precondition failed",
      incidentId: undefined,
    });

    var canonical = RecoveryOntologyAdapter.fromLegacy(legacy);

    expect(canonical.operatorId).toBe("admin-user");
    expect(canonical.failureReasonCode).toBe("precondition failed");
    expect(canonical.incidentId).toBeNull();
    expect(canonical.completedAt).toBeNull();
    expect(canonical.recoveryState).toBe("RECOVERY_REQUESTED");
    expect(canonical.lifecycleState).toBe("INCIDENT_LOCKDOWN");

    // Verify field mapping diagnostic emitted
    var mappingDiags = getDiagnosticLog({ type: "LEGACY_FIELD_MAPPING_APPLIED" });
    expect(mappingDiags.length).toBeGreaterThanOrEqual(1);
    expect(mappingDiags.some(function (d) { return d.reasonCode.includes("actor→operatorId"); })).toBe(true);
  });

  // ── OA2: Recovery adapter roundtrip preserves data ──

  it("OA2: recovery adapter roundtrip fromLegacy→toRepoInput→fromPersisted→toLegacy", function () {
    var legacy = buildLegacyRecoveryRecord({
      stages: [{ stage: "PRE_RECOVERY_VALIDATION", passed: true, detail: "ok", timestamp: new Date() }],
    });

    var canonical = RecoveryOntologyAdapter.fromLegacy(legacy);
    var repoInput = RecoveryOntologyAdapter.toRepositoryInput(canonical);

    // Simulate persist: add id, createdAt, updatedAt
    var persisted = Object.assign({}, repoInput, {
      id: "mem-rec-rt",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    var canonicalBack = RecoveryOntologyAdapter.fromPersisted(persisted);
    var legacyBack = RecoveryOntologyAdapter.toLegacy(canonicalBack);

    expect(legacyBack.recoveryId).toBe(legacy.recoveryId);
    expect(legacyBack.correlationId).toBe(legacy.correlationId);
    expect(legacyBack.actor).toBe(legacy.actor);
    expect(legacyBack.currentState).toBe(legacy.currentState);
    expect(legacyBack.baselineId).toBe(legacy.baselineId);
    expect(legacyBack.startedAt.getTime()).toBe(legacy.startedAt.getTime());
    expect(legacyBack.stages.length).toBe(1);
  });

  // ── OA3: Baseline adapter fromLegacy normalizes legacy shape ──

  it("OA3: baseline adapter fromLegacy maps canonicalBaselineId→baselineId and empty→null", function () {
    var legacy = buildLegacyBaseline({
      activePathManifestId: "",
    });

    var canonical = BaselineOntologyAdapter.fromLegacy(legacy);

    expect(canonical.baselineId).toBe("baseline-test-001");
    expect(canonical.activePathManifestId).toBeNull();
    expect(canonical.activeSnapshotId).toBe("snap-a");
    expect(canonical.canonicalSlot).toBe("CANONICAL");
    expect(canonical.stabilizationOnly).toBe(true);

    var mappingDiags = getDiagnosticLog({ type: "LEGACY_FIELD_MAPPING_APPLIED" });
    expect(mappingDiags.some(function (d) { return d.reasonCode.includes("canonicalBaselineId→baselineId"); })).toBe(true);
  });

  // ── OA4: Baseline adapter roundtrip preserves data ──

  it("OA4: baseline adapter roundtrip fromLegacy→toRepoInput→fromPersisted→toLegacy", function () {
    var legacy = buildLegacyBaseline();

    var canonical = BaselineOntologyAdapter.fromLegacy(legacy);
    var repoInput = BaselineOntologyAdapter.toRepositoryInput(canonical);

    // Simulate persist: add id, createdAt, updatedAt
    var persisted = Object.assign({}, repoInput, {
      id: "mem-bl-rt",
      createdAt: new Date("2026-03-15T09:00:00Z"),
      updatedAt: new Date("2026-03-15T09:00:00Z"),
    });

    var canonicalBack = BaselineOntologyAdapter.fromPersisted(persisted);
    var legacyBack = BaselineOntologyAdapter.toLegacy(canonicalBack);

    expect(legacyBack.canonicalBaselineId).toBe("mem-bl-rt"); // ID remapped from persisted.id
    expect(legacyBack.baselineVersion).toBe(legacy.baselineVersion);
    expect(legacyBack.baselineHash).toBe(legacy.baselineHash);
    expect(legacyBack.baselineSource).toBe("PACKAGE1_COMPLETE_NEW_AI_INTEGRATED");
    expect(legacyBack.lifecycleState).toBe("ACTIVE_100");
    expect(legacyBack.releaseMode).toBe("FULL_ACTIVE_STABILIZATION");
    expect(legacyBack.baselineStatus).toBe("FROZEN");
    expect(legacyBack.documentType).toBe("");
  });

  // ── OA5: Date string normalizes to canonical Date ──

  it("OA5: date string normalizes to canonical Date with diagnostic", function () {
    var result = normalizeDateWithDiagnostic(
      "2026-03-15T10:00:00Z", "startedAt",
      { adapterName: "test-adapter", entityType: "test" }
    );

    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(new Date("2026-03-15T10:00:00Z").getTime());

    var diags = getDiagnosticLog({ type: "DATE_NORMALIZATION_APPLIED" });
    expect(diags.length).toBe(1);
    expect(diags[0].reasonCode).toContain("string → Date");
    expect(diags[0].reasonCode).toContain("startedAt");
  });

  // ── OA6: Date epoch normalizes to canonical Date ──

  it("OA6: date epoch normalizes to canonical Date", function () {
    var epoch = new Date("2026-03-15T10:00:00Z").getTime();
    var result = normalizeDateWithDiagnostic(
      epoch, "completedAt",
      { adapterName: "test-adapter", entityType: "test" }
    );

    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(epoch);

    var diags = getDiagnosticLog({ type: "DATE_NORMALIZATION_APPLIED" });
    expect(diags.length).toBe(1);
    expect(diags[0].reasonCode).toContain("number → Date");
  });

  // ── OA7: Invalid date emits DATE_NORMALIZATION_FAILED ──

  it("OA7: invalid date emits DATE_NORMALIZATION_FAILED and throws", function () {
    expect(function () {
      normalizeDateWithDiagnostic(
        "not-a-date", "startedAt",
        { adapterName: "test-adapter", entityType: "test" }
      );
    }).toThrow();

    var diags = getDiagnosticLog({ type: "DATE_NORMALIZATION_FAILED" });
    expect(diags.length).toBe(1);
    expect(diags[0].reasonCode).toContain("not-a-date");
  });

  // ── OA8: Recovery repo-first path uses adapter ──

  it("OA8: recovery repo-first path goes through adapter translation", function () {
    _resetPersistenceBootstrap();
    _resetAdapterRegistry();
    registerAdapterFactory("MEMORY", function () { return createMemoryAdapters(); });
    bootstrapPersistence({ mode: "MEMORY" });
    _resetDiagnostics();

    var adapters = getPersistenceAdapters();
    var legacy = buildLegacyRecoveryRecord();

    // Write through adapter
    var canonical = RecoveryOntologyAdapter.fromLegacy(legacy);
    var input = RecoveryOntologyAdapter.toRepositoryInput(canonical);

    return adapters.recoveryRecord.saveRecoveryRecord(input).then(function (result) {
      expect(result.ok).toBe(true);
      // Verify persisted record has adapter-mapped fields
      expect(result.data.operatorId).toBe("operator-1"); // actor → operatorId
      expect(result.data.recoveryState).toBe("RECOVERY_REQUESTED");
      expect(result.data.lifecycleState).toBe("INCIDENT_LOCKDOWN");

      // Read through adapter
      var canonicalBack = RecoveryOntologyAdapter.fromPersisted(result.data);
      expect(canonicalBack.operatorId).toBe("operator-1");

      var legacyBack = RecoveryOntologyAdapter.toLegacy(canonicalBack);
      expect(legacyBack.actor).toBe("operator-1"); // operatorId → actor
      expect(legacyBack.currentState).toBe("RECOVERY_REQUESTED");
    });
  });

  // ── OA9: Baseline repo-first path uses adapter ──

  it("OA9: baseline repo-first path goes through adapter translation", function () {
    _resetPersistenceBootstrap();
    _resetAdapterRegistry();
    registerAdapterFactory("MEMORY", function () { return createMemoryAdapters(); });
    bootstrapPersistence({ mode: "MEMORY" });
    _resetDiagnostics();

    var adapters = getPersistenceAdapters();
    var legacy = buildLegacyBaseline();

    // Write through adapter
    var canonical = BaselineOntologyAdapter.fromLegacy(legacy);
    var input = BaselineOntologyAdapter.toRepositoryInput(canonical);

    return adapters.baseline.saveBaseline(input).then(function (result) {
      expect(result.ok).toBe(true);
      expect(result.data.baselineVersion).toBe("1.0.0");
      expect(result.data.canonicalSlot).toBe("CANONICAL");

      // Read through adapter
      var canonicalBack = BaselineOntologyAdapter.fromPersisted(result.data);
      expect(canonicalBack.baselineId).toBe(result.data.id);

      var legacyBack = BaselineOntologyAdapter.toLegacy(canonicalBack);
      expect(legacyBack.canonicalBaselineId).toBe(result.data.id);
      expect(legacyBack.baselineSource).toBe("PACKAGE1_COMPLETE_NEW_AI_INTEGRATED");
      expect(legacyBack.documentType).toBe("");
    });
  });

  // ── OA10: Legacy fallback emits diagnostic ──

  it("OA10: legacy fallback emits LEGACY_DIRECT_ACCESS_FALLBACK_USED diagnostic", function () {
    // Simulate: reading from recovery with empty repo → fallback to memory
    // We test the diagnostic helper directly since the integration is in recovery-coordinator
    var { emitOntologyDiagnostic } = require("../core/ontology/diagnostics");

    emitOntologyDiagnostic({
      type: "LEGACY_DIRECT_ACCESS_FALLBACK_USED",
      moduleName: "recovery-coordinator",
      adapterName: "recovery-adapter",
      entityType: "recovery",
      entityId: "rec-test",
      direction: "repository_to_canonical",
      reasonCode: "memory shim fallback in getRecoveryStatusAsync",
      fallbackUsed: true,
      timestamp: new Date(),
    });

    var diags = getDiagnosticLog({ type: "LEGACY_DIRECT_ACCESS_FALLBACK_USED" });
    expect(diags.length).toBe(1);
    expect(diags[0].moduleName).toBe("recovery-coordinator");
    expect(diags[0].fallbackUsed).toBe(true);
    expect(diags[0].entityId).toBe("rec-test");
  });

  // ── OA11: Common normalizers ──

  it("OA11: common normalizers — toNullable, normalizeId, normalizeEnum", function () {
    // toNullable
    expect(toNullable(undefined)).toBeNull();
    expect(toNullable(null)).toBeNull();
    expect(toNullable("hello")).toBe("hello");
    expect(toNullable(0)).toBe(0);

    // normalizeId
    expect(normalizeId(undefined)).toBeNull();
    expect(normalizeId(null)).toBeNull();
    expect(normalizeId("")).toBeNull();
    expect(normalizeId("  ")).toBeNull();
    expect(normalizeId(" abc ")).toBe("abc");

    // normalizeEnum
    expect(normalizeEnum("ACTIVE_100", ["ACTIVE_100", "KILLED"], "KILLED")).toBe("ACTIVE_100");
    expect(normalizeEnum("INVALID", ["ACTIVE_100", "KILLED"], "KILLED")).toBe("KILLED");
    expect(normalizeEnum(null, ["ACTIVE_100", "KILLED"], "KILLED")).toBe("KILLED");
    expect(normalizeEnum(undefined, ["ACTIVE_100", "KILLED"], "KILLED")).toBe("KILLED");

    // normalizeArray
    expect(normalizeArray(null)).toEqual([]);
    expect(normalizeArray(undefined)).toEqual([]);
    expect(normalizeArray([1, 2])).toEqual([1, 2]);

    // emptyToNull / nullToEmpty
    expect(emptyToNull("")).toBeNull();
    expect(emptyToNull("hello")).toBe("hello");
    expect(emptyToNull(null)).toBeNull();
    expect(nullToEmpty(null)).toBe("");
    expect(nullToEmpty(undefined)).toBe("");
    expect(nullToEmpty("hello")).toBe("hello");
  });

  // ── OA12: assertBridgeRoute logs warning for unregistered path ──

  it("OA12: assertBridgeRoute logs warning for unregistered module", function () {
    assertBridgeRoute("unknown-module", "someOp");

    var diags = getDiagnosticLog({ type: "ONTOLOGY_ADAPTER_CONTRACT_VIOLATION" });
    expect(diags.length).toBe(1);
    expect(diags[0].moduleName).toBe("unknown-module");
    expect(diags[0].reasonCode).toContain("unregistered bridge route");

    // Registered modules should NOT emit warning
    _resetDiagnostics();
    assertBridgeRoute("recovery-coordinator", "persist");
    var diags2 = getDiagnosticLog({ type: "ONTOLOGY_ADAPTER_CONTRACT_VIOLATION" });
    expect(diags2.length).toBe(0);
  });
});
