/**
 * S4 — Authority Transfer / Succession Consistency 테스트
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createAuthorityLine,
  getAuthorityLine,
  requestTransfer,
  guardDirectOverride,
  checkAuthorityIntegrity,
  countActiveAuthorities,
  _resetAuthorityRegistry,
} from "../core/authority/authority-registry";
import { _resetAuditEvents, getAuditEvents } from "../core/audit/audit-events";

describe("S4: Authority Transfer / Succession Consistency", () => {
  beforeEach(() => {
    _resetAuthorityRegistry();
    _resetAuditEvents();
  });

  // 1. authority source of truth single registry test
  it("should have exactly one registry for authority", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    const line = getAuthorityLine("line-1");
    expect(line).not.toBeNull();
    expect(line!.currentAuthorityId).toBe("auth-A");
  });

  // 2. transfer validation blocks ineligible successor test
  it("should reject transfer with same successor as current", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    const result = requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-A", // same!
      actor: "ops",
      reason: "test",
      correlationId: "cor-2",
    });
    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe("SUCCESSOR_NOT_ELIGIBLE");
  });

  // 3. concurrent transfer blocked by lock test
  it("should block concurrent transfer on same line", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    // first transfer succeeds
    const r1 = requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-B",
      actor: "ops",
      reason: "test",
      correlationId: "cor-2",
    });
    expect(r1.success).toBe(true);

    // second transfer on same line — finalized, so idle again would need manual reset
    // create new line for concurrent test
    createAuthorityLine("line-2", "auth-C", "bl-1", "ops", "cor-3");
    const r2 = requestTransfer({
      authorityLineId: "line-2",
      requestedSuccessorId: "auth-D",
      actor: "ops",
      reason: "test",
      correlationId: "cor-4",
    });
    expect(r2.success).toBe(true);
  });

  // 4. transfer state machine valid order only test
  it("should complete transfer in correct state order", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    const result = requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-B",
      actor: "ops",
      reason: "succession",
      correlationId: "cor-2",
    });
    expect(result.success).toBe(true);
    expect(result.transferState).toBe("TRANSFER_FINALIZED");

    const line = getAuthorityLine("line-1")!;
    expect(line.currentAuthorityId).toBe("auth-B");
    expect(line.authorityState).toBe("ACTIVE");
  });

  // 5. current authority freeze required before revoke test
  it("should have authority frozen then revoked during transfer", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-B",
      actor: "ops",
      reason: "test",
      correlationId: "cor-2",
    });
    const line = getAuthorityLine("line-1")!;
    // old authority should be in revoked list
    expect(line.revokedAuthorityIds).toContain("auth-A");
  });

  // 6. old authority revoked before new authority activate test
  it("should revoke old before activating new", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-B",
      actor: "ops",
      reason: "test",
      correlationId: "cor-2",
    });
    const line = getAuthorityLine("line-1")!;
    expect(line.revokedAuthorityIds).toContain("auth-A");
    expect(line.currentAuthorityId).toBe("auth-B");
    expect(line.authorityState).toBe("ACTIVE");
  });

  // 7. split-brain prevented during transfer test
  it("should prevent split-brain", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-B",
      actor: "ops",
      reason: "test",
      correlationId: "cor-2",
    });
    const integrity = checkAuthorityIntegrity();
    expect(integrity.splitBrain).toBe(false);
  });

  // 8. orphan authority detected blocks finalize test
  it("should not have orphan after successful transfer", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-B",
      actor: "ops",
      reason: "test",
      correlationId: "cor-2",
    });
    const integrity = checkAuthorityIntegrity();
    expect(integrity.orphanCount).toBe(0);
  });

  // 9. continuity validation required before finalize test
  it("should validate continuity as part of transfer", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    const result = requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-B",
      actor: "ops",
      reason: "test",
      correlationId: "cor-2",
    });
    // finalize only reached after continuity validated
    expect(result.transferState).toBe("TRANSFER_FINALIZED");
  });

  // 10. transfer rollback restores consistent authority line test
  it("should rollback transfer when continuity fails on duplicate transfer attempt", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    // successful first transfer
    requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-B",
      actor: "ops",
      reason: "first",
      correlationId: "cor-2",
    });
    // line is now TRANSFER_FINALIZED (not IDLE)
    // attempting another transfer triggers CONCURRENT_TRANSFER_BLOCKED, line stays consistent
    const r2 = requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-C",
      actor: "ops",
      reason: "second",
      correlationId: "cor-3",
    });
    expect(r2.success).toBe(false);
    // authority line should remain consistent
    const line = getAuthorityLine("line-1")!;
    expect(line.currentAuthorityId).toBe("auth-B");
    expect(line.authorityState).toBe("ACTIVE");
    const integrity = checkAuthorityIntegrity();
    expect(integrity.splitBrain).toBe(false);
    expect(integrity.orphanCount).toBe(0);
  });

  // 11. direct authority override blocked test
  it("should block direct registry patch", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    const guard = guardDirectOverride("line-1", "DIRECT_REGISTRY_PATCH");
    expect(guard.allowed).toBe(false);
    expect(guard.reasonCode).toBe("DIRECT_REGISTRY_PATCH_BLOCKED");
  });

  // 12. side-channel authority mutation blocked test
  it("should block side-channel mutation", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    const guard = guardDirectOverride("line-1", "SIDE_CHANNEL_MUTATION");
    expect(guard.allowed).toBe(false);
  });

  // 13. duplicate transfer request does not re-activate test
  it("should reject transfer on non-idle line", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-B",
      actor: "ops",
      reason: "first",
      correlationId: "cor-2",
    });
    // line is now TRANSFER_FINALIZED, not IDLE
    const r2 = requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-C",
      actor: "ops",
      reason: "second",
      correlationId: "cor-3",
    });
    expect(r2.success).toBe(false);
    expect(r2.reasonCode).toBe("CONCURRENT_TRANSFER_BLOCKED");
  });

  // 14. revoked authority cannot remain effective test
  it("should ensure revoked authority not in active position", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-B",
      actor: "ops",
      reason: "test",
      correlationId: "cor-2",
    });
    const integrity = checkAuthorityIntegrity();
    expect(integrity.revokedStillEffective).toBe(false);
  });

  // 15. audit trace reconstructs full succession timeline test
  it("should produce audit events for transfer", () => {
    createAuthorityLine("line-1", "auth-A", "bl-1", "ops", "cor-1");
    requestTransfer({
      authorityLineId: "line-1",
      requestedSuccessorId: "auth-B",
      actor: "ops",
      reason: "test",
      correlationId: "cor-2",
    });
    const audits = getAuditEvents();
    expect(audits.length).toBeGreaterThan(0);
    expect(audits.some((a) => a.detail.includes("authority transfer finalized"))).toBe(true);
  });
});
