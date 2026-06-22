/**
 * §11.371-1 — 인증 게이트(세션 만료 시 진입/액션 차단) sentinel
 *
 * root cause(차단 대상): csrfFetch(스캔·입고·재고 mutation 실경로)가 401 을 그냥
 *   반환 → 세션 만료 시 "보안검증 미완" dead-end. 미들웨어는 네비게이션만,
 *   apiClient 만 401 redirect → csrfFetch 경로가 gap.
 * 해결: csrfFetch 401 → signin 리다이렉트(systemic) + Header 스캔 진입 status 사전 게이트.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const API = "src/lib/api-client.ts";
const HEADER = "src/components/dashboard/Header.tsx";

describe("§11.371-1 — csrfFetch 401 재로그인(systemic)", () => {
  it("csrfFetch 가 401 → /auth/signin 리다이렉트", () => {
    const src = read(API);
    expect(src).toMatch(/§11\.371-1/);
    expect(src).toMatch(/let response = await fetch/); // 403 retry 재할당용 mutable
    expect(src).toMatch(/response\.status === 401/);
    expect(src).toMatch(/auth\/signin\?callbackUrl=/);
    // §session-expiry-global — inline 401 → redirectToSignInOn401 헬퍼 통합. SSR-safe window 가드는
    //   `typeof window !== "undefined"`(positive) → `typeof window === "undefined"` early-return(반전)으로 표현. 의도 불변.
    expect(src).toMatch(/typeof window === "undefined"/);
  });
  it("회귀: 403 CSRF retry 보존 + 403 자동 redirect 미도입(loop 방지)", () => {
    const src = read(API);
    expect(src).toMatch(/response\.status === 403 && csrfToken/);
    // csrfFetch 내 401 만 redirect — 403 을 signin 으로 보내지 않음
    expect(src).not.toMatch(/response\.status === 403[\s\S]{0,80}auth\/signin/);
  });
});

describe("§11.371-1 — Header 스캔 진입 status 사전 게이트", () => {
  it("useSession status 구독 + 미인증 시 signin 유도", () => {
    const src = read(HEADER);
    expect(src).toMatch(/data: session, status/);
    expect(src).toMatch(/status !== "authenticated"/);
    expect(src).toMatch(/router\.push\(`\/auth\/signin\?callbackUrl=/);
  });
  it("회귀: 인증 시 scan_hub open 보존", () => {
    const src = read(HEADER);
    expect(src).toMatch(/openModal\("scan_hub"\)/);
  });
});
