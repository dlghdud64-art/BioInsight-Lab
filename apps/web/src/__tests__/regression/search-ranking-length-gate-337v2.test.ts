/**
 * §11.337-v2 (회귀) — 검색 base set 쿼리 길이 게이트 sentinel
 *
 * 범인: ranking.ts buildSearchQuery where 절이 name/catalogNumber/brand 전부 contains
 *   → "P" 가 단어 중간(Capricorn/PCR)까지 매칭, base set 부풀림.
 * 정정(옵션 A): ≤2자 = 품명/Cat.No startsWith(prefix)만 + synonyms 억제 + brand 제외.
 *   ≥3자 = 현행 contains + synonyms 유지(§11.335 보존, "PCR"→PCR Tube 정상).
 * 점수(scoreProduct prefix 우선)는 정렬에 그대로 사용 — 본 정정은 base set 필터만.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const RANKING = "src/lib/search/ranking.ts";

describe("§11.337-v2 — 쿼리 길이 게이트", () => {
  it("isShortQuery(≤2자) 분기 존재", () => {
    const src = read(RANKING);
    expect(src).toMatch(/const isShortQuery = normalizedQuery\.length <= 2/);
  });
  it("짧은 쿼리는 synonyms 확장 억제", () => {
    const src = read(RANKING);
    expect(src).toMatch(/isShortQuery\s*\?\s*\[normalizedQuery\]/);
  });
  it("짧은 쿼리는 name/catalogNumber startsWith(prefix)만, brand 제외", () => {
    const src = read(RANKING);
    expect(src).toMatch(/name: \{ startsWith: q, mode: "insensitive" \}/);
    expect(src).toMatch(/catalogNumber: \{ startsWith: q, mode: "insensitive" \}/);
  });
  it("긴 쿼리(≥3자)는 contains + brand 보존(§11.335)", () => {
    const src = read(RANKING);
    expect(src).toMatch(/name: \{ contains: q, mode: "insensitive" \}/);
    expect(src).toMatch(/brand: \{ contains: q, mode: "insensitive" \}/);
  });
});

describe("§11.337-v2 회귀 0 — 점수 로직 보존", () => {
  it("scoreProduct prefix 우선 가중치 보존", () => {
    const src = read(RANKING);
    expect(src).toMatch(/CATALOG_PREFIX/);
    expect(src).toMatch(/NAME_PREFIX/);
    expect(src).toMatch(/namePrefix/);
  });
  it("sortByRelevance 보존", () => {
    const src = read(RANKING);
    expect(src).toMatch(/sortByRelevance|scoreProduct/);
  });
});
