/**
 * Governance Loop Orchestrator E2E — 4-surface loop context 보존 검증
 *
 * 8 scenarios:
 * S1: Full loop — discovery → judgment → execution → verification → closed (context preserved)
 * S2: Origin badge targeted invalidation — ownerless vs overloaded vs conflict
 * S3: Resume from partial failure — same context, execution surface
 * S4: Resume from audit incomplete — same context, verification surface
 * S5: Effective date transitions — future/due/overdue classification
 * S6: Audit-metric connection — closure incomplete blocks backlog decrement
 * S7: Shared grammar consistency — ownership/policy same labels
 * S8: Close with revert — full invalidation + dashboard refresh
 */

import { describe, it, expect } from "vitest";

import {
  createGovernanceLoopContext,
  startGovernanceLoop,
  advanceGovernanceSurface,
  closeGovernanceLoop,
  resumeGovernanceLoop,
  evaluateEffectiveDateTransitions,
  evaluateAuditMetricConnection,
  SHARED_GOVERNANCE_GRAMMAR,
  type GovernanceLoopContext,
} from "../governance-loop-orchestrator";

describe("Governance Loop Orchestrator E2E", () => {

  // S1: Full loop — context preserved end-to-end
  it("S1: full 4-surface loop preserves context from discovery to closed", () => {
    // Discovery: panel click
    let ctx = createGovernanceLoopContext(
      "ownerless_hotspot", "ownership", "ownerless_batch_1",
      "ownerless",
      { domain: "fire_execution", urgency: "high" },
      ["scope_a", "scope_b"],
      "/dashboard/approval",
    );
    expect(ctx.currentSurface).toBe("discovery");
    expect(ctx.originBadge).toBe("ownerless");
    expect(ctx.selectedScopeIds).toEqual(["scope_a", "scope_b"]);
    expect(ctx.inheritedFilters.domain).toBe("fire_execution");

    // Judgment: start governance loop
    ctx = startGovernanceLoop(ctx, "ownchg_1", "ownership_change", "applyOwnershipLifecycle");
    expect(ctx.currentSurface).toBe("judgment");
    expect(ctx.governanceObjectId).toBe("ownchg_1");
    expect(ctx.canonicalWriterKey).toBe("applyOwnershipLifecycle");
    // Origin preserved
    expect(ctx.sourcePanel).toBe("ownerless_hotspot");
    expect(ctx.originBadge).toBe("ownerless");
    expect(ctx.selectedScopeIds).toEqual(["scope_a", "scope_b"]);

    // Execution
    ctx = advanceGovernanceSurface(ctx, "execution");
    expect(ctx.currentSurface).toBe("execution");
    expect(ctx.surfaceHistory.length).toBe(3); // discovery + judgment + execution
    // Still preserved
    expect(ctx.sourcePanel).toBe("ownerless_hotspot");

    // Verification
    ctx = advanceGovernanceSurface(ctx, "verification");
    expect(ctx.currentSurface).toBe("verification");

    // Close
    const result = closeGovernanceLoop(ctx, "resolved", "2건 ownerless 배정 완료");
    expect(result.closedContext.currentSurface).toBe("closed");
    expect(result.closedContext.resolutionStatus).toBe("resolved");
    expect(result.closedContext.resolutionDetail).toBe("2건 ownerless 배정 완료");
    expect(result.returnRoute).toBe("/dashboard/approval");
    expect(result.toastType).toBe("success");

    // Surface history complete
    expect(result.closedContext.surfaceHistory.length).toBeGreaterThanOrEqual(5);
    // All surfaces have exitedAt
    result.closedContext.surfaceHistory.forEach(h => {
      expect(h.exitedAt).not.toBeNull();
    });
  });

  // S2: Origin badge → targeted invalidation
  it("S2: different origin badges produce different invalidation targets", () => {
    const ctxOwnerless = createGovernanceLoopContext("panel", "ownership", "e1", "ownerless");
    const ctxOverloaded = createGovernanceLoopContext("panel", "ownership", "e2", "overloaded");
    const ctxConflict = createGovernanceLoopContext("panel", "ownership", "e3", "conflict");

    const resOwnerless = closeGovernanceLoop(ctxOwnerless, "resolved", "");
    const resOverloaded = closeGovernanceLoop(ctxOverloaded, "resolved", "");
    const resConflict = closeGovernanceLoop(ctxConflict, "resolved", "");

    // Ownerless → ownerless_hotspot + coverage
    expect(resOwnerless.invalidationTargets).toContain("ownerless_hotspot");
    expect(resOwnerless.invalidationTargets).toContain("ownership_coverage");

    // Overloaded → overloaded_owner + backlog
    expect(resOverloaded.invalidationTargets).toContain("overloaded_owner");
    expect(resOverloaded.invalidationTargets).toContain("owner_backlog");

    // Conflict → conflict_panel
    expect(resConflict.invalidationTargets).toContain("conflict_panel");

    // All include recommended_actions
    expect(resOwnerless.invalidationTargets).toContain("recommended_actions");
    expect(resOverloaded.invalidationTargets).toContain("recommended_actions");
    expect(resConflict.invalidationTargets).toContain("recommended_actions");
  });

  // S3: Resume from partial failure
  it("S3: resume from partial failure returns to execution with full context", () => {
    let ctx = createGovernanceLoopContext("owner_backlog", "ownership", "e4", "overloaded", {}, ["s1", "s2", "s3"]);
    ctx = startGovernanceLoop(ctx, "ownchg_2", "ownership_change", "writer");
    ctx = advanceGovernanceSurface(ctx, "execution");

    // Partial failure → close
    const partial = closeGovernanceLoop(ctx, "partial", "s2 scope failed");
    expect(partial.closedContext.resolutionStatus).toBe("partial");
    expect(partial.toastType).toBe("warning");
    expect(partial.invalidationTargets).toContain("execution_status");

    // Resume to execution
    const resumed = resumeGovernanceLoop(partial.closedContext, "execution");
    expect(resumed.currentSurface).toBe("execution");
    expect(resumed.resolutionStatus).toBe("pending"); // reset for retry
    // Original context still intact
    expect(resumed.sourcePanel).toBe("owner_backlog");
    expect(resumed.selectedScopeIds).toEqual(["s1", "s2", "s3"]);
    expect(resumed.governanceObjectId).toBe("ownchg_2");
  });

  // S4: Resume from audit incomplete
  it("S4: resume from audit incomplete returns to verification", () => {
    let ctx = createGovernanceLoopContext("coverage_card", "ownership", "e5", "coverage");
    ctx = startGovernanceLoop(ctx, "ownchg_3", "ownership_change", "writer");
    ctx = advanceGovernanceSurface(ctx, "execution");
    ctx = advanceGovernanceSurface(ctx, "verification");

    // Audit incomplete → need to fix missing fields
    const resumed = resumeGovernanceLoop(ctx, "verification");
    expect(resumed.currentSurface).toBe("verification");
    expect(resumed.sourcePanel).toBe("coverage_card"); // origin preserved
    expect(resumed.surfaceHistory.some(h => h.surface === "resume:verification")).toBe(true);
  });

  // S5: Effective date transitions
  it("S5: effective date correctly classifies future/due/overdue", () => {
    const now = new Date("2026-03-29T12:00:00Z");

    const transitions = evaluateEffectiveDateTransitions([
      { changeRequestId: "cr_future", effectiveDate: "2026-04-05T00:00:00Z", status: "approved", appliedAt: null },
      { changeRequestId: "cr_due", effectiveDate: "2026-03-29T10:00:00Z", status: "approved", appliedAt: null },
      { changeRequestId: "cr_applied", effectiveDate: "2026-03-28T00:00:00Z", status: "applied", appliedAt: "2026-03-28T01:00:00Z" },
      { changeRequestId: "cr_tomorrow", effectiveDate: "2026-03-30T00:00:00Z", status: "approved", appliedAt: null },
    ], now);

    const future = transitions.find(t => t.changeRequestId === "cr_future")!;
    expect(future.status).toBe("future");
    expect(future.daysUntilDue).toBeGreaterThan(3);
    expect(future.action).toBe("no_action");
    expect(future.simulationStale).toBe(false);

    const due = transitions.find(t => t.changeRequestId === "cr_due")!;
    expect(due.status).toBe("due");
    expect(due.action).toBe("ready_to_queue");
    expect(due.simulationStale).toBe(true);

    const applied = transitions.find(t => t.changeRequestId === "cr_applied")!;
    expect(applied.status).toBe("applied");
    expect(applied.action).toBe("already_applied");

    const tomorrow = transitions.find(t => t.changeRequestId === "cr_tomorrow")!;
    expect(tomorrow.status).toBe("future");
    expect(tomorrow.daysUntilDue).toBeLessThanOrEqual(1);
    expect(tomorrow.simulationStale).toBe(true); // ≤1 day
  });

  // S6: Audit-metric connection
  it("S6: audit incomplete blocks backlog decrement and shows badge", () => {
    // Audit incomplete + execution complete
    const incomplete = evaluateAuditMetricConnection(false, ["reviewerId", "decisionRationale"], true);
    expect(incomplete.isResolvedForMetrics).toBe(false);
    expect(incomplete.backlogDecrementAllowed).toBe(false);
    expect(incomplete.remediationNeeded).toBe(true);
    expect(incomplete.showIncompleteBadge).toBe(true);

    // Audit complete + execution complete
    const complete = evaluateAuditMetricConnection(true, [], true);
    expect(complete.isResolvedForMetrics).toBe(true);
    expect(complete.backlogDecrementAllowed).toBe(true);
    expect(complete.remediationNeeded).toBe(false);
    expect(complete.showIncompleteBadge).toBe(false);

    // Audit incomplete + execution incomplete
    const notDone = evaluateAuditMetricConnection(false, ["reviewerId"], false);
    expect(notDone.showIncompleteBadge).toBe(false); // execution not done yet, no badge
  });

  // S7: Shared grammar consistency
  it("S7: ownership and policy use identical governance grammar labels", () => {
    const grammar = SHARED_GOVERNANCE_GRAMMAR;

    // Lifecycle labels exist for all states
    expect(grammar.lifecycle.draft).toBe("초안");
    expect(grammar.lifecycle.approved).toBe("승인됨");
    expect(grammar.lifecycle.reverted).toBe("롤백됨");

    // Execution labels
    expect(grammar.execution.partial_failure).toBe("부분 실패");
    expect(grammar.execution.rolled_back).toBe("롤백됨");

    // Rollback modes
    expect(grammar.rollback.full).toBe("전체 롤백");
    expect(grammar.rollback.failed_only).toBe("실패 scope만 롤백");

    // Dock action order: revert is leftmost (danger), approve/apply is rightmost (primary)
    expect(grammar.dockActionOrder[0]).toBe("revert");
    expect(grammar.dockActionOrder[grammar.dockActionOrder.length - 1]).toBe("apply_now");

    // Simulation impact labels
    expect(grammar.simulationImpact.tightened).toBe("강화됨");
    expect(grammar.simulationImpact.relaxed).toBe("완화됨");
  });

  // S8: Revert closure → full invalidation
  it("S8: revert closure triggers full ownership panel invalidation", () => {
    const ctx = createGovernanceLoopContext("owner_backlog", "ownership", "e8", "backlog");
    const result = closeGovernanceLoop(ctx, "reverted", "Emergency rollback");

    expect(result.closedContext.resolutionStatus).toBe("reverted");
    expect(result.dashboardRefreshScope).toBe("full");
    expect(result.toastType).toBe("warning");

    // All ownership panels invalidated
    expect(result.invalidationTargets).toContain("owner_backlog");
    expect(result.invalidationTargets).toContain("ownerless_hotspot");
    expect(result.invalidationTargets).toContain("overloaded_owner");
    expect(result.invalidationTargets).toContain("ownership_coverage");
    expect(result.invalidationTargets).toContain("conflict_panel");
    expect(result.invalidationTargets).toContain("execution_status");
    expect(result.invalidationTargets).toContain("audit_closure_status");
    expect(result.invalidationTargets).toContain("recommended_actions");
    expect(result.invalidationTargets).toContain("rollout_history");
  });
});
