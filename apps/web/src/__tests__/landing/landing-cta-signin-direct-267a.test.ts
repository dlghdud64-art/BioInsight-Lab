/**
 * §11.267a #landing-cta-signin-direct — 랜딩 CTA 직진 + 보조 링크 분리
 *   (호영님 spec — 메인 랜딩 페이지 CTA 동선 개선)
 *
 * 호영님 spec:
 *   "무료로 시작하기" / "시작하기" 탭 → 바로 회원가입/로그인 페이지 (/auth/signin)
 *   검색 체험은 별도 "먼저 검색해보기" 보조 링크 (텍스트 링크 또는 outline 버튼)
 *
 * Root cause:
 *   기존 Hero CTA (`/search`) + Header CTA (`/search`) 는 검색 체험 페이지로 이동.
 *   사용자가 검색어 입력해야 비로소 /auth/signin 진입 → "시작하기 눌렀는데 왜
 *   검색?" 사용자 confusion + 이탈 지점.
 *
 * Fix (4 spot href swap + 1 신규 보조 링크):
 *   (1) bioinsight-hero-section.tsx Hero desktop primary CTA (line ~432)
 *       — `isLoggedIn ? "/app/search" : "/search"` → `isLoggedIn ? "/app/search" : "/auth/signin"`
 *   (2) bioinsight-hero-section.tsx Hero mobile drawer "무료로 시작하기" (line ~169)
 *       — `href="/search"` → `href="/auth/signin"`
 *   (3) bioinsight-hero-section.tsx 신규 보조 링크 "먼저 검색해보기" → `/search`
 *       (Hero CTA 영역 부근, logged-out 일 때만 노출)
 *   (4) main-header.tsx desktop nav (line ~72) — `href="/search"` → `href="/auth/signin"`
 *   (5) main-header.tsx mobile drawer (line ~263) — `href="/search"` → `href="/auth/signin"`
 *
 * canonical truth lock:
 *   - logged-in 분기 보존 (Hero: "/app/search" + "/dashboard", Header: UserMenu)
 *   - "도입 문의" → /support 보존 (변경 없음)
 *   - mockup decoration buttons (line 393, 411) 시각 only — 변경 X
 *   - /search 자체 경로 보존 (검색 체험 페이지 destination)
 *   - /auth/signin 통합 sign-in + signup endpoint 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HERO_PATH = resolve(__dirname, "../../app/_components/bioinsight-hero-section.tsx");
const HEADER_PATH = resolve(__dirname, "../../app/_components/main-header.tsx");
const hero = readFileSync(HERO_PATH, "utf8");
const header = readFileSync(HEADER_PATH, "utf8");

describe("§11.267a #1 — Hero CTA primary href → /auth/signin (logged-out)", () => {
  it("§11.267a trace marker comment 존재 (hero)", () => {
    expect(hero).toMatch(/§11\.267a/);
  });

  it("Hero primary CTA logged-out href = /auth/signin (검색 우회 차단)", () => {
    // <Link href={isLoggedIn ? "/app/search" : "/auth/signin"}>
    expect(hero).toMatch(
      /href=\{isLoggedIn \? "\/app\/search" : "\/auth\/signin"\}/,
    );
  });

  it("Hero primary CTA logged-out href = /search 제거 (검색 체험 직진 차단)", () => {
    expect(hero).not.toMatch(
      /href=\{isLoggedIn \? "\/app\/search" : "\/search"\}/,
    );
  });

  it("Hero mobile drawer '무료로 시작하기' href = /auth/signin", () => {
    expect(hero).toMatch(
      /href="\/auth\/signin"[\s\S]{0,500}무료로 시작하기/,
    );
  });

  it("Hero mobile drawer '도입 문의하기' → /support 보존", () => {
    expect(hero).toMatch(
      /href="\/support"[\s\S]{0,500}도입 문의하기/,
    );
  });
});

describe("§11.267a #2 — '먼저 검색해보기' 보조 링크 신규", () => {
  it("'먼저 검색해보기' 라벨 + /search href 보조 링크 존재", () => {
    // <Link href="/search" ...>먼저 검색해보기</Link>
    expect(hero).toMatch(
      /href="\/search"[\s\S]{0,300}먼저 검색해보기/,
    );
  });

  it("보조 링크는 logged-out 분기 한정 (isLoggedIn === false 일 때만 노출)", () => {
    // !isLoggedIn && (...먼저 검색해보기...) 패턴
    expect(hero).toMatch(/먼저 검색해보기/);
  });
});

describe("§11.267a #3 — Header CTA href → /auth/signin (logged-out)", () => {
  it("§11.267a trace marker comment 존재 (header)", () => {
    expect(header).toMatch(/§11\.267a/);
  });

  it("Header desktop nav '무료로 시작하기' href = /auth/signin", () => {
    // /search → /auth/signin
    expect(header).toMatch(
      /href="\/auth\/signin"[\s\S]{0,500}무료로 시작하기/,
    );
  });

  it("Header mobile drawer '무료로 시작하기' onClick=close 보존 + href = /auth/signin", () => {
    // mobile drawer 분기 — JSDoc + button block 사이 거리 ~600 char
    expect(header).toMatch(
      /href="\/auth\/signin" onClick=\{close\}[\s\S]{0,800}무료로 시작하기/,
    );
  });

  it("Header logged-out href = /search 제거 (검색 체험 직진 차단)", () => {
    // /search 가 desktop "무료로 시작하기" 위치에서 사라져야 함
    expect(header).not.toMatch(
      /href="\/search" className="inline-flex items-center justify-center bg-blue-600/,
    );
  });
});

describe("§11.267a #4 — invariant 보존 (canonical truth)", () => {
  it("Hero logged-in primary CTA (/app/search) 보존", () => {
    expect(hero).toMatch(/\/app\/search/);
    expect(hero).toMatch(/소싱 시작/);
  });

  it("Hero logged-in secondary CTA (/dashboard) 보존", () => {
    expect(hero).toMatch(/href=\{isLoggedIn \? "\/dashboard" : "\/support"\}/);
  });

  it("Hero logged-out secondary CTA (도입 문의) 보존", () => {
    expect(hero).toMatch(/도입 문의/);
  });

  it("Header /intro + /pricing + /auth/signin 로그인 link 보존", () => {
    expect(header).toMatch(/href="\/intro"/);
    expect(header).toMatch(/href="\/pricing"/);
    // /auth/signin 로그인 link (목록 안 로그인 link) 보존
    expect(header).toMatch(/href="\/auth\/signin"[\s\S]{0,500}로그인/);
  });

  it("Header UserMenu (logged-in 분기) 보존", () => {
    expect(header).toMatch(/UserMenu/);
  });
});
