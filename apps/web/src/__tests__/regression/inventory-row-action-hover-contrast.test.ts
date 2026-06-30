/**
 * §inventory-row-hover-contrast → §inventory-row-hover-solid 진화 (호영님 2026-06-30)
 *
 * d086784a(outline-darken: hover:text-yellow-700/emerald-700)는 yellow-700/emerald-700이
 * 어두운 머스터드/올리브라 pale bg 위에서 칙칙 → 호영님 "회색 그대로" 재보고(라이브 CSSOM 측정으로 확인).
 * Fix(supersede): 재발주/입고 hover = 솔리드 브랜드색 채움 + 흰 글자(명확 피드백, 회색 인상 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TABLE = readFileSync(resolve(__dirname, "../..", "components/inventory/InventoryTable.tsx"), "utf8");

describe("§inventory-row-hover-solid — 재발주/입고 솔리드 채움 hover (d086784a supersede)", () => {
  it("재발주(부족 yellow / 긴급 blue) → 솔리드 채움 + 흰 글자", () => {
    expect(TABLE).toMatch(/text-yellow-600 border-yellow-300 hover:bg-yellow-600 hover:text-white/);
    expect(TABLE).toMatch(/text-blue-600 border-blue-300 hover:bg-blue-600 hover:text-white/);
  });

  it("입고(emerald) → 솔리드 채움 + 흰 글자 3곳(부족·정상·컴팩트)", () => {
    const m = TABLE.match(/hover:bg-emerald-600 hover:text-white/g) ?? [];
    expect(m.length).toBe(3);
  });

  it("정상 재발주(slate, hover:text 부재 갭) → 솔리드 채움 + 흰 글자", () => {
    expect(TABLE).toMatch(/text-slate-500 border-slate-200 hover:bg-slate-600 hover:text-white/);
  });

  it("muddy darken 제거 — 입고 hover:bg-emerald-50 hover:text-emerald-700 부재(회색 인상 0)", () => {
    expect(TABLE).not.toMatch(/hover:bg-emerald-50 hover:text-emerald-700/);
  });
});
