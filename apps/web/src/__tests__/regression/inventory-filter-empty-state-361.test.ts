/**
 * §11.361-2 (회귀) — 재고 필터 빈상태 오표기(fake empty) 정합 sentinel
 *
 * 필터(status/category/location) 결과 0건을 "전역 재고 없음/첫 재고 등록"으로 위장하던 것 →
 * 검색 > 필터 > 진짜0건 3분기 + 필터 활성 시 "필터 초기화" CTA.
 *
 * ⚠️ 재앵커 (2026-08-06, §inventory-dead-file-cleanup P1.5):
 *   최초 판본은 inventory-main.tsx 를 잠갔으나 그 파일은 importer 0 = dead —
 *   §11.361-2 수정 자체가 dead file 에만 적용돼 라이브(inventory-content)에는
 *   fake empty 가 잔존하고 있었다 (dead-file 오적용 3번째 사례, false-GREEN).
 *   본 재앵커에서 계약을 라이브로 이식하고 잠금 대상을 교체했다.
 *   어휘 재앵커: 검색 branch CTA "모든 재고 보기"→"전체 재고 보기",
 *   진짜0건 CTA "첫 재고 등록하기"→"재고 추가하기" (라이브 기존 어휘 보존 —
 *   보호 의도는 문구가 아니라 3분기 + 초기화 CTA).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const SRC = readFileSync(
  join(APP_WEB_ROOT, "src/app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.361-2 — DataTable 빈상태 필터 분기 (라이브 표면)", () => {
  it("activeFilterCount>0 → 조건 빈상태 + 필터 초기화 CTA", () => {
    expect(SRC).toContain("이 조건에 맞는 재고가 없습니다");
    expect(SRC).toContain("필터 초기화");
    // 필터 초기화 액션이 3 필터 모두 reset
    expect(SRC).toContain('setLocationFilter("all"); setStatusFilter("all"); setCategoryFilter("all");');
  });

  it("[후속] 볼드 타이틀도 분기 — 필터 0건에서 '등록된 재고가 없습니다' 위장 0", () => {
    // prod 실측(2026-08-07): InventoryTable 이 타이틀을 하드코드해 필터 분기에서도
    // 전역 빈 재고를 주장. emptyTitle prop 3분기 전달로 교정.
    expect(SRC).toMatch(/emptyTitle=\{[\s\S]{0,300}검색 결과가 없습니다[\s\S]{0,200}이 조건에 맞는 재고가 없습니다[\s\S]{0,200}등록된 재고가 없습니다/);
    const TABLE = readFileSync(
      join(APP_WEB_ROOT, "src/components/inventory/InventoryTable.tsx"),
      "utf8",
    );
    expect(TABLE).toMatch(/emptyTitle = "등록된 재고가 없습니다"/); // 기본값 — 타 호출부 무영향
    expect(TABLE).toMatch(/\{emptyTitle\}/); // 하드코드 제거
    expect(TABLE).not.toMatch(/>등록된 재고가 없습니다</); // JSX 리터럴 타이틀 잔존 0
  });

  it("우선순위 보존: 검색 분기 + 진짜0건(첫 재고) 분기 유지", () => {
    // 검색 branch — 라이브 어휘
    expect(SRC).toContain("전체 재고 보기");
    // 진짜0건 branch — 라이브 어휘
    expect(SRC).toContain("재고 추가하기");
    expect(SRC).toContain("등록된 재고가 없습니다");
  });

  it("분기 우선순위 — 검색 > 필터 > 진짜0건 (필터 분기가 검색 뒤·진짜0건 앞)", () => {
    // emptyMessage 삼항 사슬에서 search → activeFilterCount → 진짜0건 순서 잠금
    expect(SRC).toMatch(
      /debouncedSearchQuery\.trim\(\)[\s\S]{0,200}activeFilterCount > 0[\s\S]{0,200}등록된 재고가 없습니다/,
    );
  });
});
