/**
 * §11.339 v2 2단계 (회귀) — 비교 일원화 + 비교함 품명 버그 sentinel
 *
 * 2-3: 탭 위 "비교 검토 활성" strip 제거 → 비교함 탭(QuoteCartPanel) + 하단 바로 일원화.
 * 2-4: 비교함 항목 "제품" placeholder 버그 → compareStore getStoredName fallback.
 * 비교 검토 상태(혼합 카테고리)는 비교함 탭 상단(QuoteCartPanel compareReadiness)에 표시.
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

describe("§11.339 v2 2-3 — 탭 위 비교 strip 제거 + 비교함 탭 일원화", () => {
  it("탭 위 'AI 비교 판단 상태 strip' 제거됨", () => {
    const src = read(SEARCH);
    expect(src).not.toMatch(/AI 비교 판단 상태 strip/);
  });
  it("QuoteCartPanel 에 compareReadiness + onCompareReview 전달", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/compareReadiness=\{aiCompareReadiness\}/);
    expect(src).toMatch(/onCompareReview=\{\(\) => handleProtectedAction\(\(\) => setComparisonModalOpen\(true\)\)\}/);
  });
  it("비교함 탭이 compareReadiness 상태 + 비교 검토 CTA 렌더", () => {
    const src = read(PANEL);
    expect(src).toMatch(/data-testid="cart-compare-readiness"/);
    expect(src).toMatch(/data-testid="cart-compare-review"/);
    expect(src).toMatch(/비교 검토 활성/);
  });
});

describe("§11.339 v2 2-4 — 비교함 품명 placeholder 버그 수정", () => {
  it("compareItems 가 getStoredName fallback 사용", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/const storedName = getStoredName\(id\)/);
    expect(src).toMatch(/name: p\?\.name \|\| storedName \|\| "제품"/);
  });
});

describe("§11.339 v2 2단계 회귀 0 — 1단계 탭 카트 보존", () => {
  it("QuoteCartPanel 3탭 + 견적함 수량 보존", () => {
    const src = read(PANEL);
    expect(src).toMatch(/id="quote" label="견적함"/);
    expect(src).toMatch(/id="compare" label="비교함"/);
    expect(src).toMatch(/data-testid="cart-qty"/);
  });
});
