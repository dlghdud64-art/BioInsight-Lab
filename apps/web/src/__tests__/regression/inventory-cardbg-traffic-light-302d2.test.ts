/**
 * §11.302d-2 #inventory-cardbg-traffic-light — inventory-main.tsx
 *   getCardBg() switch case 신호등 정합 + duplicate className orphan cleanup.
 *
 * §11.302d-1 후속 — Karpathy minimum-diff:
 *   getCardBg() 의 3 case 가 각 className 을 2번 반복 (orphan duplicate).
 *   §11.302d-2 에서 정리 + spec 정합 swap.
 *
 * Spec 매핑:
 *   expired/out_of_stock: bg-red-100 (큰 카드 가독성, bg-red-600 는
 *     h5 text-slate-900 conflict 회피 — KPI 카드 전용)
 *   expiring: bg-yellow-100 (검토)
 *   low_stock/reorder_lead: bg-red-100 (긴급)
 *   no_location: bg-pn/30 (utility, 보존)
 *
 * 보존 (변경 0):
 *   line 1672 daysLeft Badge — 이미 spec literal 정합 (bg-yellow-100
 *     text-yellow-700)
 *   line 1890 임박 Lot KPI — Lot 추적 P2 widget, §11.302e 별도 batch
 *
 * Out of Scope (별도 batch):
 *   §11.302d-3: inventory-content.tsx amber/yellow ~20 곳
 *   §11.302d-4: "긴급 재발주 필요" 안내 박스
 *   §11.302e: inventory-summary-block + Lot 추적 widget
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-main.tsx"),
  "utf8",
);

describe("§11.302d-2 — getCardBg() switch 신호등 정합 + duplicate cleanup", () => {
  it("§11.302d-2 trace marker", () => {
    expect(SRC).toMatch(/§11\.302d-2/);
  });

  describe("getCardBg() switch case — spec 정합 swap", () => {
    it('"expiring" case — bg-yellow-100 border-yellow-200 (검토)', () => {
      expect(SRC).toMatch(
        /case "expiring":[\s\S]{0,200}return "bg-yellow-100 border-yellow-200"/,
      );
    });

    it('"expired" / "out_of_stock" case — bg-red-100 border-red-200 (큰 카드 가독성, 위험 spec 의 red-600 대신)', () => {
      expect(SRC).toMatch(
        /case "out_of_stock":[\s\S]{0,300}return "bg-red-100 border-red-200"/,
      );
    });

    it('"low_stock" / "reorder_lead" case — bg-red-100 border-red-200 (긴급)', () => {
      expect(SRC).toMatch(
        /case "reorder_lead":[\s\S]{0,200}return "bg-red-100 border-red-200"/,
      );
    });

    it('"no_location" case — bg-pn/30 보존 (utility, spec 외)', () => {
      expect(SRC).toMatch(
        /case "no_location":[\s\S]{0,100}return "bg-pn\/30 border-bs"/,
      );
    });
  });

  describe("duplicate className orphan cleanup", () => {
    it("getCardBg() 안에 duplicate bg-red-100/bg-yellow-50 패턴 0", () => {
      // 이전: "bg-red-100  bg-red-100 border-red-900/30  border-red-900/30"
      expect(SRC).not.toMatch(/bg-red-100\s+bg-red-100/);
      expect(SRC).not.toMatch(/bg-yellow-50\s+bg-yellow-50/);
      expect(SRC).not.toMatch(/border-red-900\/30\s+border-red-900\/30/);
      expect(SRC).not.toMatch(/border-yellow-900\/30\s+border-yellow-900\/30/);
    });
  });

  describe("회귀 0 — 이미 spec 정합 변경 0 + KPI 보존", () => {
    it("line 1672 daysLeft Badge — bg-yellow-100 text-yellow-700 보존 (이미 정합)", () => {
      expect(SRC).toMatch(
        /issueType === "expired"[\s\S]{0,80}\?\s*"bg-red-100 text-red-700"[\s\S]{0,80}:\s*"bg-yellow-100 text-yellow-700"/,
      );
    });

    it("KPI 3-card (§11.302c) 보존 — grid-cols-3 + outOfStockCount + discardCount", () => {
      expect(SRC).toMatch(/<div className="grid grid-cols-3 gap-3">/);
      expect(SRC).toMatch(/const outOfStockCount\s*=/);
      expect(SRC).toMatch(/const discardCount\s*=/);
    });

    it("Badge 4 곳 (§11.302d-1) 보존 — 재고 부족 ×3 긴급 + 우선 사용 ×1 검토", () => {
      expect(SRC).toMatch(/dot="red" className="mt-1 bg-red-100 text-red-700 border-red-200/);
      expect(SRC).toMatch(/bg-yellow-100 text-yellow-700 border-yellow-200[\s\S]{0,200}우선 사용/);
    });
  });
});
