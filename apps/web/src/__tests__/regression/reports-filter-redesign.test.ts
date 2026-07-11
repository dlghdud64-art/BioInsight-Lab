/**
 * #reports-filter-redesign (호영님 2026-07-11) — 구매 리포트 필터 5→2컨트롤 접기.
 *
 * 시안(구매 리포트 필터 리디자인.html) §1 필터 바만 실 델타.
 *  - 기간 프리셋 세그먼트(7일/30일/분기/올해) + 커스텀 pill(선택 시 프리셋 해제).
 *  - 카테고리·팀·벤더·예산 4 Select → 필터 팝오버(개수 배지) 접기.
 *  - 활성 칩(적용된 것만, ✕=상태 초기화→쿼리 재실행, 전체 해제).
 * §2 데이터 뷰·§3 딥링크(카테고리/벤더/월별)는 이미 React 반영 → 무접촉 보존만 가드.
 *
 * 정직성: 쿼리 파라미터·실데이터(/api/reports/purchase) 무접촉. 하드코딩 0.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const WEB = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(WEB, rel), "utf8");
const PAGE = "src/app/dashboard/reports/page.tsx";

describe("#reports-filter-redesign — 필터 2컨트롤 접기(§1)", () => {
  it("기간 프리셋 세그먼트 + applyPreset", () => {
    const s = read(PAGE);
    expect(s).toContain("REPORT_PRESETS");
    expect(s).toContain("applyPreset");
    expect(s).toContain("최근 7일");
    expect(s).toContain("최근 30일");
  });
  it("프리셋↔커스텀 일관: 커스텀 변경 시 activePreset 해제", () => {
    const s = read(PAGE);
    expect(s).toContain("setActivePreset(null)"); // DateRangePicker onDateChange
    expect(s).toMatch(/activePreset === p\.id/); // 세그먼트 active 표시
  });
  it("필터 4종 팝오버 접기 + 개수 배지", () => {
    const s = read(PAGE);
    expect(s).toContain("<Popover>");
    expect(s).toContain("PopoverContent");
    expect(s).toContain("activeFilterCount");
    expect(s).not.toContain("lg:grid-cols-5 gap-3 items-end"); // 구 5필터 한줄 grid 제거
  });
  it("활성 칩: 개별 해제(상태 초기화) + 전체 해제", () => {
    const s = read(PAGE);
    expect(s).toContain('f.set("all")'); // 칩 ✕ → 상태 초기화(쿼리 재실행)
    expect(s).toContain("clearAllFilters");
    expect(s).toContain("전체 해제");
    expect(s).toMatch(/activeFilterCount > 0 &&/); // chips:empty 숨김
  });
  it("모바일 오버레이 부모 relative(시안 가드3)", () => {
    expect(read(PAGE)).toContain("shadow-sm relative");
  });
});

describe("#reports-filter-redesign — 무접촉 보존(데이터·쿼리·딥링크)", () => {
  it("쿼리 파라미터 배선 보존", () => {
    const s = read(PAGE);
    expect(s).toContain('params.append("category"');
    expect(s).toContain("budgetId");
  });
  it("4 Select 상태 배선 보존", () => {
    const s = read(PAGE);
    expect(s).toContain("onValueChange={setSelectedCategory}");
    expect(s).toContain("onValueChange={setSelectedVendor}");
    expect(s).toContain("onValueChange={setSelectedBudget}");
  });
  it("§3 딥링크 3개 보존", () => {
    const s = read(PAGE);
    expect(s).toContain("카테고리 검토 →");
    expect(s).toContain("벤더 비교 →");
    expect(s).toContain("구매내역 필터 →");
  });
  it("실데이터 파생 보존(하드코딩 0)", () => {
    expect(read(PAGE)).toContain("reportData?.metrics");
  });
});
