/**
 * §order-budget-reservation P2 — 발주 예약 코어 (PLAN_order-budget-reservation)
 *
 * 판정(호영님 2026-08-22): canonical 예산 = Budget · (나) 예약 도입.
 * 원장 = BudgetEvent. budgetEventKey 문법은 구매요청 경로의 기존 idempotency
 * 문법("org:source:type:seq")을 그대로 승계한다 — 새 문법을 만들지 않는다.
 *
 * 순수 코어 — DB 접근 없음. 트랜잭션 배선은 P3 (/api/orders) 소관.
 * confirm 은 예약 소멸이지 지출 기록이 아니다 — 지출은 PurchaseRecord 가 든다
 * (이중 계상 금지 계약, __tests__/budget/order-reservation.test.ts).
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

/** 잔액 판정: amount − confirmedSpent − activeReserved ≥ requested */
export function validateReservation(
  input: ValidateReservationInput
): ValidateReservationResult {
  const { budget, confirmedSpent, activeReserved, requested } = input;
  if (!Number.isFinite(requested) || requested <= 0) {
    return { ok: false, reason: "INVALID_AMOUNT" };
  }
  const remaining = budget.amount - confirmedSpent - activeReserved;
  if (requested > remaining) {
    return { ok: false, reason: "INSUFFICIENT_BUDGET" };
  }
  return { ok: true, remainingAfter: remaining - requested };
}

/** 기존 idempotency 문법 승계: "org:source:type:seq" */
function orderBudgetEventKey(
  organizationId: string,
  orderId: string,
  eventType: string,
  sequence: number
): string {
  return `${organizationId}:${orderId}:${eventType}:${sequence}`;
}

function buildOrderEvent(
  eventType: string,
  { budget, orderId, amount, sequence }: BuildOrderEventInput
): OrderBudgetEventPayload {
  return {
    eventType,
    budgetId: budget.id,
    sourceEntityType: "order",
    sourceEntityId: orderId,
    budgetEventKey: orderBudgetEventKey(
      budget.organizationId,
      orderId,
      eventType,
      sequence
    ),
    amount,
  };
}

export function buildReservationEvent(
  input: BuildOrderEventInput
): OrderBudgetEventPayload {
  return buildOrderEvent(ORDER_RESERVED, input);
}

export function buildReleaseEvent(
  input: BuildOrderEventInput
): OrderBudgetEventPayload {
  return buildOrderEvent(ORDER_RELEASED, input);
}

export function buildConfirmEvent(
  input: BuildOrderEventInput
): OrderBudgetEventPayload {
  return buildOrderEvent(ORDER_CONFIRMED, input);
}

/**
 * 활성 예약 합: 주문별로 reserve − (release + confirm), 주문별 하한 0, 총합.
 * release/confirm 중복(재시도 등)이 다른 주문의 예약을 갉지 않도록
 * 반드시 주문 단위로 상쇄한 뒤 합산한다.
 */
export function activeReservedAmount(events: OrderEventLike[]): number {
  const perOrder = new Map<string, number>();
  for (const ev of events) {
    const cur = perOrder.get(ev.sourceEntityId) ?? 0;
    if (ev.eventType === ORDER_RESERVED) {
      perOrder.set(ev.sourceEntityId, cur + ev.amount);
    } else if (
      ev.eventType === ORDER_RELEASED ||
      ev.eventType === ORDER_CONFIRMED
    ) {
      perOrder.set(ev.sourceEntityId, cur - ev.amount);
    }
  }
  let total = 0;
  for (const v of perOrder.values()) {
    total += Math.max(0, v);
  }
  return total;
}
