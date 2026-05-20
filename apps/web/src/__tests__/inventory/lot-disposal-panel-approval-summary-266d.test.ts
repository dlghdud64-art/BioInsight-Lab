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

  it("keeps reorder as a post-disposal note instead of a pre-confirm action", () => {
    expect(source).toContain(
      'data-testid="labaxis-inventory-reorder-after-disposal-note"',
    );
    expect(source).toContain("다음 단계: 폐기 확정 후 재주문 검토");
    expect(source).toContain("승인 전에는 재주문 실행 버튼을 노출하지 않습니다");
    expect(source).not.toMatch(
      /onClick=\{\(\) => onNavigateToReorder\(target\.productName\)\}/,
    );
  });
});
