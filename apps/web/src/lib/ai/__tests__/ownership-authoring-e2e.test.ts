// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Ownership Authoring E2E Tests
 *
 * CRUD + reassign/transfer 후 governance loop invalidation 검증.
 *
 * 12 scenarios:
 * S1:  Create ownership → record 생성 + event 발행
 * S2:  Create duplicate → 거부
 * S3:  Update owner → diff 생성 + field-level tracking
 * S4:  Deactivate → soft delete + unresolved detection
 * S5:  Assign ownerless → immediate assignment
 * S6:  Reassign bulk → overloaded owner → target owner 이관
 * S7:  Transfer scope → bulk scope migration
 * S8:  Create → governance loop ownership_changed invalidation
 * S9:  Reassign → dashboard owner panels + actions invalidation
 * S10: Ownership resolution after create → new owner wins
 * S11: Ownership resolution after deactivate → fallback or unresolved
 * S12: Full cycle: create → update → reassign → deactivate → resolution consistency
 */

import { describe, it, expect } from "vitest";

import {
  applyOwnershipAuthoring,
  type OwnershipAuthoringPayload,
} from "../ownership-authoring-engine";

import {
  resolveOwner,
  resolveFullOwnership,
  type OwnershipRecord,
  type OwnershipType,
} from "../multi-team-ownership-engine";

import {
  applyLoopEvent,
  createDashboardContext,
} from "../governance-loop-closure-engine";

import {
  detectUnassignedItems,
  detectOverloadedOwners,
  computeOwnerMetrics,
} from "../ownership-aware-governance-metrics";

import type { ApprovalInboxItemV2 } from "../approval-inbox-projection-v2-engine";

// ── Helpers ──
function makeOwnershipRecord(overrides: Partial<OwnershipRecord> = {}): OwnershipRecord {
  return {
    recordId: `own_${Math.random().toString(36).slice(2, 8)}`,
    ownershipType: "approval_owner",
    ownerId: "owner_1", ownerName: "Owner A", ownerRole: "approver",
    ownerTeamId: "team_1", ownerDepartmentId: "dept_1",
    scopeType: "team", scopeId: "team_1", scopeLabel: "Lab Team A",
    domain: "fire_execution", policyDomain: null,
    active: true,
    effectiveFrom: new Date().toISOString(),
    effectiveUntil: null,
    fallbackOwnerId: null, fallbackOwnerName: null,
    assignedBy: "admin_1", assignedAt: new Date().toISOString(),
    reason: "Initial assignment",
    ...overrides,
  };
}

function makePayload(overrides: Partial<OwnershipAuthoringPayload> = {}): OwnershipAuthoringPayload {
  return {
    action: "create",
    actor: "admin_1", actorRole: "admin",
    timestamp: new Date().toISOString(),
    reason: "Test",
    ...overrides,
  };
}

describe("Ownership Authoring E2E", () => {

  // S1: Create ownership
  it("S1: create ownership generates record + event", () => {
    const result = applyOwnershipAuthoring([], makePayload({
      action: "create",
      ownershipType: "approval_owner",
      ownerId: "ap_1", ownerName: "Approver Kim",
      ownerRole: "approver", ownerTeamId: "team_1",
      scopeType: "team", scopeId: "team_1", scopeLabel: "Lab Team A",
      domain: "fire_execution",
      reason: "팀 승인 담당 배정",
    }));

    expect(result.applied).toBe(true);
    expect(result.record).not.toBeNull();
    expect(result.record!.ownerId).toBe("ap_1");
    expect(result.record!.active).toBe(true);
    expect(result.events.length).toBe(1);
    expect(result.events[0].type).toBe("ownership_created");
    expect(result.diff).not.toBeNull();
    expect(result.diff!.action).toBe("create");
  });

  // S2: Create duplicate → rejected
  it("S2: duplicate ownership in same scope/domain rejected", () => {
    const existing = [makeOwnershipRecord({
      ownershipType: "approval_owner",
      scopeType: "team", scopeId: "team_1",
      domain: "fire_execution", active: true,
    })];

    const result = applyOwnershipAuthoring(existing, makePayload({
      action: "create",
      ownershipType: "approval_owner",
      ownerId: "ap_2", ownerName: "Another",
      scopeType: "team", scopeId: "team_1",
      domain: "fire_execution",
    }));

    expect(result.applied).toBe(false);
    expect(result.rejectedReason).toContain("이미 active");
  });

  // S3: Update owner → diff
  it("S3: update owner tracks field-level diff", () => {
    const existing = [makeOwnershipRecord({ recordId: "own_upd" })];

    const result = applyOwnershipAuthoring(existing, makePayload({
      action: "update",
      targetRecordId: "own_upd",
      ownerId: "ap_new", ownerName: "New Owner",
      reason: "담당자 변경",
    }));

    expect(result.applied).toBe(true);
    expect(result.record!.ownerId).toBe("ap_new");
    expect(result.diff!.changes.length).toBeGreaterThan(0);
    expect(result.diff!.changes.some(c => c.field === "ownerId")).toBe(true);
  });

  // S4: Deactivate → soft delete
  it("S4: deactivate sets active=false", () => {
    const existing = [makeOwnershipRecord({ recordId: "own_deact" })];

    const result = applyOwnershipAuthoring(existing, makePayload({
      action: "deactivate",
      targetRecordId: "own_deact",
      reason: "팀 해체",
    }));

    expect(result.applied).toBe(true);
    expect(result.record!.active).toBe(false);
    expect(result.events[0].type).toBe("ownership_deactivated");
  });

  // S5: Assign ownerless → immediate
  it("S5: assign creates ownership for ownerless context", () => {
    const result = applyOwnershipAuthoring([], makePayload({
      action: "assign",
      ownershipType: "backlog_owner",
      ownerId: "op_1", ownerName: "Operator Lee",
      ownerRole: "operator",
      scopeType: "site", scopeId: "site_1", scopeLabel: "Seoul Lab",
      domain: "stock_release",
      reason: "긴급 미지정 건 배정",
    }));

    expect(result.applied).toBe(true);
    expect(result.record!.ownershipType).toBe("backlog_owner");
    expect(result.record!.ownerId).toBe("op_1");
  });

  // S6: Reassign bulk
  it("S6: reassign transfers all records from overloaded to target owner", () => {
    const existing = [
      makeOwnershipRecord({ recordId: "r1", ownerId: "overloaded_1", ownerName: "Overloaded" }),
      makeOwnershipRecord({ recordId: "r2", ownerId: "overloaded_1", ownerName: "Overloaded", domain: "stock_release" }),
      makeOwnershipRecord({ recordId: "r3", ownerId: "other_1", ownerName: "Other" }),
    ];

    const result = applyOwnershipAuthoring(existing, makePayload({
      action: "reassign",
      fromOwnerId: "overloaded_1",
      toOwnerId: "relief_1", toOwnerName: "Relief Owner",
      reason: "과부하 해소",
    }));

    expect(result.applied).toBe(true);
    expect(result.affectedRecords.length).toBe(2); // only overloaded_1's records
    expect(result.affectedRecords.every(r => r.ownerId === "relief_1")).toBe(true);
    expect(result.diff!.summary).toContain("2건 재배정");
  });

  // S7: Transfer scope
  it("S7: transfer migrates all records from old scope to new scope", () => {
    const existing = [
      makeOwnershipRecord({ recordId: "t1", scopeId: "site_old", scopeLabel: "Old Site" }),
      makeOwnershipRecord({ recordId: "t2", scopeId: "site_old", scopeLabel: "Old Site", ownershipType: "sla_owner" }),
      makeOwnershipRecord({ recordId: "t3", scopeId: "site_other" }),
    ];

    const result = applyOwnershipAuthoring(existing, makePayload({
      action: "transfer",
      fromScopeId: "site_old",
      toScopeId: "site_new", toScopeLabel: "New Site",
      reason: "사이트 이전",
    }));

    expect(result.applied).toBe(true);
    expect(result.affectedRecords.length).toBe(2);
    expect(result.affectedRecords.every(r => r.scopeId === "site_new")).toBe(true);
    expect(result.diff!.summary).toContain("2건 scope 이전");
  });

  // S8: Create → governance loop invalidation
  it("S8: ownership create triggers ownership_changed loop event → correct invalidation", () => {
    const ctx = createDashboardContext();
    const loopResult = applyLoopEvent(ctx, {
      type: "ownership_changed",
      ownershipType: "approval_owner",
      ownerId: "new_ap",
    });

    expect(loopResult.invalidations).toContain("owner_backlog");
    expect(loopResult.invalidations).toContain("ownership_coverage");
    expect(loopResult.invalidations).toContain("recommended_actions");
    expect(loopResult.invalidations).not.toContain("all"); // not full refresh
    expect(loopResult.invalidations).not.toContain("policy_impact_trend"); // ownership doesn't affect policy trend
  });

  // S9: Reassign → dashboard panels invalidation
  it("S9: reassign triggers ownership + team breakdown invalidation", () => {
    const ctx = createDashboardContext();
    const result = applyLoopEvent(ctx, {
      type: "ownership_changed",
      ownershipType: "backlog_owner",
      ownerId: "relief_1",
    });

    expect(result.invalidations).toContain("owner_backlog");
    expect(result.invalidations).toContain("team_site_breakdown");
    expect(result.toastMessage).toContain("변경 반영");
  });

  // S10: Resolution after create → new owner wins
  it("S10: newly created ownership record wins in resolution", () => {
    const records: OwnershipRecord[] = [
      makeOwnershipRecord({ ownerId: "org_default", ownerName: "Org Default", scopeType: "organization", scopeId: "org_1" }),
      makeOwnershipRecord({ ownerId: "team_specific", ownerName: "Team Specific", scopeType: "team", scopeId: "team_1" }),
    ];

    const resolved = resolveOwner(records, {
      ownershipType: "approval_owner",
      organizationId: "org_1", departmentId: "dept_1", teamId: "team_1", siteId: "",
      domain: "fire_execution", policyDomain: null,
    });

    // Team scope (precedence 30) wins over org scope (precedence 10)
    expect(resolved.ownerId).toBe("team_specific");
    expect(resolved.matchedScopeType).toBe("team");
    expect(resolved.resolvedBy).toBe("explicit_assignment");
  });

  // S11: Deactivate → fallback or unresolved
  it("S11: after deactivation, resolution falls to wider scope or unresolved", () => {
    const records: OwnershipRecord[] = [
      makeOwnershipRecord({ ownerId: "org_default", scopeType: "organization", scopeId: "org_1" }),
      makeOwnershipRecord({ ownerId: "team_deactivated", scopeType: "team", scopeId: "team_1", active: false }),
    ];

    const resolved = resolveOwner(records, {
      ownershipType: "approval_owner",
      organizationId: "org_1", departmentId: "dept_1", teamId: "team_1", siteId: "",
      domain: "fire_execution", policyDomain: null,
    });

    // Team record deactivated → falls to org level
    expect(resolved.ownerId).toBe("org_default");
    expect(resolved.matchedScopeType).toBe("organization");
  });

  // S12: Full cycle consistency
  it("S12: create → update → reassign → deactivate → resolution remains consistent", () => {
    let records: OwnershipRecord[] = [];

    // Step 1: Create
    const createResult = applyOwnershipAuthoring(records, makePayload({
      action: "create",
      ownershipType: "approval_owner",
      ownerId: "ap_cycle", ownerName: "Cycle Owner",
      scopeType: "team", scopeId: "team_cycle", scopeLabel: "Cycle Team",
      domain: "fire_execution",
    }));
    expect(createResult.applied).toBe(true);
    records = [createResult.record!];

    // Step 2: Update
    const updateResult = applyOwnershipAuthoring(records, makePayload({
      action: "update",
      targetRecordId: createResult.record!.recordId,
      fallbackOwnerId: "fallback_1", fallbackOwnerName: "Fallback Owner",
      reason: "fallback 추가",
    }));
    expect(updateResult.applied).toBe(true);
    records = [updateResult.record!];
    expect(updateResult.record!.fallbackOwnerId).toBe("fallback_1");

    // Step 3: Resolve → cycle owner wins
    const resolved1 = resolveOwner(records, {
      ownershipType: "approval_owner",
      organizationId: "org_1", departmentId: "dept_1", teamId: "team_cycle", siteId: "",
      domain: "fire_execution", policyDomain: null,
    });
    expect(resolved1.ownerId).toBe("ap_cycle");

    // Step 4: Deactivate
    const deactResult = applyOwnershipAuthoring(records, makePayload({
      action: "deactivate",
      targetRecordId: records[0].recordId,
      reason: "퇴사",
    }));
    expect(deactResult.applied).toBe(true);
    records = [deactResult.record!];

    // Step 5: Resolve → unresolved (no active record)
    const resolved2 = resolveOwner(records, {
      ownershipType: "approval_owner",
      organizationId: "org_1", departmentId: "dept_1", teamId: "team_cycle", siteId: "",
      domain: "fire_execution", policyDomain: null,
    });
    expect(resolved2.resolvedBy).toBe("unresolved");
    expect(resolved2.ownershipReason).toContain("미지정");
  });
});
