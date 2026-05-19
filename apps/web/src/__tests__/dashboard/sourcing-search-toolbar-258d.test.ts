/**
 * §11.258d-1 — 소싱 검색 toolbar "이름순" 정렬 + 가격대 필터칩 (호영님 spec #7 잔여 client-side).
 *
 * 호영님 spec:
 *   - 정렬 "이름순" 추가 — sortBy enum 에 "name" 확장 (server route 이미 처리, line 119).
 *   - 가격대 chip — "전체 / ~5만 / 5~20만 / 20만~" 4 chip. setMinPrice + setMaxPrice
 *     동시 호출 (test-flow-provider 의 state + server route 정합 line 182-183).
 *
 * 제조사 chip (#7 잔여) + 자동완성 (#6) 은 server distinct vendor 집계 / 신규 API route
 *   필요 → §11.258c (자동완성) / §11.258d-2 (제조사) 별도 cluster.
 *
 * canonical truth lock:
 *   - test-flow-provider 의 sortBy enum 확장 ("name" 추가) + setSortBy 시그니처 보존.
 *   - test-flow-provider 의 minPrice / maxPrice / setMinPrice / setMaxPrice state 보존.
 *   - server route /api/products/search 의 sortBy === "name" 분기 (line 119) 보존.
 *   - SORT_OPTIONS 의 review 항목 보존 (UI 노출은 별도 결정).
 *   - §11.258b 정렬 4 옵션 + 카테고리 chip 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const PROVIDER_PATH = resolve(__dirname, "../../app/_workbench/_components/test-flow-provider.tsx");
const code = safeRead(PAGE_PATH);
const providerCode = safeRead(PROVIDER_PATH);

describe("§11.258d-1 #1 — sortBy 'name' enum 확장", () => {
  it("§11.258d trace marker (page.tsx)", () => {
    expect(code).toMatch(/§11\.258d|11\.258d/);
  });

  it("test-flow-provider sortBy enum 안 'name' 추가 (interface)", () => {
    // `sortBy: "relevance" | "price_low" | "price_high" | "lead_time" | "name"` 또는 비슷.
    expect(providerCode).toMatch(/sortBy:\s*["']relevance["'][\s\S]{0,200}["']name["']/);
  });

  it("test-flow-provider setSortBy enum 안 'name' 추가 (interface)", () => {
    expect(providerCode).toMatch(/setSortBy:\s*\([^)]*\)\s*=>\s*void/);
    // setSortBy 시그니처 안 "name" 포함.
    expect(providerCode).toMatch(/setSortBy[\s\S]{0,300}["']name["']/);
  });

  it("page.tsx 정렬 select 에 <option value='name'>이름순</option> 추가", () => {
    expect(code).toMatch(/value=["']name["'][\s\S]{0,50}이름순|이름순[\s\S]{0,50}value=["']name["']/);
  });
});

describe("§11.258d-1 #2 — 가격대 필터칩 (전체 / ~5만 / 5~20만 / 20만~)", () => {
  it("'~5만' chip + setMaxPrice(50000) 호출 (minPrice undefined)", () => {
    expect(code).toMatch(/setMaxPrice\(50000\)/);
  });

  it("'5~20만' chip + setMinPrice(50000) + setMaxPrice(200000)", () => {
    expect(code).toMatch(/setMinPrice\(50000\)[\s\S]{0,200}setMaxPrice\(200000\)|setMaxPrice\(200000\)[\s\S]{0,200}setMinPrice\(50000\)/);
  });

  it("'20만~' chip + setMinPrice(200000)", () => {
    expect(code).toMatch(/setMinPrice\(200000\)/);
  });

  it("'전체' 가격 chip + setMinPrice(undefined) + setMaxPrice(undefined)", () => {
    // 전체 가격 reset chip — undefined 동시 호출.
    expect(code).toMatch(/setMinPrice\(undefined\)[\s\S]{0,200}setMaxPrice\(undefined\)|setMaxPrice\(undefined\)[\s\S]{0,200}setMinPrice\(undefined\)/);
  });

  it("가격대 chip data-testid prefix 'sourcing-price-chip-' 또는 동치", () => {
    expect(code).toMatch(/data-testid=["']sourcing-price-chip|sourcing-price-/);
  });

  it("'~5만' + '5~20만' + '20만~' 라벨 보존", () => {
    expect(code).toMatch(/~\s*5만|~5만/);
    expect(code).toMatch(/5\s*~\s*20만|5~20만/);
    expect(code).toMatch(/20만\s*~|20만~/);
  });
});

describe("§11.258d-1 — invariant 보존", () => {
  it("§11.258b 정렬 4 옵션 (relevance/price_low/price_high/lead_time) 보존", () => {
    expect(code).toMatch(/value=["']relevance["']/);
    expect(code).toMatch(/value=["']price_low["']/);
    expect(code).toMatch(/value=["']price_high["']/);
    expect(code).toMatch(/value=["']lead_time["']/);
  });

  it("§11.258b 카테고리 chip 4개 보존 (전체 / 시약 / 기구 / 장비)", () => {
    expect(code).toMatch(/setSearchCategory\(["']{2}\)/);
    expect(code).toMatch(/setSearchCategory\(["']REAGENT["']\)/);
    expect(code).toMatch(/setSearchCategory\(["']TOOL["']\)/);
    expect(code).toMatch(/setSearchCategory\(["']EQUIPMENT["']\)/);
  });

  it("test-flow-provider minPrice / maxPrice / setMinPrice / setMaxPrice state 보존", () => {
    expect(providerCode).toMatch(/minPrice:\s*number\s*\|\s*undefined/);
    expect(providerCode).toMatch(/setMinPrice/);
    expect(providerCode).toMatch(/maxPrice:\s*number\s*\|\s*undefined/);
    expect(providerCode).toMatch(/setMaxPrice/);
  });

  it("server route /api/products/search sortBy === 'name' 분기 보존", () => {
    const serverPath = resolve(__dirname, "../../app/api/products/search/route.ts");
    const serverCode = safeRead(serverPath);
    expect(serverCode).toMatch(/sortBy\s*===\s*["']name["']/);
    expect(serverCode).toMatch(/a\.name\.localeCompare\(b\.name\)/);
  });

  it("§11.254 / §11.254b / §11.258a 시그니처 보존", () => {
    expect(code).toMatch(/href=["']\/["'][\s\S]{0,300}LabAxis/);
    expect(code).toMatch(/href=["']\/dashboard\/settings["']/);
    expect(code).toMatch(/md:hidden[\s\S]{0,2000}sourcing-search-input-mobile/);
  });
});
