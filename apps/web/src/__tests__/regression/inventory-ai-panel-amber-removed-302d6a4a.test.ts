/**
 * §11.302d-6a-4-α #inventory-ai-panel-amber-removed — Regression sentinel
 *
 * 호영님 P1 sweep batch 4/4 (1/2) — inventory-ai-assistant-panel.tsx 16 위치.
 * §11.310 시리즈가 직접 건드린 file → 신중 swap.
 *
 * Swap 규칙:
 *   - amber 모두 "warning/주의" 의미 → yellow (긴급/주의 유지)
 *   - shortage/error 분기 = red (보존, 변경 0)
 *   - emerald (정상) 분기 보존
 *
 * canonical truth 보존:
 *   - §11.310 [견적 요청] / [바로 발주] 분기 wiring 변경 0
 *   - isShortage / errors / warnings 분기 로직 변경 0
 *   - ratioColor red/emerald 분기 보존 (amber 만 yellow)
 *   - IssueWarningsSection severity (error=red / warning=yellow / info=slate) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const PATH = "src/components/ai/inventory-ai-assistant-panel.tsx";

describe("§11.302d-6a-4-α — amber/orange Tailwind class 0 (전체 file)", () => {
  it("bg-amber-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/bg-amber-\d/);
  });

  it("text-amber-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/text-amber-\d/);
  });

  it("border-amber-* / border-l-amber-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/border-amber-\d/);
    expect(src).not.toMatch(/border-l-amber-\d/);
  });

  it("orange Tailwind class 0 (defensive)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/(bg|text|border|border-l)-orange-\d/);
  });
});

describe("§11.302d-6a-4-α — warning yellow swap 정합", () => {
  it("ratioColor 중간 구간 yellow (stockRatio <= 0.7 → text-yellow-600 bg-yellow-50)", () => {
    const src = read(PATH);
    expect(src).toMatch(/text-yellow-600["'],\s*bg:\s*["']bg-yellow-50/);
  });

  it("조치 필요 stat yellow (actionNeededCount > 0 → text-yellow-600 / bg-yellow-50)", () => {
    const src = read(PATH);
    expect(src).toMatch(/text-yellow-600/);
    expect(src).toMatch(/bg-yellow-50/);
  });

  it("IssueWarningsSection isShortage false 시 bg-yellow-50/40", () => {
    const src = read(PATH);
    expect(src).toMatch(/isShortage\s*\?\s*"bg-red-50\/50"\s*:\s*"bg-yellow-50\/40"/);
  });

  it("warning severity badge yellow (border-yellow-200 bg-yellow-50)", () => {
    const src = read(PATH);
    expect(src).toMatch(/border-yellow-200 bg-yellow-50\/80/);
    expect(src).toMatch(/text-yellow-600 border-yellow-200 bg-yellow-50/);
  });

  it("유효기간 임박 Lot yellow (text-yellow-600)", () => {
    const src = read(PATH);
    expect(src).toMatch(/text-\[11px\] text-yellow-600/);
  });
});

describe("§11.302d-6a-4-α — 회귀 0 (red/emerald 분기 + §11.310 wiring 보존)", () => {
  it("ratioColor 위험 구간 red 보존 (stockRatio <= 0.3 → text-red-600 bg-red-50)", () => {
    const src = read(PATH);
    expect(src).toMatch(/stockStatus\.stockRatio\s*<=\s*0\.3[\s\S]{0,80}text-red-600["'],\s*bg:\s*["']bg-red-50/);
  });

  it("ratioColor 정상 구간 emerald 보존 (text-emerald-600 bg-emerald-50)", () => {
    const src = read(PATH);
    expect(src).toMatch(/text-emerald-600["'],\s*bg:\s*["']bg-emerald-50/);
  });

  it("IssueWarningsSection error severity red 보존 (border-red-200 bg-red-50/80)", () => {
    const src = read(PATH);
    expect(src).toMatch(/border-red-200 bg-red-50\/80/);
  });

  it("error severity icon text-red-500 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/isError\s*\?\s*"text-red-500"/);
  });

  it("§11.310 [견적 요청] / [바로 발주] 분기 보존 (amber→green 주석)", () => {
    const src = read(PATH);
    expect(src).toMatch(/견적 요청|바로 발주|amber→green/);
  });

  it("예상 소진 7일 이하 red 보존 (estimatedDepletionDays <= 7)", () => {
    const src = read(PATH);
    expect(src).toMatch(/estimatedDepletionDays\s*<=\s*7/);
    expect(src).toMatch(/"text-red-600"/);
  });
});
