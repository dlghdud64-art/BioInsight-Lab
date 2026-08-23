/**
 * §order-entry-rewire P1 — confirm 봉합 계약 (PLAN_order-entry-rewire)
 *
 * 이중 계상 창: 주문 예약(ORDER_RESERVED)이 활성인 채로 markQuoteAsPurchased 가
 * PurchaseRecord 를 만들면, 잔액식이 같은 금액을 지출(PurchaseRecord)과
 * 예약(활성 reserve) 양쪽으로 뺀다. 봉합 = 생성 지점에서 ORDER_CONFIRMED 기록.
 *
 * 2축 규율: 이 파일은 원장 축(순수 계약 + 소스 배선). 잔액 화면 축은 P4 실측.
 */
import { describe, it, expect, vi } from "vitest";
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

/* ─────────────────────────────────────────────────────────────────────────────
 * 다인 주문 축 — 활성 예약 2건 중 1건만 confirm (호영님 판정 2026-08-22)
 *
 * 배경: ac5a5ce7 이 confirm 행의 preCommitted/postCommitted 를 **주문 단위**에서
 * **예산 전역** 축으로 정정했다(release 경로와 동형). 단일 주문에서는 두 축이 같은
 * 값을 내므로 프로덕션 왕복 실측이 이 결함을 통과시킨다 — 활성 주문이 2건 이상일
 * 때만 갈린다. 프로덕션에 정상 흐름을 건너뛴 견적을 만드는 대신 계약으로 잠근다.
 *
 * 🛑 이 절에서 목(mock)이 하는 일과 하지 않는 일
 *   목이 하는 일   원장 **입력**을 공급한다 (ord_A·ord_B 두 예약이 같은 예산에 있다).
 *                  DB 없이 다인 상황을 만들기 위한 것뿐이다.
 *   목이 안 하는 일 pre/post 를 정의하지 않는다. 그 값은 markQuoteAsPurchased 의
 *                  실제 계산이 만들고, 아래 단언은 그 **산출물**을 본다.
 *                  목이 계약을 대신 정의하지 않도록 기대값을 목 밖에서 계산해 적는다.
 * ────────────────────────────────────────────────────────────────────────── */
const ORD_A = "ord_A";
const ORD_B = "ord_B";
const AMT = 850_000;
const BUD = { id: "bud_1", organizationId: "org_1", yearMonth: "2026-08" };

const createdEvents: any[] = [];

function makeTx() {
  const reserveOf = (orderId: string) => ({
    sourceEntityId: orderId,
    eventType: ORDER_RESERVED,
    amount: AMT,
    budgetId: BUD.id,
    organizationId: BUD.organizationId,
    yearMonth: BUD.yearMonth,
  });
  return {
    purchaseRecord: {
      findFirst: async () => null,
      createMany: async () => ({ count: 1 }),
    },
    quote: {
      findUnique: async () => ({
        id: "q_1",
        items: [{ id: "qi_1", productId: "p_1", quantity: 1, unitPrice: AMT, lineTotal: AMT, product: null }],
      }),
    },
    quoteVendorResponseItem: { findMany: async () => [] },
    productVendor: { findFirst: async () => null },
    order: { findMany: async () => [{ id: ORD_A }] },
    budgetEvent: {
      /* where 절을 **실제로 적용**한다. 호출 순서나 키의 유무로 분기하면 소스가
       * 조회 범위를 좁히는 회귀(전역 원장 → quote 주문 축)를 목이 통과시킨다 —
       * 실측으로 확인한 형태다(프로브 C). 목은 DB 를 흉내 내야지 의도를 짐작하면
       * 안 된다. 원장에는 A·B 두 예약이 같은 예산에 있다. */
      findMany: async (args: any) => {
        const w = args?.where ?? {};
        let rows = [reserveOf(ORD_A), reserveOf(ORD_B)];
        if (w.budgetId?.in) rows = rows.filter((r) => w.budgetId.in.includes(r.budgetId));
        else if (w.budgetId?.not === null) rows = rows.filter((r) => r.budgetId != null);
        if (w.sourceEntityId?.in) rows = rows.filter((r) => w.sourceEntityId.in.includes(r.sourceEntityId));
        if (w.eventType?.in) rows = rows.filter((r) => w.eventType.in.includes(r.eventType));
        return rows;
      },
      create: async ({ data }: any) => { createdEvents.push(data); return data; },
    },
  };
}

vi.mock("@/lib/db", () => ({
  db: { $transaction: async (fn: any) => fn((globalThis as any).__txMock) },
}));

describe("다인 주문 축 — 활성 예약 2건 중 1건 confirm (pre/post 는 예산 전역)", () => {
  it("confirm 행의 pre/post 가 예산 전역 활성분을 따른다 — 주문 축이면 결함", async () => {
    createdEvents.length = 0;
    (globalThis as any).__txMock = makeTx();
    const { markQuoteAsPurchased } = await import("@/app/api/quotes/[id]/markPurchased");
    await markQuoteAsPurchased({ quoteId: "q_1", scopeKey: "u_1" });

    const confirm = createdEvents.find((e) => e.eventType === ORDER_CONFIRMED);
    expect(confirm).toBeDefined();
    expect(confirm.sourceEntityId).toBe(ORD_A);
    expect(confirm.amount).toBe(AMT);

    /* 기대값은 목이 아니라 여기서 계산한다 — 예산 전역 활성분 = A + B */
    const budgetWideActive = AMT * 2;
    expect(confirm.preCommitted).toBe(budgetWideActive);          // 1,700,000
    expect(confirm.postCommitted).toBe(budgetWideActive - AMT);   // 850,000 (B 는 살아 있다)

    /* 🛑 결함 방향 명시 — 주문 축이었다면 850,000 → 0 이 나온다.
     * 그 값은 B 가 아직 예약 중인데 예산 커밋이 0 이라고 적는 것이라 원장이 거짓이 된다. */
    expect(confirm.postCommitted).not.toBe(0);
  });

  it("ord_B 는 건드리지 않는다 — confirm 은 1건뿐 (다른 주문 예약 갉기 금지)", async () => {
    createdEvents.length = 0;
    (globalThis as any).__txMock = makeTx();
    const { markQuoteAsPurchased } = await import("@/app/api/quotes/[id]/markPurchased");
    await markQuoteAsPurchased({ quoteId: "q_1", scopeKey: "u_1" });

    const confirms = createdEvents.filter((e) => e.eventType === ORDER_CONFIRMED);
    expect(confirms).toHaveLength(1);
    expect(confirms.map((e) => e.sourceEntityId)).toEqual([ORD_A]);
  });
});
