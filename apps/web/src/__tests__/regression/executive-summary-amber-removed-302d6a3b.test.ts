/**
 * §11.302d-6a-3-β #executive-summary-amber-removed — Regression sentinel
 *
 * 호영님 P1 sweep batch 3/4 (2/2) — executive-summary-section.tsx
 * 4-tone palette system (blue/emerald/amber/rose).
 *
 * 패턴: badge.tsx 정합 — tone key "amber" 보존 (caller toneOverride / risk
 *   매핑 / 분기 로직 영향 0), 값만 yellow swap.
 *
 * Swap 위치 (10 곳):
 *   - iconContainerMap.amber (line 279): bg-amber-50 text-amber-600 → yellow
 *   - hoverBorderMap.amber (line 286): hover:border-amber-200 → yellow
 *   - progressBarMap.amber (line 293): bg-amber-500 → yellow
 *   - valueColorMap.amber (line 300): text-amber-700 → yellow
 *   - dynamic shadow (line 325): shadow-${tone === "amber" ? "amber"} → "yellow"
 *   - delta chip (line 342): bg-amber-50/80 text-amber-700 border-amber-200/60 → yellow
 *   - dot ping (line 351): bg-amber-500 → yellow
 *   - gradientMap.amber (line 839): from-amber-700 to-amber-900 → yellow
 *   - dotMap.amber (line 846): bg-amber-400 → yellow
 *
 * canonical truth 보존:
 *   - toneOverride type "amber" 보존 (caller wiring 0)
 *   - tone === "amber" 분기 로직 보존 (6 위치)
 *   - 라벨 ("주의") + width (78%) + 주석 amber literal 보존
 *   - risk → tone 매핑 (warning → amber) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const PATH = "src/components/dashboard/executive-summary-section.tsx";

describe("§11.302d-6a-3-β — amber Tailwind class 0 (전체 file)", () => {
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

  it("hover:border-amber-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/hover:border-amber-\d/);
  });

  it("shadow-amber-* / from-amber-* / to-amber-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/shadow-amber-\d/);
    expect(src).not.toMatch(/from-amber-\d/);
    expect(src).not.toMatch(/to-amber-\d/);
  });
});

describe("§11.302d-6a-3-β — tone key 'amber' 보존 (caller wiring 영향 0)", () => {
  it("toneOverride type union 에 amber literal 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/toneOverride\?:\s*"blue"\s*\|\s*"emerald"\s*\|\s*"amber"\s*\|\s*"rose"/);
  });

  it("risk → tone 매핑: warning ? 'amber' 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/risk === "warning" \? "amber"/);
  });

  it("tone === 'amber' 분기 로직 보존 (다중 위치)", () => {
    const src = read(PATH);
    const matches = src.match(/tone === "amber"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(5);
  });

  it("라벨 '주의' 분기 보존 (tone === amber)", () => {
    const src = read(PATH);
    expect(src).toMatch(/tone === "amber" \? "주의"/);
  });

  it("progress bar width 78% 분기 보존 (tone === amber)", () => {
    const src = read(PATH);
    expect(src).toMatch(/tone === "amber" \? "78%"/);
  });
});

describe("§11.302d-6a-3-β — 4 map yellow swap", () => {
  it("iconContainerMap.amber yellow tone (bg-yellow-50 text-yellow-600)", () => {
    const src = read(PATH);
    expect(src).toMatch(/iconContainerMap[\s\S]{0,300}amber:\s*"bg-yellow-50 text-yellow-600"/);
  });

  it("hoverBorderMap.amber yellow tone (hover:border-yellow-200)", () => {
    const src = read(PATH);
    expect(src).toMatch(/hoverBorderMap[\s\S]{0,300}amber:\s*"hover:border-yellow-200"/);
  });

  it("progressBarMap.amber yellow tone (bg-yellow-500)", () => {
    const src = read(PATH);
    expect(src).toMatch(/progressBarMap[\s\S]{0,300}amber:\s*"bg-yellow-500"/);
  });

  it("valueColorMap.amber yellow tone (text-yellow-700)", () => {
    const src = read(PATH);
    expect(src).toMatch(/valueColorMap[\s\S]{0,300}amber:\s*"text-yellow-700"/);
  });
});

describe("§11.302d-6a-3-β — dynamic shadow + delta chip + dot ping swap", () => {
  it("dynamic shadow class: tone === 'amber' → 'yellow' literal", () => {
    const src = read(PATH);
    expect(src).toMatch(/tone === "amber" \? "yellow"/);
  });

  it("delta chip glassmorphism yellow tone (bg-yellow-50/80 text-yellow-700 border-yellow-200/60)", () => {
    const src = read(PATH);
    expect(src).toMatch(/bg-yellow-50\/80 text-yellow-700 border-yellow-200\/60 backdrop-blur-sm/);
  });

  it("dot ping yellow (tone === amber ? bg-yellow-500)", () => {
    const src = read(PATH);
    expect(src).toMatch(/tone === "amber" \? "bg-yellow-500"/);
  });
});

describe("§11.302d-6a-3-β — gradient + dotMap yellow swap", () => {
  it("gradientMap.amber yellow (from-yellow-700 to-yellow-900)", () => {
    const src = read(PATH);
    expect(src).toMatch(/gradientMap[\s\S]{0,300}amber:\s*"from-yellow-700 to-yellow-900"/);
  });

  it("dotMap.amber yellow (bg-yellow-400)", () => {
    const src = read(PATH);
    expect(src).toMatch(/dotMap[\s\S]{0,300}amber:\s*"bg-yellow-400"/);
  });
});

describe("§11.302d-6a-3-β — 회귀 0 (다른 tone + 핵심 logic 보존)", () => {
  it("iconContainerMap 4 entry 보존 (blue/emerald/amber/rose)", () => {
    const src = read(PATH);
    expect(src).toMatch(/iconContainerMap\s*=\s*\{[\s\S]{0,400}blue:\s*"bg-blue-50/);
    expect(src).toMatch(/iconContainerMap\s*=\s*\{[\s\S]{0,400}emerald:\s*"bg-emerald-50/);
    expect(src).toMatch(/iconContainerMap\s*=\s*\{[\s\S]{0,400}amber:/);
    expect(src).toMatch(/iconContainerMap\s*=\s*\{[\s\S]{0,400}rose:\s*"bg-rose-50/);
  });

  it("rose tone 변경 0 (critical = rose 의미 보존)", () => {
    const src = read(PATH);
    expect(src).toMatch(/risk === "critical" \? "rose"/);
    expect(src).toMatch(/iconContainerMap[\s\S]{0,300}rose:\s*"bg-rose-50 text-rose-600"/);
  });

  it("emerald tone 변경 0 (normal/safe 의미 보존)", () => {
    const src = read(PATH);
    expect(src).toMatch(/iconContainerMap[\s\S]{0,300}emerald:\s*"bg-emerald-50 text-emerald-600"/);
  });

  it("blue tone 변경 0 (지출 의미 보존)", () => {
    const src = read(PATH);
    expect(src).toMatch(/iconContainerMap[\s\S]{0,300}blue:\s*"bg-blue-50 text-blue-600"/);
  });

  it("KpiCard breakdown expand state 보존 (§11.139)", () => {
    const src = read(PATH);
    expect(src).toMatch(/breakdownExpanded.*useState/);
  });

  it("gradientMap 4 entry 보존 (emerald/amber/rose/indigo)", () => {
    const src = read(PATH);
    expect(src).toMatch(/gradientMap\s*=\s*\{[\s\S]{0,400}emerald:\s*"from-emerald-700/);
    expect(src).toMatch(/gradientMap\s*=\s*\{[\s\S]{0,400}rose:\s*"from-rose-700/);
    expect(src).toMatch(/gradientMap\s*=\s*\{[\s\S]{0,400}indigo:\s*"from-indigo-700/);
  });
});
