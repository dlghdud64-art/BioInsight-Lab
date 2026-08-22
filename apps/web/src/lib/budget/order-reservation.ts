/**
 * §order-budget-reservation P1 — 발주 예약 계약 스캐폴드 (PLAN_order-budget-reservation)
 *
 * 판정(호영님 2026-08-22): canonical 예산 = Budget · (나) 예약 도입.
 * 원장 = BudgetEvent. budgetEventKey 문법은 구매요청 경로의 기존 idempotency
 * 문법("org:source:type:seq")을 그대로 승계한다 — 새 문법을 만들지 않는다.
 *
 * ⚠️ P1 상태: 계약(시그니처·상수)만 확정. 구현은 P2 소관이며, 그 전까지
 * 모든 함수는 NOT_IMPLEMENTED 를 던져 RED 를 유지한다. placeholder success 금지.
 */

/** BudgetEvent.eventType — 발주 예약 수명주기 3종 */
export const ORDER_RESERVED = "order_reserved";
export const ORDER_RELEASED = "order_released";
export const ORDER_CONFIRMED = "order_confirmed";

export interface ReservationBudget {
  id: string;
  organizationId: string;
  /** Budget.amount — canonical 총액 */
  amount: number;
}

export interface ValidateReservationInput {
  budget: ReservationBudget;
  /** PurchaseRecord 합산 — 확정 지출 (canonical) */
  confirmedSpent: number;
  /** activeReservedAmount() 산출 — 활성 예약 합 */
  activeReserved: number;
  requested: number;
}

export type ReservationRejectReason = "INSUFFICIENT_BUDGET" | "INVALID_AMOUNT";

export interface ValidateReservationResult {
  ok: boolean;
  /** 통과 시: 예약 반영 후 잔액 (amount − confirmedSpent − activeReserved − requested) */
  remainingAfter?: number;
  reason?: ReservationRejectReason;
}

export interface BuildOrderEventInput {
  budget: ReservationBudget;
  orderId: string;
  amount: number;
  /** 같은 주문의 재시도 구분 — budgetEventKey 말단 */
  sequence: number;
}

/**
 * BudgetEvent 생성 페이로드 (예약 수명주기).
 * confirm 은 예약 소멸이지 지출 기록이 아니다 — 지출은 PurchaseRecord 가 든다.
 * 따라서 이 페이로드에 recordsSpending 같은 지출 축은 존재하지 않는다.
 */
export interface OrderBudgetEventPayload {
  eventType: string;
  budgetId: string;
  sourceEntityType: "order";
  sourceEntityId: string;
  budgetEventKey: string;
  amount: number;
}

/** 최소 이벤트 형상 — activeReservedAmount 입력 (DB 행/페이로드 겸용) */
export interface OrderEventLike {
  eventType: string;
  amount: number;
  sourceEntityId: string;
}

const NOT_IMPLEMENTED =
  "NOT_IMPLEMENTED — P2 구현 예정 (docs/plans/PLAN_order-budget-reservation.md)";

/** 잔액 판정: amount − confirmedSpent − activeReserved ≥ requested */
export function validateReservation(
  _input: ValidateReservationInput
): ValidateReservationResult {
  throw new Error(NOT_IMPLEMENTED);
}

export function buildReservationEvent(
  _input: BuildOrderEventInput
): OrderBudgetEventPayload {
  throw new Error(NOT_IMPLEMENTED);
}

export function buildReleaseEvent(
  _input: BuildOrderEventInput
): OrderBudgetEventPayload {
  throw new Error(NOT_IMPLEMENTED);
}

export function buildConfirmEvent(
  _input: BuildOrderEventInput
): OrderBudgetEventPayload {
  throw new Error(NOT_IMPLEMENTED);
}

/** 활성 예약 합: reserve − release − confirm, 주문별 독립, 하한 0 */
export function activeReservedAmount(_events: OrderEventLike[]): number {
  throw new Error(NOT_IMPLEMENTED);
}
