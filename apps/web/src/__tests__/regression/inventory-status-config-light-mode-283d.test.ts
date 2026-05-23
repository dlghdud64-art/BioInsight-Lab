/**
 * §11.283d #status-config-traffic-light — mobile-inventory-view STATUS_CONFIG
 *   4 spot + inventory-content + inventory-main dark mode `/40` opacity → light
 *   mode 신호등 정합 (호영님 P0+ 보고: 위험/부족/정상/검토 카드 색상 그대로).
 *
 * 호영님 P0+ 보고 (production screenshot):
 *   §11.283c-2 sweep 후에도 재고 화면 배지 (DMEM "검토", Trypsin-EDTA "긴급")
 *   색상이 옅은 베이지/노랑 톤. §11.283c-2 가 색상명만 amber→yellow 했고
 *   dark mode `/40` opacity 패턴 (bg-yellow-900/40, bg-emerald-950/40) 잔존.
 *
 * Root Cause:
 *   STATUS_CONFIG (4 spot) + 다른 dark opacity badge 가 호영님 spec light mode
 *   신호등 (bg-XXX-100 text-XXX-700) 와 mismatch.
 *
 * Fix (mobile-inventory-view STATUS_CONFIG 4 spot + 동적 expiring/expired badge
 *   1 spot + inventory-content/main regex sweep 124 spot):
 *   - normal: bg-emerald-100 text-emerald-700 border-emerald-200
 *   - low: bg-red-100 text-red-700 border-red-200
 *   - expiring: bg-yellow-100 text-yellow-700 border-yellow-200
 *   - danger: bg-red-600 text-white border-red-700 (Critical, 흰 텍스트)
 *   - dotCls: dark-mode -400 → light-mode -500/-600
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VIEW = readFileSync(
  resolve(__dirname, "../../components/inventory/mobile-inventory-view.tsx"),
  "utf8",
);

describe("§11.283d — STATUS_CONFIG light mode 신호등", () => {
  it("§11.283d trace marker 존재", () => {
    expect(VIEW).toMatch(/§11\.283d/);
  });

  it("STATUS_CONFIG.normal — bg-emerald-100 text-emerald-700 border-emerald-200", () => {
    expect(VIEW).toMatch(/normal:[\s\S]{0,300}bg-emerald-100 text-emerald-700 border-emerald-200/);
  });

  it("STATUS_CONFIG.low — bg-red-100 text-red-700 border-red-200", () => {
    expect(VIEW).toMatch(/low:[\s\S]{0,300}bg-red-100 text-red-700 border-red-200/);
  });

  it("STATUS_CONFIG.expiring — bg-yellow-100 text-yellow-700 border-yellow-200", () => {
    expect(VIEW).toMatch(/expiring:[\s\S]{0,300}bg-yellow-100 text-yellow-700 border-yellow-200/);
  });

  it("STATUS_CONFIG.danger — bg-red-600 text-white border-red-700 (Critical)", () => {
    expect(VIEW).toMatch(/danger:[\s\S]{0,300}bg-red-600 text-white border-red-700/);
  });

  it("dark mode -900/40 + -950/40 opacity 잔존 부재 (STATUS_CONFIG 4 spot)", () => {
    expect(VIEW).not.toMatch(/STATUS_CONFIG[\s\S]{0,1500}bg-(red|yellow|emerald)-9\d+\/\d+/);
  });
});
