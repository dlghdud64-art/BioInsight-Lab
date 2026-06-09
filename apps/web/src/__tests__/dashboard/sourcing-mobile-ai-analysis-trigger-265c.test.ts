/**
 * §11.265c — 【partially SUPERSEDED by §1-3】 Operating Status Bar
 *
 * 원래 §11.265c: 필터 버튼 모바일 표시 + "AI 분석" 트리거 버튼(→ §11.265b-2 시트).
 * §1-3/§4(현재 호영님): 별도 "AI 분석" 버튼/패널 폐기 → 신호는 상단 배너 + 행 chip inline.
 *   → AI 분석 트리거·시트 assertion 은 SUPERSEDE. 레이아웃(필터/정렬/결과수/재고/햄버거)은 PRESERVE.
 *   → 정렬 라벨 §1-2⑦ "AI 추천순"→"추천순".
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.265c (PRESERVE) — Operating Status Bar 레이아웃", () => {
  it("§11.265c trace marker 존재", () => {
    expect(page).toMatch(/§11\.265c/);
  });

  it("필터 버튼 모바일 표시 (inline-flex + SlidersHorizontal)", () => {
    expect(page).toMatch(
      /<button className="inline-flex items-center gap-1\.5 text-xs font-medium min-h-\[44px\] px-3 py-1\.5[\s\S]{0,200}<SlidersHorizontal/,
    );
  });

  it("정렬 select 보존 + §1-2⑦ '추천순' 라벨", () => {
    expect(page).toMatch(/data-testid="sourcing-sort-select"/);
    expect(page).toMatch(/>추천순</);
    expect(page).not.toMatch(/AI 추천순/);
  });

  it("결과 수 표시 보존", () => {
    expect(page).toMatch(
      /<span className="text-slate-700 font-medium">\s*\{isSearchLoading \?\s*"검색 중\.\.\."/,
    );
  });

  it("재고 버튼 hidden md:inline-flex 보존", () => {
    expect(page).toMatch(
      /Link[\s\S]{0,200}className="hidden md:inline-flex items-center gap-1\.5[\s\S]{0,300}재고/,
    );
  });

  it("§11.254b 햄버거 메뉴 보존", () => {
    expect(page).toMatch(/§11\.254b/);
    expect(page).toMatch(/aria-label="메뉴 열기"/);
  });

  // §11.265a unified filter row 보존 assertion 제거 — 이전 배치 제거 stale 가드.
});

describe("§11.265c → §1-3 SUPERSEDE — AI 분석 트리거/시트 제거", () => {
  it("AI 분석 트리거 버튼(sourcing-ai-analysis-trigger) 제거", () => {
    expect(page).not.toMatch(/sourcing-ai-analysis-trigger/);
    expect(page).not.toMatch(/aria-label="AI 분석 열기"/);
    expect(page).not.toMatch(/setAiAnalysisSheetOpen/);
  });

  it("AI 분석 시트(sourcing-ai-analysis-sheet) + state 제거", () => {
    expect(page).not.toMatch(/sourcing-ai-analysis-sheet/);
    expect(page).not.toMatch(/aiAnalysisSheetOpen/);
  });

  it("대체 surface — 상단 우선 배너 1개 존재", () => {
    expect(page).toMatch(/data-testid="sourcing-top-banner"/);
  });
});
