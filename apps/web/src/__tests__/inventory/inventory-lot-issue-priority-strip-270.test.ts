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
    expect(source).toContain("보류 {lotIssueHoldCount}건");
    expect(source).toContain("즉시 확인 {lotIssueImmediateCount}건");
    expect(source).toContain("폐기 검토 {lotIssueDisposalReviewCount}건");
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

  it("marks the active operations tab as the current screen instead of a no-op CTA", () => {
    expect(source).toContain("disabled={activeInventoryTab === tab.key}");
    expect(source).toContain("현재 화면입니다. 상단의 다음 처리 버튼에서 실제 조치를 시작하세요.");
  });
});
