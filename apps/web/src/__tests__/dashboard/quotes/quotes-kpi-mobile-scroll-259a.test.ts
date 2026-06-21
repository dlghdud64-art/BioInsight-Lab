/**
 * §11.259a [RETIRED — §quote-flat KPI-dedup, 호영님 2026-06-21]
 *
 * KPI Control Cards(데스크탑 5-cell + 모바일 요약 바)는 퍼널(§quote-management P2)과 단계
 * 카운트 중복이라 제거. 퍼널이 단계 카운트 canonical 단일 surface. 이 sentinel은 제거 유지를 보호.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const QUOTES = readFileSync(resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"), "utf8");
describe("§11.259a [RETIRED] — KPI surface 미부활 보호", () => {
  it("KPI 모바일 요약 바 testid 부재", () => {
    expect(QUOTES).not.toMatch(/data-testid="quote-kpi-mobile-summary-bar"/);
    expect(QUOTES).not.toMatch(/data-testid="quote-kpi-mobile-summary-fallback"/);
  });
  it("StatusCountGrid import 부재(의존 제거 유지)", () => {
    expect(QUOTES).not.toMatch(/import \{ StatusCountGrid \}/);
  });
  it("퍼널(QuoteFunnel) canonical 단계 surface 유지", () => {
    expect(QUOTES).toMatch(/<QuoteFunnel/);
  });
});
