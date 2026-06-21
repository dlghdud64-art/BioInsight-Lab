/**
 * §quote-flat KPI-dedup (호영님 2026-06-21) — KPI Control Cards 제거 + 퍼널 단일 surface
 *
 * 퍼널(§quote-management P2)과 중복인 KPI Control Cards(데스크탑 5-cell §11.272c +
 * 모바일 요약 바 §11.272c-2 + StatusCountGrid)를 제거. 단계 카운트/필터는 퍼널 + 상태 Select가 담당.
 * dead-code(summaryStats / isLoadingTimeout / StatusCountGrid) 동반 제거.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const PAGE = readFileSync(resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"), "utf8");
describe("§quote-flat KPI-dedup — 제거 확정", () => {
  it("KPI 모바일 요약 바/폴백 testid 제거", () => {
    expect(PAGE).not.toMatch(/data-testid="quote-kpi-mobile-summary-bar"/);
    expect(PAGE).not.toMatch(/data-testid="quote-kpi-mobile-summary-fallback"/);
  });
  it("StatusCountGrid import 제거(dead-code)", () => {
    expect(PAGE).not.toMatch(/import \{ StatusCountGrid \}/);
  });
  it("summaryStats useMemo 제거(dead-code)", () => {
    expect(PAGE).not.toMatch(/const summaryStats = useMemo/);
  });
  it("isLoadingTimeout state/effect 제거(dead-code)", () => {
    expect(PAGE).not.toMatch(/const \[isLoadingTimeout, setIsLoadingTimeout\]/);
    expect(PAGE).not.toMatch(/setTimeout\(\(\) => setIsLoadingTimeout\(true\), 5000\)/);
  });
});
describe("§quote-flat KPI-dedup — 회귀 0(필터 truth·퍼널 보존)", () => {
  it("퍼널 + onStageClick 단계 필터 보존", () => {
    expect(PAGE).toMatch(/<QuoteFunnel/);
    expect(PAGE).toMatch(/onStageClick=\{/);
  });
  it("상태 Select DEADLINE_TODAY(오늘 마감) 필터 잔존 — 마감임박 진입점 보존(dead 필터 0)", () => {
    expect(PAGE).toMatch(/value="DEADLINE_TODAY"/);
    expect(PAGE).toMatch(/statusFilter === "DEADLINE_TODAY"/);
  });
  it("MODE_CHIPS(빠른필터) 보존", () => {
    expect(PAGE).toMatch(/MODE_CHIPS/);
  });
});
