/**
 * §SM-S1 P2 (호영님 2026-07-05) — 안전 목록 category 필터 다중값(콤마구분 in[]) 지원.
 * 단일 값(category=REAGENT)은 스칼라 유지 = 완전 하위호환·무회귀(§safety-modal-upgrade P1 기본값 보존).
 * 복수(REAGENT,RAW_MATERIAL)면 where.category={in:[...]}. 빈/공백은 필터 미적용(안전).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const ROUTE = readFileSync(join(__dirname, "..", "..", "app/api/safety/products/route.ts"), "utf8");

describe("§SM-S1 P2 — category 다중값 필터", () => {
  it("콤마구분 split + 복수 in[]/단일 스칼라 분기", () => {
    expect(ROUTE).toMatch(/category\.split\(","\)\.map\(\(c\) => c\.trim\(\)\)\.filter\(Boolean\)/);
    expect(ROUTE).toMatch(/where\.category = \{ in: cats \}/);
    expect(ROUTE).toMatch(/where\.category = cats\[0\]/);
  });
  it("단일 REAGENT 하위호환 — 무조건 스칼라 대입(where.category=category) 잔재 0", () => {
    expect(ROUTE).not.toMatch(/where\.category = category;/);
  });
});
