/**
 * §11.297f #inventory-content-filter-plain — D3 filter (Select form 포함)
 *   custom plain dropdown + inventory-content Radix import 제거.
 *
 * 재고 batch 최종 종결 — InventoryTable + inventory-main +
 * inventory-content 3 file 12 dropdown + 1 filter 모두 plain pattern
 * 으로 swap 완료. 재고 surface Radix DropdownMenu wiring 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.297f — inventory-content D3 filter plain + Radix 제거", () => {
  it("§11.297f trace marker", () => {
    expect(SRC).toMatch(/§11\.297f/);
  });

  it("isFilterDropdownOpen useState (filter plain state)", () => {
    expect(SRC).toMatch(/const \[isFilterDropdownOpen, setIsFilterDropdownOpen\] = useState\(false\)/);
  });

  it('plain <button aria-label="필터"> + aria-expanded + Filter icon (pointer-events-none)', () => {
    expect(SRC).toMatch(/aria-label="필터"/);
    expect(SRC).toMatch(/aria-expanded=\{isFilterDropdownOpen\}/);
    expect(SRC).toMatch(/<Filter[\s\S]{0,100}pointer-events-none/);
  });

  it("activeFilterCount badge 보존 (pointer-events-none 추가)", () => {
    expect(SRC).toMatch(/pointer-events-none[\s\S]{0,100}\{activeFilterCount\}/);
  });

  it("조건부 backdrop + role=\"menu\" + Select 2개 (위치/상태) + 초기화 button 보존", () => {
    expect(SRC).toMatch(/\{isFilterDropdownOpen && \(/);
    expect(SRC).toMatch(/aria-label="필터 메뉴"/);
    expect(SRC).toMatch(/value=\{locationFilter\}/);
    expect(SRC).toMatch(/value=\{statusFilter\}/);
    expect(SRC).toMatch(/setLocationFilter\("all"\)[\s\S]{0,200}초기화/);
  });

  it("Radix DropdownMenu* import 완전 제거", () => {
    expect(SRC).not.toMatch(/from "@\/components\/ui\/dropdown-menu"/);
  });

  it("Radix DropdownMenu / Trigger / Content / Item 사용 완전 부재", () => {
    expect(SRC).not.toMatch(/<DropdownMenu(?:Trigger|Content|Item|Label|Separator)?\s/);
  });

  it("기존 ActionMenu 4 instance 보존 (utility/card/issue alert §11.297d/e)", () => {
    expect(SRC).toMatch(/menuId="inv-content-utility-mobile"/);
    expect(SRC).toMatch(/menuId="inv-content-utility-desktop"/);
    expect(SRC).toMatch(/menuId="inv-content-card-actions"/);
    expect(SRC).toMatch(/menuId=\{`inv-content-issue-\$\{inv\.id\}`\}/);
  });
});
