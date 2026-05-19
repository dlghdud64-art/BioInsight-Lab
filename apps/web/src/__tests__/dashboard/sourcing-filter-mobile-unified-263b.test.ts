/**
 * §11.263b #sourcing-filter-mobile-unified — 소싱 필터 모바일 1행 통합 (방안 A 풀 정합)
 *
 * 호영님 spec (소싱 모바일 #3 P1, 방안 A 권장):
 *   [전체] [시약] [기구] [장비] | [전체 가격] [~5만] ... | [전체 제조사] [Thermo...]
 *     ←── 가로 스크롤 1줄 ──→
 *
 * Root cause: 카테고리/가격대/제조사 3행 (각 py-2 border-b) = ~160px 세로 차지.
 *
 * Fix: 모바일 한정 (md:hidden) unified filter row 신규 — 모든 chip 14+ 개 inline
 * 가로 스크롤 1줄 + 그룹 경계 구분자 (category|price, price|vendor). 기존 3 row 는
 * hidden md:flex 으로 데스크탑 한정 노출 (정합 보존).
 *
 * scope:
 *   (1) 기존 3 row className 에 hidden md:flex 추가 (데스크탑 한정 노출)
 *   (2) 모바일 한정 unified wrapper 신규 추가
 *       - md:hidden flex items-center gap-1.5 overflow-x-auto
 *       - 카테고리 4 chip + 구분자 + 가격 4 chip + 구분자 + 제조사 chip (조건부)
 *   (3) §11.263b trace marker
 *
 * canonical truth lock:
 *   - searchCategory / minPrice / maxPrice / searchBrand state (변경 0)
 *   - 기존 3 row chip onClick / aria-pressed / data-testid 보존 (데스크탑)
 *   - 모바일 chip 도 동일 state + onClick 발동 (data-testid 는 mobile prefix)
 *   - vendorFacets 조건부 (length > 0) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.263b #1 — 모바일 unified filter row 신규", () => {
  it("§11.263b trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.263b/);
  });

  it("모바일 한정 unified wrapper (md:hidden + flex + overflow-x-auto)", () => {
    expect(page).toMatch(
      /md:hidden[\s\S]{0,200}flex items-center gap-1\.5[\s\S]{0,80}overflow-x-auto|md:hidden[\s\S]{0,200}overflow-x-auto[\s\S]{0,80}flex items-center gap-1\.5/,
    );
  });

  it("모바일 카테고리 4 chip 신규 (전체 / 시약 / 기구 / 장비)", () => {
    // data-testid 안 "mobile" prefix 또는 "sourcing-mobile-category" 등으로 구분
    expect(page).toMatch(/data-testid="sourcing-mobile-category-chip-all"/);
    expect(page).toMatch(/data-testid="sourcing-mobile-category-chip-reagent"/);
    expect(page).toMatch(/data-testid="sourcing-mobile-category-chip-tool"/);
    expect(page).toMatch(/data-testid="sourcing-mobile-category-chip-equipment"/);
  });

  it("모바일 가격 4 chip 신규 (전체 가격 / ~5만 / 5~20만 / 20만~)", () => {
    expect(page).toMatch(/data-testid="sourcing-mobile-price-chip-all"/);
    expect(page).toMatch(/data-testid="sourcing-mobile-price-chip-low"/);
    expect(page).toMatch(/data-testid="sourcing-mobile-price-chip-mid"/);
    expect(page).toMatch(/data-testid="sourcing-mobile-price-chip-high"/);
  });

  it("모바일 제조사 chip 신규 (조건부, 전체 제조사 + vendor top 5)", () => {
    expect(page).toMatch(/data-testid="sourcing-mobile-vendor-chip-all"/);
    // 동적 vendor chip 의 data-testid prefix
    expect(page).toMatch(/data-testid=\{`sourcing-mobile-vendor-chip-\$\{v\.vendorId\}`\}/);
  });

  it("모바일 그룹 경계 구분자 (category|price, price|vendor)", () => {
    expect(page).toMatch(/data-testid="sourcing-mobile-filter-separator"/);
    expect(page).toMatch(/aria-hidden="true"[\s\S]{0,80}w-px h-5 bg-slate-300/);
  });
});

describe("§11.263b #2 — 기존 데스크탑 3 row 보존 (hidden md:flex)", () => {
  it("§11.258b 카테고리 row 에 hidden md:flex 추가", () => {
    // 기존: "px-4 md:px-6 py-2 border-b border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto"
    // 신규: 동일 + "hidden md:flex" (flex 대체) 또는 추가
    expect(page).toMatch(
      /§11\.258b[\s\S]{0,300}hidden md:flex|§11\.258b[\s\S]{0,500}hidden md:flex/,
    );
  });

  it("§11.258d-1 가격 row 에 hidden md:flex 추가", () => {
    expect(page).toMatch(
      /§11\.258d-1[\s\S]{0,300}hidden md:flex|§11\.258d-1[\s\S]{0,500}hidden md:flex/,
    );
  });

  it("§11.258d-2 제조사 row 에 hidden md:flex 추가", () => {
    expect(page).toMatch(
      /§11\.258d-2[\s\S]{0,300}hidden md:flex|§11\.258d-2[\s\S]{0,500}hidden md:flex/,
    );
  });
});

describe("§11.263b #3 — invariant 보존 (canonical truth)", () => {
  it("기존 데스크탑 카테고리 chip 4 (전체/REAGENT/TOOL/EQUIPMENT) data-testid 보존", () => {
    expect(page).toMatch(/data-testid="sourcing-category-chip-all"/);
    expect(page).toMatch(/data-testid="sourcing-category-chip-reagent"/);
    expect(page).toMatch(/data-testid="sourcing-category-chip-tool"/);
    expect(page).toMatch(/data-testid="sourcing-category-chip-equipment"/);
  });

  it("기존 데스크탑 가격 chip 4 data-testid 보존", () => {
    expect(page).toMatch(/data-testid="sourcing-price-chip-all"/);
    expect(page).toMatch(/data-testid="sourcing-price-chip-low"/);
    expect(page).toMatch(/data-testid="sourcing-price-chip-mid"/);
    expect(page).toMatch(/data-testid="sourcing-price-chip-high"/);
  });

  it("기존 데스크탑 제조사 chip data-testid 보존", () => {
    expect(page).toMatch(/data-testid="sourcing-vendor-chip-all"/);
    expect(page).toMatch(/data-testid=\{`sourcing-vendor-chip-\$\{v\.vendorId\}`\}/);
  });

  it("vendorFacets 조건부 (length > 0) 보존 (모바일 + 데스크탑 양쪽)", () => {
    expect(page).toMatch(/vendorFacets\.length > 0 &&/);
  });

  it("PRODUCT_CATEGORIES 보존 (REAGENT/TOOL/EQUIPMENT label source)", () => {
    expect(page).toMatch(/PRODUCT_CATEGORIES\.REAGENT/);
    expect(page).toMatch(/PRODUCT_CATEGORIES\.TOOL/);
    expect(page).toMatch(/PRODUCT_CATEGORIES\.EQUIPMENT/);
  });

  it("setSearchCategory / setMinPrice / setMaxPrice / setSearchBrand state setter 보존", () => {
    expect(page).toMatch(/setSearchCategory\("REAGENT"\)/);
    expect(page).toMatch(/setMinPrice\(undefined\);\s*setMaxPrice\(50000\)/);
    expect(page).toMatch(/setMinPrice\(50000\);\s*setMaxPrice\(200000\)/);
    expect(page).toMatch(/setSearchBrand\(""\)/);
    expect(page).toMatch(/setSearchBrand\(v\.vendorName\)/);
  });

  it("§11.263a 모바일 헤더 spacer 보존", () => {
    expect(page).toMatch(/§11\.263a/);
    expect(page).toMatch(/flex-1 md:hidden/);
  });
});

describe("11.263c sourcing result triage evidence", () => {
  it("renders the fixed four-way triage header and counts", () => {
    expect(page).toMatch(/11\.263c/);
    expect(page).toMatch(/data-testid="sourcing-result-triage"/);
    expect(page).toMatch(/Sourcing Result Triage/);
    expect(page).toMatch(/Exact Match/);
    expect(page).toMatch(/Cross-Vendor Equivalent/);
    expect(page).toMatch(/Alternative Pack/);
    expect(page).toMatch(/Blocked/);
  });

  it("exposes compare, hold, exclude actions outside result-card overlays", () => {
    expect(page).toMatch(/data-testid="sourcing-triage-compare-cta"/);
    expect(page).toMatch(/data-testid="sourcing-triage-blocked-reason"/);
    expect(page).toMatch(/보류 검토/);
    expect(page).toMatch(/제외 사유/);
  });
});
