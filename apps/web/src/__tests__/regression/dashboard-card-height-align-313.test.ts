/**
 * §11.313 #dashboard-card-height-align → §dashboard-shifan-polish A5/B1 진화
 *
 * 이전(§11.313): 하단 "지출 트렌드"(좌 큼) + "카테고리별 비중"(우 짧음) 높이 불일치 정합
 *   (items-stretch + h-full + flex-1).
 * 변경(A5/B1, 시안 "예산&지출 카드 내부 통합"): 카테고리 비중을 BudgetSpendCard 내부로 이관(bare 모드).
 *   → 하단 분리 카테고리 폐지, 하단은 SpendTrend 풀폭 단일. 좌우 높이 불일치 문제 자체 소멸.
 *
 * canonical truth 보존:
 *   - CategoryDistributionCard 도넛/legend/정직 empty/recharts/flex-1 세로 균등 보존(bare 모드 무관).
 *   - SpendTrendCard dynamic import + stats.monthlySpendingChart 흐름 보존.
 *   - 카테고리 recharts code split = budget-spend-card 내부 dynamic import 가 계승.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const PAGE_PATH = "src/app/dashboard/page.tsx";
const CARD_PATH = "src/components/dashboard/category-distribution-card.tsx";
const BUD_PATH = "src/components/dashboard/budget-spend-card.tsx";

describe("§11.313 → A5/B1 — 카테고리 카드 내부 통합(하단 분리 폐지)", () => {
  it("하단 lg:grid-cols-3 차트 그리드 폐지(높이 불일치 문제 소멸)", () => {
    const src = read(PAGE_PATH);
    expect(src).not.toMatch(/hidden lg:grid lg:grid-cols-3/);
  });

  it("카테고리는 BudgetSpendCard 내부(categorySpending 주입) — 시안 정합", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/<BudgetSpendCard[\s\S]{0,200}categorySpending=\{stats\.categorySpending\}/);
  });

  it("하단은 SpendTrend 풀폭 단일(monthlySpendingChart 흐름 보존)", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/<SpendTrendCard monthlySpending=\{stats\.monthlySpendingChart\}\s*\/>/);
  });
});

describe("§11.313 → A5/B1 — category-distribution-card bare 모드 + 높이 정합 보존", () => {
  it("className + bare prop", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/className\?:\s*string/);
    expect(src).toMatch(/bare\?:\s*boolean/);
    expect(src).toMatch(/CategoryDistributionCard\(\{\s*categorySpending,\s*className,\s*bare\s*\}/);
  });

  it("root div flex flex-col + className 병합 + bare 분기(chrome 조건부)", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/flex flex-col \$\{className \?\? ""\}/);
    expect(src).toMatch(/bare \?/);
  });

  it("non-empty 차트 영역 flex-1 (세로 균등)", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/grid grid-cols-1 md:grid-cols-2 gap-3 items-center flex-1/);
  });

  it("empty 차트 영역 flex-1 + 정직 empty(mockup overlay 0)", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/flex-1/);
    expect(src).toMatch(/발주가 시작되면|분포가 표시/);
    expect(src).not.toMatch(/opacity-90 flex-1/);
  });
});

describe("§11.313 → A5/B1 — 회귀 0 (도넛 + dynamic code split)", () => {
  it("카테고리별 비중 제목 + 도넛 차트 보존", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/카테고리별 비중/);
    expect(src).toMatch(/<PieChart>/);
    expect(src).toMatch(/innerRadius=\{42\}/);
  });

  it("SpendTrend dynamic import code split 보존(page)", () => {
    expect(read(PAGE_PATH)).toMatch(/const SpendTrendCard = dynamic_import/);
  });

  it("카테고리 dynamic import code split 보존(budget-spend-card 로 이관)", () => {
    expect(read(BUD_PATH)).toMatch(/const CategoryDistributionCard = dynamic_import/);
  });

  it("empty state 정직 안내 보존", () => {
    expect(read(CARD_PATH)).toMatch(/발주가 시작되면 카테고리 분포가 표시됩니다/);
  });
});
