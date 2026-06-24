/**
 * §inventory-reorder-surface-unify P3a — 잔여 5 site rewire (preparePanel → 통합 라우팅)
 *   (PLAN: docs/plans/PLAN_inventory-reorder-surface-unify.md)
 *
 * 진입 4(모바일 리스트·테이블 행·이슈얼럿·상세 Sheet) → openReorderReview(통합 패널 reorder mode).
 * 패널 proceed(site 5) → 추천 있으면 ReorderReviewSheet(승격) 오픈, 없으면 reorder mode flip(no-op 0).
 * content 내 aiPanel.preparePanel 직접 호출 0 (AiAssistant 직접 오픈 트리거 retire; 렌더/deep-link 정리는 P4).
 *
 * 설계 정정: PLAN 원안의 패널 onReorderEmphasis/Proceed prop split 대신 content-side guard.
 *   → InventoryContextPanel 무수정(restructure-320·panel-unify·rail-inventory sentinel 보존).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const CONTENT = "src/app/dashboard/inventory/inventory-content.tsx";

describe("§inventory-reorder-surface-unify P3a — preparePanel 직접 호출 retire", () => {
  it("content 내 aiPanel.preparePanel 0건 (AiAssistant 직접 오픈 트리거 제거)", () => {
    const src = read(CONTENT);
    const count = (src.match(/aiPanel\.preparePanel/g) || []).length;
    expect(count).toBe(0);
  });
});

describe("§inventory-reorder-surface-unify P3a — 진입 4 site → openReorderReview", () => {
  const src = read(CONTENT);
  it("모바일 리스트 onReorder → openReorderReview(inventory)", () => {
    expect(src).toMatch(/onSearchChange=\{setSearchQuery\}[\s\S]{0,200}openReorderReview\(inventory\)/);
  });
  it("테이블 행 onReorder + 이슈얼럿 → openReorderReview (inventory/inv)", () => {
    expect(src).toMatch(/openReorderReview\(inventory\)/);
    expect(src).toMatch(/openReorderReview\(inv\)/);
  });
  it("상세 Sheet 재발주 = setIsSheetOpen(false) + openReorderReview(selectedItem)", () => {
    expect(src).toMatch(/setIsSheetOpen\(false\);[\s\S]{0,160}openReorderReview\(selectedItem\)/);
  });
});

describe("§inventory-reorder-surface-unify P3a — 패널 proceed guard (no-op 0)", () => {
  const src = read(CONTENT);
  it("패널 onReorder: canonical qty 있으면 ReorderReviewSheet, 없으면 reorder mode flip", () => {
    expect(src).toMatch(/const qty = reorderRecommendedQtyFor\(match\.id\)/);
    expect(src).toMatch(/qty != null && qty > 0[\s\S]{0,140}openReorderReviewSheet\(match\)/);
    expect(src).toMatch(/setContextPanelMode\("reorder"\)/);
  });
  it("회귀 0 — §11.158 invalidateBriefNarrative cache-bust 보존", () => {
    expect(src).toMatch(/invalidateBriefNarrative\(\{[\s\S]{0,120}module: "inventory"/);
  });
});
