/**
 * §11.302d-1 #inventory-badge-traffic-light — inventory-main.tsx 4 Badge
 *   amber → 신호등 spec 색상 swap (호영님 권장대로 진행).
 *
 * 호영님 Q3=B 결정 §11.302c 후속:
 *   §11.302c (KPI 카드) 완료 후 Badge / 안내 박스 별도 batch.
 *   §11.302d-1 = inventory-main.tsx 4 Badge 만 (5 곳 중 "설정 필요" 1
 *   곳은 호영님 spec 외 utility 으로 보존).
 *
 * 4 Badge swap:
 *   line 1748 "우선 사용" (expiring) → 검토 yellow-100 + yellow-200 border
 *   line 3100 "재고 부족" (isLowStock) → 긴급 red-100 + red-200 + dot=red
 *   line 3286 "재고 부족" (isLowStock !out !restock) → 긴급 red-100
 *   line 3728 "부족" (isLowStock !out) → 긴급 red-100 + dot=red
 *
 * 1 Badge 보존:
 *   line 3773 "설정 필요" (isLocationMissing) — 호영님 spec scope 외
 *   utility, yellow 유지 (canonical 일관성)
 *
 * Out of Scope (별도 batch):
 *   §11.302d-2: inventory-main 그 외 yellow (line 1631/1672 conditional,
 *     line 1890 임박 Lot KPI)
 *   §11.302d-3: inventory-content.tsx amber/yellow 20+ 곳
 *   §11.302d-4: "긴급 재발주 필요" 안내 박스 (inventory-content line
 *     2036/2102)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-main.tsx"),
  "utf8",
);

describe("§11.302d-1 — inventory-main Badge 4 곳 신호등 swap", () => {
  it("§11.302d-1 trace marker", () => {
    expect(SRC).toMatch(/§11\.302d-1/);
  });

  describe("Badge swap — 긴급 (red-100) × 3", () => {
    it('"재고 부족" Badge (line 3100 부근) — bg-red-100 text-red-700 dot=red', () => {
      // mt-1 attribute 으로 line 3100 Badge 식별
      expect(SRC).toMatch(
        /<Badge variant="outline" dot="red" className="mt-1 bg-red-100 text-red-700 border-red-200 text-\[11px\]">\s*재고 부족/,
      );
    });

    it('"재고 부족" Badge (line 3286 부근, restock 미요청) — bg-red-100 text-red-700 dot=red', () => {
      expect(SRC).toMatch(
        /<Badge variant="outline" dot="red" className="bg-red-100 text-red-700 border-red-200">\s*재고 부족/,
      );
    });

    it('"부족" Badge (line 3728 부근, !out) — bg-red-100 text-red-700 dot=red', () => {
      expect(SRC).toMatch(
        /<Badge variant="outline" dot="red" className="flex-shrink-0 bg-red-100 text-red-700 border-red-200">\s*부족/,
      );
    });
  });

  describe("Badge swap — 검토 (yellow-100) × 1", () => {
    it('"우선 사용" Badge (line 1748 부근, expiring) — bg-yellow-100 text-yellow-700 border-yellow-200', () => {
      expect(SRC).toMatch(
        /bg-yellow-100 text-yellow-700 border-yellow-200[\s\S]{0,200}우선 사용/,
      );
    });
  });

  describe("Badge 보존 — 호영님 spec 외 utility", () => {
    it('"설정 필요" Badge (line 3773 부근, isLocationMissing) — yellow 보존', () => {
      // 호영님 spec scope 외 utility — yellow 유지
      expect(SRC).toMatch(
        /<Badge variant="outline" dot="amber" className="bg-yellow-50 text-yellow-700 border-yellow-700 text-\[11px\]">\s*설정 필요/,
      );
    });
  });

  describe("회귀 0 — amber Badge dot trigger 제거 확인", () => {
    it('"재고 부족" Badge 에 dot="amber" 부재 (긴급 swap 완료)', () => {
      // "재고 부족" 라벨 Badge 가 dot="amber" 와 동일 line 에 0
      expect(SRC).not.toMatch(/dot="amber"[\s\S]{0,200}재고 부족/);
      expect(SRC).not.toMatch(/dot="amber"[\s\S]{0,200}\s+부족\s+/);
    });

    it("KPI 3-card (§11.302c) 보존 — grid-cols-3 + outOfStockCount + discardCount", () => {
      expect(SRC).toMatch(/<div className="grid grid-cols-3 gap-3">/);
      expect(SRC).toMatch(/const outOfStockCount\s*=/);
      expect(SRC).toMatch(/const discardCount\s*=/);
    });
  });
});
