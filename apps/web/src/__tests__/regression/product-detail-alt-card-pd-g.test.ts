/**
 * §product-detail PD-G (§08) — 대체품 카드 보강(분류·Cat.No·유사근거·상세)
 *
 * 지시문 §08: 대체품 카드 = 제품명·분류·Cat.No + 비교/상세 + "왜 대체 가능한지" 근거 태그.
 *   API(/alternatives)가 이미 category·catalogNumber·similarityReasons 반환 → 렌더만 보강(catalog-독립).
 *   ★ grade 누출 방지: similarityReasons 중 "Grade" 포함 항목 제외(§sourcing-product-surface 정합).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DETAIL = readFileSync(
  join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
  "utf8",
);

describe("§product-detail PD-G(§08) — 대체품 카드 보강", () => {
  it("분류(category 라벨) + Cat.No 노출", () => {
    expect(DETAIL).toMatch(/PRODUCT_CATEGORIES\[alt\.category/);
    expect(DETAIL).toMatch(/Cat\.No \{alt\.catalogNumber\}/);
  });
  it("유사 근거 태그(similarityReasons) — grade 제외 필터", () => {
    expect(DETAIL).toMatch(/alt\.similarityReasons/);
    expect(DETAIL).toMatch(/filter\(\(r: string\) => !\/grade\/i\.test\(r\)\)/);
  });
  it("상세(제품 간 이동) + 비교 보존(시안 컴팩트 라벨)", () => {
    // §PD-flat(2026-06-20): alt 카드 컴팩트 — "상세 보기"→"상세 >", "비교 추가"→"비교". 이동/비교 의도 보존.
    expect(DETAIL).toMatch(/상세 <ChevronRight/);
    expect(DETAIL).toMatch(/href=\{`\/products\/\$\{alt\.id\}`\}/);
    expect(DETAIL).toMatch(/\{isInCompare \? "비교 제거" : "비교"\}/);
  });
  it("grade 누출 0 — alt.grade 직접 렌더 없음", () => {
    expect(DETAIL).not.toMatch(/\{alt\.grade\}/);
  });
});
