/**
 * §11.326 Phase 4 (RED) — 의심 입고 수량 탐지 (옵션 C 보조)
 *
 * 결정(호영님 2026-05-30): A안 — 라운드 숫자만(≥100 + 100의 배수). packSize 매칭 후속.
 *   §11.326 버그 패턴("라벨 100 CAPSULES → 입고 수량 100")의 핵심 시그널 = 큰 라운드 숫자.
 *   자동 수정 X, "검토 권장" 표시만(false positive 비용 낮음).
 *   임계값은 함수 상단 상수 노출(튜닝 가능).
 *
 * 순수 함수 — 구현 전이므로 RED.
 */
import { describe, it, expect } from "vitest";
import {
  isSuspectReceivedQuantity,
  SUSPECT_MIN_QTY,
  countSuspectInventories,
} from "../suspect-received-quantity";

describe("§11.326 Phase 4 — isSuspectReceivedQuantity (라운드 숫자)", () => {
  it("100 미만 → false (일반 입고 범위)", () => {
    expect(isSuspectReceivedQuantity(1)).toBe(false);
    expect(isSuspectReceivedQuantity(50)).toBe(false);
    expect(isSuspectReceivedQuantity(99)).toBe(false);
  });

  it("100 이상 + 100의 배수 → true (의심)", () => {
    expect(isSuspectReceivedQuantity(100)).toBe(true);
    expect(isSuspectReceivedQuantity(200)).toBe(true);
    expect(isSuspectReceivedQuantity(500)).toBe(true);
    expect(isSuspectReceivedQuantity(1000)).toBe(true);
    expect(isSuspectReceivedQuantity(5000)).toBe(true);
  });

  it("100 이상이지만 100의 배수 아님 → false", () => {
    expect(isSuspectReceivedQuantity(150)).toBe(false);
    expect(isSuspectReceivedQuantity(101)).toBe(false);
    expect(isSuspectReceivedQuantity(550)).toBe(false);
  });

  it("비정상 입력(음수/NaN/소수) → false (안전)", () => {
    expect(isSuspectReceivedQuantity(-100)).toBe(false);
    expect(isSuspectReceivedQuantity(NaN)).toBe(false);
    expect(isSuspectReceivedQuantity(100.5)).toBe(false);
  });

  it("임계값 상수 노출 (튜닝 가능)", () => {
    expect(SUSPECT_MIN_QTY).toBe(100);
  });
});

describe("§11.326 Phase 4 — countSuspectInventories", () => {
  it("currentQuantity 기준 의심 건수 집계", () => {
    const inv = [
      { id: "a", currentQuantity: 100 }, // 의심
      { id: "b", currentQuantity: 3 },   // 정상
      { id: "c", currentQuantity: 500 }, // 의심
      { id: "d", currentQuantity: 150 }, // 정상(배수 아님)
    ];
    expect(countSuspectInventories(inv)).toBe(2);
  });

  it("빈 배열 → 0 (배너 미노출 트리거)", () => {
    expect(countSuspectInventories([])).toBe(0);
  });

  it("currentQuantity 누락/null 안전 처리", () => {
    const inv = [
      { id: "a", currentQuantity: null as unknown as number },
      { id: "b" } as { id: string; currentQuantity?: number },
    ];
    expect(countSuspectInventories(inv as Array<{ id: string; currentQuantity?: number | null }>)).toBe(0);
  });
});
