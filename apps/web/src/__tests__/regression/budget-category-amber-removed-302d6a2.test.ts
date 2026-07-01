/**
 * §11.302d-6a-2 #budget-category-amber-removed — Regression sentinel
 *
 * 호영님 P1 sweep batch 2/4 (~14 위치):
 *   - BudgetPredictionWidget.tsx (4 위치): 예산 경고 alert + 다른 예산 link
 *   - CategorySpendingWidget.tsx (~10 위치): warning STATUS_CONFIG + bar + chip
 *
 * 신호등 swap 규칙:
 *   - amber → yellow (긴급/주의 의미 유지)
 *   - orange (soft_limit) — 의미 분석 필요 (yellow / red 중간 강도) →
 *     본 batch 보존, §11.302d-6a-2-soft-limit 후속 별도 검토
 *
 * canonical truth 보존:
 *   - STATUS_CONFIG 5 entry 구조 (normal/warning/soft_limit/over_budget/no_budget)
 *   - BudgetPrediction selectedBudget.hasWarning 분기 보존
 *   - CategorySpending UsageBar status 분기 (over_budget red / warning yellow / 그 외 emerald)
 *   - MomBadge / StatusIcon 로직 변경 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const BUDGET_PATH = "src/components/dashboard/BudgetPredictionWidget.tsx";
const CATEGORY_PATH = "src/components/dashboard/CategorySpendingWidget.tsx";

describe("§11.302d-6a-2 — BudgetPredictionWidget.tsx amber swap", () => {
  it("amber Tailwind class 0 occurrence", () => {
    const src = read(BUDGET_PATH);
    expect(src).not.toMatch(/bg-amber-\d/);
    expect(src).not.toMatch(/text-amber-\d/);
    expect(src).not.toMatch(/border-amber-\d/);
  });

  it("orange Tailwind class 0 occurrence", () => {
    const src = read(BUDGET_PATH);
    expect(src).not.toMatch(/bg-orange-\d/);
    expect(src).not.toMatch(/text-orange-\d/);
    expect(src).not.toMatch(/border-orange-\d/);
  });

  it("예산 경고 alert yellow tone (bg-yellow-50 + border-yellow-200 + text-yellow-600)", () => {
    const src = read(BUDGET_PATH);
    expect(src).toMatch(/bg-yellow-50 border border-yellow-200/);
    expect(src).toMatch(/text-yellow-600 text-yellow-400/);
  });

  it("다른 예산 link yellow tone (text-yellow-600)", () => {
    const src = read(BUDGET_PATH);
    expect(src).toMatch(/text-yellow-600 text-yellow-400 hover:underline/);
  });

  it("hasWarning 분기 로직 보존", () => {
    const src = read(BUDGET_PATH);
    expect(src).toMatch(/selectedBudget\.hasWarning\s*&&/);
  });
});

describe("§11.302d-6a-2 — CategorySpendingWidget.tsx amber swap (warning)", () => {
  it("amber Tailwind class 0 occurrence", () => {
    const src = read(CATEGORY_PATH);
    expect(src).not.toMatch(/bg-amber-\d/);
    expect(src).not.toMatch(/text-amber-\d/);
    expect(src).not.toMatch(/border-amber-\d/);
  });

  it("STATUS_CONFIG.warning yellow tone (bg-yellow-50 + text-yellow-700 + dot/border yellow)", () => {
    const src = read(CATEGORY_PATH);
    expect(src).toMatch(/warning:\s*\{[\s\S]{0,200}bgColor:\s*"bg-yellow-50"/);
    expect(src).toMatch(/warning:\s*\{[\s\S]{0,200}textColor:\s*"text-yellow-700"/);
    expect(src).toMatch(/warning:\s*\{[\s\S]{0,200}dotColor:\s*"bg-yellow-500"/);
    expect(src).toMatch(/warning:\s*\{[\s\S]{0,200}borderColor:\s*"border-yellow-200"/);
  });

  it("UsageBar warning status = bg-yellow-500", () => {
    const src = read(CATEGORY_PATH);
    expect(src).toMatch(/status\s*===\s*"warning"\s*\?\s*[\s\S]{0,50}"bg-yellow-500"/);
  });

  it("미분류 chip yellow tone (bg-yellow-50 + text-yellow-700 + hover:bg-yellow-100)", () => {
    const src = read(CATEGORY_PATH);
    expect(src).toMatch(/text-yellow-700 bg-yellow-50 px-2 py-0\.5 rounded-full hover:bg-yellow-100/);
  });
});

describe("§11.302d-6a-2 — soft_limit orange→red 확정 (호영님 Q=A, 2026-05-27)", () => {
  // §11.302d-6a-2-soft-limit: soft_limit 을 §11.302 신호등 3색(red)으로 정합,
  //   over_budget 과는 라벨("소프트 리밋" vs "예산 초과 위험")로 구분. orange 폐기.
  it("soft_limit STATUS_CONFIG red 정합 (§11.302 신호등, orange 폐기)", () => {
    const src = read(CATEGORY_PATH);
    expect(src).toMatch(/soft_limit:\s*\{[\s\S]{0,200}bgColor:\s*"bg-red-50"/);
    expect(src).toMatch(/soft_limit:\s*\{[\s\S]{0,200}textColor:\s*"text-red-700"/);
    expect(src).toMatch(/soft_limit:\s*\{[\s\S]{0,200}dotColor:\s*"bg-red-500"/);
    expect(src).toMatch(/soft_limit:\s*\{[\s\S]{0,200}borderColor:\s*"border-red-200"/);
    // orange 재유입 방지 guard
    expect(src).not.toMatch(/soft_limit:\s*\{[\s\S]{0,200}orange/);
  });

  it("soft_limit 라벨 구분 — '소프트 리밋' (over_budget 과 색상 동일, 라벨로 구분)", () => {
    const src = read(CATEGORY_PATH);
    expect(src).toMatch(/soft_limit:\s*\{[\s\S]{0,80}label:\s*"소프트 리밋"/);
  });
});

describe("§11.302d-6a-2 — 회귀 0 (STATUS_CONFIG 5 entry + UsageBar logic 보존)", () => {
  it("STATUS_CONFIG 5 entry 보존 (normal/warning/soft_limit/over_budget/no_budget)", () => {
    const src = read(CATEGORY_PATH);
    expect(src).toMatch(/normal:\s*\{/);
    expect(src).toMatch(/warning:\s*\{/);
    expect(src).toMatch(/soft_limit:\s*\{/);
    expect(src).toMatch(/over_budget:\s*\{/);
    expect(src).toMatch(/no_budget:\s*\{/);
  });

  it("UsageBar over_budget red 보존 (위험 의미 유지)", () => {
    const src = read(CATEGORY_PATH);
    expect(src).toMatch(/status\s*===\s*"over_budget"\s*\|\|\s*status\s*===\s*"soft_limit"/);
    expect(src).toMatch(/\?\s*"bg-red-500"/);
  });

  it("normal STATUS_CONFIG emerald 보존", () => {
    const src = read(CATEGORY_PATH);
    expect(src).toMatch(/normal:\s*\{[\s\S]{0,200}bgColor:\s*"bg-emerald-50"/);
  });

  it("over_budget STATUS_CONFIG red 보존", () => {
    const src = read(CATEGORY_PATH);
    expect(src).toMatch(/over_budget:\s*\{[\s\S]{0,200}bgColor:\s*"bg-red-50"/);
  });

  it("MomBadge / StatusIcon 함수 보존", () => {
    const src = read(CATEGORY_PATH);
    expect(src).toMatch(/function MomBadge/);
    expect(src).toMatch(/function StatusIcon/);
  });
});
