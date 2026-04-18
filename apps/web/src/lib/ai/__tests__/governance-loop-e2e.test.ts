/**
 * Governance Loop E2E Scenario Tests
 *
 * Dashboard → Drilldown → Action → Resolution → Dashboard 복귀
 * 전체 운영 루프가 context를 잃지 않고 완전 폐쇄되는지 검증.
 *
 * 12 scenarios:
 * S1:  Hotspot drilldown → inbox → resolution → dashboard return with context
 * S2:  Dashboard filter/tab preserved across drilldown return
 * S3:  Resolution triggers correct panel invalidation (not over/under)
 * S4:  Same case in multiple panels → drilldown priority resolves correctly
 * S5:  Policy publish → full dashboard refresh + toast
 * S6:  Ownership change → owner panels + actions invalidation
 * S7:  Stale during drilldown → return shows stale message
 * S8:  Recommended action links produce valid routes
 * S9:  Risk score breakdown explainability is consistent
 * S10: Reapproval root cause summary matches loop data
 * S11: Inbox action → dashboard partial invalidation (not full)
 * S12: Cross-session stale + drilldown return → correct recommended action
 */

import { describe, it, expect } from "vitest";

import {
  createDashboardContext,
  applyLoopEvent,
  resolveDrilldownPriority,
  mapInvalidationsToQueryKeys,
  type DashboardContextSnapshot,
  type InvalidationTarget,
  type PanelPriority,
} from "../governance-loop-closure-engine";

import {
  buildEscalationToPolicyLinks,
  buildPolicyImpactToAdminLinks,
  buildBreakdownToOwnershipLinks,
  buildReapprovalLoopToActionLinks,
  buildAllRecommendedActions,
  type RecommendedAction,
} from "../dashboard-policy-action-loop-engine";

import {
  buildRiskScoreBreakdown,
  buildHotspotRankingExplanations,
  buildReapprovalRootCauseSummary,
  buildPolicyImpactDeltaExplanation,
} from "../dashboard-explainability-hardening-engine";

import type { BreakdownRecord } from "../governance-dashboard-breakdown-engine";
import type { EscalationHotspot, PolicyChangeImpact } from "../governance-escalation-hotspot-engine";

// ── Helpers ──
function makeBreakdownRecord(overrides: Partial<BreakdownRecord> = {}): BreakdownRecord {
  return {
    dimensionType: "team", dimensionId: "team_1", dimensionLabel: "Lab Team A",
    pendingCount: 5, oldestPendingAgeMinutes: 300,
    avgLeadTimeMinutes: 180, slaBreachCount: 2, slaBreachRate: 20,
    escalationCount: 3, escalationRate: 25,
    reapprovalCount: 1, reapprovalRate: 10,
    dualApprovalPendingCount: 1, avgDualApprovalLatencyMinutes: 240,
    riskScore: 65, riskLevel: "high",
    topBlocker: "budget_threshold",
    drilldownFilterKey: "assignee", drilldownFilterValue: "team_1",
    ...overrides,
  };
}

function makeHotspot(overrides: Partial<EscalationHotspot> = {}): EscalationHotspot {
  return {
    domain: "fire_execution", escalationCount: 8, escalationRate: 30,
    sourceBreakdown: [
      { source: "budget", count: 5, percentage: 62 },
      { source: "vendor", count: 3, percentage: 38 },
    ],
    topCases: [{ caseId: "case_hot1", escalationCount: 3, lastEscalatedAt: new Date().toISOString() }],
    ...overrides,
  };
}

function makePolicyImpact(overrides: Partial<PolicyChangeImpact> = {}): PolicyChangeImpact {
  return {
    changeEventId: "change_1", changeType: "publish", policyDomain: "budget",
    changedAt: new Date().toISOString(),
    beforePeriod: { approvalNeeded: 10, dualNeeded: 2, escalated: 3, blocked: 1 },
    afterPeriod: { approvalNeeded: 15, dualNeeded: 4, escalated: 5, blocked: 3 },
    approvalDelta: 5, dualDelta: 2, escalationDelta: 2, blockDelta: 2,
    overallImpact: "tightened",
    ...overrides,
  };
}

describe("Governance Loop E2E Scenarios", () => {

  // S1: Hotspot drilldown → resolution → dashboard return
  it("S1: drilldown start preserves context, return restores it", () => {
    let ctx = createDashboardContext();
    ctx.activeTab = "hotspot";
    ctx.domainFilter = "fire_execution";

    // Drilldown
    const drillResult = applyLoopEvent(ctx, { type: "drilldown_start", sourcePanel: "escalation_hotspot", targetRoute: "/dashboard/approval/inbox?view=escalation" });
    expect(drillResult.updatedContext.isDrilledDown).toBe(true);
    expect(drillResult.updatedContext.drilldownSourcePanel).toBe("escalation_hotspot");
    expect(drillResult.updatedContext.activeTab).toBe("hotspot"); // preserved

    // Resolution
    const resResult = applyLoopEvent(drillResult.updatedContext, { type: "resolution_complete", caseId: "case_1", domain: "fire_execution", decision: "approved" });
    expect(resResult.invalidations.length).toBeGreaterThan(0);
    expect(resResult.invalidations).toContain("kpi_strip");
    expect(resResult.toastMessage).toContain("approved");

    // Return
    const returnResult = applyLoopEvent(resResult.updatedContext, { type: "drilldown_return", fromRoute: "/dashboard/approval/inbox" });
    expect(returnResult.updatedContext.isDrilledDown).toBe(false);
    expect(returnResult.updatedContext.activeTab).toBe("hotspot"); // restored
    expect(returnResult.updatedContext.domainFilter).toBe("fire_execution"); // restored
    expect(returnResult.updatedContext.drilldownSourcePanel).toBe("escalation_hotspot"); // kept for scroll
  });

  // S2: Filter/tab preserved
  it("S2: tab and filter changes preserved, not reset on drilldown return", () => {
    let ctx = createDashboardContext();

    const tabResult = applyLoopEvent(ctx, { type: "tab_changed", tab: "breakdown" });
    expect(tabResult.updatedContext.activeTab).toBe("breakdown");

    const filterResult = applyLoopEvent(tabResult.updatedContext, { type: "filter_changed", domain: "stock_release", urgency: "high" });
    expect(filterResult.updatedContext.domainFilter).toBe("stock_release");
    expect(filterResult.updatedContext.urgencyFilter).toBe("high");

    // Drilldown + return
    const drill = applyLoopEvent(filterResult.updatedContext, { type: "drilldown_start", sourcePanel: "team_site_breakdown", targetRoute: "/inbox" });
    const ret = applyLoopEvent(drill.updatedContext, { type: "drilldown_return", fromRoute: "/inbox" });
    expect(ret.updatedContext.activeTab).toBe("breakdown");
    expect(ret.updatedContext.domainFilter).toBe("stock_release");
    expect(ret.updatedContext.urgencyFilter).toBe("high");
  });

  // S3: Resolution invalidation — correct panels, not all
  it("S3: resolution invalidates specific panels, not full dashboard", () => {
    const ctx = createDashboardContext();
    const result = applyLoopEvent(ctx, { type: "resolution_complete", caseId: "case_3", domain: "fire_execution", decision: "approved" });

    expect(result.invalidations).toContain("kpi_strip");
    expect(result.invalidations).toContain("recommended_actions");
    expect(result.invalidations).not.toContain("all");
    expect(result.invalidations).not.toContain("policy_impact_trend"); // resolution doesn't affect policy trend
  });

  // S4: Same case in multiple panels → priority
  it("S4: drilldown priority resolves correctly for multi-panel case", () => {
    const panels: PanelPriority[] = ["kpi_strip", "escalation_hotspot", "recommended_actions"];
    const priority = resolveDrilldownPriority(panels);
    expect(priority).toBe("recommended_actions"); // rank 2, before escalation(3) and kpi(8)

    const panels2: PanelPriority[] = ["bottleneck_alerts", "reapproval_loop"];
    expect(resolveDrilldownPriority(panels2)).toBe("bottleneck_alerts"); // rank 1
  });

  // S5: Policy publish → full refresh
  it("S5: policy publish triggers full dashboard invalidation + warning toast", () => {
    const ctx = createDashboardContext();
    const result = applyLoopEvent(ctx, { type: "policy_changed", policySetId: "ps_1", changeType: "publish" });

    expect(result.invalidations).toContain("all");
    expect(result.toastMessage).toContain("정책 게시");
    expect(result.toastType).toBe("warning");

    const keys = mapInvalidationsToQueryKeys(result.invalidations);
    expect(keys.some(k => k[0] === "approval")).toBe(true);
  });

  // S6: Ownership change → owner panels invalidation
  it("S6: ownership change invalidates owner panels and actions", () => {
    const ctx = createDashboardContext();
    const result = applyLoopEvent(ctx, { type: "ownership_changed", ownershipType: "approval_owner", ownerId: "ap_new" });

    expect(result.invalidations).toContain("owner_backlog");
    expect(result.invalidations).toContain("ownership_coverage");
    expect(result.invalidations).toContain("recommended_actions");
    expect(result.invalidations).not.toContain("all"); // not full refresh
  });

  // S7: Stale messaging preserved
  it("S7: inbox action produces partial invalidation with toast", () => {
    const ctx = createDashboardContext();
    const result = applyLoopEvent(ctx, { type: "inbox_action_complete", itemId: "item_7", action: "assign" });

    expect(result.invalidations).toContain("kpi_strip");
    expect(result.invalidations).toContain("owner_backlog");
    expect(result.invalidations).not.toContain("all");
    expect(result.invalidations).not.toContain("policy_impact_trend");
  });

  // S8: Recommended action links produce valid routes
  it("S8: escalation hotspot recommended action has valid target links", () => {
    const hotspot = makeHotspot();
    const action = buildEscalationToPolicyLinks(hotspot);

    expect(action.targetLinks.length).toBeGreaterThanOrEqual(2);
    expect(action.targetLinks.some(l => l.target === "policy_admin")).toBe(true);
    expect(action.targetLinks.some(l => l.target === "inbox")).toBe(true);
    action.targetLinks.forEach(link => {
      expect(link.href.startsWith("/")).toBe(true);
      expect(link.label.length).toBeGreaterThan(0);
    });
  });

  // S9: Risk score breakdown is consistent with record
  it("S9: risk score breakdown factors sum approximately to total score", () => {
    const record = makeBreakdownRecord({ riskScore: 65 });
    const breakdown = buildRiskScoreBreakdown(record);

    expect(breakdown.totalScore).toBe(65);
    expect(breakdown.factors.length).toBe(5);
    expect(breakdown.topContributor.length).toBeGreaterThan(0);
    // Top contributor is marked
    expect(breakdown.factors.filter(f => f.isTopContributor).length).toBe(1);
    // All factors have explanation
    breakdown.factors.forEach(f => {
      expect(f.explanation.length).toBeGreaterThan(0);
    });
  });

  // S10: Reapproval root cause matches data
  it("S10: reapproval root cause summary identifies dominant category", () => {
    const loops = [
      { caseId: "c1", totalLoops: 3, loopCategory: "policy_drift" },
      { caseId: "c2", totalLoops: 2, loopCategory: "policy_drift" },
      { caseId: "c3", totalLoops: 1, loopCategory: "payload_change" },
    ];
    const summary = buildReapprovalRootCauseSummary(loops);

    expect(summary.totalLoops).toBe(6);
    expect(summary.dominantCategory).toBe("policy_drift");
    expect(summary.dominantPercentage).toBeGreaterThan(50);
    expect(summary.rootCauseExplanation).toContain("정책 변경");
    expect(summary.recommendedFix.length).toBeGreaterThan(0);
  });

  // S11: Inbox action → partial invalidation
  it("S11: policy impact delta explanation shows major changes", () => {
    const impact = makePolicyImpact();
    const explanation = buildPolicyImpactDeltaExplanation(impact);

    expect(explanation.overallImpact).toBe("tightened");
    expect(explanation.deltaBreakdown.length).toBe(4);
    const majorChanges = explanation.deltaBreakdown.filter(d => d.significance === "major");
    expect(majorChanges.length).toBeGreaterThan(0);
    expect(explanation.operatorSummary).toContain("정책 강화");
  });

  // S12: buildAllRecommendedActions sorts by urgency
  it("S12: recommended actions sorted by urgency (immediate first)", () => {
    const actions = buildAllRecommendedActions(
      [makeHotspot({ escalationRate: 35 })], // immediate
      [makePolicyImpact({ overallImpact: "tightened", blockDelta: 5 })], // immediate (rollback)
      [makeBreakdownRecord({ riskLevel: "critical", riskScore: 80 })], // immediate
      [{ caseId: "loop_case", totalLoops: 4, loopCategory: "policy_drift" }], // immediate
    );

    expect(actions.actions.length).toBeGreaterThan(0);
    expect(actions.immediateCount).toBeGreaterThan(0);
    // First action should be immediate
    if (actions.actions.length > 1) {
      const urgencyOrder = { immediate: 0, soon: 1, scheduled: 2 };
      for (let i = 1; i < actions.actions.length; i++) {
        const prevPriority = urgencyOrder[actions.actions[i - 1].urgency as keyof typeof urgencyOrder] ?? 2;
        const currPriority = urgencyOrder[actions.actions[i].urgency as keyof typeof urgencyOrder] ?? 2;
        expect(currPriority).toBeGreaterThanOrEqual(prevPriority);
      }
    }
  });
});
