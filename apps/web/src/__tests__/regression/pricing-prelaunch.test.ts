/**
 * §pricing-prelaunch — 결제 인프라 전 "곧 출시" 모드 (호영님 2026-06-27)
 *
 * PG 미연동 → 가격·기능 노출 + 결제 대신 리드 수집. 연간은 명시 절사값(×11/12 파생 폐기).
 *   - plans.ts PLAN_PRICES_ANNUAL_MONTHLY{TEAM:79000, ORG:229000} (명시 SoT)
 *   - 연간 토글 "약 11% 할인 · 출시 후 적용" ("1개월 무료" 폐기)
 *   - 미노출(fake claim 0): "30일 무료 체험"·"자동 결제/전환"·"정기결제" (→ §billing-infrastructure 후 §basic-trial-autopay 부활)
 * (CTA "출시 알림 신청" + 리드폼은 후속 sub-batch — dead button 회피 위해 폼과 동시 land)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const PLANS = read("lib/plans.ts");
const DESC = read("lib/billing/plan-descriptor.ts");
const PRICING = read("app/pricing/page.tsx");
const SETTINGS = read("app/dashboard/settings/plans/page.tsx");

describe("§pricing-prelaunch — 연간 명시 절사값 SoT", () => {
  it("PLAN_PRICES_ANNUAL_MONTHLY TEAM 79_000 / ORG 229_000", () => {
    expect(PLANS).toMatch(/PLAN_PRICES_ANNUAL_MONTHLY\s*=\s*\{/);
    expect(PLANS).toMatch(/SubscriptionPlan\.TEAM\]:\s*79_000/);
    expect(PLANS).toMatch(/SubscriptionPlan\.ORGANIZATION\]:\s*229_000/);
  });
  it("getAnnualMonthlyPrice = 명시값 (×11/12 파생 폐기)", () => {
    expect(PLANS).toMatch(/return PLAN_PRICES_ANNUAL_MONTHLY\[plan\]/);
    expect(PLANS).not.toMatch(/PLAN_PRICES\[plan\] \* 11/);
    expect(PLANS).not.toMatch(/1 - ANNUAL_DISCOUNT_RATE/);
  });
  it("descriptor priceAnnualMonthlyKrw 파생(team/business)", () => {
    expect(DESC).toMatch(/priceAnnualMonthlyKrw:\s*number\s*\|\s*null/);
    expect(DESC).toMatch(/intent:\s*"team"[\s\S]*?priceAnnualMonthlyKrw:\s*PLAN_PRICES_ANNUAL_MONTHLY\[SubscriptionPlan\.TEAM\]/);
    expect(DESC).toMatch(/intent:\s*"business"[\s\S]*?priceAnnualMonthlyKrw:\s*PLAN_PRICES_ANNUAL_MONTHLY\[SubscriptionPlan\.ORGANIZATION\]/);
  });
});

describe("§pricing-prelaunch — 연간 토글 카피", () => {
  it("/pricing: 약 11% 할인 · 출시 후 적용 · 1개월 무료 0", () => {
    expect(PRICING).toMatch(/약 11% 할인/);
    expect(PRICING).toMatch(/출시 후 적용/);
    // §pricing-handoff D4 (호영님 2026-06-28) — 연간 할인 "1개월 무료" 프레이밍만 금지.
    //   trial "1개월 무료체험"(D4 노출, PG+trial 후속 예정)은 허용. 자동결제/정기결제 카피는 여전히 0.
    expect(PRICING).not.toMatch(/1개월 무료(?!체험)/);
    expect(PRICING).not.toMatch(/10% 할인/);
  });
  it("/pricing formatPlanPrice 연간 명시값 사용(배수 계산 폐기)", () => {
    expect(PRICING).toMatch(/priceAnnualMonthlyKrw/);
    expect(PRICING).not.toMatch(/annual \? 11 \/ 12/);
  });
  it("settings/plans: 1개월 무료 0 · 약 11% 할인", () => {
    expect(SETTINGS).not.toMatch(/1개월 무료/);
    expect(SETTINGS).toMatch(/약 11% 할인/);
  });
});

describe("§pricing-prelaunch — 미노출 (fake claim 0)", () => {
  it("/pricing + descriptor: 체험/자동결제/정기결제 카피 0", () => {
    for (const src of [PRICING, DESC]) {
      expect(src).not.toMatch(/무료 체험/);
      expect(src).not.toMatch(/자동 결제/);
      expect(src).not.toMatch(/자동 전환/);
      expect(src).not.toMatch(/정기 ?결제/);
    }
  });
  it("PO/발주 카드 카피 0 (copy-cleanup 재검증)", () => {
    expect(DESC).not.toMatch(/"PO 발행 무제한"/);
    expect(DESC).not.toMatch(/"발주 전 승인 1단계"/);
    expect(PRICING).not.toMatch(/"발주 준비·운영 큐"/);
  });
});
