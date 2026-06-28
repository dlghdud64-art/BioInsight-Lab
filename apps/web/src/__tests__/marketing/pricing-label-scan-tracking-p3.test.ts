/**
 * §pricing-redesign P3 — /pricing 라벨 스캔 훅 + LOT/GMP 추적 가치 표기 (호영님 2026-06-27)
 *
 * P1(가격·1mo-free·4카드)·§11.304(티어명)·§11.303b(견적·발주 무제한)로 4카드 재설계 본체는 이미 land.
 * P3 잔여 = P2b(라벨스캔 enforce)·P2a(추적모드 게이팅)와 정합하는 가치 표기를 /pricing·descriptor에 노출.
 *   - descriptor: Free "라벨 스캔 (월 10회)" / Basic·Pro "라벨 스캔 무제한" / Pro "LOT / GMP 추적"
 *   - /pricing 비교표: "라벨 스캔 (월)" 행(10회/무제한) + "LOT / GMP 추적" 행(Pro check)
 * 정직성: 표기 숫자 = enforce(maxLabelScansPerMonth Free 10) 정합. P2b 카운터 실구현 후 노출(fake claim 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const DESC = read("lib/billing/plan-descriptor.ts");
const PRICING = read("app/pricing/page.tsx");

describe("§pricing-redesign P3 — descriptor 라벨스캔/추적 표기", () => {
  it("Free 라벨 스캔 월 10회 (enforce 정합)", () => {
    expect(DESC).toMatch(/intent:\s*"starter"[\s\S]*?"라벨 스캔 \(월 10회\)"/);
  });
  it("Basic 라벨 스캔 무제한", () => {
    expect(DESC).toMatch(/intent:\s*"team"[\s\S]*?"라벨 스캔 무제한"/);
  });
  it("Pro 라벨 스캔 무제한 + LOT/GMP 추적", () => {
    expect(DESC).toMatch(/intent:\s*"business"[\s\S]*?"라벨 스캔 무제한"/);
    expect(DESC).toMatch(/intent:\s*"business"[\s\S]*?"LOT \/ GMP 추적"/);
  });
});

describe("§pricing-redesign P3 — /pricing 비교표 행", () => {
  it("라벨 스캔 (월) 행 — Free 10회 / 이상 무제한", () => {
    expect(PRICING).toMatch(/feature:\s*"라벨 스캔 \(월\)"[\s\S]*?starter:\s*"10회"[\s\S]*?team:\s*"무제한"[\s\S]*?business:\s*"무제한"/);
  });
  it("LOT / GMP 추적 행 — Pro check", () => {
    expect(PRICING).toMatch(/feature:\s*"LOT \/ GMP 추적"[\s\S]*?starter:\s*"none"[\s\S]*?team:\s*"none"[\s\S]*?business:\s*"check"/);
  });
});

describe("§pricing-redesign P3 — 게이트(회귀 0)", () => {
  // §pricing-prelaunch — 연간 = 약 11% 할인 · 출시 후 적용. "1개월 무료"/"10% 할인" 폐기.
  it("연간 약 11% 할인 표기 · 1개월무료/10%할인 0", () => {
    expect(PRICING).toMatch(/약 11% 할인/);
    // §pricing-handoff D4 — 연간 할인 "1개월 무료" 프레이밍만 금지, trial "1개월 무료체험" 허용.
    expect(PRICING).not.toMatch(/1개월 무료(?!체험)/);
    expect(PRICING).not.toMatch(/10% 할인/);
  });
  it("Enterprise 정찰가 미표기 — Custom + 영업 문의 CTA", () => {
    expect(PRICING).toMatch(/"Custom"/);
    expect(DESC).toMatch(/intent:\s*"enterprise"[\s\S]*?ctaLabel:\s*"영업 문의하기"/);
  });
  it("4카드 descriptor 통과(하드코딩 가격 0) 보존", () => {
    expect(PRICING).toMatch(/PLAN_INTENT_VALUES\.map/);
    expect(PRICING).not.toMatch(/₩(89|259|129|349),000/);
  });
});
