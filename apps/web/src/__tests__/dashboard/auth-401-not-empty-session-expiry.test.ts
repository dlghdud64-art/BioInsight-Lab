/**
 * §session-expiry-global #auth-401-not-empty — 호영님 P0 (라이브 진단).
 *
 * 증상: 로그인 만료(401)인데 UI 가 "빈 데이터 상태"로 폴백(KPI 0·무한 스켈레톤) = fake-success.
 * 근본: 대시보드 GET 이 raw fetch 라 api-client 전역 401 interceptor 를 우회 →
 *   401 → throw → react-query 소진 → dashboardStats undefined → stats zeros 폴백(empty 오인).
 * Fix(전역, 화면별 X):
 *   1. csrfFetch 가 GET 포함 모든 method 401 시 redirectToSignInOn401(만료 안내 + /auth/signin).
 *      401-only(403=권한거부 제외, redirect-loop 가드). 이미 signin 이면 skip.
 *   2. 대시보드 GET(/api/dashboard/stats, /api/dashboard/summary)을 csrfFetch 경유로 교체.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const API = readFileSync(resolve(__dirname, "../../lib/api-client.ts"), "utf8");
const PAGE = readFileSync(resolve(__dirname, "../../app/dashboard/page.tsx"), "utf8");
const HOOK = readFileSync(resolve(__dirname, "../../hooks/use-dashboard-section.ts"), "utf8");

describe("§session-expiry-global — 401 전역 재로그인(가짜 empty 차단)", () => {
  it("redirectToSignInOn401 헬퍼: 401-only + 만료 안내 + signin redirect", () => {
    expect(API).toContain("function redirectToSignInOn401");
    expect(API).toMatch(/response\.status !== 401/); // 401 외(403 등)는 무시 — loop 가드
    expect(API).toContain("/auth/signin?callbackUrl=");
    expect(API).toContain("세션이 만료되었습니다");
  });

  it("GET safe-method 경로도 401 처리 적용(우회 차단)", () => {
    expect(API).toMatch(/STATE_CHANGING_METHODS\.has\(method\)[\s\S]{0,180}redirectToSignInOn401/);
  });

  it("대시보드 GET 은 csrfFetch 경유 (raw fetch 401 우회 차단)", () => {
    expect(PAGE).toContain('csrfFetch("/api/dashboard/stats"');
    expect(HOOK).toContain("csrfFetch(url");
    expect(PAGE).not.toMatch(/await fetch\("\/api\/dashboard\/stats"/);
  });
});
