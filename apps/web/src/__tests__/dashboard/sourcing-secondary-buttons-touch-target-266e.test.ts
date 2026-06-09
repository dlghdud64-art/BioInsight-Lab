/**
 * §11.266e — 【partially SUPERSEDED by §1-3】 sourcing Operating Status Bar secondary buttons
 *
 * 원래 §11.266e: AI 분석 + 재고 button 44x44 touch target.
 * §1-3/§4(현재 호영님): "AI 분석" 버튼 폐기(별도 AI 패널 금지) → 해당 button assertion SUPERSEDE.
 *   재고 button + 필터 sibling 44px invariant 는 PRESERVE.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.266e → §1-3 SUPERSEDE — AI 분석 button 제거", () => {
  it("AI 분석 트리거/시트 state 제거", () => {
    expect(page).not.toMatch(/sourcing-ai-analysis-trigger/);
    expect(page).not.toMatch(/setAiAnalysisSheetOpen/);
  });
});

describe("§11.266e (PRESERVE) — 재고/필터 button invariant", () => {
  it("재고 button Link href=/dashboard/inventory 보존", () => {
    expect(page).toMatch(
      /<Link href=\{`\/dashboard\/inventory\?q=\$\{encodeURIComponent\(searchQuery\)\}`\}>/,
    );
  });

  it("재고 button Package icon + '재고' 라벨 보존", () => {
    expect(page).toMatch(/<Package[\s\S]{0,100}재고/);
  });

  it("§11.266a 필터 button min-h-[44px] sibling consistency 보존", () => {
    expect(page).toMatch(
      /text-xs font-medium min-h-\[44px\] px-3 py-1\.5 rounded-md text-slate-500/,
    );
  });
});
