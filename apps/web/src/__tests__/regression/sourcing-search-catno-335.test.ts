/**
 * §11.335 (회귀) — 소싱 검색 Cat.No 지원 + placeholder 통일 sentinel
 *
 * audit 결과: 검색 인덱스(클라 필터 + 서버 autocomplete) + 카드 Cat.No 표시는
 *   이미 구현됨. 실제 gap = 모바일 검색 placeholder 에 "카탈로그 번호" 누락뿐.
 * 본 sentinel = Cat.No 지원 보존 + placeholder 통일 회귀 보호.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const SEARCH = "src/app/_workbench/search/page.tsx";
const ROW = "src/app/_workbench/_components/sourcing-result-row.tsx";
const AUTOCOMPLETE = "src/app/api/search/autocomplete/route.ts";

describe("§11.335 — Cat.No 검색 인덱스 보존", () => {
  it("클라 필터 haystack 에 catalogNumber 포함", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/product\.catalogNumber/);
  });
  it("서버 autocomplete 가 catalogNumber contains 검색", () => {
    const src = read(AUTOCOMPLETE);
    expect(src).toMatch(/catalogNumber: \{ contains: q/);
  });
});

describe("§11.335 — 제품 카드 Cat.No 표시(환각 방지)", () => {
  it("catalogNumber 있을 때만 'Cat. ' 렌더", () => {
    const src = read(ROW);
    expect(src).toMatch(/if \(product\.catalogNumber\) parts\.push\(`Cat\. \$\{product\.catalogNumber\}`\)/);
  });
});

describe("§11.335 — placeholder 통일(재고 검색과 일관)", () => {
  it("모바일/데스크탑 검색 placeholder 에 카탈로그 번호 포함", () => {
    const src = read(SEARCH);
    // 두 placeholder 모두 카탈로그 번호 명시
    const matches = src.match(/시약명·CAS·제조사·카탈로그 번호/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    // 카탈로그 누락된 옛 placeholder 회귀 금지
    expect(src).not.toMatch(/placeholder="시약명·CAS·제조사"/);
  });
});
