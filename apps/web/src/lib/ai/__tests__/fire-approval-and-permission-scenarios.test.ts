// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Fire Approval + Permission / Approval Scenario Test Pack — Batch 1
 *
 * 10 scenarios:
 * 1. Happy path: operator request → approver approve → snapshot consume → fire unlock
 * 2. Self-approval blocked for Tier 3 fire execution
 * 3. Viewer/requester role denied for fire execution
 * 4. Snapshot expired — consume blocked
 * 5. Snapshot already consumed — reuse blocked
 * 6. Payload hash mismatch after approval — consume guard fails
 * 7. Policy constraint (budget threshold) blocks fire
 * 8. Restricted item blocks fire → escalation to admin
 * 9. Approval → payload change → reapproval flow
 * 10. Gate precondition: fire session not ready → gate blocked
 */

import { describe, it, expect } from "vitest";
import {
  checkPermission,
  createApprovalRequest,
  type ActorContext,
  type PolicyEvaluationContext,
} from "../dispatch-v2-permission-policy-engine";
import {
  buildApprovalWorkbenchStateV2,
  decideApprovalV2,
  consumeApprovalSnapshot,
  type ApprovalSnapshotV2,
} from "../dispatch-v2-approval-workbench-engine";
import {
  buildFireApprovalGateV2,
  type FirePayloadHash,
} from "../fire-approval-handoff-gate-v2-engine";
import {
  createFireApprovalSession,
  applyFireApprovalMutation,
  runSnapshotConsumeGuard,
  recordApprovalTimePayloadHash,
} from "../fire-approval-resolution-v2-engine";
import type { ActualSendFireSessionV2 } from "../actual-send-fire-resolution-v2-engine";

// ── Test Helpers ──

function makeActor(id: string, roles: ActorContext["roles"]): ActorContext {
  return { actorId: id, roles, organizationId: "org_1", departmentId: "dept_1", delegatedBy: null, sessionId: "sess_1" };
}

function makeFireSession(caseId: string, status: "fire_ready_pending_ignition" | "fire_open" = "fire_ready_pending_ignition"): ActualSendFireSessionV2 {
  return {
    actualSendFireSessionId: "fire_sess_1", caseId, handoffPackageId: "hp_1",
    actualSendFireGateId: "fg_1", actualSendExecuteSessionId: "exec_1",
    sessionStatus: status, firePhase: "pending_actual_send_ignition",
    openedAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString(), openedBy: "system",
    activeSectionKey: null, operatorFocusOrder: [],
    sectionResolutionStates: [],
    ignitionReadinessGateState: {
      ignitionReadinessStatus: status === "fire_ready_pending_ignition" ? "fire_ready_pending_ignition" : "not_ready",
      requiredSectionsTotal: 6, sectionsReadyCount: 6,
      unresolvedSectionKeys: [], warningOnlySectionKeys: [],
      ignitionReadinessBlockers: [],
      ignitionReadinessAllowed: status === "fire_ready_pending_ignition",
      ignitionReadinessReason: status === "fire_ready_pending_ignition" ? "All sections ready" : "Not ready",
    },
    returnHistory: [], reopenLinks: [], auditEventRefs: [], provenance: "",
  } as ActualSendFireSessionV2;
}

function makePayloadHash(version: string = "v1"): FirePayloadHash {
  return {
    entityVersion: version,
    payloadContentHash: `hash_content_${version}`,
    policyEvaluationHash: `hash_policy_${version}`,
    lineItemScope: `scope_${version}`,
  };
}

function makeValidSnapshot(caseId: string, approvedBy: string): ApprovalSnapshotV2 {
  return {
    snapshotId: `snap_${Date.now().toString(36)}`,
    requestId: "req_1", caseId,
    actionKey: "approve_fire_execution",
    riskTier: "tier3_irreversible",
    approvedBy, approvedByRole: "approver",
    approvedAt: new Date().toISOString(),
    approvalReason: "Approved for fire",
    policyConstraintResults: [],
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    consumed: false, consumedAt: null, consumedByAction: null,
  };
}

// ── Test Scenarios ──

describe("Fire Approval + Permission Scenarios — Batch 1", () => {

  // Scenario 1: Happy Path
  it("S1: operator request → approver approve → snapshot consume → fire unlock", () => {
    const operator = makeActor("op_1", ["operator"]);
    const approver = makeActor("ap_1", ["approver"]);
    const caseId = "case_happy";

    // Step 1: Permission check — operator needs approval for fire
    const perm = checkPermission("actual_send_fire_execute", operator);
    expect(perm.requiresApproval).toBe(true);
    expect(perm.permissionLevel).toBe("requires_approval");
    expect(perm.approvalRequirement.actionRiskTier).toBe("tier3_irreversible");
    expect(perm.approvalRequirement.selfApprovalAllowed).toBe(false);
    expect(perm.approvalRequirement.dualApprovalRequired).toBe(true);

    // Step 2: Create approval request
    const request = createApprovalRequest(caseId, "actual_send_fire_execute", "op_1", "approver", "Fire execution", "budget OK");

    // Step 3: Build workbench for approver
    const workbench = buildApprovalWorkbenchStateV2(request, perm.approvalRequirement, approver, "PO-123 payload", 5, 3000000);
    expect(workbench.canApprove).toBe(true);
    expect(workbench.workbenchStatus).toBe("pending_review");

    // Step 4: Approve
    const { workbench: decided, snapshot } = decideApprovalV2(workbench, "approved", approver, "Confirmed OK");
    expect(decided.workbenchStatus).toBe("approved");
    expect(snapshot).not.toBeNull();
    expect(snapshot!.consumed).toBe(false);

    // Step 5: Build fire approval gate
    const fireSession = makeFireSession(caseId);
    const payloadHash = makePayloadHash();
    const gate = buildFireApprovalGateV2(fireSession, perm, approver, snapshot!, payloadHash, payloadHash);
    expect(gate.gateStatus).toBe("approval_granted_ready");
    expect(gate.canProceedToFire).toBe(true);

    // Step 6: Create approval session + consume snapshot
    let session = createFireApprovalSession(caseId, "fire_sess_1", gate.gateId, "op_1");
    session = recordApprovalTimePayloadHash(session, payloadHash);

    const openResult = applyFireApprovalMutation(session, {
      action: "open_approval_session", actor: operator, timestamp: new Date().toISOString(),
    });
    expect(openResult.applied).toBe(true);

    const decisionResult = applyFireApprovalMutation(openResult.updatedSession, {
      action: "submit_approval_decision", actor: approver,
      decision: decided.decision!, timestamp: new Date().toISOString(),
    });
    expect(decisionResult.applied).toBe(true);
    expect(decisionResult.updatedSession.sessionStatus).toBe("approved_pending_consume");

    const consumeResult = applyFireApprovalMutation(decisionResult.updatedSession, {
      action: "consume_approval_snapshot", actor: operator,
      snapshot: snapshot!, payloadHashCurrent: payloadHash,
      timestamp: new Date().toISOString(),
    });
    expect(consumeResult.applied).toBe(true);
    expect(consumeResult.updatedSession.fireUnlocked).toBe(true);
    expect(consumeResult.updatedSession.sessionStatus).toBe("snapshot_consumed_fire_unlocked");
    expect(consumeResult.consumedSnapshot).not.toBeNull();
    expect(consumeResult.consumedSnapshot!.consumed).toBe(true);
  });

  // Scenario 2: Self-approval blocked for Tier 3
  it("S2: approver cannot self-approve Tier 3 fire execution", () => {
    const approver = makeActor("ap_1", ["approver"]);

    const perm = checkPermission("actual_send_fire_execute", approver);
    // Tier 3: even approver requires separate approval
    expect(perm.requiresApproval).toBe(true);
    expect(perm.permissionLevel).toBe("requires_approval");
    expect(perm.approvalRequirement.selfApprovalAllowed).toBe(false);
    expect(perm.approvalRequirement.dualApprovalRequired).toBe(true);

    // Build workbench — same actor as requester
    const request = createApprovalRequest("case_self", "actual_send_fire_execute", "ap_1", "approver", "Self fire", "");
    const workbench = buildApprovalWorkbenchStateV2(request, perm.approvalRequirement, approver, "PO-456", 3, 1000000);
    // canApprove should be false because same actor
    expect(workbench.canApprove).toBe(false);
  });

  // Scenario 3: Viewer denied
  it("S3: viewer role denied for fire execution", () => {
    const viewer = makeActor("v_1", ["viewer"]);
    const perm = checkPermission("actual_send_fire_execute", viewer);
    expect(perm.permitted).toBe(false);
    expect(perm.permissionLevel).toBe("denied");
  });

  // Scenario 4: Snapshot expired
  it("S4: expired snapshot — consume guard blocks", () => {
    const snapshot: ApprovalSnapshotV2 = {
      snapshotId: "snap_exp", requestId: "req_1", caseId: "case_exp",
      actionKey: "approve_fire_execution", riskTier: "tier3_irreversible",
      approvedBy: "ap_1", approvedByRole: "approver",
      approvedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      approvalReason: "OK", policyConstraintResults: [],
      validUntil: new Date(Date.now() - 1000).toISOString(), // expired
      consumed: false, consumedAt: null, consumedByAction: null,
    };
    const hash = makePayloadHash();
    const guard = runSnapshotConsumeGuard(snapshot, "case_exp", "actual_send_fire_execute", hash, hash);
    expect(guard.guardPassed).toBe(false);
    expect(guard.failedChecks.some(f => f.includes("만료"))).toBe(true);
  });

  // Scenario 5: Snapshot already consumed
  it("S5: already consumed snapshot — reuse blocked", () => {
    const snapshot: ApprovalSnapshotV2 = {
      snapshotId: "snap_used", requestId: "req_1", caseId: "case_used",
      actionKey: "approve_fire_execution", riskTier: "tier3_irreversible",
      approvedBy: "ap_1", approvedByRole: "approver",
      approvedAt: new Date().toISOString(), approvalReason: "OK",
      policyConstraintResults: [],
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      consumed: true, consumedAt: new Date().toISOString(), consumedByAction: "fire_1",
    };
    const hash = makePayloadHash();
    const guard = runSnapshotConsumeGuard(snapshot, "case_used", "actual_send_fire_execute", hash, hash);
    expect(guard.guardPassed).toBe(false);
    expect(guard.failedChecks.some(f => f.includes("재사용"))).toBe(true);
  });

  // Scenario 6: Payload hash mismatch
  it("S6: payload hash changed after approval — consume guard fails", () => {
    const snapshot = makeValidSnapshot("case_hash", "ap_1");
    const hashAtApproval = makePayloadHash("v1");
    const hashNow = makePayloadHash("v2"); // changed!

    const guard = runSnapshotConsumeGuard(snapshot, "case_hash", "actual_send_fire_execute", hashAtApproval, hashNow);
    expect(guard.guardPassed).toBe(false);
    expect(guard.failedChecks.length).toBeGreaterThanOrEqual(1);
    expect(guard.failedChecks.some(f => f.includes("변경됨"))).toBe(true);
  });

  // Scenario 7: Budget threshold blocks fire
  it("S7: budget over 5M blocks fire — policy constraint", () => {
    const operator = makeActor("op_1", ["operator"]);
    const perm = checkPermission("actual_send_fire_execute", operator, {
      totalAmount: 6000000, // over 5M
    });
    expect(perm.permitted).toBe(false);
    expect(perm.blockedByPolicy).toBe(true);
    expect(perm.approvalRequirement.blockedReasonCodes.length).toBeGreaterThan(0);
  });

  // Scenario 8: Restricted item → escalation to admin
  it("S8: restricted item requires escalation to admin", () => {
    const operator = makeActor("op_1", ["operator"]);
    const perm = checkPermission("actual_send_fire_execute", operator, {
      isRestrictedItem: true,
    });
    expect(perm.permitted).toBe(false);
    expect(perm.blockedByPolicy).toBe(true);
    expect(perm.escalationRequired).toBe(true);
    expect(perm.escalationRole).toBe("admin");
  });

  // Scenario 9: Approval → payload change → reapproval
  it("S9: approved then payload changes → invalidation → reapproval flow", () => {
    const operator = makeActor("op_1", ["operator"]);
    const approver = makeActor("ap_1", ["approver"]);
    const caseId = "case_reapproval";

    // Initial approval
    const perm = checkPermission("actual_send_fire_execute", operator);
    const request = createApprovalRequest(caseId, "actual_send_fire_execute", "op_1", "approver", "Fire", "");
    const workbench = buildApprovalWorkbenchStateV2(request, perm.approvalRequirement, approver, "PO-789", 4, 2000000);
    const { snapshot } = decideApprovalV2(workbench, "approved", approver, "OK");

    // Session with approval hash v1
    let session = createFireApprovalSession(caseId, "fire_sess_2", "gate_2", "op_1");
    session = recordApprovalTimePayloadHash(session, makePayloadHash("v1"));

    // Submit decision
    const openRes = applyFireApprovalMutation(session, {
      action: "open_approval_session", actor: operator, timestamp: new Date().toISOString(),
    });
    const decRes = applyFireApprovalMutation(openRes.updatedSession, {
      action: "submit_approval_decision", actor: approver,
      decision: { decisionId: "d1", requestId: request.requestId, caseId, actionKey: "actual_send_fire_execute", decision: "approved", decidedBy: "ap_1", decidedByRole: "approver", decidedAt: new Date().toISOString(), decisionReason: "OK", conditionsIfAny: [], approvalSnapshotId: snapshot!.snapshotId },
      timestamp: new Date().toISOString(),
    });
    expect(decRes.updatedSession.sessionStatus).toBe("approved_pending_consume");

    // Try consume with changed payload (v2)
    const consumeRes = applyFireApprovalMutation(decRes.updatedSession, {
      action: "consume_approval_snapshot", actor: operator,
      snapshot: snapshot!, payloadHashCurrent: makePayloadHash("v2"),
      timestamp: new Date().toISOString(),
    });
    // Should be invalidated — payload changed
    expect(consumeRes.updatedSession.sessionStatus).toBe("snapshot_invalidated");
    expect(consumeRes.updatedSession.fireUnlocked).toBe(false);

    // Request reapproval
    const reapprovalRes = applyFireApprovalMutation(consumeRes.updatedSession, {
      action: "request_reapproval", actor: operator, timestamp: new Date().toISOString(),
    });
    expect(reapprovalRes.applied).toBe(true);
    expect(reapprovalRes.updatedSession.sessionStatus).toBe("pending_approval");
    expect(reapprovalRes.updatedSession.approvalSnapshotId).toBeNull();
    expect(reapprovalRes.updatedSession.decisionRecord).toBeNull();
  });

  // Scenario 10: Fire session not ready → gate blocked
  it("S10: fire session not ready — gate not eligible", () => {
    const operator = makeActor("op_1", ["operator"]);
    const fireSession = makeFireSession("case_notready", "fire_open"); // not ready
    const perm = checkPermission("actual_send_fire_execute", operator);
    const hash = makePayloadHash();

    const gate = buildFireApprovalGateV2(fireSession, perm, operator, null, null, hash);
    expect(gate.gateStatus).toBe("not_eligible");
    expect(gate.canProceedToFire).toBe(false);
    expect(gate.hardBlockerCount).toBeGreaterThan(0);
  });

  // Bonus: Tier 1 routine action — no approval needed
  it("S-bonus: Tier 1 routine action passes without approval", () => {
    const operator = makeActor("op_1", ["operator"]);
    const perm = checkPermission("dispatch_preparation_review", operator);
    expect(perm.permitted).toBe(true);
    expect(perm.requiresApproval).toBe(false);
    expect(perm.approvalRequirement.actionRiskTier).toBe("tier1_routine");
    expect(perm.approvalRequirement.selfApprovalAllowed).toBe(true);
  });

  // Bonus: Tier 2 self-approve allowed for admin
  it("S-bonus: Tier 2 self-approve allowed for admin", () => {
    const admin = makeActor("adm_1", ["admin"]);
    const perm = checkPermission("variance_disposition_set", admin);
    expect(perm.permitted).toBe(true);
    expect(perm.approvalRequirement.actionRiskTier).toBe("tier2_org_impact");
  });
});
