/**
 * §11.258c — 소싱 검색 자동완성 (호영님 spec #6).
 *
 * 호영님 spec:
 *   - 2글자 이상 입력 시 server 자동완성 결과 표시.
 *   - 품목명 / 제조사 / 카탈로그 번호 매칭 결과 type 별 표시.
 *   - debounce 300ms — 불필요한 API 호출 방지.
 *
 * scope minimum (§11.258c-1):
 *   - server route /api/search/autocomplete GET — query `q`, type 별 top 5.
 *   - client hook useAutocomplete — debounce 300ms + fetch + 결과 state.
 *   - page.tsx 안 dropdown — input 아래, 모바일 한정 (데스크탑 inline 위치 별도).
 *
 * 더 발전된 기능 (multi-select chip / 화살표 keyboard nav 등) 은 별도 백로그.
 *
 * canonical truth lock:
 *   - Product 모델 (name + brand + catalogNumber, indexed) 보존.
 *   - 기존 /api/products/search route 변경 0 (별도 endpoint 신규).
 *   - §11.258a 최근 검색어 dropdown + X 클리어 보존.
 *   - 빈 query 시 fetch 0 (server 부하 차단).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(__dirname, "../../app/api/search/autocomplete/route.ts");
const HOOK_PATH = resolve(__dirname, "../../hooks/use-autocomplete.ts");
const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");

const routeCode = safeRead(ROUTE_PATH);
const hookCode = safeRead(HOOK_PATH);
const pageCode = safeRead(PAGE_PATH);

describe("§11.258c #1 — server route /api/search/autocomplete", () => {
  it("route file 존재 + GET export", () => {
    expect(routeCode).toMatch(/export\s+async\s+function\s+GET\s*\(/);
  });

  it("§11.258c trace marker (route)", () => {
    expect(routeCode).toMatch(/§11\.258c|11\.258c/);
  });

  it("query string 'q' parsing + 최소 길이 가드 (2글자+)", () => {
    expect(routeCode).toMatch(/searchParams\.get\(["']q["']\)/);
    // 2 글자 미만 시 빈 결과 반환 (호영님 spec "2글자 이상").
    expect(routeCode).toMatch(/length\s*<\s*2|length\s*<=\s*1|trim\(\)\.length\s*<\s*2/);
  });

  it("Prisma findMany — name / brand / catalogNumber 3 field contains 검색", () => {
    expect(routeCode).toMatch(/db\.product\.findMany|product\.findMany/);
    expect(routeCode).toMatch(/name:[\s\S]{0,200}contains/);
    expect(routeCode).toMatch(/brand:[\s\S]{0,200}contains/);
    expect(routeCode).toMatch(/catalogNumber:[\s\S]{0,200}contains/);
  });

  it("결과 type 분류 (product / brand / catalog)", () => {
    // 응답 items[].type 안 "product"|"brand"|"catalog" 매핑.
    expect(routeCode).toMatch(/type:\s*["']product["']/);
    expect(routeCode).toMatch(/type:\s*["']brand["']/);
    expect(routeCode).toMatch(/type:\s*["']catalog["']/);
  });

  it("take limit (server 부하 차단, take ≤ 10 또는 limit 변수)", () => {
    // take: 5 / take: 10 literal 또는 take: limit / take: limit * N 변수 모두 허용.
    expect(routeCode).toMatch(/take:\s*[1-9](?!\d)|take:\s*10|take:\s*limit/);
  });
});

describe("§11.258c #2 — client hook useAutocomplete (debounce 300ms)", () => {
  it("hook file 존재 + useAutocomplete export", () => {
    expect(hookCode).toMatch(/export\s+(function\s+useAutocomplete|const\s+useAutocomplete\s*=)/);
  });

  it("§11.258c trace marker (hook)", () => {
    expect(hookCode).toMatch(/§11\.258c|11\.258c/);
  });

  it("debounce 300ms (setTimeout + cleanup) — 호영님 spec", () => {
    expect(hookCode).toMatch(/setTimeout/);
    expect(hookCode).toMatch(/300/);
    expect(hookCode).toMatch(/clearTimeout/);
  });

  it("fetch /api/search/autocomplete 호출", () => {
    expect(hookCode).toMatch(/\/api\/search\/autocomplete/);
  });

  it("2글자 미만 시 fetch 차단 (early return)", () => {
    expect(hookCode).toMatch(/length\s*<\s*2|length\s*<=\s*1|trim\(\)\.length\s*<\s*2/);
  });
});

describe("§11.258c #3 — page.tsx dropdown UI", () => {
  it("useAutocomplete hook import + 사용", () => {
    expect(pageCode).toMatch(/useAutocomplete/);
  });

  it("§11.258c trace marker (page)", () => {
    expect(pageCode).toMatch(/§11\.258c|11\.258c/);
  });

  it("자동완성 dropdown UI ('품목' / '제조사' / '카탈로그' label 매핑)", () => {
    expect(pageCode).toMatch(/품목|제조사|카탈로그/);
  });
});

describe("§11.258c — invariant 보존", () => {
  it("§11.254 LabAxis Link + §11.254b 햄버거 + §11.258a 모바일 form + §11.258b 정렬 select 모두 보존", () => {
    expect(pageCode).toMatch(/href=["']\/["'][\s\S]{0,300}LabAxis/);
    expect(pageCode).toMatch(/href=["']\/dashboard\/settings["']/);
    expect(pageCode).toMatch(/md:hidden[\s\S]{0,2000}sourcing-search-input-mobile/);
    expect(pageCode).toMatch(/data-testid=["']sourcing-sort-select["']/);
  });

  it("§11.258a 최근 검색어 + X 클리어 보존 (handleClearQuery / recentSearches)", () => {
    expect(pageCode).toMatch(/handleClearQuery|recentSearches/);
  });

  it("§11.258d-1 sortBy 'name' + 가격대 chip (setMinPrice/setMaxPrice) 보존", () => {
    expect(pageCode).toMatch(/value=["']name["']/);
    expect(pageCode).toMatch(/setMinPrice\(50000\)/);
  });

  it("기존 /api/products/search route 변경 0 (별도 endpoint 신규)", () => {
    const existingSearchPath = resolve(__dirname, "../../app/api/products/search/route.ts");
    const existingCode = safeRead(existingSearchPath);
    expect(existingCode).toMatch(/sortBy\s*===\s*["']name["']/);
  });
});
