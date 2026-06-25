/**
 * §inventory-phaseB P4 — GMP trackingMode end-to-end smoke (종결)
 *   (PLAN: docs/plans/PLAN_inventory-phaseB-gmp-usage-trackingmode.md Phase 4)
 *
 * 전체 체인 정합 lock: P1 로직 → P2 schema → P3-server 게이팅 → P3-UI-a(차감 3 라이브 surface) → P3-UI-b(설정+API).
 *   회귀 0: QUANTITY 기본(전 경로 무변경). Render-Reachability: inventory-main(dead) 제외 확정.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const r = (p: string) => readFileSync(resolve(__dirname, "../../", p), "utf8");
const LOGIC = r("lib/inventory/tracking-mode.ts");
const SCHEMA = readFileSync(resolve(__dirname, "../../../prisma/schema.prisma"), "utf8");
const USE_ROUTE = r("app/api/inventory/[id]/use/route.ts");
const SCAN = r("app/dashboard/inventory/scan/page.tsx");
const QR = r("components/inventory/GlobalQRScannerModal.tsx");
const CONTENT = r("app/dashboard/inventory/inventory-content.tsx");
const MODAL = r("components/inventory/AddInventoryModal.tsx");
const ROUTE_PAGE = r("app/dashboard/inventory/page.tsx");

describe("§inventory-phaseB P4 — end-to-end 체인 정합", () => {
  it("P1 순수 게이팅 로직", () => {
    expect(LOGIC).toMatch(/export function validateUsageForTrackingMode/);
  });
  it("P2 schema enum + 컬럼(기본 QUANTITY)", () => {
    expect(SCHEMA).toMatch(/enum TrackingMode/);
    expect(SCHEMA).toMatch(/trackingMode\s+TrackingMode\s+@default\(QUANTITY\)/);
  });
  it("P3-server 차감 422 게이팅", () => {
    expect(USE_ROUTE).toMatch(/validateUsageForTrackingMode\(inventory\.trackingMode/);
    expect(USE_ROUTE).toMatch(/status: 422/);
  });
  it("P3-UI-a 차감 3 라이브 surface GMP 필드", () => {
    expect(SCAN).toMatch(/trackingMode !== "QUANTITY" && \(/);
    expect(QR).toMatch(/trackingMode !== "QUANTITY" && \(/);
    expect(CONTENT).toMatch(/usageTrackingMode !== "QUANTITY" && \(/);
  });
  it("P3-UI-b 설정 Select + API 화이트리스트", () => {
    expect(MODAL).toMatch(/<Select value=\{trackingMode\} onValueChange=\{setTrackingMode\}>/);
    expect(CONTENT).toMatch(/trackingMode: formPayload\.trackingMode/);
  });
});

describe("§inventory-phaseB P4 — 회귀 0 + Render-Reachability", () => {
  it("기본 QUANTITY(전 경로 무변경 — 마찰 0)", () => {
    expect(LOGIC).toMatch(/DEFAULT_TRACKING_MODE: TrackingMode = "QUANTITY"/);
    expect(MODAL).toMatch(/inventory\?\.trackingMode \?\? "QUANTITY"/);
  });
  it("라이브 재고 surface = inventory-content(dead inventory-main 제외)", () => {
    expect(ROUTE_PAGE).toMatch(/import\("\.\/inventory-content"\)/);
    expect(ROUTE_PAGE).not.toMatch(/import\("\.\/inventory-main"\)/);
  });
});
