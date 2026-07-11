/**
 * §quote-flat KPI-dedup (호영님 2026-06-21) — KPI Control Cards 제거 + 퍼널 단일 surface
 *
 * 퍼널(§quote-management P2)과 중복인 KPI Control Cards(데스크탑 5-cell §11.272c +
 * 모바일 요약 바 §11.272c-2 + StatusCountGrid)를 제거. 단계 카운트/필터는 퍼널 + 상태 Select가 담당.
 * dead-code(summaryStats / isLoadingTimeout / StatusCountGrid) 동반 제거.
 *
 * §quotes-quick-filter-4a P2 — 구 상태 Select '오늘 마감'(DEADLINE_TODAY 옵션)·MODE_CHIPS 단일선택
 *   빠른필터가 QUICK_CHIP_META 5칩 다중선택(deadline/stalled/priority/send/reply)으로 대체됨.
 *   마감 진입점 단언을 신 'deadline' chip(label "마감 임박")으로 재앵커, DEADLINE_TODAY 술어 잔존만 유지.
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
  it("마감임박 진입점 보존(dead 필터 0) — §quotes-quick-filter-4a P2: 상태 Select '오늘 마감' 옵션 → 빠른필터 'deadline' chip('마감 임박')으로 이전", () => {
    // §quotes-quick-filter-4a P2 — 구 '오늘 마감'(value="DEADLINE_TODAY" Select 옵션)·MODE_CHIPS 단일선택은
    //   QUICK_CHIP_META 5칩 다중선택(Set)으로 대체. 마감 진입점은 신 chip { key: "deadline", label: "마감 임박" }.
    //   DEADLINE_TODAY 술어는 URL ?status / 저장 필터 경유 도달 가능(orphan dead-code 아님) → 잔존 단언 유지.
    expect(PAGE).toMatch(/key:\s*"deadline"/); // 빠른필터 마감임박 진입점(QUICK_CHIP_META, Select 옵션 대체)
    expect(PAGE).toMatch(/label:\s*"마감 임박"/);
    expect(PAGE).toMatch(/statusFilter === "DEADLINE_TODAY"/); // 술어 잔존(reachable, dead 아님)
  });
  it("빠른필터 QUICK_CHIP_META(다중선택) 보존", () => {
    // §quotes-quick-filter-4a P2 supersession — 구 MODE_CHIPS 단일선택 → QUICK_CHIP_META 5칩 다중선택.
    expect(PAGE).toMatch(/QUICK_CHIP_META\.map/);
    expect(PAGE).toMatch(/toggleQuickStatus/);
  });
});
