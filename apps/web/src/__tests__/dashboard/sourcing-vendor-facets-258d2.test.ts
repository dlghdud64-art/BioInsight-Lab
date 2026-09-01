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

  /* 🔁 승계 교체 (2026-09-02 · 호영님 승인) — chip row → dropdown (§11.294).
   *
   * 옛 계약: "전체 제조사" chip + `sourcing-vendor-chip-` prefix 로 제조사 facet 을 그린다.
   * 새 계약: 같은 능력을 **dropdown** 이 든다 — `sourcing-vendor-dropdown`.
   *   §11.294 가 새 형태를 잠그고, **옛 chip 제거까지 역방향으로 잠근다**
   *   (`not.toMatch(/>전체 제조사</)` · `not.toMatch(/sourcing-vendor-chip-all/)`).
   *   즉 여기 남은 긍정 단언은 그 결정과 **정면으로 모순**이었다 — 어느 쪽도 이길 수 없는 상태.
   *
   * 🛑 새 testid 로 "경로만 갱신" 하지 않는다: §11.294 가 이미 잠근 사실을 여기서 다시 잠그면
   *    같은 계약이 두 곳에 생기고, 갈라지는 순간 어느 쪽이 정본인지 알 수 없다.
   *    아래 "승계 확인" 이 후계 실재만 본다 — 역방향 잠금은 §11.294 소유.
   *
   * 🔑 능력 자체는 살아 있다(실측 2026-09-02): 제조사 선택 `setSearchBrand(v.vendorName)` ·
   *    해제 `setSearchBrand("")`(aria-label "제조사 필터 해제") 모두 dropdown 안에 있다.
   *    바로 위 "setSearchBrand 호출" it 이 그 능력을 계속 잠근다 — 표현만 바뀌었다. */
  it("승계 확인 — §11.294 후계 잠금이 실재한다 (은퇴가 무잠금이 되지 않게)", () => {
    const successor = resolve(
      __dirname,
      "../regression/sourcing-filter-row-dropdown-294.test.ts",
    );
    expect(existsSync(successor)).toBe(true);
    const code = readFileSync(successor, "utf8");
    expect(code).toMatch(/sourcing-vendor-dropdown/);
    /* 후계가 **옛 형태 제거**까지 들고 있는지 — 이게 없으면 은퇴가 곧 무잠금이다. */
    expect(code).toMatch(/not\.toMatch\(\/data-testid="sourcing-vendor-chip-all"\/\)/);
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

  /* 🔁 리터럴 핀 → **능력 단언**으로 승격 (2026-09-02 · 리뷰 조건).
   *
   * 옛 단언은 `setSearchCategory("REAGENT")` · `setMinPrice(50000)` 처럼 **리터럴 인자**를 핀했다.
   * 필터가 하드코딩 chip 에서 **데이터 주도 목록**으로 바뀌자(`setSearchCategory(cat)` ·
   * `setMinPrice(opt.min)`) 능력은 그대로인데 단언만 깨졌다 — 구현 세부를 계약으로 착각한 것이다.
   * 🛑 새 리터럴로 갈아끼우면 **같은 취약성을 재생산**한다. 그래서 "그 값이 있다" 가 아니라
   *    "그 필터가 존재하고 초기화된다" 를 단언한다. 다음 리팩터가 목록 구성을 또 바꿔도
   *    능력이 살아 있는 한 GREEN 이어야 하고, 능력이 사라지면 RED 여야 한다. */
  it("§11.258b 정렬 4 옵션 + 카테고리 필터 능력 보존 (리터럴 아님)", () => {
    expect(pageCode).toMatch(/value=["']relevance["']/);
    /* 카테고리 선택 + 해제(초기화)가 존재한다 — 값 목록의 구성은 계약이 아니다. */
    expect(pageCode).toMatch(/setSearchCategory\(/);
    expect(pageCode).toMatch(/setSearchCategory\(["']{2}\)/);
  });

  it("§11.258d-1 sortBy 'name' + 가격대 필터 능력 보존 (리터럴 아님)", () => {
    expect(pageCode).toMatch(/value=["']name["']/);
    /* 가격 하한 설정 + 해제(undefined 로 초기화)가 존재한다. */
    expect(pageCode).toMatch(/setMinPrice\(/);
    expect(pageCode).toMatch(/setMinPrice\(undefined\)/);
  });

  it("§11.258c 자동완성 + §11.258a 최근 검색어 + §11.254/§11.254b 보존", () => {
    expect(pageCode).toMatch(/useAutocomplete/);
    expect(pageCode).toMatch(/recentSearches/);
    expect(pageCode).toMatch(/href=["']\/dashboard\/settings["']/);
  });
});
