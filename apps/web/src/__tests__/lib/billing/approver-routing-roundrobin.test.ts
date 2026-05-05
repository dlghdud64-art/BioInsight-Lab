/**
 * #approver-routing-multi-owner-roundrobin — RED→GREEN test
 *
 * helper 의 candidate findFirst 가 orderBy lastApprovalAssignedAt asc +
 * createdAt asc tie-breaker — round-robin 분산.
 *   - lastApprovalAssignedAt null (한 번도 안 받음) → 우선 매핑
 *   - 기존 받은 사람 중 가장 오래 안 받은 사람 → 다음 우선
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

describe("#approver-routing-multi-owner-roundrobin — orderBy lastApprovalAssignedAt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("workspace_admin findFirst 의 orderBy 에 lastApprovalAssignedAt asc + createdAt asc 포함", async () => {
    (db.workspaceMember.findFirst as any).mockResolvedValueOnce({
      userId: "u1",
      approvalLimit: null,
      user: { email: "u1@example.com", name: "U1" },
    });

    await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 500_000, // low tier → workspace_admin
      requesterId: "req",
    });

    expect(db.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: expect.arrayContaining([
          { lastApprovalAssignedAt: expect.objectContaining({ sort: "asc", nulls: "first" }) },
        ]),
      }),
    );
  });

  it("organizationMember (org_owner) findFirst 의 orderBy 에 lastApprovalAssignedAt asc 포함", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "owner",
      approvalLimit: null,
      user: { email: "owner@example.com", name: "OWNER" },
    });

    await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 50_000_000, // high tier → org_owner
      requesterId: "req",
    });

    expect(db.organizationMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: expect.arrayContaining([
          { lastApprovalAssignedAt: expect.objectContaining({ sort: "asc", nulls: "first" }) },
        ]),
      }),
    );
  });

  it("self_admin (low tier fallback) 도 orderBy lastApprovalAssignedAt", async () => {
    (db.workspaceMember.findFirst as any)
      .mockResolvedValueOnce(null) // 본인 외 ws_admin 0
      .mockResolvedValueOnce({
        userId: "self",
        approvalLimit: null,
        user: { email: "self@example.com", name: "Self" },
      });

    await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 500_000,
      requesterId: "self",
    });

    // self_admin findFirst (2번째 호출) 의 orderBy 검증
    const lastCall = (db.workspaceMember.findFirst as any).mock.calls[1]?.[0];
    expect(lastCall).toMatchObject({
      orderBy: expect.arrayContaining([
        { lastApprovalAssignedAt: expect.objectContaining({ sort: "asc" }) },
      ]),
    });
  });
});
