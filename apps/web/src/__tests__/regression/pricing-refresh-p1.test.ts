/**
 * §pricing-refresh P1 (PLAN_pricing-refresh) — Free 한도 확정값(canonical plans.ts)
 *
 * 호영님 2026-06-18 확정: 사용자 1 / RFQ 3 / PO 3 / 재고 10 / 보존 3개월 / AI 없음.
 *   - RFQ·PO 5 → 3 (조이기). 사용자(maxMembers 1)·재고(maxItems 10)는 현행 유지.
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
  it("RFQ·PO 3 (5→3 조이기)", () => {
    expect(PLANS).toMatch(/maxQuotesPerMonth: 3/);
    expect(PLANS).toMatch(/maxPurchaseOrdersPerMonth: 3/);
  });
  it("사용자 1 · 재고 10 (현행 유지)", () => {
    expect(PLANS).toMatch(/maxMembers: 1,/);
    expect(PLANS).toMatch(/maxItems: 10,/);
  });
  it("구 값(Free RFQ·PO 5) 잔재 0", () => {
    // FREE 블록의 5 표기 제거 확인(TEAM maxItems 50·maxMembers 5 는 별개라 무관).
    expect(PLANS).not.toMatch(/maxQuotesPerMonth: 5/);
    expect(PLANS).not.toMatch(/maxPurchaseOrdersPerMonth: 5/);
  });
});

describe("§pricing-refresh P1 — 회귀 0(유료 플랜 무변경)", () => {
  it("TEAM/ORG 무제한(null) 보존", () => {
    expect(PLANS).toMatch(/maxQuotesPerMonth: null/);
    expect(PLANS).toMatch(/maxPurchaseOrdersPerMonth: null/);
  });
  it("TEAM 멤버 5 · 재고 50 보존", () => {
    expect(PLANS).toMatch(/maxMembers: 5,/);
    expect(PLANS).toMatch(/maxItems: 50,/);
  });
});
