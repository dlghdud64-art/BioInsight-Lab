/**
 * §11.259c #quotes-filter-toolbar-compact — 호영님 spec 견적 관리 모바일 #3
 *
 * 호영님 spec:
 *   - 필터 + 뷰 전환 영역 1줄 압축 (모바일 viewport 효율)
 *
 * scope (이번 cluster):
 *   (1) 검색 / 상태 필터 row → 모바일도 가로 1줄 (sm:flex-row 제거, flex-row 강제)
 *   (2) 상태 필터 Select width 모바일 압축 (w-full sm:w-[160px] → w-[110px] sm:w-[160px])
 *   (3) mode chips row → flex-nowrap + overflow-x-auto 가로 스크롤
 *       (모바일 무한 줄바꿈 차단, 1줄 유지)
 *
 * 뷰 toggle 위치 이동은 별도 backlog (line 2014-2044 = 80+ line JSX,
 * 큰 구조 변경 회피).
 *
 * canonical truth lock:
 *   - 검색 onChange (setSearchQuery) 보존
 *   - 상태 Select onValueChange (setStatusFilter) 보존
 *   - mode chips onClick (setModeChip) 보존
 *   - 뷰 toggle setViewMode 보존
 *   - 모든 SelectItem 7 개 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.259c #1 — 검색 / 상태 필터 row 모바일 1줄 압축", () => {
  it("§11.259c trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.259c/);
  });

  it("검색/필터 row wrapper 모바일도 flex-row (sm:flex-row 제거)", () => {
    // 기존: <div className="flex flex-col sm:flex-row gap-2">
    // 신규: <div className="flex flex-row gap-2">
    // 검색 input 직전 wrapper. flex-col 패턴 제거 확인.
    expect(page).not.toMatch(
      /검색 \+ 필터[\s\S]{0,800}flex flex-col sm:flex-row gap-2/,
    );
    expect(page).toMatch(
      /검색 \+ 필터[\s\S]{0,800}flex flex-row gap-2/,
    );
  });

  it("상태 필터 SelectTrigger width 모바일 압축 (w-[110px] sm:w-[160px])", () => {
    // 기존: w-full sm:w-[160px]
    // 신규: w-[110px] sm:w-[160px] (모바일 110px, sm+ 160px)
    expect(page).toMatch(/w-\[110px\]\s+sm:w-\[160px\]/);
  });
});

describe("§11.259c #2 — mode chips 가로 스크롤 (1줄 강제)", () => {
  it("mode chips row flex-nowrap + overflow-x-auto", () => {
    // 기존: flex items-center gap-1.5 flex-wrap
    // 신규: flex items-center gap-1.5 flex-nowrap overflow-x-auto
    expect(page).toMatch(
      /Operating mode chips[\s\S]{0,200}flex-nowrap[\s\S]{0,80}overflow-x-auto|Operating mode chips[\s\S]{0,200}overflow-x-auto[\s\S]{0,80}flex-nowrap/,
    );
  });

  it("mode chips flex-wrap 제거 (기존 무한 줄바꿈 차단)", () => {
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

  it("상태 Select onValueChange setStatusFilter 보존", () => {
    expect(page).toMatch(/onValueChange=\{\(v\)\s*=>\s*\{\s*setStatusFilter\(v\);\s*setModeChip\(null\);\s*\}\}/);
  });

  it("상태 SelectItem 7 개 보존 (all / DEADLINE_TODAY / PENDING / SENT / RESPONDED / COMPLETED / CANCELLED)", () => {
    expect(page).toMatch(/<SelectItem value="all">전체 상태/);
    expect(page).toMatch(/<SelectItem value="DEADLINE_TODAY">오늘 마감/);
    expect(page).toMatch(/<SelectItem value="PENDING">요청 접수/);
    expect(page).toMatch(/<SelectItem value="SENT">회신 대기 중/);
    expect(page).toMatch(/<SelectItem value="RESPONDED">비교 검토 필요/);
    expect(page).toMatch(/<SelectItem value="COMPLETED">발주 완료/);
    expect(page).toMatch(/<SelectItem value="CANCELLED">취소됨/);
  });

  it("mode chips MODE_CHIPS.map + setModeChip 보존", () => {
    expect(page).toMatch(/MODE_CHIPS\.map\(chip => \{/);
    expect(page).toMatch(/setModeChip\(isActive \? null : chip\.key\)/);
  });

  it("modeChip 초기화 버튼 보존", () => {
    expect(page).toMatch(/{modeChip && \(/);
    expect(page).toMatch(/setModeChip\(null\)[\s\S]{0,200}초기화/);
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
