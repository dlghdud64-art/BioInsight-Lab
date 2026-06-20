/**
 * §product-detail PD-E (§05) — 히어로 키 팩트(아는 값만)
 *
 * 지시문 §05 원칙2(아는 것을 위로). 등급·제조사를 히어로 상단에 노출(빈 값 숨김).
 *   분류는 기존 태그, Cat.No·완성도는 본문 — 중복 0. 가짜 채움 0(있을 때만).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DETAIL = readFileSync(
  join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
  "utf8",
);

describe("§product-detail PD-E(§05) — 히어로 키 팩트", () => {
  it("PD-H 시안 히어로 키 팩트 행 — 분류·출처·제조사·안전 위험도(아는 값만). grade/내부등급 미노출", () => {
    // 호영님 결정(2026-06-20): product.grade=내부값 → 상세 미노출(§sourcing-product-surface 정직성 가드 존중).
    //   PD-H 히어로 = 시안 키팩트 행(분류·출처·제조사·안전 위험도). 내부 등급(§11.344 grade)은 보류(호영님 결정 대기).
    expect(DETAIL).toMatch(/label: "분류"/);
    expect(DETAIL).toMatch(/label: "출처"/);
    expect(DETAIL).toMatch(/label: "제조사"/);
    expect(DETAIL).toMatch(/label: "안전 위험도"/);
    expect(DETAIL).toMatch(/제조사/);
    expect(DETAIL).not.toMatch(/\{product\.grade\}/); // grade 미노출(§sourcing-product-surface 정합)
  });
  it("회귀 0 — 분류 태그 + Cat.No + 완성도 보존", () => {
    expect(DETAIL).toMatch(/PRODUCT_CATEGORIES\[product\.category/);
    expect(DETAIL).toMatch(/Cat\.No \(카탈로그 번호\)/);
    expect(DETAIL).toMatch(/<ProductCompleteness product=\{product\}/);
  });
});
