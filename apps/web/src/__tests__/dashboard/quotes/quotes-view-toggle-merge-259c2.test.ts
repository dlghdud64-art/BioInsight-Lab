/**
 * §11.259c-2 #quotes-view-toggle-merge — 견적 뷰 toggle 검색/필터 영역 통합
 *
 * §11.259c 후속 cluster. 호영님 spec "필터 + 뷰 전환 영역 1줄 압축" 의
 * 완전 정합. 뷰 toggle (카드/테이블 + column prefs popover) 을 검색/필터
 * wrapper 안 mode chips row 와 sibling sub-row 로 이동. 데스크탑 sm+ 에서
 * 같은 줄, 모바일은 2 sub-row.
 *
 * scope:
 *   (1) 검색/필터 wrapper 안에 sub-wrapper 추가
 *       `flex flex-col sm:flex-row sm:items-center gap-2`
 *   (2) mode chips row className 에 `flex-1 min-w-0` 추가 (sm+ 좌측 차지)
 *   (3) 뷰 toggle JSX (카드/테이블 + column prefs popover) 을 검색/필터
 *       wrapper 안 mode chips row 의 sibling 으로 이동
 *   (4) 기존 main column (data-testid="quote-work-queue") 안 뷰 toggle 제거
 *
 * canonical truth lock:
 *   - setViewMode("card"/"table") onClick 보존
 *   - aria-pressed / aria-label / Package / FileTextIcon 보존
 *   - §11.230b column prefs popover (Settings2 / DEFAULT_COLUMN_PREFS / drag) 보존
 *   - !isLoading && filteredQuotes.length > 0 조건부 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.259c-2 #1 — 검색/필터 wrapper 안 sub-wrapper + 뷰 toggle 통합", () => {
  it("§11.259c-2 trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.259c-2/);
  });

  it("검색/필터 wrapper 안에 sm:flex-row sub-wrapper 추가", () => {
    // 검색 + 필터 ── 마커 ~ Main: List 마커 사이에 새 sub-wrapper 존재.
    expect(page).toMatch(
      /검색 \+ 필터[\s\S]+?flex flex-col sm:flex-row sm:items-center gap-2[\s\S]+?Main: List/,
    );
  });

  it("mode chips row className 에 flex-1 min-w-0 추가 (sm+ 좌측 차지)", () => {
    // overflow-x-auto + flex-nowrap 보존 + flex-1 min-w-0 추가
    expect(page).toMatch(
      /Operating mode chips[\s\S]{0,300}flex-1\s+min-w-0/,
    );
  });

  it("뷰 toggle (카드/테이블) 이 검색/필터 wrapper 안에 위치", () => {
    // "검색 + 필터" marker 와 "Main: List" marker 사이에 aria-label="카드 보기" 존재
    expect(page).toMatch(
      /검색 \+ 필터[\s\S]+?aria-label="카드 보기"[\s\S]+?Main: List/,
    );
    expect(page).toMatch(
      /검색 \+ 필터[\s\S]+?aria-label="테이블 보기"[\s\S]+?Main: List/,
    );
  });

  it("뷰 toggle 조건부 (!isLoading && filteredQuotes.length > 0) 보존", () => {
    expect(page).toMatch(/!isLoading && filteredQuotes\.length > 0/);
  });
});

describe("§11.259c-2 #2 — 기존 main column 안 뷰 toggle 제거", () => {
  it("data-testid='quote-work-queue' 직후 200 char 내에 카드 보기 버튼 부재", () => {
    // 기존 line 2014-2017: <div className="flex gap-0"> + <div data-testid="quote-work-queue"...>
    // + 뷰 toggle. 뷰 toggle 이동 후 data-testid 직후 곧바로 다른 element 시작.
    // 200 char 내 "카드 보기" 없음.
    expect(page).not.toMatch(
      /data-testid="quote-work-queue"[\s\S]{0,300}aria-label="카드 보기"/,
    );
  });

  it("data-testid='quote-work-queue' 직후 200 char 내에 테이블 보기 버튼 부재", () => {
    expect(page).not.toMatch(
      /data-testid="quote-work-queue"[\s\S]{0,300}aria-label="테이블 보기"/,
    );
  });
});

describe("§11.259c-2 #3 — invariant 보존 (canonical truth)", () => {
  it("setViewMode('card') onClick 보존", () => {
    expect(page).toMatch(/onClick=\{\(\) => setViewMode\("card"\)\}/);
  });

  it("setViewMode('table') onClick 보존", () => {
    expect(page).toMatch(/onClick=\{\(\) => setViewMode\("table"\)\}/);
  });

  it("aria-pressed viewMode toggle 2 버튼 보존", () => {
    expect(page).toMatch(/aria-pressed=\{viewMode === "card"\}/);
    expect(page).toMatch(/aria-pressed=\{viewMode === "table"\}/);
  });

  it("Package / FileTextIcon icon import 사용 보존", () => {
    expect(page).toMatch(/<Package className="h-3 w-3" \/>\s*카드/);
    expect(page).toMatch(/<FileTextIcon className="h-3 w-3" \/>\s*테이블/);
  });

  it("§11.230b column prefs popover trigger 보존 (테이블 뷰 한정)", () => {
    expect(page).toMatch(/§11\.230b[\s\S]{0,300}column-prefs/);
    expect(page).toMatch(/aria-label="컬럼 설정"/);
    expect(page).toMatch(/setColumnPrefsPopoverOpen/);
    expect(page).toMatch(/columnPrefsPopoverOpen/);
  });

  it("§11.230b drag-and-drop reorder 보존 (column prefs)", () => {
    expect(page).toMatch(/onDragStart=\{\(\) => setDragColumn\(key\)\}/);
    expect(page).toMatch(/DEFAULT_COLUMN_PREFS/);
    expect(page).toMatch(/COLUMN_LABEL\[key\]/);
  });

  it("§11.259c mode chips row 가로 스크롤 (flex-nowrap + overflow-x-auto) 보존", () => {
    expect(page).toMatch(
      /Operating mode chips[\s\S]{0,200}flex-nowrap[\s\S]{0,80}overflow-x-auto|Operating mode chips[\s\S]{0,200}overflow-x-auto[\s\S]{0,80}flex-nowrap/,
    );
  });

  it("§11.259c 검색/필터 row flex-row (sm:flex-row 제거) 보존", () => {
    expect(page).toMatch(/검색 \+ 필터[\s\S]{0,800}flex flex-row gap-2/);
  });

  it("§11.220 전체 선택 CTA 보존", () => {
    expect(page).toMatch(/§11\.220[\s\S]{0,200}전체 선택 CTA/);
    expect(page).toMatch(/발송 대기 견적 전체 선택/);
  });
});
