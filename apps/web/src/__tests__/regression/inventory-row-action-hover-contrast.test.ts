/**
 * §inventory-row-hover-contrast (호영님 2026-06-30) — 재고 행 재발주/입고 버튼 호버 글자 대비
 *
 * 증상: 재발주(yellow)/입고(emerald) 버튼에 마우스 올리면 글자가 회색(slate)으로 변함.
 * 원인: Button outline variant 의 hover:text-slate-900 가 커스텀 브랜드색(text-yellow-600/
 *   emerald-600)을 호버 시 덮음(커스텀에 hover:text- 미지정). + 정상 입고 버튼은
 *   border-emerald-800 + hover:bg-emerald-950(어두운 호버 bg) 대비 붕괴.
 * Fix: 호버 텍스트를 브랜드색(hover:text-yellow-700 / hover:text-emerald-700)으로 오버라이드 +
 *   정상 입고 버튼 톤 표준화(emerald-200/50).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TABLE = readFileSync(
  resolve(__dirname, "../../components/inventory/InventoryTable.tsx"),
  "utf8",
);

describe("§inventory-row-hover-contrast — 호버 글자 브랜드색 유지", () => {
  it("재발주(yellow) 호버 텍스트 = yellow-700 (slate 회색 덮임 방지) 2곳", () => {
    const m = TABLE.match(/hover:bg-yellow-50 hover:text-yellow-700/g) ?? [];
    expect(m.length).toBe(2);
  });
  it("입고(emerald) 호버 텍스트 = emerald-700 3곳(부족 2 + 정상 1)", () => {
    const m = TABLE.match(/hover:bg-emerald-50 hover:text-emerald-700/g) ?? [];
    expect(m.length).toBe(3);
  });
  it("정상 입고 어두운 호버(emerald-950) 제거 — 대비 붕괴 0", () => {
    expect(TABLE).not.toMatch(/hover:bg-emerald-950/);
  });
});
