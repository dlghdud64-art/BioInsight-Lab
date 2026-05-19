/**
 * §11.258c-2 — 소싱 검색 자동완성 데스크탑 inline dropdown (호영님 spec #6 데스크탑 확장).
 *
 * §11.258c 는 모바일 (md:hidden form) 한정 dropdown. 데스크탑 inline form
 * (hidden md:flex) 은 미적용 → 데스크탑 사용자에게 자동완성 미노출.
 *
 * scope §11.258c-2:
 *   - 데스크탑 form 의 input 에 onFocus/onBlur 추가 → desktopAutocompleteOpen state.
 *   - 데스크탑 form 안 absolute dropdown (same UI 패턴: type chip + label).
 *   - useAutocomplete hook 재사용 (server route + debounce 동일).
 *   - handlePickRecent helper 재사용 (모바일 dropdown 와 동일 click 흐름).
 *
 * canonical truth lock:
 *   - useAutocomplete hook 시그니처 보존.
 *   - server route /api/search/autocomplete 변경 0.
 *   - §11.258c 모바일 dropdown 보존.
 *   - 데스크탑 form 의 X 클리어 + 검색 button + Input 시그니처 보존.
 *   - data-testid="sourcing-search-input" (데스크탑) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const HOOK_PATH = resolve(__dirname, "../../hooks/use-autocomplete.ts");
const ROUTE_PATH = resolve(__dirname, "../../app/api/search/autocomplete/route.ts");

const pageCode = safeRead(PAGE_PATH);
const hookCode = safeRead(HOOK_PATH);
const routeCode = safeRead(ROUTE_PATH);

describe("§11.258c-2 #1 — 데스크탑 자동완성 dropdown", () => {
  it("§11.258c-2 trace marker (page)", () => {
    expect(pageCode).toMatch(/§11\.258c-2|11\.258c-2/);
  });

  it("데스크탑 input onFocus 핸들러 추가 (autocomplete dropdown open)", () => {
    // hidden md:flex form 안 sourcing-search-input 에 onFocus 추가.
    expect(pageCode).toMatch(/hidden\s+md:flex[\s\S]{0,2500}sourcing-search-input[\s\S]{0,800}onFocus/);
  });

  it("데스크탑 autocomplete open state (desktopAutocompleteOpen 또는 desktopOpen)", () => {
    expect(pageCode).toMatch(/desktopAutocompleteOpen|desktopOpen/);
  });

  it("데스크탑 dropdown render 분기 (hidden md:flex form 안 absolute)", () => {
    // 데스크탑 dropdown 이 'hidden md:block' 또는 'hidden md:flex' 또는 inline absolute 분기.
    expect(pageCode).toMatch(/(hidden\s+md:block|hidden\s+md:flex)[\s\S]{0,500}autocompleteItems/);
  });

  it("데스크탑 dropdown type label (품목 / 제조사 / 카탈로그) 보존", () => {
    expect(pageCode).toMatch(/품목/);
    expect(pageCode).toMatch(/제조사/);
    expect(pageCode).toMatch(/카탈로그/);
  });
});

describe("§11.258c-2 — invariant 보존", () => {
  it("useAutocomplete hook 시그니처 보존 (변경 0)", () => {
    expect(hookCode).toMatch(/export\s+function\s+useAutocomplete\(query:\s*string\)/);
    expect(hookCode).toMatch(/setTimeout/);
    expect(hookCode).toMatch(/300/);
  });

  it("server route /api/search/autocomplete 변경 0 (3 type 병렬 보존)", () => {
    expect(routeCode).toMatch(/export\s+async\s+function\s+GET/);
    expect(routeCode).toMatch(/type:\s*["']product["']/);
    expect(routeCode).toMatch(/type:\s*["']brand["']/);
    expect(routeCode).toMatch(/type:\s*["']catalog["']/);
  });

  it("§11.258c 모바일 dropdown (md:hidden form 안 자동완성) 보존", () => {
    expect(pageCode).toMatch(/md:hidden[\s\S]{0,3000}autocompleteItems/);
  });

  it("§11.258a 데스크탑 form X 클리어 button 보존", () => {
    expect(pageCode).toMatch(/hidden\s+md:flex[\s\S]{0,1500}aria-label=["']검색어\s*지우기["']/);
  });

  it("data-testid='sourcing-search-input' (데스크탑) + 'sourcing-search-input-mobile' (모바일) 보존", () => {
    expect(pageCode).toMatch(/data-testid=["']sourcing-search-input["']/);
    expect(pageCode).toMatch(/data-testid=["']sourcing-search-input-mobile["']/);
  });

  it("§11.258b 정렬 select + §11.258d-1 가격 chip 보존", () => {
    expect(pageCode).toMatch(/data-testid=["']sourcing-sort-select["']/);
    expect(pageCode).toMatch(/data-testid=["']sourcing-price-chip-low["']/);
  });
});
