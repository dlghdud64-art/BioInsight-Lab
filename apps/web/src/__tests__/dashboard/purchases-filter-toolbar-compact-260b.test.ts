/**
 * §11.260b #purchases-filter-toolbar-compact — purchases 탭/검색 row 모바일 1줄 압축
 *
 * §11.259c (견적 검색/필터 1줄 압축) 패턴 reuse. purchases 의 "탭 + 검색"
 * row 가 모바일에서 세로 2 row (탭 위, 검색 아래) → 가로 1 row 압축.
 * 모바일 viewport 효율 ↑.
 *
 * scope:
 *   (1) wrapper className `flex flex-col sm:flex-row sm:items-center gap-2`
 *       → `flex flex-row items-center gap-2` (모바일도 가로)
 *   (2) 탭 영역 wrapper 에 `flex-1 min-w-0` 추가 (좌측 차지 + 스크롤)
 *   (3) 검색 input wrapper `flex-1 min-w-0 sm:max-w-xs sm:ml-auto`
 *       → `w-[140px] sm:w-auto sm:flex-1 sm:max-w-xs sm:ml-auto shrink-0`
 *       (모바일 140px 고정, sm+ flex-1)
 *
 * canonical truth lock:
 *   - 5 탭 (전체/검토필요/발주가능/보류/확정됨) onClick setQueueTab 보존
 *   - 검색 onChange setSearchQuery 보존
 *   - 검색 placeholder "제목, 견적번호 검색..." 보존
 *   - 탭 overflow-x-auto 가로 스크롤 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/purchases/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.260b #1 — 탭/검색 row 모바일 1줄 압축", () => {
  it("§11.260b trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.260b/);
  });

  it("탭 + 검색 wrapper className flex-row items-center (sm:flex-row 제거)", () => {
    // 기존: <div className="flex flex-col sm:flex-row sm:items-center gap-2">
    // 신규: <div className="flex flex-row items-center gap-2">
    expect(page).not.toMatch(
      /═══ 탭 \+ 검색 ═══[\s\S]{0,200}flex flex-col sm:flex-row sm:items-center gap-2/,
    );
    // §11.334 — 온보딩(데이터 0·검색X) 시 탭/검색 숨김 조건부 wrapping이 앵커↔div 거리 562자로 확대. 1줄 압축(flex-row) 의도 불변.
    expect(page).toMatch(
      /═══ 탭 \+ 검색 ═══[\s\S]{0,700}flex flex-row items-center gap-2/,
    );
  });

  it("탭 영역 wrapper 에 flex-1 min-w-0 추가 (좌측 차지)", () => {
    // 탭 영역: <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0" ...>
    expect(page).toMatch(
      /flex items-center gap-1 overflow-x-auto flex-1 min-w-0/,
    );
  });

  it("검색 wrapper 모바일 w-[140px] + sm+ flex-1 분기", () => {
    expect(page).toMatch(
      /relative w-\[140px\] sm:w-auto sm:flex-1 sm:max-w-xs sm:ml-auto shrink-0/,
    );
  });
});

describe("§11.260b #2 — invariant 보존 (canonical truth)", () => {
  it("5 탭 라벨 보존 (전체 / 검토 필요 / 발주 가능 / 보류 / 확정됨)", () => {
    expect(page).toMatch(/label:\s*"전체"/);
    expect(page).toMatch(/label:\s*"발주 인계 대기"/);
    expect(page).toMatch(/label:\s*"발주 승인 대기"/);
    expect(page).toMatch(/label:\s*"보류"/);
    expect(page).toMatch(/label:\s*"발주 확정"/);
  });

  it("탭 onClick setQueueTab(tab.key) 보존", () => {
    expect(page).toMatch(/onClick=\{\(\) => setQueueTab\(tab\.key\)\}/);
  });

  it("검색 onChange setSearchQuery 보존", () => {
    expect(page).toMatch(/onChange=\{\(e\) => setSearchQuery\(e\.target\.value\)\}/);
  });

  it("검색 placeholder '제목, 견적번호 검색...' 보존", () => {
    expect(page).toMatch(/placeholder="제목, 견적번호 검색\.\.\."/);
  });

  it("탭 overflow-x-auto 가로 스크롤 보존", () => {
    expect(page).toMatch(/overflow-x-auto/);
  });

  it("탭 5 카운트 표시 (stats.total / review_required / ready_for_po / hold / confirmed) 보존", () => {
    expect(page).toMatch(/count:\s*stats\.total/);
    expect(page).toMatch(/count:\s*stats\.review_required/);
    expect(page).toMatch(/count:\s*stats\.ready_for_po/);
    expect(page).toMatch(/count:\s*stats\.hold/);
    expect(page).toMatch(/count:\s*stats\.confirmed/);
  });

  it("§11.260a KpiCard isZero 톤다운 보존", () => {
    expect(page).toMatch(/const isZero = value === 0 && !active/);
  });
});
