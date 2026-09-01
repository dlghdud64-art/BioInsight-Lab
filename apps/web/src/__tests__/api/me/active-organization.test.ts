/**
 * §invite-flow Phase 1 — `/api/me/active-organization` 계약
 *   (PLAN: docs/plans/PLAN_invite-flow.md Phase 1)
 *
 * 잠그는 것: 활성 조직의 **유일한 쓰기 지점**이 남의 조직을 받아들이지 않고,
 *   실패를 성공처럼 돌려주지 않는다(placeholder success 금지).
 *
 * GET 은 resolver 결과 + `persisted`(저장된 선택인지 fallback 인지)를 함께 준다 —
 *   UI 가 "아직 고른 적 없음" 을 알 수 있어야 없는 선택을 있다고 말하지 않는다.
 */
import { mockJsonResponse } from "@/__tests__/helpers/response-mock";

vi.mock("next/server", () => ({
  NextRequest: class MockNextRequest {
    url: string;
    method: string;
    private _body: unknown;
    constructor(url: string | URL, init?: { method?: string; body?: string }) {
      this.url = typeof url === "string" ? url : url.toString();
      this.method = init?.method ?? "GET";
      this._body = init?.body ? JSON.parse(init.body) : null;
    }
    async json() {
      return this._body;
    }
  },
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => mockJsonResponse(data, init),
  },
}));

vi.mock("@/auth");

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    organizationMember: { findFirst: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/me/active-organization/route";

const patchReq = (body: unknown) =>
  new NextRequest("http://localhost/api/me/active-organization", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  (auth as any).mockResolvedValue({ user: { id: "u1" } });
});

describe("GET — resolver 결과 + persisted 구분", () => {
  it("저장된 선택이 유효하면 그 값 · persisted true", async () => {
    (db.user.findUnique as any).mockResolvedValue({ activeOrganizationId: "org-b" });
    (db.organizationMember.findFirst as any).mockResolvedValue({ organizationId: "org-b" });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ organizationId: "org-b", persisted: true });
  });

  it("저장값 없음 → fallback 값 · persisted false (fallback 을 선택으로 위장하지 않는다)", async () => {
    (db.user.findUnique as any).mockResolvedValue({ activeOrganizationId: null });
    (db.organizationMember.findFirst as any).mockResolvedValue({ organizationId: "org-first" });

    const res = await GET();
    await expect(res.json()).resolves.toEqual({ organizationId: "org-first", persisted: false });
  });

  it("비로그인 401", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("PATCH — 멤버십 검증 후에만 저장", () => {
  it("멤버면 저장 200", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValue({ id: "m1" });
    (db.user.update as any).mockResolvedValue({});

    const res = await PATCH(patchReq({ organizationId: "org-b" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ organizationId: "org-b", persisted: true });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { activeOrganizationId: "org-b" },
    });
  });

  it("🛑 비멤버 조직 403 — 저장 0 (조용히 무시하고 성공 반환 금지)", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValue(null);

    const res = await PATCH(patchReq({ organizationId: "org-intruder" }));
    expect(res.status).toBe(403);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("organizationId 누락 400", async () => {
    const res = await PATCH(patchReq({}));
    expect(res.status).toBe(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("비로그인 401", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await PATCH(patchReq({ organizationId: "org-b" }));
    expect(res.status).toBe(401);
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
