/**
 * §11.302d-6a-2-soft-limit #category-soft-limit-red — Regression sentinel
 *
 * 호영님 Q = A (2026-05-27):
 *   CategorySpendingWidget soft_limit 의 orange → red 격상.
 *   soft_limit = 예산 소진 임박(곧 초과) = 위험 임박 → over_budget(red)과
 *   동일 red. §11.302 신호등 3색 정합. 라벨로 구분.
 *
 * 이로써 CategorySpendingWidget amber/orange = 0 (§11.302d-6a-2 잔여 종결).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/components/dashboard/CategorySpendingWidget.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.302d-6a-2-soft-limit — soft_limit orange → red 격상", () => {
  it("amber/orange Tailwind class 0 (전체 file 종결)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/(bg|text|border|border-l)-amber-\d/);
    expect(src).not.toMatch(/(bg|text|border|border-l)-orange-\d/);
  });

  it("soft_limit red tone (bg-red-50 / text-red-700 / dot-red-500 / border-red-200)", () => {
    const src = read(PATH);
    expect(src).toMatch(/soft_limit:\s*\{[\s\S]{0,250}bgColor:\s*"bg-red-50"/);
    expect(src).toMatch(/soft_limit:\s*\{[\s\S]{0,250}textColor:\s*"text-red-700"/);
    expect(src).toMatch(/soft_limit:\s*\{[\s\S]{0,250}dotColor:\s*"bg-red-500"/);
    expect(src).toMatch(/soft_limit:\s*\{[\s\S]{0,250}borderColor:\s*"border-red-200"/);
  });

  it("soft_limit 라벨 '소프트 리밋' 보존 (over_budget 과 라벨 구분)", () => {
    const src = read(PATH);
    expect(src).toMatch(/soft_limit:\s*\{[\s\S]{0,250}label:\s*"소프트 리밋"/);
  });
});

describe("§11.302d-6a-2-soft-limit — 회귀 0 (STATUS_CONFIG 5 entry + 다른 톤)", () => {
  it("STATUS_CONFIG 5 entry 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/normal:\s*\{/);
    expect(src).toMatch(/warning:\s*\{/);
    expect(src).toMatch(/soft_limit:\s*\{/);
    expect(src).toMatch(/over_budget:\s*\{/);
    expect(src).toMatch(/no_budget:\s*\{/);
  });

  it("warning yellow 보존 (§11.302d-6a-2)", () => {
    const src = read(PATH);
    expect(src).toMatch(/warning:\s*\{[\s\S]{0,200}bgColor:\s*"bg-yellow-50"/);
  });

  it("over_budget red 보존 ('예산 초과 위험')", () => {
    const src = read(PATH);
    expect(src).toMatch(/over_budget:\s*\{[\s\S]{0,250}bgColor:\s*"bg-red-50"/);
    expect(src).toMatch(/over_budget:\s*\{[\s\S]{0,250}label:\s*"예산 초과 위험"/);
  });

  it("normal emerald 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/normal:\s*\{[\s\S]{0,200}bgColor:\s*"bg-emerald-50"/);
  });

  it("UsageBar over_budget/soft_limit red 분기 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/status\s*===\s*"over_budget"\s*\|\|\s*status\s*===\s*"soft_limit"/);
  });
});
