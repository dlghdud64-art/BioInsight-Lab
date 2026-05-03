/**
 * §11.201 #pricing-operating-volume-redefine — Phase 1 RED test
 *
 * `lib/billing/plan-descriptor.ts` 의 single source of truth 강제.
 * 4 PlanIntent (starter/team/business/enterprise) × 7+ field 매트릭스 검증.
 *
 * lock §11.142 호환:
 *   - canonical SubscriptionPlan enum 변경 0 (display layer 만)
 *   - dead checkout 0 (CTA route alive)
 *   - fake "AI 무제한" 0
 *   - LabOps Credit display only (실 차감 §11.202 defer)
 */

import { describe, it, expect } from "vitest";
import {
  PLAN_DESCRIPTOR,
  getPlanDescriptor,
  getPlanLabel,
  getPlanPriceMonthly,
  getPlanCreditQuota,
  LABOPS_CREDIT_USAGE_SCENARIOS,
  LABOPS_CREDIT_PROTECTED_SCENARIOS,
  type PlanDescriptor,
} from "@/lib/billing/plan-descriptor";
import { PLAN_INTENT_VALUES, type PlanIntent } from "@/lib/billing/plan-select";

describe("§11.201 plan-descriptor — enum coverage + 한국어 라벨", () => {
  it("PLAN_DESCRIPTOR 가 모든 PlanIntent 4 값 매핑 (enum coverage 100%)", () => {
    for (const intent of PLAN_INTENT_VALUES) {
      expect(PLAN_DESCRIPTOR[intent], `${intent} descriptor 미정의`).toBeDefined();
    }
  });

  it("한국어 라벨 정합 (Starter / Lab Team / R&D Operations / Enterprise)", () => {
    expect(PLAN_DESCRIPTOR.starter.label).toBe("Starter");
    expect(PLAN_DESCRIPTOR.team.label).toBe("Lab Team");
    expect(PLAN_DESCRIPTOR.business.label).toBe("R&D Operations");
    expect(PLAN_DESCRIPTOR.enterprise.label).toBe("Enterprise");
  });

  it("한국어 부제 (운영 범위 한 줄 요약) 노출 — raw enum 0", () => {
    for (const intent of PLAN_INTENT_VALUES) {
      const d = PLAN_DESCRIPTOR[intent];
      expect(d.tagline, `${intent} tagline 누락`).toBeTruthy();
      expect(d.tagline.length).toBeGreaterThan(5);
      // raw enum 노출 0 (FREE / TEAM / ENTERPRISE 같은 영문 enum 키 비노출)
      expect(d.tagline).not.toMatch(/\b(FREE|TEAM|ORGANIZATION|ENTERPRISE)\b/);
    }
  });
});

describe("§11.201 plan-descriptor — 가격 / 좌석 / 운영량 / Credit 매트릭스", () => {
  it("priceMonthlyKrw — Starter 0 / Lab Team 129000 / R&D Operations 349000 / Enterprise null (계약)", () => {
    expect(PLAN_DESCRIPTOR.starter.priceMonthlyKrw).toBe(0);
    expect(PLAN_DESCRIPTOR.team.priceMonthlyKrw).toBe(129000);
    expect(PLAN_DESCRIPTOR.business.priceMonthlyKrw).toBe(349000);
    expect(PLAN_DESCRIPTOR.enterprise.priceMonthlyKrw).toBeNull();
  });

  it("seatsRecommended — 1 / 5 / 15 / null", () => {
    expect(PLAN_DESCRIPTOR.starter.seatsRecommended).toBe(1);
    expect(PLAN_DESCRIPTOR.team.seatsRecommended).toBe(5);
    expect(PLAN_DESCRIPTOR.business.seatsRecommended).toBe(15);
    expect(PLAN_DESCRIPTOR.enterprise.seatsRecommended).toBeNull();
  });

  it("operatingVolume.monthlyRfq — Starter 5 / Lab Team 30 / R&D Operations 80 / Enterprise null", () => {
    expect(PLAN_DESCRIPTOR.starter.operatingVolume.monthlyRfq).toBe(5);
    expect(PLAN_DESCRIPTOR.team.operatingVolume.monthlyRfq).toBe(30);
    expect(PLAN_DESCRIPTOR.business.operatingVolume.monthlyRfq).toBe(80);
    expect(PLAN_DESCRIPTOR.enterprise.operatingVolume.monthlyRfq).toBeNull();
  });

  it("operatingVolume.monthlyPo / inventoryItems 정합", () => {
    expect(PLAN_DESCRIPTOR.starter.operatingVolume.monthlyPo).toBe(5);
    expect(PLAN_DESCRIPTOR.team.operatingVolume.monthlyPo).toBe(30);
    expect(PLAN_DESCRIPTOR.business.operatingVolume.monthlyPo).toBe(80);
    expect(PLAN_DESCRIPTOR.starter.operatingVolume.inventoryItems).toBe(50);
    expect(PLAN_DESCRIPTOR.team.operatingVolume.inventoryItems).toBe(500);
    expect(PLAN_DESCRIPTOR.business.operatingVolume.inventoryItems).toBe(2000);
  });

  it("labOpsCreditMonthly — 100 / 1500 / 7500 / null (계약)", () => {
    expect(PLAN_DESCRIPTOR.starter.labOpsCreditMonthly).toBe(100);
    expect(PLAN_DESCRIPTOR.team.labOpsCreditMonthly).toBe(1500);
    expect(PLAN_DESCRIPTOR.business.labOpsCreditMonthly).toBe(7500);
    expect(PLAN_DESCRIPTOR.enterprise.labOpsCreditMonthly).toBeNull();
  });
});

describe("§11.201 plan-descriptor — features + CTA + recommend tag", () => {
  it("features 배열 — 검색/비교/견적/PO/입고/재고 핵심 항목 노출", () => {
    for (const intent of PLAN_INTENT_VALUES) {
      const d = PLAN_DESCRIPTOR[intent];
      expect(d.features, `${intent} features 누락`).toBeInstanceOf(Array);
      expect(d.features.length, `${intent} features 비어있음`).toBeGreaterThan(0);
    }
    // Lab Team 부터 핵심 워크플로 모두 포함
    const teamFeatures = PLAN_DESCRIPTOR.team.features.join(" ");
    expect(teamFeatures).toMatch(/견적/);
    expect(teamFeatures).toMatch(/PO|발주/);
    expect(teamFeatures).toMatch(/재고/);
  });

  it("ctaRoute 가 alive (기존 onboarding/checkout/contact 라우트만, fake checkout 0)", () => {
    // starter → /dashboard (free 시작)
    expect(PLAN_DESCRIPTOR.starter.ctaRoute).toBe("/dashboard");
    // team → settings/plans checkout 진입
    expect(PLAN_DESCRIPTOR.team.ctaRoute).toMatch(/^\/dashboard\/settings\/plans/);
    expect(PLAN_DESCRIPTOR.team.ctaRoute).toContain("plan=team");
    // business → settings/plans checkout 진입
    expect(PLAN_DESCRIPTOR.business.ctaRoute).toMatch(/^\/dashboard\/settings\/plans/);
    expect(PLAN_DESCRIPTOR.business.ctaRoute).toContain("plan=business");
    // enterprise → contact-sales 라우트
    expect(PLAN_DESCRIPTOR.enterprise.ctaRoute).toMatch(/^\/support\?topic=enterprise/);
  });

  it("ctaLabel 한국어 — 시작하기 / 결제 진행 / 영업 문의", () => {
    expect(PLAN_DESCRIPTOR.starter.ctaLabel).toMatch(/시작|무료/);
    expect(PLAN_DESCRIPTOR.team.ctaLabel).toMatch(/결제|시작|선택/);
    expect(PLAN_DESCRIPTOR.business.ctaLabel).toMatch(/결제|시작|선택/);
    expect(PLAN_DESCRIPTOR.enterprise.ctaLabel).toMatch(/문의|상담|영업/);
  });

  it("recommendTag — Lab Team 또는 R&D Operations 한 곳만 noteworthy", () => {
    const recommended = PLAN_INTENT_VALUES.filter(
      (intent) => PLAN_DESCRIPTOR[intent].recommendTag !== null,
    );
    // 정확히 하나 또는 두 plan 만 추천 (운영 OS 정합 — 단일 연구실 / R&D 센터 분리)
    expect(recommended.length).toBeGreaterThanOrEqual(1);
    expect(recommended.length).toBeLessThanOrEqual(2);
    // recommendTag 한국어 (Most Popular 같은 영문 0)
    for (const intent of recommended) {
      expect(PLAN_DESCRIPTOR[intent].recommendTag).toMatch(/추천/);
      expect(PLAN_DESCRIPTOR[intent].recommendTag).not.toMatch(/Most Popular/i);
    }
  });
});

describe("§11.201 plan-descriptor — LabOps Credit scenarios (display only)", () => {
  it("LABOPS_CREDIT_USAGE_SCENARIOS — AI 작업 (견적 비교 / rationale / extraction / narrative)", () => {
    expect(LABOPS_CREDIT_USAGE_SCENARIOS).toBeInstanceOf(Array);
    expect(LABOPS_CREDIT_USAGE_SCENARIOS.length).toBeGreaterThanOrEqual(3);
    const all = LABOPS_CREDIT_USAGE_SCENARIOS.join(" ");
    expect(all).toMatch(/AI/);
    expect(all).toMatch(/견적|비교|rationale|extraction|narrative|운영 브리핑/i);
  });

  it("LABOPS_CREDIT_PROTECTED_SCENARIOS — 코어 workflow 보호 (검색/요청/승인/PO/입고/재고)", () => {
    expect(LABOPS_CREDIT_PROTECTED_SCENARIOS).toBeInstanceOf(Array);
    expect(LABOPS_CREDIT_PROTECTED_SCENARIOS.length).toBeGreaterThanOrEqual(4);
    const all = LABOPS_CREDIT_PROTECTED_SCENARIOS.join(" ");
    expect(all).toMatch(/검색/);
    expect(all).toMatch(/견적|요청/);
    expect(all).toMatch(/승인/);
    expect(all).toMatch(/PO|발주/);
    expect(all).toMatch(/입고/);
    expect(all).toMatch(/재고/);
  });

  it("'AI 무제한' / '무제한 워크스페이스' 카피 0 (전 descriptor field grep)", () => {
    for (const intent of PLAN_INTENT_VALUES) {
      const d = PLAN_DESCRIPTOR[intent];
      const allText = [
        d.label,
        d.tagline,
        ...(d.features ?? []),
        d.ctaLabel,
        d.recommendTag ?? "",
      ].join(" ");
      expect(allText, `${intent} 에 'AI 무제한' 잔존`).not.toMatch(/AI\s*무제한/);
      expect(allText, `${intent} 에 '무제한 워크스페이스' 잔존`).not.toMatch(/무제한\s*워크스페이스/);
    }
    // scenarios 도 grep
    const scenarios = [...LABOPS_CREDIT_USAGE_SCENARIOS, ...LABOPS_CREDIT_PROTECTED_SCENARIOS].join(" ");
    expect(scenarios).not.toMatch(/AI\s*무제한/);
    expect(scenarios).not.toMatch(/무제한\s*워크스페이스/);
  });
});

describe("§11.201 plan-descriptor — helper functions", () => {
  it("getPlanDescriptor(intent) 반환", () => {
    for (const intent of PLAN_INTENT_VALUES) {
      const d = getPlanDescriptor(intent);
      expect(d.intent).toBe(intent);
    }
  });

  it("getPlanLabel(intent) 한국어 라벨 반환", () => {
    expect(getPlanLabel("starter")).toBe("Starter");
    expect(getPlanLabel("team")).toBe("Lab Team");
    expect(getPlanLabel("business")).toBe("R&D Operations");
    expect(getPlanLabel("enterprise")).toBe("Enterprise");
  });

  it("getPlanPriceMonthly(intent) 반환 — number 또는 null (Enterprise)", () => {
    expect(getPlanPriceMonthly("starter")).toBe(0);
    expect(getPlanPriceMonthly("team")).toBe(129000);
    expect(getPlanPriceMonthly("business")).toBe(349000);
    expect(getPlanPriceMonthly("enterprise")).toBeNull();
  });

  it("getPlanCreditQuota(intent) 반환 — number 또는 null (Enterprise)", () => {
    expect(getPlanCreditQuota("starter")).toBe(100);
    expect(getPlanCreditQuota("team")).toBe(1500);
    expect(getPlanCreditQuota("business")).toBe(7500);
    expect(getPlanCreditQuota("enterprise")).toBeNull();
  });
});

describe("§11.201 plan-descriptor — type contract", () => {
  it("PlanDescriptor 의 필수 필드 union: intent / label / tagline / priceMonthlyKrw / seatsRecommended / operatingVolume / labOpsCreditMonthly / features / ctaRoute / ctaLabel / recommendTag", () => {
    const d: PlanDescriptor = PLAN_DESCRIPTOR.team;
    expect(d).toHaveProperty("intent");
    expect(d).toHaveProperty("label");
    expect(d).toHaveProperty("tagline");
    expect(d).toHaveProperty("priceMonthlyKrw");
    expect(d).toHaveProperty("seatsRecommended");
    expect(d).toHaveProperty("operatingVolume");
    expect(d).toHaveProperty("labOpsCreditMonthly");
    expect(d).toHaveProperty("features");
    expect(d).toHaveProperty("ctaRoute");
    expect(d).toHaveProperty("ctaLabel");
    expect(d).toHaveProperty("recommendTag");
    // operatingVolume sub-fields
    expect(d.operatingVolume).toHaveProperty("monthlyRfq");
    expect(d.operatingVolume).toHaveProperty("monthlyPo");
    expect(d.operatingVolume).toHaveProperty("inventoryItems");
  });

  it("PlanIntent narrowing — ts compile time + runtime safety", () => {
    const intent: PlanIntent = "team";
    const d = PLAN_DESCRIPTOR[intent];
    expect(d.label).toBe("Lab Team");
  });
});
