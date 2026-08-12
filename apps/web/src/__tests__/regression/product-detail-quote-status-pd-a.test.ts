/**
 * §product-detail PD-A (§06) — 견적가 안내 상태 카드(정직)
 *
 * 지시문 §06. 거대·모호한 "가격 문의" → "견적가 안내 품목" 파랑 상태 + 사유 + 신뢰 문구.
 *   가격 유무로 분기, 가격 없음 = 막다른 길 아니라 "상태"로 명확화. 견적 담기 CTA 보존.
 *   (§02~05 정직화는 §125 기완료 — 본 배치는 §06 견적 카드만.)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DETAIL = readFileSync(
  join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
  "utf8",
);

describe("§product-detail PD-A(§06) — 견적가 안내 상태", () => {
  it("'견적가 안내 품목' 상태 라벨로 교체 + 거대 '가격 문의' 폐기", () => {
    expect(DETAIL).toMatch(/견적가 안내 품목/);
    expect(DETAIL).not.toMatch(/가격 문의</); // 렌더 "가격 문의" 0
  });
  it("파랑 상태 톤(§11.302 — amber 아님)", () => {
    expect(DETAIL).toMatch(/text-blue-700">견적가 안내 품목/);
  });
  /**
   * 🔁 승계 (§sourcing-quote-flow v1.1 ⑥) — 문구가 담김 캡션으로 이전되며 짧아졌다.
   *   "무료" 는 남고 "구매 의무 없음" 은 견적 요청 화면으로 넘어간다(호영님 2026-08-12).
   *   PD-A 의 계약은 **신뢰 문구의 존속**이므로 표현이 아니라 존속을 잠근다.
   */
  it("견적 신뢰 문구 존속(무료 — 담김 캡션으로 이전)", () => {
    expect(DETAIL).toMatch(/견적 요청은 무료입니다/);
  });
  it("회귀 0 — 견적 담기 CTA 보존", () => {
    expect(DETAIL).toMatch(/견적 담기/);
  });
});
