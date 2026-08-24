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

  it("checkbox 가 isDispatchable 일 때만 render", () => {
    /* 승계 (§purchased-falls-through-to-not-sent 실행 축 분리 2026-08-24).
     * 🛑 이 단언은 RED 가 아니라 **침묵**이었다 — 옛 제목·주석은 canonical 을
     *   `deriveRailState(quote) === "request_not_sent"` 라고 말하는데, 실행 축이
     *   isDispatchable 로 옮겨간 뒤에도 통과했다. `/request_not_sent/` 는 그 문자열이
     *   isDispatchable 안에 남아 있어 매칭되고, 두 번째 정규식은 첫 대안(`isSelectable &&`)이
     *   살아 매칭됐다. 결정은 그대로인데 **문서가 옛 canonical 을 가리키는** 형태라
     *   다음 세션이 이 파일을 읽고 실행 축을 표시 축에 다시 위임할 수 있었다.
     *   → 제목·주석을 실물로 맞추고, 단언을 슬롯 단위로 좁힌다(침묵 제거). */
    expect(source).toMatch(/isSelectable=\{isDispatchable\(quote\)\}/);
    expect(source).toMatch(/isSelectable\s*&&/);
    /* 역방향 잠금 — 선택 축이 표시 축 직접 비교로 되돌아가면 RED */
    expect(source).not.toMatch(/isSelectable=\{deriveRailState/);
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
