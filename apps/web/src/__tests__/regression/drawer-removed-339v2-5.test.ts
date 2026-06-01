/**
 * §11.339 v2 5 (회귀) — 하단 드로어(SourcingCandidatesSheet) 완전 제거 sentinel
 *
 * 우측 견적함/비교함 탭(QuoteCartPanel)이 같은 내용 상시 표시 → 하단 드로어 중복.
 * 하단 바 "견적 N"/"비교 N" 클릭 → 드로어 대신 우측 탭 전환(forceQuoteKey/forceCompareKey).
 * SourcingCandidatesSheet 렌더 제거.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const SEARCH = "src/app/_workbench/search/page.tsx";
const PANEL = "src/app/_workbench/_components/quote-cart-panel.tsx";

describe("§11.339 v2 5 — 하단 드로어 제거", () => {
  it("SourcingCandidatesSheet 렌더 제거", () => {
    const src = read(SEARCH);
    expect(src).not.toMatch(/<SourcingCandidatesSheet/);
  });
  it("setCandidatesSheetMode 트리거 0 (compare/quote/review)", () => {
    const src = read(SEARCH);
    expect(src).not.toMatch(/setCandidatesSheetMode\("(compare|quote|review)"\)/);
  });
});

describe("§11.339 v2 5 — 하단 바 클릭 → 우측 탭 전환", () => {
  it("비교 클릭 → compareFocusKey, 견적 클릭 → quoteFocusKey", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/onClick=\{\(\) => setCompareFocusKey\(\(k\) => k \+ 1\)\}/);
    expect(src).toMatch(/onClick=\{\(\) => setQuoteFocusKey\(\(k\) => k \+ 1\)\}/);
  });
  it("QuoteCartPanel forceQuoteKey(review+quote) + forceCompareKey 전달", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/forceQuoteKey=\{\(reviewFocusKey \+ quoteFocusKey\)/);
    expect(src).toMatch(/forceCompareKey=\{compareFocusKey/);
  });
  it("패널 forceCompareKey prop + 비교함 탭 전환 effect", () => {
    const src = read(PANEL);
    expect(src).toMatch(/forceCompareKey\?: string \| null/);
    expect(src).toMatch(/if \(forceCompareKey\) setTab\("compare"\)/);
  });
});

describe("§11.339 v2 5 회귀 0 — 우측 탭 카트 보존", () => {
  it("QuoteCartPanel 렌더 + 3탭 보존", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/<QuoteCartPanel/);
    const panel = read(PANEL);
    expect(panel).toMatch(/id="quote" label="견적함"/);
    expect(panel).toMatch(/id="compare" label="비교함"/);
  });
});
