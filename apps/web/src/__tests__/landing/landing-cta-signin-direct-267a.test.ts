/**
 * §11.267a #landing-cta-signin-direct — [SUPERSEDED by §landing-cta-search]
 *
 * 원래 §11.267a (호영님): "무료로 시작하기" CTA → /auth/signin 직진(검색 우회 차단).
 *
 * ⚠️ 반전됨 — §landing-cta-search (4d85ac13, 호영님 directed 2026-06-28):
 *   무료 CTA → /search 로 의도 반전(탐색→가입, "시작하기 눌렀는데 로그인?" 2-bounce 제거).
 *   캐논 = 무료 CTA /search. 새 진실원천 sentinel = `landing-cta-destination.test.ts`.
 *
 * 본 sentinel 정리(§landing-cta-search reconcile, cowork 2026-06-28):
 *   - /auth/signin 직진 단언(#1 Hero, #3 Header) RETIRE — 반전되어 더 이상 유효 X.
 *   - 생존 invariant 만 유지: 무료 CTA /search 정합(아래) + /search 보조 링크 +
 *     로그인 분기(/app/search·/dashboard·UserMenu) + 헤더 link(/intro·/pricing·로그인).
 *   - landing/ 은 dashboard+regression baseline 밖이라 이 latent RED 가 그동안 미포착됨
 *     (교훈: CTA/landing 변경 시 landing/ 도 sweep — pricing-handoff D12 marketing 갭과 동류).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const HERO_PATH = resolve(__dirname, "../../app/_components/bioinsight-hero-section.tsx");
const HEADER_PATH = resolve(__dirname, "../../app/_components/main-header.tsx");
const hero = readFileSync(HERO_PATH, "utf8");
const header = readFileSync(HEADER_PATH, "utf8");

describe("§landing-cta-search 정합 (§11.267a 반전) — 무료 CTA = /search", () => {
  it("Hero primary CTA logged-out = /search (landing-cta-destination 캐논 정합)", () => {
    // §landing-cta-search — isLoggedIn ? "/app/search" : "/search" (구 /auth/signin 반전)
    expect(hero).toMatch(/href=\{isLoggedIn \? "\/app\/search" : "\/search"\}/);
  });
});

describe("§11.267a 생존 invariant — 보조 링크 + 로그인 분기 보존", () => {
  /* 🛑 승계 (§hero-link-copy · 호영님 2026-09-14 권장안): 옛 판본은 「먼저 검색해보기」 를 **요구**했다.
   *   /search 는 §11.324 A안(395f8fbc)으로 마케팅 랜딩이라 검색 제출 = 로그인 이동이다 ·
   *   검사가 지켜지지 않는 약속을 붙잡고 있던 형태(§sentinel-inversion).
   *   명제: /search 보조 링크는 남는다(데스크톱·모바일 각각) + 가입 전 검색을 약속하는 문구 0. */
  it("/search 보조 링크 보존 · 문구는 실제 동작(3단계 흐름) · 데스크톱·모바일 각각", () => {
    const code = stripComments(hero);
    const re = /href="\/search"[^>]*>\s*검색·비교·견적 흐름 보기 →/g;
    expect(code.match(re)?.length ?? 0).toBe(2);
  });

  it("🛑 가입 전 검색을 약속하는 문구 0 (/search 는 마케팅 랜딩)", () => {
    expect(stripComments(hero)).not.toMatch(/검색해보기/);
  });

  it("Hero logged-in primary CTA (/app/search) 보존", () => {
    expect(hero).toMatch(/\/app\/search/);
  });

  it("Hero logged-in secondary CTA (/dashboard) 보존", () => {
    expect(hero).toMatch(/href=\{isLoggedIn \? "\/dashboard" : "\/support"\}/);
  });

  it("Hero logged-out secondary (도입 문의 → /support) 보존", () => {
    expect(hero).toMatch(/href="\/support"[\s\S]{0,500}도입 문의/);
  });

  it("Header /intro + /pricing + /auth/signin 로그인 link + UserMenu 보존", () => {
    expect(header).toMatch(/href="\/intro"/);
    expect(header).toMatch(/href="\/pricing"/);
    expect(header).toMatch(/href="\/auth\/signin"[\s\S]{0,500}로그인/);
    expect(header).toMatch(/UserMenu/);
  });
});
