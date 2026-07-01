/**
 * §11.303c #enterprise-info-drift — ENTERPRISE_INFO.features (lib/plans.ts)
 *   PLAN_DESCRIPTOR.enterprise.features (plan-descriptor.ts) 정합 + "커스텀
 *   AI 분석" 결락 보강.
 *
 * §11.303 (UI batch) 후속 — drift 정리:
 *   /pricing 페이지 = PLAN_DESCRIPTOR.enterprise.features (§11.303 정합)
 *   /dashboard/settings/plans 페이지 = ENTERPRISE_INFO.features (stale)
 *   같은 Enterprise 라벨이 두 source 다른 텍스트 → drift = canonical truth
 *   violation. ENTERPRISE_INFO 정합으로 drift 차단.
 *
 * 향후 ENTERPRISE_INFO → PLAN_DESCRIPTOR.enterprise 단일화는 별도 batch
 *   (caller audit 후, §11.303b 와 통합 가능성).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PLANS_SRC = readFileSync(
  resolve(__dirname, "../../lib/plans.ts"),
  "utf8",
);
const DESCRIPTOR_SRC = readFileSync(
  resolve(__dirname, "../../lib/billing/plan-descriptor.ts"),
  "utf8",
);

describe("§11.303c — ENTERPRISE_INFO + PLAN_DESCRIPTOR.enterprise 정합", () => {
  it("§11.303c trace marker", () => {
    expect(PLANS_SRC).toMatch(/§11\.303c/);
  });

  describe("ENTERPRISE_INFO.features — §11.303 spec 정합", () => {
    it('"Pro 전체 +" 라벨 (§11.304 R&D Operations→Pro 정합)', () => {
      expect(PLANS_SRC).toMatch(/"Pro 전체 \+"/);
      // 이전 "Business 전체 기능" 비주석 라인 차단 (§11.303c 회귀 방지 유지)
      expect(PLANS_SRC).not.toMatch(/^\s+"Business 전체 기능"/m);
    });

    it('"전용 좌석 / 운영량 협의" (이전 "조직 맞춤 구축 지원" 정합)', () => {
      expect(PLANS_SRC).toMatch(/"전용 좌석 \/ 운영량 협의"/);
    });

    it('"SSO / SAML / 감사 통제" (이전 "SSO 지원" 확장)', () => {
      expect(PLANS_SRC).toMatch(/"SSO \/ SAML \/ 감사 통제"/);
      expect(PLANS_SRC).not.toMatch(/"SSO 지원"/);
    });

    it('"전담 온보딩 매니저" + "기관 SLA / 보안 검토 지원" 분리 (이전 "전담 매니저 및 SLA")', () => {
      expect(PLANS_SRC).toMatch(/"전담 온보딩 매니저"/);
      expect(PLANS_SRC).toMatch(/"기관 SLA \/ 보안 검토 지원"/);
      expect(PLANS_SRC).not.toMatch(/"전담 매니저 및 SLA"/);
    });

    it('"커스텀 AI 분석" 신규 (§11.303 AI 등급 spec 정합)', () => {
      expect(PLANS_SRC).toMatch(/"커스텀 AI 분석"/);
    });

    it('이전 stale features 제거 ("ERP API 연동" / "무제한 데이터 저장")', () => {
      expect(PLANS_SRC).not.toMatch(/"ERP API 연동"/);
      expect(PLANS_SRC).not.toMatch(/"무제한 데이터 저장"/);
    });

    it('tagline — "기관 · 계약형 운영 · 좌석/운영량 협의" 정합 (§11.304)', () => {
      expect(PLANS_SRC).toMatch(/tagline:\s*"기관 · 계약형 운영 · 좌석\/운영량 협의"/);
    });
  });

  describe("PLAN_DESCRIPTOR.enterprise vs ENTERPRISE_INFO drift 차단", () => {
    it("두 source 의 features array 가 §11.303 spec 정합 (동일 텍스트)", () => {
      // PLAN_DESCRIPTOR.enterprise.features 와 ENTERPRISE_INFO.features 가
      // 같은 6 항목 (label 통일 후 정합)
      const sharedFeatures = [
        '"Pro 전체 +"',
        '"전용 좌석 / 운영량 협의"',
        '"SSO / SAML / 감사 통제"',
        '"전담 온보딩 매니저"',
        '"기관 SLA / 보안 검토 지원"',
        '"커스텀 AI 분석"',
      ];
      for (const feat of sharedFeatures) {
        expect(PLANS_SRC).toContain(feat);
        expect(DESCRIPTOR_SRC).toContain(feat);
      }
    });
  });

  describe("회귀 0 — 핵심 export / interface 보존", () => {
    it("ENTERPRISE_INFO displayName / priceDisplay / contactEmail 보존", () => {
      expect(PLANS_SRC).toMatch(/displayName:\s*"Enterprise"/);
      expect(PLANS_SRC).toMatch(/priceDisplay:\s*"별도 문의"/);
      expect(PLANS_SRC).toMatch(/contactEmail:\s*"support@labaxis\.co\.kr"/);
    });

    it("PlanLimits interface + maxQuotesPerMonth field 보존 (§11.303b 후속)", () => {
      expect(PLANS_SRC).toMatch(/interface PlanLimits/);
      expect(PLANS_SRC).toMatch(/maxQuotesPerMonth:\s*number \| null/);
    });
  });
});
