/**
 * §quotes-quick-filter-4a — P3 정렬바 + 적용요약 회귀 sentinel
 *
 * 보호: 정렬 3종(우선순위순 기본=key null · 마감임박순=dday · 금액 높은순=amount) ·
 *       적용요약 토큰(개별 × 해제) · 총 N건 중 M건 · canonical lib 정렬 배선 ·
 *       우선순위 기본순(prioMap override) 불변(호영님 P3 결정).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"), "utf8");

describe("§quotes-quick-filter-4a P3 — 정렬 바", () => {
  it("정렬 radiogroup + 3종 라벨", () => {
    expect(PAGE).toMatch(/role="radiogroup" aria-label="정렬"/);
    expect(PAGE).toMatch(/"우선순위순"/);
    expect(PAGE).toMatch(/"마감임박순"/);
    expect(PAGE).toMatch(/"금액 높은순"/);
  });
  it("우선순위순 기본 = sortState.key null(호영님 P3 결정)", () => {
    // 3옵션 배열의 첫 항목 key = null
    expect(PAGE).toMatch(/\[\[null, "우선순위순", "desc"\]/);
    expect(PAGE).toMatch(/\["dday", "마감임박순", "asc"\]/);
    expect(PAGE).toMatch(/\["amount", "금액 높은순", "desc"\]/);
  });
  it("정렬바 → sortState 배선(aria-checked)", () => {
    expect(PAGE).toMatch(/aria-checked=\{on\}/);
    expect(PAGE).toMatch(/onClick=\{\(\) => setSortState\(\{ key, direction: dir \}\)\}/);
  });
  it("dday/amount = canonical lib 정렬(sortQuotesLib), 기본순·컬럼정렬 불변", () => {
    expect(PAGE).toMatch(/sortState\.key === "dday" \|\| sortState\.key === "amount"/);
    expect(PAGE).toMatch(/sortQuotesLib\(filteredQuotes as unknown as QuickFilterQuote\[\], sortState\.key/);
    // 우선순위 기본순(prioMap override) 보존 — priority-override-p3 canonical
    expect(PAGE).toMatch(/const lvl = prioMap\[q\.id\] \?\? base/);
    expect(PAGE).toMatch(/\}, \[filteredQuotes, sortState, prioMap\]\)/);
  });
});

describe("§quotes-quick-filter-4a P3 — 적용 요약 토큰", () => {
  it("적용 중 · N건 표시 + 총 N건 중 M건", () => {
    expect(PAGE).toMatch(/적용 중 · \{sortedQuotes\.length\}건 표시/);
    expect(PAGE).toMatch(/총 \{quotes\.length\}건 중 \{sortedQuotes\.length\}건/);
  });
  it("토큰 개별 해제(× wiring)", () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => setQuickMine\(false\)\}/);
    expect(PAGE).toMatch(/onClick=\{\(\) => setQuickPeriod\("all"\)\}/);
    expect(PAGE).toMatch(/onClick=\{\(\) => toggleQuickStatus\(k\)\}/);
  });
  it("요약은 quickActive 게이트(비활성 시 미노출)", () => {
    expect(PAGE).toMatch(/\{quickActive && \(/);
  });
});
