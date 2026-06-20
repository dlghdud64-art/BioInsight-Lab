/**
 * §product-detail PD-J (§05 레이아웃) — "제품 사양" 카드 통합
 *
 * 시안: 흩어진 독립 Cat.No 블록 + "추가 스펙 정보" 카드를 하나의 "제품 사양" 카드로 통합
 *   (카탈로그 번호 + 분류 + 추가 스펙(출처 등, §03 매핑·grade 숨김)).
 *   §125 "상세 스펙 (Specifications)"(규격/규제) 그리드는 별도 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DETAIL = readFileSync(
  join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
  "utf8",
);

describe("§product-detail PD-J(§05) — 제품 사양 카드 통합", () => {
  it("'제품 사양' 통합 카드 + 카탈로그 번호 단일(중복 제거)", () => {
    expect(DETAIL).toMatch(/<h3 className="text-lg font-bold text-slate-900">제품 사양<\/h3>/);
    expect((DETAIL.match(/Cat\.No \(카탈로그 번호\)/g) || []).length).toBe(1);
  });
  it("분류 + 추가 스펙(getDisplaySpecs) 통합", () => {
    expect(DETAIL).toMatch(/PRODUCT_CATEGORIES\[product\.category/);
    expect(DETAIL).toMatch(/getDisplaySpecs\(product\.specifications\)\.map/);
  });
  it("'추가 스펙 정보' 별도 카드 폐기 + 독립 Cat.No 블록 폐기", () => {
    expect(DETAIL).not.toMatch(/추가 스펙 정보/);
    expect(DETAIL).not.toMatch(/<h3 className="font-semibold text-sm">Cat\.No/);
  });
  it("회귀 0 — §125 상세 스펙(규격/규제) 그리드 보존", () => {
    expect(DETAIL).toMatch(/상세 스펙 \(Specifications\)/);
    expect(DETAIL).toMatch(/등록된 상세 스펙이 없습니다/);
  });
});
