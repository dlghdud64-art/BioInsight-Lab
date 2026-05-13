import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/components/inventory/inventory-context-panel.tsx"),
  "utf8"
);

describe("inventory context panel disposal priority", () => {
  it("pins expired lot and use-prohibited evidence at the top of the panel", () => {
    expect(source).toContain("data-testid=\"labaxis-inventory-context-disposal-strip\"");
    expect(source).toContain("data-testid=\"labaxis-inventory-context-dispose-cta\"");
    expect(source).toContain("만료");
    expect(source).toContain("사용 금지");
    expect(source).toContain("폐기 처리 시작");
    expect(source).toContain("안전재고 영향 있음");
  });

  it("keeps disposal evidence visible in the same top panel", () => {
    expect(source).toContain("data-testid=\"labaxis-inventory-context-disposal-evidence-grid\"");
    expect(source).toContain("label=\"수량\"");
    expect(source).toContain("label=\"만료일\"");
    expect(source).toContain("label=\"위치\"");
    expect(source).toContain("label=\"사유\"");
    expect(source).toContain("label=\"재고 영향\"");
    expect(source).toContain("유효기간 만료");
    expect(source).toContain("stockImpactLabel");
  });

  it("keeps reorder behind disposal for expired lots with quantity", () => {
    expect(source).toContain("const isExpiredLotWithQty");
    expect(source).toContain("actions.filter((action) => action.type !== \"reorder\")");
    expect(source).toContain("data-testid=\"labaxis-inventory-context-reorder-after-disposal\"");
    expect(source).toContain("재주문은 폐기 후");
    expect(source).toContain("폐기 후 재주문 검토");
    expect(source).toContain("if (isExpiredLotWithQty)");
  });

  it("marks expired lots as expired instead of merely expiring", () => {
    const expiredStatusIndex = source.indexOf("? \"expired\"");
    const expiringStatusIndex = source.indexOf("? \"expiring\"");

    expect(expiredStatusIndex).toBeGreaterThan(-1);
    expect(expiringStatusIndex).toBeGreaterThan(-1);
    expect(expiredStatusIndex).toBeLessThan(expiringStatusIndex);
  });
});
