/**
 * #approver-routing-per-user-limit Phase 1 — RED→GREEN test
 *
 * selectApproverByAmount helper 가 candidate 의 approvalLimit 검증:
 *   - candidate.approvalLimit null → 무제한 (정상 매핑)
 *   - amount <= candidate.approvalLimit → 정상 매핑
 *   - amount > candidate.approvalLimit → 다음 fallback (skip)
 *
 * organization member (ADMIN/OWNER) 는 한도 검증 0 (무제한 — escalation).
 * workspace_admin / self_admin 만 검증.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    workspaceMember: { findFirst: vi.fn() },
    organizationMember: { findFirst: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { selectApproverByAmount } from "@/lib/billing/approver-routing";

describe("#approver-routing-per-user-limit — workspace_admin 한도 검증", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approvalLimit null → 무제한 (정상 매핑)", async () => {
    (db.workspaceMember.findFirst as any).mockResolvedValueOnce({
      userId: "u1",
      approvalLimit: null,
      user: { email: "u1@example.com", name: "U1" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 500_000, // low tier
      requesterId: "req",
    });

    expect(result?.source).toBe("workspace_admin");
    expect(result?.userId).toBe("u1");
  });

  it("amount <= approvalLimit → 정상 매핑", async () => {
    (db.workspaceMember.findFirst as any).mockResolvedValueOnce({
      userId: "u1",
      approvalLimit: 1_000_000,
      user: { email: "u1@example.com", name: "U1" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 500_000, // low tier, <= limit
      requesterId: "req",
    });

    expect(result?.source).toBe("workspace_admin");
  });

  it("amount > approvalLimit → DB OR filter 가 candidate skip → self_admin fallback", async () => {
    // helper 의 where.OR clause (approvalLimit null 또는 >= amount) 가
    // DB-side filter — 한도 초과 candidate 는 자동으로 미반환 (null).
    // mock 가 DB-level filter 를 simulate — 첫 findFirst null 반환.
    (db.workspaceMember.findFirst as any)
      .mockResolvedValueOnce(null) // 본인 외 ws_admin 한도 통과 candidate 0
      .mockResolvedValueOnce({
        userId: "self",
        approvalLimit: null,
        user: { email: "self@example.com", name: "Self" },
      });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 500_000, // low tier
      requesterId: "self",
    });

    // ws_admin 한도 통과 candidate 0 → self_admin fallback (한도 무제한)
    expect(result?.source).toBe("self_admin");
    expect(result?.userId).toBe("self");
  });

  it("low tier 모두 한도 초과 → null", async () => {
    // 둘 다 DB-side filter 로 미반환 (한도 초과 candidate 0)
    (db.workspaceMember.findFirst as any)
      .mockResolvedValueOnce(null) // ws_admin 한도 통과 0
      .mockResolvedValueOnce(null); // self_admin 한도 통과 0

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 500_000, // low tier
      requesterId: "self",
    });

    // 모두 한도 초과 → null
    expect(result).toBeNull();
  });
});

describe("#approver-routing-per-user-limit — organization member 검증 0 (무제한)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("org_owner — approvalLimit 검증 0 (high tier 무제한)", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "owner",
      // approvalLimit field 없음 (OrganizationMember 미정의)
      user: { email: "owner@example.com", name: "OWNER" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 50_000_000, // high tier
      requesterId: "req",
    });

    expect(result?.source).toBe("org_owner");
  });
});
