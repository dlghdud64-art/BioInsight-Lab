// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Policy Surface Rollout Test — 전체 workspace에 policy language 일관 적용 검증
 *
 * 10 scenarios:
 * S1:  receiving_preparation — operator allowed, no approval
 * S2:  receiving_execution — operator allowed, no approval
 * S3:  variance_disposition — operator allowed but Tier 2 warning context
 * S4:  variance_disposition — high variance → policy block
 * S5:  stock_release — operator needs approval (Tier 3)
 * S6:  reorder_trigger — operator allowed, no approval
 * S7:  fire_execution — operator needs approval (Tier 3, budget OK)
 * S8:  fire_execution — budget over 5M → policy block + escalation
 * S9:  exception_resolve — operator needs approval (Tier 3)
 * S10: buildAllWorkspacePolicySurfaces — batch consistency
 * S11: CasePolicySummary — rollup counts
 * S12: inline guidance status badge correctness
 */

import { describe, it, expect } from "vitest";
import {
  buildWorkspacePolicySurface,
  buildAllWorkspacePolicySurfaces,
  buildCasePolicySummary,
  getAllWorkspacePolicyConfigs,
  type WorkspacePolicySurfaceResult,
} from "../policy-surface-registry-engine";
import type { ActorContext, ProcurementRole } from "../dispatch-v2-permission-policy-engine";

function makeActor(id: string, roles: ProcurementRole[]): ActorContext {
  return { actorId: id, roles, organizationId: "org_1", departmentId: "dept_1", delegatedBy: null, sessionId: "sess_1" };
}

describe("Policy Surface Rollout — Full Workspace Coverage", () => {

  // S1: receiving_preparation — Tier 1, no approval
  it("S1: receiving_preparation — operator allowed without approval", () => {
    const operator = makeActor("op_1", ["operator"]);
    const result = buildWorkspacePolicySurface("receiving_preparation", operator, "case_1");

    expect(result.found).toBe(true);
    expect(result.permissionResult!.permitted).toBe(true);
    expect(result.permissionResult!.requiresApproval).toBe(false);
    expect(result.policySurface!.approvalRequired).toBe(false);
    expect(result.inlineGuidance.statusBadge).toBe("allowed");
    expect(result.inlineGuidance.statusColor).toBe("emerald");
    expect(result.inlineGuidance.blockerMessages.length).toBe(0);
  });

  // S2: receiving_execution — Tier 1, no approval
  it("S2: receiving_execution — operator allowed without approval", () => {
    const operator = makeActor("op_1", ["operator"]);
    const result = buildWorkspacePolicySurface("receiving_execution", operator, "case_2");

    expect(result.found).toBe(true);
    expect(result.permissionResult!.permitted).toBe(true);
    expect(result.inlineGuidance.statusBadge).toBe("allowed");
  });

  // S3: variance_disposition — Tier 2, operator allowed (no variance threshold hit)
  it("S3: variance_disposition — operator allowed when variance within threshold", () => {
    const operator = makeActor("op_1", ["operator"]);
    const result = buildWorkspacePolicySurface("variance_disposition", operator, "case_3", {
      variancePercentage: 5, // within 10% threshold
    });

    expect(result.found).toBe(true);
    expect(result.permissionResult!.permitted).toBe(true);
    expect(result.policySurface!.riskTier).toBe("tier2_org_impact");
    expect(result.inlineGuidance.statusBadge).toBe("allowed");
  });

  // S4: variance_disposition — high variance → policy block
  it("S4: variance_disposition — high variance triggers policy block", () => {
    const operator = makeActor("op_1", ["operator"]);
    const result = buildWorkspacePolicySurface("variance_disposition", operator, "case_4", {
      variancePercentage: 15, // exceeds 10% threshold
    });

    expect(result.found).toBe(true);
    expect(result.permissionResult!.blockedByPolicy).toBe(true);
    expect(result.policySurface!.hasBlockers).toBe(true);
    expect(result.inlineGuidance.statusBadge).toBe("blocked");
    expect(result.inlineGuidance.statusColor).toBe("red");
    expect(result.inlineGuidance.blockerMessages.length).toBeGreaterThan(0);
  });

  // S5: stock_release — Tier 3, operator needs approval
  it("S5: stock_release — operator needs approval (Tier 3)", () => {
    const operator = makeActor("op_1", ["operator"]);
    const result = buildWorkspacePolicySurface("stock_release", operator, "case_5", {
      targetLocation: "warehouse_A", // location provided so location_policy passes
      totalAmount: 3000000, // within budget threshold
    });

    expect(result.found).toBe(true);
    expect(result.permissionResult!.requiresApproval).toBe(true);
    expect(result.policySurface!.approvalRequired).toBe(true);
    expect(result.policySurface!.riskTier).toBe("tier3_irreversible");
    expect(result.policySurface!.dualApprovalRequired).toBe(true);
    expect(result.inlineGuidance.statusBadge).toBe("approval_needed");
    expect(result.inlineGuidance.statusColor).toBe("blue");
    expect(result.inlineGuidance.approverInfo).not.toBeNull();
    expect(result.inlineGuidance.approverInfo!.dualApprovalRequired).toBe(true);
  });

  // S6: reorder_trigger — Tier 1, no approval
  it("S6: reorder_trigger — operator allowed without approval", () => {
    const operator = makeActor("op_1", ["operator"]);
    const result = buildWorkspacePolicySurface("reorder_trigger", operator, "case_6");

    expect(result.found).toBe(true);
    expect(result.permissionResult!.permitted).toBe(true);
    expect(result.inlineGuidance.statusBadge).toBe("allowed");
  });

  // S7: fire_execution — Tier 3, operator needs approval (budget OK)
  it("S7: fire_execution — operator needs approval, budget OK", () => {
    const operator = makeActor("op_1", ["operator"]);
    const result = buildWorkspacePolicySurface("fire_execution", operator, "case_7", {
      totalAmount: 3000000, // within 5M threshold
    });

    expect(result.found).toBe(true);
    expect(result.permissionResult!.requiresApproval).toBe(true);
    expect(result.policySurface!.approvalRequired).toBe(true);
    expect(result.inlineGuidance.statusBadge).toBe("approval_needed");
    expect(result.inlineGuidance.approverInfo!.selfApprovalAllowed).toBe(false);
  });

  // S8: fire_execution — budget over 5M → policy block + escalation
  it("S8: fire_execution — budget over 5M triggers block + escalation", () => {
    const operator = makeActor("op_1", ["operator"]);
    const result = buildWorkspacePolicySurface("fire_execution", operator, "case_8", {
      totalAmount: 6000000,
    });

    expect(result.found).toBe(true);
    expect(result.permissionResult!.blockedByPolicy).toBe(true);
    expect(result.permissionResult!.escalationRequired).toBe(true);
    expect(result.inlineGuidance.statusBadge).toBe("blocked");
    expect(result.inlineGuidance.statusColor).toBe("red");
    expect(result.inlineGuidance.blockerMessages.length).toBeGreaterThan(0);
    // Policy surface shows who can unblock
    expect(result.policySurface!.operatorGuidance.whoCanUnblock.length).toBeGreaterThan(0);
  });

  // S9: exception_resolve — Tier 3, needs approval
  it("S9: exception_resolve — operator needs approval (Tier 3)", () => {
    const operator = makeActor("op_1", ["operator"]);
    const result = buildWorkspacePolicySurface("exception_resolve", operator, "case_9");

    expect(result.found).toBe(true);
    expect(result.permissionResult!.requiresApproval).toBe(true);
    expect(result.policySurface!.riskTier).toBe("tier3_irreversible");
    expect(result.inlineGuidance.statusBadge).toBe("approval_needed");
  });

  // S10: buildAllWorkspacePolicySurfaces — batch consistency
  it("S10: batch build produces surfaces for all registered workspaces", () => {
    const operator = makeActor("op_1", ["operator"]);
    const allSurfaces = buildAllWorkspacePolicySurfaces(operator, "case_10");
    const allConfigs = getAllWorkspacePolicyConfigs();

    expect(allSurfaces.length).toBe(allConfigs.length);
    expect(allSurfaces.every(s => s.found)).toBe(true);
    expect(allSurfaces.every(s => s.permissionResult !== null)).toBe(true);
    expect(allSurfaces.every(s => s.policySurface !== null)).toBe(true);

    // Each has valid inline guidance
    allSurfaces.forEach(s => {
      expect(["allowed", "approval_needed", "blocked", "reapproval_needed", "escalation_needed", "unknown"]).toContain(s.inlineGuidance.statusBadge);
      expect(s.inlineGuidance.primaryMessage.length).toBeGreaterThan(0);
    });
  });

  // S11: CasePolicySummary — rollup counts
  it("S11: case policy summary correctly counts status distribution", () => {
    const operator = makeActor("op_1", ["operator"]);
    const surfaces = buildAllWorkspacePolicySurfaces(operator, "case_11");
    const summary = buildCasePolicySummary(surfaces, "case_11");

    expect(summary.caseId).toBe("case_11");
    expect(summary.totalWorkspaces).toBe(surfaces.length);
    // Sum of categories should equal total
    const summed = summary.allowedCount + summary.approvalNeededCount + summary.blockedCount + summary.reapprovalNeededCount + summary.escalationNeededCount;
    expect(summed).toBeLessThanOrEqual(summary.totalWorkspaces);
    // At least some allowed (Tier 1 workspaces)
    expect(summary.allowedCount).toBeGreaterThan(0);
    // At least some approval needed (Tier 3 workspaces)
    expect(summary.approvalNeededCount).toBeGreaterThan(0);
  });

  // S12: viewer role denied across all workspaces
  it("S12: viewer role denied for all workspaces", () => {
    const viewer = makeActor("v_1", ["viewer"]);
    const allSurfaces = buildAllWorkspacePolicySurfaces(viewer, "case_12");

    // All should be denied (viewer has no operator+ access)
    allSurfaces.forEach(s => {
      expect(s.permissionResult!.permitted).toBe(false);
      expect(s.permissionResult!.permissionLevel).toBe("denied");
    });
  });
});
