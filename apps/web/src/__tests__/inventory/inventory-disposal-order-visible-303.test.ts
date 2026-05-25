import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("재고 폐기 우선순위 표시", () => {
  it("폐기 처리를 1순위, 재발주를 후속 검토로 분리한다", () => {
    expect(source).toContain("1순위: 폐기 처리 · 만료 lot");
    expect(source).toContain("2순위: 재발주 후속 검토 · 폐기 완료 후 안전재고 영향 확인");
    expect(source).toContain("재발주: 후속 검토 {lotIssueReorderReviewCount}건");
  });

  it("운영 현황 배너도 같은 처리 순서를 표시한다", () => {
    expect(source).toContain("1순위: 폐기 처리 · 만료 lot {actionableExpiredLots.length}건 · 잔량 {actionableExpiredQuantity}개");
    expect(source).toContain("2순위: 재발주 후속 검토 · 폐기 완료 후 안전재고 영향이 있을 때만 진행");
  });
});
