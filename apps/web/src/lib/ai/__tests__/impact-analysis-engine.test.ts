// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Impact Analysis Engine tests
 *
 * 결정론적 시뮬레이션 contract 검증.
 * - canonical truth mutation 없음 (입력 객체 동일성 유지)
 * - before/after snapshot 정확성
 * - severity 분기 정확성
 */

import { describe, it, expect } from "vitest";
import {
  simulateOrderImpact,
  type ImpactAnalysisInput,
} from "../impact-analysis-engine";

const FIXED_DATE = "2026-04-08T00:00:00Z";

function makeBudget(overrides: Partial<NonNullable<ImpactAnalysisInput["budget"]>> = {}) {
  return {
    budgetId: "b1",
    budgetName: "연구 시약 예산",
    total: 50_000_000,
    spent: 30_000_000,
    committed: 5_000_000,
    periodEndDate: "2026-06-30",
    averageMonthlyBurn: 10_000_000,
    ...overrides,
  };
}

function makeInput(overrides: Partial<ImpactAnalysisInput> = {}): ImpactAnalysisInput {
  return {
    orderId: "ord_1",
    itemName: "FBS",
    orderAmount: 1_000_000,
    budget: makeBudget(),
    inventory: null,
    evaluationDate: FIXED_DATE,
    ...overrides,
  };
}

describe("simulateOrderImpact", () => {
  it("R1: 정상 범위 발주 — before/after snapshot 정확", () => {
    const sim = simulateOrderImpact(makeInput());

    expect(sim.budget).not.toBeNull();
    const b = sim.budget!;
    expect(b.before.available).toBe(15_000_000); // 50M - 30M - 5M
    expect(b.after.available).toBe(14_000_000); // -1M order
    expect(b.availableDelta).toBe(-1_000_000);
    expect(b.before.utilizationPercent).toBe(70);
    expect(b.after.utilizationPercent).toBe(72);
    expect(b.depletionAdvancedDays).toBeGreaterThanOrEqual(0);
    expect(sim.summary.severity === "ok" || sim.summary.severity === "review").toBe(true);
  });

  it("R2: input 객체 mutation 없음 (canonical truth 보호)", () => {
    const input = makeInput();
    const snapshot = JSON.parse(JSON.stringify(input));
    simulateOrderImpact(input);
    expect(input).toEqual(snapshot);
  });

  it("R3: 발주 금액이 예산 초과 → severity=blocked + after.available=0", () => {
    const sim = simulateOrderImpact(makeInput({ orderAmount: 100_000_000 }));
    expect(sim.budget!.after.available).toBe(0);
    expect(sim.summary.severity).toBe("blocked");
  });

  it("R4: 위험 등급 상승 시 riskEscalated=true + severity=review 이상", () => {
    // before utilization 70% (warning), after >= 80% (critical)
    const sim = simulateOrderImpact(
      makeInput({
        budget: makeBudget({ spent: 35_000_000, committed: 5_000_000 }), // before=80% critical
        orderAmount: 5_000_000, // after=90% critical (no escalation)
      }),
    );
    // 위 케이스는 same critical → no escalation; 별도 케이스로 검증
    const sim2 = simulateOrderImpact(
      makeInput({
        budget: makeBudget({ spent: 25_000_000, committed: 4_000_000 }), // 58% safe
        orderAmount: 2_000_000, // after = 62% warning
      }),
    );
    expect(sim2.budget!.riskBefore).toBe("safe");
    expect(sim2.budget!.riskAfter).toBe("warning");
    expect(sim2.budget!.riskEscalated).toBe(true);
    expect(sim2.summary.severity).toBe("review");
  });

  it("R5: 결정론성 — 동일 입력 → 동일 출력", () => {
    const a = simulateOrderImpact(makeInput());
    const b = simulateOrderImpact(makeInput());
    expect(a.budget).toEqual(b.budget);
    expect(a.summary).toEqual(b.summary);
  });

  it("R6: budget=null 이면 budget snapshot 생략, severity 정상", () => {
    const sim = simulateOrderImpact(makeInput({ budget: null }));
    expect(sim.budget).toBeNull();
    expect(sim.summary.severity).toBe("ok");
  });

  it("R7: 재고 분석 — 발주 수령 시 재주문 임계 회복", () => {
    const sim = simulateOrderImpact(
      makeInput({
        inventory: {
          itemId: "i1",
          currentStock: 2,
          dailyConsumption: 0.5,
          reorderPoint: 5,
          incomingQuantity: 10,
        },
      }),
    );
    expect(sim.inventory).not.toBeNull();
    expect(sim.inventory!.before.belowReorderPoint).toBe(true);
    expect(sim.inventory!.after.belowReorderPoint).toBe(false);
    expect(sim.inventory!.after.daysOfSupply).toBeGreaterThan(sim.inventory!.before.daysOfSupply);
  });

  it("R8: depletionAdvancedDays는 0 이상 (역행 금지)", () => {
    const sim = simulateOrderImpact(makeInput());
    expect(sim.budget!.depletionAdvancedDays).toBeGreaterThanOrEqual(0);
  });

  it("R9: summary.bulletPoints는 비어있지 않음 (UI에 noop 카드 렌더 방지)", () => {
    const sim = simulateOrderImpact(makeInput());
    expect(sim.summary.bulletPoints.length).toBeGreaterThan(0);
    expect(sim.summary.headline).toContain("FBS");
  });
});
