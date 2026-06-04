/**
 * §11.361-2 (회귀) — 재고 필터 빈상태 오표기(fake empty) 정합 sentinel
 *
 * 필터(status/category/location) 결과 0건을 "전역 재고 없음/첫 재고 등록"으로 위장하던 것 →
 * 검색 > 필터 > 진짜0건 3분기 + 필터 활성 시 "필터 초기화" CTA.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const SRC = readFileSync(
  join(APP_WEB_ROOT, "src/app/dashboard/inventory/inventory-main.tsx"),
  "utf8",
);

describe("§11.361-2 — DataTable 빈상태 필터 분기", () => {
  it("activeFilterCount>0 → 조건 빈상태 + 필터 초기화 CTA", () => {
    expect(SRC).toContain("이 조건에 맞는 재고가 없습니다");
    expect(SRC).toContain("필터 초기화");
    // 필터 초기화 액션이 3 필터 모두 reset
    expect(SRC).toContain('setLocationFilter("all"); setStatusFilter("all"); setCategoryFilter("all");');
  });
  it("우선순위 보존: 검색 분기 + 진짜0건(첫 재고) 분기 유지", () => {
    expect(SRC).toContain("모든 재고 보기");
    expect(SRC).toContain("첫 재고 등록하기");
  });
});
