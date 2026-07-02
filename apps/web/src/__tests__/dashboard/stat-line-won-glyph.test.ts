/**
 * §dashboard-kpi-won-glyph (호영님 2026-07-02) — 재무 KPI(₩ 금액) 글리프 겹침 수정.
 *
 * 문제: StatLine 값 <p> 의 tracking-tighter(−0.05em)로 ₩ 글리프가 첫 숫자와 겹쳐
 *       "₩0" 이 취소선처럼 보임(실기기 라이브 대시보드).
 * 수정: 값 <p> tracking-normal 로 전환 → ₩·숫자 분리.
 * 회귀 0: won() 단일 진실(₩ + toLocaleString) 보존, tabular-nums·whitespace-nowrap·
 *         font-black·0건 slate-500 톤 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SRC = readFileSync(
  join(REPO_ROOT, "src/components/dashboard/stat-line.tsx"),
  "utf8",
);

describe("§dashboard-kpi-won-glyph — ₩ 글리프 겹침 수정", () => {
  it("값 <p> 는 tracking-normal (tracking-tighter 제거)", () => {
    expect(SRC).toMatch(
      /text-lg md:text-xl font-black tracking-normal tabular-nums leading-none whitespace-nowrap/,
    );
    expect(SRC).not.toMatch(
      /font-black tracking-tighter tabular-nums leading-none whitespace-nowrap/,
    );
  });
});

describe("§dashboard-kpi-won-glyph — 회귀 0", () => {
  it("won() 단일 진실 렌더 보존", () => {
    expect(SRC).toMatch(/\{won\(it\.value\)\}/);
  });
  it("0건 slate-500 / active slate-900 톤 보존", () => {
    expect(SRC).toMatch(/active \? "text-slate-900" : "text-slate-500"/);
  });
  it("tabular-nums · whitespace-nowrap 보존", () => {
    expect(SRC).toMatch(/tabular-nums leading-none whitespace-nowrap/);
  });
});
