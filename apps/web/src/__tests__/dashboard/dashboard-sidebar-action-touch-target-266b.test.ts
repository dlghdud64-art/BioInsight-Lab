/**
 * §11.266b #dashboard-sidebar-action-touch-target — dashboard sidebar urgent +
 *   recommended action button 44x44 touch target
 *   (§11.266 P1 cluster 2/5, §11.264h family cross-cutting concern 확장)
 *
 * §11.266 Phase 0 audit P1 두 번째 cluster — dashboard sidebar 의
 * "즉시 처리" (urgentItems) + "다음 작업" (recommendedActions) 안 button 들이
 * `p-2 rounded-lg` (padding 8px) + text-xs content 로 세로 ~40px → 44x44 미달.
 * 동일 시각 패턴 (sidebar 안 2 button group) 이라 1 cluster 1 batch swap.
 * Apple HIG / Material / WCAG 2.1 SC 2.5.5 Target Size 표준 미달.
 *
 * Fix (minimum diff, Tailwind class addition):
 *   기존: w-full flex items-center gap-2.5 p-2 rounded-lg ...
 *   신규: w-full flex items-center gap-2.5 min-h-[44px] p-2 rounded-lg ...
 *   - min-h-[44px] = 세로 44px 보장 (p-2 padding 안 content 가운데 정렬)
 *   - p-2 / rounded-lg / hover:bg-slate-50 모두 보존
 *
 * canonical truth lock:
 *   - handleNavigateOrOverlay onClick 보존 (navigation handler)
 *   - severity border-l-2 border-l-red-500/amber-500 (urgentItems 분기) 보존
 *   - ChevronRight icon 보존
 *   - urgentItems.map / recommendedActions.map 보존
 *   - text-xs (label) + text-[10px] (desc) 시각 사이즈 보존
 *   - hover:bg-slate-50 transition-colors 보존
 *   - aria-* / role 속성 보존 (있다면)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.266b #1 — dashboard sidebar urgent + recommended 44x44", () => {
  it("§11.266b trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.266b/);
  });

  it("urgentItems button className 에 min-h-[44px] 추가 (severity border 분기)", () => {
    // urgentItems.map 안 button — w-full flex items-center gap-2.5 min-h-[44px] p-2
    expect(page).toMatch(
      /urgentItems\.map[\s\S]{0,500}w-full flex items-center gap-2\.5 min-h-\[44px\] p-2/,
    );
  });

  it("recommendedActions button className 에 min-h-[44px] 추가", () => {
    // recommendedActions.map 안 button — w-full flex items-center gap-2.5 min-h-[44px] p-2
    expect(page).toMatch(
      /recommendedActions\.map[\s\S]{0,500}w-full flex items-center gap-2\.5 min-h-\[44px\] p-2/,
    );
  });
});

describe("§11.266b #2 — invariant 보존 (canonical truth)", () => {
  it("urgentItems handleNavigateOrOverlay onClick 보존", () => {
    expect(page).toMatch(
      /urgentItems\.map[\s\S]{0,500}handleNavigateOrOverlay\(item\.href/,
    );
  });

  it("recommendedActions handleNavigateOrOverlay onClick 보존", () => {
    expect(page).toMatch(
      /recommendedActions\.map[\s\S]{0,500}handleNavigateOrOverlay\(action\.href/,
    );
  });

  it("urgentItems severity border-l-red-500 / border-l-amber-500 분기 보존", () => {
    expect(page).toMatch(
      /item\.severity === "red"[\s\S]{0,200}border-l-red-500[\s\S]{0,200}border-l-amber-500/,
    );
  });

  it("urgentItems ChevronRight icon 보존", () => {
    expect(page).toMatch(
      /urgentItems\.map[\s\S]{0,1000}<ChevronRight/,
    );
  });

  it("recommendedActions ChevronRight icon 보존", () => {
    expect(page).toMatch(
      /recommendedActions\.map[\s\S]{0,1000}<ChevronRight/,
    );
  });

  it("urgentItems text-xs label + text-[10px] desc 보존", () => {
    expect(page).toMatch(
      /urgentItems\.map[\s\S]{0,800}text-xs font-bold[\s\S]{0,300}text-\[10px\] text-slate-500/,
    );
  });

  it("hover:bg-slate-50 transition-colors 보존 (2 button)", () => {
    // 같은 패턴 — urgentItems + recommendedActions 둘 다 hover:bg-slate-50
    expect(page).toMatch(/hover:bg-slate-50 transition-colors/);
  });

  it("urgentItems 'urgentItems.length > 0' guard 보존", () => {
    expect(page).toMatch(/urgentItems\.length > 0 && \(/);
  });

  it("'즉시 처리' + '다음 작업' label 보존", () => {
    expect(page).toMatch(/즉시 처리/);
    expect(page).toMatch(/다음 작업/);
  });
});
