/**
 * §11.266a #sourcing-filter-button-touch-target — sourcing 필터 button 44x44
 *   (§11.266 P1 cluster — dashboard/inventory/sourcing 44x44 audit follow-up,
 *    §11.264h family cross-cutting concern 확장)
 *
 * §11.266 audit P1 cluster 의 첫 번째 — sourcing surface (`/app/search`)
 * 의 Operating Status Bar SheetTrigger 필터 button (line ~776) 이
 * `text-xs font-medium px-3 py-1.5` 로 세로 ~28-32px → 44x44 미달.
 * §11.265c 가 모바일 한정으로 inline-flex 강제 (모바일 핵심 필터 entry) —
 * 모바일 사용자 직접 영향. Apple HIG / Material / WCAG 2.1 SC 2.5.5
 * Target Size 표준 미달.
 *
 * Fix (minimum diff, Tailwind class addition):
 *   기존: inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
 *         rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100
 *         border border-slate-200 transition-colors
 *   신규: inline-flex items-center gap-1.5 text-xs font-medium min-h-[44px]
 *         px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-700
 *         hover:bg-slate-100 border border-slate-200 transition-colors
 *   - min-h-[44px] = 세로 44px 보장
 *   - inline-flex items-center 보존 → 44px 안 가운데 정렬
 *   - text-xs / px-3 py-1.5 / rounded-md / border / tone 모두 보존
 *
 * canonical truth lock:
 *   - SheetTrigger asChild 패턴 보존 (Radix Sheet 트리거)
 *   - SlidersHorizontal icon 보존
 *   - "필터" 라벨 보존
 *   - activeFilterCount badge (text-[10px] bg-blue-600) 보존
 *   - §11.265c 모바일 inline-flex 보존 (hidden md:inline-flex 제거 사실)
 *   - hover state (hover:text-slate-700 hover:bg-slate-100) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.266a #1 — sourcing 필터 button 44x44 touch target", () => {
  it("§11.266a trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.266a/);
  });

  it("필터 button className 에 min-h-[44px] 추가 (text-xs 뒤)", () => {
    // SlidersHorizontal icon + 필터 라벨 button 의 className
    expect(page).toMatch(
      /inline-flex items-center gap-1\.5 text-xs font-medium min-h-\[44px\] px-3 py-1\.5 rounded-md/,
    );
  });

  it("text-xs 시각 사이즈 보존 (44px height 안에 가운데 정렬)", () => {
    // text-xs 가 min-h-[44px] 앞에 와야 함 (className 순서 정합)
    expect(page).toMatch(
      /text-xs font-medium min-h-\[44px\]/,
    );
  });
});

describe("§11.266a #2 — invariant 보존 (canonical truth)", () => {
  it("SheetTrigger asChild + button + SlidersHorizontal icon 보존", () => {
    expect(page).toMatch(/<SheetTrigger asChild>[\s\S]{0,400}<SlidersHorizontal/);
  });

  it("\"필터\" 라벨 보존", () => {
    expect(page).toMatch(/<SlidersHorizontal[\s\S]{0,200}필터/);
  });

  it("activeFilterCount badge (bg-blue-600 + text-[10px]) 보존", () => {
    expect(page).toMatch(
      /activeFilterCount > 0[\s\S]{0,300}bg-blue-600[\s\S]{0,100}text-\[10px\]/,
    );
  });

  it("text-slate-500 hover:text-slate-700 hover:bg-slate-100 톤 보존", () => {
    expect(page).toMatch(
      /text-slate-500 hover:text-slate-700 hover:bg-slate-100/,
    );
  });

  it("border border-slate-200 + transition-colors 보존", () => {
    expect(page).toMatch(/border border-slate-200 transition-colors/);
  });

  it("§11.265c 모바일 inline-flex (hidden md:inline-flex 미적용) 보존", () => {
    // 필터 button 의 className 시작이 inline-flex (모바일 보임 hidden 0)
    expect(page).toMatch(
      /<SheetTrigger asChild>[\s\S]{0,200}className="inline-flex items-center gap-1\.5 text-xs/,
    );
  });
});
