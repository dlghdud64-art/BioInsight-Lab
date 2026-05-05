/**
 * §11.209d-approver-routing Phase 1 — RED test
 *
 * lib/billing/approver-routing.ts 가 selectApproverByAmount helper +
 * APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW 상수 export.
 *
 * canonical truth: WorkspaceMember (ADMIN/MEMBER) + OrganizationMember
 * (VIEWER/REQUESTER/APPROVER/ADMIN/OWNER). Workspace ↔ Organization 1:1.
 *
 * 매트릭스:
 *   - amount < threshold → workspace ADMIN 첫 (본인 외) → self_admin fallback
 *   - amount >= threshold → org OWNER 첫 → org ADMIN fallback → workspace ADMIN
 *
 * source 필드: workspace_admin / org_owner / org_admin / self_admin
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma 전체 — db.workspaceMember + db.organizationMember 둘 다 사용
vi.mock("@/lib/db", () => ({
  db: {
    workspaceMember: {
      findFirst: vi.fn(),
    },
    organizationMember: {
      findFirst: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  selectApproverByAmount,
  APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW,
} from "@/lib/billing/approver-routing";

describe("§11.209d-approver-routing — APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW 상수", () => {
  it("export 정의 (1,000만원 = 10_000_000)", () => {
    expect(APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW).toBe(10_000_000);
  });
});

describe("§11.209d-approver-routing — selectApproverByAmount 시나리오", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("저액 (< 1,000만원) + workspace ADMIN 존재 → source workspace_admin", async () => {
    (db.workspaceMember.findFirst as any)
      .mockResolvedValueOnce({
        userId: "admin-1",
        user: { email: "admin1@example.com", name: "관리자1" },
      });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 5_000_000,
      requesterId: "requester-1",
    });

    expect(result).not.toBeNull();
    expect(result?.userId).toBe("admin-1");
    expect(result?.email).toBe("admin1@example.com");
    expect(result?.source).toBe("workspace_admin");
  });

  it("저액 + workspace ADMIN 없음 → self_admin fallback", async () => {
    (db.workspaceMember.findFirst as any)
      .mockResolvedValueOnce(null) // 본인 외 ADMIN 0
      .mockResolvedValueOnce({
        userId: "self-admin",
        user: { email: "self@example.com", name: "본인 관리자" },
      });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 1_000_000,
      requesterId: "self-admin",
    });

    expect(result?.userId).toBe("self-admin");
    expect(result?.source).toBe("self_admin");
  });

  it("고액 (>= 1,000만원) + organization OWNER 존재 → source org_owner", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "owner-1",
      user: { email: "owner@example.com", name: "최고관리자" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 50_000_000,
      requesterId: "requester-1",
    });

    expect(result?.userId).toBe("owner-1");
    expect(result?.source).toBe("org_owner");
    // OWNER role 만 첫 query
    expect(db.organizationMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org1",
          role: "OWNER",
          userId: { not: "requester-1" },
        }),
      }),
    );
  });

  it("고액 + OWNER 없음 → org ADMIN fallback → source org_admin", async () => {
    (db.organizationMember.findFirst as any)
      .mockResolvedValueOnce(null) // OWNER 없음
      .mockResolvedValueOnce({
        userId: "org-admin-1",
        user: { email: "orgadmin@example.com", name: "조직 관리자" },
      });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 50_000_000,
      requesterId: "requester-1",
    });

    expect(result?.userId).toBe("org-admin-1");
    expect(result?.source).toBe("org_admin");
  });

  it("고액 + OWNER + org ADMIN 모두 없음 → workspace ADMIN fallback", async () => {
    (db.organizationMember.findFirst as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (db.workspaceMember.findFirst as any).mockResolvedValueOnce({
      userId: "ws-admin-1",
      user: { email: "wsadmin@example.com", name: "워크스페이스 관리자" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 50_000_000,
      requesterId: "requester-1",
    });

    expect(result?.userId).toBe("ws-admin-1");
    expect(result?.source).toBe("workspace_admin");
  });

  it("모든 fallback 실패 시 null 반환 (route 가 400 처리)", async () => {
    (db.workspaceMember.findFirst as any).mockResolvedValue(null);
    (db.organizationMember.findFirst as any).mockResolvedValue(null);

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 1_000_000,
      requesterId: "requester-1",
    });

    expect(result).toBeNull();
  });

  it("totalAmount === threshold (정확히 1,000만원) → 고액 분기 (>=)", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "owner-1",
      user: { email: "owner@example.com", name: "최고관리자" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW, // 정확히 임계치
      requesterId: "requester-1",
    });

    expect(result?.source).toBe("org_owner");
  });

  it("totalAmount === 0 / null → 저액 분기 (workspace ADMIN routing)", async () => {
    (db.workspaceMember.findFirst as any).mockResolvedValueOnce({
      userId: "admin-1",
      user: { email: "admin1@example.com", name: "관리자1" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 0,
      requesterId: "requester-1",
    });

    expect(result?.source).toBe("workspace_admin");
    // organizationMember 는 호출 0 (저액 분기)
    expect(db.organizationMember.findFirst).not.toHaveBeenCalled();
  });

  it("requesterId 가 항상 userId 필터에 포함 (self-approval 차단)", async () => {
    (db.workspaceMember.findFirst as any).mockResolvedValueOnce(null);

    await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 1_000_000,
      requesterId: "requester-X",
    });

    // 첫 호출 (workspace ADMIN, 본인 외) 의 where 에 userId not requester
    expect(db.workspaceMember.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { not: "requester-X" },
        }),
      }),
    );
  });
});
