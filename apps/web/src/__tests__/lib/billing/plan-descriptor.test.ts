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
  // §11.303b-2 — getPlanCreditQuota 제거 (labOpsCreditMonthly field 제거 동반)
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

  // §11.304 티어명 등급화(Free/Basic/Pro) 반영 — 현행 소스 정합.
  it("한국어 라벨 정합 (Free / Basic / Pro / Enterprise)", () => {
    expect(PLAN_DESCRIPTOR.starter.label).toBe("Free");
    expect(PLAN_DESCRIPTOR.team.label).toBe("Basic");
    expect(PLAN_DESCRIPTOR.business.label).toBe("Pro");
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
  // §pricing-redesign (호영님 2026-06-27) — 가격 89k/259k.
  it("priceMonthlyKrw — Free 0 / Basic 89000 / Pro 259000 / Enterprise null (계약)", () => {
    expect(PLAN_DESCRIPTOR.starter.priceMonthlyKrw).toBe(0);
    expect(PLAN_DESCRIPTOR.team.priceMonthlyKrw).toBe(89000);
    expect(PLAN_DESCRIPTOR.business.priceMonthlyKrw).toBe(259000);
    expect(PLAN_DESCRIPTOR.enterprise.priceMonthlyKrw).toBeNull();
  });

  // §11.304 — 좌석 3/10 (현행 소스 정합).
  it("seatsRecommended — 1 / 3 / 10 / null", () => {
    expect(PLAN_DESCRIPTOR.starter.seatsRecommended).toBe(1);
    expect(PLAN_DESCRIPTOR.team.seatsRecommended).toBe(3);
    expect(PLAN_DESCRIPTOR.business.seatsRecommended).toBe(10);
    expect(PLAN_DESCRIPTOR.enterprise.seatsRecommended).toBeNull();
  });

  // §11.303b Basic/Pro 무제한 + §pricing-redesign P3 Free RFQ 5→3(enforce 정합).
  it("operatingVolume.monthlyRfq — Free 3 / Basic null / Pro null / Enterprise null", () => {
    expect(PLAN_DESCRIPTOR.starter.operatingVolume.monthlyRfq).toBe(3);
    expect(PLAN_DESCRIPTOR.team.operatingVolume.monthlyRfq).toBeNull();
    expect(PLAN_DESCRIPTOR.business.operatingVolume.monthlyRfq).toBeNull();
    expect(PLAN_DESCRIPTOR.enterprise.operatingVolume.monthlyRfq).toBeNull();
  });

  // §pricing-redesign — inventoryItems 10/50/200 + P3 Free monthlyPo 5→null(PO 한도 폐기).
  it("operatingVolume.monthlyPo / inventoryItems 정합", () => {
    expect(PLAN_DESCRIPTOR.starter.operatingVolume.monthlyPo).toBeNull();
    expect(PLAN_DESCRIPTOR.team.operatingVolume.monthlyPo).toBeNull();
    expect(PLAN_DESCRIPTOR.business.operatingVolume.monthlyPo).toBeNull();
    expect(PLAN_DESCRIPTOR.starter.operatingVolume.inventoryItems).toBe(10);
    expect(PLAN_DESCRIPTOR.team.operatingVolume.inventoryItems).toBe(50);
    expect(PLAN_DESCRIPTOR.business.operatingVolume.inventoryItems).toBe(200);
  });

  // §11.303b-2 — labOpsCreditMonthly assertion 제거 (field 자체 제거됨)
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
    // §pricing-copy-cleanup — PO/발주 → 구매 가치 치환. 구매 워크플로 항목 노출 검증.
    expect(teamFeatures).toMatch(/구매|PO|발주/);
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

  it("ctaLabel 한국어 — 시작하기 / 상담 / 영업 문의 ('결제 진행' fake checkout 폐기)", () => {
    // §11.201e — real checkout backend 부재 시 "결제 진행" 카피 폐기.
    //   "시작하기" / "상담" / "영업 문의" 같은 액션 톤만 허용.
    // §pricing-prelaunch — Basic/Pro 는 PG 미연동 → "출시 알림 신청"(리드) 톤 허용.
    expect(PLAN_DESCRIPTOR.starter.ctaLabel).toMatch(/시작|무료|파일럿/);
    expect(PLAN_DESCRIPTOR.team.ctaLabel).toMatch(/시작|선택|상담|신청|알림/);
    expect(PLAN_DESCRIPTOR.business.ctaLabel).toMatch(/시작|선택|상담|문의|신청|알림/);
    expect(PLAN_DESCRIPTOR.enterprise.ctaLabel).toMatch(/문의|상담|영업/);
    // fake checkout 카피 sweep
    for (const intent of PLAN_INTENT_VALUES) {
      expect(PLAN_DESCRIPTOR[intent].ctaLabel).not.toMatch(/결제\s*진행/);
    }
  });

  // §11.304 recommendTag 등급화 카피("가장 많이 선택" / "성장 단계 추천") 반영 — 현행 소스 정합.
  it("recommendTag — Basic 또는 Pro 한 곳만 noteworthy", () => {
    const recommended = PLAN_INTENT_VALUES.filter(
      (intent) => PLAN_DESCRIPTOR[intent].recommendTag !== null,
    );
    // 정확히 하나 또는 두 plan 만 추천
    expect(recommended.length).toBeGreaterThanOrEqual(1);
    expect(recommended.length).toBeLessThanOrEqual(2);
    // recommendTag 한국어 (Most Popular 같은 영문 0)
    for (const intent of recommended) {
      expect(PLAN_DESCRIPTOR[intent].recommendTag).toMatch(/추천|가장 많이 선택/);
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
    expect(getPlanLabel("starter")).toBe("Free");
    expect(getPlanLabel("team")).toBe("Basic");
    expect(getPlanLabel("business")).toBe("Pro");
    expect(getPlanLabel("enterprise")).toBe("Enterprise");
  });

  it("getPlanPriceMonthly(intent) 반환 — number 또는 null (Enterprise)", () => {
    expect(getPlanPriceMonthly("starter")).toBe(0);
    expect(getPlanPriceMonthly("team")).toBe(89000);
    expect(getPlanPriceMonthly("business")).toBe(259000);
    expect(getPlanPriceMonthly("enterprise")).toBeNull();
  });

  // §11.303b-2 — getPlanCreditQuota test 제거 (getter + labOpsCreditMonthly field 제거 동반)
});

describe("§11.201 plan-descriptor — type contract", () => {
  it("PlanDescriptor 의 필수 필드 union: intent / label / tagline / priceMonthlyKrw / seatsRecommended / operatingVolume / features / ctaRoute / ctaLabel / recommendTag (§11.303b-2: labOpsCreditMonthly 제거)", () => {
    const d: PlanDescriptor = PLAN_DESCRIPTOR.team;
    expect(d).toHaveProperty("intent");
    expect(d).toHaveProperty("label");
    expect(d).toHaveProperty("tagline");
    expect(d).toHaveProperty("priceMonthlyKrw");
    expect(d).toHaveProperty("seatsRecommended");
    expect(d).toHaveProperty("operatingVolume");
    // §11.303b-2 — labOpsCreditMonthly toHaveProperty 제거 (field 제거됨)
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
    expect(d.label).toBe("Basic");
  });
});
