/**
 * §pricing-refresh P1 (PLAN_pricing-refresh) — Free 한도 확정값(canonical plans.ts)
 *
 * 호영님 2026-06-18 확정: 사용자 1 / RFQ 3 / 재고 10. + §pricing-redesign(2026-06-27):
 *   PO 한도 field 폐기 · Basic 멤버 3 · Pro 재고 200 · 라벨스캔/추적모드 신규 · 가격 89k/259k.
 *   - RFQ 5 → 3 (조이기). 사용자(maxMembers 1)·재고(maxItems 10)는 현행 유지.
 *   - 실제 enforce 는 P2(현재 enforce 0 = 광고-only fake → P2 에서 차단 실구현).
 *   - 유료 플랜(TEAM/ORG) 한도 무변경(Free 한정).
 * 각 값은 FREE 고유(TEAM/ORG 는 null/다른 값)라 단순 매칭으로 FREE 식별 가능.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PLANS = readFileSync(
  join(__dirname, "..", "..", "lib/plans.ts"),
  "utf8",
);

describe("§pricing-refresh P1 — Free 한도 확정값", () => {
  it("RFQ 3 (5→3 조이기)", () => {
    expect(PLANS).toMatch(/maxQuotesPerMonth: 3/);
  });
  it("사용자 1 · 재고 10 (현행 유지)", () => {
    expect(PLANS).toMatch(/maxMembers: 1,/);
    expect(PLANS).toMatch(/maxItems: 10,/);
  });
  it("구 값(Free RFQ 5) 잔재 0", () => {
    expect(PLANS).not.toMatch(/maxQuotesPerMonth: 5/);
  });
  // §pricing-redesign (호영님 2026-06-27) — maxPurchaseOrdersPerMonth field 완전 폐기.
  it("PO 한도 field 완전 제거 (maxPurchaseOrdersPerMonth 잔재 0)", () => {
    expect(PLANS).not.toMatch(/maxPurchaseOrdersPerMonth/);
  });
});

describe("§pricing-redesign P1 — 유료 플랜 한도 (호영님 2026-06-27)", () => {
  it("견적 무제한(null) 보존", () => {
    expect(PLANS).toMatch(/maxQuotesPerMonth: null/);
  });
  it("Basic(TEAM) 멤버 3 · 재고 50", () => {
    expect(PLANS).toMatch(/maxMembers: 3,/);
    expect(PLANS).toMatch(/maxItems: 50,/);
  });
  it("Pro(ORG) 재고 200(null→200) · 멤버 10", () => {
    expect(PLANS).toMatch(/maxItems: 200,/);
    expect(PLANS).toMatch(/maxMembers: 10,/);
  });
});

describe("§pricing-redesign P1 — 신규 entitlement field + 가격/연간", () => {
  it("maxLabelScansPerMonth — Free 10 / 이상 null", () => {
    expect(PLANS).toMatch(/maxLabelScansPerMonth: 10/);
    expect(PLANS).toMatch(/maxLabelScansPerMonth: null/);
  });
  it("allowedTrackingModes — Free/Basic QUANTITY · Pro +LOT/GMP_STRICT", () => {
    expect(PLANS).toMatch(/allowedTrackingModes: \["QUANTITY"\]/);
    expect(PLANS).toMatch(/allowedTrackingModes: \["QUANTITY", "LOT", "GMP_STRICT"\]/);
  });
  // §pricing-prelaunch (호영님 2026-06-27) — 연간 = 명시 절사값(79k/229k), ×11/12 파생 폐기.
  it("가격 89k/259k · 연간 명시 79k/229k(약 11%)", () => {
    expect(PLANS).toMatch(/SubscriptionPlan\.TEAM\]: 89_000/);
    expect(PLANS).toMatch(/SubscriptionPlan\.ORGANIZATION\]: 259_000/);
    expect(PLANS).toMatch(/PLAN_PRICES_ANNUAL_MONTHLY/);
    expect(PLANS).toMatch(/SubscriptionPlan\.TEAM\]: 79_000/);
    expect(PLANS).toMatch(/SubscriptionPlan\.ORGANIZATION\]: 229_000/);
    expect(PLANS).not.toMatch(/ANNUAL_DISCOUNT_RATE/);
    expect(PLANS).not.toMatch(/PLAN_PRICES\[plan\] \* 11/);
  });
});
