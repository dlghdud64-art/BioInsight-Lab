/**
 * §11.339 v2 1단계 (회귀) — 우측 패널 탭 카트 sentinel
 *
 * 신규 QuoteCartPanel(견적함/비교함/상세 탭) + search/page 우측 패널 연결.
 *   - 견적함: 수량(−/+), 중립 카드 배경(§11.302), 검토필요 인라인(별도 드로어 X), "견적 후 확정"(§11.338).
 *   - 상세: SourcingContextRail slot 주입(§11.337 Part C 통합), forceDetailKey=activeResultId.
 *   - 비교함: compareIds 제품 목록.
 * 1단계 범위: 탭 카트 신설 + 노랑 제거 + 검토 인라인. (하단 드로어 제거 = 2단계)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const PANEL = "src/app/_workbench/_components/quote-cart-panel.tsx";
const SEARCH = "src/app/_workbench/search/page.tsx";

describe("§11.339 v2 — QuoteCartPanel 탭 구조", () => {
  it("3개 탭(견적함/비교함/상세) testid", () => {
    const src = read(PANEL);
    expect(src).toMatch(/data-testid=\{`cart-tab-\$\{id\}`\}/);
    expect(src).toMatch(/id="quote" label="견적함"/);
    expect(src).toMatch(/id="compare" label="비교함"/);
    expect(src).toMatch(/id="detail" label="상세"/);
  });
  it("forceDetailKey 변경 시 상세 탭 전환", () => {
    const src = read(PANEL);
    expect(src).toMatch(/if \(forceDetailKey\) setTab\("detail"\)/);
  });
});

describe("§11.339 v2 — 견적함: 수량/중립카드/검토인라인", () => {
  it("수량 조절(−/input/+)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/data-testid="cart-qty"/);
    expect(src).toMatch(/aria-label="수량 감소"/);
    expect(src).toMatch(/aria-label="수량 증가"/);
  });
  it("§11.302 — 카드 배경 중립(bg-white), 전체 노랑 X(보더만)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/rounded-lg border bg-white/);
    expect(src).toMatch(/border-l-2 border-l-yellow-400/);
    // 전체 노란 배경(bg-yellow-50) 카드 금지
    expect(src).not.toMatch(/bg-yellow-50/);
  });
  it("검토 필요 인라인(별도 드로어 X) + 재고확인/유지 액션", () => {
    const src = read(PANEL);
    expect(src).toMatch(/data-testid="cart-review-inline"/);
    expect(src).toMatch(/data-testid="cart-review-resolve"/);
    expect(src).toMatch(/data-testid="cart-review-keep"/);
  });
  it("§11.338 — 미견적 '견적 후 확정'", () => {
    const src = read(PANEL);
    expect(src).toMatch(/\(unitPrice \?\? 0\) > 0/);
    expect(src).toMatch(/: "견적 후 확정"/);
  });
});

describe("§11.339 v2 — search/page 연결", () => {
  it("QuoteCartPanel import + 렌더", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/import \{ QuoteCartPanel \}/);
    expect(src).toMatch(/<QuoteCartPanel/);
  });
  it("detailSlot 에 SourcingContextRail + forceDetailKey=activeResultId", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/detailSlot=\{railProduct \?/);
    expect(src).toMatch(/forceDetailKey=\{activeResultId\}/);
  });
  it("reviewFlags = requestReadiness review_required 매핑", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/reviewFlags=\{requestReadiness\.candidates/);
  });
  it("수량/제거/견적요청 핸들러 wiring", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/onQuantityChange=\{\(id, quantity\) => updateQuoteItem\(id, \{ quantity \}\)\}/);
    expect(src).toMatch(/onRemoveQuoteItem=\{\(id\) => removeQuoteItem\(id\)\}/);
  });
});
