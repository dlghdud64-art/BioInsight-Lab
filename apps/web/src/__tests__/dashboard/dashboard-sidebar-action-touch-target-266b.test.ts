/**
 * §11.266b #dashboard-sidebar-action-touch-target — dashboard sidebar
 *   recommended action button 44x44 touch target
 *   (§11.266 P1 cluster 2/5, §11.264h family cross-cutting concern 확장)
 *
 * §11.266 Phase 0 audit P1 두 번째 cluster — dashboard "다음 작업"
 * (recommendedActions) 안 button 들이 `p-2 rounded-lg` (padding 8px) +
 * text-xs content 로 세로 ~40px → 44x44 미달.
 * Apple HIG / Material / WCAG 2.1 SC 2.5.5 Target Size 표준 미달.
 *
 * Fix (minimum diff, Tailwind class addition):
 *   기존: w-full flex items-center gap-2.5 p-2 rounded-lg ...
 *   신규: w-full flex items-center gap-2.5 min-h-[44px] p-2 rounded-lg ...
 *
 * §dashboard-dedup 진화(호영님 2026-06-28) — "즉시 처리"(urgentItems) 모바일 블록은
 *   ActionInbox("오늘 처리해야 할 일", 전 뷰포트 렌더)의 중복이라 제거됨. urgentItems
 *   button/severity/guard 단언은 retire(대상 소멸). 44x44 터치 표준의 본 의도는
 *   recommendedActions("다음 작업") button 이 동일 패턴으로 계속 강제 → 보호 공백 0.
 *
 * canonical truth lock (recommendedActions):
 *   - handleNavigateOrOverlay onClick 보존 (navigation handler)
 *   - ChevronRight icon 보존
 *   - recommendedActions.map 보존
 *   - hover:bg-slate-50 transition-colors 보존
 *   - "다음 작업" label 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.266b #1 — dashboard recommended 44x44", () => {
  it("§11.266b trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.266b/);
  });

  it("recommendedActions button className 에 min-h-[44px] 추가", () => {
    // recommendedActions.map 안 button — w-full flex items-center gap-2.5 min-h-[44px] p-2
    expect(page).toMatch(
      /recommendedActions\.map[\s\S]{0,500}w-full flex items-center gap-2\.5 min-h-\[44px\] p-2/,
    );
  });
});

describe("§11.266b #2 — invariant 보존 (canonical truth, recommendedActions)", () => {
  it("recommendedActions handleNavigateOrOverlay onClick 보존", () => {
    expect(page).toMatch(
      /recommendedActions\.map[\s\S]{0,500}handleNavigateOrOverlay\(action\.href/,
    );
  });

  it("recommendedActions ChevronRight icon 보존", () => {
    expect(page).toMatch(
      /recommendedActions\.map[\s\S]{0,1000}<ChevronRight/,
    );
  });

  it("hover:bg-slate-50 transition-colors 보존", () => {
    expect(page).toMatch(/hover:bg-slate-50 transition-colors/);
  });

  it("'다음 작업' label 보존", () => {
    expect(page).toMatch(/다음 작업/);
  });
});

describe("§11.266b — retire 회귀 가드 (urgentItems 모바일 블록 소멸)", () => {
  it("urgentItems.map 렌더 블록 부재 (ActionInbox 중복 제거 §dashboard-dedup)", () => {
    expect(page).not.toMatch(/urgentItems\.map/);
  });
});
