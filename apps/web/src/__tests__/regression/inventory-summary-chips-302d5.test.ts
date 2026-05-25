/**
 * §11.302d-5 #inventory-summary-chips — 요약 칩 색상 의미 역전 정정 +
 *   "전체 재고" 칩 §11.302c 정합 제거.
 *
 * 호영님 §11.302c (KPI 카드) + §11.302d-4 (우선 처리 배너) 후속:
 *   inventory-content.tsx line 2070-2094 요약 칩의 색상 의미 역전:
 *     "만료 임박" → red (잘못, 검토 yellow 가 맞음)
 *     "부족/품절" → yellow (잘못, 긴급 red 가 맞음)
 *   + "전체 재고" 칩 — §11.302c 에서 KPI "전체 재고" 제거 정합으로
 *     함께 제거 (totalInventoryCount orphan cleanup)
 *
 * Fix:
 *   "만료 임박" → text-yellow-700 + bg-yellow-100 + border-yellow-200 (검토)
 *   "재주문 필요" (이전 "부족/품절") → text-red-700 + bg-red-100 +
 *     border-red-200 (긴급, §11.302c KPI 라벨 정합)
 *   "전체 재고" 칩 + totalInventoryCount useMemo 제거
 *
 * Out of Scope (§11.302d-3 별도 batch):
 *   inventory-content.tsx 그 외 amber/yellow ~17 곳 (line 1092/1097/
 *     1560/1579/2164/2194/2198/2201/2212/2241/2429/2430 등)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.302d-5 — 요약 칩 신호등 색상 정합 + 전체 재고 제거", () => {
  it("§11.302d-5 trace marker", () => {
    expect(SRC).toMatch(/§11\.302d-5/);
  });

  describe("요약 칩 색상 의미 역전 정정", () => {
    it('"만료 임박" 칩 — text-yellow-700 + bg-yellow-100 + border-yellow-200 (검토)', () => {
      expect(SRC).toMatch(
        /label:\s*"만료 임박",[\s\S]{0,200}color:\s*"text-yellow-700",[\s\S]{0,80}bg:\s*"bg-yellow-100 border-yellow-200"/,
      );
    });

    it('"재주문 필요" 칩 (이전 "부족/품절") — text-red-700 + bg-red-100 + border-red-200 (긴급, §11.302c KPI 라벨 정합)', () => {
      expect(SRC).toMatch(
        /label:\s*"재주문 필요",[\s\S]{0,200}color:\s*"text-red-700",[\s\S]{0,80}bg:\s*"bg-red-100 border-red-200"/,
      );
    });

    it('"부족/품절" 라벨 제거 (재주문 필요로 swap)', () => {
      // 요약 칩 array 안에 "부족/품절" 라벨 부재
      expect(SRC).not.toMatch(/label:\s*"부족\/품절"/);
    });
  });

  describe('"전체 재고" 칩 + totalInventoryCount 제거 (§11.302c 정합)', () => {
    it('"전체 재고" 칩 라벨 부재', () => {
      // 요약 칩 array 안에 "전체 재고" 라벨 부재 (§11.302c KPI 정합)
      expect(SRC).not.toMatch(/label:\s*"전체 재고"/);
    });

    it("totalInventoryCount useMemo 제거 (orphan cleanup)", () => {
      expect(SRC).not.toMatch(/const totalInventoryCount\s*=/);
      expect(SRC).not.toMatch(/\{totalInventoryCount\}/);
    });
  });

  describe("회귀 0 — 우선 처리 배너 (§11.302d-4) + 핵심 logic 보존", () => {
    it("우선 처리 배너 (§11.302d-4) 색상 정합 보존", () => {
      expect(SRC).toMatch(/§11\.302d-4/);
      expect(SRC).toMatch(/expiringSoonCount > 0 \? "border-yellow-200 bg-yellow-100"/);
      expect(SRC).toMatch(/lowOrOutOfStockCount > 0 \? "border-red-200 bg-red-100"/);
    });

    it("lowOrOutOfStockCount + expiringSoonCount useMemo 보존", () => {
      expect(SRC).toMatch(/const lowOrOutOfStockCount\s*=/);
      expect(SRC).toMatch(/const expiringSoonCount\s*=/);
    });

    it("요약 칩 map 구조 보존 (inline-flex + chip.bg + chip.color)", () => {
      expect(SRC).toMatch(/chip\.bg/);
      expect(SRC).toMatch(/chip\.color/);
      expect(SRC).toMatch(/\{chip\.label\}/);
      expect(SRC).toMatch(/\{chip\.value\}/);
    });
  });
});
