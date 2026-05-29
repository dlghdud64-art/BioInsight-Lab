/**
 * §11.318 Phase 1d-1 (RED) — compare-analysis 환각 억제 데이터 게이트
 *
 * canonical 표면 = /app/search 워크벤치(comparison-modal → /api/ai/compare-analysis).
 * 환각 출처 = 데이터 없어도 cost/balanced/speed 3 시나리오 생성(Gemini + buildLocalAnalysis).
 *
 * 호영님 확정 경계(2026-05-30):
 *   ① 시나리오 생성 = "해당 축(가격/납기) 데이터를 가진 제품이 2개 이상"일 때만.
 *      비교는 같은 축 2개 이상이어야 의미 있음. 1개만 있으면 비교 불가 → 억제.
 *   ② null/undefined = "없음". 숫자값 = "있음".
 *      가격 0/음수 = 비정상 → "없음"(제외). 납기 0일 = 당일납품 → "있음"(유효).
 *
 * 순수 함수 — 구현 전이므로 import 실패 = RED.
 */
import { describe, it, expect } from "vitest";
import {
  assessAnalysisDataAvailability,
  parseLeadDays,
  type AnalysisProductInput,
} from "../compare-analysis-data-gate";

function prod(over: Partial<AnalysisProductInput> = {}): AnalysisProductInput {
  return { id: "p", name: "Product", price: null, leadTime: null, ...over };
}

describe("§11.318 1d-1 — parseLeadDays (경계 ②)", () => {
  it("null/빈/미확인 → null", () => {
    expect(parseLeadDays(null)).toBeNull();
    expect(parseLeadDays("")).toBeNull();
    expect(parseLeadDays("납기 미확인")).toBeNull();
  });
  it("'5일' → 5, '0일' → 0(당일납품 유효)", () => {
    expect(parseLeadDays("5일")).toBe(5);
    expect(parseLeadDays("2~3영업일")).toBe(2);
    expect(parseLeadDays("0일")).toBe(0);
  });
});

describe("§11.318 1d-1 — 경계 ① 축당 데이터 2개 이상", () => {
  it("가격 2개 → cost_first 허용", () => {
    const a = assessAnalysisDataAvailability([
      prod({ id: "a", price: 18000 }),
      prod({ id: "b", price: 21000 }),
    ]);
    expect(a.countPrice).toBe(2);
    expect(a.hasComparablePrice).toBe(true);
    expect(a.allowedScenarios).toContain("cost_first");
    expect(a.suppressed).toBe(false);
  });

  it("가격 1개만 → cost_first 억제(비교 불가), 다른 축 없으면 suppressed", () => {
    const a = assessAnalysisDataAvailability([
      prod({ id: "a", price: 18000 }),
      prod({ id: "b", price: null }),
    ]);
    expect(a.countPrice).toBe(1);
    expect(a.hasComparablePrice).toBe(false);
    expect(a.allowedScenarios).not.toContain("cost_first");
    expect(a.suppressed).toBe(true);
  });

  it("가격 0개 → cost_first 억제", () => {
    const a = assessAnalysisDataAvailability([prod({ id: "a" }), prod({ id: "b" })]);
    expect(a.hasComparablePrice).toBe(false);
    expect(a.allowedScenarios).not.toContain("cost_first");
    expect(a.suppressed).toBe(true);
    expect(a.reason).toMatch(/데이터|부족|비교/);
  });

  it("납기 2개 → speed_first 허용", () => {
    const a = assessAnalysisDataAvailability([
      prod({ id: "a", leadTime: "5일" }),
      prod({ id: "b", leadTime: "3일" }),
    ]);
    expect(a.countLead).toBe(2);
    expect(a.hasComparableLead).toBe(true);
    expect(a.allowedScenarios).toContain("speed_first");
  });

  it("가격 2 + 납기 2 → balanced 포함 3개 모두 허용", () => {
    const a = assessAnalysisDataAvailability([
      prod({ id: "a", price: 18000, leadTime: "5일" }),
      prod({ id: "b", price: 21000, leadTime: "3일" }),
    ]);
    expect(a.allowedScenarios).toEqual(
      expect.arrayContaining(["cost_first", "balanced", "speed_first"]),
    );
    expect(a.suppressed).toBe(false);
  });

  it("가격 1 + 납기 1(서로 다른 제품, 각 1개씩) → 둘 다 축 2개 미만 → suppressed", () => {
    const a = assessAnalysisDataAvailability([
      prod({ id: "a", price: 18000, leadTime: null }),
      prod({ id: "b", price: null, leadTime: "3일" }),
    ]);
    expect(a.hasComparablePrice).toBe(false);
    expect(a.hasComparableLead).toBe(false);
    expect(a.allowedScenarios).toHaveLength(0);
    expect(a.suppressed).toBe(true);
  });
});

describe("§11.318 1d-1 — 경계 ② null/0/음수", () => {
  it("가격 0/음수 = 비정상 → '없음'(제외)", () => {
    const a = assessAnalysisDataAvailability([
      prod({ id: "a", price: 0 }),
      prod({ id: "b", price: -100 }),
    ]);
    expect(a.countPrice).toBe(0);
    expect(a.hasComparablePrice).toBe(false);
    expect(a.allowedScenarios).not.toContain("cost_first");
  });

  it("납기 0일 = 당일납품 → '있음'(유효), 2개면 speed_first 허용", () => {
    const a = assessAnalysisDataAvailability([
      prod({ id: "a", leadTime: "0일" }),
      prod({ id: "b", leadTime: "0일" }),
    ]);
    expect(a.countLead).toBe(2);
    expect(a.hasComparableLead).toBe(true);
    expect(a.allowedScenarios).toContain("speed_first");
  });

  it("가격 양수면 '있음'으로 카운트", () => {
    const a = assessAnalysisDataAvailability([
      prod({ id: "a", price: 1 }),
      prod({ id: "b", price: 100000 }),
    ]);
    expect(a.countPrice).toBe(2);
    expect(a.hasComparablePrice).toBe(true);
  });
});
