/**
 * §inventory-reorder-surface-unify P3a — 잔여 5 site rewire (preparePanel → 통합 라우팅)
 *   (PLAN: docs/plans/PLAN_inventory-reorder-surface-unify.md)
 *
 * 진입 4(모바일 리스트·테이블 행·우선 처리 큐·상세 Sheet) → openReorderReview(통합 패널 reorder mode).
 *   🛑 「이슈얼럿」 → 「우선 처리 큐」 재앵커 (2026-09-26 §inventory-dead-tabs-removed):
 *      이슈얼럿 진입 3곳이 전부 `{false && (…)}` 안이었다. 라이브 대체가 PriorityActionQueue 다.
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
  it("테이블 행 onReorder → openReorderReview(inventory)", () => {
    expect(src).toMatch(/openReorderReview\(inventory\)/);
  });
  it("우선 처리 큐 진입 → 폐기 먼저, 아니면 openReorderReview(match)", () => {
    /* 🛑 재앵커 §inventory-dead-tabs-removed (2026-09-26 · 호영님 판정).
     *   옛 단언은 `openReorderReview(inv)` 3곳을 물었는데 전부 `{false && (…)}` 안의
     *   「조치 필요 항목」 블록이었다 — 이슈얼럿 진입은 렌더 0 이었다.
     *   그 자리를 대체한 것이 `PriorityActionQueue` 이고, 진입은 handlePriorityQueueAction 이다.
     *   🔑 그 분기가 CLAUDE.md 「reorder 가 expired lot dispose 보다 먼저 뜨지 않는다」 의
     *      라이브 집행이다 — dispose_lot 을 먼저 가른 뒤에야 재발주로 간다. */
    const i = src.indexOf("const handlePriorityQueueAction = (queueItem: QueueItem) => {");
    expect(i).toBeGreaterThan(0);
    const block = src.slice(i, src.indexOf("\n  };", i));
    expect(block).toMatch(/actionType === "dispose_lot"[\s\S]{0,80}openDisposalDock\(match\)/);
    expect(block).toMatch(/openReorderReview\(match\)/);
    /* 역계약 — 죽은 블록의 진입 형태가 되살아나면 알려준다. */
    expect(src).not.toMatch(/openReorderReview\(inv\)/);
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
