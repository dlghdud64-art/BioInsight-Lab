/**
 * §inventory-phaseB P4 — GMP trackingMode end-to-end smoke (종결)
 *   (PLAN: docs/plans/PLAN_inventory-phaseB-gmp-usage-trackingmode.md Phase 4)
 *
 * 전체 체인 정합 lock: P1 로직 → P2 schema → P3-server 게이팅 → P3-UI-a(차감 3 라이브 surface) → P3-UI-b(설정+API).
 *   회귀 0: QUANTITY 기본(전 경로 무변경). Render-Reachability: inventory-main(dead) 제외 확정.
 */

import { describe, it, expect } from "vitest";
import { buildInventoryPatchBody } from "@/lib/inventory/inventory-form-payload";
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
    /* 승계 (§audit-reject-raw-4xx Phase 2): 422 게이팅은 enforceAction 이후 판정이라 reject(422, …) 로 바꿨다.
     *   명제("trackingMode 검증 실패 시 422")는 참. OR 로 넓히지 않는다(대체 매칭 방지). */
    expect(USE_ROUTE).toMatch(/enforcement\.reject\(\s*422\b/);
  });
  it("P3-UI-a 차감 3 라이브 surface GMP 필드", () => {
    expect(SCAN).toMatch(/trackingMode !== "QUANTITY" && \(/);
    expect(QR).toMatch(/trackingMode !== "QUANTITY" && \(/);
    expect(CONTENT).toMatch(/usageTrackingMode !== "QUANTITY" && \(/);
  });
  it("P3-UI-b 설정 Select + API 화이트리스트", () => {
    expect(MODAL).toMatch(/<Select value=\{trackingMode\} onValueChange=\{setTrackingMode\}>/);
    /* 승계 (§inventory-notes-erase P1-b · 2026-09-11): 조립이 lib/inventory/inventory-form-payload.ts 로
     *   옮겨졌다(동작 동일 추출). 명제는 그 줄의 위치·바이트가 아니라 **조립 결과**다 — 결과와 배선으로 잰다. */
    expect(CONTENT).toMatch(/buildInventoryPatchBody\s*\(\s*formPayload\s*\)/);
    expect(buildInventoryPatchBody({ currentQuantity: 1, trackingMode: "GMP_STRICT" }).trackingMode).toBe("GMP_STRICT");
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
