/**
 * §11.335b (회귀) — 소싱 검색 매칭 정밀화 sentinel (§11.337-v2/v3 승계)
 *
 * Decision(호영님 P2): ① min 2글자(1글자는 결과 0 → UI "2글자 이상")
 *   ② 2글자 = 품명/Cat.No startsWith + 품명 공백-경계만(단어 중간 contains 컷)
 *   ③ ≥3자 = 전 필드 contains 보존(§11.335 Cat.No 검색)
 *   ④ 랭킹 강도: 시작 일치 > 단어경계 > 포함 (NAME_PREFIX 40 > WORD_BOUNDARY 30 > CONTAINS 20)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const RANKING = "src/lib/search/ranking.ts";
const ROUTE = "src/app/api/products/search/route.ts";
const ROW = "src/app/_workbench/_components/sourcing-result-row.tsx";

describe("§11.335b — min 2글자 게이트", () => {
  it("buildSearchQuery: <2자 never-match 반환", () => {
    const src = read(RANKING);
    expect(src).toMatch(/normalizedQuery\.length < QUERY_MIN_LENGTH/);
    expect(src).toMatch(/__never_match__/);
  });
  it("isShortQuery === 2 (1자 제외, 2자만 짧은 쿼리 밴드)", () => {
    const src = read(RANKING);
    expect(src).toMatch(/const isShortQuery = normalizedQuery\.length === 2/);
  });
  it("API route: query.trim().length < 2 → minLength 반환", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/query\.trim\(\)\.length < 2/);
    expect(src).toMatch(/minLength:\s*2/);
  });
  it("UI: 1글자 빈 상태 '2글자 이상' 분기", () => {
    const src = read("src/app/_workbench/search/page.tsx");
    expect(src).toMatch(/searchQuery\.trim\(\)\.length < 2/);
    expect(src).toMatch(/2글자 이상 입력하세요/);
  });
});

describe("§11.335b — 2글자 조이기 / ≥3자 보존", () => {
  it("2글자: 품명 startsWith + 공백경계 + Cat.No startsWith (단어 중간 contains 컷)", () => {
    const src = read(RANKING);
    expect(src).toMatch(/name: \{ startsWith: q, mode: "insensitive" \}/);
    expect(src).toMatch(/name: \{ contains: ` \$\{q\}`, mode: "insensitive" \}/);
    expect(src).toMatch(/catalogNumber: \{ startsWith: q, mode: "insensitive" \}/);
  });
  it("≥3자: name/catalogNumber/brand contains 보존(§11.335)", () => {
    const src = read(RANKING);
    expect(src).toMatch(/name: \{ contains: q, mode: "insensitive" \}/);
    expect(src).toMatch(/brand: \{ contains: q, mode: "insensitive" \}/);
  });
});

describe("§11.335b — 랭킹 강도 티어 (시작 > 단어경계 > 포함)", () => {
  it("NAME_WORD_BOUNDARY 가중치 존재(40 > 30 > 20)", () => {
    const src = read(RANKING);
    expect(src).toMatch(/NAME_WORD_BOUNDARY:\s*30/);
    expect(src).toMatch(/NAME_PREFIX:\s*40/);
    expect(src).toMatch(/NAME_CONTAINS:\s*20/);
  });
  it("nameWordBoundary factor + hasWordBoundaryMatch 헬퍼", () => {
    const src = read(RANKING);
    expect(src).toMatch(/nameWordBoundary/);
    expect(src).toMatch(/export function hasWordBoundaryMatch/);
  });
  it("calculateRelevanceScore: prefix elif wordBoundary elif contains", () => {
    const src = read(RANKING);
    expect(src).toMatch(/namePrefix\)[\s\S]{0,80}NAME_PREFIX[\s\S]{0,120}nameWordBoundary\)[\s\S]{0,80}NAME_WORD_BOUNDARY[\s\S]{0,120}nameContains\)[\s\S]{0,80}NAME_CONTAINS/);
  });
});

describe("§11.335b — 배지 강도 구분 + REFRIG 회귀", () => {
  it("buildMatchReason: 품명 시작 일치 / 품명 일치 / Cat.No 일치 / 제조사 일치 강도", () => {
    const src = read(ROW);
    expect(src).toMatch(/품명 시작 일치/);
    expect(src).toMatch(/Cat\.No 일치/);
    expect(src).toMatch(/제조사 일치/);
  });
  it("1글자(미만) 배지 없음", () => {
    const src = read(ROW);
    expect(src).toMatch(/q\.length < 2[\s\S]{0,40}return null/);
  });
  it("REFRIG 회귀: 품명 무매칭 → Cat.No 일치 fallback 순서 보존", () => {
    const src = read(ROW);
    // 품명 검사들이 catalogNumber 검사보다 먼저, cat.includes 가 brand 보다 먼저.
    expect(src).toMatch(/nameStarts[\s\S]{0,400}cat\.includes\(q\)[\s\S]{0,200}brand\.includes\(q\)/);
  });
});

describe("§11.335b 회귀 0 — 점수/정렬 보존", () => {
  it("scoreProduct prefix 우선 가중치 보존", () => {
    const src = read(RANKING);
    expect(src).toMatch(/CATALOG_PREFIX/);
    expect(src).toMatch(/NAME_PREFIX/);
  });
  it("sortByRelevance 보존", () => {
    const src = read(RANKING);
    expect(src).toMatch(/sortByRelevance|scoreProduct/);
  });
});
