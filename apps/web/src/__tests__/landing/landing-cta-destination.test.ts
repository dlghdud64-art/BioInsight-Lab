/**
 * §landing-cta-reroute #cta-label-destination — 호영님 P1 (라이브 진단).
 *
 * 증상: 신규용 "무료로 시작하기" CTA 가 /auth/signin(로그인 화면)으로 이동 →
 *   로그인 화면의 "무료로 시작하기"(→/search)를 한 번 더 눌러야 가입 도달 = 2-bounce.
 *   라벨("무료로 시작=신규 가입")과 목적지(로그인)가 불일치.
 * 근본: §11.267a 가 "무료로 시작하기 → /auth/signin 직진"으로 의도적 변경.
 *   본 batch 가 이를 되돌려 모든 로그아웃 "무료로 시작하기" → /search(탐색→가입)로 통일.
 *   "로그인"(기존 유저)은 별도 링크로 /auth/signin 유지(상호 분리).
 * 부수: 모바일 signin 브랜드 바 로고 수직정렬(pt-8 pb-4 비대칭 → py-6 중앙).
 *
 * 검증(격리 readFileSync+regex → operator 실 vitest 권위).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HEADER = readFileSync(resolve(__dirname, "../../app/_components/main-header.tsx"), "utf8");
const HERO = readFileSync(resolve(__dirname, "../../app/_components/bioinsight-hero-section.tsx"), "utf8");
const SIGNIN = readFileSync(resolve(__dirname, "../../app/auth/signin/page.tsx"), "utf8");

describe("§landing-cta-reroute — 무료 CTA → /search (로그인행 차단)", () => {
  it("Hero 큰 버튼: logged-out 목적지 /search (구 /auth/signin 폐기)", () => {
    expect(HERO).toContain('href={isLoggedIn ? "/app/search" : "/search"}');
    expect(HERO).not.toContain('href={isLoggedIn ? "/app/search" : "/auth/signin"}');
  });
  it("Header 데스크탑 파란 CTA: /search", () => {
    expect(HEADER).toMatch(/<Link href="\/search" className="inline-flex items-center justify-center bg-blue-600/);
  });
  it("Header 모바일 drawer 무료 CTA: /search (onClick close 유지)", () => {
    expect(HEADER).toContain('<Link href="/search" onClick={close}>');
  });
  it("Hero 모바일 drawer 무료 CTA: /search", () => {
    expect(HERO).toContain('<Link href="/search" onClick={close}>');
  });
});

describe("§landing-cta-reroute — 로그인(기존 유저) 진입점 보존", () => {
  it("Header 로그인 링크 → /auth/signin 유지", () => {
    expect(HEADER).toMatch(/<Link href="\/auth\/signin"[^>]*>\s*\n?\s*로그인/);
  });
  it("Hero 로그인 링크 → /auth/signin 유지(데스크탑+모바일 drawer)", () => {
    expect(HERO).toContain('href="/auth/signin"');
    expect(HERO).toContain(">로그인</Link>");
  });
});

describe("§landing-cta-reroute — 모바일 signin 로고 수직 중앙", () => {
  it("브랜드 바 py-6 대칭(비대칭 pt-8 pb-4 폐기)", () => {
    expect(SIGNIN).toContain('lg:hidden flex justify-center py-6');
    expect(SIGNIN).not.toContain('lg:hidden flex justify-center pt-8 pb-4');
  });
});
