/**
 * §safety-redesign ② — 화학물질 대장 테이블 (호영님 2026-06-27)
 *
 * 반복 카드 → 밀집 테이블(정렬·14행 페이지네이션) + 필터 칩(canonical 건수) + 다중선택 일괄작업 바.
 * 핸드오프 §5. canonical 카운트 단일 소스(items 집계). dead button 0(no-op 금지) — bulk CTA 는
 * ③ 준비 마법사 연결 전까지 disabled+사유.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(__dirname, "..", "..", "app/dashboard/safety/page.tsx"),
  "utf8",
);
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§safety-redesign ② — 밀집 테이블", () => {
  it("table 렌더(반복 카드 제거 — border-l-4 카드 패턴 부재)", () => {
    expect(CODE).toMatch(/<table className="w-full text-sm">/);
    expect(CODE).toMatch(/<thead>/);
    expect(CODE).toMatch(/pageItems\.map/);
    expect(CODE).not.toMatch(/border-l-4 border transition-all/);
  });
  it("컬럼: 물질명·CAS·위험·보관·MSDS·점검·작업", () => {
    expect(CODE).toMatch(/물질명/);
    expect(CODE).toMatch(/CAS/);
    expect(CODE).toMatch(/보관 위치/);
    expect(CODE).toMatch(/최근 점검/);
  });
});

describe("§safety-redesign ② — 정렬(SortTh)", () => {
  it("물질명·위험·보관 toggleSort 배선", () => {
    expect(CODE).toMatch(/toggleSort\("name"\)/);
    expect(CODE).toMatch(/toggleSort\("risk"\)/);
    expect(CODE).toMatch(/toggleSort\("loc"\)/);
  });
  it("sortKey/sortDir state + 방향 토글", () => {
    expect(CODE).toMatch(/const \[sortKey, setSortKey\]/);
    expect(CODE).toMatch(/const \[sortDir, setSortDir\]/);
  });
});

describe("§safety-redesign ② — 14행 페이지네이션", () => {
  it("ROWS_PER_PAGE = 14 + slice 페이징", () => {
    expect(CODE).toMatch(/ROWS_PER_PAGE = 14/);
    expect(CODE).toMatch(/sortedItems\.slice\(\(currentPage - 1\) \* ROWS_PER_PAGE/);
  });
  it("currentPage state + totalPages 파생", () => {
    expect(CODE).toMatch(/const \[currentPage, setCurrentPage\]/);
    expect(CODE).toMatch(/Math\.ceil\(sortedItems\.length \/ ROWS_PER_PAGE\)/);
  });
});

describe("§safety-redesign ② — 필터 칩(canonical 건수)", () => {
  it("4종 칩(전체/MSDS 미등록/미점검/고위험) + chipFilter state", () => {
    expect(CODE).toMatch(/const \[chipFilter, setChipFilter\]/);
    expect(CODE).toMatch(/label: "MSDS 미등록", count: msdsMissingCount/);
    expect(CODE).toMatch(/label: "미점검", count: uninspectedCount/);
    expect(CODE).toMatch(/label: "고위험", count: highRiskCount/);
  });
  it("건수 = items 집계 단일 소스(하드코딩 아님)", () => {
    expect(CODE).toMatch(/const uninspectedCount = items\.filter\(\(i\) => !i\.lastInspection\)\.length/);
    expect(CODE).toMatch(/\{totalCount\}종 중 \{filteredItems\.length\}종 표시/);
  });
});

describe("§safety-redesign ② — 다중선택 bulkbar (no-op 0)", () => {
  it("selectedIds Set + 선택 해제(real)", () => {
    expect(CODE).toMatch(/const \[selectedIds, setSelectedIds\]/);
    expect(CODE).toMatch(/setSelectedIds\(new Set\(\)\)/);
    expect(CODE).toMatch(/종 선택됨/);
  });
  it("bulk CTA(MSDS 일괄/점검 일괄) = disabled+사유 (마법사 전까지 no-op 금지)", () => {
    // bulkbar 영역의 두 일괄 버튼이 disabled 로 게이트됨.
    expect(CODE).toMatch(/MSDS 일괄 등록/);
    expect(CODE).toMatch(/점검 기록 생성/);
    expect(CODE).toMatch(/일괄 처리는 점검 준비 마법사에서 진행됩니다/);
  });
  it("dead Filter 버튼 제거(onClick 없는 Filter 아이콘 부재)", () => {
    expect(CODE).not.toMatch(/<Filter className=/);
  });
});
