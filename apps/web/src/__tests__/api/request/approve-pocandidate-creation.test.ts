/**
 * §pocandidate-creation-flow Phase 1 — approve 라우트 동적 계약 (RED → P3 GREEN).
 *
 * 계약:
 *   W1 [차단 보완 — §pocandidate-root-fix 누락 지점]: approve 변환 fetch 는
 *      3중 필터(quoteId + 승인통과집합 + stage) — 승인 안 된/타 quote candidate
 *      가 변환에 들어오지 않는다. (구 where {userId, organizationId} → RED)
 *   W2 [생성]: 해당 quote candidate 0건 + items>0 → candidate 자동 생성
 *      (quoteId 결속·in_app_approved) 후 vendor-aware 변환 — Order.poCandidateId
 *      = 생성 candidate id. (구: legacy 1 NULL Order → RED)
 *   W3 [멱등]: 해당 quote 에 통과 candidate 존재 → 생성 0·그 candidate 만 변환.
 *   W4 [items 0 보존]: quote.items 0 → 생성 0 + legacy fallback 유지 (기존 동작).
 *
 * 관측 방식: fake tx 가 where 를 실제 적용(형태 비종속 — root-fix 패턴 승계),
 *   order.create 의 poCandidateId 집합 + pOCandidate.create 호출을 관측.
 * 커버리지 경계: 결재 흐름 자체(권한·예산·알림)는 기존 스위트 몫 — 여기선
 *   전부 통과 상태로 고정하고 변환 블록만 관측.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockJsonResponse } from "@/__tests__/helpers/response-mock";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => mockJsonResponse(data, init),
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    purchaseRequest: { findUnique: vi.fn() },
    // §purchase-request-org-axis (나)-1b — 승인 게이트가 TeamMember 에서
    //   OrganizationMember 로 옮겼다. teamMember 는 이 라우트에서 더 이상 조회되지
    //   않으므로 mock 에서도 제거한다(남겨 두면 "쓰이는 줄" 착시가 생긴다).
    //   findFirst → findUnique 로 바뀐 것도 함께 반영 — 역할과 한도를 **같은 행**에서
    //   읽어야 두 판정이 다른 행을 보지 않는다.
    organizationMember: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/security/server-enforcement-middleware", () => ({
  enforceAction: () => ({
    allowed: true, correlationId: "corr_apv", actorContext: {} as unknown,
    authResult: { permitted: true } as unknown,
    deny: () => mockJsonResponse({ error: "forbidden" }, { status: 403 }),
    complete: vi.fn(), fail: vi.fn(),
  }),
}));
vi.mock("@/lib/security/approval-limit-guard", () => ({
  checkApprovalLimit: () => ({ allowed: true }),
}));
vi.mock("@/lib/budget/category-budget-gate", () => ({
  validateCategoryBudgetInTransaction: vi.fn(async () => ({ allowed: true, warnings: [], auditEvent: { decisions: [] } })),
  resolvePeriodYearMonth: () => "2026-08",
}));
vi.mock("@/lib/budget/budget-concurrency", () => ({
  withSerializableBudgetTx: vi.fn(),
  BudgetBlockedError: class BudgetBlockedError extends Error {},
  buildBudgetEventKey: () => "bek",
  recordBudgetEventIdempotent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/audit/durable-mutation-audit", () => ({
  recordMutationAudit: vi.fn(async () => undefined),
  buildAuditEventKey: () => "aek",
}));
vi.mock("@/lib/audit/audit-logger", () => ({
  createAuditLog: vi.fn(async () => undefined),
  auditRequestMeta: () => ({}),
}));
vi.mock("@/lib/api/order-number", () => ({ generateOrderNumber: (id: string) => `ORD-${id}` }));
vi.mock("@/lib/email/sender", () => ({ sendEmail: vi.fn(async () => undefined) }));
vi.mock("@/lib/email/templates", () => ({
  generatePurchaseApprovedEmail: () => ({ subject: "s", html: "h" }),
}));
vi.mock("@/lib/notifications", () => ({ dispatchNotificationEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/notifications/push-sender", () => ({ sendPushNotification: vi.fn(async () => undefined) }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { withSerializableBudgetTx } from "@/lib/budget/budget-concurrency";
import { POST } from "@/app/api/request/[id]/approve/route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockDb = db as unknown as Record<string, { [k: string]: ReturnType<typeof vi.fn> }>;
const mockTxWrapper = withSerializableBudgetTx as unknown as ReturnType<typeof vi.fn>;

const PR = {
  id: "pr-1",
  status: "PENDING",
  requesterId: "u-1",
  organizationId: null,
  teamId: null,
  quoteId: "q-1",
  totalAmount: 4500,
  message: null,
  team: null,
  requester: { email: null, name: null },
  quote: { id: "q-1" },
};

const QUOTE = {
  id: "q-1",
  totalAmount: 5000,
  selectedReplyId: "r-1",
  items: [
    { productId: "p-1", name: "FBS", brand: null, catalogNumber: "C-1", quantity: 2, unitPrice: 1000, lineTotal: 2000, leadTime: null, notes: null },
  ],
};

interface TxObservation {
  createdPoc: Array<string | null | undefined>;
  candidateCreates: any[];
}

/** where 를 실제 적용하는 fake tx — 구현 형태 비종속 (root-fix 패턴 승계) */
function makeTx(pool: any[], quote: any, responseItems: any[] = []): { tx: any; obs: TxObservation } {
  const obs: TxObservation = { createdPoc: [], candidateCreates: [] };
  const applyWhere = (where: Record<string, unknown>) =>
    pool.filter((c: any) => {
      if (where.userId !== undefined && c.userId !== where.userId) return false;
      if (where.organizationId !== undefined && c.organizationId !== where.organizationId) return false;
      if (where.quoteId !== undefined && c.quoteId !== where.quoteId) return false;
      if (where.stage !== undefined && c.stage !== where.stage) return false;
      const ap = where.approvalStatus as { in?: string[] } | string | undefined;
      if (ap && typeof ap === "object" && Array.isArray(ap.in) && !ap.in.includes(c.approvalStatus)) return false;
      if (ap && typeof ap === "string" && c.approvalStatus !== ap) return false;
      return true;
    });
  const tx = {
    purchaseRequest: { update: vi.fn(async () => ({ id: "pr-1", status: "APPROVED" })) },
    quote: { findUnique: vi.fn(async () => quote) },
    quoteReply: { findUnique: vi.fn(async () => ({ vendorName: "Thermo Fisher" })) },
    // §quote-item-vendor-selection P4 — 선택 vendorRequest 역참조 소스
    quoteVendorRequest: {
      findMany: vi.fn(async ({ where }: any) =>
        (where?.id?.in ?? []).map((id: string) => ({ id, vendorName: `Vendor-${id}` }))),
    },
    // §pocandidate-vendor-split — 품목별 응답 vendor 조립 소스 (기본 [] = 분할 근거 없음)
    quoteVendorResponseItem: {
      findMany: vi.fn(async ({ where }: any) =>
        responseItems.filter((r: any) => (where?.quoteItemId?.in ?? []).includes(r.quoteItemId))),
    },
    pOCandidate: {
      findMany: vi.fn(async ({ where }: any) => applyWhere(where)),
      create: vi.fn(async ({ data }: any) => {
        obs.candidateCreates.push(data);
        return {
          // §pocandidate-vendor-split — N개 생성 관측 위해 유니크 id (고정 id 는 W5 에서 충돌)
          id: `poc-new-${obs.candidateCreates.length}`, ...data, expectedDelivery: null, selectionReason: null,
          createdAt: new Date("2026-08-04T00:00:00Z"), updatedAt: new Date("2026-08-04T00:00:00Z"),
          items: (data.items?.create ?? []).map((i: any) => ({ ...i })),
        };
      }),
    },
    vendor: { findFirst: vi.fn(async ({ where }: any) => (where.name ? { id: `vid-${where.name}` } : null)) },
    order: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => {
        obs.createdPoc.push(data.poCandidateId);
        return { id: `o-${obs.createdPoc.length}`, ...data };
      }),
      update: vi.fn(async () => ({})),
      findUnique: vi.fn(async ({ where }: any) => ({ id: where.id, items: [] })),
    },
    orderItem: { createMany: vi.fn(async () => ({ count: 0 })) },
  };
  return { tx, obs };
}

function wireTx(tx: any) {
  mockTxWrapper.mockImplementation(async (_db: unknown, cb: (t: unknown) => Promise<unknown>) => cb(tx));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "approver-1", role: "ADMIN", email: "a@x.com", name: "A" } });
  mockDb.purchaseRequest.findUnique.mockResolvedValue(PR);
  // 승인권자 = 조직 ADMIN · 한도 무제한(null). A축(APPROVER·ADMIN·OWNER) 통과 조건.
  mockDb.organizationMember.findUnique.mockResolvedValue({ role: "ADMIN", approvalLimit: null });
});

async function callApprove() {
  return POST(
    { json: async () => ({}) } as never,
    { params: Promise.resolve({ id: "pr-1" }) } as never,
  );
}

describe("§pocandidate-creation-flow W1 — [차단 보완] approve 변환 3중 필터", () => {
  it("승인 안 된·타 quote candidate 는 변환되지 않는다 (구 무필터 → 둘 다 변환 → RED)", async () => {
    const pool = [
      { id: "poc-pending", userId: "u-1", organizationId: null, quoteId: "q-1", approvalStatus: "in_app_approval_pending", stage: "po_conversion_candidate", vendor: "V-A", totalAmount: 1000, expectedDelivery: null, items: [{ name: "a", catalogNumber: "c", quantity: 1, unitPrice: 1000, lineTotal: 1000 }] },
      { id: "poc-other-quote", userId: "u-1", organizationId: null, quoteId: "q-2", approvalStatus: "in_app_approved", stage: "po_conversion_candidate", vendor: "V-B", totalAmount: 2000, expectedDelivery: null, items: [{ name: "b", catalogNumber: "c", quantity: 1, unitPrice: 2000, lineTotal: 2000 }] },
    ];
    const { tx, obs } = makeTx(pool, QUOTE);
    wireTx(tx);

    const res = await callApprove();
    expect(res.status).toBe(200);
    expect(obs.createdPoc).not.toContain("poc-pending");
    expect(obs.createdPoc).not.toContain("poc-other-quote");
  });
});

describe("§pocandidate-creation-flow W2 — candidate 0건 시 자동 생성 + vendor-aware 변환", () => {
  it("생성 1회(quoteId·in_app_approved·vendor=selectedReply) + Order.poCandidateId=생성 id (구 legacy → RED)", async () => {
    const { tx, obs } = makeTx([], QUOTE);
    wireTx(tx);

    const res = await callApprove();
    expect(res.status).toBe(200);
    expect(obs.candidateCreates).toHaveLength(1);
    const data = obs.candidateCreates[0];
    expect(data.quoteId).toBe("q-1");
    expect(data.approvalStatus).toBe("in_app_approved");
    expect(data.vendor).toBe("Thermo Fisher");
    // 생성 candidate 가 vendor-aware 경로로 변환됨 (legacy NULL poCandidateId 아님)
    expect(obs.createdPoc).toEqual(["poc-new-1"]);
  });
});

describe("§pocandidate-creation-flow W3 — 멱등 (기존 candidate 존재 시 생성 0)", () => {
  it("해당 quote 통과 candidate 존재 → pOCandidate.create 미호출·그 candidate 만 변환", async () => {
    const pool = [
      { id: "poc-exist", userId: "u-1", organizationId: null, quoteId: "q-1", approvalStatus: "in_app_approved", stage: "po_conversion_candidate", vendor: "V-A", totalAmount: 1000, expectedDelivery: null, items: [{ name: "a", catalogNumber: "c", quantity: 1, unitPrice: 1000, lineTotal: 1000 }] },
    ];
    const { tx, obs } = makeTx(pool, QUOTE);
    wireTx(tx);

    const res = await callApprove();
    expect(res.status).toBe(200);
    expect(obs.candidateCreates).toHaveLength(0);
    expect(obs.createdPoc).toEqual(["poc-exist"]);
  });
});

describe("§pocandidate-creation-flow W4 — items 0 은 legacy 보존", () => {
  it("quote.items 0 → 생성 0 + legacy Order (poCandidateId 없음) — 기존 동작 유지", async () => {
    const { tx, obs } = makeTx([], { ...QUOTE, items: [] });
    wireTx(tx);

    const res = await callApprove();
    expect(res.status).toBe(200);
    expect(obs.candidateCreates).toHaveLength(0);
    expect(obs.createdPoc).toEqual([undefined]); // legacy order.create — poCandidateId 미기입
  });
});

describe("§pocandidate-vendor-split W5 — 유일-응답 분할 (approve 통합)", () => {
  it("2 vendor 유일-응답 → candidate 2개 생성(각 vendor)·둘 다 변환(poCandidateId 2종)", async () => {
    const quote = {
      ...QUOTE,
      items: [
        { ...QUOTE.items[0], id: "qi-1" },
        { ...QUOTE.items[0], id: "qi-2", name: "PBS" },
      ],
    };
    const { tx, obs } = makeTx([], quote, [
      { quoteItemId: "qi-1", vendorRequest: { vendorName: "VendorA" } },
      { quoteItemId: "qi-2", vendorRequest: { vendorName: "VendorB" } },
    ]);
    wireTx(tx);
    const res = await callApprove();
    expect(res.status).toBe(200);
    expect(obs.candidateCreates.length).toBe(2);
    expect(obs.candidateCreates.map((d: any) => d.vendor).sort()).toEqual(["VendorA", "VendorB"]);
    // 각 candidate 는 자기 품목만 (무손실 분할)
    expect(obs.candidateCreates.every((d: any) => (d.items?.create ?? []).length === 1)).toBe(true);
    // 둘 다 변환 풀 진입 — Order poCandidateId 2종
    expect(new Set(obs.createdPoc.filter(Boolean)).size).toBe(2);
  });

  it("다중 응답 품목은 자동 배정 0 — 잔여 '' candidate (selectedReply 승계는 잔여-단일일 때만)", async () => {
    const quote = {
      ...QUOTE,
      items: [
        { ...QUOTE.items[0], id: "qi-1" },
        { ...QUOTE.items[0], id: "qi-2", name: "PBS" },
      ],
    };
    const { tx, obs } = makeTx([], quote, [
      { quoteItemId: "qi-1", vendorRequest: { vendorName: "VendorA" } },
      { quoteItemId: "qi-2", vendorRequest: { vendorName: "VendorA" } },
      { quoteItemId: "qi-2", vendorRequest: { vendorName: "VendorB" } }, // qi-2 다중
    ]);
    wireTx(tx);
    const res = await callApprove();
    expect(res.status).toBe(200);
    expect(obs.candidateCreates.length).toBe(2);
    const vendors = obs.candidateCreates.map((d: any) => d.vendor).sort();
    expect(vendors).toEqual(["", "VendorA"]); // 다중 → "" (의사결정 대행 0)
  });
});

describe("§quote-item-vendor-selection W6 — approve 소비 계층 (선택 우선)", () => {
  it("선택 vendor 가 유일-응답 파생을 이긴다 (사용자 확정 > 시스템 파생)", async () => {
    const quote = {
      ...QUOTE,
      items: [{ ...QUOTE.items[0], id: "qi-1", selectedVendorRequestId: "vr-picked" }],
    };
    const { tx, obs } = makeTx([], quote, [
      { quoteItemId: "qi-1", vendorRequest: { vendorName: "AutoVendor" } }, // 유일-응답
    ]);
    wireTx(tx);
    const res = await callApprove();
    expect(res.status).toBe(200);
    expect(obs.candidateCreates.length).toBe(1);
    expect(obs.candidateCreates[0].vendor).toBe("Vendor-vr-picked"); // 선택 승
  });

  it("선택 없는 품목은 파생/잔여 폴백 — 혼재 시 각자 그룹 (회귀 0)", async () => {
    const quote = {
      ...QUOTE,
      items: [
        { ...QUOTE.items[0], id: "qi-1", selectedVendorRequestId: "vr-picked" },
        { ...QUOTE.items[0], id: "qi-2", name: "PBS", selectedVendorRequestId: null },
      ],
    };
    const { tx, obs } = makeTx([], quote, [
      { quoteItemId: "qi-2", vendorRequest: { vendorName: "AutoVendor" } },
    ]);
    wireTx(tx);
    const res = await callApprove();
    expect(res.status).toBe(200);
    const vendors = obs.candidateCreates.map((d: any) => d.vendor).sort();
    expect(vendors).toEqual(["AutoVendor", "Vendor-vr-picked"]);
  });

  it("선택 0건이면 vendorRequest 역참조 쿼리 자체를 하지 않는다 (불필요 쿼리 0)", async () => {
    const { tx } = makeTx([], QUOTE, []);
    wireTx(tx);
    await callApprove();
    expect(tx.quoteVendorRequest.findMany).not.toHaveBeenCalled();
  });
});
