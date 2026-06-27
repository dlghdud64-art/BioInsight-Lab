/**
 * §11.303b #plan-unlimited-quotes-po — Basic/Pro 견적·PO 무제한 (backend null
 *   + UI literal 동시) + /pricing 히어로 제목 복원.
 *
 * 호영님 P0 (2026-05-25):
 *   §11.303 (Credit 제거) + §11.304 (티어 네이밍/인원) 후속 — UI 표기와
 *   backend enforce 정합 동시 land. literal 불일치 0.
 *
 * Phase b-1 (P0 무제한):
 *   - plans.ts PlanLimits:
 *     · FREE.maxQuotesPerMonth 10 → 5 (호영님 spec)
 *     · TEAM(Basic).maxQuotesPerMonth 100 → null (무제한)
 *     · ORGANIZATION(Pro) 이미 null (유지)
 *     · maxPurchaseOrdersPerMonth field 신규 (FREE 5, TEAM null, ORGANIZATION null)
 *   - plan-descriptor.ts operatingVolume:
 *     · team.monthlyRfq 30 → null, monthlyPo 30 → null
 *     · business.monthlyRfq 80 → null, monthlyPo 80 → null
 *   - plan-descriptor.ts features:
 *     · team "견적 요청 (월 30건)" → "견적 요청 무제한", "PO 발행 (월 30건)"
 *       → "PO 발행 무제한"
 *     · business "견적 요청 (월 80건)" → "견적 요청 무제한", "PO 발행 (월 80건)"
 *       → "PO 발행 무제한"
 *   - pricing/page.tsx formatOperatingVolume:
 *     · monthlyRfq/monthlyPo null 분기 → "견적·발주 무제한" 표기
 *
 * /pricing 히어로 제목 복원:
 *   - "요금 안내" + "연구 구매 운영 규모에 맞는 플랜을 선택하세요"
 *   - 이전 무거운 히어로 (4단계 탭/칩/데모 버튼) 는 복원 0
 *
 * Enforce 분석:
 *   - 현재 code 에 maxQuotesPerMonth throw enforce 0건 (read-only 표시 전달만)
 *   - billing/page.tsx + dashboard/settings/plans/page.tsx 가 이미 null safe
 *     ("무제한" fallback) → field swap 만으로 정합 완료
 *
 * Out of Scope (별도 sub-batch):
 *   - b-2: labOpsCreditMonthly caller 제거 (dashboard/pricing/page.tsx stale)
 *   - b-3: maxMembers 5→3, null→10 (grandfather 정책 필수 — 가입자 수 확인 gate)
 *   - b-4: additionalSeatPrice field 신규 (per-seat billing 결제 도입 시 defer)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");

const PLANS_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/lib/plans.ts"),
  "utf8",
);
const DESCRIPTOR_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/lib/billing/plan-descriptor.ts"),
  "utf8",
);
const PRICING_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/app/pricing/page.tsx"),
  "utf8",
);

describe("§11.303b — Basic/Pro 견적·PO 무제한 + 히어로 제목 복원", () => {
  it("§11.303b trace marker (self-referential)", () => {
    const selfSrc = readFileSync(__filename, "utf8");
    expect(selfSrc).toMatch(/§11\.303b/);
  });

  describe("plans.ts PlanLimits 정합", () => {
    // §pricing-redesign (호영님 2026-06-27) — maxPurchaseOrdersPerMonth field 완전 폐기
    //   (PO 한도 = pricing/entitlement 범위에서 제거). 303b 의 "Basic/Pro 견적 무제한" 보호
    //   의도는 maxQuotesPerMonth null 로 계속 강제.
    it("PO 한도 field 완전 제거 (maxPurchaseOrdersPerMonth 잔재 0)", () => {
      expect(PLANS_SRC).not.toMatch(/maxPurchaseOrdersPerMonth/);
    });

    it("FREE: maxQuotesPerMonth 3 (§pricing-refresh P1 — 5→3)", () => {
      expect(PLANS_SRC).toMatch(
        /SubscriptionPlan\.FREE\][\s\S]*?maxQuotesPerMonth:\s*3/,
      );
    });

    it("TEAM(Basic): maxQuotesPerMonth null (무제한)", () => {
      expect(PLANS_SRC).toMatch(
        /SubscriptionPlan\.TEAM\][\s\S]*?maxQuotesPerMonth:\s*null/,
      );
    });

    it("ORGANIZATION(Pro): maxQuotesPerMonth null (무제한)", () => {
      expect(PLANS_SRC).toMatch(
        /SubscriptionPlan\.ORGANIZATION\][\s\S]*?maxQuotesPerMonth:\s*null/,
      );
    });

    it("기존 stale 값 (TEAM 100 / FREE 10) 제거", () => {
      expect(PLANS_SRC).not.toMatch(
        /SubscriptionPlan\.TEAM\][\s\S]{0,200}maxQuotesPerMonth:\s*100/,
      );
      expect(PLANS_SRC).not.toMatch(
        /SubscriptionPlan\.FREE\][\s\S]{0,200}maxQuotesPerMonth:\s*10[^0-9]/,
      );
    });
  });

  describe("plan-descriptor.ts operatingVolume null swap", () => {
    // §pricing-redesign (호영님 2026-06-27) — inventoryItems 표기=enforce 정직 정합 (500→50 / 2000→200).
    it("team(Basic).operatingVolume: monthlyRfq null + monthlyPo null + inventoryItems 50", () => {
      expect(DESCRIPTOR_SRC).toMatch(
        /intent:\s*"team"[\s\S]*?operatingVolume:\s*\{[\s\S]*?monthlyRfq:\s*null[\s\S]*?monthlyPo:\s*null[\s\S]*?inventoryItems:\s*50/,
      );
    });

    it("business(Pro).operatingVolume: monthlyRfq null + monthlyPo null + inventoryItems 200", () => {
      expect(DESCRIPTOR_SRC).toMatch(
        /intent:\s*"business"[\s\S]*?operatingVolume:\s*\{[\s\S]*?monthlyRfq:\s*null[\s\S]*?monthlyPo:\s*null[\s\S]*?inventoryItems:\s*200/,
      );
    });

    // §pricing-redesign P3 (호영님 2026-06-27) — Free 표기=enforce 정직 정합:
    //   monthlyRfq 5→3(plans.ts FREE maxQuotesPerMonth=3), monthlyPo 5→null(PO 한도 폐기=무제한).
    it("starter(Free): monthlyRfq 3 + monthlyPo null (RFQ enforce 정합·PO 무제한)", () => {
      expect(DESCRIPTOR_SRC).toMatch(
        /intent:\s*"starter"[\s\S]*?monthlyRfq:\s*3[\s\S]*?monthlyPo:\s*null/,
      );
    });
  });

  describe("plan-descriptor.ts features 무제한 swap", () => {
    it("team features: \"견적 요청 무제한\" + \"PO 발행 무제한\"", () => {
      expect(DESCRIPTOR_SRC).toMatch(
        /intent:\s*"team"[\s\S]*?"견적 요청 무제한"[\s\S]*?"PO 발행 무제한"/,
      );
    });

    it("business features: \"견적 요청 무제한\" + \"PO 발행 무제한\"", () => {
      expect(DESCRIPTOR_SRC).toMatch(
        /intent:\s*"business"[\s\S]*?"견적 요청 무제한"[\s\S]*?"PO 발행 무제한"/,
      );
    });

    it("기존 stale features (\"월 30건\" / \"월 80건\") 제거", () => {
      expect(DESCRIPTOR_SRC).not.toMatch(/"견적 요청 \(월 30건\)"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/"PO 발행 \(월 30건\)"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/"견적 요청 \(월 80건\)"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/"PO 발행 \(월 80건\)"/);
    });

    // §pricing-redesign P3 — Free features 정직 정합: RFQ 3(enforce)·PO 무제한(한도 폐기).
    it("starter(Free) features: \"견적 요청 (월 3건)\" + \"PO 발행 무제한\"", () => {
      expect(DESCRIPTOR_SRC).toMatch(/"견적 요청 \(월 3건\)"/);
      expect(DESCRIPTOR_SRC).toMatch(/"PO 발행 무제한"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/"견적 요청 \(월 5건\)"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/"PO 발행 \(월 5건\)"/);
    });
  });

  describe("pricing/page.tsx formatOperatingVolume 무제한 분기", () => {
    it('null 분기 시 "견적·발주 무제한" 표기', () => {
      expect(PRICING_SRC).toMatch(/"견적·발주 무제한"/);
    });

    it("seatsLine + rfqPoLine + itemsLine 3 line 구조 보존", () => {
      expect(PRICING_SRC).toMatch(/seatsLine/);
      expect(PRICING_SRC).toMatch(/rfqPoLine/);
      expect(PRICING_SRC).toMatch(/itemsLine/);
    });

    // §pricing-redesign P3 — Free 비대칭(RFQ 유한·PO 무제한) 정직 라인.
    it("starter 비대칭 표기 (견적 요청 월 N건 · 발주 무제한)", () => {
      expect(PRICING_SRC).toMatch(
        /`견적 요청 월 \$\{descriptor\.operatingVolume\.monthlyRfq\}건 · 발주 무제한`/,
      );
    });
  });

  describe("/pricing 히어로 제목 복원 (가벼운 정체성)", () => {
    it('"요금 안내" 제목 + 부제 보존', () => {
      expect(PRICING_SRC).toMatch(/요금 안내/);
      expect(PRICING_SRC).toMatch(/연구 구매 운영 규모에 맞는 플랜을 선택하세요/);
    });

    it("이전 무거운 히어로 (4단계 탭 / 데모 보기 / decision-status 칩) 복원 0", () => {
      // §11.304 에서 제거된 요소들이 복원 안 됐는지 확인
      expect(PRICING_SRC).not.toMatch(/pricing-operations-flow/);
      expect(PRICING_SRC).not.toMatch(/데모 보기/);
      expect(PRICING_SRC).not.toMatch(/pricing-decision-status/);
      expect(PRICING_SRC).not.toMatch(/연구소 조달 운영 OS/);
      expect(PRICING_SRC).not.toMatch(/검색부터 승인까지/);
    });

    it("text-2xl font-bold + text-sm 가벼운 스타일", () => {
      expect(PRICING_SRC).toMatch(
        /<h1 className="text-2xl font-bold"[\s\S]*?요금 안내/,
      );
    });
  });
});
