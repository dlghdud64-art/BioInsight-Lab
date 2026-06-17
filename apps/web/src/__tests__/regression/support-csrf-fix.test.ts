/**
 * §support-csrf-fix(호영님, 2026-06-17) — 공개 도입·문의 폼 CSRF 게이트 통과
 *
 * 증상: /support 제출 시 "보안 검증이 완료되지 않아 작업을 진행할 수 없습니다" 403.
 * 진단(버그헌터 Truth Reconciliation):
 *   - 문구 출처 = CSRF(csrf-contract.ts / server-enforcement-middleware.ts), CAPTCHA·Resend 무관.
 *   - /api/support/inquiry·/api/support/ai-assist 는 CSRF 레지스트리 기본값 required(예외 아님).
 *   - §contact-redesign 리디자인이 raw fetch 사용 → x-labaxis-csrf-token 미부착 → 403.
 * 수정: csrfFetch(쿠키→없으면 /api/security/csrf-token bootstrap, 로그아웃 방문자도 발급)로 교체.
 *   CAPTCHA 위젯 신규 0, Resend 무관.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PAGE = readFileSync(join(ROOT, "app/support/page.tsx"), "utf8");

describe("§support-csrf-fix — CSRF-aware 제출/도우미", () => {
  it("csrfFetch import(@/lib/api-client)", () => {
    expect(PAGE).toMatch(/import\s*\{\s*csrfFetch\s*\}\s*from\s*"@\/lib\/api-client"/);
  });
  it("문의 제출 = csrfFetch(/api/support/inquiry)", () => {
    expect(PAGE).toMatch(/csrfFetch\("\/api\/support\/inquiry"/);
  });
  it("AI 도우미 = csrfFetch(/api/support/ai-assist)", () => {
    expect(PAGE).toMatch(/csrfFetch\("\/api\/support\/ai-assist"/);
  });
  it("회귀 0 — 두 엔드포인트를 raw fetch(토큰 미부착)로 호출 금지", () => {
    // csrfFetch( 는 허용, 단독 raw fetch("/api/support/...) 는 금지(앞에 csrf 접두 없는 경우).
    expect(PAGE).not.toMatch(/[^a-zA-Z]fetch\("\/api\/support\/(inquiry|ai-assist)"/);
  });
  it("CAPTCHA 위젯·Resend 신규 도입 0(진단: CSRF 한정)", () => {
    // 통합 마커(import/위젯/SDK)만 검사 — 진단 설명 주석의 bare 단어("CAPTCHA·Resend 무관")는
    //   false positive 라 제외. CSRF 한정 수정임을 확인하는 의도는 동일.
    expect(PAGE).not.toMatch(/from\s*["'][^"']*(turnstile|recaptcha|hcaptcha|resend)/i); // 라이브러리 import 0
    expect(PAGE).not.toMatch(/<(Turnstile|ReCAPTCHA|HCaptcha)\b/); // 위젯 컴포넌트 0
    expect(PAGE).not.toMatch(/grecaptcha|window\.turnstile/i); // 글로벌 SDK 0
  });
});
