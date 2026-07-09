import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §inventory-redesign P1 (호영님 2026-07-09) — 재고 헤더 KPI 재설계.
 *   PLAN_inventory-redesign Phase 1. 핸드오프 §1(KPI) 정합 + §11.302 순서 강제.
 *
 * ① §11.302 순서: dispose(만료임박·격리)가 reorder(안전재고미달)보다 앞.
 * ② de-red: 경고 카드 배경 채움 제거, 숫자만 색.
 * ③ 0값 dim KPI → "✓ 정상"(emerald).
 * ④ 안전재고미달 클릭 → low 필터(N-safe, dead 아님), 0건 비활성.
 * 회귀 0: §11.317 KPI 4 testid + 운영조치 배너 보존.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SRC = readFileSync(
  join(REPO_ROOT, "src/app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§inventory-redesign P1 — KPI 재설계", () => {
  it("§11.302 순서 — dispose(만료임박·격리)가 reorder(안전재고미달)보다 앞", () => {
    const low = SRC.indexOf('data-testid="dashboard-inventory-header-kpi-low-stock"');
    const exp = SRC.indexOf('data-testid="dashboard-inventory-header-kpi-expiring-soon"');
    const qua = SRC.indexOf('data-testid="dashboard-inventory-header-kpi-quarantine-lot"');
    expect(exp).toBeGreaterThan(-1);
    expect(qua).toBeGreaterThan(-1);
    expect(low).toBeGreaterThan(exp); // 만료 임박 먼저
    expect(low).toBeGreaterThan(qua); // 격리 Lot 먼저
  });

  it("0값 dim KPI → ✓ 정상(emerald)", () => {
    expect(SRC).toMatch(/text-emerald-600">✓ 정상/);
  });

  it("안전재고미달 클릭 → low 필터(dead 아님) + 0건 비활성", () => {
    expect(SRC).toMatch(/onClick=\{\(\) => setStatusFilter\("low"\)\}/);
    expect(SRC).toMatch(/disabled=\{headerKpiLowStock === 0\}/);
  });

  it("de-red — 안전재고미달 카드 배경 채움 제거(bg-white, red-50 fill 없음)", () => {
    const lowIdx = SRC.indexOf('data-testid="dashboard-inventory-header-kpi-low-stock"');
    const win = SRC.slice(lowIdx, lowIdx + 500);
    expect(win).not.toMatch(/bg-red-50/);
    expect(win).toMatch(/bg-white/);
  });
});

describe("§inventory-redesign P1 — 회귀 0(§11.317 보존)", () => {
  it("KPI 4 testid + 운영조치 배너 보존", () => {
    expect(SRC).toMatch(/dashboard-inventory-header-kpi-total-items/);
    expect(SRC).toMatch(/dashboard-inventory-header-kpi-low-stock/);
    expect(SRC).toMatch(/dashboard-inventory-header-kpi-expiring-soon/);
    expect(SRC).toMatch(/dashboard-inventory-header-kpi-quarantine-lot/);
    expect(SRC).toMatch(/dashboard-inventory-header-action-banner/);
  });
});
