/**
 * §11.266e #sourcing-secondary-buttons-touch-target — sourcing Operating Status
 *   Bar 의 AI 분석 + 재고 secondary button 44x44 touch target
 *   (§11.266 P1 cluster 5/5, §11.266 family final close)
 *
 * §11.266e scope 확장:
 *   - §11.266 Phase 0 audit 초기 식별: 재고 button (line 805, `hidden md:inline-flex`)
 *     데스크탑 전용 P3.
 *   - GREEN 직전 재audit 에서 발견: AI 분석 button (line 803, 모바일 visible)
 *     도 동일 패턴 `text-xs px-3 py-1.5` ~28-32px → 44x44 미달.
 *   - 같은 row 안 sibling button 일관성 확보 (필터 button §11.266a 가 이미 44x44).
 *
 * Fix (minimum diff, 2 className swap):
 *   AI 분석 button (line 803):
 *     기존: inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
 *           rounded-md text-violet-700 hover:bg-violet-50 border ...
 *     신규: inline-flex items-center gap-1.5 text-xs font-medium min-h-[44px]
 *           px-3 py-1.5 rounded-md text-violet-700 hover:bg-violet-50 border ...
 *   재고 button (line 811):
 *     기존: hidden md:inline-flex items-center gap-1.5 text-xs font-medium
 *           px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-700 ...
 *     신규: hidden md:inline-flex items-center gap-1.5 text-xs font-medium
 *           min-h-[44px] px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-700 ...
 *
 * canonical truth lock:
 *   - AI 분석 button setAiAnalysisSheetOpen(true) onClick 보존
 *   - AI 분석 button Sparkles icon + "AI 분석" 라벨 보존
 *   - AI 분석 button violet tone (text-violet-700 hover:bg-violet-50 border-violet-200) 보존
 *   - 재고 button Link href=/dashboard/inventory?q= 보존
 *   - 재고 button Package icon + "재고" 라벨 보존
 *   - 재고 button hidden md:inline-flex (데스크탑 한정) 보존
 *   - 재고 button data-testid (있다면) 보존
 *   - 필터 button (§11.266a) min-h-[44px] 보존 — sibling consistency
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.266e #1 — AI 분석 button 44x44", () => {
  it("§11.266e trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.266e/);
  });

  it("AI 분석 button className 에 min-h-[44px] 추가", () => {
    // setAiAnalysisSheetOpen(true) onClick button 의 className 에 min-h-[44px]
    expect(page).toMatch(
      /setAiAnalysisSheetOpen\(true\)[\s\S]{0,800}className="inline-flex items-center gap-1\.5 text-xs font-medium min-h-\[44px\] px-3 py-1\.5/,
    );
  });
});

describe("§11.266e #2 — 재고 button 44x44 (데스크탑 한정)", () => {
  it("재고 button className 에 min-h-[44px] 추가 + hidden md:inline-flex 보존", () => {
    expect(page).toMatch(
      /hidden md:inline-flex items-center gap-1\.5 text-xs font-medium min-h-\[44px\] px-3 py-1\.5[\s\S]{0,500}<Package/,
    );
  });
});

describe("§11.266e #3 — invariant 보존 (canonical truth)", () => {
  it("AI 분석 button setAiAnalysisSheetOpen(true) onClick 보존", () => {
    expect(page).toMatch(/onClick=\{\(\) => setAiAnalysisSheetOpen\(true\)\}/);
  });

  it("AI 분석 button Sparkles icon + 'AI 분석' 라벨 보존", () => {
    expect(page).toMatch(
      /setAiAnalysisSheetOpen\(true\)[\s\S]{0,800}<Sparkles[\s\S]{0,200}AI 분석/,
    );
  });

  it("AI 분석 button outline tone 보존 (§11.268b supersede: violet → slate outline)", () => {
    // §11.268b 호영님 spec "파란색 강조 제거" → text-violet-700 + hover:bg-violet-50
    // + border-violet-200 → text-slate-500 + hover:text-slate-700 + hover:bg-slate-100
    // + border-slate-200 (필터 button 과 동일 outline).
    expect(page).toMatch(
      /setAiAnalysisSheetOpen\(true\)[\s\S]{0,800}text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200/,
    );
  });

  it("재고 button Link href=/dashboard/inventory 보존", () => {
    expect(page).toMatch(
      /<Link href=\{`\/dashboard\/inventory\?q=\$\{encodeURIComponent\(searchQuery\)\}`\}>/,
    );
  });

  it("재고 button Package icon + '재고' 라벨 보존", () => {
    expect(page).toMatch(
      /<Package[\s\S]{0,100}재고/,
    );
  });

  it("§11.266a 필터 button min-h-[44px] sibling consistency 보존", () => {
    expect(page).toMatch(
      /text-xs font-medium min-h-\[44px\] px-3 py-1\.5 rounded-md text-slate-500/,
    );
  });

  it("§11.265c data-testid=\"sourcing-ai-analysis-trigger\" 보존", () => {
    expect(page).toMatch(/data-testid="sourcing-ai-analysis-trigger"/);
  });
});
