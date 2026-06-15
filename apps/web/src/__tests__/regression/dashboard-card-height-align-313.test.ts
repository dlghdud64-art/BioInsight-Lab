/**
 * §11.313 #dashboard-card-height-align — Regression sentinel
 *
 * 호영님 P2 spec (지시문 §11.307 명명 → task #65 충돌로 §11.313 부여, 2026-05-27):
 *   "지출 트렌드 분석"(좌, 큼) + "카테고리별 비중"(우, 짧음) 카드 높이 불일치
 *   → 하단 빈 공간. items-stretch + h-full + flex-1 로 정합.
 *
 * canonical truth 보존:
 *   - SpendTrendCard / CategoryDistributionCard import / props / dynamic_import
 *   - §11.252b 모바일 탭 전환 (trend / category) 보존
 *   - 데스크탑 lg:grid-cols-3 + col-span-2/1 layout 보존
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

describe("§11.313 — dashboard/page.tsx grid 높이 정합", () => {
  it("desktop grid items-stretch 추가", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/hidden lg:grid lg:grid-cols-3 gap-4 items-stretch/);
  });

  it("CategoryDistributionCard className='h-full' 전달", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/<CategoryDistributionCard\s+categorySpending=\{stats\.categorySpending\}\s+className="h-full"\s*\/>/);
  });

  it("SpendTrendCard / col-span layout 보존 (회귀 0)", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/lg:col-span-2/);
    expect(src).toMatch(/lg:col-span-1/);
    expect(src).toMatch(/<SpendTrendCard monthlySpending=\{stats\.monthlySpendingChart\}\s*\/>/);
  });
});

describe("§11.313 — category-distribution-card 높이/세로 정합", () => {
  it("className prop 추가", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/className\?:\s*string/);
    expect(src).toMatch(/CategoryDistributionCard\(\{\s*categorySpending,\s*className\s*\}/);
  });

  it("root div flex flex-col + className 병합 (h-full 수용)", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/flex flex-col \$\{className \?\? ""\}/);
  });

  it("non-empty 차트 영역 flex-1 (세로 균등)", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/grid grid-cols-1 md:grid-cols-2 gap-3 items-center flex-1/);
  });

  it("empty 차트 영역 flex-1 (세로 균등) — §dashboard-shifan-adopt P3b 정직 empty(mockup grid/opacity 제거)", () => {
    const src = read(CARD_PATH);
    // P3b 정직성 코어: 빈 도넛 mockup(opacity-90 grid grayscale overlay) 제거 → 정직 empty 박스.
    //   height 정합(flex-1 세로 균등)은 보존(카드 높이 정합 §11.313 유지).
    expect(src).toMatch(/flex-1/); // empty 박스 세로 균등(height 정합)
    expect(src).toMatch(/발주가 시작되면|분포가 표시/); // 정직 empty 안내(mockup 분포 0)
    expect(src).not.toMatch(/opacity-90 flex-1/); // mockup overlay 잔존 0(정직성)
  });
});

describe("§11.313 — 회귀 0 (차트 wiring + 모바일 탭 보존)", () => {
  it("카테고리별 비중 제목 + 도넛 차트 보존", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/카테고리별 비중/);
    expect(src).toMatch(/<PieChart>/);
    expect(src).toMatch(/innerRadius=\{42\}/);
  });

  it("§11.252b 모바일 탭 전환 (trend / category) 보존", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/activeChartTab === "trend"/);
    expect(src).toMatch(/<CategoryDistributionCard categorySpending=\{stats\.categorySpending\} \/>/);
  });

  it("dynamic_import code split 보존", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/const CategoryDistributionCard = dynamic_import/);
    expect(src).toMatch(/const SpendTrendCard = dynamic_import/);
  });

  it("empty state mockup overlay 보존 (§11.243b)", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/발주가 시작되면 카테고리 분포가 표시됩니다/);
  });
});
