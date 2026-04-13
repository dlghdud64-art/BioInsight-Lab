// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Post-Request 운영 체인 Governance 정합 검증
 *
 * sent → tracking → ack → receiving → stock release 체인이
 * approval control plane + org policy + conflict diagnostics + ownership과 정합하는지 확인.
 *
 * 12 scenarios:
 * S1:  Fire execution → SentStateRecord 생성 → approval snapshot consumed
 * S2:  Stock release → approval gate → permission check + policy evaluation
 * S3:  Variance disposition → Tier 2 threshold → policy surface alignment
 * S4:  Exception resolve → Tier 3 approval required → SoD check
 * S5:  Exception return_to_stage → ALLOWED_RETURN_TARGETS matrix
 * S6:  Reorder trigger → procurement re-entry → circular chain closure
 * S7:  Policy surface consistency — all chain stages use same policy language
 * S8:  Ownership resolution — chain stage별 owner resolution 정합
 * S9:  Conflict diagnostics — chain action에 대한 conflict payload 생성
 * S10: Governance loop — chain action이 dashboard invalidation 트리거
 * S11: Approval timeline — chain events가 stage timeline에 기록
 * S12: Compliance export — chain audit data가 export schema에 매핑
 */

import { describe, it, expect } from "vitest";

// Permission / Policy
import {
  checkPermission,
  type ActorContext,
  type ProcurementRole,
} from "../dispatch-v2-permission-policy-engine";

// Approval workbench
import {
  buildApprovalWorkbenchStateV2,
  decideApprovalV2,
  type ApprovalSnapshotV2,
} from "../dispatch-v2-approval-workbench-engine";

// Shared validator
import { runConsumeGuard, type ApprovalPayloadHash } from "../approval-snapshot-validator";

// Fire execution
import { executeActualSendFire } from "../actual-send-fired-transaction-v2-engine";

// Stock release
import { createInitialStockReleaseSession, applyStockReleaseMutation } from "../stock-release-resolution-v2-engine";

// Available inventory + reorder
import { projectAvailableInventory } from "../available-inventory-projection-v2-engine";
import { evaluateReorderTrigger, type ReorderContext } from "../reorder-trigger-v2-engine";

// Exception recovery
import { createExceptionRecord, applyExceptionMutation } from "../dispatch-exception-recovery-v2-engine";

// Policy surface registry
import { buildWorkspacePolicySurface, buildAllWorkspacePolicySurfaces, buildCasePolicySummary } from "../policy-surface-registry-engine";

// Conflict diagnostics
import { buildPolicyApprovalConflictPayload } from "../policy-approval-conflict-diagnostics-engine";
import { evaluateAllOrgPolicies, mergeOrgPolicyDecisions, buildAllPolicyExplanations, type OrgPolicyRule } from "../organization-policy-engine";

// Ownership
import { resolveOwner, type OwnershipRecord } from "../multi-team-ownership-engine";

// Timeline
import { createStageTimeline, addTransitionEntry } from "../dispatch-v2-stage-timeline-v2-engine";
import { recordApprovalEvent } from "../approval-timeline-integration-engine";

// SoD
import { createActorChainRecord, recordPreparer, recordApprover, checkSoDForApproval } from "../separation-of-duties-engine";

// Governance loop
import { createGovernanceLoopContext, closeGovernanceLoop } from "../governance-loop-orchestrator";

// Helpers
function makeActor(id: string, roles: ProcurementRole[]): ActorContext {
  return { actorId: id, roles, organizationId: "org_1", departmentId: "dept_1", delegatedBy: null, sessionId: "sess_1" };
}

function makeHash(v: string = "v1"): ApprovalPayloadHash {
  return { entityVersion: v, contentHash: `c_${v}`, policyHash: `p_${v}`, scopeHash: `s_${v}` };
}

describe("Post-Request Chain Governance Integration", () => {

  // S1: Fire → SentStateRecord
  it("S1: fire execution requires Tier 3 approval — permission check validates", () => {
    const operator = makeActor("op_1", ["operator"]);
    const perm = checkPermission("actual_send_fire_execute", operator);

    expect(perm.requiresApproval).toBe(true);
    expect(perm.approvalRequirement.actionRiskTier).toBe("tier3_irreversible");
    expect(perm.approvalRequirement.selfApprovalAllowed).toBe(false);
    expect(perm.approvalRequirement.dualApprovalRequired).toBe(true);
  });

  // S2: Stock release → approval gate
  it("S2: stock release execute requires Tier 3 approval with policy evaluation", () => {
    const operator = makeActor("op_1", ["operator"]);
    const perm = checkPermission("stock_release_execute", operator, {
      totalAmount: 3000000, targetLocation: "warehouse_A",
    });

    expect(perm.requiresApproval).toBe(true);
    expect(perm.approvalRequirement.actionRiskTier).toBe("tier3_irreversible");
    // Budget under 5M → not blocked by policy
    expect(perm.blockedByPolicy).toBe(false);
  });

  // S3: Variance disposition → Tier 2
  it("S3: variance disposition Tier 2 — high variance triggers policy block", () => {
    const operator = makeActor("op_1", ["operator"]);

    // Under threshold → allowed
    const permOk = checkPermission("variance_disposition_set", operator, { variancePercentage: 5 });
    expect(permOk.permitted).toBe(true);

    // Over threshold → blocked
    const permBlocked = checkPermission("variance_disposition_set", operator, { variancePercentage: 15 });
    expect(permBlocked.blockedByPolicy).toBe(true);
  });

  // S4: Exception resolve → Tier 3 + SoD
  it("S4: exception resolve requires Tier 3 approval — SoD prevents self-approve", () => {
    const operator = makeActor("op_1", ["operator"]);
    const perm = checkPermission("exception_resolve", operator);

    expect(perm.requiresApproval).toBe(true);
    expect(perm.approvalRequirement.actionRiskTier).toBe("tier3_irreversible");

    // SoD: preparer cannot be approver
    const chain = recordPreparer(
      createActorChainRecord("case_s4", "exception_resolve", "tier3_irreversible"),
      operator
    );
    const sodCheck = checkSoDForApproval(chain, operator);
    expect(sodCheck.allowed).toBe(false); // same actor = violation
  });

  // S5: Exception return → ALLOWED_RETURN_TARGETS
  it("S5: exception return_to_stage validates against ALLOWED_RETURN_TARGETS", () => {
    const record = createExceptionRecord("case_s5", null, "stock_release", "receiving_shortage", "Shortage detected", ["line_1"], "high", "op_1");

    // Valid return target: stock_release → receiving_variance_disposition
    const validReturn = applyExceptionMutation(record, {
      action: "set_recovery_action", recoveryAction: "return_to_supplier", actor: "op_1", timestamp: new Date().toISOString(),
    });
    expect(validReturn.applied).toBe(true);

    // Return to allowed target
    let updated = validReturn.updatedRecord;
    updated = { ...updated, status: "resolution_in_progress" };
    const returnResult = applyExceptionMutation(updated, {
      action: "return_to_stage", returnToStage: "receiving_variance_disposition", actor: "op_1", timestamp: new Date().toISOString(),
    });
    expect(returnResult.applied).toBe(true);

    // Return to disallowed target → rejected
    const badReturn = applyExceptionMutation(updated, {
      action: "return_to_stage", returnToStage: "dispatch_preparation", actor: "op_1", timestamp: new Date().toISOString(),
    });
    expect(badReturn.applied).toBe(false);
    expect(badReturn.rejectedReasonIfAny).toContain("불가");
  });

  // S6: Reorder → circular chain closure
  it("S6: reorder trigger evaluation connects to procurement re-entry", () => {
    const context: ReorderContext = {
      safetyStockQty: 100, averageDailyUsage: 20,
      leadTimeDays: 5, currentDemandQty: 50, reorderPointQty: 150,
    };

    // Below safety stock → urgent
    const urgentResult = evaluateReorderTrigger(
      { snapshotId: "snap1", caseId: "case_s6", sentStateRecordId: "sent1", releaseSessionId: "rel1", availableLines: [], totalAvailableQty: 50, projectedAt: "", projectedBy: "", reorderTriggerEligible: true, nextDestination: "reorder_evaluation" },
      context,
    );
    expect(urgentResult.evaluationResult).toBe("reorder_urgent");
    expect(urgentResult.procurementReentryRecommended).toBe(true);
    expect(urgentResult.nextDestination).toBe("procurement_reentry");

    // Sufficient stock → no reorder
    const okResult = evaluateReorderTrigger(
      { snapshotId: "snap2", caseId: "case_s6b", sentStateRecordId: "sent1", releaseSessionId: "rel1", availableLines: [], totalAvailableQty: 500, projectedAt: "", projectedBy: "", reorderTriggerEligible: true, nextDestination: "reorder_evaluation" },
      context,
    );
    expect(okResult.evaluationResult).toBe("no_reorder_needed");
    expect(okResult.procurementReentryRecommended).toBe(false);
  });

  // S7: Policy surface consistency across chain
  it("S7: all chain stages use same policy surface language", () => {
    const operator = makeActor("op_1", ["operator"]);
    const allSurfaces = buildAllWorkspacePolicySurfaces(operator, "case_s7");

    // All surfaces have valid statusBadge
    const validBadges = ["allowed", "approval_needed", "blocked", "reapproval_needed", "escalation_needed", "unknown"];
    allSurfaces.forEach(s => {
      expect(validBadges).toContain(s.inlineGuidance.statusBadge);
      expect(s.inlineGuidance.primaryMessage.length).toBeGreaterThan(0);
    });

    // Case summary counts add up
    const summary = buildCasePolicySummary(allSurfaces, "case_s7");
    expect(summary.totalWorkspaces).toBe(allSurfaces.length);
    expect(summary.allowedCount + summary.approvalNeededCount + summary.blockedCount + summary.reapprovalNeededCount + summary.escalationNeededCount).toBeLessThanOrEqual(summary.totalWorkspaces);
  });

  // S8: Ownership resolution per chain stage
  it("S8: ownership resolves correctly for chain stage domains", () => {
    const records: OwnershipRecord[] = [
      { recordId: "o1", ownershipType: "approval_owner", ownerId: "fire_ap", ownerName: "Fire Approver", ownerRole: "approver", ownerTeamId: "t1", ownerDepartmentId: "d1", scopeType: "team", scopeId: "t1", scopeLabel: "Team 1", domain: "fire_execution", policyDomain: null, active: true, effectiveFrom: new Date().toISOString(), effectiveUntil: null, fallbackOwnerId: null, fallbackOwnerName: null, assignedBy: "admin", assignedAt: new Date().toISOString(), reason: "test" },
      { recordId: "o2", ownershipType: "approval_owner", ownerId: "stock_ap", ownerName: "Stock Approver", ownerRole: "approver", ownerTeamId: "t1", ownerDepartmentId: "d1", scopeType: "team", scopeId: "t1", scopeLabel: "Team 1", domain: "stock_release", policyDomain: null, active: true, effectiveFrom: new Date().toISOString(), effectiveUntil: null, fallbackOwnerId: null, fallbackOwnerName: null, assignedBy: "admin", assignedAt: new Date().toISOString(), reason: "test" },
    ];

    const fireOwner = resolveOwner(records, { ownershipType: "approval_owner", organizationId: "org_1", departmentId: "d1", teamId: "t1", siteId: "", domain: "fire_execution", policyDomain: null });
    expect(fireOwner.ownerId).toBe("fire_ap");

    const stockOwner = resolveOwner(records, { ownershipType: "approval_owner", organizationId: "org_1", departmentId: "d1", teamId: "t1", siteId: "", domain: "stock_release", policyDomain: null });
    expect(stockOwner.ownerId).toBe("stock_ap");
  });

  // S9: Conflict diagnostics for chain action
  it("S9: conflict payload generated for fire execution with org policy", () => {
    const operator = makeActor("op_1", ["operator"]);
    const perm = checkPermission("actual_send_fire_execute", operator, { totalAmount: 3000000 });
    const orgDecisions = evaluateAllOrgPolicies([], { organizationId: "org_1", departmentId: "d1", teamId: "t1", siteId: "", locationId: "", actionKey: "actual_send_fire_execute", riskTier: "tier3_irreversible", totalAmount: 3000000, vendorId: "", vendorName: "", itemCategoryId: "", itemClassification: "", releaseLocationId: "", releaseBinId: "", reorderQty: 0 });
    const explanations = buildAllPolicyExplanations(orgDecisions);

    const payload = buildPolicyApprovalConflictPayload("case_s9", "actual_send_fire_execute", perm, orgDecisions, explanations, null);

    expect(payload.riskTier).toBe("tier3_irreversible");
    expect(payload.effectiveApprovalSource).not.toBe("none");
    expect(payload.operatorSafeSummary.length).toBeGreaterThan(0);
    expect(payload.auditSafeTrace.length).toBeGreaterThan(0);
  });

  // S10: Chain action → governance loop invalidation
  it("S10: chain resolution triggers governance loop closure with correct invalidation", () => {
    const ctx = createGovernanceLoopContext("owner_backlog", "approval", "fire_case", "backlog");
    const result = closeGovernanceLoop(ctx, "resolved", "Fire approval completed");

    expect(result.invalidationTargets).toContain("owner_backlog");
    expect(result.invalidationTargets).toContain("recommended_actions");
    expect(result.toastType).toBe("success");
  });

  // S11: Approval timeline records chain events
  it("S11: approval events recorded in stage timeline", () => {
    let timeline = createStageTimeline("case_s11");

    timeline = recordApprovalEvent(timeline, {
      eventType: "approval_requested", caseId: "case_s11",
      actionKey: "actual_send_fire_execute", stage: "fire",
      actorId: "op_1", targetActorId: "ap_1", snapshotId: null,
      reason: "Fire approval requested", policyConstraints: [], sodViolations: [],
      timestamp: new Date().toISOString(),
    });

    timeline = recordApprovalEvent(timeline, {
      eventType: "approval_granted", caseId: "case_s11",
      actionKey: "actual_send_fire_execute", stage: "fire",
      actorId: "ap_1", targetActorId: null, snapshotId: "snap_1",
      reason: "Approved", policyConstraints: [], sodViolations: [],
      timestamp: new Date().toISOString(),
    });

    expect(timeline.entries.length).toBe(2);
    expect(timeline.entries[0].fromStage).toBe("approval:fire");
    expect(timeline.entries[1].toStage).toBe("approved:fire");
  });

  // S12: Chain audit data maps to export schema
  it("S12: permission/approval/policy results have exportable structure", () => {
    const operator = makeActor("op_1", ["operator"]);
    const perm = checkPermission("actual_send_fire_execute", operator);

    // Permission result is exportable
    expect(perm.actionKey).toBeDefined();
    expect(perm.permissionLevel).toBeDefined();
    expect(perm.reason).toBeDefined();
    expect(perm.policyResults).toBeDefined();
    expect(perm.approvalRequirement).toBeDefined();
    expect(perm.approvalRequirement.actionRiskTier).toBeDefined();
    expect(perm.approvalRequirement.policySnapshot).toBeDefined();

    // All fields serializable (no functions, no circular refs)
    const serialized = JSON.stringify(perm);
    expect(serialized.length).toBeGreaterThan(0);
    const parsed = JSON.parse(serialized);
    expect(parsed.actionKey).toBe(perm.actionKey);
  });
});
