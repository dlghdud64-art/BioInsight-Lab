/**
 * §auth-callback-guard — 로그인 버튼 연타 차단(OAuth state/PKCE 쿠키 덮어쓰기 방어)
 *
 * 증상: 간헐 로그인 실패(화면 error=Configuration). 실제 = /api/auth/callback/google
 *   CallbackRouteError(Auth.js v5가 화면엔 일반 Configuration 코드로 매핑).
 * 원인(B): signin 버튼 연타 → 매 클릭이 state/PKCE 쿠키 재발급·덮어쓰기 →
 *   먼저 떠난 콜백 state ≠ 현재 쿠키 → CallbackRouteError. (A=apex/www 호스트 분리는 별도)
 * 방어: 제출 중 버튼 disable(단일 OAuth 개시). dead button 아님 — 진행중 라벨 노출.
 *
 * 회귀 0: signIn("google", { callbackUrl }) wiring 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(resolve(__dirname, "../../app/auth/signin/page.tsx"), "utf8");

describe("§auth-callback-guard — 로그인 연타 차단", () => {
  it("submitting state 정의", () => {
    expect(PAGE).toMatch(/const \[submitting, setSubmitting\] = useState\(false\)/);
  });
  it("Google 버튼 disabled={submitting}", () => {
    expect(PAGE).toMatch(/disabled=\{submitting\}/);
  });
  it("onClick 연타 가드 + setSubmitting(true) after guard", () => {
    expect(PAGE).toMatch(/if \(submitting\) return;[\s\S]{0,80}setSubmitting\(true\)/);
  });
  it("회귀 0 — signIn('google', { callbackUrl }) wiring 보존", () => {
    expect(PAGE).toMatch(/signIn\("google", \{ callbackUrl \}\)/);
  });
});
