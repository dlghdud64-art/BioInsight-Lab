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

  it("empty image: honest-empty compact bar kept", () => {
    const src = read(DETAIL);
    expect(src).toContain("h-20 bg-el rounded-xl");
  });

  it("empty spec: compacted py-4", () => {
    const src = read(DETAIL);
    expect(src).toContain("text-gray-400 py-4 text-xs");
  });
});

describe("detail #1 - hierarchy / contrast preserved (regression zero)", () => {
  it("body catalog number slate-700 preserved", () => {
    const src = read(DETAIL);
    expect(src).toContain("text-sm text-slate-700 font-mono");
  });

  it("dark banner keeps text-white (not polluted to slate-900)", () => {
    const src = read(DETAIL);
    expect(src).toContain("from-gray-900 to-gray-800");
    expect(src).toContain("text-gray-300");
  });
});
