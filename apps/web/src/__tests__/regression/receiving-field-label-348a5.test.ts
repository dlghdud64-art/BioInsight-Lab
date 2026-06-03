/**
 * §11.348-A-5 (회귀) — 확정 입고안 → 현장 QR 라벨 접합 sentinel
 *
 * A-5: 승인(A-4) 시 생성된 InventoryRestock 의 inventoryId 를 라벨 모달(§11.355-B)로
 * 전달 → QR=inventoryId 출력 → 현장 스캔(§11.349)→차감(§11.355-D)으로 폐루프 종결.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const APPROVE = "src/app/api/receiving-drafts/[id]/approve/route.ts";
const PANEL = "src/components/receiving/receiving-review-panel.tsx";

describe("§11.348-A-5 — 승인 라우트가 라벨용 항목 반환", () => {
  it("restockedItems(inventoryId/name/lotNumber/expiryDate) 수집 + 응답 포함", () => {
    const src = read(APPROVE);
    expect(src).toContain("restockedItems.push");
    expect(src).toContain("inventoryId: inv.id");
    // 응답에 id=inventoryId 로 매핑(QR 인코딩 대상)
    expect(src).toContain("restockedItems: result.restockedItems.map");
    expect(src).toContain("id: r.inventoryId");
  });
});

describe("§11.348-A-5 — 패널이 승인 후 라벨 모달 오픈", () => {
  it("LabelPrintModal import + 승인 시 restockedItems→라벨", () => {
    const src = read(PANEL);
    expect(src).toContain('from "@/components/inventory/LabelPrintModal"');
    expect(src).toContain("data.restockedItems");
    expect(src).toContain("setLabelItems(data.restockedItems)");
    expect(src).toContain("setLabelOpen(true)");
    expect(src).toContain("<LabelPrintModal");
    expect(src).toContain("selectedItems={labelItems}");
  });
  it("승인 분기에서만 라벨(반려는 라벨 없음)", () => {
    const src = read(PANEL);
    expect(src).toContain('action === "approve" && Array.isArray(data.restockedItems)');
  });
});
