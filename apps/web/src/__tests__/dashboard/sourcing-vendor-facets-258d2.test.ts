/**
 * §11.258d-2 — 소싱 검색 toolbar 제조사 chip (호영님 spec #7 마지막 잔여).
 *
 * scope:
 *   - test-flow-provider useQuery URL params 안 `facets=true` 추가.
 *   - 응답 의 searchData.facets.vendorCounts (top 20) 를 context 에 expose
 *     (vendorFacets state 또는 provider context value).
 *   - page.tsx 안 카테고리/가격 chip row 인근에 제조사 chip row 추가 — top 5
 *     dynamic (server fetch 결과). 클릭 → setSearchBrand(vendorName).
 *   - "전체 제조사" chip + 개별 vendor chip.
 *
 * server route /api/products/search 변경 0 (facets 기능 line 160-189 이미 구현).
 *
 * canonical truth lock:
 *   - test-flow-provider 의 searchBrand + setSearchBrand state 보존.
 *   - useQuery key + URL params 시그니처 (facets 추가) 보존.
 *   - server route 의 vendorCounts 응답 구조 ({ vendorId, vendorName, count }) 보존.
 *   - §11.258b 정렬 + 카테고리 chip + §11.258d-1 가격 chip 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const PROVIDER_PATH = resolve(__dirname, "../../app/_workbench/_components/test-flow-provider.tsx");
const ROUTE_PATH = resolve(__dirname, "../../app/api/products/search/route.ts");

const pageCode = safeRead(PAGE_PATH);
const providerCode = safeRead(PROVIDER_PATH);
const routeCode = safeRead(ROUTE_PATH);

describe("§11.258d-2 #1 — test-flow-provider facets 활성화", () => {
  it("§11.258d-2 trace marker (provider)", () => {
    expect(providerCode).toMatch(/§11\.258d-2|11\.258d-2/);
  });

  it("useQuery URL params 안 facets=true 추가", () => {
    expect(providerCode).toMatch(/facets:\s*["']true["']/);
  });

  it("vendorFacets context value expose", () => {
    expect(providerCode).toMatch(/vendorFacets/);
  });
});

describe("§11.258d-2 #2 — page.tsx 제조사 chip row", () => {
  it("§11.258d-2 trace marker (page)", () => {
    expect(pageCode).toMatch(/§11\.258d-2|11\.258d-2/);
  });

  it("useTestFlow destructure 안 vendorFacets 추가", () => {
    expect(pageCode).toMatch(/vendorFacets/);
  });

  it("setSearchBrand 호출 (chip click handler)", () => {
    expect(pageCode).toMatch(/setSearchBrand\(/);
  });

  it("'전체 제조사' chip + setSearchBrand('') reset 패턴", () => {
    expect(pageCode).toMatch(/전체\s*제조사|모든\s*제조사/);
    expect(pageCode).toMatch(/setSearchBrand\(["']{2}\)/);
  });

  it("vendor chip data-testid prefix 'sourcing-vendor-chip-'", () => {
    expect(pageCode).toMatch(/sourcing-vendor-chip/);
  });

  it("vendorFacets.slice 또는 vendorFacets.map (top 5 노출)", () => {
    expect(pageCode).toMatch(/vendorFacets\??[.\s]*(slice|map)/);
  });
});

describe("§11.258d-2 — invariant 보존", () => {
  it("server route /api/products/search 의 vendorCounts 응답 구조 보존", () => {
    expect(routeCode).toMatch(/vendorCounts/);
    expect(routeCode).toMatch(/vendorName/);
    expect(routeCode).toMatch(/includeFacets/);
  });

  it("test-flow-provider searchBrand + setSearchBrand 시그니처 보존", () => {
    expect(providerCode).toMatch(/searchBrand:\s*string/);
    expect(providerCode).toMatch(/setSearchBrand:\s*\(/);
  });

  it("§11.258b 정렬 4 옵션 + 카테고리 chip 4개 보존", () => {
    expect(pageCode).toMatch(/value=["']relevance["']/);
    expect(pageCode).toMatch(/setSearchCategory\(["']REAGENT["']\)/);
  });

  it("§11.258d-1 sortBy 'name' + 가격대 chip 보존", () => {
    expect(pageCode).toMatch(/value=["']name["']/);
    expect(pageCode).toMatch(/setMinPrice\(50000\)/);
  });

  it("§11.258c 자동완성 + §11.258a 최근 검색어 + §11.254/§11.254b 보존", () => {
    expect(pageCode).toMatch(/useAutocomplete/);
    expect(pageCode).toMatch(/recentSearches/);
    expect(pageCode).toMatch(/href=["']\/dashboard\/settings["']/);
  });
});
