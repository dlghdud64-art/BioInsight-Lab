/**
 * §10 견적 비교 매트릭스 — 행별 최적값 하이라이트(B3, 기존 워크벤치 보강).
 *
 * 기존 QuoteCompareReviewWorkbench 매트릭스는 누락(red)만 표시하고 최적값 강조가 없었음.
 * diff 엔진이 산출한 canonical winner(advantageVendor)로 최저단가/최단납기 셀을 emerald+✓ 강조.
 *   canonical truth: 강조는 엔진 계산값 재사용(별도 날조 0), 누락 셀은 강조 제외.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../app/_workbench/_components/quote-compare-review-workbench.tsx"),
  "utf8",
);

describe("§10 매트릭스 행별 최적값 하이라이트", () => {
  it("diff 엔진 winner(advantageVendor) 재사용 — 단가=최저, 납기=최단", () => {
    expect(SRC).toContain("diffSummary.lowestPrice?.advantageVendor");
    expect(SRC).toContain("diffSummary.fastestLeadTime?.advantageVendor");
    expect(SRC).toMatch(/field === "단가".*advantageVendor/s);
    expect(SRC).toMatch(/field === "납기".*advantageVendor/s);
  });

  it("최적 셀 emerald 강조 + ✓ 마커, 누락 셀은 강조 제외", () => {
    expect(SRC).toContain("bg-emerald-600/[0.06]");
    expect(SRC).toMatch(/isBest &&[\s\S]{0,40}Check/);
    // 누락은 best 후보에서 제외(!isMissing 가드)
    expect(SRC).toMatch(/!isMissing &&/);
  });
});
