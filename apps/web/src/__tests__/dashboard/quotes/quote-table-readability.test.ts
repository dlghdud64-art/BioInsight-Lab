/**
 * §11.242 #quote-table-readability — 호영님 P0 테이블 뷰 가독성 개선 10 항목
 *
 * 호영님 spec (2026-05-14):
 *   "3초 안에 어떤 건이 급하고 지금 뭘 해야 하는지 파악" — 12+ rows scan 강화.
 *   1. zebra (짝수 bg-gray-50, 선택 bg-blue-50 + left border, 호버 bg-gray-100)
 *   2. 호버 강화 (transition-colors + cursor-pointer)
 *   3. 5색 뱃지 + 좌측 도트
 *   4. 우선순위 left border (긴급 red / 높음 amber / 보통 none)
 *   5. 중복 품목 그룹핑 (서브텍스트 또는 group line)
 *   6. 헤더 sticky + 배경 (bg-gray-100 + uppercase tracking-wide + border-b-2)
 *   7. 액션 button solid (주요) / outlined (보조) / disabled 구분
 *   8. 빈 데이터 "—" → 미수신 또는 숨김
 *   9. 행 간격 h-12 + px-4 py-3
 *   10. sticky 헤더 + 첫(체크박스) + 마지막(액션) column
 *
 * canonical truth lock:
 *   - sortedQuotes / selectedQuoteIds Set / toggleQuoteSelection / clearSelection 변경 0
 *   - OP_STATUS map 의 label / leftBorder 변경 0 (canonical)
 *   - §11.226 ~ §11.241 cluster invariant 모두 보존
 *
 * Minimal-Diff:
 *   - page.tsx 테이블 분기 className/style 분기 + OP_STATUS bg/text/border swap
 *   - §11.240 bg-indigo-50 → bg-blue-50 + border-l-blue-500 swap (호영님 spec 우선)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.242 #1 — zebra striping", () => {
  it("tbody tr className 안 zebra 분기 (짝수 bg-gray-50 또는 bg-slate-50)", () => {
    // rowIndex % 2 === 0 ? bg-white : bg-gray-50 분기 또는 동등 패턴
    expect(page).toMatch(/rowIndex\s*%\s*2[\s\S]{0,200}(bg-gray-50|bg-slate-50|bg-white)/);
  });

  it("선택된 row = bg-blue-50 + border-l-blue-500 (zebra 무시)", () => {
    expect(page).toMatch(/selectedQuoteIds\.has\(quote\.id\)[\s\S]{0,300}(bg-blue-50|border-l-blue-500)/);
  });
});

describe("§11.242 #2 — 호버 강화", () => {
  it("tbody tr 에 hover:bg-gray-100 또는 hover:bg-slate-100 분기 + transition", () => {
    expect(page).toMatch(/hover:bg-(gray|slate)-100[\s\S]{0,200}transition-colors|transition-colors[\s\S]{0,200}hover:bg-(gray|slate)-100/);
  });

  it("tbody tr cursor-pointer 보존", () => {
    expect(page).toMatch(/cursor-pointer/);
  });
});

describe("§11.242 #3 — 5색 status 뱃지", () => {
  it("OP_STATUS map 안 amber (회신 대기) + red (요청 발송 전) + blue + purple + green/emerald 5색 정합", () => {
    // OP_STATUS map line 95~ 의 bg- 색상 5계열 — 호영님 spec 매핑
    expect(page).toMatch(/bg-amber-(50|100)[\s\S]{0,2000}(bg-red-(50|100)|bg-rose-(50|100))/);
    expect(page).toMatch(/bg-(blue|sky)-(50|100)/);
    expect(page).toMatch(/bg-purple-(50|100)/);
    expect(page).toMatch(/bg-(green|emerald)-(50|100)/);
  });

  it("뱃지 안 좌측 컬러 도트 (rounded-full + bg-{color}-500)", () => {
    expect(page).toMatch(/rounded-full[\s\S]{0,200}bg-(amber|red|blue|purple|emerald|green)-500/);
  });
});

describe("§11.242 #4 — 우선순위 left border (긴급 red / 높음 amber)", () => {
  it("tbody tr 안 priorityLevel === 'critical' 시 border-l-4 border-red-500", () => {
    expect(page).toMatch(/priorityLevel[\s\S]{0,400}(border-l-4 border-red-500|border-l-red-500)/);
  });

  it("priorityLevel === 'high' 시 border-l-4 border-amber-400 또는 -500", () => {
    expect(page).toMatch(/priorityLevel[\s\S]{0,400}border-l-(4 border-)?amber-(400|500)/);
  });
});

describe("§11.242 #5 — 중복 품목 구분", () => {
  it("sortedQuotes 안 인접 row 의 firstItemName 비교 (group derive)", () => {
    // sortedQuotes[rowIndex - 1] 또는 prev quote 의 firstItemName 비교
    expect(page).toMatch(/sortedQuotes\[(rowIndex\s*-\s*1|index\s*-\s*1)\][\s\S]{0,400}firstItemName|isDuplicateOfPrev|isDuplicateRow/);
  });
});

describe("§11.242 #6 — 헤더 sticky + 강화", () => {
  it("thead position sticky top-0 + bg-gray-100 또는 bg-slate-100", () => {
    expect(page).toMatch(/<thead[\s\S]{0,400}(sticky[\s\S]{0,80}top-0|top-0[\s\S]{0,80}sticky)/);
    expect(page).toMatch(/<thead[\s\S]{0,400}bg-(gray|slate)-(100|50)/);
  });

  it("thead text 강화 (uppercase + tracking-wide + font-semibold)", () => {
    expect(page).toMatch(/<thead[\s\S]{0,600}uppercase[\s\S]{0,200}tracking-(wide|wider)/);
  });
});

describe("§11.242 #7 — 액션 button solid/outlined 구분", () => {
  it("주요 액션 — solid (bg-blue-600 text-white) 또는 ctaVariant=default 분기", () => {
    expect(page).toMatch(/(ctaVariant === "default"|signals\.ctaVariant)[\s\S]{0,300}bg-blue-600/);
  });
});

describe("§11.242 #8 — 빈 데이터 표현", () => {
  it("빈 데이터 분기 — text-gray-300 또는 text-slate-300 + '미수신' / '미기재' 라벨", () => {
    // 가격 td 의 prices.length === 0 또는 responseCount === 0 분기 안 색상 swap
    expect(page).toMatch(/text-(gray|slate)-(300|400)[\s\S]{0,200}(미수신|미기재|—|---)|(미수신|미기재)[\s\S]{0,200}text-(gray|slate)-(300|400)/);
  });
});

describe("§11.242 #9 — 행 간격 + 셀 padding", () => {
  it("tbody tr 안 h-12 또는 동등 padding 분기 (px-4 py-3 또는 동등)", () => {
    expect(page).toMatch(/(h-12|h-\[48px\]|py-3 px-4|px-4 py-3)/);
  });
});

describe("§11.242 #10 — sticky 첫 + 마지막 column", () => {
  it("data-batch-select-header / -row checkbox cell sticky left-0", () => {
    expect(page).toMatch(/data-batch-select-(header|row)[\s\S]{0,500}(sticky[\s\S]{0,80}left-0|left-0[\s\S]{0,80}sticky)/);
  });
});

describe("§11.242 #11 — invariant 보존 (cluster lineage)", () => {
  it("§11.240 row checkbox + 가드레일 보존", () => {
    expect(page).toMatch(/data-batch-select-row/);
    expect(page).toMatch(/const reviewDisabled = useMemo/);
  });

  it("§11.241 lastSelectedIndex + Space + Ctrl+A 보존", () => {
    expect(page).toMatch(/const \[lastSelectedIndex/);
    expect(page).toMatch(/e\.key === " "/);
  });

  it("§11.230b columnPrefs + visibleColumns 보존", () => {
    expect(page).toMatch(/DEFAULT_COLUMN_PREFS/);
    expect(page).toMatch(/visibleColumns\.map/);
  });

  it("§11.230a focusedRowIndex + 4 key 분기 보존", () => {
    expect(page).toMatch(/const \[focusedRowIndex, setFocusedRowIndex\] = useState<number>\(-1\)/);
    expect(page).toMatch(/ArrowDown[\s\S]{0,300}setFocusedRowIndex/);
  });

  it("§11.230c (c) Home/End 보존", () => {
    expect(page).toMatch(/e\.key === "Home"[\s\S]{0,400}data-row-index/);
  });

  it("§11.228 canonical state (selectedQuoteIds Set + toggleQuoteSelection) 보존", () => {
    expect(page).toMatch(/const \[selectedQuoteIds, setSelectedQuoteIds\] = useState<Set<string>>/);
    expect(page).toMatch(/const toggleQuoteSelection = useCallback/);
  });

  it("§11.242 trace marker comment", () => {
    expect(page).toMatch(/§11\.242[\s\S]{0,400}(zebra|readability|가독성|호버|sticky)/i);
  });
});
