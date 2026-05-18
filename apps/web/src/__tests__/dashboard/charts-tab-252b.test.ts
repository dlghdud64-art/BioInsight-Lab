/**
 * §11.252b — 모바일 차트 영역 탭 전환 (SpendTrend + CategoryDistribution).
 *
 * 호영님 spec:
 *   - 두 카드 (지출 트렌드 + 카테고리 비중) 모바일에서 풀 높이 → 1.5 화면 차지.
 *   - 탭 전환 (트렌드 | 카테고리) 으로 한 영역에 합치거나 기본 접힘 + "펼쳐 보기".
 *
 * 본 구현: 모바일 (<lg) 탭 전환 + 데스크탑 (≥lg) grid 보존 (회귀 0).
 *
 * canonical truth lock:
 *   - SpendTrendCard / CategoryDistributionCard import + props 보존.
 *   - lg:col-span-2 / lg:col-span-1 데스크탑 layout 보존.
 *   - monthlySpendingChart / categorySpending data 흐름 변경 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const code = safeRead(PAGE_PATH);

describe("§11.252b #1 — 차트 탭 전환 (모바일)", () => {
  it("탭 state (useState 또는 inline state) 추가", () => {
    // 모바일 탭 전환 — 트렌드 / 카테고리 선택 state.
    expect(code).toMatch(/§11\.252b/);
    expect(code).toMatch(/(activeChartTab|chartTab|selectedChart)/);
  });

  it("'트렌드' 또는 '지출' 탭 라벨", () => {
    expect(code).toMatch(/(트렌드|지출\s*트렌드)/);
  });

  it("'카테고리' 탭 라벨", () => {
    expect(code).toMatch(/(카테고리\s*비중|카테고리\s*분포|카테고리\s*탭|>카테고리<)/);
  });

  it("모바일 탭 컨테이너 lg:hidden 또는 분기 명시", () => {
    // 모바일 only 탭 UI, lg+ 에서는 grid 보존.
    expect(code).toMatch(/§11\.252b[\s\S]{0,4000}lg:hidden/);
  });
});

describe("§11.252b #2 — 데스크탑 grid 보존 (회귀 0)", () => {
  it("lg:grid-cols-3 grid 또는 lg:col-span-2 보존 (데스크탑 layout)", () => {
    expect(code).toMatch(/lg:(grid-cols-3|col-span-2)/);
  });

  it("SpendTrendCard import + render 보존", () => {
    expect(code).toMatch(/SpendTrendCard/);
    expect(code).toMatch(/monthlySpendingChart/);
  });

  it("CategoryDistributionCard import + render 보존", () => {
    expect(code).toMatch(/CategoryDistributionCard/);
    expect(code).toMatch(/categorySpending/);
  });
});

describe("§11.252b — invariant 보존", () => {
  it("dynamic import (recharts code split) 보존", () => {
    expect(code).toMatch(/dynamic_import[\s\S]{0,500}SpendTrendCard/);
  });

  it("stats data flow 보존 (monthlySpendingChart + categorySpending)", () => {
    expect(code).toMatch(/stats\.monthlySpendingChart/);
    expect(code).toMatch(/stats\.categorySpending/);
  });
});
