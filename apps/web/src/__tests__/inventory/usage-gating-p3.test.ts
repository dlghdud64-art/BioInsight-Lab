/**
 * §inventory-phaseB P3(server) — 차감 trackingMode 게이팅 (canonical 경로 + legacy 우회 차단)
 *   (PLAN: docs/plans/PLAN_inventory-phaseB-gmp-usage-trackingmode.md Phase 3)
 *
 * 서버 1차 방어 — placeholder success 0. UI(라이브 3surface 필드 수집)는 P3-UI 별도 결정.
 *   - [id]/use: validateUsageForTrackingMode 게이팅(GMP 누락 422) + audit trackingMode 기록
 *   - legacy /usage: lot/operator/destination 미수집 → 비-QUANTITY 차단(우회 방지)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const USE_ROUTE = readFileSync(
  resolve(__dirname, "../../app/api/inventory/[id]/use/route.ts"),
  "utf8",
);
const LEGACY_ROUTE = readFileSync(
  resolve(__dirname, "../../app/api/inventory/usage/route.ts"),
  "utf8",
);

describe("§inventory-phaseB P3 — [id]/use canonical 게이팅", () => {
  it("validateUsageForTrackingMode import + 호출", () => {
    expect(USE_ROUTE).toMatch(/import \{ validateUsageForTrackingMode \} from "@\/lib\/inventory\/tracking-mode"/);
    expect(USE_ROUTE).toMatch(/validateUsageForTrackingMode\(inventory\.trackingMode, \{ lotNumber, destination, operator \}\)/);
  });
  it("GMP 누락 시 422 거부(placeholder success 0) + missing 노출", () => {
    expect(USE_ROUTE).toMatch(/if \(!usageGate\.ok\)/);
    expect(USE_ROUTE).toMatch(/missing: usageGate\.missing/);
    expect(USE_ROUTE).toMatch(/status: 422/);
  });
  it("게이팅이 트랜잭션 전(차감 발생 전) 위치", () => {
    const gateIdx = USE_ROUTE.indexOf("validateUsageForTrackingMode(inventory.trackingMode");
    const txIdx = USE_ROUTE.indexOf("db.$transaction");
    expect(gateIdx).toBeGreaterThan(0);
    expect(gateIdx).toBeLessThan(txIdx);
  });
  it("audit newData 에 trackingMode 기록", () => {
    expect(USE_ROUTE).toMatch(/trackingMode: inventory\.trackingMode/);
  });
});

describe("§inventory-phaseB P3 — legacy /usage 우회 차단", () => {
  it("select 에 trackingMode 포함", () => {
    expect(LEGACY_ROUTE).toMatch(/trackingMode: true/);
  });
  it("비-QUANTITY 차감 차단(422 — lot/operator/destination 미수집 경로)", () => {
    expect(LEGACY_ROUTE).toMatch(/inventory\.trackingMode !== "QUANTITY"/);
    expect(LEGACY_ROUTE).toMatch(/status: 422/);
  });
});
