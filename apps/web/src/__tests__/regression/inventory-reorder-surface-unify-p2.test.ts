/**
 * §inventory-reorder-surface-unify P2 — ReorderReviewSheet content 승격 + 모바일 reorder 진입
 *   (PLAN: docs/plans/PLAN_inventory-reorder-surface-unify.md)
 *
 * P2 계약:
 *   - InventoryReorderReviewSheet 래퍼: AiAssistant 비의존, recommendedQty null/0 → data null(가짜 0 금지),
 *     vendors/recentPurchases = useReorderRecommendation(§11.310b).
 *   - content: reorderReviewItem state + openReorderReviewSheet + 래퍼 렌더(recommendedQty=canonical).
 *   - 모바일 브리프시트: mode={contextPanelMode} + primaryCta = canonical 기반(추천 없으면 disabled),
 *     preparePanel(AiAssistant) 미호출 → ReorderReviewSheet 직접 오픈.
 *
 * honesty 핵심: 모바일 reorder 수량 = 데스크탑 reorderQty와 동일 canonical(/reorder-recommendations).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const WRAPPER = "src/components/inventory/inventory-reorder-review-sheet.tsx";
const CONTENT = "src/app/dashboard/inventory/inventory-content.tsx";

describe("§inventory-reorder-surface-unify P2 — ReorderReviewSheet 승격 래퍼", () => {
  const src = read(WRAPPER);
  it("ReorderReviewSheet + useReorderRecommendation 사용(분석 래퍼 비의존)", () => {
    expect(src).toMatch(/from "@\/components\/inventory\/ReorderReviewSheet"/);
    expect(src).toMatch(/useReorderRecommendation/);
  });
  it("recommendedQty null/0 → data null (가짜 수량 0 금지)", () => {
    expect(src).toMatch(/recommendedQty != null && recommendedQty > 0/);
    // 미충족 분기 = null
    expect(src).toMatch(/:\s*null;/);
  });
});

describe("§inventory-reorder-surface-unify P2 — content 승격 + canonical 주입", () => {
  const src = read(CONTENT);
  it("reorderReviewItem state + openReorderReviewSheet helper", () => {
    expect(src).toMatch(/reorderReviewItem/);
    expect(src).toMatch(/openReorderReviewSheet = \(item: ProductInventory\) => setReorderReviewItem\(item\)/);
  });
  it("InventoryReorderReviewSheet 렌더 — recommendedQty=canonical(reorderRecommendedQtyFor)", () => {
    expect(src).toMatch(/<InventoryReorderReviewSheet/);
    expect(src).toMatch(/recommendedQty=\{reorderRecommendedQtyFor\(reorderReviewItem\?\.id\)\}/);
  });
  it("canonical 소스 동일성 — reorderRecommendedQtyFor가 reorderRecommendationsData.recommendations 사용", () => {
    expect(src).toMatch(/reorderRecommendedQtyFor[\s\S]{0,200}reorderRecommendationsData\?\.recommendations/);
  });
});

describe("§inventory-reorder-surface-unify P2 — 모바일 reorder 진입(dead button 0)", () => {
  const src = read(CONTENT);
  it("MobileOperationalBriefSheet mode={contextPanelMode} 전달", () => {
    expect(src).toMatch(/<MobileOperationalBriefSheet[\s\S]{0,120}mode=\{contextPanelMode\}/);
  });
  it("primaryCta = canonical 기반 + 추천 없으면 disabled (가짜 0/dead button 0)", () => {
    expect(src).toMatch(/const qty = reorderRecommendedQtyFor\(contextPanelItem\.id\)/);
    expect(src).toMatch(/const hasRec = qty != null && qty > 0/);
    expect(src).toMatch(/disabled: !hasRec/);
    expect(src).toMatch(/if \(match\) openReorderReviewSheet\(match\)/);
  });
});

describe("§inventory-reorder-surface-unify P2 — 회귀 0", () => {
  const src = read(CONTENT);
  it("데스크탑 패널 reorderQty canonical 소스 보존(L2708 동일 lookup)", () => {
    expect(src).toMatch(/reorderQty=\{reorderRecommendationsData\?\.recommendations\?\.find/);
  });
  it("ReorderReviewSheet(§11.310) 컴포넌트 보존(래퍼가 import)", () => {
    expect(read(WRAPPER)).toMatch(/ReorderReviewSheet/);
  });
});
