/**
 * §11.267c #intro-cta-signin-direct — /intro 서비스 소개 페이지 "제품 시작하기"
 *   CTA → /auth/signin (§11.267 implicit consistency 확장)
 *
 * 호영님 §11.267 spec:
 *   "무료로 시작하기" / "시작하기" 탭 → /auth/signin 직진 (가입 의사 표현 시
 *   검색 우회 차단). 랜딩 (/) 의 Hero + Header + mobile drawer 4 spot 이미
 *   적용 (§11.267a).
 *
 * §11.267c — /intro 페이지에도 동일 의도의 CTA "제품 시작하기" (line 221) 가
 * /search 로 우회. implicit consistency 적용 → /search → /auth/signin swap.
 *
 * Fix (minimum diff, href 1 swap):
 *   line 221 <Link href="/search"> → <Link href="/auth/signin">
 *
 * canonical truth lock:
 *   - "제품 시작하기" 라벨 보존
 *   - "도입 문의" → /support 보존 (line 226)
 *   - "요금 & 플랜 보기" → /pricing 보존 (line 635)
 *   - "도입 상담" → /support 보존 (line 640)
 *   - 모든 CTA button className (px-7 py-3.5 + rounded-xl + motion) 보존
 *
 * Out-of-scope:
 *   - "먼저 검색해보기" 보조 링크는 /intro 에 추가 X — /intro 자체가 정보
 *     페이지로 검색 체험 트리거 불필요 (호영님 spec 명시 없음).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INTRO_PATH = resolve(__dirname, "../../app/intro/page.tsx");
const intro = readFileSync(INTRO_PATH, "utf8");

describe("§11.267c #1 — /intro \"제품 시작하기\" /auth/signin 직진", () => {
  it("§11.267c trace marker comment 존재", () => {
    expect(intro).toMatch(/§11\.267c/);
  });

  it("\"제품 시작하기\" Link href = /auth/signin", () => {
    // <Link href="/auth/signin"> 직후 button "제품 시작하기"
    expect(intro).toMatch(
      /<Link href="\/auth\/signin">[\s\S]{0,400}제품 시작하기/,
    );
  });

  it("\"제품 시작하기\" Link href = /search 제거 (검색 우회 차단)", () => {
    expect(intro).not.toMatch(
      /<Link href="\/search">[\s\S]{0,400}제품 시작하기/,
    );
  });
});

describe("§11.267c #2 — invariant 보존 (canonical truth)", () => {
  it("\"제품 시작하기\" 라벨 보존", () => {
    expect(intro).toMatch(/제품 시작하기/);
  });

  it("\"도입 문의\" → /support 보존 (line ~226)", () => {
    expect(intro).toMatch(/<Link href="\/support">[\s\S]{0,400}도입 문의/);
  });

  it("\"요금 & 플랜 보기\" → /pricing 보존 (line ~635)", () => {
    expect(intro).toMatch(/<Link href="\/pricing">[\s\S]{0,400}요금 &amp; 플랜 보기/);
  });

  it("\"도입 상담\" → /support 보존 (line ~640)", () => {
    expect(intro).toMatch(/<Link href="\/support">[\s\S]{0,400}도입 상담/);
  });

  it("button className (px-7 py-3.5 + rounded-xl) 보존", () => {
    expect(intro).toMatch(/px-7 py-3\.5 text-base font-bold rounded-xl/);
  });
});
