/**
 * §pricing-copy-cleanup — /pricing PO 문구 전면 치환 + trial 정책 플래그 (호영님 2026-06-27)
 *
 * P1 이 maxPurchaseOrdersPerMonth(PO 한도) field 를 제거했으나 카드 카피의 PO/발주 문구는 미정리(부분 반영 회귀).
 * 본 batch 가 4티어 카드·/pricing 비교표의 PO/발주 procurement 용어를 "구매" 가치로 치환(기능 약속 후퇴 0).
 *   - descriptor.features: PO 발행 무제한·요청 후 PO 추적·발주 전 승인·PO 감사 → 구매 처리/구매 진행/구매 승인/구매 감사
 *   - /pricing: "견적·발주 무제한"·"발주 무제한"·"발주 준비·운영 큐" → 구매 카피
 *   - descriptor.trialEligible: Basic 만 true (데이터 플래그). ⚠️ "30일 무료 체험" 사용자 노출은 OOS(결제 백엔드 미비 → fake claim 회피).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const DESC = read("lib/billing/plan-descriptor.ts");
const PRICING = read("app/pricing/page.tsx");

describe("§pricing-copy-cleanup — descriptor PO/발주 카피 0", () => {
  it("PO 발행/추적/승인/감사 카드 카피 잔재 0", () => {
    expect(DESC).not.toMatch(/"PO 발행 무제한"/);
    expect(DESC).not.toMatch(/"요청 후 PO 추적"/);
    expect(DESC).not.toMatch(/"발주 전 승인 1단계"/);
    expect(DESC).not.toMatch(/"기관 승인 매트릭스 · PO 감사 추적"/);
  });
  it("구매 가치 카피로 치환(기능 보존)", () => {
    expect(DESC).toMatch(/"구매 처리 무제한"/);
    expect(DESC).toMatch(/"요청·구매 진행 추적"/);
    expect(DESC).toMatch(/"구매 전 승인 1단계"/);
    expect(DESC).toMatch(/"기관 승인 매트릭스 · 구매 감사 추적"/);
  });
});

describe("§pricing-copy-cleanup — /pricing PO/발주 카피 0", () => {
  it("발주 무제한·발주 준비 큐 잔재 0", () => {
    expect(PRICING).not.toMatch(/"견적·발주 무제한"/);
    expect(PRICING).not.toMatch(/· 발주 무제한`/);
    expect(PRICING).not.toMatch(/"발주 준비·운영 큐"/);
  });
  it("구매 카피로 치환", () => {
    expect(PRICING).toMatch(/"견적·구매 무제한"/);
    expect(PRICING).toMatch(/· 구매 무제한`/);
    expect(PRICING).toMatch(/"구매 준비·운영 큐"/);
  });
});

describe("§pricing-copy-cleanup — trialEligible 데이터 플래그(Basic only)", () => {
  it("PlanDescriptor 에 trialEligible 필드", () => {
    expect(DESC).toMatch(/trialEligible:\s*boolean/);
  });
  it("Basic(team) trialEligible true · 그 외 false", () => {
    expect(DESC).toMatch(/recommendTag:\s*"가장 많이 선택",\s*\n\s*trialEligible:\s*true/);
    // false 가 3곳(starter/business/enterprise)
    expect((DESC.match(/trialEligible:\s*false/g) || []).length).toBe(3);
    expect((DESC.match(/trialEligible:\s*true/g) || []).length).toBe(1);
  });
  it("⚠️ trial 사용자 노출 0 (메커니즘 부재 — fake claim 회피)", () => {
    expect(DESC).not.toMatch(/무료 체험/);
    expect(PRICING).not.toMatch(/무료 체험/);
    expect(PRICING).not.toMatch(/30일 체험/);
  });
});
