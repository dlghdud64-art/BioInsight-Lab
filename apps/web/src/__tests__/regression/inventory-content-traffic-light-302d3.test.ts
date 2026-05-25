/**
 * §11.302d-3 #inventory-content-traffic-light — inventory-content.tsx
 *   잔여 yellow ~6 surface 일괄 swap (호영님 일괄 결정).
 *
 * §11.302d-3a (ISSUE_CONFIG central mapping) 후속 — sub-batch b/c/d 통합:
 *   b) 승인 대기 Badge (line 1567) — bg-yellow-50 → bg-yellow-100 (검토 강화)
 *   c1) getCardBg switch (line 2171-2184, inventory-content 별도 함수) —
 *       4 case red-50 → red-100 (긴급 spec) / yellow-50 → yellow-100 (검토)
 *   c2) stock badge text (line 2211) — lowStock yellow → red 긴급 정정
 *   c3) "우선 사용" Badge (line ~2253) — yellow-50 → yellow-100 + duplicate cleanup
 *   c4) button color (line ~2225) — out_of_stock blue + low_stock/reorder_lead
 *       yellow → red 통일 (위험/긴급)
 *   d) Summary cards (line 2440-2451) — "만료 임박" text-yellow-500 →
 *      text-yellow-700, "만료/소진" text-rose-500 → text-red-700
 *
 * 보존:
 *   - D-day color (line 2207, expired red-700 / expiring yellow-700) 이미 정합
 *   - 위치 없음 text-yellow-500 (line 2214) utility, spec 외
 *   - "활성" / "전체 Lot" Summary cards 긍정/utility 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.302d-3 — inventory-content 잔여 yellow 일괄 신호등 정합", () => {
  it("§11.302d-3 trace marker", () => {
    expect(SRC).toMatch(/§11\.302d-3/);
  });

  describe("d-3b 승인 대기 Badge — 검토 spec 강화", () => {
    it("승인 대기 → bg-yellow-100 (이전 yellow-50 강화)", () => {
      expect(SRC).toMatch(
        /labaxis-inventory-approval-waiting-state[\s\S]{0,200}border-yellow-200 bg-yellow-100 px-3 py-2 text-yellow-700[\s\S]{0,80}승인 대기/,
      );
    });
  });

  describe("d-3c getCardBg switch — 신호등 spec 정합", () => {
    it('inventory-content getCardBg "expired" / "out_of_stock" → bg-red-100 border-red-200', () => {
      expect(SRC).toMatch(
        /이슈 유형별 카드 배경[\s\S]{0,400}case "out_of_stock":[\s\S]{0,200}return "bg-red-100 border-red-200"/,
      );
    });

    it('inventory-content getCardBg "expiring" → bg-yellow-100 border-yellow-200 (검토)', () => {
      expect(SRC).toMatch(
        /이슈 유형별 카드 배경[\s\S]{0,600}case "expiring":[\s\S]{0,200}return "bg-yellow-100 border-yellow-200"/,
      );
    });

    it('inventory-content getCardBg "low_stock" / "reorder_lead" → bg-red-100 border-red-200 (긴급)', () => {
      expect(SRC).toMatch(
        /이슈 유형별 카드 배경[\s\S]{0,800}case "reorder_lead":[\s\S]{0,200}return "bg-red-100 border-red-200"/,
      );
    });
  });

  describe("d-3c stock badge text — lowStock yellow → red 긴급 정정", () => {
    it("stock badge — lowStock 조건도 text-red-700 (이전 text-yellow-700 정정)", () => {
      expect(SRC).toMatch(
        /inv\.currentQuantity === 0 \? "text-red-700" : inv\.safetyStock != null && inv\.currentQuantity <= inv\.safetyStock \? "text-red-700"/,
      );
    });
  });

  describe('d-3c "우선 사용" Badge — 검토 spec 강화 + duplicate cleanup', () => {
    it("우선 사용 Badge — bg-yellow-100 + border-yellow-200 (duplicate yellow-50 패턴 0)", () => {
      expect(SRC).toMatch(
        /bg-yellow-100 text-yellow-700 border-yellow-200[\s\S]{0,300}우선 사용/,
      );
      // duplicate "bg-yellow-50 bg-yellow-50" 패턴 부재
      expect(SRC).not.toMatch(/bg-yellow-50\s+text-yellow-700\s+border-yellow-700\s+bg-yellow-50/);
    });
  });

  describe("d-3c button 신호등 정합 — out_of_stock 위험 + low_stock 긴급", () => {
    it("button — out_of_stock 도 red 통일 (이전 blue 정정), low_stock/reorder_lead red (이전 yellow 정정)", () => {
      expect(SRC).toMatch(
        /issueType === "out_of_stock" \? "text-red-700 border-red-500\/30 hover:bg-red-50" : "text-red-700 border-red-500\/30 hover:bg-red-50"/,
      );
    });
  });

  describe("d-3d Summary cards — 만료 임박/만료 소진 spec 강화", () => {
    it('"만료 임박" cards — text-yellow-700 (이전 text-yellow-500 정합)', () => {
      expect(SRC).toMatch(
        /label:\s*"만료 임박",[\s\S]{0,200}valueClass:\s*"text-yellow-700"/,
      );
    });

    it('"만료/소진" cards — text-red-700 + border-red-200 (이전 rose-500/rose-200 정합)', () => {
      expect(SRC).toMatch(
        /label:\s*"만료\/소진",[\s\S]{0,300}valueClass:\s*"text-red-700",[\s\S]{0,80}borderClass:\s*"border-red-200"/,
      );
    });
  });

  describe("회귀 0 — 핵심 logic 보존", () => {
    it("§11.302d-3a ISSUE_CONFIG central mapping 보존", () => {
      expect(SRC).toMatch(/§11\.302d-3a/);
      expect(SRC).toMatch(/expired:[\s\S]{0,80}cls:\s*"bg-red-600 text-white"/);
    });

    it("§11.302d-4 우선 처리 배너 + §11.302d-5 요약 칩 보존", () => {
      expect(SRC).toMatch(/§11\.302d-4/);
      expect(SRC).toMatch(/§11\.302d-5/);
    });

    it("D-day color (expired red-700 / expiring yellow-700) 이미 spec 정합 — 변경 0", () => {
      expect(SRC).toMatch(
        /issueType === "expired" \? "text-red-700" : "text-yellow-700"/,
      );
    });
  });
});
