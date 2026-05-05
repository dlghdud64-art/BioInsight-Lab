/**
 * #approver-routing-multi-tier-threshold Phase 1 — RED test
 *
 * selectApproverByAmount 가 3 tier 매트릭스 분기:
 *   - low (< lowThreshold) → workspace_admin → self_admin
 *   - mid (low <= amount < highThreshold) → org_admin → workspace_admin → self_admin
 *   - high (>= highThreshold) → org_owner → org_admin → workspace_admin (no self_admin)
 *
 * 신규 인자: lowThreshold? + highThreshold? (둘 다 optional, default 상수 fallback).
 * 직전 'threshold' alias 는 backward compat 으로 highThreshold 로 매핑.
 *
 * 신규 상수: APPROVAL_ORG_ADMIN_THRESHOLD_KRW = 1_000_000
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    workspaceMember: { findFirst: vi.fn() },
    organizationMember: { findFirst: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import {
  selectApproverByAmount,
  APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW,
  APPROVAL_ORG_ADMIN_THRESHOLD_KRW,
} from "@/lib/billing/approver-routing";

describe("#approver-routing-multi-tier-threshold — APPROVAL_ORG_ADMIN_THRESHOLD_KRW 상수", () => {
  it("export 정의 = 1_000_000 (1,000,000 KRW = 100만원)", () => {
    expect(APPROVAL_ORG_ADMIN_THRESHOLD_KRW).toBe(1_000_000);
  });

  it("APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW (직전 batch) 그대로 = 10_000_000", () => {
    expect(APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW).toBe(10_000_000);
  });
});

describe("#approver-routing-multi-tier-threshold — 3 tier 분기 시나리오", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("low tier (500K, < 1M) → workspace_admin first", async () => {
    (db.workspaceMember.findFirst as any).mockResolvedValueOnce({
      userId: "ws-admin",
      user: { email: "ws@example.com", name: "WS Admin" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 500_000,
      requesterId: "req-1",
    });

    expect(result?.source).toBe("workspace_admin");
    // organizationMember 호출 0 (low tier)
    expect(db.organizationMember.findFirst).not.toHaveBeenCalled();
  });

  it("mid tier (5M, 1M <= amount < 10M) → org_admin first", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "org-admin",
      user: { email: "orgadmin@example.com", name: "Org Admin" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 5_000_000,
      requesterId: "req-1",
    });

    expect(result?.source).toBe("org_admin");
    // OWNER 호출 0 (mid tier, ADMIN first)
    expect(db.organizationMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "ADMIN",
          userId: { not: "req-1" },
        }),
      }),
    );
  });

  it("mid tier + org_admin 없음 → workspace_admin fallback", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce(null);
    (db.workspaceMember.findFirst as any).mockResolvedValueOnce({
      userId: "ws-admin",
      user: { email: "ws@example.com", name: "WS Admin" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 5_000_000,
      requesterId: "req-1",
    });

    expect(result?.source).toBe("workspace_admin");
  });

  it("mid tier + 모두 없음 → self_admin fallback (single-admin org/workspace 정합)", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce(null);
    (db.workspaceMember.findFirst as any)
      .mockResolvedValueOnce(null) // 본인 외 ws_admin 없음
      .mockResolvedValueOnce({
        userId: "self",
        user: { email: "self@example.com", name: "Self" },
      });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 5_000_000,
      requesterId: "self",
    });

    expect(result?.source).toBe("self_admin");
  });

  it("high tier (50M, >= 10M) — 직전 batch logic 그대로 (org_owner first)", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "owner",
      user: { email: "owner@example.com", name: "OWNER" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 50_000_000,
      requesterId: "req-1",
    });

    expect(result?.source).toBe("org_owner");
  });

  it("high tier + 모두 없음 → null (self_admin 차단 — escalation 보호)", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValue(null);
    (db.workspaceMember.findFirst as any).mockResolvedValue(null);

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 50_000_000,
      requesterId: "self",
    });

    expect(result).toBeNull();
  });
});

describe("#approver-routing-multi-tier-threshold — workspace 별 thresholds 인자", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lowThreshold + highThreshold 명시 — workspace 별 정책 반영", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "owner",
      user: { email: "owner@example.com", name: "OWNER" },
    });

    // custom thresholds: low=10M, high=100M → 50M 은 mid tier (org_admin 분기)
    // 단 OWNER mock 만 있고 org_admin mock 없음 — first call 이 ADMIN role 이고 mock 0
    // fallback workspace_admin mock 0
    // 따라서 self_admin fallback
    (db.organizationMember.findFirst as any).mockReset();
    (db.organizationMember.findFirst as any).mockResolvedValueOnce(null); // org_admin not found
    (db.workspaceMember.findFirst as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        userId: "self",
        user: { email: "s@example.com", name: "Self" },
      });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 50_000_000,
      requesterId: "self",
      lowThreshold: 10_000_000,
      highThreshold: 100_000_000,
    });

    // 50M < custom highThreshold (100M) → mid tier → fallback chain (self_admin)
    expect(result?.source).toBe("self_admin");
  });

  it("threshold alias backward compat — 직전 caller (single threshold) 그대로 동작", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "owner",
      user: { email: "o@example.com", name: "Owner" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 10_000_000, // 직전 default threshold 정확히
      requesterId: "req",
      threshold: 10_000_000, // alias — highThreshold 로 매핑
    });

    expect(result?.source).toBe("org_owner");
  });
});
