/**
 * §11.201 #pricing-operating-volume-redefine — Phase 2 RED test
 *
 * /pricing public page 가 plan-descriptor (Phase 1) single source 통과 강제.
 * source-level scan — Hard-coded TEAM_MONTHLY 같은 magic number 잔존 0,
 * "MOST POPULAR" 영문 badge 0, "AI 무제한" 카피 0.
 *
 * lock §11.142 호환:
 *   - canonical SubscriptionPlan / WorkspacePlan 변경 0
 *   - dead checkout 0 (CTA route alive — descriptor.ctaRoute 통과)
 *   - fake "AI 무제한" / "무제한 워크스페이스" 0
 *   - LabOps Credit display only (실 차감 §11.202 defer)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PRICING_PATH = "src/app/pricing/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.201 /pricing — descriptor 통과 + 한국어 라벨", () => {
  it("PLAN_DESCRIPTOR import 사용 (raw plan name 0)", () => {
    const src = read(PRICING_PATH);
    // Phase 1 descriptor 를 import (single source)
    expect(src).toMatch(/from\s+["']@\/lib\/billing\/plan-descriptor["']/);
    expect(src).toMatch(/PLAN_DESCRIPTOR|getPlanDescriptor/);
  });

  it("4 한국어 라벨 노출 (Starter / Lab Team / R&D Operations / Enterprise)", () => {
    const src = read(PRICING_PATH);
    // descriptor 가 source 에서 사용되면 라벨이 직접 노출되지 않을 수 있음.
    // 그러나 하드코딩 영문 'Team' / 'Business' 카드 name 은 0 이어야 함.
    // descriptor 사용 후 'Lab Team' 한국어가 등장하거나 (직접 카피),
    // descriptor.label 패턴 으로 자동 노출.
    // 여기선 raw 'Business' (영문 enum 라벨 잔존) 가 카드 name 으로 0.
    expect(src).not.toMatch(/name:\s*["']Business["']/);
    expect(src).not.toMatch(/name:\s*["']Team["']/);
  });

  it("Hard-coded TEAM_MONTHLY / BUSINESS_MONTHLY magic number 0 (descriptor 단일화)", () => {
    const src = read(PRICING_PATH);
    expect(src).not.toMatch(/const\s+TEAM_MONTHLY\s*=/);
    expect(src).not.toMatch(/const\s+BUSINESS_MONTHLY\s*=/);
    // 가격은 descriptor.priceMonthlyKrw 통과
    expect(src).toMatch(/priceMonthlyKrw|getPlanPriceMonthly/);
  });
});

describe("§11.201 /pricing — 운영량 정보 카드 노출 (seat / RFQ / PO / 재고 / Credit)", () => {
  it("좌석 권장 (seatsRecommended) 표시", () => {
    const src = read(PRICING_PATH);
    // descriptor.seatsRecommended 사용 또는 "운영자 N명" 같은 카피 노출
    expect(src).toMatch(/seatsRecommended|운영자\s*\d+\s*명|좌석/);
  });

  it("운영량 (RFQ / PO / 재고) 권장치 표시", () => {
    const src = read(PRICING_PATH);
    // descriptor.operatingVolume 사용
    expect(src).toMatch(/operatingVolume|monthlyRfq|RFQ\s*\d+/);
    // 재고 품목 수 표시
    expect(src).toMatch(/inventoryItems|재고\s*[\d,]+\s*품목/);
  });

  // §11.303b-2 — LabOps Credit 표시 테스트 제거 (§11.303 에서 UI 표시 제거,
  //   §11.303b-2 에서 field 자체 제거 완료). 회귀 차단은 §11.303b-2 sentinel
  //   (plan-unlimited-quotes-po-303b.test.ts + 새 §11.303b-2 sentinel) 에서.
});

describe("§11.201 /pricing — recommendTag 한국어 + MOST POPULAR 영문 폐기", () => {
  it("'MOST POPULAR' 영문 카피 0 occurrence", () => {
    const src = read(PRICING_PATH);
    expect(src).not.toMatch(/MOST POPULAR/);
    expect(src).not.toMatch(/Most Popular/i);
  });

  it("recommendTag '추천:' 한국어 패턴 노출 (descriptor 통과)", () => {
    const src = read(PRICING_PATH);
    // descriptor.recommendTag 또는 직접 "추천:" 카피
    expect(src).toMatch(/recommendTag|추천:/);
  });
});

describe("§11.201 /pricing — fake '무제한' 카피 sweep", () => {
  it("'AI 무제한' / '무제한 워크스페이스' 카피 0 occurrence", () => {
    const src = read(PRICING_PATH);
    expect(src).not.toMatch(/AI\s*무제한/);
    expect(src).not.toMatch(/무제한\s*워크스페이스/);
  });

  it("Enterprise 의 '계약' / '계약 기반' / 'Custom' 톤 명시 (무제한 약속 회피)", () => {
    const src = read(PRICING_PATH);
    // Enterprise 카드는 가격 null + "계약" 또는 "Custom" 표기
    expect(src).toMatch(/계약|Custom/);
  });
});

describe("§11.201 /pricing — title + handlePlanSelect 보존", () => {
  it("title — '연구 구매 운영' 또는 '연구실 규모' 톤 노출 (운영 OS 정합)", () => {
    const src = read(PRICING_PATH);
    expect(src).toMatch(/연구\s*구매\s*운영|연구실\s*규모|운영량에\s*맞는/);
  });

  it("handlePlanSelect 의 /api/billing/plan-select 호출 보존 (canonical resolver)", () => {
    const src = read(PRICING_PATH);
    expect(src).toMatch(/\/api\/billing\/plan-select/);
    expect(src).toMatch(/method:\s*["']POST["']/);
  });

  it("ctaRoute 가 alive — descriptor.ctaRoute 통과 (fake checkout 0)", () => {
    const src = read(PRICING_PATH);
    // descriptor 통과 또는 onSelect(planIntent) 보존 (resolver 가 라우팅)
    expect(src).toMatch(/onSelect|handlePlanSelect|ctaRoute/);
  });
});
