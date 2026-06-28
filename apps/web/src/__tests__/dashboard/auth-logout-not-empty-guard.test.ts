/**
 * §auth-logout-guard #auth-logout-not-empty — 호영님 P1 (라이브 진단).
 *
 * 증상: 로그아웃 상태로 대시보드 홈(/dashboard) 진입 시 redirect 없이 0 KPI·
 *   거짓 "처리할 항목 없음"(빈 스켈레톤)으로 렌더 = false-empty.
 * 근본(2중):
 *   1. middleware 가드가 `startsWith('/dashboard/')`(슬래시 포함)라 홈 정확매칭
 *      `/dashboard`(슬래시 없음)를 놓침 → 비로그인 redirect 누락. 하위 라우트
 *      (/dashboard/*)는 정상 보호되어 홈만 증상.
 *   2. dashboard page 에 status === "unauthenticated" 분기 부재 → 모든 게이트를
 *      통과해 rawStats zeros 폴백으로 렌더.
 * Fix:
 *   1. middleware 내부 가드에 exact match 추가(/app·/dashboard·/admin).
 *   2. page 에 unauthenticated 명시 분기(로그인 유도 surface) — rawStats 폴백 전 early return.
 *
 * 검증(격리 readFileSync+regex → operator 실 vitest 권위).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MW = readFileSync(resolve(__dirname, "../../middleware.ts"), "utf8");
const PAGE = readFileSync(resolve(__dirname, "../../app/dashboard/page.tsx"), "utf8");

describe("§auth-logout-guard — middleware bare-route 가드(홈 false-empty 차단)", () => {
  it("bare /dashboard 정확매칭으로 비로그인 redirect 가드", () => {
    expect(MW).toMatch(/pathname === ['"]\/dashboard['"]/);
  });
  it("/app · /admin bare 라우트도 동일 갭 차단", () => {
    expect(MW).toMatch(/pathname === ['"]\/app['"]/);
    expect(MW).toMatch(/pathname === ['"]\/admin['"]/);
  });
  it("기존 하위 라우트 startsWith 보호 보존(회귀 0)", () => {
    expect(MW).toContain("pathname.startsWith('/dashboard/')");
    expect(MW).toContain("pathname.startsWith('/app/')");
    expect(MW).toContain("pathname.startsWith('/admin/')");
  });
  it("미인증 시 /auth/signin?callbackUrl redirect 보존", () => {
    expect(MW).toContain('new URL("/auth/signin", req.url)');
    expect(MW).toMatch(/searchParams\.set\(\s*["']callbackUrl["']/);
  });
});

describe("§auth-logout-guard — page unauthenticated 명시 분기(안전망)", () => {
  it("status === 'unauthenticated' early return 존재", () => {
    expect(PAGE).toMatch(/status === ["']unauthenticated["']/);
    expect(PAGE).toContain("로그인이 필요합니다");
  });
  it("로그인 CTA = /auth/signin?callbackUrl (dead button 0)", () => {
    expect(PAGE).toMatch(/auth\/signin\?callbackUrl/);
  });
  it("unauthenticated 게이트가 rawStats zeros 폴백보다 먼저(false-empty 차단)", () => {
    const authIdx = PAGE.indexOf('status === "unauthenticated"');
    const rawIdx = PAGE.indexOf("const rawStats = dashboardStats || {}");
    expect(authIdx).toBeGreaterThan(0);
    expect(rawIdx).toBeGreaterThan(0);
    expect(authIdx).toBeLessThan(rawIdx);
  });
});

// 회귀 0 — 기존 loading 스켈레톤 / authenticated-error 게이트 / csrfFetch stats 보존.
describe("§auth-logout-guard — 회귀 0", () => {
  it("loading 스켈레톤 분기 보존", () => {
    expect(PAGE).toMatch(/status === ["']loading["']/);
  });
  it("authenticated + statsError 에러 게이트 보존", () => {
    expect(PAGE).toMatch(/status === ["']authenticated["'] && statsError && !dashboardStats/);
  });
  it("대시보드 GET csrfFetch 경유 보존", () => {
    expect(PAGE).toContain('csrfFetch("/api/dashboard/stats"');
  });
});
