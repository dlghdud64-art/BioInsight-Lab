/**
 * §inventory-phaseB P3-UI-a1 — scan 차감 GMP 필드 수집 (호영님 결정: 3모드 per-item)
 *   (PLAN: docs/plans/PLAN_inventory-phaseB-gmp-usage-trackingmode.md P3-UI-a)
 *
 * scan/page 차감 폼이 item.trackingMode 읽어 GMP/LOT 시 lot/operator/destination 수집 + 전송.
 *   QUANTITY 품목은 필드 미노출(현 동작 0). 서버 422 게이트와 1:1(클라 선제 차단).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/scan/page.tsx"),
  "utf8",
);

describe("§inventory-phaseB P3-UI-a1 — scan 차감 GMP 게이팅", () => {
  it("tracking-mode 계약 import + trackingMode 파생", () => {
    expect(PAGE).toMatch(/from "@\/lib\/inventory\/tracking-mode"/);
    expect(PAGE).toMatch(/\(inventory\?\.trackingMode as TrackingMode\) \?\? DEFAULT_TRACKING_MODE/);
    expect(PAGE).toMatch(/requiredUsageFields\(trackingMode\)/);
  });
  it("GMP/LOT 시 필드 노출(QUANTITY 미노출)", () => {
    expect(PAGE).toMatch(/trackingMode !== "QUANTITY" && \(/);
    expect(PAGE).toMatch(/setUseLot/);
    expect(PAGE).toMatch(/setUseOperator/);
    expect(PAGE).toMatch(/setUseDestination/);
  });
  it("차감 body 에 lot/operator/destination 전송", () => {
    expect(PAGE).toMatch(/lotNumber: useLot\.trim\(\) \|\| undefined/);
    expect(PAGE).toMatch(/operator: useOperator\.trim\(\) \|\| undefined/);
    expect(PAGE).toMatch(/destination: useDestination\.trim\(\) \|\| undefined/);
  });
  it("클라 게이트(서버 422와 1:1) — 누락 시 차감 차단", () => {
    expect(PAGE).toMatch(/const gmpOk = gmpMissing\.length === 0/);
    expect(PAGE).toMatch(/disabled=\{deductMutation\.isPending \|\| !gmpOk\}/);
    expect(PAGE).toMatch(/if \(!gmpOk\) throw new Error/);
  });
});

describe("§inventory-phaseB P3-UI-a1 — 회귀 0(canonical 경로)", () => {
  it("[id]/use canonical 차감 경로 보존", () => {
    expect(PAGE).toMatch(/\/api\/inventory\/\$\{inventory\.id\}\/use/);
  });
});
