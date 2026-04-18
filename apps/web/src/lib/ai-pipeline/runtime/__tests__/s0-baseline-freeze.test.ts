// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass
/**
 * S0 — Baseline Freeze 테스트
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCanonicalBaseline,
  getCanonicalBaseline,
  assertSingleCanonical,
  invalidateCanonicalBaseline,
  isCanonicalActiveCombination,
  _resetBaselineRegistry,
} from "../core/baseline/baseline-registry";
import {
  createSnapshotPair,
  verifySnapshotPairExists,
  canEnterActiveRuntimeFromRepo,
  restoreDryRunFromRepo,
  _resetSnapshotStore,
} from "../core/baseline/snapshot-manager";
import { validateBaselineAtBoot } from "../core/baseline/baseline-validator";
import { createMemoryAdapters } from "../core/persistence/memory";
import { registerAdapterFactory, _resetAdapterRegistry } from "../core/persistence/factory";
import { bootstrapPersistence, _resetPersistenceBootstrap } from "../core/persistence/bootstrap";
import { evaluateFreezeGate } from "../core/governance/stabilization-policy";
import { evaluateMergeGate } from "../core/governance/merge-gate";
import { isCanonicalActiveRuntime, getActiveRuntimeBlockReason } from "../core/runtime/lifecycle";
import type { SnapshotScope } from "../types/stabilization";

const SCOPE_DATA: Record<SnapshotScope, Record<string, unknown>> = {
  CONFIG: { confidenceThreshold: 0.95, model: "gpt-4o" },
  FLAGS: { ENABLE_NEW_DOCTYPE_EXPANSION: false, ENABLE_AUTO_VERIFY_EXPANSION: false },
  ROUTING: { primaryQueue: "processing", fallbackQueue: "review" },
  AUTHORITY: { owner: "ops-admin", transferLock: true },
  POLICY: { stabilizationOnly: true, featureExpansion: false },
  QUEUE_TOPOLOGY: { intake: "active", deadLetter: "active", review: "active" },
};

function createTestBaseline() {
  const pair = createSnapshotPair({
    baselineId: "test-baseline",
    capturedBy: "test",
    scopeData: SCOPE_DATA,
  });
  return createCanonicalBaseline({
    documentType: "QUOTE",
    baselineVersion: "1.0.0",
    activeSnapshotId: pair.active.snapshotId,
    rollbackSnapshotId: pair.rollback.snapshotId,
    activePathManifestId: "manifest-v1",
    policySetVersion: "policy-v1",
    routingRuleVersion: "routing-v1",
    authorityRegistryVersion: "authority-v1",
    freezeReason: "S0 baseline freeze",
    performedBy: "test",
  });
}

describe("S0: Baseline Freeze", () => {
  beforeEach(() => {
    _resetBaselineRegistry();
    _resetSnapshotStore();
    _resetAdapterRegistry();
    _resetPersistenceBootstrap();
    registerAdapterFactory(createMemoryAdapters);
    bootstrapPersistence();
  });

  // 1. canonical baseline uniqueness test
  it("should allow only one canonical baseline", () => {
    const pair = createSnapshotPair({
      baselineId: "bl-1",
      capturedBy: "test",
      scopeData: SCOPE_DATA,
    });
    createCanonicalBaseline({
      documentType: "QUOTE",
      baselineVersion: "1.0.0",
      activeSnapshotId: pair.active.snapshotId,
      rollbackSnapshotId: pair.rollback.snapshotId,
      activePathManifestId: "m1",
      policySetVersion: "p1",
      routingRuleVersion: "r1",
      authorityRegistryVersion: "a1",
      freezeReason: "test",
      performedBy: "tester",
    });

    // second attempt should throw
    expect(() =>
      createCanonicalBaseline({
        documentType: "INVOICE",
        baselineVersion: "1.0.1",
        activeSnapshotId: "snap-2",
        rollbackSnapshotId: "snap-3",
        activePathManifestId: "m2",
        policySetVersion: "p2",
        routingRuleVersion: "r2",
        authorityRegistryVersion: "a2",
        freezeReason: "test2",
        performedBy: "tester",
      })
    ).toThrow("DUPLICATE_CANONICAL");
  });

  // 2. canonical active baseline valid combination test
  it("should only accept ACTIVE_100 + FULL_ACTIVE_STABILIZATION + FROZEN as valid", () => {
    expect(isCanonicalActiveCombination("ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "FROZEN")).toBe(true);
    expect(isCanonicalActiveCombination("ACTIVE_50", "FULL_ACTIVE_STABILIZATION", "FROZEN")).toBe(false);
    expect(isCanonicalActiveCombination("ACTIVE_100", "CANARY_ROLLOUT", "FROZEN")).toBe(false);
    expect(isCanonicalActiveCombination("ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "UNFROZEN")).toBe(false);
  });

  // 3. freeze flag enforcement test
  it("should enforce freeze flags during boot validation", async () => {
    const baseline = createTestBaseline();
    await new Promise((r) => setTimeout(r, 50));
    const result = await validateBaselineAtBoot(
      {
        lifecycleState: "ACTIVE_100",
        releaseMode: "FULL_ACTIVE_STABILIZATION",
        baselineStatus: "FROZEN",
        baselineHash: baseline.baselineHash,
      },
      { stabilizationOnly: true, featureExpansionAllowed: false, devOnlyPathAllowed: false }
    );
    const freezeCheck = result.checks.find((c) => c.name === "freeze_flag_enforcement");
    expect(freezeCheck?.passed).toBe(true);

    // violated flags
    const result2 = await validateBaselineAtBoot(
      {
        lifecycleState: "ACTIVE_100",
        releaseMode: "FULL_ACTIVE_STABILIZATION",
        baselineStatus: "FROZEN",
        baselineHash: baseline.baselineHash,
      },
      { stabilizationOnly: false, featureExpansionAllowed: true, devOnlyPathAllowed: true }
    );
    const freezeCheck2 = result2.checks.find((c) => c.name === "freeze_flag_enforcement");
    expect(freezeCheck2?.passed).toBe(false);
    expect(result2.blocksActiveRuntime).toBe(true);
  });

  // 4. expansion deny test
  it("should deny feature expansion changes via freeze gate", () => {
    const result = evaluateFreezeGate(
      {
        stabilizationTag: "STABILIZATION_001",
        changeClass: "NEW_FEATURE" as any,
        justification: "want to add feature",
        rollbackImpact: "none",
        auditLink: "https://audit/1",
      },
      true
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("BLOCKED_CHANGE_CLASS");
  });

  // 5. snapshot restore dry-run test (P4-4: uses repo-first path)
  it("should pass restore dry-run for valid snapshots", async () => {
    const pair = createSnapshotPair({
      baselineId: "bl-test",
      capturedBy: "test",
      scopeData: SCOPE_DATA,
    });
    await new Promise((r) => setTimeout(r, 50));
    const dryRun = await restoreDryRunFromRepo(pair.rollback.snapshotId);
    expect(dryRun.success).toBe(true);
    expect(dryRun.scopeResults).toHaveLength(6);
    expect(dryRun.scopeResults.every((s: { checksumMatch: boolean; restorable: boolean }) => s.checksumMatch && s.restorable)).toBe(true);
  });

  // 6. boot mismatch reject test
  it("should reject boot validation on hash mismatch", async () => {
    const baseline = createTestBaseline();
    await new Promise((r) => setTimeout(r, 50));
    const result = await validateBaselineAtBoot(
      {
        lifecycleState: "ACTIVE_100",
        releaseMode: "FULL_ACTIVE_STABILIZATION",
        baselineStatus: "FROZEN",
        baselineHash: "wrong-hash-value",
      },
      { stabilizationOnly: true, featureExpansionAllowed: false, devOnlyPathAllowed: false }
    );
    expect(result.valid).toBe(false);
    expect(result.incidentRequired).toBe(true);
    const hashCheck = result.checks.find((c) => c.name === "baseline_hash_match");
    expect(hashCheck?.passed).toBe(false);
  });

  // 7. non-stabilization patch deny test
  it("should deny merge without stabilization tag", () => {
    const result = evaluateMergeGate(
      {
        changeClass: "ROLLBACK_RELIABILITY_FIX",
        justification: "Fixing rollback path latency issue",
        rollbackImpact: "low",
        auditLink: "https://audit/2",
        // no stabilizationTag!
      },
      true
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("MISSING_METADATA");
    expect(result.missingFields).toContain("stabilizationTag");
  });

  // Extra: snapshot pair blocks active runtime when missing (P4-4: async repo-first)
  it("should block active runtime when snapshot pair is missing", async () => {
    const check = await canEnterActiveRuntimeFromRepo("nonexistent-active", "nonexistent-rollback");
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("BLOCKED");
  });

  // Extra: canonical active runtime check
  it("should identify canonical active runtime correctly", () => {
    expect(
      isCanonicalActiveRuntime({
        lifecycleState: "ACTIVE_100",
        releaseMode: "FULL_ACTIVE_STABILIZATION",
        baselineStatus: "FROZEN",
        stabilizationOnly: true,
        featureExpansionAllowed: false,
        devOnlyPathAllowed: false,
      })
    ).toBe(true);

    expect(
      getActiveRuntimeBlockReason({
        lifecycleState: "ACTIVE_100",
        releaseMode: "FULL_ACTIVE_STABILIZATION",
        baselineStatus: "FROZEN",
        stabilizationOnly: true,
        featureExpansionAllowed: true, // violation
        devOnlyPathAllowed: false,
      })
    ).toBe("FEATURE_EXPANSION_ALLOWED_TRUE");
  });

  // Extra: valid merge gate pass
  it("should allow valid stabilization change through merge gate", () => {
    const result = evaluateMergeGate(
      {
        stabilizationTag: "STABILIZATION_001",
        changeClass: "CONTAINMENT_HARDENING",
        justification: "Hardening containment path for ACTIVE_100 stabilization",
        rollbackImpact: "low — no behavioral change in happy path",
        auditLink: "https://audit/3",
      },
      true
    );
    expect(result.allowed).toBe(true);
  });
});
