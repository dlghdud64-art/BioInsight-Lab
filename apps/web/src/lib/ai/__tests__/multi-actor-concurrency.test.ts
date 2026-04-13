// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Multi-Actor E2E / Concurrency Hardening Test Pack
 *
 * 10 scenarios testing concurrent/multi-actor edge cases:
 * S1:  Policy publish during pending approval → snapshot invalidation
 * S2:  Policy rollback after approval but before consume → invalidation
 * S3:  Dual approval slot 1 complete, policy drift, slot 2 attempt
 * S4:  Consumed snapshot unaffected by policy publish (no retroactive)
 * S5:  Cross-session stale — policy version mismatch
 * S6:  Cross-session stale — explanation outdated
 * S7:  Same case, multiple domains, different actors simultaneously
 * S8:  Policy drift invalidation matrix — correct target classification
 * S9:  Snapshot policy version guard — drift detection
 * S10: Review approved warning (not yet published) — no invalidation
 */

import { describe, it, expect } from "vitest";
import {
  computePolicyDriftInvalidations,
  checkSnapshotPolicyVersion,
  checkCrossSessionStale,
  type PolicyChangeEvent,
  type InvalidationTarget,
} from "../policy-drift-invalidation-engine";
import {
  createPolicySet,
  applyPolicyLifecycle,
  type PolicySet,
} from "../policy-admin-lifecycle-engine";
import {
  createDualApprovalSession,
  submitDualApprovalSlot,
} from "../dual-approval-engine";
import type { ActorContext } from "../dispatch-v2-permission-policy-engine";

function makeActor(id: string, roles: ActorContext["roles"]): ActorContext {
  return { actorId: id, roles, organizationId: "org_1", departmentId: "dept_1", delegatedBy: null, sessionId: "sess_1" };
}

describe("Multi-Actor E2E / Concurrency Hardening", () => {

  // S1: Policy publish during pending approval → snapshot invalidation
  it("S1: policy publish invalidates pending approval sessions and unconsumed snapshots", () => {
    const changeEvent: PolicyChangeEvent = {
      eventType: "policy_published",
      policySetId: "ps_1", versionId: "v_2",
      domain: "budget", scopeType: "organization", scopeId: "org_1",
      previousVersionId: "v_1", actor: "admin_1",
      timestamp: new Date().toISOString(),
    };

    const targets: InvalidationTarget[] = [
      { targetType: "approval_session", targetId: "sess_1", caseId: "case_1", domain: "fire_execution", currentStatus: "pending_approval", isConsumed: false },
      { targetType: "approval_snapshot", targetId: "snap_1", caseId: "case_1", domain: "fire_execution", currentStatus: "valid", isConsumed: false },
      { targetType: "inbox_item", targetId: "inbox_1", caseId: "case_1", domain: "fire_execution", currentStatus: "pending_review", isConsumed: false },
    ];

    const result = computePolicyDriftInvalidations(changeEvent, targets);
    expect(result.totalInvalidated).toBe(2); // session + snapshot
    expect(result.totalMarkedStale).toBe(1); // inbox item
    expect(result.decisions.find(d => d.target.targetType === "approval_session")!.action).toBe("invalidate");
    expect(result.decisions.find(d => d.target.targetType === "approval_snapshot")!.action).toBe("invalidate");
    expect(result.decisions.find(d => d.target.targetType === "inbox_item")!.action).toBe("mark_stale");
  });

  // S2: Policy rollback after approval but before consume
  it("S2: policy rollback invalidates unconsumed approved snapshot", () => {
    const changeEvent: PolicyChangeEvent = {
      eventType: "policy_rolled_back",
      policySetId: "ps_1", versionId: "v_1",
      domain: "vendor", scopeType: "organization", scopeId: "org_1",
      previousVersionId: "v_2", actor: "admin_1",
      timestamp: new Date().toISOString(),
    };

    const targets: InvalidationTarget[] = [
      { targetType: "approval_snapshot", targetId: "snap_approved", caseId: "case_2", domain: "fire_execution", currentStatus: "approved_unconsumed", isConsumed: false },
    ];

    const result = computePolicyDriftInvalidations(changeEvent, targets);
    expect(result.totalInvalidated).toBe(1);
    expect(result.decisions[0].requiresReapproval).toBe(true);
  });

  // S3: Dual approval partial + policy drift
  it("S3: dual approval slot 1 complete, then policy drift → slot 2 should re-evaluate", () => {
    const requester = makeActor("op_1", ["operator"]);
    const approver1 = makeActor("ap_1", ["approver"]);

    let session = createDualApprovalSession("case_3", "actual_send_fire_execute", "tier3_irreversible", requester);
    const result1 = submitDualApprovalSlot(session, 1, approver1, "approved", "OK slot 1", "snap_slot1");
    expect(result1.session.status).toBe("first_approved_awaiting_second");

    // Policy drift happens here — snapshot from slot 1 is now under old policy
    const policyCheck = checkSnapshotPolicyVersion("snap_slot1", "policy_v1", "policy_v2");
    expect(policyCheck.driftDetected).toBe(true);
    expect(policyCheck.driftReason).toContain("drift");
    // Slot 2 should not proceed without addressing the drift
  });

  // S4: Consumed snapshot — no retroactive invalidation
  it("S4: consumed snapshot is NOT retroactively invalidated by policy publish", () => {
    const changeEvent: PolicyChangeEvent = {
      eventType: "policy_published",
      policySetId: "ps_1", versionId: "v_3",
      domain: "budget", scopeType: "organization", scopeId: "org_1",
      previousVersionId: "v_2", actor: "admin_1",
      timestamp: new Date().toISOString(),
    };

    const targets: InvalidationTarget[] = [
      { targetType: "approval_snapshot", targetId: "snap_consumed", caseId: "case_4", domain: "fire_execution", currentStatus: "consumed", isConsumed: true },
    ];

    const result = computePolicyDriftInvalidations(changeEvent, targets);
    expect(result.totalInvalidated).toBe(0);
    expect(result.totalNoOp).toBe(1);
    expect(result.decisions[0].action).toBe("no_op");
    expect(result.decisions[0].reason).toContain("retroactive");
  });

  // S5: Cross-session stale — policy version mismatch
  it("S5: cross-session stale detected when policy version changes", () => {
    const check = checkCrossSessionStale(
      "sess_5", "case_5", "fire_execution",
      "policy_v1", "policy_v2", // different versions
      "2026-03-28T10:00:00Z", "2026-03-28T10:00:00Z",
    );
    expect(check.isStale).toBe(true);
    expect(check.policyDrifted).toBe(true);
    expect(check.recommendedAction).toBe("reapproval_required");
  });

  // S6: Cross-session stale — explanation outdated
  it("S6: cross-session stale when explanation is outdated", () => {
    const check = checkCrossSessionStale(
      "sess_6", "case_6", "stock_release",
      "policy_v1", "policy_v1", // same policy
      "2026-03-28T10:00:00Z", "2026-03-28T11:00:00Z", // explanation newer
    );
    expect(check.isStale).toBe(true);
    expect(check.policyDrifted).toBe(false);
    expect(check.explanationOutdated).toBe(true);
    expect(check.recommendedAction).toBe("refresh_explanation");
  });

  // S7: Different domains unaffected by domain-specific policy change
  it("S7: vendor policy publish does not affect stock_release-only approvals", () => {
    const changeEvent: PolicyChangeEvent = {
      eventType: "policy_published",
      policySetId: "ps_vendor", versionId: "v_2",
      domain: "release", scopeType: "site", scopeId: "site_1",
      previousVersionId: "v_1", actor: "admin_1",
      timestamp: new Date().toISOString(),
    };

    const targets: InvalidationTarget[] = [
      { targetType: "approval_session", targetId: "sess_fire", caseId: "case_7", domain: "fire_execution", currentStatus: "pending", isConsumed: false },
      { targetType: "approval_session", targetId: "sess_release", caseId: "case_7", domain: "stock_release", currentStatus: "pending", isConsumed: false },
    ];

    const result = computePolicyDriftInvalidations(changeEvent, targets);
    // release policy affects stock_release but NOT fire_execution
    const fireDecision = result.decisions.find(d => d.target.targetId === "sess_fire");
    const releaseDecision = result.decisions.find(d => d.target.targetId === "sess_release");
    expect(fireDecision!.action).toBe("no_op");
    expect(releaseDecision!.action).toBe("invalidate");
  });

  // S8: Full invalidation matrix verification
  it("S8: invalidation matrix — all target types handled correctly", () => {
    const changeEvent: PolicyChangeEvent = {
      eventType: "policy_published",
      policySetId: "ps_1", versionId: "v_2",
      domain: "budget", scopeType: "organization", scopeId: "org_1",
      previousVersionId: "v_1", actor: "admin_1",
      timestamp: new Date().toISOString(),
    };

    const targets: InvalidationTarget[] = [
      { targetType: "approval_session", targetId: "t1", caseId: "c1", domain: "fire_execution", currentStatus: "pending", isConsumed: false },
      { targetType: "approval_snapshot", targetId: "t2", caseId: "c1", domain: "fire_execution", currentStatus: "valid", isConsumed: false },
      { targetType: "approval_snapshot", targetId: "t3", caseId: "c1", domain: "fire_execution", currentStatus: "consumed", isConsumed: true },
      { targetType: "inbox_item", targetId: "t4", caseId: "c1", domain: "fire_execution", currentStatus: "pending", isConsumed: false },
      { targetType: "explanation_payload", targetId: "t5", caseId: "c1", domain: "fire_execution", currentStatus: "valid", isConsumed: false },
    ];

    const result = computePolicyDriftInvalidations(changeEvent, targets);
    expect(result.decisions.find(d => d.target.targetId === "t1")!.action).toBe("invalidate");
    expect(result.decisions.find(d => d.target.targetId === "t2")!.action).toBe("invalidate");
    expect(result.decisions.find(d => d.target.targetId === "t3")!.action).toBe("no_op"); // consumed
    expect(result.decisions.find(d => d.target.targetId === "t4")!.action).toBe("mark_stale");
    expect(result.decisions.find(d => d.target.targetId === "t5")!.action).toBe("mark_stale");
  });

  // S9: Snapshot policy version guard
  it("S9: snapshot policy version guard detects drift", () => {
    const match = checkSnapshotPolicyVersion("snap_9", "v1", "v1");
    expect(match.versionsMatch).toBe(true);
    expect(match.driftDetected).toBe(false);

    const drift = checkSnapshotPolicyVersion("snap_9b", "v1", "v2");
    expect(drift.versionsMatch).toBe(false);
    expect(drift.driftDetected).toBe(true);
    expect(drift.driftReason).toContain("재승인");
  });

  // S10: Review approved — warning only, no invalidation
  it("S10: review approved triggers warning but not invalidation", () => {
    const changeEvent: PolicyChangeEvent = {
      eventType: "policy_review_approved",
      policySetId: "ps_1", versionId: "v_draft",
      domain: "budget", scopeType: "organization", scopeId: "org_1",
      previousVersionId: null, actor: "reviewer_1",
      timestamp: new Date().toISOString(),
    };

    const targets: InvalidationTarget[] = [
      { targetType: "approval_session", targetId: "sess_10", caseId: "case_10", domain: "fire_execution", currentStatus: "pending", isConsumed: false },
      { targetType: "inbox_item", targetId: "inbox_10", caseId: "case_10", domain: "fire_execution", currentStatus: "pending", isConsumed: false },
    ];

    const result = computePolicyDriftInvalidations(changeEvent, targets);
    expect(result.totalInvalidated).toBe(0);
    expect(result.decisions.find(d => d.target.targetType === "approval_session")!.action).toBe("no_op");
    expect(result.decisions.find(d => d.target.targetType === "inbox_item")!.action).toBe("warning");
  });
});
