// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass
/**
 * P4 Slice 3 — COMPAT_ONLY_TEMPORARY Elimination (6 tests)
 *
 * Validates:
 * - CE1: Snapshot write is full-fidelity (scopePayload has full data)
 * - CE2: Snapshot repo-only: nonexistent returns null + REPO_ONLY_PATH_ENFORCED, no COMPAT_ONLY_PATH_USED
 * - CE3: Snapshot full round-trip from repo only (all scopes intact)
 * - CE4: Authority integrity works without _registry (bulk query from repo)
 * - CE5: Authority repo-only deterministic (correct orphan/split-brain counts)
 * - CE6: Fallback inventory: all 6 REPO_ONLY, 0 COMPAT_ONLY_TEMPORARY
 */

var { describe, it, expect, beforeEach } = require("@jest/globals");

var { getDiagnosticLog, _resetDiagnostics } = require("../core/ontology/diagnostics");
var { createMemoryAdapters } = require("../core/persistence/memory");
var { registerAdapterFactory, _resetAdapterRegistry } = require("../core/persistence/factory");
var { bootstrapPersistence, _resetPersistenceBootstrap, getPersistenceAdapters } = require("../core/persistence/bootstrap");
var {
  createSnapshotPair,
  getSnapshotFromRepo,
  computeScopeChecksum,
  _resetSnapshotStore,
} = require("../core/baseline/snapshot-manager");
var {
  createAuthorityLine,
  checkAuthorityIntegrityFromRepo,
  _resetAuthorityRegistry,
} = require("../core/authority/authority-registry");
var { REPO_FALLBACK_INVENTORY } = require("../core/ontology/p3-closeout");

// ── Test Fixtures ──

var SCOPE_DATA = {
  CONFIG: { maxRetries: 3, timeout: 5000 },
  FLAGS: { enableNewUI: true, darkMode: false },
  ROUTING: { primary: "us-east-1", fallback: "eu-west-1" },
  AUTHORITY: { owner: "admin", level: "root" },
  POLICY: { retention: 90, encryption: "AES256" },
  QUEUE_TOPOLOGY: { queues: ["intake", "process", "output"], concurrency: 4 },
};

// ── Suite ──

describe("P4 Slice 3 — COMPAT_ONLY_TEMPORARY Elimination", function () {
  beforeEach(function () {
    _resetDiagnostics();
    _resetSnapshotStore();
    _resetAuthorityRegistry();
    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
    registerAdapterFactory(createMemoryAdapters);
    bootstrapPersistence();
  });

  it("CE1: snapshot write is full-fidelity — scopePayload has full data", async function () {
    var pair = createSnapshotPair({
      baselineId: "bl-ce1",
      capturedBy: "op-ce1",
      scopeData: SCOPE_DATA,
    });

    // Wait for fire-and-forget dual-write
    await new Promise(function (r) { setTimeout(r, 50); });

    // Read directly from repo adapter
    var adapters = getPersistenceAdapters();
    var result = await adapters.snapshot.findSnapshotBySnapshotId(pair.active.snapshotId);

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.scopePayload).toBeDefined();

    // scopePayload should contain all 6 scopes with full data
    var payload = result.data.scopePayload;
    expect(payload).toHaveLength(6);
    payload.forEach(function (entry) {
      expect(entry.scope).toBeDefined();
      expect(entry.data).toBeDefined();
      expect(Object.keys(entry.data).length).toBeGreaterThan(0);
    });

    // configPayload should also be present
    expect(result.data.configPayload).toBeDefined();
    expect(Object.keys(result.data.configPayload).length).toBe(6);

    // capturedBy and snapshotId preserved
    expect(result.data.capturedBy).toBe("op-ce1");
    expect(result.data.snapshotId).toBe(pair.active.snapshotId);
  });

  it("CE2: snapshot repo-only — nonexistent returns null + REPO_ONLY_PATH_ENFORCED", async function () {
    _resetDiagnostics();

    var result = await getSnapshotFromRepo("snap-nonexistent-" + Date.now());

    expect(result).toBeNull();

    // Should emit REPO_ONLY_PATH_ENFORCED
    var repoOnlyDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "REPO_ONLY_PATH_ENFORCED"
        && d.moduleName === "snapshot-manager";
    });
    expect(repoOnlyDiags.length).toBeGreaterThanOrEqual(1);

    // Should NOT emit COMPAT_ONLY_PATH_USED
    var compatDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "COMPAT_ONLY_PATH_USED";
    });
    expect(compatDiags.length).toBe(0);
  });

  it("CE3: snapshot full round-trip from repo only — all scopes intact", async function () {
    var pair = createSnapshotPair({
      baselineId: "bl-ce3",
      capturedBy: "op-ce3",
      scopeData: SCOPE_DATA,
    });

    // Wait for fire-and-forget dual-write
    await new Promise(function (r) { setTimeout(r, 50); });

    // Clear memory — only repo data remains
    _resetSnapshotStore();

    // Read from repo
    var repoSnap = await getSnapshotFromRepo(pair.active.snapshotId);
    expect(repoSnap).not.toBeNull();

    // All 6 scopes intact
    expect(repoSnap.scopes).toHaveLength(6);
    expect(repoSnap.scopes[0].data).toEqual(SCOPE_DATA.CONFIG);
    expect(repoSnap.scopes[1].data).toEqual(SCOPE_DATA.FLAGS);

    // Config preserved
    expect(Object.keys(repoSnap.config).length).toBe(6);
    expect(repoSnap.config.CONFIG).toEqual(SCOPE_DATA.CONFIG);

    // Metadata preserved
    expect(repoSnap.capturedBy).toBe("op-ce3");
    expect(repoSnap.tag).toBe("ACTIVE");
    expect(repoSnap.baselineId).toBe("bl-ce3");

    // Checksums consistent
    repoSnap.scopes.forEach(function (entry) {
      var recomputed = computeScopeChecksum(entry.scope, entry.data);
      expect(recomputed).toBe(entry.checksum);
    });
  });

  it("CE4: authority integrity works without _registry — bulk query from repo", async function () {
    // Create authority lines (dual-write: _registry + repo store)
    createAuthorityLine("line-ce4-a", "auth-a", "bl-ce4", "actor-1", "cor-ce4-a");
    createAuthorityLine("line-ce4-b", "auth-b", "bl-ce4", "actor-1", "cor-ce4-b");

    // Wait for fire-and-forget dual-write
    await new Promise(function (r) { setTimeout(r, 50); });

    // Clear _registry — repo _store is separate and still has data
    _resetAuthorityRegistry();
    _resetDiagnostics();

    // checkAuthorityIntegrityFromRepo should work using repo bulk query
    var report = await checkAuthorityIntegrityFromRepo();

    // Should succeed (not REPO_UNAVAILABLE)
    expect(report.detail).not.toBe("REPO_UNAVAILABLE");
    expect(report.detail).toBe("INTEGRITY_OK");
    expect(report.splitBrain).toBe(false);
    expect(report.orphanCount).toBe(0);
    expect(report.revokedStillEffective).toBe(false);
    expect(report.pendingResidue).toBe(false);

    // Should emit AUTHORITY_REPO_QUERY_ENABLED
    var repoQueryDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "AUTHORITY_REPO_QUERY_ENABLED";
    });
    expect(repoQueryDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("CE5: authority repo-only deterministic — correct orphan/split-brain counts", async function () {
    // Create 3 lines
    createAuthorityLine("line-ce5-a", "auth-a", "bl-ce5", "actor-1", "cor-ce5-a");
    createAuthorityLine("line-ce5-b", "auth-b", "bl-ce5", "actor-1", "cor-ce5-b");
    createAuthorityLine("line-ce5-c", "auth-c", "bl-ce5", "actor-1", "cor-ce5-c");

    // Wait for fire-and-forget dual-write
    await new Promise(function (r) { setTimeout(r, 50); });

    // Clear _registry and diagnostics
    _resetAuthorityRegistry();
    _resetDiagnostics();

    var report = await checkAuthorityIntegrityFromRepo();

    // 3 active lines, no anomalies
    expect(report.splitBrain).toBe(false);
    expect(report.orphanCount).toBe(0);
    expect(report.revokedStillEffective).toBe(false);
    expect(report.pendingResidue).toBe(false);
    expect(report.detail).toBe("INTEGRITY_OK");

    // No COMPAT_ONLY_PATH_USED emitted
    var compatDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "COMPAT_ONLY_PATH_USED";
    });
    expect(compatDiags.length).toBe(0);
  });

  it("CE6: fallback inventory — all 6 REPO_ONLY, 0 COMPAT_ONLY_TEMPORARY", function () {
    expect(REPO_FALLBACK_INVENTORY).toHaveLength(6);

    var repoOnly = REPO_FALLBACK_INVENTORY.filter(function (e) {
      return e.classification === "REPO_ONLY";
    });
    var compatOnly = REPO_FALLBACK_INVENTORY.filter(function (e) {
      return e.classification === "COMPAT_ONLY_TEMPORARY";
    });

    expect(repoOnly.length).toBe(6);
    expect(compatOnly.length).toBe(0);

    // All should have removedInSlice
    REPO_FALLBACK_INVENTORY.forEach(function (entry) {
      expect(entry.removedInSlice).toBeDefined();
      expect(["P4-2", "P4-3"]).toContain(entry.removedInSlice);
    });

    // Verify the 2 P4-3 entries specifically
    var p43Entries = REPO_FALLBACK_INVENTORY.filter(function (e) {
      return e.removedInSlice === "P4-3";
    });
    expect(p43Entries.length).toBe(2);

    var p43Modules = p43Entries.map(function (e) { return e.moduleName; }).sort();
    expect(p43Modules).toEqual(["authority-registry", "snapshot-manager"]);
  });
});
