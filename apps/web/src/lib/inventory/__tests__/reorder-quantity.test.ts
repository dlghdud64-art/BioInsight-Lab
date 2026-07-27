import { describe, it, expect } from "vitest";
import { computeReorderRecommendation } from "@/lib/inventory/reorder-quantity";

/**
 * §inventory-delta-label-kpi Phase 1 — 재발주 권장수량 canonical 산식 unit.
 * 핸드오프 §1: 권장 = 안전재고 갭 + 납기중 소진(리드타임 × 일소진) → MOQ 반올림.
 */

describe("computeReorderRecommendation — 근거 3항 분해", () => {
  it("갭 + 납기중 소진 합산 (MOQ=1)", () => {
    // gap = max(0, 20-5)=15, lead consumption = ceil(2*7)=14, raw=29
    const r = computeReorderRecommendation({
      currentQuantity: 5,
      safetyStock: 20,
      dailyUsage: 2,
      leadTimeDays: 7,
      minOrderQty: 1,
    });
    expect(r.breakdown.safetyGap).toBe(15);
    expect(r.breakdown.leadTimeConsumption).toBe(14);
    expect(r.breakdown.rawQuantity).toBe(29);
    expect(r.recommendedQuantity).toBe(29);
  });

  it("갭만 (소진 데이터 없음 → leadTimeConsumption 0)", () => {
    const r = computeReorderRecommendation({
      currentQuantity: 3,
      safetyStock: 10,
      dailyUsage: 0,
      leadTimeDays: 7,
      minOrderQty: 1,
    });
    expect(r.breakdown.safetyGap).toBe(7);
    expect(r.breakdown.leadTimeConsumption).toBe(0);
    expect(r.recommendedQuantity).toBe(7);
  });

  it("납기중 소진만 (안전재고 이미 충족 → 갭 0)", () => {
    // current 30 > safety 20 → gap 0. lead = ceil(1.5*10)=15
    const r = computeReorderRecommendation({
      currentQuantity: 30,
      safetyStock: 20,
      dailyUsage: 1.5,
      leadTimeDays: 10,
      minOrderQty: 1,
    });
    expect(r.breakdown.safetyGap).toBe(0);
    expect(r.breakdown.leadTimeConsumption).toBe(15);
    expect(r.recommendedQuantity).toBe(15);
  });
});

describe("computeReorderRecommendation — MOQ 반올림", () => {
  it("MOQ 배수로 올림 (raw 29, MOQ 10 → 30)", () => {
    const r = computeReorderRecommendation({
      currentQuantity: 5,
      safetyStock: 20,
      dailyUsage: 2,
      leadTimeDays: 7,
      minOrderQty: 10,
    });
    expect(r.breakdown.rawQuantity).toBe(29);
    expect(r.breakdown.minOrderQty).toBe(10);
    expect(r.recommendedQuantity).toBe(30);
  });

  it("raw가 MOQ 미만이어도 최소 1 MOQ 보장 (raw 3, MOQ 25 → 25)", () => {
    const r = computeReorderRecommendation({
      currentQuantity: 8,
      safetyStock: 10,
      dailyUsage: 0,
      leadTimeDays: 0,
      minOrderQty: 25,
    });
    expect(r.breakdown.rawQuantity).toBe(2);
    expect(r.recommendedQuantity).toBe(25);
  });

  it("raw가 MOQ 정확 배수 (raw 20, MOQ 10 → 20, 초과 올림 없음)", () => {
    const r = computeReorderRecommendation({
      currentQuantity: 0,
      safetyStock: 20,
      dailyUsage: 0,
      leadTimeDays: 0,
      minOrderQty: 10,
    });
    expect(r.breakdown.rawQuantity).toBe(20);
    expect(r.recommendedQuantity).toBe(20);
  });
});

describe("computeReorderRecommendation — 방어(null·음수·비정상)", () => {
  it("safetyStock/dailyUsage/leadTime null → 0 취급, MOQ null → 1", () => {
    const r = computeReorderRecommendation({
      currentQuantity: 0,
      safetyStock: null,
      dailyUsage: null,
      leadTimeDays: null,
      minOrderQty: null,
    });
    expect(r.breakdown.safetyGap).toBe(0);
    expect(r.breakdown.leadTimeConsumption).toBe(0);
    expect(r.breakdown.minOrderQty).toBe(1);
    // 재발주 필요 게이트 통과 품목이므로 최소 1
    expect(r.recommendedQuantity).toBe(1);
  });

  it("음수 MOQ → 1 취급", () => {
    const r = computeReorderRecommendation({
      currentQuantity: 5,
      safetyStock: 10,
      dailyUsage: 0,
      leadTimeDays: 0,
      minOrderQty: -5,
    });
    expect(r.breakdown.minOrderQty).toBe(1);
    expect(r.recommendedQuantity).toBe(5);
  });

  it("소수 일소진 올림 (ceil) — 0.3×7=2.1 → 3", () => {
    const r = computeReorderRecommendation({
      currentQuantity: 100,
      safetyStock: 0,
      dailyUsage: 0.3,
      leadTimeDays: 7,
      minOrderQty: 1,
    });
    expect(r.breakdown.leadTimeConsumption).toBe(3);
  });
});
