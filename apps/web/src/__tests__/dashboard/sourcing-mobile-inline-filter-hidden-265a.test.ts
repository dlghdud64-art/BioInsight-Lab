/**
 * §11.265a #sourcing-mobile-inline-filter-hidden — 소싱 모바일 인라인 필터 row 숨김 (호영님 spec P1)
 *
 * 호영님 spec ("소싱 모바일 — 검색 본질 회복"):
 *   검색 결과 카드까지 도달하려면 화면 70% 스크롤 필요. 인라인 필터 칩 row
 *   (§11.263b unified mobile filter row) 가 결과까지 도달 거리 누적.
 *
 * 결정:
 *   §11.265a 는 단순 숨김 (방안 A — 호영님 권장). SearchUtilityBar 의 필터
 *   버튼이 이미 isMobileFilterOpen Sheet 와 wiring (line 581, 584-585) →
 *   기능 손실 0. 후속 §11.265b 가 AI 분석 바텀시트, §11.265c 가 1줄 요약 row.
 *
 * Fix (minimum diff):
 *   line 680: `md:hidden flex` → `hidden` (모바일 + 데스크탑 모두 hidden).
 *   data-testid="sourcing-mobile-filter-separator" 같은 inner element 변경 0
 *   (parent 가 hidden 이므로 자동 비표시, JSX 트리 보존).
 *
 * canonical truth lock:
 *   - §11.263b inner content (14+ chip + 그룹 separator) 트리 보존
 *   - SearchUtilityBar onOpenFilter / isMobileFilterOpen Sheet 보존
 *   - §11.263a header spacer 보존
 *   - 데스크탑 (hidden md:flex) 카테고리/가격/제조사 row 별도 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.265a #1 — 모바일 unified filter row hidden", () => {
  it("§11.265a trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.265a/);
  });

  it("§11.263b unified mobile filter row className: hidden (모바일+데스크탑 모두 hidden)", () => {
    // 기존: className="md:hidden flex items-center gap-1.5 overflow-x-auto px-4 py-2 border-b border-slate-100 bg-white"
    // 신규: className="hidden ..." (모바일에서 안 보임 + 데스크탑은 별도 row 사용)
    expect(page).toMatch(
      /<div className="hidden\s+items-center\s+gap-1\.5\s+overflow-x-auto\s+px-4\s+py-2\s+border-b\s+border-slate-100\s+bg-white">/,
    );
    // 기존 "md:hidden flex items-center gap-1.5 overflow-x-auto px-4 py-2 border-b" 패턴 제거
    expect(page).not.toMatch(
      /<div className="md:hidden flex items-center gap-1\.5 overflow-x-auto px-4 py-2/,
    );
  });
});

describe("§11.265a #2 — invariant 보존 (canonical truth)", () => {
  it("SearchUtilityBar 사용 보존 (§11.265e supersede — onOpenFilter dead prop 제거됨)", () => {
    // §11.265e 이후: onOpenFilter prop 제거. SearchUtilityBar 컴포넌트 자체 사용은 보존.
    //   필터 entry path 는 §11.265c Operating Status Bar 필터 button + SheetTrigger asChild.
    expect(page).toMatch(/<SearchUtilityBar/);
    // onOpenFilter prop 전달 없어야 함 (§11.265e dead prop 제거)
    expect(page).not.toMatch(/<SearchUtilityBar[\s\S]{0,200}onOpenFilter=\{/);
  });

  it("isMobileFilterOpen useState 보존 (Sheet 트리거)", () => {
    expect(page).toMatch(
      /const\s+\[isMobileFilterOpen,\s+setIsMobileFilterOpen\]\s*=\s*useState/,
    );
  });

  it("Mobile filter Sheet + SearchPanel 보존", () => {
    expect(page).toMatch(
      /<Sheet open=\{isMobileFilterOpen\} onOpenChange=\{setIsMobileFilterOpen\}>/,
    );
    expect(page).toMatch(/<SearchPanel \/>/);
  });

  it("§11.263b 14+ chip + 그룹 separator 트리 보존 (parent hidden 으로 비표시)", () => {
    // data-testid 부여된 separator 가 여전히 JSX 트리에 존재
    expect(page).toMatch(/data-testid="sourcing-mobile-filter-separator"/);
  });

  it("데스크탑 한정 카테고리 row (hidden md:flex) 보존", () => {
    expect(page).toMatch(
      /hidden md:flex px-4 md:px-6 py-2 border-b border-slate-100 bg-white items-center gap-1\.5 overflow-x-auto/,
    );
  });

  it("§11.254b 햄버거 메뉴 (DropdownMenu) 보존", () => {
    expect(page).toMatch(/§11\.254b/);
    expect(page).toMatch(/aria-label="메뉴 열기"/);
    expect(page).toMatch(/DropdownMenuTrigger asChild/);
  });

  it("AI 라벨 스캔 (Camera) 버튼 보존", () => {
    expect(page).toMatch(/setLabelScanOpen\(true\)/);
    expect(page).toMatch(/AI 라벨 스캔/);
  });
});
