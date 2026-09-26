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
  /* 🛑 §inventory-state-tone 후속 재앵커 (2026-09-26 · 호영님 판정) — **결정이 바뀌었다.**
   *   호영님 판정: 「재발주」 같은 **조치 버튼은 상태색을 쓰지 않고 중립 버튼으로 둔다.**
   *   옛 명제(부족 yellow / 긴급 blue)는 두 가지로 어긋났다 — 부족은 이제 red 이고, blue 는 §9 의 정보 축이다.
   *   보존되는 명제는 **솔리드 채움 hover + 흰 글자**(대비 확보)이고, 그것은 중립 톤으로 유지된다. */
  it("재발주 → 중립 솔리드 채움 hover + 흰 글자 (상태색 0)", () => {
    expect(TABLE).toMatch(/text-slate-500 border-slate-200 hover:bg-slate-600 hover:text-white/);
    expect(TABLE).not.toMatch(/text-yellow-600 border-yellow-300/);
    expect(TABLE).not.toMatch(/text-blue-600 border-blue-300/);
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
