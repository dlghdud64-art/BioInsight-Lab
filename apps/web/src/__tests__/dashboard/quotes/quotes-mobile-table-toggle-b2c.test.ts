/**
 * §B2-C (호영님 2026-06-29) — 모바일 카드/테이블 토글 노출 + 모바일 압축 테이블
 *
 * 결정(권장 option2): 모바일에서도 카드↔테이블 토글을 노출하고, 테이블 선택 시
 *   가로 스크롤 없는 압축 테이블(견적케이스·단계·다음단계)을 렌더한다.
 *   - effectiveViewMode = viewMode (모바일도 토글 honor — 카드 강제 폐기).
 *   - 기본 카드는 matchMedia 초기값(setViewMode("card"))이 계속 책임(259b가 잠금) — 사용자가 토글하면 테이블.
 *   - 모바일 압축 = visibleColumns memo 가 isMobile 시 MOBILE_TABLE_COLS(title/status/actions)로 축소.
 *     thead/tbody 의 visibleColumns.map 구조·8 컬럼 정의(COLUMN_LABEL/order)는 불변(DOM 보존).
 *   - 테이블 min-w 모바일 해제(min-w-0 md:min-w-[900px]) → 압축 컬럼이 화면 폭에 fit(가로 스크롤 0).
 *   - 컬럼 설정 popover 는 데스크탑 전용(hidden md:block) — 모바일 압축 테이블은 고정 컬럼.
 *
 * supersede: §quotes-mobile-redesign "모바일 카드 단일 고정" → 토글 노출로 대체(기본 카드는 유지).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§B2-C #1 — 모바일 토글 honor + 압축 테이블", () => {
  it("effectiveViewMode = viewMode (모바일 카드 강제 폐기)", () => {
    expect(page).toMatch(/const effectiveViewMode: "card" \| "table" = viewMode;/);
    // 옛 isMobile 강제 분기 제거 확인.
    expect(page).not.toMatch(/effectiveViewMode: "card" \| "table" = isMobile \? "card"/);
  });

  it("뷰 토글 모바일 노출 (relative flex items-center justify-end)", () => {
    expect(page).toMatch(/relative flex items-center justify-end gap-1\.5 shrink-0/);
    expect(page).not.toMatch(/relative hidden md:flex items-center justify-end/);
  });

  it("컬럼 설정 popover 데스크탑 전용 (hidden md:block)", () => {
    expect(page).toMatch(/relative hidden md:block/);
  });

  it("MOBILE_TABLE_COLS = 견적케이스·단계·다음단계(title/status/actions)", () => {
    expect(page).toMatch(/const MOBILE_TABLE_COLS = new Set<ColumnKey>\(\["title", "status", "actions"\]\)/);
  });

  it("visibleColumns memo 가 isMobile 시 MOBILE_TABLE_COLS 로 축소 + isMobile 의존성", () => {
    expect(page).toMatch(/if \(isMobile\) return MOBILE_TABLE_COLS\.has\(key\)/);
    expect(page).toMatch(/\}, \[columnPrefs\.order, columnPrefs\.visibility, isMobile\]\)/);
  });

  it("테이블 min-w 모바일 해제 (min-w-0 md:min-w-[900px]) — 가로 스크롤 0", () => {
    expect(page).toMatch(/w-full min-w-0 md:min-w-\[900px\] text-xs/);
  });
});

describe("§B2-C #2 — 보존(회귀 0)", () => {
  it("thead/tbody visibleColumns.map 구조 보존(8 컬럼 DOM 정의 불변)", () => {
    // §11.230b / quote-batch-selection — 동적 컬럼 렌더 보존.
    const occurrences = page.match(/visibleColumns\.map/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("ColumnKey 7 컬럼 정의 + COLUMN_LABEL 보존", () => {
    expect(page).toMatch(/title: "견적케이스"/);
    expect(page).toMatch(/status: "단계"/);
    expect(page).toMatch(/actions: "다음단계"/);
    expect(page).toMatch(/price: "예상금액"/);
  });

  it("모바일 기본 카드(matchMedia → setViewMode card) 보존 — 259b interplay", () => {
    expect(page).toMatch(/matchMedia\(["'`]\(max-width:\s*767px\)["'`]\)/);
    expect(page).toMatch(/const \[viewMode, setViewMode\] = useState<"card"\s*\|\s*"table">\("table"\)/);
  });

  it("카드/테이블 토글 버튼(aria-pressed viewMode) 보존", () => {
    expect(page).toMatch(/aria-pressed=\{viewMode === "card"\}/);
    expect(page).toMatch(/aria-pressed=\{viewMode === "table"\}/);
  });
});
