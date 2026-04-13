// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Ownership Governance Production Stress Tests
 *
 * 10 scenarios:
 * S1:  Governance lifecycle SoD — author cannot approve own change
 * S2:  Bulk mutation guard — overloaded target blocked
 * S3:  Conflict detection — duplicate scope detected + auto-remediation
 * S4:  Execution queue — staged apply with scope-level failure
 * S5:  Execution rollback — failed_only rollback preserves completed scopes
 * S6:  Audit closure — completeness verification passes/fails correctly
 * S7:  Governance loop state — dashboard → review → execution → audit progression
 * S8:  Invalidation rules — correct panels targeted per trigger
 * S9:  Ownership simulation — reassign impact correctly calculated
 * S10: Rollout — scope-level tracking with partial failure
 */

import { describe, it, expect } from "vitest";

import {
  createOwnershipChangeRequest,
  applyOwnershipLifecycle,
  checkBulkMutationGuard,
  classifyMutationRisk,
  buildOwnershipChangeExplanation,
} from "../ownership-governance-lifecycle-engine";

import {
  detectOwnershipConflicts,
} from "../ownership-conflict-remediation-engine";

import {
  createExecutionQueueItem,
  applyExecutionAction,
} from "../approval-execution-queue-engine";

import {
  createPolicyRollout,
  applyRolloutAction,
  verifyAuditClosure,
  type RolloutAuditSnapshot,
} from "../policy-rollout-audit-closure-engine";

import {
  createGovernanceLoopState,
  applyGovernanceLoopEvent,
  getInvalidationTargets,
} from "../ownership-governance-loop-closure-engine";

import type { OwnershipRecord } from "../multi-team-ownership-engine";
import type { OwnershipChangeRequest } from "../ownership-governance-lifecycle-engine";

function makeRecord(overrides: Partial<OwnershipRecord> = {}): OwnershipRecord {
  return {
    recordId: `own_${Math.random().toString(36).slice(2, 6)}`,
    ownershipType: "approval_owner",
    ownerId: "owner_1", ownerName: "Owner A", ownerRole: "approver",
    ownerTeamId: "team_1", ownerDepartmentId: "dept_1",
    scopeType: "team", scopeId: "team_1", scopeLabel: "Team A",
    domain: "fire_execution", policyDomain: null,
    active: true, effectiveFrom: new Date().toISOString(), effectiveUntil: null,
    fallbackOwnerId: null, fallbackOwnerName: null,
    assignedBy: "admin_1", assignedAt: new Date().toISOString(), reason: "test",
    ...overrides,
  };
}

function makeAuditSnapshot(overrides: Partial<RolloutAuditSnapshot> = {}): RolloutAuditSnapshot {
  return {
    beforePolicyVersionId: "v1", beforeRuleCount: 5, afterRuleCount: 7,
    decisionMaker: "admin_1", decisionMakerRole: "admin",
    decisionRationale: "Policy update", decisionTimestamp: new Date().toISOString(),
    reviewerId: "reviewer_1", reviewDecision: "approved", reviewComment: "OK",
    simulationSummary: "3 tightened", simulationImpact: "tightened", simulationWarnings: [],
    effectiveDate: new Date().toISOString(), effectiveDateBasis: "immediate",
    appliedTimestamp: null, revertedTimestamp: null, revertReason: "",
    invalidatedApprovalCount: 2, invalidatedSnapshotCount: 1, staleInboxItemCount: 3,
    ...overrides,
  };
}

describe("Ownership Governance Production Stress", () => {

  // S1: SoD
  it("S1: author cannot approve own ownership change request", () => {
    const cr = createOwnershipChangeRequest("reassign", "fire_execution", [], [], "Reassign test", "Detail", "immediate", "author_1", "admin");
    // Submit for review
    const submitted = applyOwnershipLifecycle(cr, { action: "submit_for_review", actor: "author_1", actorRole: "admin", timestamp: new Date().toISOString() });
    expect(submitted.applied).toBe(true);

    // Same person tries to approve → rejected
    const selfApprove = applyOwnershipLifecycle(submitted.updatedRequest, { action: "approve_review", actor: "author_1", actorRole: "admin", timestamp: new Date().toISOString() });
    expect(selfApprove.applied).toBe(false);
    expect(selfApprove.rejectedReason).toContain("SoD");

    // Different person can approve
    const otherApprove = applyOwnershipLifecycle(submitted.updatedRequest, { action: "approve_review", actor: "reviewer_1", actorRole: "admin", comment: "OK", timestamp: new Date().toISOString() });
    expect(otherApprove.applied).toBe(true);
    expect(otherApprove.updatedRequest.status).toBe("approved");
  });

  // S2: Bulk mutation guard
  it("S2: overloaded target owner is blocked for reassignment", () => {
    const guard = checkBulkMutationGuard("reassign", "fire_execution", 5, 85);
    expect(guard.allowed).toBe(false);
    expect(guard.blockReasons.some(r => r.includes("과부하"))).toBe(true);

    // Non-overloaded target is allowed
    const guard2 = checkBulkMutationGuard("reassign", "fire_execution", 5, 30);
    expect(guard2.allowed).toBe(true);
    expect(guard2.requiresSimulation).toBe(true); // governed + count > 5
  });

  // S3: Conflict detection + auto-remediation
  it("S3: duplicate scope conflict detected with autoRemediable fix", () => {
    const records = [
      makeRecord({ recordId: "dup_1", scopeType: "team", scopeId: "team_dup", domain: "fire_execution" }),
      makeRecord({ recordId: "dup_2", scopeType: "team", scopeId: "team_dup", domain: "fire_execution", ownerId: "owner_2", ownerName: "Owner B" }),
    ];

    const result = detectOwnershipConflicts(records, [], []);
    expect(result.totalConflicts).toBeGreaterThan(0);
    const dupConflict = result.conflicts.find(c => c.type === "duplicate_scope");
    expect(dupConflict).toBeDefined();
    expect(dupConflict!.autoRemediable).toBe(true);
    expect(dupConflict!.remediationActions.length).toBeGreaterThan(0);
  });

  // S4: Execution queue — staged apply with failure
  it("S4: staged execution tracks scope-level completion and failure", () => {
    const cr = createOwnershipChangeRequest("transfer", "all", [], [], "Transfer", "Site migration", "immediate", "admin_1", "admin");
    const scopes = [
      { scopeId: "scope_a", scopeLabel: "A", recordIds: ["r1"] },
      { scopeId: "scope_b", scopeLabel: "B", recordIds: ["r2"] },
      { scopeId: "scope_c", scopeLabel: "C", recordIds: ["r3"] },
    ];
    let item = createExecutionQueueItem(cr, scopes);
    expect(item.staged).toBe(true);
    expect(item.totalStages).toBe(3);

    // Start
    const started = applyExecutionAction(item, { action: "start_execution", actor: "admin_1", timestamp: new Date().toISOString() });
    expect(started.updatedItem.status).toBe("executing");

    // Complete A, fail B, complete C
    const doneA = applyExecutionAction(started.updatedItem, { action: "complete_scope", actor: "admin_1", scopeId: "scope_a", timestamp: new Date().toISOString() });
    const failB = applyExecutionAction(doneA.updatedItem, { action: "fail_scope", actor: "admin_1", scopeId: "scope_b", failureReason: "Network timeout", timestamp: new Date().toISOString() });
    const doneC = applyExecutionAction(failB.updatedItem, { action: "complete_scope", actor: "admin_1", scopeId: "scope_c", timestamp: new Date().toISOString() });

    // Complete all → partial_failure
    const completed = applyExecutionAction(doneC.updatedItem, { action: "complete_all", actor: "admin_1", timestamp: new Date().toISOString() });
    expect(completed.updatedItem.status).toBe("partial_failure");
    expect(completed.updatedItem.completedScopes).toBe(2);
    expect(completed.updatedItem.failedScopes).toBe(1);
  });

  // S5: Rollback failed_only
  it("S5: failed_only rollback preserves completed scopes", () => {
    const cr = createOwnershipChangeRequest("transfer", "all", [], [], "Test", "", "immediate", "a", "admin");
    let item = createExecutionQueueItem(cr, [
      { scopeId: "s1", scopeLabel: "S1", recordIds: ["r1"] },
      { scopeId: "s2", scopeLabel: "S2", recordIds: ["r2"] },
    ]);
    item = applyExecutionAction(item, { action: "start_execution", actor: "a", timestamp: new Date().toISOString() }).updatedItem;
    item = applyExecutionAction(item, { action: "complete_scope", scopeId: "s1", actor: "a", timestamp: new Date().toISOString() }).updatedItem;
    item = applyExecutionAction(item, { action: "fail_scope", scopeId: "s2", actor: "a", failureReason: "err", timestamp: new Date().toISOString() }).updatedItem;
    item = applyExecutionAction(item, { action: "complete_all", actor: "a", timestamp: new Date().toISOString() }).updatedItem;

    const rollback = applyExecutionAction(item, { action: "rollback", actor: "a", rollbackScope: "failed_only", timestamp: new Date().toISOString() });
    expect(rollback.updatedItem.status).toBe("rolled_back");
    // S1 (completed) stays as "applied", S2 (failed) becomes "rolled_back"
    expect(rollback.updatedItem.scopeResults.find(s => s.scopeId === "s1")!.status).toBe("applied");
    expect(rollback.updatedItem.scopeResults.find(s => s.scopeId === "s2")!.status).toBe("rolled_back");
  });

  // S6: Audit closure completeness
  it("S6: audit closure detects missing fields", () => {
    const rollout = createPolicyRollout("ps1", "v2", "budget", "publish", [{ scopeType: "organization", scopeId: "org1", scopeLabel: "Org", ownershipIds: [], approvalIds: [] }],
      makeAuditSnapshot({ reviewerId: null }), "admin_1");

    const started = applyRolloutAction(rollout, { action: "start", actor: "admin_1", timestamp: new Date().toISOString() });
    const scopeDone = applyRolloutAction(started.updatedRollout, { action: "complete_scope", scopeId: "org1", actor: "admin_1", timestamp: new Date().toISOString() });
    const completed = applyRolloutAction(scopeDone.updatedRollout, { action: "complete", actor: "admin_1", timestamp: new Date().toISOString() });

    const closure = verifyAuditClosure(completed.updatedRollout);
    expect(closure.closed).toBe(false);
    expect(closure.missingFields).toContain("reviewerId");
    expect(closure.completenessScore).toBeLessThan(100);

    // Fix reviewer and verify again
    completed.updatedRollout.auditSnapshot.reviewerId = "rev_1";
    const closure2 = verifyAuditClosure(completed.updatedRollout);
    expect(closure2.closed).toBe(true);
    expect(closure2.completenessScore).toBe(100);
  });

  // S7: Governance loop state progression
  it("S7: loop state progresses dashboard → review → execution → audit → completed", () => {
    let state = createGovernanceLoopState();
    expect(state.currentStep).toBe("dashboard");

    state = applyGovernanceLoopEvent(state, { type: "enter_review", changeRequestId: "cr_1", fromPanel: "owner_backlog" });
    expect(state.currentStep).toBe("review");
    expect(state.returnToDashboardPanel).toBe("owner_backlog");

    state = applyGovernanceLoopEvent(state, { type: "enter_execution", executionId: "exec_1" });
    expect(state.currentStep).toBe("execution");

    state = applyGovernanceLoopEvent(state, { type: "enter_audit", rolloutId: "roll_1" });
    expect(state.currentStep).toBe("audit_closure");

    state = applyGovernanceLoopEvent(state, { type: "loop_completed" });
    expect(state.currentStep).toBe("completed");
    expect(state.auditClosed).toBe(true);
  });

  // S8: Invalidation rules
  it("S8: correct panels invalidated per governance trigger", () => {
    const applyTargets = getInvalidationTargets("ownership_change_applied");
    expect(applyTargets).toContain("owner_backlog");
    expect(applyTargets).toContain("ownership_coverage");
    expect(applyTargets).not.toContain("rollout_history");

    const revertTargets = getInvalidationTargets("ownership_reverted");
    // "all_ownership_panels" → expands to everything
    expect(revertTargets.length).toBeGreaterThanOrEqual(8);
    expect(revertTargets).toContain("owner_backlog");
    expect(revertTargets).toContain("audit_closure_status");

    const auditTargets = getInvalidationTargets("audit_closed");
    expect(auditTargets).toContain("audit_closure_status");
    expect(auditTargets).toContain("rollout_history");
    expect(auditTargets).not.toContain("owner_backlog");
  });

  // S9: Mutation risk classification
  it("S9: mutation risk escalates for critical domain and bulk", () => {
    expect(classifyMutationRisk("assign", null, 1)).toBe("immediate");
    expect(classifyMutationRisk("assign", "fire_execution", 1)).toBe("reviewed"); // critical domain
    expect(classifyMutationRisk("update", null, 1)).toBe("reviewed");
    expect(classifyMutationRisk("update", null, 5)).toBe("governed"); // bulk > 3
    expect(classifyMutationRisk("reassign", null, 1)).toBe("governed"); // always governed
    expect(classifyMutationRisk("transfer", null, 1)).toBe("governed");
  });

  // S10: Change explanation
  it("S10: ownership change explanation includes all required fields", () => {
    const before = [makeRecord({ ownerName: "Old Owner" })];
    const after = [makeRecord({ ownerName: "New Owner", ownerId: "new_1" })];
    const cr = createOwnershipChangeRequest("reassign", "fire_execution", before, after, "Reassign", "Overload fix", "immediate", "admin_1", "admin");

    const explanation = buildOwnershipChangeExplanation(cr);
    expect(explanation.whyThisChange.length).toBeGreaterThan(0);
    expect(explanation.whyThisOwner.length).toBeGreaterThan(0);
    expect(explanation.whyApprovalNeeded.length).toBeGreaterThan(0);
    expect(explanation.affectedQueues.length).toBeGreaterThan(0);
    expect(explanation.beforeOwnerMapping.length).toBeGreaterThan(0);
    expect(explanation.afterOwnerMapping.length).toBeGreaterThan(0);
  });
});
