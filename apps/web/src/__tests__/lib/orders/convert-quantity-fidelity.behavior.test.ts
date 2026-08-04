/**
 * §money-path-coverage-restore 축 3 — 변환 수량 충실도 (동적 행동 검증).
 *
 * ⚠️ 얇은 계약이다. 부풀리지 말 것. N1·N2 는 convert-pocandidate-to-orders.ts 의
 *    assignment 두 줄(items.map, quantity: it.quantity)에 대한 회귀 가드일 뿐,
 *    축 1(vendor 분리 로직)·축 2(예산 산술)만큼의 두께가 없다. 그래도 쓰는 유일한
 *    이유: 나중에 누가 정규화/coercion(예: `Number(it.quantity) || 1`)을 끼워 넣을 때
 *    돈 경로의 수량이 말없이 바뀌는 것을 잡기 위해서다. 돈 경로에서 수량이 조용히
 *    바뀌는 건 금액이 조용히 바뀌는 것과 같다. 그 이상으로 읽지 말 것.
 *
 * 계약 (근거 = convert-pocandidate-to-orders.ts L133-143 items.map 1:1,
 *   schema POCandidateItem.quantity/OrderItem.quantity 각 `Int @default(1)`.
 *   서비스 구현 역산 아님):
 *   N1. 품목 건수 보존 — candidate items N개 → 그 Order 의 OrderItem N개.
 *       (축 1 C2 는 "어느 Order 에 들어가는가"[교차 오염]를 봤다. N1 은 "몇 개가
 *        들어가는가"[건수]다. 다른 축.)
 *   N2. 수량 무손실 — 각 OrderItem.quantity == 원본 POCandidateItem.quantity.
 *       (schema @default(1) 이 존재하므로, 서비스가 undefined 를 넘기면 수량 3짜리
 *        품목이 조용히 1이 된다 — 이 계약의 존재 이유.)
 *
 * 축 3 제외: N3 lineTotal == unitPrice × quantity. 스키마 L1939 주석이 선언한
 *   유일한 금액 계약이지만, 서비스는 재계산 없이 pass-through 한다(convert L141).
 *   서비스 레이어에서 assert 하면 fixture 에 넣은 값을 그대로 확인하는 꼴 —
 *   Track 3(§budget-quote-candidate-amount-divergence) 반려와 같은 이유.
 *   검증 위치는 lineTotal 이 계산되는 상류(견적/candidate 생성)이고 별도 축으로 미룸.
 *
 * 서비스·라우트 소스 무접촉. corrupt→RED 는 소스 임시 오염 후 원복(축 1 방식).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/audit/audit-logger", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/order-number", () => ({
  generateOrderNumber: vi.fn((id: string) => `ORD-${id}`),
}));

import { convertPOCandidatesToOrders } from "@/lib/orders/convert-pocandidate-to-orders";

/** vendor 이름 → id: "Vendor A" → "vendor-a". order.id = "order-<vendorId>". */
function makeTx() {
  return {
    vendor: {
      findFirst: vi.fn(async ({ where }: { where: { name: string } }) => ({
        id: String(where.name).trim().replace(/\s+/g, "-").toLowerCase(),
      })),
    },
    order: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: { vendorId: string | null } }) => ({
        id: `order-${data.vendorId}`,
      })),
      update: vi.fn(async () => ({})),
    },
    orderItem: { createMany: vi.fn(async () => ({ count: 0 })) },
  };
}

/** items 는 name+quantity 만 받아 나머지 필드를 채운다(수량 계약에 무관한 필드). */
function candidate(id: string, vendor: string, items: Array<{ name: string; quantity: number }>) {
  return {
    id,
    vendor,
    totalAmount: 1000,
    expectedDelivery: null,
    items: items.map((it) => ({
      name: it.name,
      catalogNumber: `C-${it.name}`,
      quantity: it.quantity,
      unitPrice: 100,
      lineTotal: 100 * it.quantity,
    })),
  } as unknown;
}

const PARAMS = (candidates: unknown[]) => ({
  quoteId: "q-1",
  userId: "u-1",
  organizationId: "org-1",
  candidates: candidates as never,
});

/** 첫 orderItem.createMany 호출의 data 배열. */
function createdItems(tx: ReturnType<typeof makeTx>): Array<{ name: string; quantity: number }> {
  const call = tx.orderItem.createMany.mock.calls[0];
  return (call?.[0] as { data: Array<{ name: string; quantity: number }> })?.data ?? [];
}

describe("§money-path-coverage-restore 축3 — convertPOCandidatesToOrders 수량 충실도", () => {
  it("N1 — candidate items 3개 → OrderItem 3개 (건수 보존)", async () => {
    const tx = makeTx();
    const candidates = [
      candidate("poc-a", "Vendor A", [
        { name: "A-1", quantity: 2 },
        { name: "A-2", quantity: 5 },
        { name: "A-3", quantity: 1 },
      ]),
    ];

    await convertPOCandidatesToOrders(PARAMS(candidates), { client: tx as never });

    // N1 — items.map 이 1:1 이면 createMany data 길이 == 원본 items 길이.
    expect(createdItems(tx)).toHaveLength(3);
  });

  it("N2 — 각 OrderItem.quantity == 원본 POCandidateItem.quantity (무손실, default 1 폴백 아님)", async () => {
    const tx = makeTx();
    const candidates = [
      candidate("poc-a", "Vendor A", [
        { name: "A-1", quantity: 3 },
        { name: "A-2", quantity: 7 },
      ]),
    ];

    await convertPOCandidatesToOrders(PARAMS(candidates), { client: tx as never });

    // N2 — 원본 수량(3, 7)이 그대로. 서비스가 undefined→default 1 로 떨구면 여기서 깨진다.
    const byName = Object.fromEntries(createdItems(tx).map((d) => [d.name, d.quantity]));
    expect(byName).toEqual({ "A-1": 3, "A-2": 7 });
  });
});
