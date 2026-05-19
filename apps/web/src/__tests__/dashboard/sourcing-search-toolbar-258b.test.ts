/**
 * §11.258b — 소싱 검색 결과 toolbar 정렬 + 카테고리 필터칩 (호영님 spec #7 client-side scope).
 *
 * 호영님 spec:
 *   - 정렬: 가격순 | 이름순 | AI 추천순 | 배송기간순.
 *     server 지원 4 옵션 (relevance / price_low / price_high / lead_time)
 *     UI selector 만 노출. "이름순" 은 server 미지원 → §11.258d 백로그.
 *   - 카테고리 필터칩: 시약 | 기구 | 장비 (전체 + 3 카테고리).
 *     기존 searchCategory state + server fetch 정합 (test-flow-provider).
 *     PRODUCT_CATEGORIES key 매핑 (REAGENT/TOOL/EQUIPMENT).
 *
 * 자동완성 (#6) + 가격대/제조사 필터 (#7 잔여) 는 server 의존 → §11.258c/d 백로그.
 *
 * canonical truth lock:
 *   - test-flow-provider 의 sortBy + setSortBy + searchCategory + setSearchCategory state 보존.
 *   - SORT_OPTIONS / PRODUCT_CATEGORIES (lib/constants) 보존.
 *   - 결과 수 + 필터 count + 비교/견적 후보 + 필터/재고 button 보존.
 *   - useQuery key 안 sortBy + searchCategory 보존 (server fetch 정합).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const code = safeRead(PAGE_PATH);

describe("§11.258b #1 — toolbar 정렬 selector (server 4 옵션)", () => {
  it("§11.258b trace marker", () => {
    expect(code).toMatch(/§11\.258b|11\.258b/);
  });

  it("정렬 select element (data-testid='sourcing-sort-select')", () => {
    expect(code).toMatch(/data-testid=["']sourcing-sort-select["']/);
  });

  it("정렬 select 4 옵션 (relevance / price_low / price_high / lead_time) value 모두 존재", () => {
    expect(code).toMatch(/value=["']relevance["']/);
    expect(code).toMatch(/value=["']price_low["']/);
    expect(code).toMatch(/value=["']price_high["']/);
    expect(code).toMatch(/value=["']lead_time["']/);
  });

  it("정렬 select onChange → setSortBy 호출", () => {
    expect(code).toMatch(/setSortBy\(/);
  });

  it("정렬 select aria-label '정렬' 또는 '정렬 기준'", () => {
    expect(code).toMatch(/aria-label=["']정렬\s*기준|aria-label=["']정렬["']/);
  });
});

describe("§11.258b #2 — 카테고리 필터칩 (전체 / 시약 / 기구 / 장비)", () => {
  it("'전체' 카테고리 chip (setSearchCategory('') 호출)", () => {
    expect(code).toMatch(/setSearchCategory\(["']{2}\)/);
  });

  it("REAGENT chip (setSearchCategory('REAGENT'))", () => {
    expect(code).toMatch(/setSearchCategory\(["']REAGENT["']\)/);
  });

  it("TOOL chip (setSearchCategory('TOOL'))", () => {
    expect(code).toMatch(/setSearchCategory\(["']TOOL["']\)/);
  });

  it("EQUIPMENT chip (setSearchCategory('EQUIPMENT'))", () => {
    expect(code).toMatch(/setSearchCategory\(["']EQUIPMENT["']\)/);
  });

  it("'시약' + '기구' + '장비' 라벨 보존 (PRODUCT_CATEGORIES 정합)", () => {
    expect(code).toMatch(/시약/);
    expect(code).toMatch(/기구/);
    expect(code).toMatch(/장비/);
  });

  it("카테고리 chip data-testid prefix 'sourcing-category-chip-' 또는 동치", () => {
    expect(code).toMatch(/data-testid=["']sourcing-category-chip|sourcing-category-/);
  });
});

describe("§11.258b — invariant 보존", () => {
  it("기존 결과 수 + 필터 count + 비교/견적 후보 표시 보존", () => {
    expect(code).toMatch(/{products\.length}/);
    expect(code).toMatch(/비교\s*후보/);
    expect(code).toMatch(/견적\s*후보/);
  });

  it("기존 필터 button (SlidersHorizontal) + 재고 button 보존", () => {
    expect(code).toMatch(/SlidersHorizontal/);
  });

  it("setSortBy + sortBy state 사용 (useTestFlow 정합)", () => {
    expect(code).toMatch(/sortBy/);
    expect(code).toMatch(/setSortBy/);
  });

  it("setSearchCategory + searchCategory state 사용 (useTestFlow 정합)", () => {
    expect(code).toMatch(/setSearchCategory/);
  });

  it("§11.254 LabAxis Link + 소싱 Link 보존", () => {
    expect(code).toMatch(/href=["']\/["'][\s\S]{0,300}LabAxis/);
    expect(code).toMatch(/href=["']\/app\/search["']/);
  });

  it("§11.254b 햄버거 5 entry 보존 (대시보드 / 견적 / 구매 / 재고 / 설정)", () => {
    expect(code).toMatch(/href=["']\/dashboard["']/);
    expect(code).toMatch(/href=["']\/dashboard\/quotes["']/);
    expect(code).toMatch(/href=["']\/dashboard\/purchases["']/);
    expect(code).toMatch(/href=["']\/dashboard\/inventory["']/);
    expect(code).toMatch(/href=["']\/dashboard\/settings["']/);
  });

  it("§11.258a 모바일 검색 form (md:hidden) 보존", () => {
    expect(code).toMatch(/md:hidden[\s\S]{0,2000}sourcing-search-input-mobile/);
  });
});
