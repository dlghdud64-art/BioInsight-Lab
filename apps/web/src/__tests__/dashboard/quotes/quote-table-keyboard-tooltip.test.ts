/**
 * §11.230a #quote-table-keyboard-tooltip — 호영님 v2 #23 (c+d)
 *
 * 호영님 v2 spec sheet (2026-05-11):
 *   #23 테이블 고도화 — 4 sub-spec 중 (c) 셀 툴팁 + (d) 키보드 navigation
 *
 * 호영님 분할 결정 (2026-05-12):
 *   §11.230a = (c) + (d) — a11y + tooltip (low risk, state shape 변경 0)
 *   §11.230b = (a) + (b) — 컬럼 리사이즈 + 커스텀 (높은 risk, state shape 변경)
 *
 * canonical truth lock:
 *   - sortedQuotes / openQuoteContextRail / closeQuoteContextRail 변경 0
 *   - selectedQuoteId / viewMode / sortState 변경 0
 *   - §11.226 ~ §11.229 cluster invariant 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.230a #1 — 제목 셀 truncate 시 native title attribute", () => {
  it("tbody 제목 td 에 title={tableDisplayTitle} 또는 동등 attribute", () => {
    // truncate text 의 full text hover 노출 — native title 사용
    expect(page).toMatch(/tableDisplayTitle[\s\S]{0,400}title=\{tableDisplayTitle\}|title=\{tableDisplayTitle\}[\s\S]{0,400}tableDisplayTitle/);
  });

  it("기존 truncate 클래스 보존 (§11.230b 후 inline maxWidth: width)", () => {
    // §11.230b dynamic refactor 후 max-w-[280px] hardcoded → inline style maxWidth: width
    // (title 컬럼 DEFAULT_COLUMN_PREFS.widths.title = 280)
    expect(page).toMatch(/key === ["']title["'][\s\S]{0,400}truncate|truncate[\s\S]{0,400}title=\{tableDisplayTitle\}|max-w-\[280px\][\s\S]{0,80}truncate/);
  });
});

describe("§11.230a #2 — 키보드 navigation (tbody tr)", () => {
  it("focusedRowIndex useState 정의", () => {
    expect(page).toMatch(/const\s+\[focusedRowIndex,\s*setFocusedRowIndex\]/);
  });

  it("focusedRowIndex 초기값 -1 또는 null (no focus default)", () => {
    expect(page).toMatch(/setFocusedRowIndex\]\s*=\s*useState[\s\S]{0,80}(-1|null)/);
  });

  it("tbody tr 에 tabIndex prop 추가", () => {
    // viewMode 'table' 분기 안 tr 에 tabIndex
    expect(page).toMatch(/<tr[\s\S]{0,500}tabIndex=/);
  });

  it("tbody tr 에 role='button' 또는 동등 a11y role", () => {
    expect(page).toMatch(/<tr[\s\S]{0,500}role=["']button["']|<tr[\s\S]{0,500}role=["']row["']/);
  });

  it("tbody tr 에 onKeyDown handler", () => {
    // §11.241 — onClick 가 inline arrow function 으로 확장됨 (Shift+클릭 분기 추가)
    //   → tr 시작 부터 onKeyDown 까지 거리 ↑. {0,800} → {0,1600} 완화.
    expect(page).toMatch(/<tr[\s\S]{0,1600}onKeyDown=/);
  });

  it("onKeyDown body — ArrowUp 분기", () => {
    expect(page).toMatch(/(ArrowUp|"ArrowUp"|'ArrowUp')/);
  });

  it("onKeyDown body — ArrowDown 분기", () => {
    expect(page).toMatch(/(ArrowDown|"ArrowDown"|'ArrowDown')/);
  });

  it("onKeyDown body — Enter 분기 (openQuoteContextRail 호출)", () => {
    expect(page).toMatch(/(Enter|"Enter"|'Enter')[\s\S]{0,600}openQuoteContextRail/);
  });

  it("onKeyDown body — Escape 분기 (closeQuoteContextRail 호출)", () => {
    expect(page).toMatch(/(Escape|"Escape"|'Escape')[\s\S]{0,600}close[a-zA-Z]*\(/);
  });

  it("tbody tr 에 aria-label (행 정보)", () => {
    expect(page).toMatch(/<tr[\s\S]{0,800}aria-label=/);
  });
});

describe("§11.230a invariant 보존 (cluster lineage)", () => {
  it("§11.227 sortedQuotes / sortState invariant 보존", () => {
    expect(page).toMatch(/sortedQuotes/);
    expect(page).toMatch(/sortState|setSortState/);
  });

  it("§11.226 shortenActionLabel / tableDisplayTitle 보존", () => {
    expect(page).toMatch(/shortenActionLabel/);
    expect(page).toMatch(/tableDisplayTitle/);
  });

  it("§11.228 BatchActionBar 3 mutation CTA forward 보존", () => {
    expect(page).toMatch(/BatchActionBar[\s\S]{0,800}onReminderStart=/);
    expect(page).toMatch(/BatchActionBar[\s\S]{0,800}onStatusChangeStart=/);
  });

  it("§11.225 organizationVendorProducts 3 caller forward 보존", () => {
    expect(page).toMatch(/getQuoteDispatchPreflight\([\s\S]{0,200}organizationVendorProducts/);
  });

  it("openQuoteContextRail / closeQuoteContextRail 함수 보존 (canonical mutation)", () => {
    expect(page).toMatch(/openQuoteContextRail/);
    expect(page).toMatch(/close[a-zA-Z]*QuoteContextRail|closeQuoteContextRail/);
  });

  it("tbody tr onClick 기존 동작 보존 (마우스 클릭 흐름)", () => {
    // §11.241 — onClick body 가 Shift+클릭 분기 추가로 확장 → openQuoteContextRail 거리 ↑.
    //   <tr> 시작부터 onClick 까지 + onClick 안 inline arrow expand 으로 거리 1600+.
    expect(page).toMatch(/<tr[\s\S]{0,1600}onClick=\{[\s\S]{0,1600}openQuoteContextRail/);
  });

  it("cluster trace marker (§11.230a)", () => {
    expect(page).toMatch(/§11\.230a|#quote-table-keyboard-tooltip|키보드 navigation/);
  });
});
