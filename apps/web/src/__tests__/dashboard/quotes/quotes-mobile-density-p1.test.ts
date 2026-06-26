/**
 * §quotes-mobile-density P1 — 견적 모바일 퍼스트뷰 밀도(설명문 제거 + 버튼바 슬림)
 *   (PLAN: docs/plans/PLAN_quotes-mobile-density.md · operator §quotes-mobile-density)
 *
 * 문제: 퍼스트뷰 80%가 chrome(설명문·버튼바·퍼널·배너·검색·필터), 견적 리스트 0%.
 * P1: 설명문 모바일 제거(hidden md) + 버튼바 슬림(스캔 표준버튼 모바일 hide → ⋯ 메뉴 흡수).
 *   (퍼널→칩 = P2, 우선추천 inline = P3 후속)
 * ★ 회귀 0: §11.307(스캔 명칭·아이콘·DOM순서·Radix 0) source 보존 — 스캔은 sm+ 노출 유지.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const PAGE = readFileSync(join(REPO_ROOT, "src/app/dashboard/quotes/page.tsx"), "utf8");
const HEADER = readFileSync(join(REPO_ROOT, "src/components/layout/page-header.tsx"), "utf8");

describe("§quotes-mobile-density P1 — 설명문 모바일 제거", () => {
  it("AppPageHeader description = hidden md:block(§11.311 #7, 데스크탑 보존)", () => {
    expect(HEADER).toMatch(/<p className="hidden md:block text-sm text-slate-500 leading-relaxed">\{description\}<\/p>/);
  });
});

describe("§quotes-mobile-density P1 — 버튼바 슬림(스캔 모바일 → ⋯ 메뉴)", () => {
  it("표준 스캔 버튼 모바일 hide(hidden sm:inline-flex) — 새 요청만 primary", () => {
    expect(PAGE).toMatch(/onClick=\{handleScanOpen\}\s*\n\s*className="hidden sm:inline-flex items-center/);
  });
  it("모바일 ⋯ 메뉴에 스캔 항목(handleScanOpen 동일 wiring, no-op 0)", () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => \{ handleScanOpen\(\); setIsMobileMoreOpen\(false\); \}\}/);
    expect(PAGE).toMatch(/<ScanLine className="h-4 w-4 text-emerald-600" \/>\s*\n\s*견적서 스캔/);
  });
});

describe("§quotes-mobile-density P1 — §11.307 회귀 0(source 보존)", () => {
  it("스캔 명칭/단축라벨 source 보존(견적서 스캔 · sm:hidden 스캔)", () => {
    expect(PAGE).toMatch(/견적서 스캔/);
    expect(PAGE).toMatch(/sm:hidden">스캔</);
  });
  it("ScanLine 표준버튼 className 보존(§11.307 (2))", () => {
    expect(PAGE).toMatch(/<ScanLine\s+className="h-3\.5\s+sm:h-4\s+w-3\.5\s+sm:w-4"/);
  });
  it("DOM 순서 보존: 새 견적 < 스캔(handleScanOpen) < 더보기", () => {
    const idxNewQuote = PAGE.indexOf('PermissionGate permission="quotes.create"');
    const idxScan = PAGE.indexOf("onClick={handleScanOpen}");
    const idxMore = PAGE.indexOf('data-testid="quote-header-more-actions-mobile"');
    expect(idxNewQuote).toBeGreaterThan(0);
    expect(idxScan).toBeGreaterThan(idxNewQuote);
    expect(idxMore).toBeGreaterThan(idxScan);
  });
  it("plain dropdown(Radix 0) + a11y 보존", () => {
    expect(PAGE).toMatch(/aria-expanded=\{isMobileMoreOpen\}/);
    expect(PAGE).toMatch(/role="menu"/);
    expect(PAGE).toMatch(/role="menuitem"/);
    expect(PAGE).not.toMatch(/@radix-ui\/react-dropdown-menu/);
  });
});
