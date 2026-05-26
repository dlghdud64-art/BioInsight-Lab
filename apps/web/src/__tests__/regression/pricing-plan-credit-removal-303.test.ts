/**
 * §11.303 #pricing-plan-credit-removal — 가격 첫 화면을 운영 OS 흐름으로
 *   정리하고 plan-descriptor 의 AI 기능 등급 표기는 카드에만 유지한다.
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
 *   - pricing/page.tsx 상단에 조달 운영 흐름과 CTA 고정
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

  describe("pricing/page.tsx — 운영 OS 진입 흐름 고정", () => {
    it("LABOPS CREDIT 섹션 헤더 부재 (UI noxious)", () => {
      // 이전 h2 "자동화 작업은 LabOps Credit으로 운영됩니다" 제거
      expect(PRICING_SRC).not.toMatch(/자동화 작업은 LabOps Credit으로/);
      // 이전 p tag "LabOps Credit" 라벨 부재
      expect(PRICING_SRC).not.toMatch(/uppercase mb-2">\s*LabOps Credit\s*</);
    });

    it("첫 화면에 운영 OS 정체성과 4단계 흐름을 노출한다", () => {
      expect(PRICING_SRC).toMatch(/연구소 조달 운영 OS/);
      expect(PRICING_SRC).toMatch(/data-testid="pricing-operations-flow"/);
      expect(PRICING_SRC).toMatch(/\["검색", "비교", "요청", "승인"\]/);
    });

    it("상단에는 주 CTA와 데모 링크만 둔다", () => {
      expect(PRICING_SRC).toMatch(/R&amp;D Operations 시작하기/);
      expect(PRICING_SRC).toMatch(/href="\/search\?q=PBS&labaxisPilot=sourcing-ai-compare"/);
      expect(PRICING_SRC).toMatch(/데모 보기/);
      expect(PRICING_SRC).toMatch(/id="plans"/);
    });

    it("CTA 바로 아래에서 비교, 승인, 예산 판단을 노출한다", () => {
      expect(PRICING_SRC).toMatch(/data-testid="pricing-decision-status"/);
      expect(PRICING_SRC).toMatch(/견적 비교: 후보 3개/);
      expect(PRICING_SRC).toMatch(/승인 필요: 발주 전 1단계/);
      expect(PRICING_SRC).toMatch(/예산 영향: 월 비용 확인/);
    });

    it("가격표 위의 중복 AI 소개 블록을 노출하지 않는다", () => {
      expect(PRICING_SRC).not.toMatch(/Lab Team 이상 플랜에서 AI 기능을 무제한/);
      expect(PRICING_SRC).not.toMatch(/AI 견적 비교 분석 \(Lab Team\+\)/);
      expect(PRICING_SRC).not.toMatch(/LABOPS_CREDIT_PROTECTED_SCENARIOS\.map/);
    });

    it("pilot 무제한 footnote 제거 (Credit 없으면 불필요)", () => {
      expect(PRICING_SRC).not.toMatch(/pilot \(시범 운영\) 기간 동안 LabOps Credit/);
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
    it("플랜 카드에 운영 행동값을 한 줄씩 노출한다", () => {
      expect(DESCRIPTOR_SRC).toMatch(/"견적 비교 후보 3개 확인"/);
      expect(DESCRIPTOR_SRC).toMatch(/"요청 후 PO 추적"/);
      expect(DESCRIPTOR_SRC).toMatch(/"발주 전 승인 1단계"/);
      expect(DESCRIPTOR_SRC).toMatch(/"기관 승인 매트릭스 · PO 감사 추적"/);
    });

    it("team.features — AI 견적 비교 / 문서 추출 / 운영 브리핑 신규", () => {
      expect(DESCRIPTOR_SRC).toMatch(/"AI 견적 비교 \/ 문서 추출 \/ 운영 브리핑"/);
    });

    it("team.features — 운영자 추가 단가 명시 (§11.304: 3명 포함 + ₩35,000/월)", () => {
      // §11.304 swap: "5명 포함 (추가 운영자 ₩25,000/인)" → "3명 포함 (추가 1명당 ₩35,000/월)"
      expect(DESCRIPTOR_SRC).toMatch(/운영자 3명 포함 \(추가 1명당 ₩35,000\/월\)/);
    });

    it("business.features — AI 견적 작성 보조 신규", () => {
      expect(DESCRIPTOR_SRC).toMatch(/"AI 견적 작성 보조"/);
    });

    it("business.features — 운영자 추가 단가 명시 (§11.304: 10명 포함 + ₩28,000/월)", () => {
      // §11.304 swap: "15명 포함 (추가 운영자 ₩20,000/인)" → "10명 포함 (추가 1명당 ₩28,000/월)"
      expect(DESCRIPTOR_SRC).toMatch(/운영자 10명 포함 \(추가 1명당 ₩28,000\/월\)/);
    });

    it('business.ctaLabel — §11.304: "Pro 시작하기" (R&D Operations 시작하기 → Pro 시작하기 swap)', () => {
      expect(DESCRIPTOR_SRC).toMatch(/ctaLabel:\s*"Pro 시작하기"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/ctaLabel:\s*"R&D 운영 플랜 상담"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/ctaLabel:\s*"R&D Operations 시작하기"/);
    });

    it("enterprise.features — 커스텀 AI 분석 신규", () => {
      expect(DESCRIPTOR_SRC).toMatch(/"커스텀 AI 분석"/);
    });

    it("enterprise tagline 에 Credit 문구를 다시 노출하지 않는다 (§11.304: 새 tagline 정합)", () => {
      // §11.304 swap: "기관 / 법인 — 승인 정책·PO 감사 추적" → "기관 · 계약형 운영 · 좌석/운영량 협의"
      expect(DESCRIPTOR_SRC).toMatch(/tagline:\s*"기관 · 계약형 운영 · 좌석\/운영량 협의"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/tagline:\s*"기관 \/ 법인 — 계약 기반 좌석·운영량·Credit"/);
    });
  });

  describe("§11.303b override — Q2/Q3 보존 결정 변경 정합", () => {
    it("§11.303b-2 — labOpsCreditMonthly field 제거 (Q2 보존 → 제거 override)", () => {
      // §11.303 Q2 = "보존" 결정이 §11.303b-2 에서 "제거" 으로 override
      expect(DESCRIPTOR_SRC).not.toMatch(/labOpsCreditMonthly:\s*\d+/);
      expect(DESCRIPTOR_SRC).not.toMatch(/labOpsCreditMonthly:\s*null/);
      // getPlanCreditQuota helper 도 제거
      expect(DESCRIPTOR_SRC).not.toMatch(/export function getPlanCreditQuota/);
    });

    it("§11.303b — 견적/PO 무제한 (Q3 보존 → 무제한 override, backend null + UI literal 동시)", () => {
      // §11.303 Q3 = "30/80 literal 보존" → §11.303b: 모두 "무제한" + monthlyRfq/Po null
      expect(DESCRIPTOR_SRC).not.toMatch(/"견적 요청 \(월 30건\)"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/"PO 발행 \(월 30건\)"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/"견적 요청 \(월 80건\)"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/"PO 발행 \(월 80건\)"/);
      // §11.303b — team / business operatingVolume.monthlyRfq/Po null
      expect(DESCRIPTOR_SRC).toMatch(/"견적 요청 무제한"/);
      expect(DESCRIPTOR_SRC).toMatch(/"PO 발행 무제한"/);
    });

    it("descriptor const LABOPS_CREDIT_USAGE_SCENARIOS / PROTECTED_SCENARIOS 보존 (§11.303b-2 cleanup 대상)", () => {
      // §11.303b-2 에서 field 제거됐지만 SCENARIOS const 는 보존 (Credit 의미
      // 만 제거, 상수 자체는 추후 별도 정리 가능)
      expect(DESCRIPTOR_SRC).toMatch(/LABOPS_CREDIT_USAGE_SCENARIOS/);
      expect(DESCRIPTOR_SRC).toMatch(/LABOPS_CREDIT_PROTECTED_SCENARIOS/);
    });

    it("§11.304 — 4 label 등급화 (Free/Basic/Pro/Enterprise) — Starter/Lab Team/R&D Operations 제거", () => {
      expect(DESCRIPTOR_SRC).not.toMatch(/label:\s*"Starter"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/label:\s*"Lab Team"/);
      expect(DESCRIPTOR_SRC).not.toMatch(/label:\s*"R&D Operations"/);
      expect(DESCRIPTOR_SRC).toMatch(/label:\s*"Free"/);
      expect(DESCRIPTOR_SRC).toMatch(/label:\s*"Basic"/);
      expect(DESCRIPTOR_SRC).toMatch(/label:\s*"Pro"/);
      expect(DESCRIPTOR_SRC).toMatch(/label:\s*"Enterprise"/);
    });

    it("Starter ctaLabel / Lab Team ctaLabel 보존 (변경 0)", () => {
      expect(DESCRIPTOR_SRC).toMatch(/ctaLabel:\s*"무료 파일럿 시작"/);
      expect(DESCRIPTOR_SRC).toMatch(/ctaLabel:\s*"Lab Team 시작하기"/);
      expect(DESCRIPTOR_SRC).toMatch(/ctaLabel:\s*"영업 문의하기"/);
    });
  });
});
