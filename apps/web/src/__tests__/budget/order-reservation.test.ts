/**
 * §order-budget-reservation P1 — 예약 수명주기 계약 (PLAN_order-budget-reservation)
 *
 * 판정(호영님 2026-08-22): canonical 예산 = Budget · (나) 예약 도입.
 * 원장 = BudgetEvent (budgetId additive · 기존 idempotency 문법 재사용).
 *
 * 순수 코어를 검증한다 — DB 없이:
 *   validateReservation  잔액 판정 (amount − 확정지출 − 활성예약 ≥ 요청액)
 *   buildReservationEvent / buildReleaseEvent / buildConfirmEvent  이벤트 산출
 * 이중 계상 회귀: confirm 은 예약을 소멸시키고 지출은 PurchaseRecord 가 든다 —
 * 같은 금액이 예약과 확정에 동시에 남는 상태를 계약으로 금지한다.
 */
import { describe, it, expect } from "vitest";
import {
  validateReservation,
  buildReservationEvent,
  buildReleaseEvent,
  buildConfirmEvent,
  activeReservedAmount,
  ORDER_RESERVED,
  ORDER_RELEASED,
  ORDER_CONFIRMED,
} from "@/lib/budget/order-reservation";

const BUDGET = { id: "bud_1", organizationId: "org_1", amount: 5_000_000 };
const mkEvent = (type: string, amount: number, orderId = "ord_1") => ({
  eventType: type, amount, sourceEntityId: orderId, budgetId: "bud_1",
});

describe("validateReservation — 잔액 판정", () => {
  it("확정지출·활성예약을 뺀 잔액 안이면 통과", () => {
    const r = validateReservation({ budget: BUDGET, confirmedSpent: 850_000, activeReserved: 0, requested: 850_000 });
    expect(r.ok).toBe(true);
    expect(r.remainingAfter).toBe(3_300_000);
  });
  it("잔액 초과면 INSUFFICIENT — NO_BUDGET 이 아니다 (⑫ 오진 금지)", () => {
    const r = validateReservation({ budget: BUDGET, confirmedSpent: 4_900_000, activeReserved: 0, requested: 200_000 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("INSUFFICIENT_BUDGET");
  });
  it("활성 예약이 잔액을 갉는다 — 예약 무시 금지", () => {
    const r = validateReservation({ budget: BUDGET, confirmedSpent: 0, activeReserved: 4_900_000, requested: 200_000 });
    expect(r.ok).toBe(false);
  });
  it("요청액 0 이하는 거부", () => {
    expect(validateReservation({ budget: BUDGET, confirmedSpent: 0, activeReserved: 0, requested: 0 }).ok).toBe(false);
    expect(validateReservation({ budget: BUDGET, confirmedSpent: 0, activeReserved: 0, requested: -1 }).ok).toBe(false);
  });
});

describe("이벤트 산출 — BudgetEvent 문법 정합", () => {
  it("reserve — budgetEventKey 는 org:source:type:seq (기존 idempotency 문법)", () => {
    const ev = buildReservationEvent({ budget: BUDGET, orderId: "ord_1", amount: 850_000, sequence: 1 });
    expect(ev.eventType).toBe(ORDER_RESERVED);
    expect(ev.budgetId).toBe("bud_1");
    expect(ev.sourceEntityType).toBe("order");
    expect(ev.budgetEventKey).toBe("org_1:ord_1:" + ORDER_RESERVED + ":1");
    expect(ev.amount).toBe(850_000);
  });
  it("release — 같은 주문·같은 시퀀스면 키가 유형만 다르다 (중복 예약 차단과 별개)", () => {
    const ev = buildReleaseEvent({ budget: BUDGET, orderId: "ord_1", amount: 850_000, sequence: 1 });
    expect(ev.eventType).toBe(ORDER_RELEASED);
    expect(ev.budgetEventKey).toBe("org_1:ord_1:" + ORDER_RELEASED + ":1");
  });
  it("confirm — 예약 소멸 이벤트다. 지출 기록이 아니다 (지출은 PurchaseRecord 소관)", () => {
    const ev = buildConfirmEvent({ budget: BUDGET, orderId: "ord_1", amount: 850_000, sequence: 1 });
    expect(ev.eventType).toBe(ORDER_CONFIRMED);
    /* 🛑 confirm 이벤트가 지출을 이중으로 들면 안 된다 — 계약: recordsSpending 없음/false */
    expect((ev as unknown as Record<string, unknown>).recordsSpending ?? false).toBe(false);
  });
});

describe("activeReservedAmount — 활성 예약 합산", () => {
  it("reserve 만 있으면 그 합", () => {
    expect(activeReservedAmount([mkEvent(ORDER_RESERVED, 850_000)])).toBe(850_000);
  });
  it("release 는 상쇄한다", () => {
    expect(activeReservedAmount([
      mkEvent(ORDER_RESERVED, 850_000), mkEvent(ORDER_RELEASED, 850_000),
    ])).toBe(0);
  });
  it("confirm 도 예약을 소멸시킨다 — 이중 계상 회귀의 핵심", () => {
    expect(activeReservedAmount([
      mkEvent(ORDER_RESERVED, 850_000), mkEvent(ORDER_CONFIRMED, 850_000),
    ])).toBe(0);
  });
  it("서로 다른 주문은 독립", () => {
    expect(activeReservedAmount([
      mkEvent(ORDER_RESERVED, 850_000, "ord_1"), mkEvent(ORDER_RESERVED, 200_000, "ord_2"),
      mkEvent(ORDER_RELEASED, 850_000, "ord_1"),
    ])).toBe(200_000);
  });
  it("음수로 내려가지 않는다 — release 중복은 0 에서 멈춘다", () => {
    expect(activeReservedAmount([
      mkEvent(ORDER_RESERVED, 850_000), mkEvent(ORDER_RELEASED, 850_000), mkEvent(ORDER_RELEASED, 850_000),
    ])).toBe(0);
  });
});
