/**
 * §money-path-coverage-restore 축 2 — 발주 예산 정합 (동적 행동 검증).
 *
 * 🔴 2026-09-13 승계 — **명제는 그대로, 대상만 예약 축으로 옮긴다.**
 *   명제: "발주 1건당 예산이 한 번만 잡히고, 장부 금액이 그 값과 일치한다."
 *   2026-08-22 판정(⑪ · PLAN_order-budget-reservation P3)으로 canonical 이 바뀌었다:
 *     UserBudget.usedAmount 차감  →  Budget + BudgetEvent(ORDER_RESERVED) **예약**
 *   이 파일은 옛 축(userBudget mock)을 그대로 두고 있어 그날 이후 줄곧 RED 였고,
 *   기준선 RED 더미(§baseline-red-ledger 187건)에 묻혀 아무도 보지 않았다.
 *
 * 🛑 그 사이 **라우트 수준 예산 정합을 실행으로 지는 테스트가 0 이었다.**
 *   budget/order-reservation.test.ts       순수 코어(잔액 판정·이벤트 산출) · DB 무접촉
 *   budget/order-reservation-wiring.test.ts 정적 대조("코어를 소비한다" · "FOR UPDATE 로 직렬화")
 *   → 배선이 있다는 것은 잠갔지만 **몇 번 도는지·금액이 맞는지**는 아무도 재지 않았다.
 *   2026-08-22 ~ 2026-09-13, 약 3주간 돈 축 실행 커버리지 0.
 *
 * 계약 (근거 = route 소스 인용. 구현 역산 아님)
 *   M1  예약액   — L315-325 buildReservationEvent(...) → tx.budgetEvent.create.
 *                 기록 amount == 요청 총액(quote 기준 totalAmount).
 *   M1b 잔액식   — L198-230 amount − 확정지출(PurchaseRecord) − 활성예약(BudgetEvent).
 *                 활성 예약이 잔액을 갉으면 새 예약을 만들지 않는다(이중 예약 차단).
 *   M2a 단일예약 — legacy 경로(POCandidate 0 · Order 1) 에서 create 정확히 1회.
 *   M2b 단일예약 — **vendor-split 로 Order 가 3개여도 예약은 1회.**
 *                 이중 차감이 구조적으로 가능한 유일한 자리다(발주가 공급사별로 쪼개진다).
 *   M3  장부문법 — budgetEventKey = org:source:type:seq · eventType ORDER_RESERVED ·
 *                 budgetId 연결 · sourceEntityId = 주문 id.
 *
 * ⚠️ 범위 밖: 차감액 `totalAmount` 의 **출처**(quote 기준 vs candidate 기준).
 *   두 기준을 대조하는 코드가 없다 → §budget-quote-candidate-amount-divergence.
 *   그 divergence 가 미해결이므로 "예약액 == Σ Order.totalAmount" 는 여기 쓰지 않는다.
 *   쓰면 갈라진 구현 중 한쪽을 계약으로 굳히는 것이 된다.
 *
 * 스코핑 규칙: **관계식은 잠그고, 값의 출처는 잠그지 않는다.**
 * 라우트·서비스 소스 무접촉.
 */

import { mockJsonResponse } from "@/__tests__/helpers/response-mock";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) =>
      mockJsonResponse(data, init),
  },
}));

vi.mock("@/auth");

vi.mock("@/lib/db", () => ({
  db: {
    teamMember: { findMany: vi.fn() },
    // resolveBudgetPurchaseScopeKeys 가 전역 db 로 읽는다(조직 예산 → workspace 1:1).
    // 계약 밖 조회라 null. 있으면 그 id 가 확정지출 scopeKey 후보에 더해질 뿐이다.
    workspace: { findUnique: vi.fn(async () => null) },
    $transaction: vi.fn(),
  },
}));

const enforcementSpies = { complete: vi.fn(), fail: vi.fn() };
vi.mock("@/lib/security/server-enforcement-middleware", () => ({
  enforceAction: () => ({
    allowed: true,
    correlationId: "corr_orders_budget_test",
    actorContext: {} as unknown,
    authResult: { permitted: true } as unknown,
    deny: () => mockJsonResponse({ error: "forbidden" }, { status: 403 }),
    complete: enforcementSpies.complete,
    fail: enforcementSpies.fail,
  }),
}));

// ── 계약 밖 부수효과 격리 (mutation 관측과 무관) ──
vi.mock("@/lib/api/activity-logs", () => ({
  createActivityLogServer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/activity-log", () => ({
  createActivityLog: vi.fn().mockResolvedValue(undefined),
  getActorRole: vi.fn().mockResolvedValue("BUYER"),
}));
vi.mock("@/lib/audit", () => ({
  extractRequestMeta: () => ({ ipAddress: undefined, userAgent: undefined }),
}));
vi.mock("@/lib/operations/state-transition-logger", () => ({
  logStateTransition: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/orders/dispatch-readiness", () => ({
  buildOrderDispatchReadiness: () => ({}),
}));
vi.mock("@/lib/notifications", () => ({
  dispatchNotificationEvent: vi.fn().mockResolvedValue(undefined),
  resolveOrgRecipients: vi.fn().mockResolvedValue([]),
}));
// vendor-split 서비스는 축 1(convert-pocandidate-to-orders.behavior)에서 별도
// 검증됨. 여기서는 "Order N개가 생겨도 예약은 1회"(M2)만 보므로 결과만 주입.
vi.mock("@/lib/orders/convert-pocandidate-to-orders", () => ({
  convertPOCandidatesToOrders: vi.fn(),
}));

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { convertPOCandidatesToOrders } from "@/lib/orders/convert-pocandidate-to-orders";
import { POST } from "@/app/api/orders/route";
import { ORDER_RESERVED } from "@/lib/budget/order-reservation";

const mockDb = db as unknown as {
  teamMember: { findMany: ReturnType<typeof vi.fn> };
  workspace: { findUnique: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockConvert = convertPOCandidatesToOrders as unknown as ReturnType<typeof vi.fn>;

const OWNER_ID = "user-owner";
const ORG_ID = "org-1";
const BUDGET_ID = "budget-1";
/** 예산 총액. 요청 총액(250,000)보다 크게 둬서 M1·M2 는 잔액 판정에 걸리지 않는다. */
const BUDGET_AMOUNT = 1_000_000;
const QUOTE_TOTAL = 250_000;

/**
 * tx mock — 예약 축.
 *   budget.findFirst/findUnique  잔액 기준 행
 *   purchaseRecord.aggregate     확정 지출(창 안)
 *   budgetEvent.findMany/create  활성 예약 조회 · 예약 기록(관측 지점)
 * 🛑 create 결과를 상수로 만들지 않는다 — 받은 인자를 그대로 돌려줘야
 *    라우트의 산술이 아니라 mock 의 산술을 검증하는 사고를 피한다.
 */
function makeTx(opts: { candidates?: unknown[]; activeEvents?: unknown[]; spent?: number } = {}) {
  const budgetRow = {
    id: BUDGET_ID,
    name: "2026 연구비",
    organizationId: ORG_ID,
    workspaceId: null,
    scopeKey: `org-${ORG_ID}`,
    yearMonth: "2026-09",
    description: null,
    amount: BUDGET_AMOUNT,
    isActive: true,
  };
  return {
    quote: {
      findUnique: vi.fn(async () => ({
        id: "q-1",
        userId: OWNER_ID,
        organizationId: ORG_ID,
        title: "테스트 견적",
        status: "COMPLETED",
        totalAmount: QUOTE_TOTAL,
        orders: [],
        items: [
          { productId: "p-1", name: "FBS", brand: "B", catalogNumber: "C-1",
            quantity: 2, unitPrice: 100_000, lineTotal: 200_000, notes: null },
          { productId: "p-2", name: "Tips", brand: "B", catalogNumber: "C-2",
            quantity: 1, unitPrice: 50_000, lineTotal: 50_000, notes: null },
        ],
      })),
      update: vi.fn(async () => ({})),
    },
    pOCandidate: { findMany: vi.fn(async () => opts.candidates ?? []) },
    order: {
      create: vi.fn(async ({ data }: any) => ({
        id: "order-legacy",
        userId: OWNER_ID,
        organizationId: ORG_ID,
        orderNumber: data.orderNumber,
        totalAmount: data.totalAmount,
        items: [],
      })),
      findUnique: vi.fn(async ({ where }: any) => ({
        id: where.id,
        userId: OWNER_ID,
        organizationId: ORG_ID,
        orderNumber: "ORD-VENDOR-1",
        totalAmount: 100_000,
        items: [],
      })),
    },
    $executeRaw: vi.fn(async () => 1),
    budget: {
      findUnique: vi.fn(async () => ({ ...budgetRow })),
      findFirst: vi.fn(async () => ({ ...budgetRow })),
    },
    purchaseRecord: {
      aggregate: vi.fn(async () => ({ _sum: { amount: opts.spent ?? 0 } })),
    },
    budgetEvent: {
      findMany: vi.fn(async () => opts.activeEvents ?? []),
      create: vi.fn(async ({ data }: any) => ({ id: "bev-1", ...data })),
    },
  };
}

function makeRequest(body: unknown) {
  return {
    json: async () => body,
    url: "http://localhost/api/orders",
    headers: { get: () => null },
  } as unknown as Request;
}

/** tx 를 만들고 $transaction 이 콜백을 **실제 실행**하도록 연결. */
function wire(opts: { candidates?: unknown[]; activeEvents?: unknown[]; spent?: number } = {}) {
  const tx = makeTx(opts);
  mockDb.$transaction.mockImplementation(async (cb: any) => cb(tx));
  return tx;
}

const reservationData = (tx: ReturnType<typeof makeTx>) =>
  tx.budgetEvent.create.mock.calls[0][0].data;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: OWNER_ID, role: "ADMIN" } });
  mockDb.teamMember.findMany.mockResolvedValue([{ role: "ADMIN" }]);
  mockDb.workspace.findUnique.mockResolvedValue(null);
});

describe("§money-path-coverage-restore 축2 — POST /api/orders 예산 예약 정합", () => {
  it("M2b — vendor-split(Order 3개)여도 예약은 1회 (이중 차감 차단)", async () => {
    const tx = wire({
      candidates: [
        { id: "cand-1", vendorId: "v-1", items: [] },
        { id: "cand-2", vendorId: "v-2", items: [] },
        { id: "cand-3", vendorId: "v-3", items: [] },
      ],
    });
    mockConvert.mockResolvedValue({
      created: [
        { orderId: "order-v1", vendorId: "v-1" },
        { orderId: "order-v2", vendorId: "v-2" },
        { orderId: "order-v3", vendorId: "v-3" },
      ],
      skipped: [],
    });

    const res = await POST(makeRequest({ quoteId: "q-1" }) as any);

    expect(res.status ?? 200).toBe(200);
    expect(tx.budgetEvent.create).toHaveBeenCalledTimes(1);
  });

  it("M2a — legacy 경로(candidate 0 · Order 1)에서도 예약 1회", async () => {
    const tx = wire();

    const res = await POST(makeRequest({ quoteId: "q-1" }) as any);

    expect(res.status ?? 200).toBe(200);
    expect(tx.budgetEvent.create).toHaveBeenCalledTimes(1);
  });

  it("M1 — 예약 amount == 요청 총액", async () => {
    const tx = wire();

    await POST(makeRequest({ quoteId: "q-1" }) as any);

    expect(reservationData(tx).amount).toBe(QUOTE_TOTAL);
  });

  it("M1b — 활성 예약이 잔액을 갉는다 (초과면 새 예약 0회)", async () => {
    const tx = wire({
      activeEvents: [
        // 🛑 상수는 소문자다(ORDER_RESERVED = "order_reserved"). 대문자로 쓰면 이 이벤트가
        //   activeReservedAmount 에 안 잡혀 잔액이 가득 찬 것처럼 보이고, 단언이 조용히 무력해진다.
        { eventType: ORDER_RESERVED, amount: BUDGET_AMOUNT, sourceEntityId: "ord-prev" },
      ],
    });

    const res = await POST(makeRequest({ quoteId: "q-1" }) as any);

    // 🛑 두 단언은 중복이 아니다 — 하나만 두면 조용히 무력해진다(2026-09-12 실측).
    //   ① 만 두면: 다른 이유로 거부돼도 통과한다.
    //   ② 만 두면: 상수 대소문자 오염(ORDER_RESERVED 를 대문자로 씀)처럼 활성 예약이
    //      집계에 안 잡혀 예약이 **생겼는데도** create 가 0 이면 통과한다.
    expect(res.status ?? 200).not.toBe(200); // ① 요청이 거부된다
    expect(tx.budgetEvent.create).not.toHaveBeenCalled();
  });

  it("M3 — 장부 문법: ORDER_RESERVED · budgetId 연결 · key 는 org:source:type:seq", async () => {
    const tx = wire();

    await POST(makeRequest({ quoteId: "q-1" }) as any);

    const data = reservationData(tx);
    expect(data.eventType).toBe("order_reserved"); // 리터럴이 정본 — DB 에 저장되는 값이다
    expect(data.eventType).toBe(ORDER_RESERVED); // 심볼 병기 — 상수가 바뀌면 여기서 갈린다
    expect(data.budgetId).toBe(BUDGET_ID);
    expect(String(data.budgetEventKey).split(":")).toHaveLength(4);
    expect(String(data.budgetEventKey)).toContain("order_reserved");
  });
});
