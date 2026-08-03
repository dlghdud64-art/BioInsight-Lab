/**
 * §money-path-coverage-restore 축 2 — 예산 차감 정합 (동적 행동 검증).
 *
 * POST /api/orders 의 예산 차감 경로는 이 파일 이전까지 런타임 커버리지 0 이었다.
 * (api/orders/ 아래 기존 9개는 PDF·이메일·PATCH·dispatch 이고 order-id-patch 는
 *  readFileSync 정적 sentinel. bulk-po route.test [8] 은 $transaction 을 하드코딩
 *  배열로 스텁해 콜백이 실행되지 않는다.) 이 파일은 $transaction 콜백을 실제
 *  실행시켜 mutation 호출을 관측한다.
 *
 * 계약 (근거 = route 소스 인용. 구현 역산 아님):
 *   M1 대칭   — L236-237 `usedAmount {increment: totalAmount}` /
 *               `remainingAmount {decrement: totalAmount}` 가 같은 값을 쓴다.
 *               → 증가분 == 감소분.
 *   M2 단일차감 — L164-165 주석 "`order` 변수는 첫 Order … 후속 budget 차감 정합".
 *               → 발주 1회당 userBudget.update 1회, userBudgetTransaction.create
 *                 1회. vendor-split 로 Order 가 N개 생겨도 차감 횟수는 1회.
 *   M3 장부정합 — L246-247 `balanceBefore = budget.remainingAmount`,
 *               `balanceAfter = updatedBudget.remainingAmount` + L255-259.
 *               → 장부 amount == 실제 차감액, balanceAfter == balanceBefore - amount.
 *
 * ⚠️ 범위 밖 (이 파일이 커버하지 않음):
 *   차감액 `totalAmount` 의 **출처**. L131 은 quote 기준(`quote.totalAmount ||
 *   Σ quote.items.lineTotal`)이고 L166-184 는 candidate 기준으로 Order 를 만든다.
 *   두 기준을 대조하는 코드가 없다 → §budget-quote-candidate-amount-divergence.
 *   그 divergence 가 미해결이므로 "차감액 == Σ Order.totalAmount"(M4)는 여기 쓰지
 *   않는다. 쓰면 갈라진 구현 중 한쪽을 계약으로 굳히는 것이 된다.
 *
 * 스코핑 규칙: **관계식은 잠그고, 값의 출처는 잠그지 않는다.**
 *   M1·M3 는 totalAmount 가 무엇이어야 하는지 말하지 않고 그 값이 어떻게
 *   전파되는지만 말한다. M2 는 횟수만 말한다. 금액 비교는 관계식 형태로만 등장.
 *
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
// 검증됨. 여기서는 "Order N개가 생겨도 차감은 1회"(M2)만 보므로 결과만 주입.
vi.mock("@/lib/orders/convert-pocandidate-to-orders", () => ({
  convertPOCandidatesToOrders: vi.fn(),
}));

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { convertPOCandidatesToOrders } from "@/lib/orders/convert-pocandidate-to-orders";
import { POST } from "@/app/api/orders/route";

const mockDb = db as unknown as {
  teamMember: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockConvert = convertPOCandidatesToOrders as unknown as ReturnType<typeof vi.fn>;

const OWNER_ID = "user-owner";
const ORG_ID = "org-1";
const BUDGET_ID = "budget-1";
/** 차감 전 잔액. M3 의 balanceBefore 기준점. */
const REMAINING_BEFORE = 1_000_000;
const USED_BEFORE = 0;

/**
 * tx mock. userBudget.update 는 **받은 인자로부터** 결과를 계산한다 —
 * 상수를 반환하면 라우트의 산술이 아니라 mock 의 산술을 검증하게 된다.
 */
function makeTx(opts: { candidates?: any[] } = {}) {
  const budgetRow = {
    id: BUDGET_ID,
    name: "2026 연구비",
    userId: OWNER_ID,
    isActive: true,
    totalAmount: REMAINING_BEFORE,
    usedAmount: USED_BEFORE,
    remainingAmount: REMAINING_BEFORE,
  };
  return {
    quote: {
      findUnique: vi.fn(async () => ({
        id: "q-1",
        userId: OWNER_ID,
        organizationId: ORG_ID,
        title: "테스트 견적",
        status: "COMPLETED",
        totalAmount: 250_000,
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
    userBudget: {
      findUnique: vi.fn(async () => ({ ...budgetRow })),
      findFirst: vi.fn(async () => ({ ...budgetRow })),
      update: vi.fn(async ({ data }: any) => {
        const inc = data.usedAmount?.increment ?? 0;
        const dec = data.remainingAmount?.decrement ?? 0;
        return {
          ...budgetRow,
          usedAmount: budgetRow.usedAmount + inc,
          remainingAmount: budgetRow.remainingAmount - dec,
        };
      }),
    },
    userBudgetTransaction: { create: vi.fn(async () => ({})) },
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
function wire(opts: { candidates?: any[] } = {}) {
  const tx = makeTx(opts);
  mockDb.$transaction.mockImplementation(async (cb: any) => cb(tx));
  return tx;
}

const budgetUpdateData = (tx: ReturnType<typeof makeTx>) =>
  tx.userBudget.update.mock.calls[0][0].data;
const ledgerData = (tx: ReturnType<typeof makeTx>) =>
  tx.userBudgetTransaction.create.mock.calls[0][0].data;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: OWNER_ID, role: "ADMIN" } });
  mockDb.teamMember.findMany.mockResolvedValue([{ role: "ADMIN" }]);
});

describe("§money-path-coverage-restore 축2 — POST /api/orders 예산 차감 정합", () => {
  it("M1 — usedAmount 증가분 == remainingAmount 감소분 (차감 대칭)", async () => {
    const tx = wire();

    const res = await POST(makeRequest({ quoteId: "q-1" }) as any);
    expect(res.status ?? 200).toBe(200);

    // 하네스가 실제로 트랜잭션 콜백을 실행했는지 먼저 확인 —
    // 미실행이면 아래 관계식이 공허하게 통과한다.
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.userBudget.update).toHaveBeenCalled();

    const data = budgetUpdateData(tx);
    // 값의 출처는 보지 않는다. 두 방향이 같은 값인지만 본다.
    expect(data.usedAmount.increment).toBe(data.remainingAmount.decrement);
  });

  it("M2a — legacy 경로(candidate 0, Order 1개): 차감 1회 · 장부 1회", async () => {
    const tx = wire({ candidates: [] });

    await POST(makeRequest({ quoteId: "q-1" }) as any);

    expect(tx.order.create).toHaveBeenCalledTimes(1); // legacy fallback 진입 확인
    expect(tx.userBudget.update).toHaveBeenCalledTimes(1);
    expect(tx.userBudgetTransaction.create).toHaveBeenCalledTimes(1);
  });

  it("M2b — vendor-split(Order 3개)여도 차감은 1회 · 장부 1회", async () => {
    const tx = wire({
      candidates: [
        { id: "poc-a", vendor: "Vendor A", totalAmount: 100_000, items: [] },
        { id: "poc-b", vendor: "Vendor B", totalAmount: 100_000, items: [] },
        { id: "poc-c", vendor: "Vendor C", totalAmount: 100_000, items: [] },
      ],
    });
    mockConvert.mockResolvedValue({
      created: [
        { orderId: "order-a", orderNumber: "ORD-A", vendorId: "v-a", poCandidateId: "poc-a" },
        { orderId: "order-b", orderNumber: "ORD-B", vendorId: "v-b", poCandidateId: "poc-b" },
        { orderId: "order-c", orderNumber: "ORD-C", vendorId: "v-c", poCandidateId: "poc-c" },
      ],
      skipped: [],
    });

    await POST(makeRequest({ quoteId: "q-1" }) as any);

    expect(mockConvert).toHaveBeenCalledTimes(1);
    expect(tx.order.create).not.toHaveBeenCalled(); // legacy fallback 미진입
    // Order 는 3개지만 차감은 1회 (L164-165 주석이 선언한 설계).
    expect(tx.userBudget.update).toHaveBeenCalledTimes(1);
    expect(tx.userBudgetTransaction.create).toHaveBeenCalledTimes(1);
  });

  it("M3 — 장부 amount == 실제 차감액, balanceAfter == balanceBefore - amount", async () => {
    const tx = wire();

    await POST(makeRequest({ quoteId: "q-1" }) as any);

    const decrement = budgetUpdateData(tx).remainingAmount.decrement;
    const led = ledgerData(tx);

    expect(led.type).toBe("DEBIT");
    // 장부에 적힌 금액이 실제로 깎인 금액과 같은가 (출처는 묻지 않는다)
    expect(led.amount).toBe(decrement);
    // 차감 전 잔액을 읽었는가 (update 반환값이 아니라 사전 조회값)
    expect(led.balanceBefore).toBe(REMAINING_BEFORE);
    // 전후 정합
    expect(led.balanceAfter).toBe(led.balanceBefore - led.amount);
    expect(led.balanceAfter).toBe(REMAINING_BEFORE - decrement);
  });
});
