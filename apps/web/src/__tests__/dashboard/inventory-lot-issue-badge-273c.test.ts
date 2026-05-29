/**
 * ⚠️ §11.317 Phase 5 obsolete (호영님 P1, 2026-05-29) — describe.skip 처리.
 *   본 file 의 lot_issue priority strip / disposal Badge testid 단언은 §11.317 Phase 2 에서
 *   inventory-content.tsx 의 폐기 strip(90 lines) 자체가 운영 브리핑(stock_risk 카테고리)으로
 *   이관되어 제거됨. 새 구조 가드는 inventory-header-brief-migration-317.test.ts (Phase 1 sentinel)
 *   가 책임. 본 file 은 후속 cleanup batch 에서 삭제 검토.
 *
 * §11.273c #lot_issue-strip — 4 Badge 색상 차별화 (호영님 P0 긴급도)
 *
 * 호영님 spec: 0건 카드도 동일 컬러 → 1건 이상 항목 시각 강조 안 됨.
 *
 * Fix (minimum diff, inventory-content.tsx):
 *   - 4 Badge className 인라인 conditional:
 *       보류:     count > 0 → border-yellow-200 bg-yellow-50 text-yellow-700
 *       즉시 확인: count > 0 → border-red-200 bg-red-50 text-red-700
 *       폐기 검토: count > 0 → border-red-200 bg-red-50 text-red-700
 *       재주문 검토: count > 0 → border-red-200 bg-red-50 text-red-700
 *       0건 공통:  border-slate-200 bg-slate-50 text-slate-400
 *
 * canonical truth lock:
 *   - data-testid 4개 보존 (hold / immediate / disposal / reorder)
 *   - variant="outline" 보존
 *   - 라벨 (보류 / 즉시 확인 / 폐기 검토 / 재주문 검토) 보존
 *   - showLotIssueDecisionStrip 조건 보존
 *   - labaxis-inventory-lot-issue-next-action CTA 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INV_PATH = resolve(
  __dirname,
  "../../app/dashboard/inventory/inventory-content.tsx"
);
const inv = readFileSync(INV_PATH, "utf8");

describe.skip("§11.273c #1 — trace marker + strip 존재", () => {
  it("§11.273c trace marker comment 존재", () => {
    expect(inv).toMatch(/§11\.273c/);
  });

  it("showLotIssueDecisionStrip 조건 보존", () => {
    expect(inv).toContain("showLotIssueDecisionStrip");
  });

  it("labaxis-inventory-lot-issue-priority-strip testid 보존", () => {
    expect(inv).toContain('data-testid="labaxis-inventory-lot-issue-priority-strip"');
  });
});

describe.skip("§11.273c #2 — 4 Badge 색상 conditional 적용", () => {
  it("보류 Badge: count > 0 → amber tone", () => {
    expect(inv).toMatch(
      /labaxis-inventory-lot-issue-hold-count[\s\S]{0,300}border-yellow-200 bg-yellow-50 text-yellow-700/
    );
  });

  it("즉시 확인 Badge: count > 0 → red tone", () => {
    expect(inv).toMatch(
      /labaxis-inventory-lot-issue-immediate-count[\s\S]{0,300}border-red-200 bg-red-50 text-red-700/
    );
  });

  it("폐기 검토 Badge: count > 0 → red tone (§11.283c orange → red 신호등 sweep)", () => {
    // §11.273c 원안 orange tone 이 §11.283c (호영님 P0 신호등 spec) 후속으로
    // red 으로 swap (긴급 신호등 통일). polarities preserved (count > 0 시 강조).
    expect(inv).toMatch(
      /labaxis-inventory-lot-issue-disposal-count[\s\S]{0,300}border-red-200 bg-red-50 text-red-700/
    );
  });

  it("재주문 검토 Badge: count > 0 → red tone", () => {
    expect(inv).toMatch(
      /labaxis-inventory-lot-issue-reorder-count[\s\S]{0,300}border-red-200 bg-red-50 text-red-700/
    );
  });

  it("0건 공통 slate 톤다운 (border-slate-200 bg-slate-50 text-slate-400) 적용", () => {
    expect(inv).toContain("border-slate-200 bg-slate-50 text-slate-400");
  });
});

describe.skip("§11.273c #3 — Badge invariant 보존 (canonical truth)", () => {
  it("4 Badge data-testid 보존 (hold / immediate / disposal / reorder)", () => {
    expect(inv).toContain('data-testid="labaxis-inventory-lot-issue-hold-count"');
    expect(inv).toContain('data-testid="labaxis-inventory-lot-issue-immediate-count"');
    expect(inv).toContain('data-testid="labaxis-inventory-lot-issue-disposal-count"');
    expect(inv).toContain('data-testid="labaxis-inventory-lot-issue-reorder-count"');
  });

  it("variant='outline' 4개 Badge 모두 보존", () => {
    const matches = inv.match(/variant="outline"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  it("라벨 보류 / 즉시 확인 / 폐기 검토 / 재주문 검토 보존", () => {
    expect(inv).toContain("보류");
    expect(inv).toContain("즉시 확인");
    expect(inv).toContain("폐기 검토");
    expect(inv).toContain("재주문 검토");
  });
});
