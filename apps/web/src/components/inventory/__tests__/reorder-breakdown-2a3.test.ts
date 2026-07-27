import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * §inventory-delta-label-kpi Phase 2a-3 (핸드오프 §1.1)
 *   재발주 권장수량 근거 분해(갭·납기중소진·MOQ) 레일 노출.
 *   P1 API recommendationBreakdown → caller(inventory-content) → panel prop → 재발주 섹션.
 *   canonical 파생(조작 0), null이면 미표시.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const PANEL = "src/components/inventory/inventory-context-panel.tsx";
const CONTENT = "src/app/dashboard/inventory/inventory-content.tsx";

describe("§inventory-delta-label-kpi P2a-3 — panel 근거 분해 prop + 표시", () => {
  it("reorderBreakdown prop(타입·기본값)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/reorderBreakdown\?: \{/);
    expect(src).toMatch(/safetyGap: number;\s*\n\s*leadTimeConsumption: number/);
    expect(src).toMatch(/reorderBreakdown = null,/);
  });

  it("근거 3항 표시(갭·납기중소진·MOQ 반올림) — null이면 미표시", () => {
    const src = read(PANEL);
    expect(src).toMatch(/reorderBreakdown && \(/);
    expect(src).toMatch(/권장 수량 근거/);
    expect(src).toMatch(/안전재고 갭[\s\S]{0,120}reorderBreakdown\.safetyGap/);
    expect(src).toMatch(/납기 중 소진[\s\S]{0,120}reorderBreakdown\.leadTimeConsumption/);
    expect(src).toMatch(/최소 주문 단위 반올림[\s\S]{0,120}reorderBreakdown\.minOrderQty/);
  });
});

describe("§inventory-delta-label-kpi P2a-3 — caller threading(단일 소스)", () => {
  it("query 타입에 recommendationBreakdown 추가", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/recommendationBreakdown\?: \{ safetyGap: number; leadTimeConsumption: number/);
  });

  it("panel 에 reorderBreakdown prop 전달(reorderQty 와 동일 소스)", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/reorderBreakdown=\{reorderRecommendationsData\?\.recommendations\?\.find\(\(r\) => r\.inventoryId === contextPanelItem\?\.id\)\?\.recommendationBreakdown \?\? null\}/);
  });
});
