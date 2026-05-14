/**
 * §11.230c (c) #quote-table-keyboard-extended — 호영님 v2 #23 (c) §11.230a Out of scope 확장
 *
 * Context:
 *   §11.230a Out of scope (b) 명시 park 항목 — Home/End/PageUp/PageDown 4 key 추가.
 *   §11.230c (d) (focus reset) land 완료 후 cluster lineage 자연 후속.
 *
 * 호영님 v2 spec sheet #23 (c) "키보드 navigation" — §11.230a 가 ArrowUp/Down/Enter/Escape
 *   4 key 만 land. 큰 테이블 (12+ rows) 에서 첫 row / 마지막 row 즉시 이동 + 페이지 단위
 *   jump 가 운영 흐름 강화. Karpathy minimal-diff — onKeyDown switch 안 4 case 추가만.
 *
 * canonical truth lock:
 *   - sortedQuotes / openQuoteContextRail / closeQuoteContextRail 변경 0
 *   - focusedRowIndex semantic 변경 0
 *   - §11.226 ~ §11.230b + §11.230c (d) cluster invariant 보존
 *
 * Minimal-Diff:
 *   page.tsx tbody tr onKeyDown switch 안 4 case 추가:
 *     - Home → setFocusedRowIndex(0) + DOM focus first row
 *     - End → setFocusedRowIndex(sortedQuotes.length - 1)
 *     - PageDown → Math.min(rowIndex + 10, sortedQuotes.length - 1)
 *     - PageUp → Math.max(rowIndex - 10, 0)
 *   event.preventDefault() default scroll behavior 차단.
 *   DOM focus selector (`tr[data-row-index]`) 패턴 reuse — §11.230a 정합.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.230c (c) #1 — Home / End 키 분기 (즉시 이동)", () => {
  it("Home key — setFocusedRowIndex(0) + DOM focus first row", () => {
    // Home key 분기 + 0 index + preventDefault + querySelector reuse
    expect(page).toMatch(
      /e\.key === "Home"[\s\S]{0,300}preventDefault[\s\S]{0,200}setFocusedRowIndex\(0\)/,
    );
  });

  it("End key — setFocusedRowIndex(sortedQuotes.length - 1)", () => {
    expect(page).toMatch(
      /e\.key === "End"[\s\S]{0,300}preventDefault[\s\S]{0,200}setFocusedRowIndex\(sortedQuotes\.length\s*-\s*1\)/,
    );
  });
});

describe("§11.230c (c) #2 — PageDown / PageUp 키 분기 (10건 jump)", () => {
  it("PageDown — Math.min(rowIndex + 10, sortedQuotes.length - 1) clamp", () => {
    expect(page).toMatch(
      /e\.key === "PageDown"[\s\S]{0,400}preventDefault[\s\S]{0,300}Math\.min\(\s*rowIndex\s*\+\s*10\s*,\s*sortedQuotes\.length\s*-\s*1\s*\)/,
    );
  });

  it("PageUp — Math.max(rowIndex - 10, 0) clamp", () => {
    expect(page).toMatch(
      /e\.key === "PageUp"[\s\S]{0,400}preventDefault[\s\S]{0,300}Math\.max\(\s*rowIndex\s*-\s*10\s*,\s*0\s*\)/,
    );
  });
});

describe("§11.230c (c) #3 — DOM focus selector reuse + trace marker", () => {
  it("4 신규 key 분기 모두 querySelector tr[data-row-index] 패턴 reuse", () => {
    // §11.230a 의 DOM focus 패턴이 신규 4 key 분기 안에도 적용 (focus 이동)
    // (Home/End/PageUp/PageDown 분기마다 1번 이상 패턴 매칭)
    const homeMatch = page.match(
      /e\.key === "Home"[\s\S]{0,400}data-row-index/,
    );
    const endMatch = page.match(/e\.key === "End"[\s\S]{0,400}data-row-index/);
    const pageDownMatch = page.match(
      /e\.key === "PageDown"[\s\S]{0,500}data-row-index/,
    );
    const pageUpMatch = page.match(
      /e\.key === "PageUp"[\s\S]{0,500}data-row-index/,
    );
    expect(homeMatch).toBeTruthy();
    expect(endMatch).toBeTruthy();
    expect(pageDownMatch).toBeTruthy();
    expect(pageUpMatch).toBeTruthy();
  });

  it("§11.230c (c) trace marker comment", () => {
    expect(page).toMatch(/§11\.230c.*\(c\)[\s\S]{0,200}Home.*End.*Page|Home.*End.*Page[\s\S]{0,200}§11\.230c/);
  });
});

describe("§11.230c (c) #4 — invariant 보존", () => {
  it("§11.230a 기존 4 key 분기 보존 (ArrowUp/Down/Enter/Escape)", () => {
    expect(page).toMatch(/e\.key === "ArrowDown"[\s\S]{0,400}setFocusedRowIndex/);
    expect(page).toMatch(/e\.key === "ArrowUp"[\s\S]{0,400}setFocusedRowIndex/);
    expect(page).toMatch(/e\.key === "Enter"[\s\S]{0,200}openQuoteContextRail/);
    expect(page).toMatch(/e\.key === "Escape"[\s\S]{0,200}closeQuoteContextRail/);
  });

  it("§11.230c (d) sortedQuotes change focus reset useEffect 보존", () => {
    // #quote-table-focus-reset-anchor 진화 정합 — setFocusedRowIndex(-1) →
    //   setFocusedRowIndex(nextFocusIndex) 양방향 매칭 (anchor 진화 후
    //   selectedIndex 또는 0 으로 focus 이동).
    expect(page).toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]{0,500}focusedRowIndex\s*>=\s*sortedQuotes\.length[\s\S]{0,300}setFocusedRowIndex\((-1|nextFocusIndex)/,
    );
  });

  it("§11.230b columnPrefs / visibleColumns 보존", () => {
    expect(page).toMatch(/DEFAULT_COLUMN_PREFS/);
    expect(page).toMatch(/visibleColumns\.map/);
  });
});
