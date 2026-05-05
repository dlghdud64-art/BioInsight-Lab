/**
 * #approver-routing-per-user-limit-organization-member Phase 1 — RED→GREEN
 *
 * helper 의 org_admin / org_owner 분기에서 approvalLimit 검증 추가:
 *   - candidate.approvalLimit null = 무제한
 *   - amount > approvalLimit = DB-side filter 가 candidate skip → 다음 fallback
 *
 * 직전 workspace member (Phase 1) 와 동일 패턴 — DB OR filter
 * (approvalLimit null 또는 >= totalAmount).
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

describe("#approver-routing-per-user-limit-organization-member — helper logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("high tier — org_owner approvalLimit null → 정상 매핑", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "owner",
      approvalLimit: null,
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

  it("high tier — org_owner 한도 초과 (DB filter skip) → org_admin fallback", async () => {
    // org_owner OR clause 가 한도 초과로 candidate 0 반환 → org_admin 시도
    (db.organizationMember.findFirst as any)
      .mockResolvedValueOnce(null) // org_owner 한도 통과 candidate 0
      .mockResolvedValueOnce({
        userId: "org-admin",
        approvalLimit: null,
        user: { email: "oa@example.com", name: "OrgAdmin" },
      });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 50_000_000, // high tier
      requesterId: "req",
    });

    expect(result?.source).toBe("org_admin");
  });

  it("mid tier — org_admin approvalLimit null → 정상 매핑", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "org-admin",
      approvalLimit: null,
      user: { email: "oa@example.com", name: "OrgAdmin" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 5_000_000, // mid tier
      requesterId: "req",
    });

    expect(result?.source).toBe("org_admin");
  });

  it("organizationMember findFirst 의 where 에 approvalLimit OR clause 포함", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "owner",
      approvalLimit: null,
      user: { email: "owner@example.com", name: "OWNER" },
    });

    await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 50_000_000,
      requesterId: "req",
    });

    // organizationMember findFirst 의 where 에 OR (approvalLimit null OR >= amount)
    expect(db.organizationMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { approvalLimit: null },
            { approvalLimit: { gte: 50_000_000 } },
          ]),
        }),
      }),
    );
  });
});
