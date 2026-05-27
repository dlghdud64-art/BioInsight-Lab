/**
 * §11.302d-6a-4-γ #dashboard-page-amber-removed — Regression sentinel
 *
 * 호영님 P1 sweep batch 4/4 (3/3) — dashboard/page.tsx. §11.302d-6a
 * (critical surfaces) 종결 batch.
 *
 * 패턴: executive-summary 정합 — severity literal "amber" (risk 시스템
 *   key) 보존, Tailwind class value 만 yellow swap.
 *
 * Swap:
 *   - Tailwind amber class (~20) → yellow
 *   - orange (2: noMovement / handoffStall 정체 경고) → yellow
 *
 * 보존 (key literal):
 *   - inventoryRisk/stockRisk/spendingRisk/quoteRisk = "amber" severity
 *   - urgentItems severity "amber" | "red"
 *   - color map key amber
 *   - risk === "amber" 분기
 *   - red severity 분기 (위험)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/app/dashboard/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.302d-6a-4-γ — amber/orange Tailwind class 0 (전체 file)", () => {
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

  it("orange Tailwind class 0 (noMovement / handoffStall)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/(bg|text|border|border-l)-orange-\d/);
  });
});

describe("§11.302d-6a-4-γ — yellow swap 정합", () => {
  it("risk === 'amber' → border-l-yellow-500", () => {
    const src = read(PATH);
    expect(src).toMatch(/risk === "amber"\s*\)\s*return\s*"border-l-2 border-l-yellow-500"/);
  });

  it("color map amber entry value yellow (border/bg/icon/link)", () => {
    const src = read(PATH);
    expect(src).toMatch(/amber:\s*\{\s*border:\s*"border-yellow-200",\s*bg:\s*"bg-yellow-50\/60",\s*icon:\s*"text-yellow-500",\s*link:\s*"text-yellow-600 hover:text-yellow-700"/);
  });

  it("납기 지연 chip yellow (bg-yellow-50 text-yellow-700)", () => {
    const src = read(PATH);
    expect(src).toMatch(/bg-yellow-50 text-yellow-700 text-\[10px\] font-medium/);
  });

  it("noMovement 정체 경고 yellow (text-yellow-600)", () => {
    const src = read(PATH);
    expect(src).toMatch(/다음 단계 없음/);
    // orange → yellow swap 후 text-yellow-600
    expect(src).toMatch(/text-\[10px\] text-yellow-600 font-medium/);
  });
});

describe("§11.302d-6a-4-γ — severity literal 'amber' 보존 (risk 시스템 key)", () => {
  it("inventoryRisk / stockRisk / spendingRisk / quoteRisk = 'amber' 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/inventoryRisk\s*=\s*stats\.lowStockAlerts > 0 \? "amber"/);
    expect(src).toMatch(/spendingRisk\s*=\s*stats\.monthOverMonthChange > 10 \? "amber"/);
    expect(src).toMatch(/quoteRisk\s*=\s*stats\.respondedQuotes > 0 \? "amber"/);
  });

  it("urgentItems severity 'red' | 'amber' type 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/severity:\s*"red"\s*\|\s*"amber"/);
  });

  it("color map type 'red' | 'amber' | 'blue' | 'emerald' 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/color:\s*"red"\s*\|\s*"amber"\s*\|\s*"blue"\s*\|\s*"emerald"/);
  });

  it("stockRisk red 분기 보존 (lowStockAlerts >= 3 → red)", () => {
    const src = read(PATH);
    expect(src).toMatch(/stats\.lowStockAlerts >= 3 \? "red"/);
  });
});

describe("§11.302d-6a-4-γ — 회귀 0 (red severity + risk wiring 보존)", () => {
  it("urgentItems severity red → border-l-red-500 분기 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/item\.severity === "red" \? "border-l-2 border-l-red-500"/);
  });

  it("slaBreached red 분기 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/slaBreachedCount > 0 \? "red"/);
  });

  it("recommendedActions 비교 판정 / 견적 검토 wiring 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/id:\s*"r-compare"/);
    expect(src).toMatch(/id:\s*"r-quote"/);
  });

  it("handleNavigateOrOverlay wiring 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/handleNavigateOrOverlay/);
  });
});
