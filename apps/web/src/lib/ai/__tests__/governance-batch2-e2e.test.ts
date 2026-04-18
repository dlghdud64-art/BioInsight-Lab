// @ts-nocheck — Phase 3 tsc residual, Phase 4 deferred
/**
 * Governance Batch 2 핵심 E2E 4종
 *
 * cross-surface / cross-state 루프 검증:
 * E2E-1: Happy Path — draft → review → approve → execute → audit close
 * E2E-2: Conflict Remediation — conflict detect → remediate → review → approve
 * E2E-3: Partial Failure / Rollback — staged apply → partial fail → rollback → re-verify
 * E2E-4: Audit Closure Integrity — decision snapshot completeness end-to-end
 */

import { describe, it, expect } from "vitest";

import {
  createOwnershipChangeRequest,
  applyOwnershipLifecycle,
  checkBulkMutationGuard,
  buildOwnershipChangeExplanation,
  type OwnershipChangeRequest,
} from "../ownership-governance-lifecycle-engine";

import {
  detectOwnershipConflicts,
  type DetectedConflict,
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
  applyOwnershipAuthoring,
} from "../ownership-authoring-engine";

import {
  createGovernanceLoopState,
  applyGovernanceLoopEvent,
  getInvalidationTargets,
} from "../ownership-governance-loop-closure-engine";

import type { OwnershipRecord } from "../multi-team-ownership-engine";

// ── Helpers ──
function makeRecord(overrides: Partial<OwnershipRecord> = {}): OwnershipRecord {
  return {
    recordId: `own_${Math.random().toString(36).slice(2, 8)}`,
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
    decisionRationale: "Ownership restructure", decisionTimestamp: new Date().toISOString(),
    reviewerId: "reviewer_1", reviewDecision: "approved", reviewComment: "Looks good",
    simulationSummary: "Positive impact", simulationImpact: "positive", simulationWarnings: [],
    effectiveDate: new Date().toISOString(), effectiveDateBasis: "immediate",
    appliedTimestamp: null, revertedTimestamp: null, revertReason: "",
    invalidatedApprovalCount: 0, invalidatedSnapshotCount: 0, staleInboxItemCount: 0,
    ...overrides,
  };
}

// ══════════════════════════════════════════════
// E2E-1: Happy Path
// ══════════════════════════════════════════════
describe("E2E-1: Happy Path — draft → review → approve → execute → audit close", () => {
  it("completes full governance loop without errors", () => {
    const now = () => new Date().toISOString();
    const before = [makeRecord({ ownerName: "Old Owner" })];
    const after = [makeRecord({ ownerName: "New Owner", ownerId: "new_1" })];

    // 1. Create change request
    const cr = createOwnershipChangeRequest("reassign", "fire_execution", before, after, "Reassign overloaded", "Fix overload in Team A", "immediate", "author_1", "admin");
    expect(cr.status).toBe("draft");
    expect(cr.mutationRisk).toBe("governed");

    // 2. Explanation is available
    const explanation = buildOwnershipChangeExplanation(cr);
    expect(explanation.whyThisChange.length).toBeGreaterThan(0);
    expect(explanation.whyApprovalNeeded).toContain("고위험");

    // 3. Submit for review
    const submitted = applyOwnershipLifecycle(cr, { action: "submit_for_review", actor: "author_1", actorRole: "admin", timestamp: now() });
    expect(submitted.applied).toBe(true);
    expect(submitted.updatedRequest.status).toBe("pending_review");

    // 4. Approve (different person)
    const approved = applyOwnershipLifecycle(submitted.updatedRequest, { action: "approve_review", actor: "reviewer_1", actorRole: "admin", comment: "Approved", timestamp: now() });
    expect(approved.applied).toBe(true);
    expect(approved.updatedRequest.status).toBe("approved");

    // 5. Create execution queue
    const execItem = createExecutionQueueItem(approved.updatedRequest, [
      { scopeId: "team_1", scopeLabel: "Team A", recordIds: ["own_1"] },
    ]);
    expect(execItem.status).toBe("queued");

    // 6. Execute
    const started = applyExecutionAction(execItem, { action: "start_execution", actor: "admin_1", timestamp: now() });
    const scopeDone = applyExecutionAction(started.updatedItem, { action: "complete_scope", scopeId: "team_1", actor: "admin_1", timestamp: now() });
    const completed = applyExecutionAction(scopeDone.updatedItem, { action: "complete_all", actor: "admin_1", timestamp: now() });
    expect(completed.updatedItem.status).toBe("completed");

    // 7. Audit closure
    const rollout = createPolicyRollout("ps_own", "v_own", "budget", "publish",
      [{ scopeType: "team", scopeId: "team_1", scopeLabel: "Team A", ownershipIds: ["own_1"], approvalIds: [] }],
      makeAuditSnapshot(), "admin_1");
    const rolloutStarted = applyRolloutAction(rollout, { action: "start", actor: "admin_1", timestamp: now() });
    const rolloutScope = applyRolloutAction(rolloutStarted.updatedRollout, { action: "complete_scope", scopeId: "team_1", actor: "admin_1", timestamp: now() });
    const rolloutDone = applyRolloutAction(rolloutScope.updatedRollout, { action: "complete", actor: "admin_1", timestamp: now() });
    expect(rolloutDone.updatedRollout.status).toBe("completed");

    const closure = verifyAuditClosure(rolloutDone.updatedRollout);
    expect(closure.closed).toBe(true);
    expect(closure.completenessScore).toBe(100);

    // 8. Governance loop state
    let loop = createGovernanceLoopState();
    loop = applyGovernanceLoopEvent(loop, { type: "enter_review", changeRequestId: cr.changeRequestId, fromPanel: "owner_backlog" });
    loop = applyGovernanceLoopEvent(loop, { type: "enter_execution", executionId: execItem.executionId });
    loop = applyGovernanceLoopEvent(loop, { type: "enter_audit", rolloutId: rollout.rolloutId });
    loop = applyGovernanceLoopEvent(loop, { type: "loop_completed" });
    expect(loop.currentStep).toBe("completed");
    expect(loop.auditClosed).toBe(true);
  });
});

// ══════════════════════════════════════════════
// E2E-2: Conflict Remediation
// ══════════════════════════════════════════════
describe("E2E-2: Conflict Remediation — detect → remediate → review → approve", () => {
  it("detects conflict, applies remediation, then proceeds to approval", () => {
    // 1. Duplicate scope records
    const records = [
      makeRecord({ recordId: "dup_a", scopeId: "team_dup", ownerId: "a1", ownerName: "A" }),
      makeRecord({ recordId: "dup_b", scopeId: "team_dup", ownerId: "b1", ownerName: "B" }),
    ];

    // 2. Detect conflicts
    const detection = detectOwnershipConflicts(records, [], []);
    expect(detection.totalConflicts).toBeGreaterThan(0);
    const dupConflict = detection.conflicts.find(c => c.type === "duplicate_scope");
    expect(dupConflict).toBeDefined();
    expect(dupConflict!.autoRemediable).toBe(true);

    // 3. Auto-remediate: deactivate duplicate
    const remediationAction = dupConflict!.remediationActions[0];
    expect(remediationAction.type).toBe("deactivate_duplicate");
    const targetId = remediationAction.targetRecordId!;

    const deactResult = applyOwnershipAuthoring(records, {
      action: "deactivate", actor: "admin_1", actorRole: "admin",
      targetRecordId: targetId, reason: "Auto-remediation: duplicate scope",
      timestamp: new Date().toISOString(),
    });
    expect(deactResult.applied).toBe(true);

    // 4. Re-detect — conflict should be gone
    const updatedRecords = records.map(r => r.recordId === targetId ? { ...r, active: false } : r);
    const recheck = detectOwnershipConflicts(updatedRecords, [], []);
    const stillDup = recheck.conflicts.find(c => c.type === "duplicate_scope");
    expect(stillDup).toBeUndefined();

    // 5. Invalidation
    const targets = getInvalidationTargets("conflict_remediated");
    expect(targets).toContain("conflict_panel");
    expect(targets).toContain("owner_backlog");
  });
});

// ══════════════════════════════════════════════
// E2E-3: Partial Failure / Rollback
// ══════════════════════════════════════════════
describe("E2E-3: Partial Failure / Rollback — staged apply → fail → rollback → verify", () => {
  it("handles partial failure and failed_only rollback correctly", () => {
    const now = () => new Date().toISOString();
    const cr = createOwnershipChangeRequest("transfer", "all", [], [], "Site transfer", "Migrate 3 scopes", "immediate", "admin_1", "admin");

    // 1. Create execution with 3 scopes
    let item = createExecutionQueueItem(cr, [
      { scopeId: "s1", scopeLabel: "Scope 1", recordIds: ["r1", "r2"] },
      { scopeId: "s2", scopeLabel: "Scope 2", recordIds: ["r3"] },
      { scopeId: "s3", scopeLabel: "Scope 3", recordIds: ["r4", "r5"] },
    ]);

    // 2. Start execution
    item = applyExecutionAction(item, { action: "start_execution", actor: "admin_1", timestamp: now() }).updatedItem;

    // 3. s1 succeeds, s2 fails, s3 succeeds
    item = applyExecutionAction(item, { action: "complete_scope", scopeId: "s1", actor: "admin_1", timestamp: now() }).updatedItem;
    item = applyExecutionAction(item, { action: "fail_scope", scopeId: "s2", actor: "admin_1", failureReason: "DB constraint violation", timestamp: now() }).updatedItem;
    item = applyExecutionAction(item, { action: "complete_scope", scopeId: "s3", actor: "admin_1", timestamp: now() }).updatedItem;

    // 4. Complete → partial_failure
    item = applyExecutionAction(item, { action: "complete_all", actor: "admin_1", timestamp: now() }).updatedItem;
    expect(item.status).toBe("partial_failure");
    expect(item.completedScopes).toBe(2);
    expect(item.failedScopes).toBe(1);

    // 5. Rollback failed_only
    const rollbackResult = applyExecutionAction(item, { action: "rollback", actor: "admin_1", rollbackScope: "failed_only", timestamp: now() });
    expect(rollbackResult.applied).toBe(true);

    // 6. Verify: s1 and s3 still applied, s2 rolled back
    const results = rollbackResult.updatedItem.scopeResults;
    expect(results.find(s => s.scopeId === "s1")!.status).toBe("applied");
    expect(results.find(s => s.scopeId === "s2")!.status).toBe("rolled_back");
    expect(results.find(s => s.scopeId === "s3")!.status).toBe("applied");

    // 7. Invalidation check
    const targets = getInvalidationTargets("execution_partial_failure");
    expect(targets).toContain("execution_status");
    expect(targets).toContain("conflict_panel"); // re-detect conflicts from failure
  });
});

// ══════════════════════════════════════════════
// E2E-4: Audit Closure Integrity
// ══════════════════════════════════════════════
describe("E2E-4: Audit Closure Integrity — decision snapshot completeness", () => {
  it("verifies all 8 audit fields through complete lifecycle", () => {
    const now = () => new Date().toISOString();

    // 1. Create rollout with full audit snapshot
    const fullSnapshot = makeAuditSnapshot({
      decisionMaker: "cfo_1",
      decisionMakerRole: "owner",
      decisionRationale: "Annual ownership restructure per compliance requirement",
      reviewerId: "compliance_1",
      reviewDecision: "approved",
      reviewComment: "Meets compliance standards",
      simulationSummary: "All positive: SLA improved, no new ownerless",
      simulationImpact: "positive",
      effectiveDate: "2026-04-01T00:00:00Z",
      effectiveDateBasis: "Q2 start cutover",
    });

    const rollout = createPolicyRollout("ps_annual", "v_annual", "budget", "publish",
      [
        { scopeType: "team", scopeId: "team_lab", scopeLabel: "Lab Team", ownershipIds: ["o1", "o2"], approvalIds: ["a1"] },
        { scopeType: "site", scopeId: "site_seoul", scopeLabel: "Seoul Site", ownershipIds: ["o3"], approvalIds: [] },
      ],
      fullSnapshot, "cfo_1");

    // 2. Execute rollout
    let r = rollout;
    r = applyRolloutAction(r, { action: "start", actor: "admin_1", timestamp: now() }).updatedRollout;
    r = applyRolloutAction(r, { action: "complete_scope", scopeId: "team_lab", actor: "admin_1", timestamp: now() }).updatedRollout;
    r = applyRolloutAction(r, { action: "complete_scope", scopeId: "site_seoul", actor: "admin_1", timestamp: now() }).updatedRollout;
    r = applyRolloutAction(r, { action: "complete", actor: "admin_1", timestamp: now() }).updatedRollout;
    expect(r.status).toBe("completed");

    // 3. Verify audit closure — should pass
    const closure = verifyAuditClosure(r);
    expect(closure.closed).toBe(true);
    expect(closure.completenessScore).toBe(100);
    expect(closure.missingFields.length).toBe(0);

    // 4. Verify snapshot has all decision context
    expect(r.auditSnapshot.decisionMaker).toBe("cfo_1");
    expect(r.auditSnapshot.decisionRationale).toContain("compliance");
    expect(r.auditSnapshot.reviewerId).toBe("compliance_1");
    expect(r.auditSnapshot.reviewDecision).toBe("approved");
    expect(r.auditSnapshot.simulationImpact).toBe("positive");
    expect(r.auditSnapshot.effectiveDate).toBe("2026-04-01T00:00:00Z");
    expect(r.auditSnapshot.appliedTimestamp).not.toBeNull();

    // 5. Incomplete snapshot fails closure
    const incompleteRollout = createPolicyRollout("ps_bad", "v_bad", "vendor", "publish",
      [{ scopeType: "organization", scopeId: "org1", scopeLabel: "Org", ownershipIds: [], approvalIds: [] }],
      makeAuditSnapshot({ reviewerId: null, decisionRationale: "" }), "admin_1");
    const incStarted = applyRolloutAction(incompleteRollout, { action: "start", actor: "a", timestamp: now() }).updatedRollout;
    const incScope = applyRolloutAction(incStarted, { action: "complete_scope", scopeId: "org1", actor: "a", timestamp: now() }).updatedRollout;
    const incDone = applyRolloutAction(incScope, { action: "complete", actor: "a", timestamp: now() }).updatedRollout;

    const incClosure = verifyAuditClosure(incDone);
    expect(incClosure.closed).toBe(false);
    expect(incClosure.missingFields).toContain("reviewerId");
    expect(incClosure.missingFields).toContain("decisionRationale");
    expect(incClosure.completenessScore).toBeLessThan(100);
  });
});
