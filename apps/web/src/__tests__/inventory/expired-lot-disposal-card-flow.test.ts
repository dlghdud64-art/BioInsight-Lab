import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/app/dashboard/inventory/inventory-content.tsx"),
  "utf8"
);

describe("expired lot disposal card flow", () => {
  it("surfaces disposal before reorder from inventory cards", () => {
    expect(source).toContain("const isExpiredLotWithQty");
    expect(source).toContain("onDispose?: () => void;");
    expect(source).toContain("onDispose={() => openDisposalDock(inventory)}");
    expect(source).toContain("재입고 요청보다 폐기 처리를 먼저 진행해야 합니다.");
    expect(source).toContain("폐기 처리");
    expect(source).toContain("재주문 검토는 폐기 후 진행");
  });

  it("keeps reorder behind the disposal dock handoff", () => {
    expect(source).toContain("onReorder={isExpiredLotWithQty ? undefined : onRestockRequest}");
    expect(source).toContain("onNavigateToReorder={(productName) => {");
    expect(source).toContain("openReorderReview(matchingItem)");
  });
});
