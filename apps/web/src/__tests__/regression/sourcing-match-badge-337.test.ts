/**
 * §11.337 (회귀) — 소싱 검색 매칭 정밀도(Part A) + 반복 배지 억제(Part B)
 *
 * Part A: 짧은 쿼리(≤2자)는 품명/Cat.No prefix(시작/단어경계)만 매칭 → "P"에 PCR/Capricorn noise 제거.
 *   긴 쿼리(≥3자)는 전 필드 부분일치 보존(§11.335 Cat.No 검색 유지).
 * Part B: 데이터(납기/가격/재고) 없을 때 "납기 확인 필요"/"견적 필요"/"요청 전환 권장"
 *   전 항목 동일 배지 억제 — 실제 신호 있을 때만 push(CTA 버튼과 중복 제거).
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

describe("§11.337 Part A — 매칭 정밀도(prefix 우선)", () => {
  it("짧은 쿼리 ≤2자 분기 + 시작/단어경계 일치", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/queryToken\.length <= 2/);
    expect(src).toMatch(/text\.startsWith\(queryToken\)/);
    expect(src).toMatch(/\.some\(\(w\) => w\.startsWith\(queryToken\)\)/);
  });
  it("긴 쿼리는 전 필드 부분일치 보존(§11.335)", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/haystack\.includes\(queryToken\)/);
    expect(src).toMatch(/product\.catalogNumber/);
  });
});

describe("§11.337 Part B — 데이터 없을 때 배지 억제", () => {
  it("납기 null 시 '납기 확인 필요' 무조건 push 안 함(if (lt) 가드)", () => {
    const src = read(ROW);
    expect(src).toMatch(/\/\/ ── 1순위: 납기 — 실제 값 있을 때만/);
    expect(src).toMatch(/if \(lt\) \{/);
  });
  it("가격 0/null 시 '견적 필요' push 제거", () => {
    const src = read(ROW);
    expect(src).not.toMatch(/signals\.push\(\{ label: "견적 필요"/);
  });
  it("가격 0/null 시 '요청 전환 권장' push 제거", () => {
    const src = read(ROW);
    expect(src).not.toMatch(/signals\.push\(\{ label: "요청 전환 권장"/);
  });
  it("가격 있을 때만 비교 권장/적합(행동 방향)", () => {
    const src = read(ROW);
    expect(src).toMatch(/if \(unitPrice && unitPrice > 0\) \{/);
  });
});

describe("§11.337 회귀 0 — 실제 신호 배지 보존", () => {
  it("즉시 출고/리드타임/재고 확보 배지 보존", () => {
    const src = read(ROW);
    expect(src).toMatch(/즉시 출고/);
    expect(src).toMatch(/영업일/);
    expect(src).toMatch(/재고 확보/);
  });
  it("Cat.No 카드 표시(buildStaticMeta) 보존", () => {
    const src = read(ROW);
    expect(src).toMatch(/Cat\. \$\{product\.catalogNumber\}/);
  });
});
