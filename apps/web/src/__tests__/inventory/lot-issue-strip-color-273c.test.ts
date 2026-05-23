/**
 * §11.273c #lot-issue-strip-color — 재고 관리 lot_issue priority strip 4 Badge
 *   색상 차별화 (긴급도 기반, 호영님 P0 spec)
 *
 * 호영님 spec:
 *   재고 KPI 가로 스크롤 + 카드 배경색 동일 (연한 회색) → 색상 차별화:
 *     - 0건 = 모두 동일한 회색 (시선 분산 방지)
 *     - 1건 이상 = 긴급도별 색상 활성화
 *
 *   spec mapping (lot_issue priority strip 의 4 Badge):
 *     - 보류 (lotIssueHoldCount)            : 0건 slate / 1건+ amber (주의)
 *     - 즉시 확인 (lotIssueImmediateCount)   : 0건 slate / 1건+ red (긴급)
 *     - 폐기 검토 (lotIssueDisposalReviewCount): 0건 slate / 1건+ orange (검토)
 *     - 재주문 검토 (lotIssueReorderReviewCount): 0건 slate / 1건+ red (긴급)
 *
 * Fix (minimum diff, 4 Badge className 분기 swap):
 *   - 기존: 모든 Badge 가 고정된 tone (border-amber-200 등) — 0건이어도 컬러
 *   - 신규: count > 0 시 tone color, count === 0 시 border-slate-200 bg-slate-50 text-slate-400
 *
 * canonical truth lock:
 *   - lotIssueHoldCount / lotIssueImmediateCount / lotIssueDisposalReviewCount /
 *     lotIssueReorderReviewCount 변수 + 4 Badge data-testid 보존
 *   - "보류 N건", "즉시 확인 N건", "폐기 검토 N건", "재주문 검토 N건" 라벨 보존
 *   - showLotIssueDecisionStrip 조건 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INVENTORY = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.273c #1 — lot_issue strip 4 Badge 색상 차별화", () => {
  it("§11.273c trace marker comment 존재", () => {
    expect(INVENTORY).toMatch(/§11\.273c/);
  });

  it("보류 Badge 가 lotIssueHoldCount === 0 분기 적용", () => {
    // lotIssueHoldCount > 0 ? amber tone : slate-400 tone
    expect(INVENTORY).toMatch(
      /lotIssueHoldCount[\s\S]{0,200}border-slate-200 bg-slate-50 text-slate-400/,
    );
  });

  it("즉시 확인 Badge 가 lotIssueImmediateCount === 0 분기 적용", () => {
    expect(INVENTORY).toMatch(
      /lotIssueImmediateCount[\s\S]{0,200}border-slate-200 bg-slate-50 text-slate-400/,
    );
  });

  it("폐기 검토 Badge 가 lotIssueDisposalReviewCount === 0 분기 적용", () => {
    expect(INVENTORY).toMatch(
      /lotIssueDisposalReviewCount[\s\S]{0,200}border-slate-200 bg-slate-50 text-slate-400/,
    );
  });

  it("재주문 검토 Badge 가 lotIssueReorderReviewCount === 0 분기 적용", () => {
    expect(INVENTORY).toMatch(
      /lotIssueReorderReviewCount[\s\S]{0,200}border-slate-200 bg-slate-50 text-slate-400/,
    );
  });
});

describe("§11.273c #2 — invariant 보존 (canonical truth)", () => {
  it("4 Badge data-testid 보존", () => {
    expect(INVENTORY).toMatch(/data-testid="labaxis-inventory-lot-issue-hold-count"/);
    expect(INVENTORY).toMatch(/data-testid="labaxis-inventory-lot-issue-immediate-count"/);
    expect(INVENTORY).toMatch(/data-testid="labaxis-inventory-lot-issue-disposal-count"/);
    expect(INVENTORY).toMatch(/data-testid="labaxis-inventory-lot-issue-reorder-count"/);
  });

  it("4 Badge 라벨 (보류 / 즉시 확인 / 폐기 검토 / 재주문 검토) 보존", () => {
    expect(INVENTORY).toMatch(/보류 \{lotIssueHoldCount\}건/);
    expect(INVENTORY).toMatch(/즉시 확인 \{lotIssueImmediateCount\}건/);
    expect(INVENTORY).toMatch(/폐기 검토 \{lotIssueDisposalReviewCount\}건/);
    expect(INVENTORY).toMatch(/재주문 검토 \{lotIssueReorderReviewCount\}건/);
  });

  it("showLotIssueDecisionStrip 조건 보존", () => {
    expect(INVENTORY).toMatch(/showLotIssueDecisionStrip &&/);
  });

  it("lot_issue strip 1 건 이상 시 긴급도 tone color 보존", () => {
    // 1건+ 시 적용되는 tone (amber/red/orange) 색상 보존
    expect(INVENTORY).toMatch(/border-yellow-200 bg-yellow-50 text-yellow-700/);
    expect(INVENTORY).toMatch(/border-red-200 bg-red-50 text-red-700/);
  });
});
