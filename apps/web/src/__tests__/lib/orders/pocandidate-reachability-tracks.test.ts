/**
 * §money-path-coverage-restore 도달가능성 조사 산출물 — POCandidate 3트랙 (E 패턴).
 *
 * ⚠️ 이 파일의 describe.skip 은 "안전 확인"이 아니라 "미측정 / 미구현" 표시다.
 *    skip 은 vitest 에서 GREEN 으로 집계되지만, 여기서의 GREEN 은 계약이
 *    지켜졌다는 뜻이 절대 아니다. 축 1·2 헤더의 커버리지 경계 주석과 같은 취지.
 *    (축 1 = convert-pocandidate-to-orders.behavior, 축 2 = orders-budget-deduction.behavior
 *     — 이 둘은 이미 동적으로 잠겨 있으므로 여기서 정적 sentinel 로 중복 잠그지 않는다.
 *     정적 sentinel 은 "결함 후보 구조"를 계약으로 굳혀 향후 수정을 막으므로 기각됨.)
 *
 * 이 셋은 5분류의 E — "계약 유효, 구현 부재". 계약은 라우트/스키마 자신의 주석이
 * 이미 선언했고 구현만 없다. 아래 각 트랙에 (a) 계약 문장+근거 인용, (b) 왜 skip,
 * (c) 재개 조건을 명시한다. 재개 = describe.skip → describe 로 승격.
 *
 * prod 실측 근거 (2026-08-04, 읽기전용 SELECT):
 *   Q1  유저 user-bioinsight-researcher candidate 3건 (누적 실재)
 *   Q1b stage 전부 po_conversion_candidate; approvalStatus = not_required×2, in_app_approval_pending×1
 *   Q2  poCandidateId 중복 Order 0행 (재적중 미발현)
 *   Q3  UserBudgetTransaction 0행 → 차감 divergence '미측정'(표본 0), 균형 확인 아님
 *   Q4  candidate vendor→Vendor master 매핑: Sigma-Aldrich=NULL, Thermo=vendor-thermo,
 *       VWR International=NULL → 같은 유저 NULL 2건 (null-vendor collapse 장전 확정)
 */
import { describe, it, expect, vi } from "vitest";
import { mockJsonResponse } from "@/__tests__/helpers/response-mock";

// audit/order-number 는 서비스 외곽 부수효과 — mutation 관측과 무관하므로 격리.
vi.mock("@/lib/audit/audit-logger", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/order-number", () => ({
  generateOrderNumber: vi.fn((id: string) => `ORD-${id}`),
}));
// Track 2(route) 전용 mock — Track 1·3 은 실제 서비스에 직접 tx 를 넘기므로 무영향.
vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => mockJsonResponse(data, init),
  },
}));
vi.mock("@/auth");
vi.mock("@/lib/db", () => ({
  db: { quote: { findMany: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock("@/lib/security/server-enforcement-middleware", () => ({
  enforceAction: () => ({
    allowed: true,
    correlationId: "corr_reachability_skip",
    actorContext: {} as unknown,
    authResult: { permitted: true } as unknown,
    deny: () => mockJsonResponse({ error: "forbidden" }, { status: 403 }),
    complete: vi.fn(),
    fail: vi.fn(),
  }),
}));

import { convertPOCandidatesToOrders } from "@/lib/orders/convert-pocandidate-to-orders";

// ────────────────────────────────────────────────────────────────────────────
// Track 1 — §pocandidate-null-vendor-collapse
// ────────────────────────────────────────────────────────────────────────────
//
// 계약: 서로 다른 POCandidate 는 각자 자기 Order 를 얻어야 하며 items 가 유실되면
//   안 된다. 근거 = convert-pocandidate-to-orders.ts L94-106 dup-guard 가 composite
//   (quoteId, vendorId) 로만 중복을 판정한다. Vendor master 에 없는 vendor 이름은
//   vendorId=NULL 로 떨어지므로(L84-91), 같은 quote 안에서 매핑 실패한 candidate 가
//   2개 이상이면 서비스가 둘째를 reason:"duplicate"(L58-62, 유일 값) 로 버린다.
//
// 왜 skip: prod Q4 에서 같은 유저 NULL 매핑 2건(Sigma-Aldrich·VWR)이 candidate 풀에
//   장전돼 있으나(2026-08-04), Q2=0 — 아직 변환이 안 돌아 실제 collapse Order 는 없다.
//   즉 '장전, 미발현'. 아래 테스트는 승격 시 현재 구현에서 RED 가 난다(=결함 실증).
//
// ⚠️ 재개 조건이 이미 충족됨: "Q4 같은 유저 NULL 2건 이상" (2026-08-04 확인).
//   추가 트리거 = skipped.reason 이 "duplicate" 외 값을 갖도록 타입이 확장되는 시점
//   (= 진짜 중복 vs null-collapse 를 구분하는 수정이 들어온 시점).
//   → skip→active 승격 여부는 호영님 결정 대기(승격 시 수정 전까지 suite RED).
describe.skip("§pocandidate-null-vendor-collapse [E: 계약 유효·구현 부재·장전]", () => {
  /** 같은 런에서 앞서 create 된 Order 를 findFirst 가 반영하는 tx (축1 mock 의 한계 보완). */
  function makeSameRunTx() {
    const orders: Array<{ id: string; quoteId: string; vendorId: string | null }> = [];
    return {
      // 모든 vendor 이름이 master 에 없음 → 전부 vendorId=null (Q4 의 Sigma-Aldrich·VWR 재현)
      vendor: { findFirst: vi.fn(async () => null) },
      order: {
        findFirst: vi.fn(async ({ where }: { where: { quoteId: string; vendorId: string | null } }) =>
          orders.find(
            (o) => o.quoteId === where.quoteId && o.vendorId === (where.vendorId ?? null),
          ) ?? null,
        ),
        create: vi.fn(async ({ data }: { data: { quoteId: string; vendorId: string | null } }) => {
          const o = { id: `order-${orders.length}`, quoteId: data.quoteId, vendorId: data.vendorId ?? null };
          orders.push(o);
          return o;
        }),
        update: vi.fn(async () => ({})),
      },
      orderItem: { createMany: vi.fn(async () => ({ count: 0 })) },
    };
  }

  it("매핑 실패 vendor 2건(같은 quote) → 각자 Order·items 유지 (현재는 둘째가 duplicate 로 유실)", async () => {
    const tx = makeSameRunTx();
    const candidates = [
      { id: "poc-sigma", vendor: "Sigma-Aldrich", items: [{ name: "S-1" }], totalAmount: 1000, expectedDelivery: null },
      { id: "poc-vwr", vendor: "VWR International", items: [{ name: "V-1" }], totalAmount: 2000, expectedDelivery: null },
    ] as unknown[];

    const res = await convertPOCandidatesToOrders(
      { quoteId: "q-1", userId: "u-1", organizationId: "org-1", candidates: candidates as never },
      { client: tx as never },
    );

    // 계약: 서로 다른 candidate 2건은 Order 2개. 현재 구현은 1개 + skip 1건(duplicate) → RED.
    expect(res.created).toHaveLength(2);
    expect(res.skipped).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Track 2 — §pocandidate-approval-filter-missing
// ────────────────────────────────────────────────────────────────────────────
//
// 계약: 변환 대상 POCandidate fetch 는 "결재 통과" + "해당 quote" 로 한정돼야 한다.
//   근거 = bulk-po route L191 주석 "quote 별 결재 통과 POCandidate[] fetch",
//   L198 "결재 통과 POCandidate fetch — quote.id 기반". 라우트 자신의 주석이 계약이다.
//   실제 쿼리 L199-202 는 where:{userId, organizationId} 뿐 — approvalStatus 도 quoteId 도 없다.
//
// 왜 skip: prod Q1b 에 in_app_approval_pending candidate 1건이 변환 대상 stage 풀에
//   quoteId 없이 존재(장전). 그 유저가 지금 변환하면 승인대기분이 딸려 발주된다.
//   Q2=0 이라 아직 미발현. 세 트랙 중 발현 위험 최상.
//
// 재개 조건: (a) 변환 쿼리에 approvalStatus 필터가 추가되는 시점, 또는
//           (b) prod Q2 가 1 rows 이상이 되는 시점(재적중 실발생).
describe.skip("§pocandidate-approval-filter-missing [E: 계약 유효·구현 부재·장전]", () => {
  it("bulk-po 변환 fetch 는 approvalStatus 로 한정해야 한다 (현재 where 에 부재 → RED)", async () => {
    const { auth } = await import("@/auth");
    const { db } = await import("@/lib/db");
    const { POST } = await import(
      "@/app/api/work-queue/purchase-conversion/bulk-po/route"
    );
    const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
    const mockDb = db as unknown as {
      quote: { findMany: ReturnType<typeof vi.fn> };
      $transaction: ReturnType<typeof vi.fn>;
    };

    mockAuth.mockResolvedValue({ user: { id: "u-1", role: "ADMIN" } });
    mockDb.quote.findMany.mockResolvedValue([
      {
        id: "q-1",
        userId: "u-1",
        organizationId: "org-1",
        currency: "KRW",
        totalAmount: null,
        selectedReplyId: "r-1",
        replies: [{ id: "r-1" }],
        items: [{ productId: "p", name: "N", quantity: 1, unitPrice: 1, lineTotal: 1, notes: null }],
        orders: [],
      },
    ]);

    // $transaction 콜백을 실제 실행 — candidate 0건 반환시켜 legacy 경로로 빠지되,
    // 그 전에 실행되는 pOCandidate.findMany 의 where 인자를 관측한다.
    const candidateFindMany = vi.fn(async () => []);
    mockDb.$transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          pOCandidate: { findMany: candidateFindMany },
          order: {
            create: vi.fn(async () => ({ id: "o-1" })),
            update: vi.fn(async () => ({})),
          },
        }),
    );

    await POST({ json: async () => ({ quoteIds: ["q-1"] }) } as never);

    // ⚠️ 이 assertion 은 where 의 '형태'를 본다. 승격 시점에 실제 수정 형태
    //    (직접 키 / AND 조립 / 상류 필터)에 맞춰 재기술할 것 — 형태 불일치로
    //    정당한 수정을 막으면 안 된다. 계약은 "승인 안 된 candidate 는 변환
    //    대상에 들어오지 않는다"이지 "where 에 approvalStatus 키가 있다"가 아니다.
    expect(candidateFindMany).toHaveBeenCalled();
    const whereArg = (candidateFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> })?.where ?? {};
    expect(whereArg).toHaveProperty("approvalStatus");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Track 3 — §budget-quote-candidate-amount-divergence  (⚠️ 미측정, 표본 0)
// ────────────────────────────────────────────────────────────────────────────
//
// 계약(M4): 예산에서 실제 차감된 금액은 그 발주로 생성된 Order 들의 합과 같아야 한다.
//   근거 = orders route L131 은 totalAmount 를 quote 기준(quote.totalAmount ?? Σ item.lineTotal)
//   으로 잡아 차감하는데(L233-239), 실제 Order 는 candidate 기준 금액으로 생성된다
//   (convert-pocandidate-to-orders.ts L110 = candidate.totalAmount pass-through).
//   두 값을 대조하는 코드가 없다.
//
// ⚠️ 왜 skip = 미측정(표본 0): prod UserBudgetTransaction 0행(Q3). 예산 차감 경로가
//   아직 데이터를 안 남겼다. 이 skip 은 '균형 확인'이 절대 아니다 — 측정할 표본이
//   없었을 뿐이고, 구조는 그대로라 예산 보유 유저의 첫 실발주 순간 첫 표본이 생긴다.
//
// 재개 조건: UserBudgetTransaction 에 행이 생기는 시점(첫 실발주). 그때 prod 재조회로
//   deducted vs Σ Order.totalAmount 를 대조하고, 이 계약을 동적 테스트로 승격한다.
describe.skip("§budget-quote-candidate-amount-divergence [E: 미측정·표본 0]", () => {
  // 이 계약은 서비스 단독으로 검증 불가 — 차감액(route L131·L233-239)과
  // 발주 합(service L110)이 서로 다른 레이어에 있다. 서비스에는 quote 기준
  // 차감액이 존재하지 않으므로, 지금 이 레이어에 형상을 박으면 측정이 아니라
  // 조작이다(리터럴 대조는 구현과 무관하게 결과가 고정됨). UBT 표본이 생긴 뒤
  // route+budget 통합 테스트로 작성한다.
  it.todo("차감액 == Σ Order.totalAmount — UBT 첫 표본 확보 후 통합 테스트로 작성");
});
