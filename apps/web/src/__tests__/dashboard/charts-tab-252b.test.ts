/**
 * §11.252b → §dashboard-shifan-polish A5/B1 진화 — 모바일 차트 탭 폐지(카테고리 카드 내부 통합)
 *
 * 이전(§11.252b): 모바일 <lg 에서 지출트렌드/카테고리 탭 전환 + 데스크탑 lg:grid-cols-3.
 * 변경(A5/B1, 시안 "예산&지출 카드 내부 통합"): 카테고리 비중을 BudgetSpendCard 내부로 이관.
 *   → 하단 분리 도넛 + 모바일 차트 탭 폐지. 하단은 지출 트렌드 단일(풀폭, 모바일·데스크탑 동일).
 *
 * canonical truth lock(유지):
 *   - SpendTrendCard dynamic import(recharts code split) 보존.
 *   - stats.monthlySpendingChart → SpendTrend / stats.categorySpending → BudgetSpendCard 흐름 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const code = safeRead(PAGE_PATH);

describe("§11.252b → A5/B1 — 모바일 차트 탭 폐지(회귀 차단)", () => {
  it("모바일 차트 탭 state 제거 (activeChartTab/chartTab/selectedChart 0)", () => {
    expect(code).not.toMatch(/activeChartTab|chartTab|selectedChart/);
  });

  it("하단 분리 카테고리 도넛 그리드(lg:grid-cols-3) 폐지", () => {
    // 카테고리는 BudgetSpendCard 내부로 이관 — 하단 lg:grid-cols-3 차트 분리 인스턴스 0.
    expect(code).not.toMatch(/lg:grid-cols-3 gap-4 items-stretch/);
  });
});

describe("§11.252b → A5/B1 — 카테고리 카드 내부 통합", () => {
  it("BudgetSpendCard 에 categorySpending 주입(카드 내부 카테고리, 시안 정합)", () => {
    expect(code).toMatch(/<BudgetSpendCard[\s\S]{0,200}categorySpending=\{stats\.categorySpending\}/);
  });
});

describe("§11.252b — invariant 보존", () => {
  it("SpendTrend dynamic import (recharts code split) 보존", () => {
    expect(code).toMatch(/dynamic_import[\s\S]{0,500}SpendTrendCard/);
  });

  it("stats data flow 보존 (monthlySpendingChart + categorySpending)", () => {
    expect(code).toMatch(/stats\.monthlySpendingChart/);
    expect(code).toMatch(/stats\.categorySpending/);
  });
});
