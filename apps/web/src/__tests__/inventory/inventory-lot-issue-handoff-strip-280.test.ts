import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("inventory lot issue handoff strip", () => {
  it("pins owner, next action, and handoff status above the lot issue action", () => {
    expect(source).toContain('data-testid="labaxis-inventory-lot-issue-handoff-strip"');
    expect(source).toContain('data-testid="labaxis-inventory-current-owner"');
    expect(source).toContain('data-testid="labaxis-inventory-next-handoff-action"');
    expect(source).toContain('data-testid="labaxis-inventory-handoff-status"');
    expect(source.indexOf('data-testid="labaxis-inventory-lot-issue-handoff-strip"')).toBeLessThan(
      source.indexOf('data-testid="labaxis-inventory-lot-issue-next-action"'),
    );
  });

  it("separates blocker, one action, and one hold item as queue language", () => {
    expect(source).toContain('data-testid="labaxis-inventory-lot-issue-queue-strip"');
    expect(source).toContain("border-red-200 bg-red-50");
    expect(source).toContain("조치 1개: 폐기 처리");
    expect(source).toContain("border-slate-200 bg-slate-50");
    expect(source.indexOf('data-testid="labaxis-inventory-lot-issue-queue-strip"')).toBeLessThan(
      source.indexOf('data-testid="labaxis-inventory-reorder-secondary-note"'),
    );
  });

  it("keeps disposal as the primary action before the reorder review handoff", () => {
    expect(source).toContain('data-testid="labaxis-inventory-lot-issue-action-stack"');
    expect(source).toContain('data-testid="labaxis-inventory-lot-issue-reorder-secondary-action"');
    expect(source.indexOf("1차 CTA · 폐기 처리 시작")).toBeLessThan(
      source.indexOf("2차 CTA · 폐기 완료 후 재주문 검토"),
    );
  });
});
