/**
 * §11.302d-6a-4-β #order-quote-ai-panel-amber-removed — Regression sentinel
 *
 * 호영님 P1 sweep batch 4/4 (2/2) — order + quote ai-assistant-panel.
 * dark mode warning tone amber → yellow 일관 swap.
 *
 * Swap 규칙:
 *   - amber (ORDERED status / warning severity / fix link) → yellow
 *   - error / CANCELLED / red severity 보존 (변경 0)
 *   - 다른 status (CONFIRMED blue / SHIPPING purple / DELIVERED emerald) 보존
 *
 * canonical truth 보존:
 *   - statusColors 매핑 구조 (ORDERED/CONFIRMED/SHIPPING/DELIVERED/CANCELLED)
 *   - isError / isWarning 분기 로직
 *   - onFix 수정하기 버튼 wiring
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const ORDER_PATH = "src/components/ai/order-ai-assistant-panel.tsx";
const QUOTE_PATH = "src/components/ai/quote-ai-assistant-panel.tsx";

describe("§11.302d-6a-4-β — order-ai-assistant-panel amber/orange 0", () => {
  it("amber Tailwind class 0", () => {
    const src = read(ORDER_PATH);
    expect(src).not.toMatch(/bg-amber-\d/);
    expect(src).not.toMatch(/text-amber-\d/);
    expect(src).not.toMatch(/border-amber-\d/);
  });

  it("orange Tailwind class 0", () => {
    const src = read(ORDER_PATH);
    expect(src).not.toMatch(/(bg|text|border)-orange-\d/);
  });

  it("ORDERED status yellow tone (text-yellow-400 bg-yellow-950/30)", () => {
    const src = read(ORDER_PATH);
    expect(src).toMatch(/ORDERED:\s*\{\s*text:\s*"text-yellow-400",\s*bg:\s*"bg-yellow-950\/30"/);
  });

  it("warning severity badge yellow (border-yellow-800/50 bg-yellow-950/20)", () => {
    const src = read(ORDER_PATH);
    expect(src).toMatch(/border-yellow-800\/50 bg-yellow-950\/20/);
  });
});

describe("§11.302d-6a-4-β — quote-ai-assistant-panel amber/orange 0", () => {
  it("amber Tailwind class 0", () => {
    const src = read(QUOTE_PATH);
    expect(src).not.toMatch(/bg-amber-\d/);
    expect(src).not.toMatch(/text-amber-\d/);
    expect(src).not.toMatch(/border-amber-\d/);
  });

  it("orange Tailwind class 0", () => {
    const src = read(QUOTE_PATH);
    expect(src).not.toMatch(/(bg|text|border)-orange-\d/);
  });

  it("fix 버튼 warning yellow (text-yellow-600 hover:text-yellow-700)", () => {
    const src = read(QUOTE_PATH);
    expect(src).toMatch(/text-yellow-600 hover:text-yellow-700/);
  });

  it("warning severity yellow (bg-yellow-950/30 text-yellow-400 border-yellow-200)", () => {
    const src = read(QUOTE_PATH);
    expect(src).toMatch(/bg-yellow-950\/30 text-yellow-400 border-yellow-200/);
  });
});

describe("§11.302d-6a-4-β — 회귀 0 (다른 status + error 분기 보존)", () => {
  it("order: CANCELLED status red 보존 (text-red-400 bg-red-950/30)", () => {
    const src = read(ORDER_PATH);
    expect(src).toMatch(/CANCELLED:\s*\{\s*text:\s*"text-red-400",\s*bg:\s*"bg-red-950\/30"/);
  });

  it("order: CONFIRMED blue / SHIPPING purple / DELIVERED emerald 보존", () => {
    const src = read(ORDER_PATH);
    expect(src).toMatch(/CONFIRMED:\s*\{\s*text:\s*"text-blue-400"/);
    expect(src).toMatch(/SHIPPING:\s*\{\s*text:\s*"text-purple-400"/);
    expect(src).toMatch(/DELIVERED:\s*\{\s*text:\s*"text-emerald-400"/);
  });

  it("order: isError red 분기 보존 (text-red-500)", () => {
    const src = read(ORDER_PATH);
    expect(src).toMatch(/errors\.length > 0 \? "text-red-500"/);
  });

  it("quote: isError red 분기 보존 (text-red-600 hover:text-red-700)", () => {
    const src = read(QUOTE_PATH);
    expect(src).toMatch(/text-red-600 hover:text-red-700/);
  });

  it("order: onFix / 수정 wiring 보존 (isError red 분기 유지)", () => {
    const src = read(ORDER_PATH);
    expect(src).toMatch(/isError\s*\?\s*"text-red-500"/);
  });
});
