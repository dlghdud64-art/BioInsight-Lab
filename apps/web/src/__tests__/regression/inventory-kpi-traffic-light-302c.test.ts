/**
 * §11.302c #inventory-kpi-traffic-light — 재고 KPI 컴팩트화 + 신호등 색상.
 *
 * 호영님 P0 (2026-05-25):
 * - KPI 3개 = 재주문 필요 / 만료 임박 / 폐기 검토 (3개 spec 정합)
 * - "전체 재고" KPI 제거, "부족/품절" → "재주문 필요" 라벨 변경,
 *   "폐기 검토" 신규 (discardCount = expiryDate < now)
 * - grid-cols-3 모바일 정합 (375px 가로 스크롤 0)
 * - 색상 토큰 신호등 체계:
 *     긴급(재주문 1건+): bg-red-100 text-red-700
 *     위험(재고 0 또는 폐기): bg-red-600 text-white
 *     검토(만료 임박 1건+): bg-yellow-100 text-yellow-700
 *     0건: bg-gray-50 text-gray-400
 *
 * Out of Scope (§11.302d 별도 batch):
 * - Badge (line 3059/3245/3687/3732) amber → 신호등 swap
 * - "긴급 재발주 필요" 안내 박스 색상
 * - LOT 상세 "위험" 배지
 * - amber/orange/brown 전면 폐지 (KPI 외 surface)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-main.tsx"),
  "utf8",
);

describe("§11.302c — 재고 KPI 컴팩트화 + 신호등 색상", () => {
  it("§11.302c trace marker", () => {
    expect(SRC).toMatch(/§11\.302c/);
  });

  describe("useMemo 계산 — 신규/제거", () => {
    it("outOfStockCount 신규 (재주문 필요 KPI 색상 분기용)", () => {
      expect(SRC).toMatch(/const outOfStockCount\s*=\s*displayInventories\.filter/);
      expect(SRC).toMatch(/inv\.currentQuantity === 0/);
    });

    it("discardCount 신규 (이미 만료된 LOT — 폐기 검토 KPI value)", () => {
      expect(SRC).toMatch(/const discardCount\s*=\s*displayInventories\.filter/);
      expect(SRC).toMatch(/expiry\.getTime\(\) < now\.getTime\(\)/);
    });

    it("totalInventoryCount 제거 (전체 재고 KPI 제거 후 orphan cleanup)", () => {
      expect(SRC).not.toMatch(/const totalInventoryCount\s*=/);
      expect(SRC).not.toMatch(/\{totalInventoryCount\}/);
    });

    it("lowOrOutOfStockCount + expiringSoonCount 보존 (회귀 0)", () => {
      expect(SRC).toMatch(/const lowOrOutOfStockCount\s*=/);
      expect(SRC).toMatch(/const expiringSoonCount\s*=/);
    });
  });

  describe("KPI 3-card grid — spec 정합", () => {
    it("grid-cols-3 모바일 정합 (grid-cols-1 sm:grid-cols-3 회귀 차단)", () => {
      expect(SRC).toMatch(/<div className="grid grid-cols-3 gap-3">/);
    });

    it('"전체 재고" KPI 카드 제거 (Package icon + bg-blue-50 회귀 차단)', () => {
      expect(SRC).not.toMatch(/text-\[11px\] font-medium text-slate-500">전체 재고/);
      // Package import 자체는 보존 — 다른 surface 에서 사용
    });

    it('"재주문 필요" 라벨 (line 1474 부근 "부족/품절" → "재주문 필요")', () => {
      expect(SRC).toMatch(/>재주문 필요</);
      expect(SRC).not.toMatch(/text-red-700\/80">부족\/품절/);
    });

    it('"폐기 검토" KPI 신규 (Trash2 icon + discardCount)', () => {
      expect(SRC).toMatch(/>폐기 검토</);
      expect(SRC).toMatch(/\{discardCount\}/);
    });
  });

  describe("신호등 색상 분기 — KPI 3개 spec literal", () => {
    it("재주문 필요: outOfStock>0 → red-600 / lowStock>0 → red-100 / 0 → gray-50", () => {
      expect(SRC).toMatch(/outOfStockCount > 0[\s\S]{0,80}border-red-700 bg-red-600 text-white/);
      expect(SRC).toMatch(/lowOrOutOfStockCount > 0[\s\S]{0,80}border-red-200 bg-red-100 text-red-700/);
      expect(SRC).toMatch(/border-gray-200 bg-gray-50 text-gray-400/);
    });

    it("만료 임박: expiringSoon>0 → yellow-100 / 0 → gray-50", () => {
      expect(SRC).toMatch(/expiringSoonCount > 0[\s\S]{0,80}border-yellow-200 bg-yellow-100 text-yellow-700/);
    });

    it("폐기 검토: discardCount>0 → red-600 (이미 만료 즉시 위험) / 0 → gray-50", () => {
      expect(SRC).toMatch(/discardCount > 0[\s\S]{0,80}border-red-700 bg-red-600 text-white/);
    });

    it("amber/orange/brown 토큰 KPI 카드 부재 (전면 폐지 — §11.302c scope)", () => {
      // KPI block (grid grid-cols-3 ... </div>) 안에 amber/orange/brown 0.
      // 다른 surface (Badge 등) 의 amber 는 §11.302d 별도 batch.
      const kpiBlockMatch = SRC.match(/<div className="grid grid-cols-3 gap-3">[\s\S]{0,3500}?<\/div>\s*\n\s*<\/div>/);
      expect(kpiBlockMatch).toBeTruthy();
      const kpiBlock = kpiBlockMatch?.[0] ?? "";
      expect(kpiBlock).not.toMatch(/bg-amber|text-amber|bg-orange|text-orange|bg-brown|text-brown/);
    });
  });
});
