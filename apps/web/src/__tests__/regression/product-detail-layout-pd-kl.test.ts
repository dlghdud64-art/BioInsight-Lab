/**
 * §product-detail PD-K/PD-L (§05 레이아웃) — 이미지 썸네일 + 빈 상세스펙 숨김(시안 델타)
 *
 * PD-K: 큰 이미지 박스(max-h-400) → 히어로 소형 썸네일(bloat 0). 빈 이미지는 Package 아이콘.
 * PD-L: 빈 "상세 스펙" 카드는 buyer 에게 숨김(canEditSpec일 때만 노출 — 첫 스펙 등록 affordance).
 *   미등록 안내는 완성도(ProductCompleteness)가 담당. §125 "상세 스펙(규격/규제)" 그리드 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DETAIL = readFileSync(
  join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
  "utf8",
);

describe("§product-detail PD-K(§05) — 히어로 이미지 썸네일", () => {
  it("히어로 썸네일 96px(시안 정합) + 큰 이미지 박스 폐기", () => {
    // §PD-flat(2026-06-20): 시안 정합으로 80→96px(w-20 h-20 md:w-24 md:h-24). bloat 0 의도 보존.
    expect(DETAIL).toMatch(/w-20 h-20 md:w-24 md:h-24/);
    expect(DETAIL).not.toMatch(/max-h-\[400px\]/);
  });
});

describe("§product-detail PD-L(§05) — 빈 상세 스펙 카드 buyer 숨김", () => {
  it("상세 스펙 카드 조건부(canEditSpec 게이트) + §125 그리드/empty 문자열 보존", () => {
    expect(DETAIL).toMatch(/\(product\.specification \|\| product\.regulatoryCompliance \|\| canEditSpec\) &&/);
    expect(DETAIL).toMatch(/상세 스펙 \(Specifications\)/);
    expect(DETAIL).toMatch(/등록된 상세 스펙이 없습니다/);
  });
  it("미등록 안내는 완성도가 담당(보존)", () => {
    expect(DETAIL).toMatch(/<ProductCompleteness product=\{product\}/);
  });
});
