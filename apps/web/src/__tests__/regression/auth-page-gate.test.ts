/**
 * §auth-page-gate (2026-09-07) — 앱 화면은 **matcher 와 게이트 양쪽**에 있어야 막힌다.
 *
 * 🔴 prod 실측(Cowork QA · 쿠키 없이 요청):
 *      /admin/safety · /admin/requests · /dashboard  → opaqueredirect (차단 정상)
 *      /settings/{workspace,billing,security,audit} · /billing · /team/settings → **200**
 *    사이드바·조직 데이터가 붙은 앱 화면이 비로그인에게 그대로 렌더됐다.
 *
 * 🛑 이 파일이 잠그는 것은 **짝**이다. `matcher` 는 "미들웨어가 도는가" 만 정하고
 *    실제로 막는 것은 인증 조건이다 — 한쪽만 고치면 아무것도 안 막히면서
 *    고쳤다는 착각만 남는다(§sidebar-spacer·§global-modal-root 와 같은 계열).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MW = readFileSync(
  join(__dirname, "..", "..", "middleware.ts"),
  "utf8",
);

/** `export const config` 의 matcher 배열만 잘라낸다(창을 블록으로 연다). */
function matcherBlock(src: string): string {
  const start = src.indexOf("matcher: [");
  if (start === -1) return "";
  const end = src.indexOf("]", start);
  return end === -1 ? "" : src.slice(start, end + 1);
}

/** 인증 게이트의 조건식만 — `const isLoggedIn` 앞까지. */
function authGateCondition(src: string): string {
  const anchor = src.indexOf("const isLoggedIn = !!req.auth");
  if (anchor === -1) return "";
  const open = src.lastIndexOf("if (", anchor);
  return open === -1 ? "" : src.slice(open, anchor);
}

/** 화면 경로와 두 자리에서의 표기 — 손으로 나열하는 유일한 곳이다. */
const GUARDED = [
  { name: "/app", matcher: '"/app/:path*"', gate: "pathname.startsWith('/app/')" },
  { name: "/dashboard", matcher: '"/dashboard/:path*"', gate: "pathname.startsWith('/dashboard/')" },
  { name: "/admin", matcher: '"/admin/:path*"', gate: "pathname.startsWith('/admin/')" },
  { name: "/settings", matcher: '"/settings/:path*"', gate: "pathname.startsWith('/settings/')" },
  { name: "/billing", matcher: '"/billing"', gate: "pathname === '/billing'" },
  { name: "/team", matcher: '"/team/:path*"', gate: "pathname.startsWith('/team/')" },
];

describe("§auth-page-gate — matcher 와 게이트는 짝이다", () => {
  it("수집이 실제로 동작한다 (공허 GREEN 방지)", () => {
    expect(matcherBlock(MW).startsWith("matcher: [")).toBe(true);
    expect(authGateCondition(MW).startsWith("if (")).toBe(true);
  });

  it("🔑 보호 대상 6축이 **양쪽 모두**에 있다", () => {
    /* 실패 시 어느 축이 어느 자리에서 빠졌는지 즉시 보이게 문자열로 비교한다. */
    const m = matcherBlock(MW);
    const g = authGateCondition(MW);
    for (const e of GUARDED) {
      expect(`${e.name} matcher: ${m.includes(e.matcher)}`).toBe(`${e.name} matcher: true`);
      expect(`${e.name} gate: ${g.includes(e.gate)}`).toBe(`${e.name} gate: true`);
    }
  });

  it("🛑 게이트 안에서 미인증은 **리다이렉트**된다 (렌더 0)", () => {
    const anchor = MW.indexOf("const isLoggedIn = !!req.auth");
    expect(anchor).toBeGreaterThan(-1);
    const body = MW.slice(anchor, anchor + 500);
    expect(body).toMatch(/if \(!isLoggedIn\)/);
    expect(body).toMatch(/NextResponse\.redirect\(signInUrl\)/);
    // 돌아올 자리를 잃지 않는다
    expect(body).toMatch(/callbackUrl/);
  });

  it("`/billing` 은 정확 일치다 — 결제 복귀 랜딩은 공개로 남긴다", () => {
    /* `/billing/success`·`/billing/cancel` 은 Stripe 복귀 착지점이라
     * 공개 헤더를 유지하기로 이미 판정된 자리다(§dashboard-header-swap). */
    const m = matcherBlock(MW);
    expect(m).toContain('"/billing"');
    expect(m).not.toContain('"/billing/:path*"');
  });
});
