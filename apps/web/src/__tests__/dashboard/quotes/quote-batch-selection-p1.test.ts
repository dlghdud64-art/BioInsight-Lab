/**
 * §11.241 #quote-batch-selection-p1 — 호영님 P1 견적 관리 테이블 선택 강화 (필터 연동 + 키보드 접근성)
 *
 * 호영님 spec (2026-05-13):
 *   #5 필터 연동 (P1) — audit only (이미 selectablePending = filteredQuotes 기반 land)
 *   #6 키보드 접근성 (P1):
 *     Space        — 포커스 row 선택/해제 (toggleQuoteSelection)
 *     Shift+클릭   — 범위 선택 (lastSelectedIndex ~ rowIndex)
 *     Ctrl/Cmd+A   — 전체 선택 (sortedQuotes 전체)
 *     Escape       — selectedQuoteIds.size > 0 시 clearSelection,
 *                    else 기존 §11.230a closeQuoteContextRail("esc_key")
 *
 * canonical truth lock:
 *   - selectedQuoteIds Set / toggleQuoteSelection / sortedQuotes 변경 0
 *   - §11.230a/c keyboard nav 패턴 reuse
 *   - §11.240 row checkbox + dropdown + 가드레일 invariant 보존
 *
 * Minimal-Diff:
 *   - page.tsx: lastSelectedIndex useState 추가 + tbody tr onKeyDown Space 분기 +
 *     onClick e.shiftKey 분기 + document.keydown Ctrl+A useEffect + Escape clearSelection 분기
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.241 #5 — 필터 연동 audit (이미 land)", () => {
  it("selectablePending = filteredQuotes.filter (필터 적용 후 선택)", () => {
    expect(page).toMatch(
      /selectablePending\s*=\s*filteredQuotes\.filter/,
    );
  });

  it("§11.241 trace marker comment 명시 (#5 audit + #6 keyboard)", () => {
    expect(page).toMatch(/§11\.241[\s\S]{0,400}(필터 연동|keyboard|Space|Shift)/i);
  });
});

describe("§11.241 #6a — Space 키 선택/해제", () => {
  it("Space key 분기 — toggleQuoteSelection(quote.id) 호출", () => {
    // tbody tr onKeyDown 안 e.key === " " 또는 "Space" 분기 + toggleQuoteSelection 호출
    expect(page).toMatch(
      /e\.key === " "[\s\S]{0,300}(toggleQuoteSelection\(quote\.id\)|preventDefault)/,
    );
  });
});

describe("§11.241 #6b — Shift+클릭 범위 선택", () => {
  it("lastSelectedIndex useState 추가 (-1 default 또는 null)", () => {
    expect(page).toMatch(
      /const \[lastSelectedIndex,\s*setLastSelectedIndex\] = useState<(number|number \| null)>/,
    );
  });

  it("tbody tr onClick — e.shiftKey 분기 + 범위 select", () => {
    // onClick 분기 안 e.shiftKey + Math.min/max + toggleQuoteSelection 또는 setSelectedQuoteIds
    expect(page).toMatch(
      /e\.shiftKey[\s\S]{0,500}(Math\.min[\s\S]{0,200}lastSelectedIndex|lastSelectedIndex[\s\S]{0,200}Math\.min)/,
    );
  });
});

describe("§11.241 #6c — Ctrl/Cmd+A 전체 선택", () => {
  it("document.keydown listener — Ctrl/Cmd + A 분기 + 전체 선택 (양방향)", () => {
    // useEffect 안 document.addEventListener("keydown", ...) — handler 가 useEffect 위/아래
    //   다 가능 → 양방향 매칭.
    expect(page).toMatch(/document\.(addEventListener|onkeydown)/);
    expect(page).toMatch(/(ctrlKey\s*\|\|\s*[^)]*metaKey|metaKey\s*\|\|\s*[^)]*ctrlKey)/);
  });

  it("Ctrl/Cmd+A — sortedQuotes 전체 setSelectedQuoteIds 호출 (intermediate allIds 변수 허용)", () => {
    // a key 분기 (!== / === 양방향) + setSelectedQuoteIds + sortedQuotes.map 동시 grep
    expect(page).toMatch(/e\.key.{0,10}(!==|===).{0,3}"[aA]"/);
    expect(page).toMatch(/setSelectedQuoteIds/);
    expect(page).toMatch(/new Set\(sortedQuotes\.map/);
  });
});

describe("§11.241 #6d — Escape 분기 (selectedQuoteIds > 0 시 clearSelection)", () => {
  it("Escape — selectedQuoteIds.size > 0 시 clearSelection, else closeQuoteContextRail", () => {
    // §11.230a 기존 Escape closeQuoteContextRail("esc_key") 분기 위에 size > 0 조건 추가
    expect(page).toMatch(
      /e\.key === "Escape"[\s\S]{0,500}selectedQuoteIds\.size\s*>\s*0[\s\S]{0,200}clearSelection/,
    );
  });
});

describe("§11.241 #7 — invariant 보존", () => {
  it("§11.240 row checkbox (data-batch-select-row) + 가드레일 보존", () => {
    expect(page).toMatch(/data-batch-select-row/);
    expect(page).toMatch(/const reviewDisabled = useMemo/);
  });

  it("§11.230a focusedRowIndex + 4 key 분기 보존", () => {
    expect(page).toMatch(/const \[focusedRowIndex, setFocusedRowIndex\] = useState<number>\(-1\)/);
    expect(page).toMatch(/ArrowDown[\s\S]{0,300}setFocusedRowIndex/);
  });

  it("§11.230c (c) Home/End/PageUp/PageDown 보존", () => {
    expect(page).toMatch(/e\.key === "Home"[\s\S]{0,400}data-row-index/);
    expect(page).toMatch(/e\.key === "End"[\s\S]{0,400}data-row-index/);
  });

  it("§11.230c (d) sortedQuotes change focus reset useEffect 보존 (anchor 진화 정합)", () => {
    // #quote-table-focus-reset-anchor — setFocusedRowIndex(-1) → setFocusedRowIndex(nextFocusIndex)
    expect(page).toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]{0,500}focusedRowIndex\s*>=\s*sortedQuotes\.length[\s\S]{0,300}setFocusedRowIndex\((-1|nextFocusIndex)/,
    );
  });

  it("§11.230b columnPrefs + visibleColumns 보존", () => {
    expect(page).toMatch(/DEFAULT_COLUMN_PREFS/);
    expect(page).toMatch(/visibleColumns\.map/);
  });

  it("§11.228 canonical state (selectedQuoteIds Set + toggleQuoteSelection) 보존", () => {
    expect(page).toMatch(/const \[selectedQuoteIds, setSelectedQuoteIds\] = useState<Set<string>>/);
    expect(page).toMatch(/const toggleQuoteSelection = useCallback/);
    expect(page).toMatch(/const clearSelection = useCallback/);
  });
});
