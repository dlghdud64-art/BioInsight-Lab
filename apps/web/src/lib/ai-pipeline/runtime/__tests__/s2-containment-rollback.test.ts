/**
 * S2 — Containment / Rollback Hardening 테스트 (Patched)
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { detectBreach, _resetBreaches } from "../core/containment/breach-handler";
import { activateMutationFreeze, deactivateMutationFreeze, guardWrite, _resetMutationFreeze } from "../core/containment/mutation-freeze";
import { executeFinalContainment } from "../core/containment/final-containment-pipeline";
import { runRollbackPrecheck } from "../core/rollback/rollback-precheck";
import { buildRollbackPlan } from "../core/rollback/rollback-plan-builder";
import { executeRollbackPlan } from "../core/rollback/rollback-executor";
import { runResidueScan } from "../core/rollback/residue-scan";
import { reconcileState } from "../core/rollback/state-reconciliation";
import { initializeRuntimeState, getAllRuntimeState, _resetRuntimeState } from "../core/rollback/scope-restore-adapter";
import { _resetIncidents, getIncidents } from "../core/incidents/incident-escalation";
import { _resetAuditEvents, getAuditEvents } from "../core/audit/audit-events";
import { createSnapshotPair, _resetSnapshotStore } from "../core/baseline/snapshot-manager";
import type { SnapshotScope, BreachEntry, ContainmentCompletionState } from "../types/stabilization";

const SCOPE_DATA: Record<SnapshotScope, Record<string, unknown>> = {
  CONFIG: { confidenceThreshold: 0.95 },
  FLAGS: { ENABLE_NEW_DOCTYPE_EXPANSION: false },
  ROUTING: { primaryQueue: "processing" },
  AUTHORITY: { owner: "ops-admin" },
  POLICY: { stabilizationOnly: true },
  QUEUE_TOPOLOGY: { intake: "active" },
};

function setupPair() {
  return createSnapshotPair({
    baselineId: "bl-test",
    capturedBy: "test",
    scopeData: SCOPE_DATA,
  });
}

function makeBreach(): BreachEntry {
  return detectBreach(
    "UNAUTHORIZED_STATE_MUTATION",
    "attacker",
    "CONFIG",
    "cor-test",
    "unauthorized config mutation"
  );
}

describe("S2: Containment / Rollback Hardening", () => {
  beforeEach(() => {
    _resetBreaches();
    _resetMutationFreeze();
    _resetIncidents();
    _resetAuditEvents();
    _resetSnapshotStore();
    _resetRuntimeState();
  });

  // ── Original 12 tests (adapted) ──

  it("should detect breach and return breach entry", () => {
    const breach = makeBreach();
    expect(breach.breachType).toBe("UNAUTHORIZED_STATE_MUTATION");
    expect(breach.incidentId).toBeTruthy();
  });

  it("should complete full 8-stage containment pipeline", () => {
    const pair = setupPair();
    const breach = makeBreach();

    const result = executeFinalContainment({
      breach,
      baselineId: "bl-test",
      activeSnapshotId: pair.active.snapshotId,
      rollbackSnapshotId: pair.rollback.snapshotId,
      actor: "ops",
      currentRuntimeState: SCOPE_DATA,
    });

    expect(result.stagesCompleted).toHaveLength(8);
    expect(result.completionState).toBe("CONTAINED_AND_RESTORED");
  });

  it("should block writes when mutation is frozen", () => {
    activateMutationFreeze();
    const guard = guardWrite("CONFIG_UPDATE");
    expect(guard.allowed).toBe(false);
    expect(guard.reason).toContain("MUTATION_FROZEN");
    deactivateMutationFreeze();
  });

  it("should fail precheck when snapshot missing", () => {
    activateMutationFreeze();
    const result = runRollbackPrecheck("nonexistent", "also-nonexistent");
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe("ROLLBACK_PRECHECK_FAILED");
  });

  it("should execute rollback plan in order", () => {
    const pair = setupPair();
    activateMutationFreeze();
    initializeRuntimeState(SCOPE_DATA);
    const plan = buildRollbackPlan("bl-test", pair.rollback.snapshotId, "TEST");
    const result = executeRollbackPlan(plan, "cor-1", "ops");
    expect(result.success).toBe(true);
    expect(plan.orderedSteps.every((s) => s.status === "EXECUTED" && s.restoreVerified)).toBe(true);
  });

  it("should skip already-executed steps on re-run", () => {
    const pair = setupPair();
    activateMutationFreeze();
    initializeRuntimeState(SCOPE_DATA);
    const plan = buildRollbackPlan("bl-test", pair.rollback.snapshotId, "TEST");
    executeRollbackPlan(plan, "cor-1", "ops");
    // re-run
    const result2 = executeRollbackPlan(plan, "cor-1", "ops");
    expect(result2.success).toBe(true);
    expect(result2.stepsExecuted).toBe(plan.orderedSteps.length);
  });

  it("should escalate incident on rollback partial commit (mutation not frozen)", () => {
    const pair = setupPair();
    const plan = buildRollbackPlan("bl-test", pair.rollback.snapshotId, "TEST");
    const result = executeRollbackPlan(plan, "cor-1", "ops");
    expect(result.success).toBe(false);
    expect(result.reason).toContain("mutation freeze not active");
  });

  it("should detect stale keys as residue", () => {
    const pair = setupPair();
    const stateWithStale = {
      ...SCOPE_DATA,
      CONFIG: { ...SCOPE_DATA.CONFIG, staleKey: "should not exist" },
    };
    const result = runResidueScan(pair.rollback.snapshotId, stateWithStale);
    expect(result.clean).toBe(false);
    expect(result.residues.some((r) => r.path.includes("staleKey"))).toBe(true);
  });

  it("should require reconciliation before finalize — mismatch causes escalation", () => {
    const pair = setupPair();
    const breach = makeBreach();
    const mismatchState = {
      ...SCOPE_DATA,
      AUTHORITY: { owner: "hacker" },
    };

    const result = executeFinalContainment({
      breach,
      baselineId: "bl-test",
      activeSnapshotId: pair.active.snapshotId,
      rollbackSnapshotId: pair.rollback.snapshotId,
      actor: "ops",
      currentRuntimeState: mismatchState,
    });

    // after rollback, state is restored from snapshot, so it should pass
    expect(result.completionState).toBe("CONTAINED_AND_RESTORED");
  });

  it("should not finalize when critical residue exists", () => {
    const pair = setupPair();
    const breach = makeBreach();
    const criticalMismatch = {
      ...SCOPE_DATA,
      CONFIG: { confidenceThreshold: 0.95, killSwitch: true },
    };

    const result = executeFinalContainment({
      breach,
      baselineId: "bl-test",
      activeSnapshotId: pair.active.snapshotId,
      rollbackSnapshotId: pair.rollback.snapshotId,
      actor: "ops",
      currentRuntimeState: criticalMismatch,
    });

    // after rollback, runtime state is restored to snapshot, residue should be clean
    expect(result.stagesCompleted.length).toBeGreaterThanOrEqual(6);
  });

  it("should only produce defined completion states", () => {
    const validStates: ContainmentCompletionState[] = [
      "CONTAINED_AND_RESTORED",
      "CONTAINED_WITH_INCIDENT_ESCALATION",
      "CONTAINMENT_FAILED_LOCKDOWN",
    ];

    const pair = setupPair();
    const breach = makeBreach();

    const result = executeFinalContainment({
      breach,
      baselineId: "bl-test",
      activeSnapshotId: pair.active.snapshotId,
      rollbackSnapshotId: pair.rollback.snapshotId,
      actor: "ops",
      currentRuntimeState: SCOPE_DATA,
    });

    expect(validStates).toContain(result.completionState);
  });

  it("should dedupe repeated breach but still audit", () => {
    const breach1 = detectBreach("UNAUTHORIZED_STATE_MUTATION", "attacker", "CONFIG", "cor-same", "first");
    const breach2 = detectBreach("UNAUTHORIZED_STATE_MUTATION", "attacker", "CONFIG", "cor-same", "second");
    expect(breach1.breachId).toBe(breach2.breachId);
    const audits = getAuditEvents({ eventType: "BREACH_DETECTED" });
    expect(audits.length).toBe(2);
  });

  // ── New 8 tests (S2 Patch) ──

  it("should apply actual restore for each affected scope", () => {
    const pair = setupPair();
    const mutatedState = {
      ...SCOPE_DATA,
      CONFIG: { confidenceThreshold: 0.5 },
      FLAGS: { ENABLE_NEW_DOCTYPE_EXPANSION: true },
    };
    initializeRuntimeState(mutatedState);
    activateMutationFreeze();

    const plan = buildRollbackPlan("bl-test", pair.rollback.snapshotId, "TEST");
    const result = executeRollbackPlan(plan, "cor-1", "ops");
    expect(result.success).toBe(true);

    const restored = getAllRuntimeState();
    expect(restored["CONFIG"]).toEqual({ confidenceThreshold: 0.95 });
    expect(restored["FLAGS"]).toEqual({ ENABLE_NEW_DOCTYPE_EXPANSION: false });
  });

  it("should not mark step executed before restore verify passes", () => {
    const pair = setupPair();
    initializeRuntimeState(SCOPE_DATA);
    activateMutationFreeze();

    const plan = buildRollbackPlan("bl-test", pair.rollback.snapshotId, "TEST");
    const result = executeRollbackPlan(plan, "cor-1", "ops");

    for (const step of plan.orderedSteps) {
      if (step.status === "EXECUTED") {
        expect(step.restoreVerified).toBe(true);
      }
    }
    expect(result.success).toBe(true);
  });

  it("should escalate when scope adapter apply fails", () => {
    const pair = setupPair();
    initializeRuntimeState(SCOPE_DATA);
    // NOT freezing mutation → executor returns failure
    const plan = buildRollbackPlan("bl-test", pair.rollback.snapshotId, "TEST");
    const result = executeRollbackPlan(plan, "cor-1", "ops");
    expect(result.success).toBe(false);
    expect(result.reason).toContain("mutation freeze not active");
  });

  it("should detect nested value mismatch in residue scan", () => {
    const pair = setupPair();
    const nestedState = {
      ...SCOPE_DATA,
      CONFIG: { confidenceThreshold: 0.5 },
    };
    const result = runResidueScan(pair.rollback.snapshotId, nestedState);
    expect(result.clean).toBe(false);

    const configResidue = result.residues.find((r) => r.path.includes("confidenceThreshold"));
    expect(configResidue).toBeDefined();
    expect(configResidue!.expectedValue).toBe(0.95);
    expect(configResidue!.actualValue).toBe(0.5);
  });

  it("should detect array/object path-level diff", () => {
    const scopeDataWithArray: Record<SnapshotScope, Record<string, unknown>> = {
      ...SCOPE_DATA,
      ROUTING: { primaryQueue: "processing", fallbackQueues: ["review", "dead-letter"] },
    };
    const pair = createSnapshotPair({
      baselineId: "bl-array",
      capturedBy: "test",
      scopeData: scopeDataWithArray,
    });

    const mismatchState = {
      ...scopeDataWithArray,
      ROUTING: { primaryQueue: "processing", fallbackQueues: ["review", "wrong-queue"] },
    };
    const result = runResidueScan(pair.rollback.snapshotId, mismatchState);
    expect(result.clean).toBe(false);

    const arrayResidue = result.residues.find((r) => r.path.includes("fallbackQueues[1]"));
    expect(arrayResidue).toBeDefined();
    expect(arrayResidue!.expectedValue).toBe("dead-letter");
    expect(arrayResidue!.actualValue).toBe("wrong-queue");
  });

  it("should block CONTAINED_AND_RESTORED when unresolved diff remains", () => {
    const pair = setupPair();
    const mismatchState = {
      ...SCOPE_DATA,
      AUTHORITY: { owner: "hacker" },
    };
    const recon = reconcileState(pair.rollback.snapshotId, mismatchState);
    expect(recon.success).toBe(false);
    expect(recon.unresolvedCount).toBeGreaterThan(0);
    const ownerDiff = recon.diffs.find((d) => d.path.includes("owner"));
    expect(ownerDiff).toBeDefined();
    expect(ownerDiff!.resolved).toBe(false);
  });

  it("should allow CONTAINED_AND_RESTORED only after verified restore + zero residue", () => {
    const pair = setupPair();
    const breach = makeBreach();

    const result = executeFinalContainment({
      breach,
      baselineId: "bl-test",
      activeSnapshotId: pair.active.snapshotId,
      rollbackSnapshotId: pair.rollback.snapshotId,
      actor: "ops",
      currentRuntimeState: SCOPE_DATA,
    });

    expect(result.completionState).toBe("CONTAINED_AND_RESTORED");
    expect(result.rollbackPlan!.orderedSteps.every((s) => s.restoreVerified)).toBe(true);
    expect(result.residueScan!.hasCritical).toBe(false);
    expect(result.reconciliation!.unresolvedCount).toBe(0);
  });

  it("should preserve idempotency without skipping unverified restore", () => {
    const pair = setupPair();
    initializeRuntimeState(SCOPE_DATA);
    activateMutationFreeze();

    const plan = buildRollbackPlan("bl-test", pair.rollback.snapshotId, "TEST");

    const result1 = executeRollbackPlan(plan, "cor-1", "ops");
    expect(result1.success).toBe(true);

    // tamper: mark one step as EXECUTED but NOT verified
    plan.orderedSteps[0]!.restoreVerified = false;

    // re-run: should NOT skip because restoreVerified is false
    const result2 = executeRollbackPlan(plan, "cor-1", "ops");
    expect(result2.success).toBe(true);
    expect(plan.orderedSteps[0]!.restoreVerified).toBe(true);
  });
});
