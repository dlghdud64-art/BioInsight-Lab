/**
 * #27 Admin Authorization Central Gate — middleware unit tests
 *
 * Contract:
 *   - unauth /api/admin/** → 401 JSON (인증 필요 메시지)
 *   - authenticated non-ADMIN /api/admin/** → 403 JSON (body.error contains "관리자 권한")
 *   - ADMIN /api/admin/** → middleware pass-through (NextResponse.next())
 *   - unauth /dashboard/admin*, /admin* → /auth/signin redirect
 *   - non-ADMIN /dashboard/admin*, /admin* → /dashboard redirect (no 403 page)
 *   - ADMIN /dashboard/admin*, /admin* → middleware pass-through
 *   - role missing / unknown → deny-by-default (403 for API, redirect for page)
 *   - Bearer header without req.auth → 401 (no mobile admin bypass in this scope)
 *
 * Non-goals:
 *   - ADMIN route handler의 실제 200 응답은 middleware 책임이 아님 (e2e에서 확인)
 *   - Bearer + ADMIN 모바일 조합은 현재 범위 외 (미래 계획)
 *   - /api/admin/seed POST 200은 e2e에서도 CSRF 영향으로 강제하지 않음
 */

import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// NextAuth v5 auth() wrapper를 무력화 — default export가 raw handler가 되도록 한다.
vi.mock("@/auth", () => ({
  auth: (handler: any) => handler,
}));

// CSRF rollout을 report_only로 고정 — 단위 테스트에서 CSRF block의 부수효과를 제거.
// (현 테스트는 모두 admin gate에서 조기 종료되거나 GET exempt 경로를 사용하므로 영향 없음)
vi.mock("@/lib/security/csrf-contract", async (orig) => {
  const actual = await orig<typeof import("@/lib/security/csrf-contract")>();
  return {
    ...actual,
    getCsrfRolloutMode: () => "report_only" as const,
  };
});

// middleware는 위 mock들 이후에 import 되어야 한다.
import middleware from "@/middleware";

// ──────────────────────────────────────────
// helpers
// ──────────────────────────────────────────

type AuthUser = { id: string; role?: string } | null;

function makeReq(
  path: string,
  opts: {
    method?: string;
    authUser?: AuthUser;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const { method = "GET", authUser = null, headers = {} } = opts;
  const url = `http://localhost:3000${path}`;
  const req = new NextRequest(url, {
    method,
    headers: new Headers(headers),
  });
  // NextAuth v5 wrapper가 주입하는 req.auth를 직접 심는다.
  (req as unknown as { auth: { user: AuthUser } | null }).auth = authUser
    ? { user: authUser }
    : null;
  return req;
}

async function callMiddleware(req: NextRequest) {
  // default export는 mock 덕분에 raw handler.
  const result = await (middleware as unknown as (
    r: NextRequest,
  ) => Promise<Response | undefined>)(req);
  return result;
}

function isPassthrough(res: Response | undefined): boolean {
  // NextResponse.next()는 x-middleware-next: 1 헤더를 부여한다.
  return res?.headers?.get("x-middleware-next") === "1";
}

// ──────────────────────────────────────────
// /api/admin/** — API contract
// ──────────────────────────────────────────

describe("middleware admin gate — /api/admin/** (#27)", () => {
  it("unauthenticated GET /api/admin/users → 401 JSON with 인증 message", async () => {
    const res = await callMiddleware(makeReq("/api/admin/users"));
    expect(res?.status).toBe(401);
    const body = await res!.json();
    expect(body.error).toMatch(/인증/);
  });

  it("RESEARCHER GET /api/admin/users → 403 JSON with 관리자 권한", async () => {
    const res = await callMiddleware(
      makeReq("/api/admin/users", {
        authUser: { id: "u1", role: "RESEARCHER" },
      }),
    );
    expect(res?.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toContain("관리자 권한");
  });

  it("BUYER GET /api/admin/users → 403", async () => {
    const res = await callMiddleware(
      makeReq("/api/admin/users", {
        authUser: { id: "u2", role: "BUYER" },
      }),
    );
    expect(res?.status).toBe(403);
  });

  it("SUPPLIER GET /api/admin/users → 403", async () => {
    const res = await callMiddleware(
      makeReq("/api/admin/users", {
        authUser: { id: "u3", role: "SUPPLIER" },
      }),
    );
    expect(res?.status).toBe(403);
  });

  it("authenticated with role undefined → 403 (deny-by-default)", async () => {
    const res = await callMiddleware(
      makeReq("/api/admin/users", { authUser: { id: "u4" } }),
    );
    expect(res?.status).toBe(403);
  });

  it("lowercase 'admin' role → 403 (strict equality to 'ADMIN')", async () => {
    const res = await callMiddleware(
      makeReq("/api/admin/users", {
        authUser: { id: "u5", role: "admin" },
      }),
    );
    expect(res?.status).toBe(403);
  });

  it("ADMIN GET /api/admin/users → middleware pass-through (not the route handler)", async () => {
    const res = await callMiddleware(
      makeReq("/api/admin/users", {
        authUser: { id: "a1", role: "ADMIN" },
      }),
    );
    // NextResponse.next() 여부만 확인. 실제 200 응답은 route handler 책임이며
    // e2e 계층에서 검증한다.
    expect(isPassthrough(res)).toBe(true);
  });

  it("TIER3 mock route /api/admin/stats — unauth → 401 (중앙 gate가 mock 뒤의 노출 차단)", async () => {
    const res = await callMiddleware(makeReq("/api/admin/stats"));
    expect(res?.status).toBe(401);
  });

  it("TIER3 mock route /api/admin/stats — RESEARCHER → 403", async () => {
    const res = await callMiddleware(
      makeReq("/api/admin/stats", {
        authUser: { id: "u1", role: "RESEARCHER" },
      }),
    );
    expect(res?.status).toBe(403);
  });

  it("TIER2 PII route /api/admin/quotes/abc — RESEARCHER → 403", async () => {
    const res = await callMiddleware(
      makeReq("/api/admin/quotes/abc", {
        authUser: { id: "u1", role: "RESEARCHER" },
      }),
    );
    expect(res?.status).toBe(403);
  });

  it("TIER2 PII route /api/admin/quotes/abc — ADMIN → pass-through", async () => {
    const res = await callMiddleware(
      makeReq("/api/admin/quotes/abc", {
        authUser: { id: "a1", role: "ADMIN" },
      }),
    );
    expect(isPassthrough(res)).toBe(true);
  });

  it("Bearer header WITHOUT req.auth → 401 (no mobile admin bypass in this scope)", async () => {
    const res = await callMiddleware(
      makeReq("/api/admin/users", {
        headers: { authorization: "Bearer fake-token" },
        authUser: null,
      }),
    );
    expect(res?.status).toBe(401);
  });

  it("POST /api/admin/seed unauth → 401 (admin gate는 CSRF gate보다 앞)", async () => {
    const res = await callMiddleware(
      makeReq("/api/admin/seed", { method: "POST" }),
    );
    expect(res?.status).toBe(401);
  });

  it("POST /api/admin/seed RESEARCHER → 403 (admin gate는 CSRF gate보다 앞)", async () => {
    const res = await callMiddleware(
      makeReq("/api/admin/seed", {
        method: "POST",
        authUser: { id: "u1", role: "RESEARCHER" },
      }),
    );
    expect(res?.status).toBe(403);
  });
});

// ──────────────────────────────────────────
// /dashboard/admin*, /admin* — page contract
// ──────────────────────────────────────────

describe("middleware admin gate — admin page trees (#27)", () => {
  it("unauthenticated /dashboard/admin → /auth/signin redirect", async () => {
    const res = await callMiddleware(makeReq("/dashboard/admin"));
    expect([307, 308]).toContain(res?.status);
    expect(res?.headers.get("location") || "").toMatch(/\/auth\/signin/);
  });

  it("RESEARCHER /dashboard/admin → /dashboard redirect (no 403 page)", async () => {
    const res = await callMiddleware(
      makeReq("/dashboard/admin", {
        authUser: { id: "u1", role: "RESEARCHER" },
      }),
    );
    expect([307, 308]).toContain(res?.status);
    const loc = res?.headers.get("location") || "";
    expect(loc).toMatch(/\/dashboard$/);
  });

  it("ADMIN /dashboard/admin → pass-through", async () => {
    const res = await callMiddleware(
      makeReq("/dashboard/admin", {
        authUser: { id: "a1", role: "ADMIN" },
      }),
    );
    expect(isPassthrough(res)).toBe(true);
  });

  it("unauthenticated /admin (bare) → /auth/signin redirect", async () => {
    const res = await callMiddleware(makeReq("/admin"));
    expect([307, 308]).toContain(res?.status);
    expect(res?.headers.get("location") || "").toMatch(/\/auth\/signin/);
  });

  it("RESEARCHER /admin → /dashboard redirect", async () => {
    const res = await callMiddleware(
      makeReq("/admin", {
        authUser: { id: "u1", role: "RESEARCHER" },
      }),
    );
    expect([307, 308]).toContain(res?.status);
    expect(res?.headers.get("location") || "").toMatch(/\/dashboard$/);
  });

  it("RESEARCHER /admin/users → /dashboard redirect", async () => {
    const res = await callMiddleware(
      makeReq("/admin/users", {
        authUser: { id: "u1", role: "RESEARCHER" },
      }),
    );
    expect([307, 308]).toContain(res?.status);
    expect(res?.headers.get("location") || "").toMatch(/\/dashboard$/);
  });

  it("ADMIN /admin/quotes → pass-through", async () => {
    const res = await callMiddleware(
      makeReq("/admin/quotes", {
        authUser: { id: "a1", role: "ADMIN" },
      }),
    );
    expect(isPassthrough(res)).toBe(true);
  });

  it("ADMIN /admin (bare) → pass-through", async () => {
    const res = await callMiddleware(
      makeReq("/admin", {
        authUser: { id: "a1", role: "ADMIN" },
      }),
    );
    expect(isPassthrough(res)).toBe(true);
  });
});

// ──────────────────────────────────────────
// non-admin surfaces — must not be over-matched
// ──────────────────────────────────────────

describe("middleware admin gate — non-admin surfaces (#27 regression)", () => {
  it("RESEARCHER /dashboard (bare) → NOT redirected by admin gate", async () => {
    const res = await callMiddleware(
      makeReq("/dashboard", {
        authUser: { id: "u1", role: "RESEARCHER" },
      }),
    );
    // admin gate가 과매칭돼서 /dashboard로 redirect하면 loop 위험이 있음.
    // bare /dashboard는 admin gate predicate에 걸리지 않아야 한다.
    expect([401, 403]).not.toContain(res?.status);
    const loc = res?.headers?.get("location") || "";
    expect(loc).not.toMatch(/^https?:\/\/[^/]+\/dashboard$/);
    // 일반적으로는 pass-through
    expect(isPassthrough(res)).toBe(true);
  });

  it("RESEARCHER /administration (prefix trap) → NOT gated as admin", async () => {
    // startsWith('/admin/')는 trailing slash가 있으므로 /administration 과매칭 없음.
    const res = await callMiddleware(
      makeReq("/administration", {
        authUser: { id: "u1", role: "RESEARCHER" },
      }),
    );
    expect(res?.status).not.toBe(403);
  });

  it("unauthenticated /api/products (non-admin API) → pass-through (no 401 from admin gate)", async () => {
    const res = await callMiddleware(makeReq("/api/products"));
    // CSRF block은 GET exempt, admin gate는 /api/admin/* 아님 → pass-through
    expect(res?.status).not.toBe(401);
    expect(res?.status).not.toBe(403);
  });
});
