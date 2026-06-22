/**
 * §11.240 #quote-batch-selection-p0 — 호영님 P0 견적 관리 테이블 선택/일괄 액션 개선 4 항목
 *
 * 호영님 spec (2026-05-13):
 *   #1 행 개별 체크박스 + 헤더 3-state (P0)
 *   #2 배치 바 선택 건 드롭다운 + 개별 해제 X (P0)
 *   #3 상태 혼재 가드레일 (button disabled + tooltip) (P0)
 *   #5 필터 연동 — 이미 land (selectablePending = filteredQuotes 기반) — P1 audit only
 *   #6 키보드 접근성 — §11.241b 백로그 park
 *
 * canonical truth lock:
 *   - selectedQuoteIds: Set<string> (§11.228 기존 state) 변경 0
 *   - toggleQuoteSelection callback 재사용 — row checkbox + 드롭다운 X + 기존 카드 분기 공통
 *   - filteredQuotes / selectablePending / BatchActionBar 3 mutation CTA 보존
 *   - §11.226 ~ §11.230b + §11.230c (c)(d) cluster invariant 모두 보존
 *
 * Minimal-Diff:
 *   - page.tsx 테이블 분기: thead 첫 column + tbody 첫 column checkbox 추가
 *   - thead checkbox indeterminate state (selectedCount > 0 && < total)
 *   - selected row 배경 (bg-indigo-50)
 *   - BatchActionBar: 시그니처 확장 (selectedQuotes / onRemoveOne / reviewDisabled)
 *   - 드롭다운 UI (button + ChevronDown + max-h-[300px] scroll)
 *   - 가드레일 disabled + title (tooltip)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const BATCH_BAR_PATH = resolve(
  __dirname,
  "../../../components/quotes/dispatch/batch-action-bar.tsx",
);
const page = readFileSync(PAGE_PATH, "utf8");
const batchBar = readFileSync(BATCH_BAR_PATH, "utf8");

describe("§11.240 #1 — 테이블 row + thead 체크박스", () => {
  it("page.tsx 테이블 thead 첫 column = checkbox cell (data-testid 또는 select column)", () => {
    // §11.242 — th attribute order 변경 (sticky left-0 등 추가) → regex range 완화.
    expect(page).toMatch(
      /<th[\s\S]{0,500}data-batch-select-header[\s\S]{0,500}<input[\s\S]{0,200}type="checkbox"/,
    );
  });

  it("tbody row 별 checkbox (data-batch-select-row)", () => {
    // §quote-card-sian — 행 체크박스 커스텀 전환(label 래퍼 + peer sr-only input). type=checkbox 보존(숨김).
    //   label 래퍼로 data-batch-select-row→input 거리 712자 확대 → 한도 500→900.
    expect(page).toMatch(
      /<td[\s\S]{0,500}data-batch-select-row[\s\S]{0,900}<input[\s\S]{0,200}type="checkbox"/,
    );
  });

  it("thead 부분선택 state 표현 (§quote-card-sian: native ref-indeterminate → dash 비주얼)", () => {
    // 커스텀 전환 — native indeterminate property 대신 sortedQuotes.some(선택) 분기 + dash span(h-0.5)으로 표현.
    expect(page).toMatch(/sortedQuotes\.some\(\(q\) => selectedQuoteIds\.has\(q\.id\)\)/);
  });

  it("row checkbox onChange → toggleQuoteSelection 재사용 (canonical state lock)", () => {
    // data-batch-select-row 안 onChange 가 toggleQuoteSelection(quote.id) 호출 (label 래퍼로 거리 800→1100)
    expect(page).toMatch(
      /data-batch-select-row[\s\S]{0,1100}toggleQuoteSelection\(quote\.id\)/,
    );
  });

  it("선택된 row 배경 하이라이트 (bg-indigo-50 또는 bg-blue-50)", () => {
    // tbody tr className 안 isSelectedForBatch 분기로 bg-indigo-50 또는 bg-blue-50
    expect(page).toMatch(
      /selectedQuoteIds\.has\(quote\.id\)[\s\S]{0,200}(bg-indigo-50|bg-blue-50)/,
    );
  });
});

describe("§11.240 #2 — 배치 바 선택 건 드롭다운", () => {
  it("BatchActionBarProps 에 selectedQuotes prop 추가", () => {
    // BatchActionBarQuote[] alias 또는 Quote[] / Array<...> 모두 허용 (canonical type 정합).
    expect(batchBar).toMatch(/selectedQuotes\s*:\s*(BatchActionBarQuote\[\]|Quote\[\]|Array<|ReadonlyArray<)/);
  });

  it("BatchActionBarProps 에 onRemoveOne 콜백 prop 추가", () => {
    expect(batchBar).toMatch(/onRemoveOne\s*:\s*\([\s\S]{0,50}\)\s*=>\s*void/);
  });

  it("드롭다운 toggle button — aria-expanded + ChevronDown icon", () => {
    expect(batchBar).toMatch(/aria-expanded=\{[a-zA-Z_]+\}[\s\S]{0,500}ChevronDown/);
  });

  it("드롭다운 list — 선택된 각 quote 의 firstItemName 또는 title 노출", () => {
    // dropdown 안 selectedQuotes.map 으로 list render — quote.title 또는 firstItem 매핑
    expect(batchBar).toMatch(/selectedQuotes\.map\(/);
  });

  it("개별 X 버튼 onClick → onRemoveOne(quote.id)", () => {
    // dropdown row 의 X button 이 onRemoveOne 호출
    expect(batchBar).toMatch(/onRemoveOne\([\s\S]{0,50}\.id\)/);
  });
});

describe("§11.240 #3 — 상태 혼재 가드레일 (disabled + tooltip)", () => {
  it("reviewDisabled — selectedQuotes 안 응답 없는 건 포함 시 disabled prop", () => {
    expect(batchBar).toMatch(/reviewDisabled\s*:\s*boolean/);
  });

  it("검토 시작 button — reviewDisabled 시 disabled + tooltip", () => {
    // JSX 안 disabled / tooltip attribute 가 검토 시작 라벨 위/아래 둘 다 가능 (양방향 매칭).
    expect(batchBar).toMatch(
      /(검토 시작[\s\S]{0,500}disabled=\{[\s\S]{0,30}reviewDisabled|disabled=\{[\s\S]{0,30}reviewDisabled[\s\S]{0,500}검토 시작)/,
    );
    // §11.230c (b)-2 — title attribute → Tooltip wrapper 진화. native title= 또는
    //   Tooltip + TooltipContent 양방향 매칭. caller drift 0.
    expect(batchBar).toMatch(/reviewDisabled[\s\S]{0,500}(title=|TooltipContent)/);
  });

  it("page.tsx reviewDisabled useMemo — responseCount === 0 quote 포함 분석", () => {
    expect(page).toMatch(
      /const reviewDisabled[\s\S]{0,400}selectedQuotes\.some\(([\s\S]{0,100}responses[\s\S]{0,100}length\s*===\s*0|[\s\S]{0,100}\.responses\?\.length\s*\?\?\s*0\s*\)\s*===\s*0)/,
    );
  });
});

describe("§11.240 #4 — invariant 보존", () => {
  it("§11.228 BatchActionBar 기존 3 mutation CTA 보존 (검토 시작 / 리마인더 / 상태 변경)", () => {
    expect(batchBar).toMatch(/검토 시작/);
    expect(batchBar).toMatch(/리마인더/);
    expect(batchBar).toMatch(/상태 변경/);
  });

  it("§11.228 selectedQuoteIds Set + toggleQuoteSelection canonical state 보존", () => {
    expect(page).toMatch(/const \[selectedQuoteIds, setSelectedQuoteIds\] = useState<Set<string>>/);
    expect(page).toMatch(/const toggleQuoteSelection = useCallback/);
  });

  it("§11.230b columnPrefs + visibleColumns 보존 (드롭다운 추가가 영향 0)", () => {
    expect(page).toMatch(/DEFAULT_COLUMN_PREFS/);
    expect(page).toMatch(/visibleColumns\.map/);
  });

  it("§11.230a focusedRowIndex + 4 key 분기 보존", () => {
    expect(page).toMatch(/const \[focusedRowIndex, setFocusedRowIndex\] = useState<number>\(-1\)/);
    expect(page).toMatch(/ArrowDown[\s\S]{0,200}setFocusedRowIndex/);
  });

  it("§11.230c (d) sortedQuotes change focus reset useEffect 보존 (anchor 진화 정합)", () => {
    // #quote-table-focus-reset-anchor — setFocusedRowIndex(-1) → setFocusedRowIndex(nextFocusIndex)
    //   anchor 진화 후 양방향 매칭 (canonical 진화 정합).
    expect(page).toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]{0,500}focusedRowIndex\s*>=\s*sortedQuotes\.length[\s\S]{0,300}setFocusedRowIndex\((-1|nextFocusIndex)/,
    );
  });

  it("§11.230c (c) Home/End/PageUp/PageDown 4 신규 키 보존 (테이블)", () => {
    expect(page).toMatch(/e\.key === "Home"[\s\S]{0,400}data-row-index/);
    expect(page).toMatch(/e\.key === "End"[\s\S]{0,400}data-row-index/);
  });

  it("§11.240 trace marker comment", () => {
    expect(page).toMatch(/§11\.240[\s\S]{0,300}(batch.*selection|row.*checkbox|drop.*down|guardrail)/i);
  });
});
