/**
 * §pricing-assistant-csrf — AI 즉답 403 차단 root cause (호영님 라이브 진단 2026-06-28)
 *
 * 증상: 요금 페이지 "AI에게 바로 물어보기"가 모든 질문에 캔드 폴백("도입 문의…")만 노출.
 * 근본: /api/pricing-assistant POST 가 CSRF route registry 에 미등록(기본 required) →
 *   공개 요금 페이지의 익명 방문자(CSRF 토큰 쿠키 없음) POST 가 미들웨어에서 403 차단 →
 *   라우트 도달 0 → 프런트 fetch 실패 → 클라이언트 캔드 폴백. (키/래퍼 문제 아님 — 200 폴백도 아닌 403.)
 * Fix: csrf-route-registry EXEMPT_ROUTES 에 /api/pricing-assistant 등록(public_stateless_llm).
 *   공개·무상태·persistence 0·인젝션 가드(slice 400)·항상 200 폴백 → CSRF 면제 적합.
 *
 * 검증(격리 readFileSync+regex → operator 실 vitest 권위).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveCsrfConfig } from "@/lib/security/csrf-route-registry";

const REG = readFileSync(
  resolve(__dirname, "../../lib/security/csrf-route-registry.ts"),
  "utf8",
);

describe("§pricing-assistant-csrf — exempt 등록(403 차단 해소)", () => {
  it("registry EXEMPT_ROUTES 에 /api/pricing-assistant 등록", () => {
    expect(REG).toMatch(/\/api\/pricing-assistant['"][^\n]*reason:\s*['"]public_stateless_llm['"]/);
  });
  it("resolveCsrfConfig('/api/pricing-assistant') → protection 'exempt'", () => {
    expect(resolveCsrfConfig("/api/pricing-assistant").protection).toBe("exempt");
  });
  it("회귀 0 — 기존 exempt(공급사 회신 token) 보존", () => {
    expect(resolveCsrfConfig("/api/vendor-requests/abc/response").protection).toBe("exempt");
    expect(resolveCsrfConfig("/api/receiving/abc/response").protection).toBe("exempt");
  });
});
