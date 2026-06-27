/**
 * §pricing-enforce-p2 P2a — trackingMode 플랜 게이팅 (호영님 2026-06-27)
 *
 * P1(가격 재설계)이 plans.ts 에 allowedTrackingModes field 를 추가했으나 enforce 0(휴면).
 * 본 sentinel 은 LOT/GMP_STRICT 추적 모드가 Pro 플랜에서만 설정 가능하도록 server gate 를 강제한다.
 *   - lib/billing/enforce-plan-limit.ts: assertTrackingModeAllowed + TrackingModePlanError export
 *   - api/inventory POST + [id] PATCH: LOT/GMP set 시 게이트 호출 → 미허용 plan 403 품위 안내
 *   - QUANTITY 는 항상 허용(다운그레이드 자유). migration 0 (read-only plan 조회).
 * 회귀 0: tracking-mode.ts 차감 필수필드 검증(validateUsageForTrackingMode) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const ENFORCE = read("lib/billing/enforce-plan-limit.ts");
const PLANS = read("lib/plans.ts");
const INV_POST = read("app/api/inventory/route.ts");
const INV_PATCH = read("app/api/inventory/[id]/route.ts");
const TRACK = read("lib/inventory/tracking-mode.ts");

describe("§pricing-enforce-p2 — enforce helper: trackingMode 게이트", () => {
  it("TrackingModePlanError export", () => {
    expect(ENFORCE).toMatch(/export class TrackingModePlanError/);
  });
  it("assertTrackingModeAllowed export + QUANTITY 항상 허용 early-return", () => {
    expect(ENFORCE).toMatch(/export async function assertTrackingModeAllowed/);
    expect(ENFORCE).toMatch(/mode === "QUANTITY"[\s\S]*?return/);
  });
  it("allowedTrackingModes 미포함 시 throw", () => {
    expect(ENFORCE).toMatch(/allowedTrackingModes\.includes\(mode\)/);
    expect(ENFORCE).toMatch(/throw new TrackingModePlanError/);
  });
});

describe("§pricing-enforce-p2 — plans.ts allowedTrackingModes (P1 land 재확인)", () => {
  it("Free/Basic QUANTITY only · Pro +LOT/GMP_STRICT", () => {
    expect(PLANS).toMatch(/allowedTrackingModes: \["QUANTITY"\]/);
    expect(PLANS).toMatch(/allowedTrackingModes: \["QUANTITY", "LOT", "GMP_STRICT"\]/);
  });
});

describe("§pricing-enforce-p2 — 라우트 게이트 배선(403 품위 안내)", () => {
  it("inventory POST — assertTrackingModeAllowed import + 호출 + TrackingModePlanError 403", () => {
    expect(INV_POST).toMatch(/assertTrackingModeAllowed/);
    expect(INV_POST).toMatch(/TrackingModePlanError/);
    expect(INV_POST).toMatch(/status:\s*403/);
  });
  it("inventory [id] PATCH — assertTrackingModeAllowed import + 호출 + TrackingModePlanError 403", () => {
    expect(INV_PATCH).toMatch(/assertTrackingModeAllowed/);
    expect(INV_PATCH).toMatch(/TrackingModePlanError/);
    expect(INV_PATCH).toMatch(/status:\s*403/);
  });
});

describe("§pricing-enforce-p2 — 회귀 0 (기존 trackingMode 차감 게이팅 보존)", () => {
  it("tracking-mode.ts validateUsageForTrackingMode 보존", () => {
    expect(TRACK).toMatch(/export function validateUsageForTrackingMode/);
    expect(TRACK).toMatch(/GMP_STRICT/);
  });
  it("inventory POST 화이트리스트(임의 값 차단) 보존", () => {
    expect(INV_POST).toMatch(/trackingMode === "LOT" \|\| trackingMode === "GMP_STRICT" \? trackingMode : "QUANTITY"/);
  });
});
