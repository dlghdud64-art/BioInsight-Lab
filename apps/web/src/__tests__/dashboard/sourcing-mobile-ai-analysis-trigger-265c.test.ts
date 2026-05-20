/**
 * §11.265c #sourcing-mobile-ai-analysis-trigger — 1줄 요약 row 필터/AI 분석 트리거 (호영님 spec)
 *
 * 호영님 spec "검색바 바로 아래 1줄":
 *   "8건  [AI 추천순 ▾]  [🔽 필터]  [AI 분석]"
 *
 * Audit 결과:
 *   Operating Status Bar (line 597-700) 이 이미 검색바 직후 위치. 정렬
 *   select + 필터 버튼 (현재 hidden md:inline-flex 데스크탑 한정) + 재고 버튼
 *   이미 존재. §11.265c 작업:
 *   (1) 필터 버튼 모바일도 표시 (hidden md:inline-flex → inline-flex)
 *   (2) "AI 분석" 트리거 버튼 신규 (필터 옆) → setAiAnalysisSheetOpen(true)
 *
 * §11.265b-2 와 atomic land — 본 phase 가 §11.265b-2 의 sheet 진입 path 복원.
 *
 * canonical truth lock:
 *   - 정렬 select (sourcing-sort-select) 보존
 *   - SearchUtilityBar 필터 entry 보존 (별도 정리 §11.265d 백로그)
 *   - 재고 버튼 (hidden md:inline-flex) 보존 (호영님 spec 에 없음)
 *   - 결과 수 / 비교 후보 / 견적 후보 보존
 *   - §11.265b-2 aiAnalysisSheetOpen state 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.265c #1 — 필터 버튼 모바일 표시 + AI 분석 트리거", () => {
  it("§11.265c trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.265c/);
  });

  it("Operating Status Bar 필터 버튼 모바일에도 표시 (inline-flex, hidden md: 제거)", () => {
    // 기존: className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 ..."
    // 신규: className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 ..."
    // 버튼 className 이 SlidersHorizontal icon 보다 먼저 등장 (button 시작 → className → icon)
    // §11.266a supersede — min-h-[44px] 추가 (44x44 touch target).
    expect(page).toMatch(
      /<button className="inline-flex items-center gap-1\.5 text-xs font-medium min-h-\[44px\] px-3 py-1\.5[\s\S]{0,200}<SlidersHorizontal/,
    );
  });

  it("AI 분석 트리거 버튼 신규 — onClick setAiAnalysisSheetOpen(true)", () => {
    expect(page).toMatch(/setAiAnalysisSheetOpen\(true\)/);
    expect(page).toMatch(/data-testid="sourcing-ai-analysis-trigger"/);
  });

  it("AI 분석 트리거 버튼 라벨 'AI 분석' 노출", () => {
    // visible label
    expect(page).toMatch(/sourcing-ai-analysis-trigger[\s\S]{0,500}AI 분석/);
  });

  it("AI 분석 트리거 버튼 aria-label 부여", () => {
    expect(page).toMatch(/aria-label="AI 분석 열기"/);
  });
});

describe("§11.265c #2 — invariant 보존 (canonical truth)", () => {
  it("§11.265b-2 aiAnalysisSheetOpen useState 보존", () => {
    expect(page).toMatch(
      /const\s+\[aiAnalysisSheetOpen,\s+setAiAnalysisSheetOpen\]\s*=\s*useState\(\s*false\s*\)/,
    );
  });

  it("§11.265b-2 AI 분석 Sheet 보존 (data-testid)", () => {
    expect(page).toMatch(/data-testid="sourcing-ai-analysis-sheet"/);
  });

  it("정렬 select (sourcing-sort-select) 보존", () => {
    expect(page).toMatch(/data-testid="sourcing-sort-select"/);
    expect(page).toMatch(/AI 추천순/);
  });

  it("Operating Status Bar 결과 수 표시 보존", () => {
    expect(page).toMatch(
      /<span className="text-slate-700 font-medium">\s*\{isSearchLoading \?\s*"검색 중\.\.\."/,
    );
  });

  it("재고 버튼 hidden md:inline-flex (호영님 spec 미포함, 데스크탑 한정 보존)", () => {
    expect(page).toMatch(
      /Link[\s\S]{0,200}className="hidden md:inline-flex items-center gap-1\.5[\s\S]{0,300}재고/,
    );
  });

  it("§11.265a unified filter row hidden 보존", () => {
    expect(page).toMatch(
      /<div className="hidden\s+items-center\s+gap-1\.5\s+overflow-x-auto\s+px-4\s+py-2/,
    );
  });

  it("§11.265b-1 inline AI 제안 + TRIAGE hidden md:block 보존", () => {
    expect(page).toMatch(
      /!shouldShowSourcingStrip && aiShouldShow[\s\S]{0,400}className="hidden md:block px-4 pt-1\.5"/,
    );
    expect(page).toMatch(
      /data-testid="sourcing-result-triage"[\s\S]{0,300}className="hidden md:block px-3 pt-2"/,
    );
  });

  it("§11.254b 햄버거 메뉴 보존", () => {
    expect(page).toMatch(/§11\.254b/);
    expect(page).toMatch(/aria-label="메뉴 열기"/);
  });
});
