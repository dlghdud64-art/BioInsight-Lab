/**
 * §11.267c #intro-cta-signin-direct — [SUPERSEDED by §landing-cta-search / §intro-mobile-revamp]
 *
 * 원래 §11.267c: /intro "제품 시작하기" CTA → /auth/signin 직진(검색 우회 차단).
 *
 * ⚠️ 반전됨 — §landing-cta-search (4d85ac13, 호영님 directed 2026-06-28):
 *   무료 CTA → /search 로 의도 반전(탐색→가입, 로그인행 2-bounce 제거).
 *   랜딩(267a)은 당시 reconcile 됐으나 본 267c 는 미정리(stale)로 남아 있었음.
 *   §intro-mobile-revamp (호영님 승인 2026-07-28)에서 /intro 도 canon 정합:
 *   라벨 "제품 시작하기" → "무료로 시작하기", 목적지 /auth/signin → /search.
 *
 * 본 sentinel 정리:
 *   - /auth/signin 직진 단언 + "제품 시작하기" 라벨 단언 RETIRE.
 *   - 생존 invariant 만 유지: 히어로 무료 CTA /search 정합 + 도입 문의(/support) +
 *     요금 & 플랜 보기(/pricing) + 도입 상담(/support) + button className 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INTRO_PATH = resolve(__dirname, "../../app/intro/page.tsx");
const intro = readFileSync(INTRO_PATH, "utf8");

describe("§landing-cta-search 정합 (§11.267c 반전) — /intro 무료 CTA = /search", () => {
  it("히어로 무료 CTA Link href = /search + 라벨 '무료로 시작하기'", () => {
    expect(intro).toMatch(
      /<Link href="\/search">[\s\S]{0,400}무료로 시작하기/,
    );
  });

  it("히어로 /auth/signin 직진 제거 (로그인행 2-bounce 차단)", () => {
    expect(intro).not.toMatch(
      /<Link href="\/auth\/signin">[\s\S]{0,400}(제품 시작하기|무료로 시작하기)/,
    );
  });

  it("구 '제품 시작하기' 라벨 제거 — 전 지점 '무료로 시작하기' 통일", () => {
    expect(intro).not.toMatch(/제품 시작하기/);
  });
});

describe("§11.267c 생존 invariant — 보조 진입점 보존 (canonical truth)", () => {
  it("'도입 문의' → /support 보존 (히어로)", () => {
    expect(intro).toMatch(/<Link href="\/support">[\s\S]{0,400}도입 문의/);
  });

  it("'요금 & 플랜 보기' → /pricing 보존 (클로징 보조)", () => {
    expect(intro).toMatch(/<Link href="\/pricing">[\s\S]{0,400}요금 &amp; 플랜 보기/);
  });

  it("'도입 상담' → /support 보존 (클로징 텍스트 링크)", () => {
    expect(intro).toMatch(/<Link href="\/support"[\s\S]{0,200}도입 상담/);
  });

  it("button className (px-7 py-3.5 + rounded-xl) 보존", () => {
    expect(intro).toMatch(/px-7 py-3\.5 text-base font-bold rounded-xl/);
  });
});
