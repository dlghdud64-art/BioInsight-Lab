/**
 * §11.265e #sourcing-search-utility-bar-dead-prop — SearchUtilityBar onOpenFilter dead prop 제거
 *
 * Audit 결과: SearchUtilityBar 의 onOpenFilter prop 은 component body 안 사용 0.
 *   Operating Status Bar (§11.265c) 의 필터 버튼이 유일한 모바일 entry.
 *
 * Fix (minimum diff): dead prop 제거.
 *   (1) SearchUtilityBar 서명 (line 2633) 에서 onOpenFilter 제거
 *   (2) caller (line 586) 의 onOpenFilter prop 전달 제거
 *
 * canonical truth lock:
 *   - SearchUtilityBar 의 다른 prop (activeFilterCount / onAuthRequired / isLoggedIn / stageOwner / onBackToSourcing) 보존
 *   - isMobileFilterOpen + Sheet + SearchPanel 보존 (filter access 는 §11.265c trigger)
 *   - §11.265c "AI 분석" 트리거 + 필터 버튼 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.265e #1 — onOpenFilter dead prop 제거", () => {
  it("§11.265e trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.265e/);
  });

  it("SearchUtilityBar 서명에서 onOpenFilter 제거", () => {
    // 기존: function SearchUtilityBar({ activeFilterCount, onOpenFilter, onAuthRequired, ...
    // 신규: function SearchUtilityBar({ activeFilterCount, onAuthRequired, ...
    expect(page).not.toMatch(
      /function SearchUtilityBar\(\{[^}]*onOpenFilter/,
    );
    // signature 에서 onOpenFilter type 정의도 제거
    expect(page).not.toMatch(/onOpenFilter:\s*\(\)\s*=>\s*void/);
  });

  it("caller (page render) 에서 onOpenFilter prop 전달 제거", () => {
    // 기존: <SearchUtilityBar activeFilterCount={...} onOpenFilter={() => setIsMobileFilterOpen(true)} ...
    // 신규: <SearchUtilityBar activeFilterCount={...} onAuthRequired={...} ...
    expect(page).not.toMatch(
      /<SearchUtilityBar[\s\S]{0,200}onOpenFilter=\{/,
    );
  });
});

describe("§11.265e #2 — invariant 보존 (canonical truth)", () => {
  it("SearchUtilityBar 다른 prop 보존 (activeFilterCount / onAuthRequired / isLoggedIn / stageOwner / onBackToSourcing)", () => {
    expect(page).toMatch(/function SearchUtilityBar\(\{[^}]*activeFilterCount/);
    expect(page).toMatch(/function SearchUtilityBar\(\{[^}]*onAuthRequired/);
    expect(page).toMatch(/function SearchUtilityBar\(\{[^}]*isLoggedIn/);
    expect(page).toMatch(/function SearchUtilityBar\(\{[^}]*stageOwner/);
    expect(page).toMatch(/function SearchUtilityBar\(\{[^}]*onBackToSourcing/);
  });

  it("caller 의 다른 prop 전달 보존", () => {
    expect(page).toMatch(/<SearchUtilityBar\s+activeFilterCount=/);
    expect(page).toMatch(/onAuthRequired=\{\(\) => setIsLoginPromptOpen\(true\)\}/);
    expect(page).toMatch(/isLoggedIn=\{!!session\?\.user\}/);
  });

  it("isMobileFilterOpen + Sheet + SearchPanel 보존 (filter access path)", () => {
    expect(page).toMatch(
      /const\s+\[isMobileFilterOpen,\s+setIsMobileFilterOpen\]\s*=\s*useState/,
    );
    expect(page).toMatch(
      /<Sheet open=\{isMobileFilterOpen\} onOpenChange=\{setIsMobileFilterOpen\}>/,
    );
    expect(page).toMatch(/<SearchPanel \/>/);
  });

  it("§11.265c Operating Status Bar 필터 button (모바일 entry) 보존", () => {
    expect(page).toMatch(/<button className="inline-flex items-center gap-1\.5 text-xs font-medium px-3 py-1\.5[\s\S]{0,200}<SlidersHorizontal/);
    // SheetTrigger asChild + 필터 라벨
    expect(page).toMatch(/SheetTrigger asChild/);
    expect(page).toMatch(/필터/);
  });

  it("§11.265c AI 분석 트리거 보존", () => {
    expect(page).toMatch(/data-testid="sourcing-ai-analysis-trigger"/);
    expect(page).toMatch(/setAiAnalysisSheetOpen\(true\)/);
  });

  it("§11.264f Label Scan FAB 보존", () => {
    expect(page).toMatch(/data-testid="sourcing-label-scan-fab"/);
  });

  it("§11.254b 햄버거 메뉴 보존", () => {
    expect(page).toMatch(/§11\.254b/);
    expect(page).toMatch(/aria-label="메뉴 열기"/);
  });
});
