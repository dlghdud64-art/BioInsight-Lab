/**
 * §11.230c (d) #quote-table-focus-reset — 호영님 v2 #23 (e) §11.230a Out of scope park 항목
 *
 * Context:
 *   §11.230a (c+d, keyboard nav + tooltip) Out of scope 의 명시된 park 항목 (d):
 *   "focus index sortedQuotes change 시 reset" — useEffect 미추가, 후속 #c 백로그.
 *   §11.230b (a+b, column prefs) land 완료 후 v2 backlog audit (§11.230c) 진입.
 *
 * Truth Reconciliation:
 *   - focusedRowIndex useState default -1 (page.tsx line 796)
 *   - sortedQuotes useMemo deps [filteredQuotes, sortState] (line 1319-1337)
 *   - 4 key 분기 (line 1905~): ArrowDown Math.min(rowIndex + 1, sortedQuotes.length - 1) /
 *     ArrowUp Math.max(prevIndex, 0) guard 존재
 *   - 잠재 stale: focusedRowIndex = 5 상태에서 filter 강화로 sortedQuotes.length 가 3
 *     으로 줄면 out-of-bounds → 다음 ArrowUp 시 의도치 않은 jump
 *
 * canonical truth lock:
 *   - sortedQuotes / sortState / focusedRowIndex semantic 변경 0
 *   - selectedQuoteId / viewMode 변경 0
 *   - §11.226 ~ §11.230b cluster invariant 모두 보존
 *
 * Minimal-Diff:
 *   page.tsx 안 1 useEffect 추가 (focusedRowIndex useState 직후).
 *   `if (focusedRowIndex >= sortedQuotes.length) setFocusedRowIndex(-1)`.
 *   deps [sortedQuotes.length, focusedRowIndex].
 *   length-only check — 사용자가 sort 변경 후 같은 index row 유지 시도 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.230c (d) #1 — focus index reset useEffect", () => {
  it("useEffect — focusedRowIndex >= sortedQuotes.length 시 reset", () => {
    // useEffect block 안 length 비교 + setFocusedRowIndex(-1) 호출
    expect(page).toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]{0,400}focusedRowIndex\s*>=\s*sortedQuotes\.length[\s\S]{0,200}setFocusedRowIndex\(-1\)/,
    );
  });

  it("deps array — [sortedQuotes.length, focusedRowIndex] 포함", () => {
    // useEffect deps 가 sortedQuotes.length + focusedRowIndex 둘 다 포함
    expect(page).toMatch(
      /useEffect\([\s\S]{0,500}\}\s*,\s*\[\s*sortedQuotes\.length\s*,\s*focusedRowIndex\s*\]/,
    );
  });

  it("§11.230c (d) trace marker comment", () => {
    expect(page).toMatch(/§11\.230c[\s\S]{0,200}focus[\s\S]{0,200}reset/i);
  });
});

describe("§11.230c (d) #2 — invariant 보존", () => {
  it("§11.230a focusedRowIndex useState (-1 default) 보존", () => {
    expect(page).toMatch(/const \[focusedRowIndex, setFocusedRowIndex\] = useState<number>\(-1\)/);
  });

  it("§11.230a 4 key 분기 (ArrowUp/Down/Enter/Escape) 보존", () => {
    expect(page).toMatch(/ArrowDown[\s\S]{0,200}setFocusedRowIndex/);
    expect(page).toMatch(/ArrowUp[\s\S]{0,200}setFocusedRowIndex/);
    expect(page).toMatch(/openQuoteContextRail.*"row"/);
    expect(page).toMatch(/closeQuoteContextRail.*"esc_key"/);
  });

  it("§11.227 sortedQuotes useMemo 보존 (sortState 기반)", () => {
    expect(page).toMatch(/const sortedQuotes = useMemo/);
    expect(page).toMatch(/sortState\.key === null/);
  });

  it("§11.230b columnPrefs / visibleColumns / DEFAULT_COLUMN_PREFS 보존", () => {
    expect(page).toMatch(/DEFAULT_COLUMN_PREFS/);
    expect(page).toMatch(/const \[columnPrefs, setColumnPrefs\]/);
  });
});
