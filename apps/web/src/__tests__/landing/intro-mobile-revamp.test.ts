/**
 * §intro-mobile-revamp — /intro 서비스 소개 모바일 개선 (호영님 승인 2026-07-28)
 *
 * 근본 증상 → 수정 (핸드오프 "서비스소개 모바일 핸드오프.md" 실측 기반):
 *   ① IntroNavbar 가 fixed top-0 z-50 전폭으로 MainHeader(z-40)를 덮어
 *      스크롤 시 로고·로그인 소실 → top-14 z-30 서브바로 강등.
 *   ② 모바일 헤더에 로그인 진입점 부재(햄버거뿐) → 아웃라인 버튼 상시 노출,
 *      시트 회색 로그인 행 → 하단 2버튼(아웃라인+파란 CTA) 승격.
 *   ③ connection pct 막대(하드코딩 장식값) → 스텝 리스트 1카드.
 *   ④ roles 모바일 세로 3카드 → 탭 3개 + 카드 1장 + 페이지 도트.
 *   ⑤ 플로팅 바 문의 저대비(text-slate-300) → 라이트 바 text-slate-700 +
 *      1.5px #CBD5E1, 스크롤 다운 숨김 + #cta 가시 시 자동 숨김.
 *   ⑥ CTA 전 지점 "무료로 시작하기" → /search (§landing-cta-search canon).
 *   ⑦ 차트 막대 앞 6개 #DBEAFE 소실 → #93C5FD.
 *   ⑧ /support 히어로가 fixed 헤더(h-14)에 먹힘 → pt-28/md:pt-32 오프셋.
 *
 * 검증(격리 readFileSync+regex → operator 실 vitest 권위).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INTRO = readFileSync(resolve(__dirname, "../../app/intro/page.tsx"), "utf8");
const HEADER = readFileSync(resolve(__dirname, "../../app/_components/main-header.tsx"), "utf8");
const FLOATING = readFileSync(resolve(__dirname, "../../app/_components/mobile-floating-cta.tsx"), "utf8");
const SUPPORT = readFileSync(resolve(__dirname, "../../app/support/page.tsx"), "utf8");

describe("§intro-mobile-revamp ① — IntroNavbar 서브바 (헤더 비침범)", () => {
  it("top-14 z-30 서브바 — MainHeader(z-40) 아래, 로고·로그인 상시 노출", () => {
    expect(INTRO).toMatch(/fixed top-14 left-0 w-full z-30/);
    expect(INTRO).not.toMatch(/fixed top-0 left-0 w-full z-50/);
  });
});

describe("§intro-mobile-revamp ② — 모바일 로그인 진입점", () => {
  it("헤더 모바일 로그인 아웃라인 버튼 상시(비로그인)", () => {
    expect(HEADER).toMatch(/md:hidden inline-flex items-center h-8 px-3 border border-slate-500\/45 rounded-lg text-slate-200 text-xs font-bold/);
  });
  it("시트 하단 2버튼 — 로그인 아웃라인(h-11) + 무료로 시작하기(/search onClick close 유지)", () => {
    expect(HEADER).toMatch(/flex-1 h-11 inline-flex items-center justify-center border border-slate-500\/45 rounded-xl text-sm font-bold text-slate-200/);
    expect(HEADER).toContain('<Link href="/search" onClick={close}>');
  });
  it("시트 구 회색 로그인 행 제거", () => {
    expect(HEADER).not.toMatch(/paddingTop: 11, paddingBottom: 11, color: "#94A3B8" \}\}\s*[\s\S]{0,200}<span className="text-sm font-medium">로그인<\/span>/);
  });
});

describe("§intro-mobile-revamp ③④ — connection 스텝 리스트 + roles 탭카드", () => {
  it("pct 막대 전면 삭제 — 스텝 리스트 행 데이터로 대체", () => {
    expect(INTRO).not.toMatch(/pct: \d+/);
    expect(INTRO).toMatch(/desc: "결과에서 후보를 바로 저장"/);
    expect(INTRO).toMatch(/입고 반영 → Lot 기록/); // §intro-honesty-a11y ③ 보존
  });
  it("RoleTabsMobile — 탭 3개 + 스와이프 + 페이지 도트", () => {
    expect(INTRO).toMatch(/function RoleTabsMobile\(\)/);
    expect(INTRO).toMatch(/role="tablist"/);
    expect(INTRO).toMatch(/onTouchStart=\{onTouchStart\} onTouchEnd=\{onTouchEnd\}/);
    expect(INTRO).toMatch(/BEFORE · 이전/);
    expect(INTRO).toMatch(/AFTER · LabAxis/);
  });
  it("persona role 라벨 보존(§intro-persona-broadening)", () => {
    expect(INTRO).toMatch(/role: "연구·QC 담당"/);
    expect(INTRO).toMatch(/role: "구매 담당"/);
    expect(INTRO).toMatch(/role: "운영 관리자"/);
  });
});

describe("§intro-mobile-revamp ⑤ — 플로팅 바", () => {
  it("문의 버튼 대비 — text-slate-700 + 1.5px #CBD5E1 (구 text-slate-300 폐기)", () => {
    expect(FLOATING).toMatch(/border-\[1\.5px\] border-\[#CBD5E1\][^"]*text-slate-700/);
    expect(FLOATING).not.toMatch(/text-slate-300/);
  });
  it("radius 11px 통일(rounded-md/rounded-xl 혼재 제거)", () => {
    expect(FLOATING).toMatch(/rounded-\[11px\]/);
    expect(FLOATING).not.toMatch(/h-10 rounded-md|h-10 rounded-xl/);
  });
  it("스크롤 방향 숨김 + #cta 가시 시 자동 숨김", () => {
    expect(FLOATING).toMatch(/setHiddenByScroll\(dy > 0 && y > 120\)/);
    expect(FLOATING).toMatch(/document\.getElementById\("cta"\)/);
    expect(FLOATING).toMatch(/IntersectionObserver/);
    expect(FLOATING).toMatch(/translateY\(100%\)/);
  });
  it("CTA — 무료로 시작하기 → /search (구 signin?callbackUrl 폐기)", () => {
    expect(FLOATING).toMatch(/<Link href="\/search"[\s\S]{0,300}무료로 시작하기/);
    expect(FLOATING).not.toMatch(/callbackUrl/);
  });
});

describe("§intro-mobile-revamp ⑥⑦ — CTA 통일 + 차트 가시성", () => {
  it("/intro 클로징 주 버튼 = 무료로 시작하기(/search), 보조 = 요금 & 플랜 보기(/pricing)", () => {
    expect(INTRO).toMatch(/<Link href="\/search">[\s\S]{0,400}무료로 시작하기/);
    expect(INTRO).toMatch(/<Link href="\/pricing">[\s\S]{0,400}요금 &amp; 플랜 보기/);
  });
  it("차트 막대 — 소실색 #DBEAFE(blueSoft) → #93C5FD", () => {
    expect(INTRO).toMatch(/i >= 6 \? L\.blue : "#93C5FD"/);
    expect(INTRO).not.toMatch(/i >= 6 \? L\.blue : L\.blueSoft/);
  });
  it("영문 섹션 라벨 모바일 숨김(hidden md:inline)", () => {
    expect(INTRO).toMatch(/hidden md:inline text-sm font-bold tracking-wide/);
  });
});

describe("§intro-mobile-revamp ⑧ — /support 히어로 헤더 오프셋", () => {
  it("pt-28/md:pt-32 오프셋(구 py-14 md:py-20 단독 폐기)", () => {
    expect(SUPPORT).toMatch(/pt-28 pb-14 md:pt-32 md:pb-20/);
    expect(SUPPORT).not.toMatch(/px-8 py-14 md:py-20 text-center/);
  });
});
