import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("inventory lot issue priority strip", () => {
  it("keeps lot issue priority counts visible before the operator chooses an action", () => {
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-priority-strip"',
    );
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-hold-count"',
    );
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-immediate-count"',
    );
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-disposal-count"',
    );
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-reorder-count"',
    );
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-stock-impact"',
    );
    expect(source).toContain("보류 {lotIssueHoldCount}건");
    expect(source).toContain("즉시 확인 {lotIssueImmediateCount}건");
    expect(source).toContain("폐기 검토 {lotIssueDisposalReviewCount}건");
    expect(source).toContain("재주문 검토 {lotIssueReorderReviewCount}건");
    expect(source).toContain("다음 작업: 1순위 폐기 처리 → 2순위 재주문 검토");
    expect(source).toContain("폐기 후 안전재고 이하일 때만 재주문 검토");
  });

  it("wires the primary lot issue action to a visible dock or disabled reason", () => {
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-next-action"',
    );
    expect(source).toContain("const handleLotIssueDecisionAction = () => {");
    expect(source).toContain('setActiveInventoryTab("overview")');
    expect(source).toContain("openDisposalDock(priorityExpiredLot)");
    expect(source).toContain("처리할 lot_issue가 없어 조치 버튼을 비활성화했습니다.");
  });

  it("keeps the disposal dock open after confirmation so stock impact remains auditable", () => {
    expect(source).toContain("const [disposalCompletionSummary");
    expect(source).toContain("setDisposalCompletionSummary({");
    expect(source).toContain("completionSummary={disposalCompletionSummary}");
    expect(source).not.toContain("setDisposalTarget(null);\n      setDisposalInventoryId(null);\n      toast({");
  });

  it("lets the active operations tab reveal the lot issue dock instead of becoming a no-op CTA", () => {
    expect(source).toContain(
      'data-testid={tab.key === "overview" ? "labaxis-inventory-overview-tab" : tab.key === "manage" ? "labaxis-inventory-manage-tab" : undefined}',
    );
    expect(source).toContain('tab.key === "overview" && activeInventoryTab === "overview" && showLotIssueDecisionStrip');
    expect(source).toContain("handleLotIssueDecisionAction();");
    expect(source).toContain("현재 운영 현황입니다. 클릭하면 lot_issue 폐기 검토를 엽니다.");
  });

  it("renders the active item management tab as a disabled current state instead of a no-op CTA", () => {
    expect(source).toContain("labaxis-inventory-manage-tab");
    expect(source).toContain('tab.key === "manage" && activeInventoryTab === "manage"');
    expect(source).toContain("현재 품목 관리 화면입니다. 운영 현황이나 조치 시작을 선택하면 화면이 전환됩니다.");
    expect(source).toContain("labaxis-inventory-manage-current-reason");
  });
});
