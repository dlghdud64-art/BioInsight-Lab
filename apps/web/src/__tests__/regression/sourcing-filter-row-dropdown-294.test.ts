/**
 * §11.294 #sourcing-filter-row-dropdown — 호영님 P2 1단계 sentinel.
 *
 * 호영님 P2 spec (2026-05-24):
 *   데스크탑 검색 결과 필터 3 row (카테고리/가격대/제조사) → 1 row +
 *   3 dropdown 단순화. "전체" 라벨 제거 + 선택 시만 파란색 + ✕ 해제.
 *   §11.283b plain button + useState pattern (Radix 의존성 0).
 *
 * Fix: 기존 §11.258b / §11.258d-1 / §11.258d-2 의 3 row 통째 제거 +
 *   1 row + 3 plain dropdown (filterDropdownOpen state).
 *   모바일 §11.263b unified row 영향 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/_workbench/search/page.tsx"),
  "utf8",
);

describe("§11.294 — 소싱 필터 3 row → 1 row dropdown 단순화", () => {
  it("§11.294 trace marker + filterDropdownOpen state", () => {
    expect(PAGE).toMatch(/§11\.294/);
    expect(PAGE).toMatch(
      /const \[filterDropdownOpen, setFilterDropdownOpen\] = useState<"category" \| "price" \| "vendor" \| null>\(null\)/,
    );
  });

  it("3 dropdown testid (category / price / vendor)", () => {
    expect(PAGE).toMatch(/data-testid="sourcing-category-dropdown"/);
    expect(PAGE).toMatch(/data-testid="sourcing-price-dropdown"/);
    expect(PAGE).toMatch(/data-testid="sourcing-vendor-dropdown"/);
  });

  it("기존 3 chip row testid 제거 (sourcing-category-chip-all 등)", () => {
    expect(PAGE).not.toMatch(/data-testid="sourcing-category-chip-all"/);
    expect(PAGE).not.toMatch(/data-testid="sourcing-price-chip-all"/);
    expect(PAGE).not.toMatch(/data-testid="sourcing-vendor-chip-all"/);
    expect(PAGE).not.toMatch(/data-testid="sourcing-category-chip-reagent"/);
  });

  it('기존 "전체 / 전체 가격 / 전체 제조사" label 제거', () => {
    // chip 안의 "전체" label 제거 (dropdown 기본 label 은 "카테고리/가격대/제조사")
    expect(PAGE).not.toMatch(/>전체 가격</);
    expect(PAGE).not.toMatch(/>전체 제조사</);
  });

  it("dropdown 기본 label 미선택 시 '카테고리/가격대/제조사' 표시", () => {
    expect(PAGE).toMatch(/searchCategory \? .*카테고리.*카테고리/);
    expect(PAGE).toMatch(/isPriceActive \? priceLabel : "가격대"/);
    expect(PAGE).toMatch(/searchBrand \|\| "제조사"/);
  });

  it("선택 시 ✕ 해제 button (aria-label '...필터 해제')", () => {
    expect(PAGE).toMatch(/aria-label="카테고리 필터 해제"/);
    expect(PAGE).toMatch(/aria-label="가격대 필터 해제"/);
    expect(PAGE).toMatch(/aria-label="제조사 필터 해제"/);
  });

  it("외부 click backdrop close (fixed inset-0 + setFilterDropdownOpen(null))", () => {
    expect(PAGE).toMatch(
      /fixed inset-0[\s\S]{0,100}onClick=\{\(\)\s*=>\s*setFilterDropdownOpen\(null\)\}/,
    );
  });

  it("미선택 = 회색, 선택 = 파란색 (bg-blue-50 text-blue-700 border-blue-300)", () => {
    expect(PAGE).toMatch(/bg-blue-50 text-blue-700 border-blue-300/);
    expect(PAGE).toMatch(/bg-white text-slate-600 border-slate-200/);
  });

  it("hidden md:flex 데스크탑 한정 (모바일 §11.263b unified row 영향 0)", () => {
    // 1 row wrapper 가 hidden md:flex
    expect(PAGE).toMatch(
      /§11\.294[\s\S]{0,500}hidden md:flex px-4 md:px-6 py-2 border-b/,
    );
  });

  it("setSearchCategory / setMinPrice / setMaxPrice / setSearchBrand state setter 보존 (회귀 0)", () => {
    expect(PAGE).toMatch(/setSearchCategory\(""\)/);
    expect(PAGE).toMatch(/setMinPrice\(undefined\); setMaxPrice\(undefined\)/);
    expect(PAGE).toMatch(/setSearchBrand\(""\)/);
  });

  it("ChevronDown lucide-react import 추가", () => {
    expect(PAGE).toMatch(/ChevronDown.*from "lucide-react"/);
  });
});
