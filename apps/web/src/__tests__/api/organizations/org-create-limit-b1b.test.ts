/**
 * apps/web/src/__tests__/api/organizations/org-create-limit-b1b.test.ts
 *
 * §org-create-limit B1b — 조직 생성 한도 재측정 5종 (호영님 지시 2026-08-29).
 *
 * 🛑 이 파일은 prod 에서 못 재는 시나리오의 대체 측정이다.
 *   ⑤ prod 에 A 의 대상 계정이 존재하지 않아 시드를 mock DB 로 옮긴다.
 *   🛑 근거 정정 (2026-08-30 소급 대조). 원 근거 "prod 유료 조직이 0" 은 **tvkl
 *     테스트 DB** 측정이었다(tvkl FREE=4 · 유료 0). 실 prod(xhid)는 유료 1
 *     (BioInsight Research Lab · plan=ORGANIZATION).
 *     결론은 무손상이나 근거가 바뀐다 — 그 유료 조직은 **멤버가 0명**이라
 *     "유료 조직을 소유한 계정" 은 여전히 0 이다. 오측 이력은 남긴다(§2b 사례 5).
 *
 * 🔑 mock 이 where 절을 **실제로 해석한다.** 라우트가 OWNER 필터나 organization
 *   select 를 떨어뜨리면 fixture 가 그대로 통과시키는 게 아니라 시나리오가 깨진다 —
 *   그래야 D·E 가 우연한 통과와 갈린다.
 */

import { mockJsonResponse } from "@/__tests__/helpers/response-mock";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => mockJsonResponse(data, init),
  },
}));

vi.mock("@/auth");

vi.mock("@/lib/security/server-enforcement-middleware", () => ({
  enforceAction: vi.fn(),
}));

vi.mock("@/lib/api/organizations", () => ({
  ORGANIZATION_TYPE_OPTIONS: ["연구소"],
  createOrganization: vi.fn(async () => ({ id: "new-org", name: "새 조직", members: [] })),
}));

vi.mock("@/lib/db", () => ({
  db: { organizationMember: { findMany: vi.fn() } },
}));

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { POST } from "@/app/api/organizations/route";

type Row = { userId: string; role: string; organization: { plan: string } | null };

const mockDb = db as unknown as {
  organizationMember: { findMany: ReturnType<typeof vi.fn> };
};

const ME = "user-me";

/** where 절을 실제로 해석하는 fake — 필터가 빠지면 시나리오가 깨진다. */
function seed(rows: Row[]) {
  mockDb.organizationMember.findMany.mockImplementation(
    async (args: { where?: Record<string, unknown>; select?: Record<string, unknown> } = {}) => {
      const where = args.where ?? {};
      let out = rows.filter((r: Row) => !where.userId || r.userId === where.userId);
      if (where.role) out = out.filter((r: Row) => r.role === where.role);
      // organization 을 안 물어봤으면 plan 을 돌려주지 않는다 (겹 1 검출).
      const wantsOrg = Boolean((args.select as { organization?: unknown } | undefined)?.organization);
      return out.map((r: Row) => (wantsOrg ? { organization: r.organization } : {}));
    }
  );
}

const owned = (plan: string | null): Row => ({
  userId: ME,
  role: "OWNER",
  organization: plan === null ? null : { plan },
});
const invited = (plan: string): Row => ({ userId: ME, role: "MEMBER", organization: { plan } });

function req() {
  return {
    json: async () => ({ name: "새 조직", description: "", organizationType: undefined }),
  } as unknown as Parameters<typeof POST>[0];
}

async function create() {
  const res = await POST(req());
  return { status: res.status, body: (await res.json()) as { error?: string; code?: string } };
}

beforeEach(() => {
  vi.clearAllMocks();
  (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: ME } });
});

describe("§org-create-limit B1b — 재측정 5종", () => {
  it("A — TEAM 조직 1개 소유 → 2번째 생성 201 (현행 결함은 403)", async () => {
    seed([owned("TEAM")]);
    const { status, code } = { ...(await create()), code: undefined };
    expect(status).toBe(201);
  });

  it("B — FREE 조직 1개 소유 → 2번째 생성 403 (회귀 핀)", async () => {
    seed([owned("FREE")]);
    const { status, body } = await create();
    expect(status).toBe(403);
    expect(body.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(body.error).toContain("Free");
    expect(body.error).toContain("1개");
  });

  it("C — plan 미설정(organization 없음) → FREE 취급 403 (방어 경로 보존)", async () => {
    seed([owned(null)]);
    const { status, body } = await create();
    expect(status).toBe(403);
    expect(body.error).toContain("Free");
  });

  it("D — OWNER 아닌 멤버십만 보유 → 첫 조직 생성 201 (분모 오염 핀)", async () => {
    seed([invited("FREE"), invited("TEAM")]);
    const { status } = await create();
    expect(status).toBe(201);
  });

  it("E — 남의 TEAM 조직에 초대된 FREE 소유자 → 2번째 생성 403 (분자 오염 핀)", async () => {
    seed([owned("FREE"), invited("TEAM")]);
    const { status, body } = await create();
    expect(status).toBe(403);
    expect(body.error).toContain("Free");
  });
});

describe("§org-create-limit B1b — 사다리 값 핀 (FREE 1 · TEAM 3 · ORGANIZATION ∞)", () => {
  it("TEAM 3개 소유 → 4번째 403 · 라벨 Basic·3개 (hasPro 가 TEAM 을 삼키던 회귀)", async () => {
    seed([owned("TEAM"), owned("TEAM"), owned("TEAM")]);
    const { status, body } = await create();
    expect(status).toBe(403);
    expect(body.error).toContain("Basic");
    expect(body.error).toContain("3개");
  });

  it("TEAM 2개 소유 → 3번째 201", async () => {
    seed([owned("TEAM"), owned("TEAM")]);
    expect((await create()).status).toBe(201);
  });

  it("ORGANIZATION 5개 소유 → 6번째 201 (∞ = null sentinel)", async () => {
    seed([owned("ORGANIZATION"), owned("ORGANIZATION"), owned("ORGANIZATION"), owned("ORGANIZATION"), owned("ORGANIZATION")]);
    expect((await create()).status).toBe(201);
  });

  it("최고 등급이 한도를 정한다 — FREE 1 + TEAM 1 소유 → 3번째 201", async () => {
    seed([owned("FREE"), owned("TEAM")]);
    expect((await create()).status).toBe(201);
  });
});

describe("§org-create-limit B1b — 배선 회귀 0", () => {
  it("쿼리가 OWNER 로 필터하고 organization.plan 을 실어온다", async () => {
    seed([owned("TEAM")]);
    await create();
    const args = mockDb.organizationMember.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ userId: ME, role: "OWNER" });
    expect(args.select?.organization?.select?.plan).toBe(true);
  });
});
