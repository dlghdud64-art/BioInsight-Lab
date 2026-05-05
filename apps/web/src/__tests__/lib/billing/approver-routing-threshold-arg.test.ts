/**
 * #approver-routing-threshold-admin-ui Phase 1 — RED test
 *
 * selectApproverByAmount 가 threshold 인자 (optional) 추가:
 *   - 호출 시 명시되면 그 threshold 사용 (workspace 별 임계치)
 *   - 명시 0 시 APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW default fallback
 *
 * 직전 §11.209d-approver-routing 의 hardcoded 임계치를 admin UI override
 * 가능 형태로 확장. backward compat — 기존 caller (threshold 미명시) 그대로 동작.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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

describe("#approver-routing-threshold-admin-ui — selectApproverByAmount threshold 인자", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("threshold 명시 (5,000,000) — 5,000,000 이상에서 OWNER 분기 (default 보다 낮은 임계치)", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "owner-1",
      user: { email: "owner@example.com", name: "OWNER" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 5_000_000, // < default 10M, but >= custom 5M
      requesterId: "requester-1",
      threshold: 5_000_000,
    });

    expect(result?.source).toBe("org_owner");
  });

  it("threshold 명시 (50,000,000) — 30M (mid tier, default lowThreshold 1M ~ 50M) → org_admin first", async () => {
    // #approver-routing-multi-tier-threshold update — 본 시나리오 의미 변경.
    // 직전 single-tier 에선 amount < threshold → low tier (workspace_admin).
    // multi-tier 후: amount >= lowThreshold (1M default) && < highThreshold
    // (50M alias) → mid tier → org_admin first.
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "org-admin",
      user: { email: "orgadmin@example.com", name: "Org Admin" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 30_000_000, // > default low 1M, but < custom high 50M → mid tier
      requesterId: "requester-1",
      threshold: 50_000_000,
    });

    expect(result?.source).toBe("org_admin");
  });

  it("threshold 미명시 (undefined) — default APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW 사용 (backward compat)", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "owner-1",
      user: { email: "owner@example.com", name: "OWNER" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW, // 정확히 default
      requesterId: "requester-1",
      // threshold 미명시
    });

    expect(result?.source).toBe("org_owner");
  });

  it("threshold === 0 (최소 임계치) — 모든 amount 가 고액 분기", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValueOnce({
      userId: "owner-1",
      user: { email: "owner@example.com", name: "OWNER" },
    });

    const result = await selectApproverByAmount({
      workspaceId: "ws1",
      organizationId: "org1",
      totalAmount: 1_000, // 매우 낮은 amount
      requesterId: "requester-1",
      threshold: 0,
    });

    expect(result?.source).toBe("org_owner");
  });
});
