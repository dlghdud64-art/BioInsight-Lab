/**
 * §inventory-phaseB P3-UI-a3 (content) — 데스크탑 inline 차감 GMP 필드 + 경로 분기
 *   (PLAN: docs/plans/PLAN_inventory-phaseB-gmp-usage-trackingmode.md P3-UI-a)
 *
 * inventory-content InventoryCard 차감 dialog가 trackingMode 읽어 GMP/LOT 시 lot/operator/destination 수집.
 *   ★ 경로 분기: 추적 품목 → canonical [id]/use(필드 지원), QUANTITY → 기존 legacy /usage(P3-server 422 회피).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§inventory-phaseB P3-UI-a3(content) — 차감 GMP 게이팅", () => {
  it("tracking-mode 계약 import + trackingMode 파생", () => {
    expect(PAGE).toMatch(/from "@\/lib\/inventory\/tracking-mode"/);
    expect(PAGE).toMatch(/\(inventory\.trackingMode as TrackingMode\) \?\? DEFAULT_TRACKING_MODE/);
    expect(PAGE).toMatch(/requiredUsageFields\(usageTrackingMode\)/);
  });
  it("GMP/LOT 시 필드 노출 + 클라 게이트(QUANTITY 미노출)", () => {
    expect(PAGE).toMatch(/usageTrackingMode !== "QUANTITY" && \(/);
    expect(PAGE).toMatch(/const usageGmpOk = usageGmpMissing\.length === 0/);
    expect(PAGE).toMatch(/\|\| !usageGmpOk\}/);
  });
});

describe("§inventory-phaseB P3-UI-a3(content) — 경로 분기(dead-end 0)", () => {
  it("추적 품목 → [id]/use, QUANTITY → legacy /usage", () => {
    expect(PAGE).toMatch(/usagePayload\.trackingMode !== "QUANTITY"/);
    expect(PAGE).toMatch(/tracked \? `\/api\/inventory\/\$\{usagePayload\.inventoryId\}\/use` : "\/api\/inventory\/usage"/);
  });
  it("onRecordUsage 계약 확장(gmp 필드 전달)", () => {
    expect(PAGE).toMatch(/gmp\?: \{ lotNumber\?: string; operator\?: string; destination\?: string \}/);
    expect(PAGE).toMatch(/trackingMode: inventory\.trackingMode/);
  });
});
