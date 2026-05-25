/**
 * §11.302d-3a #inventory-issue-config — inventory-content.tsx
 *   ISSUE_CONFIG (6 IssueType Badge cls mapping) 신호등 정합.
 *
 * §11.302d-4/d-5 후속 — Karpathy minimum-diff 분할:
 *   §11.302d-3a (본 batch) = ISSUE_CONFIG line 1080-1111
 *   §11.302d-3b = approval-waiting line 1560/1579
 *   §11.302d-3c = card BG + lot detail line 2164/2194-2241
 *   §11.302d-3d = KPI valueClass line 2429-2430
 *
 * spec 정합 swap:
 *   expired / out_of_stock → 위험 (bg-red-600 text-white, Badge 가독성 OK)
 *   expiring → 검토 (bg-yellow-100 text-yellow-700, 이전 yellow-500/10 강화)
 *   low_stock / reorder_lead → 긴급 (bg-red-100 text-red-700, 이전 yellow / blue 정정)
 *   no_location → utility 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.302d-3a — ISSUE_CONFIG 신호등 정합", () => {
  it("§11.302d-3a trace marker", () => {
    expect(SRC).toMatch(/§11\.302d-3a/);
  });

  describe("위험 (bg-red-600 text-white) × 2", () => {
    it('expired (만료됨) — bg-red-600 text-white', () => {
      expect(SRC).toMatch(
        /expired:\s*\{[\s\S]{0,80}label:\s*"만료됨",[\s\S]{0,80}cls:\s*"bg-red-600 text-white"/,
      );
    });

    it('out_of_stock (품절) — bg-red-600 text-white', () => {
      expect(SRC).toMatch(
        /out_of_stock:\s*\{[\s\S]{0,80}label:\s*"품절",[\s\S]{0,80}cls:\s*"bg-red-600 text-white"/,
      );
    });
  });

  describe("긴급 (bg-red-100 text-red-700) × 2 — 색상 역전 정정", () => {
    it('low_stock (부족) — bg-red-100 text-red-700 (이전 yellow-500/10 정정)', () => {
      expect(SRC).toMatch(
        /low_stock:\s*\{[\s\S]{0,80}label:\s*"부족",[\s\S]{0,80}cls:\s*"bg-red-100 text-red-700"/,
      );
    });

    it('reorder_lead (재발주 필요) — bg-red-100 text-red-700 (이전 blue-500/10 정정)', () => {
      expect(SRC).toMatch(
        /reorder_lead:\s*\{[\s\S]{0,80}label:\s*"재발주 필요",[\s\S]{0,80}cls:\s*"bg-red-100 text-red-700"/,
      );
    });
  });

  describe("검토 (bg-yellow-100 text-yellow-700) × 1", () => {
    it('expiring (만료 임박) — bg-yellow-100 text-yellow-700', () => {
      expect(SRC).toMatch(
        /expiring:\s*\{[\s\S]{0,80}label:\s*"만료 임박",[\s\S]{0,80}cls:\s*"bg-yellow-100 text-yellow-700"/,
      );
    });
  });

  describe("utility 보존 + 회귀 0", () => {
    it('no_location (위치 미지정) — bg-el text-slate-400 보존', () => {
      expect(SRC).toMatch(
        /no_location:\s*\{[\s\S]{0,80}label:\s*"위치 미지정",[\s\S]{0,80}cls:\s*"bg-el text-slate-400"/,
      );
    });

    it("이전 잘못된 색상 패턴 0 (bg-yellow-500/10 low_stock + bg-blue-500/10 reorder_lead)", () => {
      // low_stock 의 yellow-500/10 부재
      expect(SRC).not.toMatch(/label:\s*"부족",[\s\S]{0,80}cls:\s*"bg-yellow-500\/10/);
      // reorder_lead 의 blue-500/10 부재
      expect(SRC).not.toMatch(/label:\s*"재발주 필요",[\s\S]{0,80}cls:\s*"bg-blue-500\/10/);
    });

    it("priority 정렬 (0~5) 보존 — issueType 우선순위 변경 0", () => {
      expect(SRC).toMatch(/expired:[\s\S]{0,200}priority:\s*0/);
      expect(SRC).toMatch(/out_of_stock:[\s\S]{0,200}priority:\s*1/);
      expect(SRC).toMatch(/expiring:[\s\S]{0,200}priority:\s*2/);
      expect(SRC).toMatch(/low_stock:[\s\S]{0,200}priority:\s*3/);
      expect(SRC).toMatch(/reorder_lead:[\s\S]{0,200}priority:\s*4/);
      expect(SRC).toMatch(/no_location:[\s\S]{0,200}priority:\s*5/);
    });
  });
});
