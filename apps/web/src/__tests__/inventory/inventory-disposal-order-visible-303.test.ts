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
    expect(source).toContain('data-testid="labaxis-inventory-lot-issue-visible-audit-summary"');
    expect(source).toContain('Lot ID: {priorityExpiredLot?.lotNumber || "확인 필요"}');
    expect(source).toContain("수량: {priorityExpiredLot?.currentQuantity ?? actionableExpiredQuantity}");
    expect(source).toContain('format(new Date(priorityExpiredLot.expiryDate), "yyyy.MM.dd", { locale: ko })');
    expect(source).toContain('위치: {priorityExpiredLot?.location || "미지정"}');
    expect(source).toContain("사유: 유효기간 만료");
    expect(source).toContain("재고 영향: 승인 후 -{priorityExpiredLot?.currentQuantity ?? actionableExpiredQuantity}");
    expect(source).toContain("폐기 처리");
    expect(source).toContain("후속: 폐기 완료 후 재발주 검토");
    expect(source).toContain('data-testid="labaxis-inventory-lot-issue-execution-gate"');
    expect(source).toContain("승인 필요: 폐기 승인 1건");
    expect(source).toContain("재고 반영 예정: 승인 후 -{priorityExpiredLot?.currentQuantity ?? actionableExpiredQuantity}개");
    expect(source).toContain("bg-blue-600 text-white hover:bg-blue-700");
  });

  it("운영 현황 배너도 같은 처리 순서를 표시한다", () => {
    expect(source).toContain("1순위: 폐기 처리 · 만료 lot {actionableExpiredLots.length}건 · 잔량 {actionableExpiredQuantity}개");
    expect(source).toContain("후속: 폐기 완료 후 재발주 검토");
  });
});
