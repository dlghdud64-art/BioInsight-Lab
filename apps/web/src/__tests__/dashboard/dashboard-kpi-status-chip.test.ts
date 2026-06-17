/**
 * §kpi-status-chip(호영님, 스캔허브 지시문 00·5) — StatLine KPI 우측 상태칩 sentinel
 *
 * 3 KPI(이번달 지출·잔여 예산·확정 발주액)에 우측 상태칩:
 *   - 지출: 예산 미설정→idle / 집행률 act(<80)·warn(80~99)·up(≥100)
 *   - 잔여 예산: 설정 시 추적 중(ok) / 미설정 설정 필요(idle)
 *   - 확정 발주액: >0 추적 중(ok) / 0 발주 0건(idle)
 * canonical summary.budget 단일 진실(가짜 0). §11.302 신호등: warn=yellow(amber 금지).
 * 회귀: A1 아이콘 틴트 + §11.311 0건 회색 + KPI3 라벨 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const STAT = readFileSync(
  join(__dirname, "..", "..", "components/dashboard/stat-line.tsx"),
  "utf8",
);

describe("§kpi-status-chip — 상태칩 5톤 + 파생", () => {
  it("CHIP_TONE 5톤(act blue / ok emerald / idle gray / warn yellow / up red)", () => {
    expect(STAT).toMatch(/CHIP_TONE/);
    expect(STAT).toMatch(/act:\s*"bg-blue-50/);
    expect(STAT).toMatch(/ok:\s*"bg-emerald-100/);
    expect(STAT).toMatch(/idle:\s*"bg-gray-100/);
    expect(STAT).toMatch(/warn:\s*"bg-yellow-100/);
    expect(STAT).toMatch(/up:\s*"bg-red-50/);
  });
  it("chipFor 파생 — 예산 미설정/집행률/추적중/발주0건/설정필요", () => {
    expect(STAT).toMatch(/chipFor/);
    expect(STAT).toMatch(/예산 미설정/);
    expect(STAT).toMatch(/예산의 \$\{usageRate\}%/);
    expect(STAT).toMatch(/추적 중/);
    expect(STAT).toMatch(/설정 필요/);
    expect(STAT).toMatch(/발주 0건/);
    expect(STAT).toMatch(/usageRate >= 100 \? "up" : usageRate >= 80 \? "warn"/);
  });
  it("canonical summary.budget 바인딩(가짜 0) + 우측 칩 렌더", () => {
    expect(STAT).toMatch(/s\?\.budget\.isSet/);
    expect(STAT).toMatch(/s\?\.budget\.usageRate/);
    expect(STAT).toMatch(/CHIP_TONE\[chip\.tone\]/);
    expect(STAT).toMatch(/justify-between/);
  });
  it("§11.302 — amber/orange 금지(warn=yellow)", () => {
    expect(STAT).not.toMatch(/-amber-|-orange-/);
  });
});

describe("§kpi-status-chip — 회귀 0(A1 틴트 + 0건 회색 + 라벨)", () => {
  it("A1 KPI 아이콘 틴트 보존", () => {
    expect(STAT).toMatch(/KPI_TINT/);
    expect(STAT).toMatch(/bg-blue-50/);
    expect(STAT).toMatch(/bg-emerald-50/);
    expect(STAT).toMatch(/bg-indigo-50/);
  });
  it("§11.311 0건 회색 + grid-cols-3 + text-lg + KPI3 라벨", () => {
    expect(STAT).toMatch(/bg-gray-50/);
    expect(STAT).toMatch(/bg-gray-100/);
    expect(STAT).toMatch(/grid-cols-3/);
    expect(STAT).toMatch(/text-lg md:text-xl/);
    expect(STAT).toMatch(/이번달 지출/);
    expect(STAT).toMatch(/잔여 예산/);
    expect(STAT).toMatch(/확정 발주액/);
  });
});
