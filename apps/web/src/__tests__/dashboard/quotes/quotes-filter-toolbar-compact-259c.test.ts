/**
 * §11.259c #quotes-filter-toolbar-compact — 호영님 spec 견적 관리 모바일 #3
 *   "필터 + 뷰 전환 영역 1줄 압축".
 *
 * §quotes-quick-filter-4a P2 진화:
 *   구 상태 필터 <Select> 드롭다운 + MODE_CHIPS 단일선택 mode chip 이 제거되고,
 *   statusFilter 는 퍼널 onStageClick 파생으로, 필터 UI 는 5칩 다중선택 빠른 필터
 *   (QUICK_CHIP_META + quickStatus:Set)로 대체됨. 신 UI 전체 truth =
 *   quick-filter-4a-render.test.ts. 이 sentinel 이 지키던 "검색/필터 row 1줄 압축 +
 *   칩 가로 스크롤" 구조 의도는 그대로 살아있음 — 검색 input row(flex-row) + 칩 row
 *   (flex-nowrap overflow-x-auto)는 보존. Select/SelectItem/MODE_CHIPS 앵커는 제거
 *   회귀(부재) 또는 신 빠른 필터 앵커로 repoint.
 *
 * canonical truth lock:
 *   - 검색 onChange (setSearchQuery) 보존
 *   - statusFilter 파생 wiring 보존 (Select UI 는 제거)
 *   - 신 상태칩 onClick (toggleQuickStatus) 보존
 *   - 뷰 toggle setViewMode 보존
 *   - 전체 선택 CTA 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.259c #1 — 검색 / 필터 row 모바일 1줄 압축", () => {
  it("§11.259c trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.259c/);
  });

  it("검색/필터 row wrapper 모바일도 flex-row (sm:flex-row 제거)", () => {
    expect(page).not.toMatch(
      /검색 \+ 필터[\s\S]{0,800}flex flex-col sm:flex-row gap-2/,
    );
    expect(page).toMatch(
      /검색 \+ 필터[\s\S]{0,800}flex flex-row gap-2/,
    );
  });

  it("상태 필터 Select UI 제거(빠른 필터/퍼널 파생으로 대체) — SelectTrigger 부재", () => {
    // §quotes-quick-filter-4a P2 — 상태 Select 드롭다운 제거. statusFilter 는 퍼널 파생.
    expect(page).not.toMatch(/SelectTrigger/);
    expect(page).toMatch(/setStatusFilter/);
  });
});

describe("§11.259c #2 — 빠른 필터 칩 가로 스크롤 (1줄 강제)", () => {
  it("칩 row flex-nowrap + overflow-x-auto", () => {
    expect(page).toMatch(
      /Operating mode chips[\s\S]{0,200}flex-nowrap[\s\S]{0,80}overflow-x-auto|Operating mode chips[\s\S]{0,200}overflow-x-auto[\s\S]{0,80}flex-nowrap/,
    );
  });

  it("칩 row flex-wrap 제거 (기존 무한 줄바꿈 차단)", () => {
    expect(page).not.toMatch(
      /Operating mode chips[\s\S]{0,200}\bflex-wrap\b/,
    );
  });
});

describe("§11.259c #3 — invariant 보존 (canonical truth)", () => {
  it("검색 Input onChange setSearchQuery 보존", () => {
    expect(page).toMatch(/value=\{searchQuery\}\s+onChange=\{\(e\)\s*=>\s*setSearchQuery\(e\.target\.value\)\}/);
  });

  it("검색 placeholder '견적명 / 품목명 / 요청 번호 검색...' 보존", () => {
    expect(page).toMatch(/placeholder="견적명 \/ 품목명 \/ 요청 번호 검색\.\.\."/);
  });

  it("상태 Select 제거 회귀(빠른 필터로 대체) — <Select / SelectItem 부재", () => {
    // §quotes-quick-filter-4a P2 — 상태 Select 7-item 드롭다운 제거(의도). 신 UI = 빠른 필터.
    expect(page).not.toMatch(/<Select\b/);
    expect(page).not.toMatch(/SelectItem/);
  });

  it("빠른 필터 상태칩 QUICK_CHIP_META.map + toggleQuickStatus 보존 (구 MODE_CHIPS 대체)", () => {
    expect(page).toMatch(/QUICK_CHIP_META\.map/);
    expect(page).toMatch(/onClick=\{\(\) => toggleQuickStatus\(meta\.key\)\}/);
    expect(page).not.toMatch(/setModeChip/);
  });

  it("빠른 필터 초기화 버튼 보존 (구 modeChip 초기화 → quickActive/resetQuick)", () => {
    expect(page).toMatch(/\{quickActive && \(/);
    expect(page).toMatch(/onClick=\{resetQuick\}[\s\S]{0,200}초기화/);
  });

  it("§11.220 전체 선택 CTA (PENDING 일괄) 보존", () => {
    expect(page).toMatch(/§11\.220[\s\S]{0,200}전체 선택 CTA/);
    expect(page).toMatch(/발송 대기 견적 전체 선택/);
  });

  it("뷰 toggle 버튼 2 (카드/테이블) 보존 (별도 위치)", () => {
    expect(page).toMatch(/aria-label="카드 보기"/);
    expect(page).toMatch(/aria-label="테이블 보기"/);
    expect(page).toMatch(/setViewMode\("card"\)/);
    expect(page).toMatch(/setViewMode\("table"\)/);
  });
});
