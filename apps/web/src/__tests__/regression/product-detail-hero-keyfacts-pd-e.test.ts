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
  it("PD-H/M 시안 히어로 키 팩트 행 — 분류·출처·내부 등급·제조사·안전 위험도", () => {
    // 호영님 재결정(2026-06-20): 시안대로 내부 등급(specifications.INTERNALGRADE) 노출.
    //   단 product.grade 직접 렌더는 §sourcing-product-surface 가드대로 계속 미사용(specifications 값만).
    expect(DETAIL).toMatch(/label: "분류"/);
    expect(DETAIL).toMatch(/label: "출처"/);
    expect(DETAIL).toMatch(/label: "내부 등급", value: internalGrade/); // 시안대로 노출
    expect(DETAIL).toMatch(/label: "안전 위험도"/);
    expect(DETAIL).not.toMatch(/\{product\.grade\}/); // product.grade 직접 렌더 0(§sourcing-product-surface 정합)
  });
  it("PD-M 히어로 통합 — Cat.No 배지 + 완성도 인라인(시안 한 카드)", () => {
    expect(DETAIL).toMatch(/<span className="text-\[11px\] text-slate-500">Cat\.No<\/span>/);
    expect(DETAIL).toMatch(/<ProductCompleteness product=\{product\}/);
    expect(DETAIL).not.toMatch(/실험\/제품 정보<\/CardTitle>/); // "실험/제품 정보" 제목 제거(시안 정합)
  });
  it("회귀 0 — 분류 태그 + Cat.No + 완성도 보존", () => {
    expect(DETAIL).toMatch(/PRODUCT_CATEGORIES\[product\.category/);
    expect(DETAIL).toMatch(/Cat\.No \(카탈로그 번호\)/);
    expect(DETAIL).toMatch(/<ProductCompleteness product=\{product\}/);
  });
});
