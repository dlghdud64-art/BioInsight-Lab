/**
 * #quote-table-focus-reset-anchor
 *
 * Agent Board track: quote-table-focus-reset-anchor.
 * Sorting the quote table must not leave operators with an empty focus target.
 * After a header sort, anchor focus to the selected quote row when available,
 * otherwise to the first row, so the next keyboard action can continue review.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("#quote-table-focus-reset-anchor", () => {
  it("marks header sorting as requiring a focus anchor", () => {
    expect(page).toMatch(/const pendingSortFocusAnchorRef = useRef\(false\)/);
    expect(page).toMatch(
      /const handleSortColumn = useCallback\([\s\S]{0,260}pendingSortFocusAnchorRef\.current = true[\s\S]{0,260}setSortState/,
    );
  });

  it("anchors focus to the selected quote row or first visible row", () => {
    expect(page).toMatch(
      /const selectedIndex = selectedQuoteId[\s\S]{0,220}sortedQuotes\.findIndex\(\(quote\) => quote\.id === selectedQuoteId\)/,
    );
    expect(page).toMatch(/const nextFocusIndex = selectedIndex >= 0 \? selectedIndex : 0/);
    expect(page).toMatch(/pendingSortFocusAnchorRef\.current \|\| focusedRowIndex >= sortedQuotes\.length/);
    expect(page).toMatch(
      /setFocusedRowIndex\(nextFocusIndex\)[\s\S]{0,120}focusQuoteTableRow\(nextFocusIndex\)/,
    );
  });

  it("focuses the anchored DOM row for the next keyboard action", () => {
    expect(page).toMatch(/const focusQuoteTableRow = useCallback/);
    expect(page).toMatch(/document\.querySelector<HTMLTableRowElement>/);
    expect(page).toMatch(/`tr\[data-row-index="\$\{rowIndex\}"\]`/);
    expect(page).toMatch(/row\?\.focus\(\)/);
  });

  it("keeps focus effect dependencies explicit", () => {
    expect(page).toMatch(
      /useEffect\([\s\S]{0,900}\}\s*,\s*\[\s*sortedQuotes\s*,\s*selectedQuoteId\s*,\s*focusedRowIndex\s*,\s*focusQuoteTableRow\s*\]/,
    );
  });
});

describe("#quote-table-focus-reset-anchor invariants", () => {
  it("preserves table focus state default", () => {
    expect(page).toMatch(/const \[focusedRowIndex, setFocusedRowIndex\] = useState<number>\(-1\)/);
  });

  it("preserves keyboard row navigation branches", () => {
    expect(page).toMatch(/ArrowDown[\s\S]{0,220}setFocusedRowIndex/);
    expect(page).toMatch(/ArrowUp[\s\S]{0,220}setFocusedRowIndex/);
    expect(page).toMatch(/openQuoteContextRail.*"row"/);
    expect(page).toMatch(/closeQuoteContextRail.*"esc_key"/);
  });

  it("preserves sortedQuotes and column preference contracts", () => {
    expect(page).toMatch(/const sortedQuotes = useMemo/);
    expect(page).toMatch(/sortState\.key === null/);
    expect(page).toMatch(/DEFAULT_COLUMN_PREFS/);
    expect(page).toMatch(/const \[columnPrefs, setColumnPrefs\]/);
  });
});
