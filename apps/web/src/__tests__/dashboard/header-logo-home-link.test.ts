/**
 * #mobile-header-logo-home-link — 호영님 모바일 헤더 로고 탭 → 홈 이동 버그 fix.
 *
 * 현상: labaxis.co.kr/dashboard 모바일 헤더의 "LabAxis" 로고 탭 시 이동 안 됨.
 *
 * Phase 0 audit 식별 root cause:
 *   - 모바일 Header.tsx — Link href="/dashboard" 존재, but 터치 영역 ~28px
 *     (44x44 미달, no padding/min-h). 사용자가 정확한 텍스트 baseline 만
 *     클릭 가능 → "탭이 인식 안 되는 것" 처럼 느낌.
 *   - 데스크톱 dashboard-sidebar.tsx — Link href="/" → marketing landing 으로
 *     빠짐 (호영님 spec "양쪽 동일" 정합 위반).
 *
 * Strategy (minimum diff, 2 swap):
 *   - Header.tsx (line 248) — Link className 에 `inline-flex items-center
 *     min-h-[44px] min-w-[44px] px-3 -mx-3 rounded-md hover:bg-slate-100
 *     active:bg-slate-200 transition-colors` 추가 + aria-label.
 *     href "/dashboard" 보존.
 *   - dashboard-sidebar.tsx (line 236-237) — href "/" → "/dashboard" swap +
 *     aria-label.
 *
 * canonical truth lock:
 *   - Link 시그니처 보존 (next/link).
 *   - lg:hidden 분기 (모바일 전용 헤더 로고) 보존.
 *   - h-16 hidden lg:flex (데스크톱 사이드바 로고 헤더) 보존.
 *   - 햄버거 / 검색 / 알림 아이콘 (모바일 우측) 영향 0 — 좌측 로고만 변경.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const HEADER_PATH = resolve(
  __dirname,
  "../../components/dashboard/Header.tsx",
);
const SIDEBAR_PATH = resolve(
  __dirname,
  "../../app/_components/dashboard-sidebar.tsx",
);

const header = safeRead(HEADER_PATH);
const sidebar = safeRead(SIDEBAR_PATH);

describe("#mobile-header-logo-home-link #1 — Header.tsx 모바일 로고 터치 영역 44x44px", () => {
  it("Link href=/dashboard 보존 (모바일 헤더 로고)", () => {
    // lg:hidden 분기 안 Link href="/dashboard" 보존.
    expect(header).toMatch(/Link[\s\S]{0,200}href=["']\/dashboard["'][\s\S]{0,300}lg:hidden/);
  });

  it("Link className 안 min-h-\\[44px\\] (터치 영역 최소 44x44)", () => {
    expect(header).toMatch(/lg:hidden[\s\S]{0,500}min-h-\[44px\]/);
  });

  it("Link className 안 inline-flex items-center (수직 정렬)", () => {
    expect(header).toMatch(/lg:hidden[\s\S]{0,500}inline-flex/);
    expect(header).toMatch(/lg:hidden[\s\S]{0,500}items-center/);
  });

  it("Link aria-label 추가 (a11y + 사용자 인지)", () => {
    expect(header).toMatch(/lg:hidden[\s\S]{0,500}aria-label=["'][^"']*LabAxis[^"']*["']/);
  });

  it("hover/active 시각 피드백 (사용자가 tap 인지 가능)", () => {
    // hover:bg- 또는 active:bg- 둘 중 하나 이상 (시각 피드백 강도)
    expect(header).toMatch(/lg:hidden[\s\S]{0,500}(hover:bg-|active:bg-)/);
  });

  it("기존 LabAxis span 보존 (text-xl font-bold)", () => {
    expect(header).toMatch(/lg:hidden[\s\S]{0,500}LabAxis/);
    expect(header).toMatch(/text-xl[\s\S]{0,100}font-bold/);
  });
});

describe("#mobile-header-logo-home-link #2 — sidebar.tsx 데스크톱 로고 dashboard 진입", () => {
  it("Link href=/dashboard 으로 swap (기존 / marketing 진입 fix)", () => {
    // 데스크톱 사이드바 로고 — href="/" → "/dashboard" swap.
    //   "h-16 hidden lg:flex" 블록 안 Link href.
    expect(sidebar).toMatch(/h-16\s+hidden\s+lg:flex[\s\S]{0,800}Link[\s\S]{0,500}href=["']\/dashboard["']/);
  });

  it("Link aria-label 추가 (a11y)", () => {
    expect(sidebar).toMatch(/h-16\s+hidden\s+lg:flex[\s\S]{0,800}aria-label=["'][^"']*LabAxis[^"']*["']/);
  });

  it("기존 LabAxis span 보존 (데스크톱 사이드바 로고)", () => {
    expect(sidebar).toMatch(/h-16\s+hidden\s+lg:flex[\s\S]{0,800}LabAxis/);
  });

  it("기존 lg:flex items-center px-4 border-b 보존 (사이드바 헤더 layout)", () => {
    expect(sidebar).toMatch(/h-16\s+hidden\s+lg:flex\s+items-center\s+px-4\s+border-b/);
  });
});

describe("#mobile-header-logo-home-link #3 — invariant 보존 (cross-stack)", () => {
  it("Header.tsx 우측 영역 (검색 / 알림 / 햄버거) 보존", () => {
    expect(header).toMatch(/CommandPalette/);
    expect(header).toMatch(/aria-label=["']검색["']/);
    expect(header).toMatch(/DropdownMenu/);
  });

  it("Header.tsx sticky top-0 z-50 + h-14 md:h-16 보존", () => {
    expect(header).toMatch(/sticky\s+top-0\s+z-50[\s\S]{0,200}h-14[\s\S]{0,50}md:h-16/);
  });

  it("Header.tsx breadcrumbs 데스크탑 분기 보존 (hidden md:flex)", () => {
    expect(header).toMatch(/hidden\s+md:flex[\s\S]{0,200}breadcrumbs/);
  });

  it("sidebar.tsx 메뉴 영역 (overflow-y-auto) 보존", () => {
    expect(sidebar).toMatch(/overflow-y-auto/);
  });

  it("#mobile-header-logo-home-link trace marker (header 또는 sidebar 안)", () => {
    const combined = header + "\n" + sidebar;
    expect(combined).toMatch(/mobile-header-logo-home-link|로고\s*탭|홈\s*이동/);
  });
});
