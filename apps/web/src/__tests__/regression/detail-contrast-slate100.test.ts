/**
 * detail-page surface #1 (regression) — product detail low-contrast (invisible text) guard.
 *
 * Bug: card bg-pn/bg-pg = --app-panel-3/2 = #FFFFFF (white), yet product name / price /
 *      spec value / section title were text-slate-100 (#f1f5f9, near-white) =>
 *      white text on white panel => effectively invisible.
 * Decision (sec 1-2-5 #1, deferred twice): primary text on white panel => text-slate-900.
 * Preserve: body text-slate-700, secondary slate-500/600, dark banner text-white.
 *
 * #4 (vertical bloat) — empty image section collapses from a 400px aspect-video box to
 * a compact honest-empty bar; empty spec block compacted py-8 => py-4.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const DETAIL = "src/app/products/[id]/page.tsx";

describe("detail #1 - invisible text (white-on-white) regression zero", () => {
  it("text-slate-100 removed entirely", () => {
    const src = read(DETAIL);
    expect(src).not.toContain("text-slate-100");
  });

  it("product name CardTitle is high-contrast slate-900", () => {
    const src = read(DETAIL);
    expect(src).toContain("font-bold text-slate-900 leading-tight");
  });

  it("right-panel price is high-contrast slate-900", () => {
    const src = read(DETAIL);
    expect(src).toContain("text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight");
  });

  it("mobile bottom-bar price is high-contrast slate-900", () => {
    const src = read(DETAIL);
    expect(src).toContain("text-xl font-bold text-slate-900");
  });
});

describe("detail #4 - empty-section collapse + honest-empty preserved", () => {
  it("empty image: no full-height placeholder icon", () => {
    const src = read(DETAIL);
    expect(src).not.toContain("h-16 w-16 text-gray-300");
  });

  it("PD-K: 이미지 = 히어로 소형 썸네일(big 박스 bloat 제거, 빈 이미지는 아이콘)", () => {
    const src = read(DETAIL);
    // §product-detail PD-K/PD-flat(§05): 큰 이미지 박스(max-h-400) 폐기 → 히어로 썸네일(시안 96px). anti-bloat 의도 보존.
    expect(src).not.toContain("max-h-[400px]");
    expect(src).toContain("w-20 h-20 md:w-24 md:h-24");
  });

  it("empty spec: compacted py-4", () => {
    const src = read(DETAIL);
    expect(src).toContain("text-gray-400 py-4 text-xs");
  });
});

describe("detail #1 - hierarchy / contrast preserved (regression zero)", () => {
  it("body catalog number 가독 대비 보존 (§product-detail PD-J: slate-700→slate-900 통합 카드, 대비 향상)", () => {
    // §product-detail PD-J — Cat.No 가 "제품 사양" 통합 카드로 이동하며 값 색이 slate-700→slate-900(더 진함=대비↑).
    //   보호 의도(카탈로그번호 가독 대비 + font-mono)는 보존·향상. 정확 클래스만 갱신.
    const src = read(DETAIL);
    // 2026-08-09 완화 — 클래스 토큰 **순서 무관**. 원 정규식은 `text-slate-900 font-mono` 순서에만
    //   매칭돼, §2 중복 "제품 사양" 카드 삭제로 그 순서의 spot 이 사라지자 RED 가 됐다.
    //   보호 의도(카탈로그번호 = mono + slate-900 대비)는 현행 구현이 그대로 충족한다.
    expect(src).toMatch(/font-mono[^"]*text-slate-900|text-slate-900[^"]*font-mono/);
  });

  // supersede(§product-detail-refinement 계약④): 다크 맞춤견적 카드 자체가 폐기됐다.
  //   "다크 배너의 텍스트 대비"라는 원 계약은 대상 소멸로 무효 → 잠글 것은 **다크 카드 미부활**과
  //   대체 경로(/support 영업 문의 링크) 보존이다.
  it("다크 맞춤견적 카드 미부활 (대비 오염 원인 제거)", () => {
    const src = read(DETAIL);
    expect(src).not.toContain("from-gray-900 to-gray-800");
    expect(src).toMatch(/<Link href="\/support"[^>]*>영업 문의<\/Link>/);
  });
});
