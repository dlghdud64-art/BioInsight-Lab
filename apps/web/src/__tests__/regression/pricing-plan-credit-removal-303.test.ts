/**
 * §11.303 #pricing-plan-credit-removal — pricing/page.tsx LABOPS CREDIT 섹션
 *   → "AI 기능" 섹션 교체 + plan-descriptor features array AI 기능 등급별
 *   명시 + CTA "R&D 운영 플랜 상담" → "R&D Operations 시작하기".
 *
 * 호영님 P1 spec (2026-05-25, Quartzy/Benchling 벤치마크):
 *   Credit 모델은 사용자가 직관적으로 이해 못 함 + Quartzy/Benchling 모두
 *   Credit 모델 미사용. LabAxis 플랜 페이지를 시장 표준 (등급별 AI 포함,
 *   사용량 무제한) 으로 정합.
 *
 * 호영님 의사결정 (4 Q):
 *   Q1 = C (UI 먼저 land, backend defer §11.303b)
 *   Q2 = 보존 (labOpsCreditMonthly field UI hidden, field 자체는 보존)
 *   Q3 = 보존 + UI "무제한" 표기 안 함 (literal 불일치 방지)
 *   Q4 = audit (displayName 정합)
 *
 * §11.303 (본 batch) scope:
 *   - pricing/page.tsx LABOPS CREDIT 섹션 → "AI 기능" 섹션 교체
 *   - 카드 label "LabOps Credit N/월" 제거
 *   - plan-descriptor features array AI 기능 등급별 명시
 *   - CTA "R&D 운영 플랜 상담" → "R&D Operations 시작하기"
 *   - LABOPS_CREDIT_USAGE_SCENARIOS import orphan cleanup
 *   - 건수 한도 (RFQ/PO 30/80) 보존 — backend literal 정합
 *   - labOpsCreditMonthly / maxQuotesPerMonth field 보존 — §11.303b 후속
 *
 * Out of Scope (§11.303b 별도 batch):
 *   - labOpsCreditMonthly field 제거 (caller 전수 audit 후)
 *   - maxQuotesPerMonth null 변경 + UI "무제한" 표기 동시 land
 *   - LABOPS_CREDIT_USAGE_SCENARIOS / LABOPS_CREDIT_PROTECTED_SCENARIOS
 *     const 제거 (caller 전수 audit 후)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PRICING_SRC = readFileSync(
  resolve(__dirname, "../../app/pricing/page.tsx"),
  "utf8",
);
const DESCRIPTOR_SRC = readFileSync(
  resolve(__dirname, "../../lib/billing/plan-descriptor.ts"),
  "utf8",
);

describe("§11.303 — pricing 플랜 구조 개편 + Credit 제거 (UI batch)", () => {
  it("§11.303 trace marker (pricing + descriptor)", () => {
    expect(PRICING_SRC).toMatch(/§11\.303/);
    expect(DESCRIPTOR_SRC).toMatch(/§11\.303/);
  });

  describe("pricing/page.tsx — LABOPS CREDIT 섹션 → AI 기능 섹션 교체", () => {
    it("LABOPS CREDIT 섹션 헤더 부재 (UI noxious)", () => {
      // 이전 h2 "자동화 작업은 LabOps Credit으로 운영됩니다" 제거
      expect(PRICING_SRC).not.toMatch(/자동화 작업은 LabOps Credit으로/);
      // 이전 p tag "LabOps Credit" 라벨 부재
      expect(PRICING_SRC).not.toMatch(/uppercase mb-2">\s*LabOps Credit\s*</);
    });

    it('AI 기능 섹션 신규 노출 ("Lab Team 이상 플랜에서 AI 기능을 무제한")', () => {
      expect(PRICING_SRC).toMatch(/AI 기능/);
      expect(PRICING_SRC).toMatch(/Lab Team 이상 플랜에서 AI 기능을 무제한/);
    });

    it("AI 등급별 라벨 (Lab Team+ / R&D Ops+ / Enterprise)", () => {
      expect(PRICING_SRC).toMatch(/AI 견적 비교 분석 \(Lab Team\+\)/);
      expect(PRICING_SRC).toMatch(/AI 문서 추출 \(Lab Team\+\)/);
      expect(PRICING_SRC).toMatch(/AI 운영 브리핑 \(Lab Team\+\)/);
      expect(PRICING_SRC).toMatch(/AI 견적 작성 보조 \(R&D Ops\+\)/);
      expect(PRICING_SRC).toMatch(/커스텀 AI 분석 \(Enterprise\)/);
    });

    it("pilot 무제한 footnote 제거 (Credit 없으면 불필요)", () => {
      expect(PRICING_SRC).not.toMatch(/pilot \(시범 운영\) 기간 동안 LabOps Credit/);
    });

    it("핵심 운영 보호 섹션 보존 (LABOPS_CREDIT_PROTECTED_SCENARIOS map)", () => {
      expect(PRICING_SRC).toMatch(/LABOPS_CREDIT_PROTECTED_SCENARIOS\.map/);
      expect(PRICING_SRC).toMatch(/모든 핵심 운영 기능은 플랜과 관계없이 제한 없이/);
    });
  });

  describe("pricing/page.tsx — 카드 label LabOps Credit 제거", () => {
    it("descriptor.labOpsCreditMonthly conditional display 제거", () => {
      // 이전: `LabOps Credit ${...}/월` 패턴 부재
      expect(PRICING_SRC).not.toMatch(/`LabOps Credit \$\{/);
      expect(PRICING_SRC).not.toMatch(/"LabOps Credit 계약 기반"/);
    });

    it('Enterprise 라벨 "Credit" 단어 제거 ("좌석·운영량 모두 계약 기반")', () => {
      expect(PRICING_SRC).toMatch(/좌석·운영량 모두 계약 기반/);
      expect(PRICING_SRC).not.toMatch(/좌석·운영량·Credit 모두 계약 기반/);
    });

    it("LABOPS_CREDIT_USAGE_SCENARIOS import orphan cleanup", () => {
      // named import 식별자 부재만 검증 — 주석 내 언급(// ...) 은 허용
      // "  LABOPS_CREDIT_USAGE_SCENARIOS," 패턴 (non-comment 라인) 만 차단
      expect(PRICING_SRC).not.toMatch(/^\s+LABOPS_CREDIT_USAGE_SCENARIOS[,\s]/m);
    });
  });

  describe("plan-descriptor.ts — features array + CTA 정합", () => {
    it("team.features — AI 견적 비교 / 문서 추출 / 운영 브리핑 신규", () => {
      expect(DESCRIPTOR_SRC).toMatch(/"AI 견적 비교 \/ 문서 추출 \/ 운영 브리핑"/);
    });

    it("team.features — 운영자 추가 단가 명시 (₩25,000/인)", () => {
      expect(DESCRIPTOR_SRC).toMatch(/운영자 5명 포함 \(추가 운영자 ₩25,000\/인\)/);
    });

    it("business.features — AI 견적 작성 보조 신규", () => {
      expect(DESCRIPTOR_SRC).toMatch(/"AI 견적 작성 보조"/);
    });

    it("business.features — 운영자 추가 단가 명시 (₩20,000/인)", () => {
      expect(DESCRIPTOR_SRC).toMatch(/운영자 15명 포함 \(추가 운영자 ₩20,000\/인\)/);
    });

    it('business.ctaLabel — "R&D Operations 시작하기" (이전 "R&D 운영 플랜 상담")', () => {
      expect(DESCRIPTOR_SRC).toMatch(/ctaLabel:\s*"R&D Operations 시작하기"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/ctaLabel:\s*"R&D 운영 플랜 상담"/);
    });

    it("enterprise.features — 커스텀 AI 분석 신규", () => {
      expect(DESCRIPTOR_SRC).toMatch(/"커스텀 AI 분석"/);
    });
  });

  describe("회귀 0 — 호영님 Q2/Q3 보존 결정 정합", () => {
    it("Q2 보존 — labOpsCreditMonthly field schema 보존 (§11.303b 후속)", () => {
      expect(DESCRIPTOR_SRC).toMatch(/labOpsCreditMonthly:\s*\d+/);
      expect(DESCRIPTOR_SRC).toMatch(/labOpsCreditMonthly:\s*null/);
      // getPlanCreditQuota helper 보존
      expect(DESCRIPTOR_SRC).toMatch(/export function getPlanCreditQuota/);
    });

    it("Q3 보존 — 건수 한도 (RFQ/PO 30/80) literal 보존 (UI 무제한 표기 안 함)", () => {
      expect(DESCRIPTOR_SRC).toMatch(/"견적 요청 \(월 30건\)"/);
      expect(DESCRIPTOR_SRC).toMatch(/"PO 발행 \(월 30건\)"/);
      expect(DESCRIPTOR_SRC).toMatch(/"견적 요청 \(월 80건\)"/);
      expect(DESCRIPTOR_SRC).toMatch(/"PO 발행 \(월 80건\)"/);
      // operatingVolume.monthlyRfq 보존
      expect(DESCRIPTOR_SRC).toMatch(/monthlyRfq:\s*30/);
      expect(DESCRIPTOR_SRC).toMatch(/monthlyRfq:\s*80/);
    });

    it("descriptor const LABOPS_CREDIT_USAGE_SCENARIOS / PROTECTED_SCENARIOS 보존 (caller audit 후 §11.303b)", () => {
      expect(DESCRIPTOR_SRC).toMatch(/LABOPS_CREDIT_USAGE_SCENARIOS/);
      expect(DESCRIPTOR_SRC).toMatch(/LABOPS_CREDIT_PROTECTED_SCENARIOS/);
    });

    it("Starter / Enterprise displayName / tagline 보존", () => {
      expect(DESCRIPTOR_SRC).toMatch(/label:\s*"Starter"/);
      expect(DESCRIPTOR_SRC).toMatch(/label:\s*"Lab Team"/);
      expect(DESCRIPTOR_SRC).toMatch(/label:\s*"R&D Operations"/);
      expect(DESCRIPTOR_SRC).toMatch(/label:\s*"Enterprise"/);
    });

    it("Starter ctaLabel / Lab Team ctaLabel 보존 (변경 0)", () => {
      expect(DESCRIPTOR_SRC).toMatch(/ctaLabel:\s*"무료 파일럿 시작"/);
      expect(DESCRIPTOR_SRC).toMatch(/ctaLabel:\s*"Lab Team 시작하기"/);
      expect(DESCRIPTOR_SRC).toMatch(/ctaLabel:\s*"영업 문의하기"/);
    });
  });
});
