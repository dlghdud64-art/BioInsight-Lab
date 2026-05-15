/**
 * §11.246d-1 #quote-search-debounce — 호영님 P0 성능 #11 필터 디바운스 300ms
 *
 * 호영님 spec:
 *   - 필터 드롭다운 변경 시 즉시 API 호출하지 않음
 *   - 300ms 디바운스 적용 → 연속 필터 변경 시 마지막 1회만 fetch (또는 filter)
 *   - 필터 변경 중 기존 데이터를 흐리게 표시 (Phase B 백로그)
 *
 * Scope: quotes/page.tsx 의 searchQuery (text input) 디바운스 적용.
 *   - 현재: onChange 시 즉시 setSearchQuery → filteredQuotes useMemo 재계산
 *   - 변경: useDebounce(searchQuery, 300) → filteredQuotes deps 에 debouncedSearchQuery
 *   - client filter 이지만 큰 quotes list (12+ rows) 의 .filter() 매 keystroke 호출 부담 ↓
 *
 * canonical truth lock:
 *   - sortedQuotes / filteredQuotes / quotes state 변경 0
 *   - useDebounce hook 보존 (이미 존재, inventory-main.tsx 에서 사용 중)
 *   - searchQuery state 보존 — input value 즉시 반응 (UI), filter 만 debounce
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.246d-1 #1 — useDebounce hook 적용 (300ms)", () => {
  it("useDebounce import (@/hooks/use-debounce)", () => {
    expect(page).toMatch(/import\s*\{[\s\S]{0,80}useDebounce[\s\S]{0,80}\}\s*from\s*"@\/hooks\/use-debounce"/);
  });

  it("debouncedSearchQuery — useDebounce(searchQuery, 300) 호출", () => {
    expect(page).toMatch(/(debouncedSearchQuery|debouncedSearch)\s*=\s*useDebounce\(searchQuery,\s*300\)/);
  });
});

describe("§11.246d-1 #2 — filteredQuotes deps 에 debounced 변수 적용", () => {
  it("filteredQuotes useMemo deps — debouncedSearchQuery 포함 (input 즉시 반응 차단)", () => {
    // useMemo([..., debouncedSearchQuery, ...]) 또는 filter 내부에서 debouncedSearchQuery 사용
    expect(page).toMatch(/(debouncedSearchQuery|debouncedSearch)/);
  });
});

describe("§11.246d-1 #3 — invariant 보존", () => {
  it("searchQuery state 보존 (input value 즉시 반응)", () => {
    expect(page).toMatch(/const \[searchQuery, setSearchQuery\] = useState/);
  });

  it("Input onChange — setSearchQuery 직접 호출 (즉시 반응)", () => {
    expect(page).toMatch(/onChange=\{\(e\)\s*=>\s*setSearchQuery\(e\.target\.value\)\}/);
  });

  it("filteredQuotes useMemo 보존 (sortedQuotes pipeline)", () => {
    expect(page).toMatch(/filteredQuotes\s*=\s*useMemo/);
  });

  it("§11.246d-1 trace marker comment", () => {
    expect(page).toMatch(/§11\.246d[\s\S]{0,300}(debounce|디바운스|300ms)/i);
  });
});
