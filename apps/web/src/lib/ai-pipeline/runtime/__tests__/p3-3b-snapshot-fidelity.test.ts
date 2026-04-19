// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass (tracker #53 require()→import 이관 완료 후 별도 residual tracker 신설 예정)
/**
 * P3 Slice 3B — Snapshot Full-Fidelity Persistence Tests (9 tests)
 *
 * Validates:
 * - Persisted payload roundtrip preserves all fields
 * - Repository-first read returns full payload
 * - Snapshot manager uses repository as truth source
 * - Restore/readiness can consume persisted snapshot payload
 * - Legacy fallback emits diagnostic
 * - Checksum and payload remain consistent
 * - Adapter no longer returns empty scopes/config from persisted
 * - canEnterActiveRuntimeFromRepo works with repo-only snapshots
 * - Fidelity contract violation diagnostic for legacy null-payload rows
 */

import { describe, it, expect, beforeEach } from "vitest";

import { SnapshotOntologyAdapter } from "../core/ontology/snapshot-adapter";
import { getDiagnosticLog, _resetDiagnostics } from "../core/ontology/diagnostics";
import { createMemoryAdapters } from "../core/persistence/memory";
import { registerAdapterFactory, _resetAdapterRegistry } from "../core/persistence/factory";
import { bootstrapPersistence, _resetPersistenceBootstrap, getPersistenceAdapters } from "../core/persistence/bootstrap";
import {
  createSnapshotPair,
  getSnapshot,
  getSnapshotFromRepo,
  restoreDryRunFromRepo,
  canEnterActiveRuntimeFromRepo,
  computeScopeChecksum,
  _resetSnapshotStore,
} from "../core/baseline/snapshot-manager";

// ── Test Fixtures ──

function buildScopeData() {
  return {
    CONFIG: { maxRetries: 3, timeout: 5000 },
    FLAGS: { enableNewUI: true, darkMode: false },
    ROUTING: { primary: "us-east-1", fallback: "eu-west-1" },
    AUTHORITY: { owner: "admin", level: "root" },
    POLICY: { retention: 90, encryption: "AES256" },
    QUEUE_TOPOLOGY: { queues: ["intake", "process", "output"], concurrency: 4 },
  };
}

function buildLegacySnapshot(tag, baselineId, scopeData) {
  var scopes = Object.keys(scopeData).map(function (scope) {
    return {
      scope: scope,
      data: scopeData[scope],
      checksum: computeScopeChecksum(scope, scopeData[scope]),
    };
  });
  var config = {};
  scopes.forEach(function (s) { config[s.scope] = s.data; });
  return {
    snapshotId: "snap-" + tag.toLowerCase() + "-bl1-" + Date.now(),
    baselineId: baselineId,
    tag: tag,
    scopes: scopes,
    capturedAt: new Date("2026-03-15T10:00:00Z"),
    capturedBy: "operator-x",
    config: config,
  };
}

function buildPersistedSnapshotWithPayload(legacySnap) {
  var canonical = SnapshotOntologyAdapter.fromLegacy(legacySnap);
  var repoInput = SnapshotOntologyAdapter.toRepositoryInput(canonical);
  return Object.assign({}, repoInput, {
    id: "db-snap-001",
    createdAt: new Date("2026-03-15T10:00:00Z"),
    updatedAt: new Date("2026-03-15T10:00:00Z"),
  });
}

function buildPersistedSnapshotLegacyNoPayload() {
  return {
    id: "db-snap-legacy-001",
    baselineId: "bl-legacy",
    snapshotType: "ACTIVE",
    configChecksum: "abc123",
    flagChecksum: "def456",
    routingChecksum: null,
    authorityChecksum: null,
    policyChecksum: null,
    queueTopologyChecksum: null,
    includedScopes: ["CONFIG", "FLAGS"],
    restoreVerificationStatus: null,
    scopePayload: null,
    configPayload: null,
    capturedBy: null,
    snapshotId: null,
    createdAt: new Date("2026-03-15T10:00:00Z"),
    updatedAt: new Date("2026-03-15T10:00:00Z"),
  };
}

// ── Suite ──

describe("P3 Slice 3B — Snapshot Full-Fidelity Persistence", function () {
  beforeEach(function () {
    _resetDiagnostics();
    _resetSnapshotStore();
    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
    registerAdapterFactory(createMemoryAdapters);
    bootstrapPersistence();
  });

  it("FF1: snapshot persisted payload roundtrip preserves all fields", function () {
    var scopeData = buildScopeData();
    var legacy = buildLegacySnapshot("ACTIVE", "bl-round", scopeData);

    // legacy → canonical → repoInput → persisted → canonical → legacy
    var canonical = SnapshotOntologyAdapter.fromLegacy(legacy);
    var repoInput = SnapshotOntologyAdapter.toRepositoryInput(canonical);

    // Verify repoInput now includes payload
    expect(repoInput.scopePayload).toBeDefined();
    expect(repoInput.configPayload).toBeDefined();
    expect(repoInput.capturedBy).toBe("operator-x");
    expect(repoInput.snapshotId).toBe(legacy.snapshotId);

    // Simulate persistence roundtrip
    var persisted = Object.assign({}, repoInput, {
      id: "db-rt-001",
      createdAt: new Date("2026-03-15T10:00:00Z"),
      updatedAt: new Date("2026-03-15T10:00:00Z"),
    });

    var fromPersisted = SnapshotOntologyAdapter.fromPersisted(persisted);
    var roundtripped = SnapshotOntologyAdapter.toLegacy(fromPersisted);

    // Full-fidelity: scopes preserved
    expect(roundtripped.scopes).toHaveLength(6);
    expect(roundtripped.scopes[0].data).toEqual(scopeData.CONFIG);
    expect(roundtripped.capturedBy).toBe("operator-x");
    expect(roundtripped.tag).toBe("ACTIVE");
    expect(roundtripped.config).toEqual(legacy.config);
  });

  it("FF2: snapshot repository-first read returns full payload", async function () {
    var scopeData = buildScopeData();
    var pair = createSnapshotPair({
      baselineId: "bl-repo-read",
      capturedBy: "op-repo",
      scopeData: scopeData,
    });

    // Wait for async save to complete
    var adapters = getPersistenceAdapters();
    await new Promise(function (r) { setTimeout(r, 50); });

    // Read from repo
    var repoSnap = await getSnapshotFromRepo(pair.active.snapshotId);
    expect(repoSnap).not.toBeNull();
    expect(repoSnap.scopes).toHaveLength(6);
    expect(repoSnap.scopes[0].data).toEqual(scopeData.CONFIG);
    expect(repoSnap.capturedBy).toBe("op-repo");
    expect(repoSnap.tag).toBe("ACTIVE");

    // Diagnostic emitted
    var diags = getDiagnosticLog().filter(function (d) {
      return d.type === "SNAPSHOT_REPO_FIRST_READ_USED";
    });
    expect(diags.length).toBeGreaterThanOrEqual(1);
  });

  it("FF3: snapshot manager uses repository payload as truth source", async function () {
    var scopeData = buildScopeData();
    var pair = createSnapshotPair({
      baselineId: "bl-truth",
      capturedBy: "op-truth",
      scopeData: scopeData,
    });

    await new Promise(function (r) { setTimeout(r, 50); });

    // Clear memory store — repo is the only truth source now
    _resetSnapshotStore();

    // Memory read returns null
    var memSnap = getSnapshot(pair.active.snapshotId);
    expect(memSnap).toBeNull();

    // Repo read returns full payload
    var repoSnap = await getSnapshotFromRepo(pair.active.snapshotId);
    expect(repoSnap).not.toBeNull();
    expect(repoSnap.scopes).toHaveLength(6);
    expect(repoSnap.config).toBeDefined();
    expect(Object.keys(repoSnap.config).length).toBe(6);
  });

  it("FF4: restore/readiness can consume persisted snapshot payload", async function () {
    var scopeData = buildScopeData();
    var pair = createSnapshotPair({
      baselineId: "bl-restore",
      capturedBy: "op-restore",
      scopeData: scopeData,
    });

    await new Promise(function (r) { setTimeout(r, 50); });

    // Clear memory — force repo-first path
    _resetSnapshotStore();

    // restoreDryRunFromRepo should succeed with repo data
    var dryRun = await restoreDryRunFromRepo(pair.rollback.snapshotId);
    expect(dryRun.success).toBe(true);
    expect(dryRun.scopeResults).toHaveLength(6);
    dryRun.scopeResults.forEach(function (r) {
      expect(r.checksumMatch).toBe(true);
      expect(r.restorable).toBe(true);
    });
  });

  it("FF5: snapshot legacy fallback emits diagnostic", async function () {
    // Create a snapshot in memory only (don't use createSnapshotPair to control timing)
    var scopeData = buildScopeData();
    var legacy = buildLegacySnapshot("ACTIVE", "bl-fallback", scopeData);

    // Put in memory store manually (via createSnapshotPair stores in memory)
    var pair = createSnapshotPair({
      baselineId: "bl-fallback",
      capturedBy: "op-fb",
      scopeData: scopeData,
    });

    // Wait then clear diagnostics
    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    // Get adapters and clear repo snapshot
    var adapters = getPersistenceAdapters();
    // Use a snapshotId that doesn't exist in repo but exists in memory
    var memSnap = getSnapshot(pair.active.snapshotId);
    expect(memSnap).not.toBeNull();

    // Create a fake ID that won't exist in repo
    var fakeId = "snap-nonexistent-in-repo-" + Date.now();
    var result = await getSnapshotFromRepo(fakeId);
    // Should return null since not in memory either
    expect(result).toBeNull();

    // Now test actual fallback: repo miss, memory hit
    // Directly access memory — construct a scenario where repo doesn't have this snapshot
    _resetDiagnostics();

    // P4-3: snapshot is REPO_ONLY — verify that when repo is empty, null is returned (no memory fallback)
    _resetPersistenceBootstrap();
    _resetAdapterRegistry();
    registerAdapterFactory(createMemoryAdapters);
    bootstrapPersistence();
    // Fresh repo, but pair.active is still in memory from createSnapshotPair
    _resetDiagnostics();

    var fallbackResult = await getSnapshotFromRepo(pair.active.snapshotId);
    // P4-3: REPO_ONLY — returns null when repo empty, no memory fallback
    expect(fallbackResult).toBeNull();

    var repoOnlyDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "REPO_ONLY_PATH_ENFORCED"
        && d.moduleName === "snapshot-manager";
    });
    expect(repoOnlyDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("FF6: checksum and payload remain consistent after persistence roundtrip", function () {
    var scopeData = buildScopeData();
    var legacy = buildLegacySnapshot("ROLLBACK", "bl-chk", scopeData);

    var canonical = SnapshotOntologyAdapter.fromLegacy(legacy);
    var repoInput = SnapshotOntologyAdapter.toRepositoryInput(canonical);

    // Simulate persistence
    var persisted = Object.assign({}, repoInput, {
      id: "db-chk-001",
      createdAt: new Date("2026-03-15T10:00:00Z"),
      updatedAt: new Date("2026-03-15T10:00:00Z"),
    });

    var fromPersisted = SnapshotOntologyAdapter.fromPersisted(persisted);
    var roundtripped = SnapshotOntologyAdapter.toLegacy(fromPersisted);

    // Recompute checksums from roundtripped data — should match originals
    roundtripped.scopes.forEach(function (entry) {
      var recomputed = computeScopeChecksum(entry.scope, entry.data);
      expect(recomputed).toBe(entry.checksum);
    });

    // Individual checksum fields should also match
    expect(fromPersisted.configChecksum).toBe(canonical.configChecksum);
    expect(fromPersisted.flagChecksum).toBe(canonical.flagChecksum);
    expect(fromPersisted.routingChecksum).toBe(canonical.routingChecksum);
    expect(fromPersisted.authorityChecksum).toBe(canonical.authorityChecksum);
    expect(fromPersisted.policyChecksum).toBe(canonical.policyChecksum);
    expect(fromPersisted.queueTopologyChecksum).toBe(canonical.queueTopologyChecksum);
  });

  it("FF7: snapshot adapter no longer returns empty scopes/config from persisted", function () {
    var scopeData = buildScopeData();
    var legacy = buildLegacySnapshot("ACTIVE", "bl-notempty", scopeData);
    var persisted = buildPersistedSnapshotWithPayload(legacy);

    var canonical = SnapshotOntologyAdapter.fromPersisted(persisted);

    // Scopes must NOT be empty
    expect(canonical.scopes.length).toBe(6);
    expect(canonical.scopes[0].data).toBeDefined();
    expect(Object.keys(canonical.scopes[0].data).length).toBeGreaterThan(0);

    // Config must NOT be empty
    expect(Object.keys(canonical.config).length).toBeGreaterThan(0);

    // capturedBy must NOT be empty
    expect(canonical.capturedBy).toBe("operator-x");
  });

  it("FF8: canEnterActiveRuntimeFromRepo works with repo-only snapshots", async function () {
    var scopeData = buildScopeData();
    var pair = createSnapshotPair({
      baselineId: "bl-enter",
      capturedBy: "op-enter",
      scopeData: scopeData,
    });

    await new Promise(function (r) { setTimeout(r, 50); });

    // Clear memory — only repo data
    _resetSnapshotStore();

    var result = await canEnterActiveRuntimeFromRepo(
      pair.active.snapshotId,
      pair.rollback.snapshotId
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("repo-first");
  });

  it("FF9: fidelity contract violation diagnostic for legacy null-payload rows", function () {
    _resetDiagnostics();
    var legacyPersisted = buildPersistedSnapshotLegacyNoPayload();

    var canonical = SnapshotOntologyAdapter.fromPersisted(legacyPersisted);

    // Should degrade gracefully: empty scopes/config
    expect(canonical.scopes).toHaveLength(0);
    expect(Object.keys(canonical.config)).toHaveLength(0);
    expect(canonical.capturedBy).toBe("");

    // Should emit SNAPSHOT_FIDELITY_CONTRACT_VIOLATION
    var diags = getDiagnosticLog().filter(function (d) {
      return d.type === "SNAPSHOT_FIDELITY_CONTRACT_VIOLATION";
    });
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags[0].moduleName).toBe("snapshot-manager");
  });
});
