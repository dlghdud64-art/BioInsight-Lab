import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §inventory-redesign P1 (호영님 2026-07-09) — 재고 헤더 KPI 재설계.
 *   PLAN_inventory-redesign Phase 1 + §11.302 순서.
 *
 * 【UPDATED — §inventory-delta-label-kpi P4 (호영님 2026-07-27 핸드오프 §3)】
 *   격리 Lot KPI 카드 제거(격리 범위 제외 확정) → KPI 3(전체/만료임박/안전재고미달).
 *   카운트 카드 클릭 = 필터 토글(재클릭 해제), 선택 시 파란 보더 + 필터 중 ✕, 0건 비활성.
 *   보존 intent: dispose(만료임박) 먼저 → reorder(안전재고미달) 순서 · de-red · 0=✓정상 · 배너.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SRC = readFileSync(
  join(REPO_ROOT, "src/app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§inventory-redesign P1 / §P4 — KPI 재설계", () => {
  it("§11.302 순서 — 만료임박(dispose)이 안전재고미달(reorder)보다 앞", () => {
    const low = SRC.indexOf('data-testid="dashboard-inventory-header-kpi-low-stock"');
    const exp = SRC.indexOf('data-testid="dashboard-inventory-header-kpi-expiring-soon"');
    expect(exp).toBeGreaterThan(-1);
    expect(low).toBeGreaterThan(exp); // 만료 임박 먼저
  });

  it("§P4 — 격리 Lot KPI 카드 제거(범위 제외 확정)", () => {
    expect(SRC).not.toMatch(/data-testid="dashboard-inventory-header-kpi-quarantine-lot"/);
    expect(SRC).not.toMatch(/const headerKpiQuarantineLot/);
    expect(SRC).toMatch(/grid grid-cols-3 gap-2/);
  });

  it("0값 dim KPI → ✓ 정상(emerald)", () => {
    expect(SRC).toMatch(/text-emerald-600">✓ 정상/);
  });

  it("§P4 — 카운트 카드 클릭 = 필터 토글(재클릭 해제) + 0건 비활성", () => {
    // 만료임박·안전재고미달 토글.
    expect(SRC).toMatch(/setStatusFilter\(\(prev\) => \(prev === "low" \? "all" : "low"\)\)/);
    expect(SRC).toMatch(/setStatusFilter\(\(prev\) => \(prev === "expiring" \? "all" : "expiring"\)\)/);
    expect(SRC).toMatch(/disabled=\{headerKpiLowStock === 0\}/);
    expect(SRC).toMatch(/disabled=\{headerKpiExpiringSoon === 0\}/);
  });

  it("§P4 — 선택 시 파란 보더 + 필터 중 ✕", () => {
    expect(SRC).toMatch(/border-blue-400 bg-blue-50\/50 ring-1 ring-blue-200/);
    expect(SRC).toMatch(/필터 중 ✕/);
  });

  it("de-red — 안전재고미달 카드 배경 채움 제거(bg-white, red-50 fill 없음)", () => {
    const lowIdx = SRC.indexOf('data-testid="dashboard-inventory-header-kpi-low-stock"');
    const win = SRC.slice(lowIdx, lowIdx + 900);
    expect(win).not.toMatch(/bg-red-50/);
    expect(win).toMatch(/bg-white/);
  });
});

describe("§inventory-redesign P1 / §P4 — 회귀 0(§11.317 보존)", () => {
  it("KPI 3 testid + 운영조치 배너 보존", () => {
    expect(SRC).toMatch(/dashboard-inventory-header-kpi-total-items/);
    expect(SRC).toMatch(/dashboard-inventory-header-kpi-low-stock/);
    expect(SRC).toMatch(/dashboard-inventory-header-kpi-expiring-soon/);
    expect(SRC).toMatch(/dashboard-inventory-header-action-banner/);
  });
});
