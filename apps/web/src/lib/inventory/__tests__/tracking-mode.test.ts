/**
 * §inventory-phaseB-gmp-usage P1 — trackingMode GMP 게이팅 계약 테스트 (RED→GREEN)
 *   (PLAN: docs/plans/PLAN_inventory-phaseB-gmp-usage-trackingmode.md Phase 1)
 *
 * 순수 검증 로직(DB 무관). placeholder success 차단 = GMP_STRICT 누락 시 ok:false 강제.
 */

import { describe, it, expect } from "vitest";
import {
  TRACKING_MODES,
  DEFAULT_TRACKING_MODE,
  requiredUsageFields,
  validateUsageForTrackingMode,
} from "../tracking-mode";

describe("§inventory-phaseB P1 — trackingMode 상수", () => {
  it("3 모드(QUANTITY/LOT/GMP_STRICT) + default QUANTITY(backward-compat)", () => {
    expect(TRACKING_MODES).toEqual(["QUANTITY", "LOT", "GMP_STRICT"]);
    expect(DEFAULT_TRACKING_MODE).toBe("QUANTITY");
  });
});

describe("§inventory-phaseB P1 — requiredUsageFields(모드별 필수 필드)", () => {
  it("QUANTITY = 필수 없음(기존 동작)", () => {
    expect(requiredUsageFields("QUANTITY")).toEqual([]);
  });
  it("LOT = lotNumber 필수", () => {
    expect(requiredUsageFields("LOT")).toEqual(["lotNumber"]);
  });
  it("GMP_STRICT = lotNumber·operator·destination 필수", () => {
    expect(requiredUsageFields("GMP_STRICT")).toEqual(["lotNumber", "operator", "destination"]);
  });
});

describe("§inventory-phaseB P1 — validateUsageForTrackingMode 게이팅", () => {
  it("QUANTITY — 필드 없어도 통과(회귀 0)", () => {
    expect(validateUsageForTrackingMode("QUANTITY", {})).toEqual({ ok: true, missing: [] });
  });

  it("LOT — lotNumber 있으면 통과 / 없으면 거부", () => {
    expect(validateUsageForTrackingMode("LOT", { lotNumber: "L-001" }).ok).toBe(true);
    expect(validateUsageForTrackingMode("LOT", {})).toEqual({ ok: false, missing: ["lotNumber"] });
  });

  it("GMP_STRICT — 3필드 충족 시 통과", () => {
    const r = validateUsageForTrackingMode("GMP_STRICT", {
      lotNumber: "L-001",
      operator: "홍길동",
      destination: "분석실 A",
    });
    expect(r).toEqual({ ok: true, missing: [] });
  });

  it("GMP_STRICT — 일부 누락 시 거부 + missing[] 정확", () => {
    const r = validateUsageForTrackingMode("GMP_STRICT", { lotNumber: "L-001" });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["operator", "destination"]);
  });

  it("GMP_STRICT — 공백/빈 문자열/null = 누락(가짜 충족 차단)", () => {
    const r = validateUsageForTrackingMode("GMP_STRICT", {
      lotNumber: "   ",
      operator: "",
      destination: null,
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["lotNumber", "operator", "destination"]);
  });
});
