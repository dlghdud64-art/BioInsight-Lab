/**
 * §order-entry-rewire P1 — confirm 봉합 계약 (PLAN_order-entry-rewire)
 *
 * 이중 계상 창: 주문 예약(ORDER_RESERVED)이 활성인 채로 markQuoteAsPurchased 가
 * PurchaseRecord 를 만들면, 잔액식이 같은 금액을 지출(PurchaseRecord)과
 * 예약(활성 reserve) 양쪽으로 뺀다. 봉합 = 생성 지점에서 ORDER_CONFIRMED 기록.
 *
 * 2축 규율: 이 파일은 원장 축(순수 계약 + 소스 배선). 잔액 화면 축은 P4 실측.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  validateReservation,
  buildConfirmEvent,
  activeReservedAmount,
  ORDER_RESERVED,
  ORDER_CONFIRMED,
} from "@/lib/budget/order-reservation";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const MARK = "src/app/api/quotes/[id]/markPurchased.ts";

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("원장 축 — confirm 이 예약을 소멸시켜 이중 계상이 성립하지 않는다 (순수)", () => {
  const BUDGET = { id: "bud_1", organizationId: "org_1", amount: 5_000_000 };

  it("reserved+confirmed 후 활성 예약 0 · 잔액식은 지출만 뺀다 (단일 차감)", () => {
    const events = [
      { eventType: ORDER_RESERVED, amount: 850_000, sourceEntityId: "ord_1" },
      { eventType: ORDER_CONFIRMED, amount: 850_000, sourceEntityId: "ord_1" },
    ];
    const activeReserved = activeReservedAmount(events);
    expect(activeReserved).toBe(0);
    /* 🛑 이중 계상이면 remaining 이 3,300,000 으로 내려간다 — 계약: 4,150,000 */
    const r = validateReservation({
      budget: BUDGET, confirmedSpent: 850_000, activeReserved, requested: 1,
    });
    expect(r.remainingAfter).toBe(5_000_000 - 850_000 - 1);
  });

  it("confirm 미기록(창 열림)이면 같은 금액이 두 번 빠진다 — 창의 존재 증명", () => {
    const events = [{ eventType: ORDER_RESERVED, amount: 850_000, sourceEntityId: "ord_1" }];
    const r = validateReservation({
      budget: BUDGET, confirmedSpent: 850_000,
      activeReserved: activeReservedAmount(events), requested: 1,
    });
    expect(r.remainingAfter).toBe(5_000_000 - 850_000 - 850_000 - 1);
  });

  it("confirm 이벤트 문법 — 키는 기존 idempotency 승계 · 중복 confirm 차단 축", () => {
    const ev = buildConfirmEvent({ budget: BUDGET, orderId: "ord_1", amount: 850_000, sequence: 1 });
    expect(ev.budgetEventKey).toBe("org_1:ord_1:" + ORDER_CONFIRMED + ":1");
  });
});

describe("배선 축 — markQuoteAsPurchased 가 confirm 을 기록한다 (P2 대상 · 현재 RED)", () => {
  it("예약 코어를 소비한다 — buildConfirmEvent import", () => {
    const src = read(MARK);
    expect(src).toMatch(/from "@\/lib\/budget\/order-reservation"/);
    expect(src).toMatch(/buildConfirmEvent\(/);
  });

  it("BudgetEvent 원장에 confirm 을 남긴다 — 같은 트랜잭션 안에서", () => {
    expect(read(MARK)).toMatch(/tx\.budgetEvent\.create/);
  });

  it("예약이 없으면 no-op — confirm 창작 금지 (주문 무관 구매 처리 보호)", () => {
    /* 활성 reserve 조회 후 분기해야 한다 — 무조건 create 금지 */
    expect(read(MARK)).toMatch(/ORDER_RESERVED/);
  });

  it("중복 confirm 은 budgetEventKey unique 로 멱등 — P2002 무시 분기", () => {
    expect(stripComments(read(MARK))).toMatch(/P2002/);
  });
});
