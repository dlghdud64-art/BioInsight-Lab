/**
 * §inventory-phaseB P3-UI-a2 — QR 스캐너 차감 GMP 필드 수집
 *   (PLAN: docs/plans/PLAN_inventory-phaseB-gmp-usage-trackingmode.md P3-UI-a)
 *
 * GlobalQRScannerModal 차감 폼이 inventoryResult.trackingMode 읽어 GMP/LOT 시 lot/operator/destination
 *   수집 + 전송. QUANTITY 미노출(현 동작 0). 클라 게이트 = 서버 422와 1:1(P1 순수 로직 공유).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MODAL = readFileSync(
  resolve(__dirname, "../../components/inventory/GlobalQRScannerModal.tsx"),
  "utf8",
);

describe("§inventory-phaseB P3-UI-a2 — QR 차감 GMP 게이팅", () => {
  it("tracking-mode 계약 import + trackingMode 파생", () => {
    expect(MODAL).toMatch(/from "@\/lib\/inventory\/tracking-mode"/);
    expect(MODAL).toMatch(/\(inventoryResult\?\.trackingMode as TrackingMode\) \?\? DEFAULT_TRACKING_MODE/);
    expect(MODAL).toMatch(/requiredUsageFields\(trackingMode\)/);
  });
  it("GMP/LOT 시 필드 노출(QUANTITY 미노출)", () => {
    expect(MODAL).toMatch(/trackingMode !== "QUANTITY" && \(/);
    expect(MODAL).toMatch(/setUseLot/);
    expect(MODAL).toMatch(/setUseOperator/);
    expect(MODAL).toMatch(/setUseDestination/);
  });
  it("차감 body 에 lot/operator/destination 전송", () => {
    expect(MODAL).toMatch(/lotNumber: useLot\.trim\(\) \|\| undefined/);
    expect(MODAL).toMatch(/operator: useOperator\.trim\(\) \|\| undefined/);
    expect(MODAL).toMatch(/destination: useDestination\.trim\(\) \|\| undefined/);
  });
  it("클라 게이트(서버 422와 1:1)", () => {
    expect(MODAL).toMatch(/const gmpOk = gmpMissing\.length === 0/);
    expect(MODAL).toMatch(/disabled=\{useMutation_\.isPending \|\| !gmpOk\}/);
    expect(MODAL).toMatch(/if \(!gmpOk\) throw new Error/);
  });
  it("회귀 0 — canonical [id]/use 경로 보존", () => {
    expect(MODAL).toMatch(/\/api\/inventory\/\$\{inventoryResult\.id\}\/use/);
  });
});
