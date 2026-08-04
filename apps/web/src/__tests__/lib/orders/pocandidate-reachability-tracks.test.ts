/**
 * §money-path-coverage-restore 도달가능성 조사 산출물 — POCandidate 3트랙 (E 패턴).
 *
 * §pocandidate-root-fix Phase 4 재기준 (2026-08-04):
 *   Track 1·2 는 **active GREEN 회귀 가드**다. Phase 1 에서 describe.skip → describe
 *   승격 후 RED 실증 → Phase 3 로직(2단 dup-guard NULL 제외 / 변환 풀 3중 필터)으로
 *   GREEN 전환 완료. 이제 이 둘이 깨지면 결함 재유입이다 (계약 위반 = P1).
 *   Track 3 만 describe.skip 유지 — "미측정(표본 0)" 표시이며 안전 확인이 절대 아니다.
 *    (축 1 = convert-pocandidate-to-orders.behavior, 축 2 = orders-budget-deduction.behavior
 *     — 이 둘은 이미 동적으로 잠겨 있으므로 여기서 정적 sentinel 로 중복 잠그지 않는다.
 *     정적 sentinel 은 "결함 후보 구조"를 계약으로 굳혀 향후 수정을 막으므로 기각됨.)
 *
 * 원 분류는 5분류의 E — "계약 유효, 구현 부재". Track 1·2 는 §pocandidate-root-fix
 * Phase 3 (2026-08-04)로 구현이 채워져 E 를 졸업했다. 보호 의도는 보존한다 —
 * 각 트랙의 계약 문장·근거 인용은 삭제하지 않고 아래에 유지.
 *
 * prod 실측 근거 (2026-08-04, 읽기전용 SELECT — Phase 3 이전 상태 기록):
 *   Q1  유저 user-bioinsight-researcher candidate 3건 (누적 실재)
 *   Q1b stage 전부 po_conversion_candidate; approvalStatus = not_required×2, in_app_approval_pending×1
 *   Q2  poCandidateId 중복 Order 0행 (재적중 미발현)
 *   Q3  UserBudgetTransaction 0행 → 차감 divergence '미측정'(표본 0), 균형 확인 아님
 *   Q4  candidate vendor→Vendor master 매핑: Sigma-Aldrich=NULL, Thermo=vendor-thermo,
 *       VWR International=NULL → 같은 유저 NULL 2건 (당시 null-vendor collapse 장전 —
 *       Phase 3 에서 dup-guard NULL 제외로 해소, 이 파일 Track 1 이 회귀 가드)
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
//   안 된다.
//
// 이력 (보호 의도 보존): 구 dup-guard 가 composite (quoteId, vendorId) 로만 중복을
//   판정해, Vendor master 에 없는 vendor 이름이 vendorId=NULL 로 떨어지면 같은
//   quote 안 매핑 실패 candidate 2건 이상에서 둘째가 reason:"duplicate" 로 유실됐다.
//   prod Q4 (2026-08-04) 에서 같은 유저 NULL 매핑 2건(Sigma-Aldrich·VWR) 장전 실측.
//   Phase 1 승격 → RED 실증 완료.
//
// 현행 (GREEN, §pocandidate-root-fix Phase 3): dup-guard 2단 — 1차 poCandidateId
//   기반(reason "already_converted") + 2차 composite 는 vendorId non-NULL 한정
//   (reason "duplicate"). NULL 은 2차 제외 → 매핑 실패 candidate 각자 Order 획득.
//   이 테스트가 깨지면 collapse 재유입이다.
describe("§pocandidate-null-vendor-collapse [GREEN 회귀 가드 — Phase 3 해소]", () => {
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

  it("매핑 실패 vendor 2건(같은 quote) → 각자 Order·items 유지 (구 composite dup-guard 는 둘째 유실 — 재유입 차단)", async () => {
    const tx = makeSameRunTx();
    const candidates = [
      { id: "poc-sigma", vendor: "Sigma-Aldrich", items: [{ name: "S-1" }], totalAmount: 1000, expectedDelivery: null },
      { id: "poc-vwr", vendor: "VWR International", items: [{ name: "V-1" }], totalAmount: 2000, expectedDelivery: null },
    ] as unknown[];

    const res = await convertPOCandidatesToOrders(
      { quoteId: "q-1", userId: "u-1", organizationId: "org-1", candidates: candidates as never },
      { client: tx as never },
    );

    // 계약: 서로 다른 candidate 2건은 Order 2개, skip 0. (구 구현: 1개 + duplicate 1건)
    expect(res.created).toHaveLength(2);
    expect(res.skipped).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Track 2 — §pocandidate-approval-filter-missing
// ────────────────────────────────────────────────────────────────────────────
//
// 계약: 변환 대상 POCandidate fetch 는 "결재 통과" + "해당 quote" 로 한정돼야 한다.
//   근거 = bulk-po route 주석 "quote 별 결재 통과 POCandidate[] fetch" — 라우트
//   자신의 주석이 계약이다.
//
// 이력 (보호 의도 보존): 구 쿼리는 where:{userId, organizationId} 뿐 — approvalStatus
//   도 quoteId 도 없어, prod Q1b (2026-08-04) 의 in_app_approval_pending candidate
//   1건이 변환 풀에 장전돼 있었다(세 트랙 중 발현 위험 최상). Phase 1 승격 → RED 실증 완료.
//
// 현행 (GREEN, §pocandidate-root-fix Phase 3): 변환 풀 3중 필터 — quoteId: q.id +
//   approvalStatus IN {not_required, externally_approved, in_app_approved} +
//   stage: po_conversion_candidate. 이 테스트가 깨지면 승인 우회 발주 재유입이다.
//
// 관측 방식: where 형태가 아니라 결과를 본다. fake findMany 가 where 를 실제
//   적용하므로(구현이 approvalStatus 필터를 어떤 형태로 넣든 honor), 계약
//   "승인 안 된 candidate 는 변환 대상에 들어오지 않는다"를 직접 검증한다.
//   pending+approved 주입 → order.create 의 poCandidateId 집합에 pending 부재를 assert.
describe("§pocandidate-approval-filter-missing [GREEN 회귀 가드 — Phase 3 해소]", () => {
  it("승인 통과 집합만 변환 — pending candidate 는 Order 에 없어야 한다 (필터 제거 시 재유입 → RED)", async () => {
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

    // 변환 대상 candidate 풀 — 승인대기 1 + 승인완료 1.
    const POOL = [
      { id: "poc-pending", userId: "u-1", organizationId: "org-1", quoteId: "q-1", approvalStatus: "in_app_approval_pending", stage: "po_conversion_candidate", vendor: "V-A", totalAmount: 1000, expectedDelivery: null, items: [{ name: "a", catalogNumber: "c-a", quantity: 1, unitPrice: 1000, lineTotal: 1000 }] },
      { id: "poc-approved", userId: "u-1", organizationId: "org-1", quoteId: "q-1", approvalStatus: "in_app_approved", stage: "po_conversion_candidate", vendor: "V-B", totalAmount: 2000, expectedDelivery: null, items: [{ name: "b", catalogNumber: "c-b", quantity: 1, unitPrice: 2000, lineTotal: 2000 }] },
    ];
    // where 를 실제 적용하는 fake — route 가 어떤 필터 형태를 넣든 honor(구현 비종속).
    const applyWhere = (where: Record<string, unknown>) =>
      POOL.filter((c: any) => {
        if (where.userId !== undefined && c.userId !== where.userId) return false;
        if (where.organizationId !== undefined && c.organizationId !== where.organizationId) return false;
        if (where.quoteId !== undefined && c.quoteId !== where.quoteId) return false;
        const ap = where.approvalStatus as { in?: string[] } | string | undefined;
        if (ap && typeof ap === "object" && Array.isArray(ap.in) && !ap.in.includes(c.approvalStatus)) return false;
        if (ap && typeof ap === "string" && c.approvalStatus !== ap) return false;
        return true;
      });

    const createdPoc: (string | null)[] = [];
    mockDb.$transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          pOCandidate: { findMany: vi.fn(async ({ where }: any) => applyWhere(where)) },
          vendor: { findFirst: vi.fn(async ({ where }: any) => ({ id: `vid-${where.name}` })) },
          order: {
            findFirst: vi.fn(async () => null),
            create: vi.fn(async ({ data }: any) => { createdPoc.push(data.poCandidateId); return { id: `o-${data.poCandidateId}` }; }),
            update: vi.fn(async () => ({})),
          },
          orderItem: { createMany: vi.fn(async () => ({ count: 0 })) },
        }),
    );

    await POST({ json: async () => ({ quoteIds: ["q-1"] }) } as never);

    // 계약: 승인대기 candidate 는 Order 로 변환되면 안 된다. (구 구현: 필터 부재로 변환됨)
    expect(createdPoc).toContain("poc-approved"); // 승인분은 변환(정상)
    expect(createdPoc).not.toContain("poc-pending"); // 승인대기분은 제외
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
// 재개 조건 (§pocandidate-root-fix Phase 4 재기준): 구조 소거(금액 원천 candidate
//   통일)는 이 계획 범위 밖으로 유지됐고, quoteId 결속으로 대조 지점만 확보된 상태.
//   UserBudgetTransaction 에 행이 생기는 시점(첫 실발주)에 prod 재조회로
//   deducted vs Σ Order.totalAmount 를 대조하고, 이 계약을 동적 테스트로 승격한다.
//   승격은 그때까지 안 함 (재개 조건 미충족 유지 — 표본 0 은 균형 확인이 아니다).
describe.skip("§budget-quote-candidate-amount-divergence [E: 미측정·표본 0]", () => {
  // 이 계약은 서비스 단독으로 검증 불가 — 차감액(route L131·L233-239)과
  // 발주 합(service L110)이 서로 다른 레이어에 있다. 서비스에는 quote 기준
  // 차감액이 존재하지 않으므로, 지금 이 레이어에 형상을 박으면 측정이 아니라
  // 조작이다(리터럴 대조는 구현과 무관하게 결과가 고정됨). UBT 표본이 생긴 뒤
  // route+budget 통합 테스트로 작성한다.
  it.todo(
    "차감액 == Σ Order.totalAmount — 구조 소거(금액 원천 candidate 통일) 후 UBT 첫 표본 시 prod 대조, 통합 테스트로 승격",
  );
});
