/**
 * §pricing-sot-unify-p4 — 가격 단일 SoT 일원화 (호영님 2026-06-27)
 *
 * 가격 89k/259k 이 PLAN_PRICES · PLAN_DISPLAY · descriptor.priceMonthlyKrw 3곳에 수기 중복돼 있던 것을
 * PLAN_PRICES 단일 SoT 에서 파생하도록 정리. 값 불변(89k/259k) — 표시·결제 영향 0.
 *   - plans.ts PLAN_DISPLAY TEAM/ORG: monthlyPrice·priceDisplay = PLAN_PRICES 파생(수기 리터럴 0)
 *   - plan-descriptor.ts priceMonthlyKrw: PLAN_PRICES 파생(수기 89000/259000 리터럴 0)
 * 런타임 값(89000/259000)은 plan-descriptor.test 의 toBe() 가 계속 강제(이 sentinel 은 "리터럴 0 + 파생 배선"만).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const PLANS = read("lib/plans.ts");
const DESC = read("lib/billing/plan-descriptor.ts");

describe("§pricing-sot-unify-p4 — formatter + SoT", () => {
  it("formatKrwMonthly 헬퍼 export (priceDisplay 파생용)", () => {
    expect(PLANS).toMatch(/export function formatKrwMonthly/);
  });
  it("PLAN_PRICES 단일 정의(TEAM 89_000 / ORG 259_000) 보존", () => {
    expect(PLANS).toMatch(/SubscriptionPlan\.TEAM\]: 89_000/);
    expect(PLANS).toMatch(/SubscriptionPlan\.ORGANIZATION\]: 259_000/);
  });
});

describe("§pricing-sot-unify-p4 — PLAN_DISPLAY 파생(수기 리터럴 0)", () => {
  it("TEAM/ORG monthlyPrice = PLAN_PRICES 파생", () => {
    expect(PLANS).toMatch(/monthlyPrice:\s*PLAN_PRICES\[SubscriptionPlan\.TEAM\]/);
    expect(PLANS).toMatch(/monthlyPrice:\s*PLAN_PRICES\[SubscriptionPlan\.ORGANIZATION\]/);
  });
  it("TEAM/ORG priceDisplay = formatKrwMonthly(PLAN_PRICES) 파생", () => {
    expect(PLANS).toMatch(/priceDisplay:\s*formatKrwMonthly\(PLAN_PRICES\[SubscriptionPlan\.TEAM\]\)/);
    expect(PLANS).toMatch(/priceDisplay:\s*formatKrwMonthly\(PLAN_PRICES\[SubscriptionPlan\.ORGANIZATION\]\)/);
  });
  it("PLAN_DISPLAY 수기 가격 리터럴 0 (monthlyPrice: 89_000 / priceDisplay \"₩…/월\")", () => {
    expect(PLANS).not.toMatch(/monthlyPrice:\s*89_?000/);
    expect(PLANS).not.toMatch(/monthlyPrice:\s*259_?000/);
    expect(PLANS).not.toMatch(/priceDisplay:\s*"₩89,000\/월"/);
    expect(PLANS).not.toMatch(/priceDisplay:\s*"₩259,000\/월"/);
  });
  it("FREE 무료 표기 보존", () => {
    expect(PLANS).toMatch(/priceDisplay:\s*"무료"/);
  });
});

describe("§pricing-sot-unify-p4 — descriptor priceMonthlyKrw 파생", () => {
  it("team/business priceMonthlyKrw = PLAN_PRICES 파생", () => {
    expect(DESC).toMatch(/intent:\s*"team"[\s\S]*?priceMonthlyKrw:\s*PLAN_PRICES\[SubscriptionPlan\.TEAM\]/);
    expect(DESC).toMatch(/intent:\s*"business"[\s\S]*?priceMonthlyKrw:\s*PLAN_PRICES\[SubscriptionPlan\.ORGANIZATION\]/);
  });
  it("descriptor 수기 가격 리터럴 0 (priceMonthlyKrw: 89000/259000)", () => {
    expect(DESC).not.toMatch(/priceMonthlyKrw:\s*89000/);
    expect(DESC).not.toMatch(/priceMonthlyKrw:\s*259000/);
  });
  it("PLAN_PRICES/SubscriptionPlan import (단방향, plans.ts SoT)", () => {
    expect(DESC).toMatch(/import\s*\{[^}]*PLAN_PRICES[^}]*\}\s*from\s*"@\/lib\/plans"/);
  });
});
