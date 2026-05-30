/**
 * §11.326 Phase 4 — 의심 입고 수량 탐지 (옵션 C 보조, 순수 모듈)
 *
 * 결정(호영님 2026-05-30): A안 — 라운드 숫자 휴리스틱만. packSize 매칭은 후속 batch.
 *   §11.326 버그("라벨 100 CAPSULES → 입고 수량 100")의 핵심 시그널 = 큰 라운드 숫자.
 *   자동 수정 X — "검토 권장" 표시만. false positive(실제 100통)는 사용자가 판단.
 *   임계값은 상수로 노출(향후 false positive/negative 데이터로 튜닝).
 */

/** 의심 판정 최소 수량(미만은 일반 입고 범위). */
export const SUSPECT_MIN_QTY = 100;
/** 라운드 단위(이 배수만 의심). */
export const SUSPECT_ROUND_UNIT = 100;

/**
 * 입고 수량이 의심스러운 라운드 숫자인지. ≥100 + 100의 배수만 true.
 * 음수/NaN/소수는 false(안전).
 */
export function isSuspectReceivedQuantity(qty: number): boolean {
  if (!Number.isFinite(qty)) return false;
  if (!Number.isInteger(qty)) return false;
  if (qty < SUSPECT_MIN_QTY) return false;
  return qty % SUSPECT_ROUND_UNIT === 0;
}

/**
 * 재고 목록에서 의심 건수 집계(currentQuantity 기준).
 * 0 이면 배너 미노출 트리거.
 */
export function countSuspectInventories(
  inventories: Array<{ currentQuantity?: number | null }>,
): number {
  let count = 0;
  for (const inv of inventories) {
    const q = inv.currentQuantity;
    if (typeof q === "number" && isSuspectReceivedQuantity(q)) count++;
  }
  return count;
}
