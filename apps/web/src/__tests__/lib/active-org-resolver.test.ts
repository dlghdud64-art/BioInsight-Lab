/**
 * §invite-flow Phase 1 — 활성 조직 resolver 계약
 *   (PLAN: docs/plans/PLAN_invite-flow.md Phase 1 🔴 · §8A Workflow Addendum)
 *
 * canonical: User.activeOrganizationId. resolver 규칙(§8A):
 *   hint(멤버십 검증 통과) → hint
 *   → User.activeOrganizationId(멤버십 검증) → 그 값
 *   → createdAt asc 첫 멤버십 (api/team/route.ts:118 현행 규칙 승계 — 무변경 사용자 행동 변화 0)
 *   → 조직 0 이면 null (호출자가 403·빈 상태 처리)
 *
 * RGR: 이 파일은 Phase 1 🔴 시점에 RED(모듈 부재)로 시작한다. 🟢 구현이 GREEN 으로 만든다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    organizationMember: { findFirst: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { resolveActiveOrganizationId } from "@/lib/organizations/active-org";

/** fixture 축 선언 — memberships 배열 순서 = createdAt asc (정본). active = User.activeOrganizationId. */
function armDb(opts: { memberships: string[]; active?: string | null }) {
  (db.user.findUnique as any).mockImplementation(async () => ({
    activeOrganizationId: opts.active ?? null,
  }));
  (db.organizationMember.findFirst as any).mockImplementation(async (args: any) => {
    const where = args?.where ?? {};
    if (where.organizationId) {
      // 멤버십 검증 조회 (hint · 활성값 공용)
      return opts.memberships.includes(where.organizationId)
        ? { organizationId: where.organizationId }
        : null;
    }
    // fallback 조회 — createdAt asc 첫 멤버십. orderBy 없는 fallback 은 계약 위반이므로 여기서 잡는다.
    expect(args?.orderBy).toEqual({ createdAt: "asc" });
    const first = opts.memberships[0];
    return first ? { organizationId: first } : null;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("§invite-flow P1 — resolveActiveOrganizationId", () => {
  it("활성 있음(멤버십 유효) → 그대로", async () => {
    armDb({ memberships: ["org-a", "org-b"], active: "org-b" });
    await expect(resolveActiveOrganizationId({ userId: "u1" })).resolves.toBe("org-b");
  });

  it("활성 없음 → createdAt asc 첫 조직 (team route 현행 규칙 승계)", async () => {
    armDb({ memberships: ["org-first", "org-later"], active: null });
    await expect(resolveActiveOrganizationId({ userId: "u1" })).resolves.toBe("org-first");
  });

  it("활성이 탈퇴 조직(stale) → fallback 첫 조직", async () => {
    armDb({ memberships: ["org-a"], active: "org-gone" });
    await expect(resolveActiveOrganizationId({ userId: "u1" })).resolves.toBe("org-a");
  });

  it("조직 0 → null (403/빈 상태는 호출자 몫)", async () => {
    armDb({ memberships: [], active: null });
    await expect(resolveActiveOrganizationId({ userId: "u1" })).resolves.toBeNull();
  });

  it("hint 멤버십 통과 → hint 가 활성값보다 우선", async () => {
    armDb({ memberships: ["org-a", "org-b"], active: "org-a" });
    await expect(
      resolveActiveOrganizationId({ userId: "u1", hint: "org-b" }),
    ).resolves.toBe("org-b");
  });

  it("hint 멤버십 실패 → hint 무시하고 활성값/fallback 으로", async () => {
    armDb({ memberships: ["org-a"], active: "org-a" });
    await expect(
      resolveActiveOrganizationId({ userId: "u1", hint: "org-intruder" }),
    ).resolves.toBe("org-a");
  });
});
