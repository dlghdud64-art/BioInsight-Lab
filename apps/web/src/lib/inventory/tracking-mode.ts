/**
 * §inventory-phaseB-gmp-usage P1 — 재고 추적 모드(trackingMode) + GMP 차감 게이팅 계약
 *   (PLAN: docs/plans/PLAN_inventory-phaseB-gmp-usage-trackingmode.md)
 *
 * canonical: ProductInventory.trackingMode(정책, P2 schema enum). 이 모듈은 순수 검증 로직
 *   (DB 무관) — 차감 시 trackingMode별 필수 필드를 게이팅. placeholder success 금지의 1차 방어선.
 *
 * 게이팅 규칙(호영님 스코프 2026-06-25):
 *   - QUANTITY   : 필수 없음(기존 동작, backward-compat default)
 *   - LOT        : lotNumber 필수(lot 라벨 추적)
 *   - GMP_STRICT : lotNumber·operator·destination 모두 필수(GMP 소비 traceability)
 */

/** P2에서 prisma `enum TrackingMode { QUANTITY LOT GMP_STRICT }`로 승격. TS 계약은 P1 선행. */
export type TrackingMode = "QUANTITY" | "LOT" | "GMP_STRICT";

export const TRACKING_MODES: readonly TrackingMode[] = ["QUANTITY", "LOT", "GMP_STRICT"] as const;

/** 기존 행 backward-compat — 명시 설정 전 동작 회귀 0. */
export const DEFAULT_TRACKING_MODE: TrackingMode = "QUANTITY";

export interface UsageFieldInput {
  lotNumber?: string | null;
  operator?: string | null;
  destination?: string | null;
}

export type UsageRequiredField = keyof UsageFieldInput;

/** trackingMode별 차감 필수 필드. */
export function requiredUsageFields(mode: TrackingMode): UsageRequiredField[] {
  switch (mode) {
    case "GMP_STRICT":
      return ["lotNumber", "operator", "destination"];
    case "LOT":
      return ["lotNumber"];
    case "QUANTITY":
    default:
      return [];
  }
}

export interface UsageValidationResult {
  ok: boolean;
  missing: UsageRequiredField[];
}

/**
 * canonical 게이팅 — 필수 필드 누락 시 ok:false + missing[].
 *   null·undefined·빈 문자열·공백만 모두 "누락"으로 처리(가짜 충족 차단).
 */
export function validateUsageForTrackingMode(
  mode: TrackingMode,
  fields: UsageFieldInput,
): UsageValidationResult {
  const missing = requiredUsageFields(mode).filter((key) => {
    const value = fields[key];
    return value == null || String(value).trim() === "";
  });
  return { ok: missing.length === 0, missing };
}
