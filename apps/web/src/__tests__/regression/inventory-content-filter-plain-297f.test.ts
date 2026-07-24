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

describe("§11.297f — inventory-content D3 filter (§global-filters 인라인 바로 진화)", () => {
  // 🔄 진화(2026-07-24, 호영님 승인): §11.297f 필터-드롭다운 패널(필터 버튼 → 절대배치 role=menu
  //   패널에 Select 내장) → §global-filters 데스크톱 공용 FilterBar 인라인으로 결정 교체
  //   (reports 팝오버 폐기와 동종). 드롭다운 패널 pin(isFilterDropdownOpen·aria-label="필터"·
  //   aria-expanded·role="menu"·backdrop)은 부재-lock. 모바일 Sheet·?filter/서버 persist 무접촉.
  it("§11.297f trace marker (진화 이력 보존)", () => {
    expect(SRC).toMatch(/§11\.297f/);
  });

  it("데스크톱 필터 = 공용 FilterBar 인라인 소비(자체 드롭다운 패널 재발명 0)", () => {
    expect(SRC).toMatch(/from ["']@\/components\/ui\/filter-bar["']/);
    expect(SRC).toMatch(/FilterBar/);
  });

  it("필터-드롭다운 패널 부재-lock — isFilterDropdownOpen·필터 버튼·role=menu 폐기", () => {
    expect(SRC).not.toMatch(/isFilterDropdownOpen/);
    expect(SRC).not.toMatch(/aria-expanded=\{isFilterDropdownOpen\}/);
    expect(SRC).not.toMatch(/aria-label="필터 메뉴"/);
  });

  it("activeFilterCount 파생 보존 (표시 계층 — 화면 소유)", () => {
    expect(SRC).toMatch(/activeFilterCount/);
  });

  it("필터 값(위치/상태) 화면 소유 유지 + 초기화 보존", () => {
    // FilterBar 는 표시만 — locationFilter/statusFilter canonical 은 화면 state.
    expect(SRC).toMatch(/locationFilter/);
    expect(SRC).toMatch(/statusFilter/);
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
