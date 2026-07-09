import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §search-logged-in-redirect (호영님 2026-07-09) — /search 로그인 dead-end 해소.
 *
 * /search 는 비로그인 마케팅 랜딩(앱 셸/헤더/nav 없는 단독 페이지). 로그인 사용자가 공개
 * 페이지·404·도움말 링크를 통해 여기 오면 탈출구 없는 dead-end. → 로그인 사용자는 인앱
 * 워크벤치(/app/search, MainHeader 셸)로 리다이렉트. q 보존. 공개 랜딩은 비로그인 전용 유지.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE = readFileSync(join(REPO_ROOT, "src/app/search/page.tsx"), "utf8");

describe("§search-logged-in-redirect — 로그인 사용자 리다이렉트", () => {
  it("authenticated 시 /app/search 로 replace(q 파라미터 보존)", () => {
    expect(PAGE).toMatch(/status !== "authenticated"/);
    expect(PAGE).toMatch(/router\.replace\(\s*q \? `\/app\/search\?q=\$\{encodeURIComponent\(q\)\}` : "\/app\/search"/);
  });

  it("리다이렉트 중 마케팅 랜딩 flash 방지 가드", () => {
    expect(PAGE).toMatch(/if \(status === "authenticated"\)/);
    expect(PAGE).toMatch(/이동 중/);
  });
});

describe("§search-logged-in-redirect — 회귀 0(비로그인 마케팅 랜딩 보존)", () => {
  it("3단계 안내 + 가입 CTA 보존(비로그인 conversion 무손상)", () => {
    expect(PAGE).toMatch(/landing-search-flow-steps/);
    expect(PAGE).toMatch(/landing-search-primary-cta/);
  });
});
