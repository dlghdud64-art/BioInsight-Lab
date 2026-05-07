/**
 * §11.217 Phase 3 — Selection state + checkbox UI regression guard
 *
 * Goal: PENDING (request_not_sent) state quote 만 row checkbox 노출.
 *       page-level selectedQuoteIds Set state + toggleQuoteSelection +
 *       clearSelection handler.
 *
 * canonical truth lock:
 *   - QuoteCard 가 isSelectable prop 받음 (railState === "request_not_sent" 만 true).
 *   - non-PENDING (SENT/RESPONDED/COMPLETED 등) checkbox 0 — UI bug 회귀 차단.
 *   - selection 시 시각적 highlight.
 *   - checkbox click ≠ row click (event propagation 분리).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(__dirname, "../../app/dashboard/quotes/page.tsx");
const source = readFileSync(PATH, "utf8");

describe("§11.217 Phase 3 — Selection state regression guard", () => {
  it("page-level selectedQuoteIds state (Set<string>)", () => {
    expect(source).toMatch(/selectedQuoteIds.*=.*useState.*Set/);
  });

  it("toggleQuoteSelection handler 존재", () => {
    expect(source).toMatch(/toggleQuoteSelection|toggleSelection/);
  });

  it("clearSelection handler 존재 (refetch 후 reset)", () => {
    expect(source).toMatch(/clearSelection|setSelectedQuoteIds.*new Set\(\)/);
  });

  it("§11.217 Phase 3 주석 marker", () => {
    expect(source).toMatch(/§11\.217 Phase 3/);
  });
});

describe("§11.217 Phase 3 — QuoteCard checkbox conditional render", () => {
  it("QuoteCard 에 isSelectable prop", () => {
    expect(source).toMatch(/isSelectable[?:]|isSelectable\s*[=:]/);
  });

  it("QuoteCard 에 onToggleSelect handler prop", () => {
    expect(source).toMatch(/onToggleSelect|onToggleSelection/);
  });

  it("checkbox 가 railState === request_not_sent 일 때만 render", () => {
    // canonical: deriveRailState(quote) === "request_not_sent" 분기
    expect(source).toMatch(/request_not_sent/);
    // checkbox 자체가 conditional render — isSelectable prop 또는 직접 분기
    expect(source).toMatch(/isSelectable\s*&&|railState\s*===\s*"request_not_sent".*checkbox|checkbox.*isSelectable/i);
  });

  it("checkbox click event propagation 분리 (row click 과 별개)", () => {
    // checkbox onClick / onChange 안 e.stopPropagation() 또는 별도 wrapper
    expect(source).toMatch(/stopPropagation/);
  });

  it("checkbox 한국어 aria-label (accessibility)", () => {
    // visible label 0 (sr-only) 또는 한국어 aria-label
    expect(source).toMatch(/aria-label.*선택|sr-only.*선택/);
  });
});

describe("§11.217 Phase 3 — selection 시각적 highlight", () => {
  it("isSelected state 가 row 의 시각적 정합 (border 또는 bg)", () => {
    // canonical truth: isSelected 일 때 border-blue 등 (기존 isSelected 와 별도 — multi-select 정합)
    expect(source).toMatch(/isSelectedForBatch|isInBatchSelection|selectedQuoteIds\.has/);
  });
});
