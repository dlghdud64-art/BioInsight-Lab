/**
 * §11.230b #quote-table-column-prefs — 호영님 v2 #23 (a+b)
 *
 * 호영님 v2 spec sheet (2026-05-11):
 *   #23 테이블 고도화 — (a) 컬럼 리사이즈 + (b) 컬럼 커스텀 (보임/숨김 + 순서)
 *
 * 호영님 분할 결정 (2026-05-12):
 *   §11.230a (c+d, a11y+tooltip) → §11.230b (a+b, 일괄)
 *   localStorage 통합 default — `labaxis-quote-column-prefs` 단일 객체
 *
 * canonical truth lock:
 *   - sortedQuotes / sortState / selectedQuoteId / focusedRowIndex 변경 0
 *   - §11.226 #4 priceColumnHasData / deliveryColumnHasData 우선 (visibility 보다 우위)
 *   - §11.227 sortState 5 컬럼 sortable 보존
 *   - §11.230a tabIndex / onKeyDown / role / aria-label 보존
 *   - HTML5 native drag-and-drop (외부 라이브러리 0)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.230b #1 — ColumnKey enum + DEFAULT_COLUMN_PREFS 상수", () => {
  it("ColumnKey type 정의 (9 컬럼)", () => {
    // type ColumnKey = "title" | "status" | "itemCount" | "responseCount" | "price" | "delivery" | "priority" | "createdAt" | "actions"
    // 또는 const COLUMN_KEYS = [...] as const + ColumnKey = typeof COLUMN_KEYS[number]
    expect(page).toMatch(/ColumnKey/);
    expect(page).toMatch(/"title"[\s\S]{0,400}"status"[\s\S]{0,400}"actions"|"title"[\s\S]{0,800}"actions"/);
  });

  it("9 컬럼 키 모두 포함 — title/status/itemCount/responseCount/price/delivery/priority/createdAt/actions", () => {
    // 9 컬럼 모두 ColumnKey 정의 안 또는 DEFAULT_COLUMN_PREFS 안 노출
    for (const key of ["title", "status", "itemCount", "responseCount", "price", "delivery", "priority", "createdAt", "actions"]) {
      expect(page).toMatch(new RegExp(`["']${key}["']`));
    }
  });

  it("DEFAULT_COLUMN_PREFS 또는 동등 상수 정의 (widths / visibility / order)", () => {
    expect(page).toMatch(/DEFAULT_COLUMN_PREFS|defaultColumnPrefs/);
  });
});

describe("§11.230b #2 — columnPrefs useState + localStorage persist", () => {
  it("columnPrefs useState (widths / visibility / order)", () => {
    expect(page).toMatch(/const\s+\[columnPrefs,\s*setColumnPrefs\]/);
  });

  it("localStorage key — 'labaxis-quote-column-prefs'", () => {
    expect(page).toMatch(/labaxis-quote-column-prefs/);
  });

  it("localStorage hydrate (useEffect mount)", () => {
    // localStorage.getItem(COLUMN_PREFS_LS_KEY) — 상수 또는 literal 사용 허용
    expect(page).toMatch(/localStorage\.getItem\((COLUMN_PREFS_LS_KEY|["']labaxis-quote-column-prefs["'])\)/);
  });

  it("localStorage write (useEffect deps columnPrefs)", () => {
    expect(page).toMatch(/localStorage\.setItem\((COLUMN_PREFS_LS_KEY|["']labaxis-quote-column-prefs["'])/);
  });
});

describe("§11.230b #3 — 컬럼 리사이즈 drag handle (a)", () => {
  it("drag handle mousedown 이벤트 처리", () => {
    expect(page).toMatch(/onMouseDown[\s\S]{0,1000}(resize|columnWidth|width)/);
  });

  it("컬럼별 width style 적용 (th 또는 colgroup)", () => {
    // style={{ width: columnPrefs.widths[key] }} 또는 colgroup col
    expect(page).toMatch(/(width:\s*columnPrefs\.widths|columnPrefs\.widths\[)/);
  });

  it("resize state 또는 활성 column ref", () => {
    // useState 또는 useRef 로 resize 활성 column 추적
    expect(page).toMatch(/(resizingColumn|setResizingColumn|resizeColumnRef)/);
  });
});

describe("§11.230b #4 — 컬럼 커스텀 popover + 보임/숨김 (b1)", () => {
  it("컬럼 설정 button — Settings icon 또는 SlidersHorizontal", () => {
    // lucide-react 의 Settings / SlidersHorizontal / Columns3 / EyeOff 등 icon import
    expect(page).toMatch(/(Settings|SlidersHorizontal|Columns3|Settings2)/);
  });

  it("컬럼 설정 popover/popup state (open/closed)", () => {
    expect(page).toMatch(/(columnPrefsPopoverOpen|columnSettingsOpen|setColumnPrefsOpen)/);
  });

  it("9 컬럼 visibility checkbox (input type='checkbox' 또는 동등)", () => {
    // popover 안 9 컬럼 checkbox
    expect(page).toMatch(/columnPrefs\.visibility/);
    expect(page).toMatch(/type=["']checkbox["']/);
  });
});

describe("§11.230b #5 — 컬럼 순서 재정렬 HTML5 native drag-and-drop (b2)", () => {
  it("draggable attribute (HTML5 native)", () => {
    expect(page).toMatch(/draggable/);
  });

  it("onDragStart / onDragOver / onDrop 이벤트 핸들러", () => {
    expect(page).toMatch(/onDragStart/);
    expect(page).toMatch(/(onDragOver|onDrop)/);
  });

  it("columnPrefs.order 배열 mutation (order swap 또는 reorder)", () => {
    expect(page).toMatch(/columnPrefs\.order/);
  });
});

describe("§11.230b #6 — §11.226 #4 hasData 우선 (canonical truth 보호)", () => {
  it("priceColumnHasData 보존 (§11.226 invariant)", () => {
    expect(page).toMatch(/priceColumnHasData/);
  });

  it("deliveryColumnHasData 보존 (§11.226 invariant)", () => {
    expect(page).toMatch(/deliveryColumnHasData/);
  });

  it("가격 컬럼 render 조건 — hasData OR visibility (hasData 우선)", () => {
    // visibleColumns useMemo 안 분기: if (key === "price") return priceColumnHasData
    // 또는 thead 안 priceColumnHasData && 패턴
    expect(page).toMatch(/key\s*===\s*["']price["'][\s\S]{0,200}return priceColumnHasData|priceColumnHasData\s*&&|priceColumnHasData\s*\)/);
  });
});

describe("§11.230b invariant 보존 (cluster lineage)", () => {
  it("§11.227 sortState / sortedQuotes 보존", () => {
    expect(page).toMatch(/sortedQuotes/);
    expect(page).toMatch(/sortState|setSortState/);
  });

  it("§11.230a focusedRowIndex / tabIndex / onKeyDown 보존", () => {
    expect(page).toMatch(/focusedRowIndex/);
    // §11.241 — onClick 가 inline arrow function expand 후 tr → tabIndex / onKeyDown 거리 ↑.
    expect(page).toMatch(/<tr[\s\S]{0,1600}tabIndex=/);
    expect(page).toMatch(/<tr[\s\S]{0,1600}onKeyDown=/);
  });

  it("§11.230a native title attribute 보존 (제목 td)", () => {
    expect(page).toMatch(/title=\{tableDisplayTitle\}/);
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

  it("openQuoteContextRail / closeQuoteContextRail 보존 (canonical mutation)", () => {
    expect(page).toMatch(/openQuoteContextRail/);
    expect(page).toMatch(/closeQuoteContextRail/);
  });

  it("cluster trace marker (§11.230b)", () => {
    expect(page).toMatch(/§11\.230b|#quote-table-column-prefs|컬럼 리사이즈|컬럼 커스텀/);
  });
});
