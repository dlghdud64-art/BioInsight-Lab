import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/components/inventory/lot-disposal-panel.tsx"),
  "utf8",
);

describe("lot disposal approval summary", () => {
  it("shows the audit fields CFO review needs before disposal confirmation", () => {
    expect(source).toContain(
      'data-testid="labaxis-inventory-disposal-approval-summary"',
    );
    expect(source).toContain('label: "Lot ID"');
    expect(source).toContain('label: "수량"');
    expect(source).toContain('label: "만료일"');
    expect(source).toContain('label: "위치"');
    expect(source).toContain('label: "사유"');
    expect(source).toContain('label: "재고 감소"');
    expect(source).toContain("approvalSummaryRows.map");
  });

  it("keeps approval status, disposable count, and stock impact visible together", () => {
    expect(source).toContain("approvalStatusItems");
    expect(source).toContain(
      'data-testid="labaxis-inventory-disposal-approval-line"',
    );
    expect(source).toContain(
      'data-testid="labaxis-inventory-disposable-count"',
    );
    expect(source).toContain(
      'data-testid="labaxis-inventory-disposal-stock-impact-first"',
    );
    expect(source).toContain("승인 완료");
    expect(source).toContain("승인 대기");
    expect(source).toContain("차단");
    expect(source).toContain("폐기 처리 가능");
    expect(source).toContain("재고 영향");
    expect(source).toContain("안전재고 이하");
  });

  it("separates disposal pending, processing, and completed stock impact states", () => {
    expect(source).toContain(
      'data-testid="labaxis-inventory-disposal-flow-status"',
    );
    expect(source).toContain("1 폐기 확인");
    expect(source).toContain("2 폐기 처리 중");
    expect(source).toContain("3 폐기 완료");
    expect(source).toContain("Lot ID {target.lotNumber}");
    expect(source).toContain("수량 {effectiveQty}");
    expect(source).toContain(
      'data-testid="labaxis-inventory-disposal-complete-summary"',
    );
    expect(source).toContain("폐기 후 재고 {completionSummary.remainingQuantity}");
  });

  it("keeps reorder as a post-disposal note instead of a pre-confirm action", () => {
    expect(source).toContain(
      'data-testid="labaxis-inventory-reorder-after-disposal-note"',
    );
    expect(source).toContain(
      'data-testid="labaxis-inventory-reorder-after-disposal-cta"',
    );
    expect(source).toContain("다음 단계: 폐기 확정 후 재주문 검토");
    expect(source).toContain("승인 전에는 재주문 실행 버튼을 노출하지 않습니다");
    expect(source).toContain("재주문 검토 열기");
    expect(source).not.toMatch(
      /onClick=\{\(\) => onNavigateToReorder\(target\.productName\)\}/,
    );
  });
});
