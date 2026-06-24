/**
 * §inventory-redesign A-①' — 우측 패널 통합 sentinel (PLAN: docs/plans/PLAN_inventory-panel-unify.md)
 *
 * 정본 = InventoryContextPanel. AiAssistantPanel 자산 흡수 + mode 분기로 단일 패널화.
 * Phase별 누적 가드:
 *   P1 — mode:'detail'|'reorder' prop + 헤더 맥락 분기(default detail = 회귀 0).
 *   P2~P4 — reorder 흡수 / 라우팅 전환 / 단일 배너 (배치 진행 시 추가).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const PANEL = "src/components/inventory/inventory-context-panel.tsx";

describe("§inventory-panel-unify P1 — mode prop + 헤더 맥락 분기", () => {
  it("mode prop 정의('detail'|'reorder')", () => {
    const src = read(PANEL);
    expect(src).toMatch(/mode\?:\s*"detail"\s*\|\s*"reorder"/);
    expect(src).toMatch(/mode = "detail"/); // default detail = 회귀 0
  });
  it("헤더 eyebrow mode 분기(재발주 검토 / 운영 브리핑)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/mode === "reorder" \? "재발주 검토" : "운영 브리핑"/);
  });
  it("회귀 0 — '운영 브리핑' eyebrow 문자열 보존", () => {
    expect(read(PANEL)).toContain("운영 브리핑");
  });
});

const CONTENT = "src/app/dashboard/inventory/inventory-content.tsx";

describe("§inventory-panel-unify P2 — reorderRecommendation 흡수", () => {
  it("panel reorderQty prop(canonical, null이면 미표시)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/reorderQty\?:\s*number\s*\|\s*null/);
    expect(src).toMatch(/reorderQty != null && reorderQty > 0/); // 가짜 0(>0만 표시)
    expect(src).toContain("재발주 우선순위");
  });
  it("재발주 CTA = onReorder(실 핸들러, dead button 0)", () => {
    expect(read(PANEL)).toMatch(/재발주안 검토[\s\S]{0,80}|onReorder\?\.\(item\)/);
  });
  it("content가 canonical reorder-recommendations 수량 forward", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/reorderQty=\{[\s\S]{0,160}recommendedQty/);
    expect(src).toContain("reorder-recommendations");
  });
});

describe("§inventory-panel-unify P3a — 재발주 진입 통합 패널 라우팅(mode plumbing)", () => {
  it("contextPanelMode state + openContextPanel mode 파라미터", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/contextPanelMode/);
    expect(src).toMatch(/openContextPanel = \(inv: ProductInventory, mode:/);
  });
  it("openReorderReview → 통합 패널(reorder) 라우팅 (AiAssistant 직접 오픈 아님)", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/openReorderReview = \(inventory: ProductInventory\) => \{\s*openContextPanel\(inventory, "reorder"\)/);
  });
  it("ContextPanel 렌더에 mode={contextPanelMode} 전달", () => {
    expect(read(CONTENT)).toMatch(/mode=\{contextPanelMode\}/);
  });
});

describe("§inventory-panel-unify P3b-1 — 행 메뉴 재발주 진입 통합 패널 라우팅", () => {
  it("'재발주 검토' 행 메뉴 = openReorderReview(inv) (preparePanel 직접 호출 아님)", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/label: "재발주 검토",[\s\S]{0,120}onClick: \(\) => openReorderReview\(inv\)/);
  });
  it("'대체품 재발주 검토' 행 메뉴 = openReorderReview(inv)", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/label: "대체품 재발주 검토",[\s\S]{0,140}onClick: \(\) => openReorderReview\(inv\)/);
  });
  it("회귀 0 — 두 행 메뉴 라벨 보존", () => {
    const src = read(CONTENT);
    expect(src).toContain("재발주 검토");
    expect(src).toContain("대체품 재발주 검토");
  });
});
