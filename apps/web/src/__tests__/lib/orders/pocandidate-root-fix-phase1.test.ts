/**
 * §pocandidate-root-fix Phase 1 신규 2갈래 — Phase 4 재기준: GREEN 회귀 가드.
 *
 * 이력 (보호 의도 보존): Phase 1 에서 RED 실증 → Phase 3 로직으로 GREEN 전환.
 * 증상4 (multi-quote 반복 변환): 구 변환 풀 fetch 가 quoteId 로 한정되지 않아
 *   (구 where={userId, organizationId}) quote 마다 같은 candidate 를 전량 변환 →
 *   poCandidateId 가 2개 Order 에 붙었다. 현행: where 에 quoteId: q.id 포함(3중 필터).
 * empty-items: 구 createPOCandidate 는 items:[] 통과(길이 검증 없음).
 *   현행: 입구 throw 가드 + 변환부 skip(reason "empty_items") 이중 방어.
 * 이 둘이 깨지면 결함 재유입이다.
 *
 * 커버리지 경계:
 *   - 증상4 fake findMany 는 where 를 실제 적용(quoteId 필터가 들어오면 honor) — 수정 형태 비종속.
 *   - empty-items 는 db.pOCandidate.create 레이어 mock. serializeCandidate 출력 형태는 검증 대상 아님.
 *   - 커버 안 함: 실제 prod 생성 흐름(부재), 예산 차감 정합(Track 3, it.todo 유지).
 */
import { describe, it, expect, vi } from "vitest";
import { mockJsonResponse } from "@/__tests__/helpers/response-mock";

vi.mock("@/lib/audit/audit-logger", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/api/order-number", () => ({ generateOrderNumber: vi.fn((id: string) => `ORD-${id}`) }));
vi.mock("next/server", () => ({
  NextResponse: { json: (data: unknown, init?: { status?: number }) => mockJsonResponse(data, init) },
}));
vi.mock("@/auth");
vi.mock("@/lib/db", () => ({
  db: { quote: { findMany: vi.fn() }, $transaction: vi.fn(), pOCandidate: { create: vi.fn() } },
}));
vi.mock("@/lib/security/server-enforcement-middleware", () => ({
  enforceAction: () => ({
    allowed: true, correlationId: "corr_p1", actorContext: {} as unknown, authResult: { permitted: true } as unknown,
    deny: () => mockJsonResponse({ error: "forbidden" }, { status: 403 }),
    complete: vi.fn(), fail: vi.fn(),
  }),
}));

// ────────────────────────────────────────────────────────────────────────────
// 증상4 — multi-quote 반복 변환
// ────────────────────────────────────────────────────────────────────────────
describe("§pocandidate-root-fix 증상4 — multi-quote 반복 변환 [GREEN 회귀 가드 — Phase 3 해소]", () => {
  it("같은 candidate 는 quote 2건 bulk 에서도 총 1회만 변환돼야 한다 (quoteId 필터 제거 시 재유입 → RED)", async () => {
    const { auth } = await import("@/auth");
    const { db } = await import("@/lib/db");
    const { POST } = await import("@/app/api/work-queue/purchase-conversion/bulk-po/route");
    const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
    const mockDb = db as unknown as {
      quote: { findMany: ReturnType<typeof vi.fn> };
      $transaction: ReturnType<typeof vi.fn>;
    };

    mockAuth.mockResolvedValue({ user: { id: "u-1", role: "ADMIN" } });
    const quote = (id: string) => ({
      id, userId: "u-1", organizationId: "org-1", currency: "KRW", totalAmount: null,
      selectedReplyId: `r-${id}`, replies: [{ id: `r-${id}` }],
      items: [{ productId: "p", name: "N", quantity: 1, unitPrice: 1, lineTotal: 1, notes: null }],
      orders: [],
    });
    mockDb.quote.findMany.mockResolvedValue([quote("q-1"), quote("q-2")]);

    // candidate 는 q-1 에 속함(quoteId=q-1). fake 는 where 를 적용 — 현행 route 의
    //   quoteId 필터가 q-2 루프에서 제외시킴(GREEN). 필터가 빠지면 2회 변환 → RED.
    const POOL = [
      { id: "poc-x", userId: "u-1", organizationId: "org-1", quoteId: "q-1", approvalStatus: "not_required", stage: "po_conversion_candidate", vendor: "V-A", totalAmount: 1000, expectedDelivery: null, items: [{ name: "a", catalogNumber: "c-a", quantity: 1, unitPrice: 1000, lineTotal: 1000 }] },
    ];
    const applyWhere = (where: Record<string, unknown>) =>
      POOL.filter((c: any) => {
        if (where.userId !== undefined && c.userId !== where.userId) return false;
        if (where.organizationId !== undefined && c.organizationId !== where.organizationId) return false;
        if (where.quoteId !== undefined && c.quoteId !== where.quoteId) return false;
        return true;
      });

    // order.findFirst 는 같은 런의 create 를 (quoteId, vendorId) 로 반영.
    const orders: { quoteId: string; vendorId: string | null }[] = [];
    const createdPoc: (string | null)[] = [];
    mockDb.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        pOCandidate: { findMany: vi.fn(async ({ where }: any) => applyWhere(where)) },
        vendor: { findFirst: vi.fn(async ({ where }: any) => ({ id: `vid-${where.name}` })) },
        order: {
          findFirst: vi.fn(async ({ where }: any) =>
            orders.find((o) => o.quoteId === where.quoteId && o.vendorId === (where.vendorId ?? null)) ?? null),
          create: vi.fn(async ({ data }: any) => {
            orders.push({ quoteId: data.quoteId, vendorId: data.vendorId ?? null });
            createdPoc.push(data.poCandidateId);
            return { id: `o-${orders.length}` };
          }),
          update: vi.fn(async () => ({})),
        },
        orderItem: { createMany: vi.fn(async () => ({ count: 0 })) },
      }),
    );

    await POST({ json: async () => ({ quoteIds: ["q-1", "q-2"] }) } as never);

    // 계약: poc-x 는 정확히 1회 변환. (구 구현: quote 무관 fetch → q-1·q-2 각각 변환 → 2회)
    const pocXCount = createdPoc.filter((p) => p === "poc-x").length;
    expect(pocXCount).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// empty-items — createPOCandidate 거부 계약
// ────────────────────────────────────────────────────────────────────────────
describe("§pocandidate-empty-items-order — createPOCandidate items:[] 거부 [GREEN 회귀 가드 — Phase 3 해소]", () => {
  it("items 가 빈 배열이면 candidate 생성을 거부해야 한다 (입구 가드 제거 시 재유입 → RED)", async () => {
    const { db } = await import("@/lib/db");
    const { createPOCandidate } = await import("@/lib/persistence/po-candidate-server");
    const mockCreate = (db as unknown as { pOCandidate: { create: ReturnType<typeof vi.fn> } }).pOCandidate.create;
    // 가드가 빠진 구현은 검증 없이 db.create 를 호출 → 성공 응답(resolve) → RED.
    //   serializeCandidate 가 createdAt/updatedAt.toISOString() 접근 → Date 필드 필수
    //   (누락 시 플러밍 TypeError 로 false-GREEN — 계약 아닌 이유로 reject 됨).
    const NOW = new Date("2026-08-04T00:00:00Z");
    mockCreate.mockResolvedValue({
      id: "poc-empty", userId: "u-1", organizationId: null, title: "t", vendor: "V", totalAmount: 0,
      expectedDelivery: null, selectionReason: null, blockers: [], approvalPolicy: "none",
      approvalStatus: "not_required", stage: "po_conversion_candidate", items: [],
      createdAt: NOW, updatedAt: NOW,
    });

    // 계약: items:[] 는 거부(throw/reject).
    await expect(
      createPOCandidate({ userId: "u-1", title: "t", vendor: "V", totalAmount: 0, items: [] }),
    ).rejects.toThrow();
  });
});
