/**
 * §11.339 v2 4 (회귀) — 검토필요 하단 노란시트 진입 제거 + 견적함 인라인 일원화 sentinel
 *
 * 검토필요가 하단 SourcingCandidatesSheet(review mode = 노란 시트)로 뜨던 것 →
 * 견적함 탭 인라인(cart-review-inline)으로 일원화. 하단 바 review 트리거 제거.
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

describe("§11.339 v2 4 — 하단 노란시트 review 진입 제거", () => {
  it('setCandidatesSheetMode("review") 트리거 0', () => {
    const src = read(SEARCH);
    expect(src).not.toMatch(/setCandidatesSheetMode\("review"\)/);
  });
  it("하단 바 검토 배지 클릭 → 견적함 탭 전환(forceQuoteKey), 노란시트 X", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/data-testid="sourcing-bar-review-count"/);
    expect(src).not.toMatch(/data-testid="sourcing-bar-review-open"/);
    // 배지 클릭이 reviewFocusKey 증가 → forceQuoteKey 로 견적함 탭 전환
    expect(src).toMatch(/onClick=\{\(\) => setReviewFocusKey\(\(k\) => k \+ 1\)\}/);
    expect(src).toMatch(/forceQuoteKey=\{reviewFocusKey/);
  });
});

describe("§11.339 v2 4 — 검토필요 견적함 인라인 일원화(보존)", () => {
  it("QuoteCartPanel 검토 인라인 + 액션 보존", () => {
    const src = read(PANEL);
    expect(src).toMatch(/data-testid="cart-review-inline"/);
    expect(src).toMatch(/data-testid="cart-review-resolve"/);
    expect(src).toMatch(/data-testid="cart-review-keep"/);
  });
  it("reviewFlags + onResolveReview/onKeepReview search 연결 보존", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/reviewFlags=\{requestReadiness\.candidates/);
    expect(src).toMatch(/onResolveReview=\{/);
    expect(src).toMatch(/onKeepReview=\{/);
  });
});
