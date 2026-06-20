/**
 * §product-detail PD-N (§05 레이아웃) — 하위 섹션 독립 카드(시안 정합)
 *
 * 시안: 제품 사양·안전·규제가 각각 독립 카드(테두리·그림자). 기존엔 "실험/제품 정보" 래퍼
 *   박스 안 맨 섹션 → 시안과 어긋남. 래퍼 투명화 + 각 섹션 카드 스타일 + 빈 사용용도 숨김.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DETAIL = readFileSync(
  join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
  "utf8",
);

describe("§product-detail PD-N(§05) — 하위 섹션 독립 카드", () => {
  it("래퍼 박스 투명화(이중 박스 제거)", () => {
    expect(DETAIL).toMatch(/<Card className="bg-transparent border-0 shadow-none p-0 relative space-y-6/);
  });
  it("제품 사양 — 독립 카드 스타일(시안 플랫: hairline·radius18)", () => {
    // §PD-flat(2026-06-20): 글래스(rounded-3xl bg-pn/80) → 시안 플랫(rounded-[18px] border-gray-200 bg-white). 독립 카드 의도 보존.
    expect(DETAIL).toMatch(/mb-6 md:mb-8 rounded-\[18px\] border border-gray-200 bg-white shadow-sm/);
  });
  it("안전·규제 — 독립 카드 스타일(시안 플랫)", () => {
    expect(DETAIL).toMatch(/안전 · 규제 정보 - 항상 표시\. PD-N[\s\S]{0,160}rounded-\[18px\] border border-gray-200 bg-white shadow-sm p-6/);
  });
  it("사용 용도 — 값 있을 때만(빈 섹션 숨김, 시안 정합)", () => {
    expect(DETAIL).toMatch(/\{product\.usageDescription && \(/);
    expect(DETAIL).toMatch(/usageDescription/); // §sourcing 보존
  });
  it("회귀 0 — §125 상세 스펙 그리드/빈상태 보존", () => {
    expect(DETAIL).toMatch(/상세 스펙 \(Specifications\)/);
    expect(DETAIL).toMatch(/등록된 상세 스펙이 없습니다/);
  });
});
