import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("inventory lot issue priority strip", () => {
  it("pins disposal review, approval waiting, and executable states in Korean", () => {
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-decision-state-strip"',
    );
    expect(source).toContain(
      'data-testid="labaxis-inventory-disposal-review-state"',
    );
    expect(source).toContain(
      'data-testid="labaxis-inventory-approval-waiting-state"',
    );
    expect(source).toContain(
      'data-testid="labaxis-inventory-executable-state"',
    );
    expect(source).toContain("처분 검토 {lotIssueDisposalReviewCount}건");
    expect(source).toContain("승인 대기 {lotIssueApprovalPendingCount}건");
    expect(source).toContain("실행 가능 {lotIssueExecutableCount}건");
  });

  it("shows the first-screen decision summary without opening help", () => {
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-decision-summary"',
    );
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-audit-line"',
    );
    expect(source).toContain("1순위: 폐기 처리 · 만료 lot {lotIssueDisposalReviewCount}건");
    expect(source).toContain("2순위: 재발주 후속 검토 · 폐기 완료 후 안전재고 영향 확인");
    expect(source).toContain("승인 여부:");
    expect(source).toContain("재고 감소 영향: {actionableExpiredQuantity}개");
    expect(source).toContain("다음 처리자: 재고 운영");
  });

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
    expect(source).toContain(
      'data-testid="labaxis-inventory-disposal-priority-badge"',
    );
    expect(source).toContain("폐기 처리 우선");
    expect(source).toContain("보류 {lotIssueHoldCount}건");
    expect(source).toContain("즉시 확인 {lotIssueImmediateCount}건");
    expect(source).toContain("폐기 검토 {lotIssueDisposalReviewCount}건");
    expect(source).toContain("재발주: 후속 검토 {lotIssueReorderReviewCount}건");
    expect(source).toContain("만료 · 사용 금지 · 폐기 처리 순서로 먼저 확인합니다.");
    expect(source).toContain("폐기 후 안전재고 이하일 때만 재주문 검토");
    expect(source).toContain(
      'data-testid="labaxis-inventory-reorder-secondary-note"',
    );
    expect(source).toContain("재주문 검토는 폐기 완료 후 우측 도크에서 보조 액션으로 확인합니다.");
  });

  it("wires the primary lot issue action to a visible dock or disabled reason", () => {
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-next-action"',
    );
    expect(source).toContain("const handleLotIssueDecisionAction = () => {");
    expect(source).toContain('setActiveInventoryTab("overview")');
    expect(source).toContain("openDisposalDock(priorityExpiredLot)");
    expect(source).toContain("bg-blue-600 text-white hover:bg-blue-700");
    expect(source).toContain("폐기 처리");
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-reorder-secondary-action"',
    );
    expect(source).toContain("재발주 검토 (폐기 완료 후)");
    expect(source).toContain("처리할 lot_issue가 없어 조치 버튼을 비활성화했습니다.");
  });

  it("keeps reorder review as a disabled secondary CTA after disposal", () => {
    expect(source).toContain(
      'data-testid="labaxis-inventory-lot-issue-action-stack"',
    );
    expect(source.indexOf('data-testid="labaxis-inventory-lot-issue-next-action"')).toBeLessThan(
      source.indexOf('data-testid="labaxis-inventory-lot-issue-reorder-secondary-action"'),
    );
    expect(source.indexOf("폐기 처리")).toBeLessThan(
      source.indexOf("재발주 검토 (폐기 완료 후)"),
    );
    expect(source).toContain('aria-disabled="true"');
  });

  it("removes the weak operations summary tab copy while lot issue review is active", () => {
    expect(source).toContain('label: showLotIssueDecisionStrip ? "폐기 검토" : "운영 현황"');
    expect(source).toContain("badge: showLotIssueDecisionStrip ? null : issuesCount > 0 ? issuesCount : null");
    expect(source).toContain('suffix: showLotIssueDecisionStrip ? null : "S"');
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
