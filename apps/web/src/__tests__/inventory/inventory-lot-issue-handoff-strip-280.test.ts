/**
 * ⚠️ §11.317 Phase 5 obsolete (호영님 P1, 2026-05-29) — describe.skip 처리.
 *   본 file 의 lot-issue handoff strip(현재 담당/다음 조치/인계 상태) testid 단언은
 *   §11.317 Phase 2 에서 inventory-content.tsx 의 폐기 strip(90 lines) 자체가 운영 브리핑
 *   (stock_risk 카테고리)으로 이관되어 제거됨. 새 구조 가드는
 *   inventory-header-brief-migration-317.test.ts 가 책임. 본 file 은 후속 cleanup batch 에서 삭제 검토.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe.skip("inventory lot issue handoff strip", () => {
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
      source.indexOf('data-testid="labaxis-inventory-lot-issue-reorder-secondary-action"'),
    );
  });

  it("keeps disposal as the primary action before the reorder review handoff", () => {
    expect(source).toContain('data-testid="labaxis-inventory-lot-issue-action-stack"');
    expect(source).toContain('data-testid="labaxis-inventory-lot-issue-reorder-secondary-action"');
    expect(source.indexOf("폐기 처리")).toBeLessThan(
      source.indexOf("후속: 폐기 완료 후 재발주 검토"),
    );
  });
});
