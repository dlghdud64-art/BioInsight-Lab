/**
 * §11.203 #quote-request-submit-failure — Phase 2 RED test
 *
 * /app/search → /api/quotes POST 의 contract 검증.
 * snapshot-only 견적 (search/catalog ref 가 DB Product 와 매칭 안 됨) 도
 * 500 대신 정상 처리되도록 강제. legacy productIds path 는 호환성 유지.
 *
 * lock §11.142 호환:
 *   - canonical truth (Quote / QuoteListItem) 보호 (snapshot path 만 추가, schema 변경 0)
 *   - dead button / fake success 금지 — UI 는 실제 API 결과 후만 handoff
 *   - structured 400 fallback (raw 500 stack trace 노출 0)
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
vi.mock("@/lib/auth/mobile-jwt", () => ({
  getAuthUser: vi.fn(),
}));

// db: organizationMember + organization + productVendor + quoteShare 만 사용
// (createQuote 자체는 mock 하므로 quote.create / quoteListItem.create 는 무관)
vi.mock("@/lib/db", () => ({
  db: {
    organizationMember: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    productVendor: { findMany: vi.fn() },
    quoteShare: { create: vi.fn() },
    quote: { create: vi.fn(), findMany: vi.fn() },
  },
  isPrismaAvailable: () => true,
}));

const enforcementSpies = {
  complete: vi.fn(),
  fail: vi.fn(),
};
vi.mock("@/lib/security/server-enforcement-middleware", () => ({
  enforceAction: () => ({
    allowed: true,
    correlationId: "corr_test",
    actorContext: {} as unknown,
    authResult: { permitted: true } as unknown,
    deny: () => mockJsonResponse({ error: "forbidden" }, { status: 403 }),
    complete: enforcementSpies.complete,
    fail: enforcementSpies.fail,
  }),
}));

// createQuote 를 mock — route 가 어떤 형태로 호출하는지 검증.
const createQuoteMock = vi.fn();
vi.mock("@/lib/api/quotes", () => ({
  createQuote: (...args: unknown[]) => createQuoteMock(...args),
}));

// silent side effects
vi.mock("@/lib/email", () => ({
  sendQuoteConfirmationToUser: vi.fn().mockResolvedValue(undefined),
  sendQuoteNotificationToVendors: vi.fn().mockResolvedValue(undefined),
  sendQuoteReceivedEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/activity-logs", () => ({
  createActivityLogServer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/share-token", () => ({
  generateShareToken: () => "token_test",
}));
vi.mock("@prisma/client", () => ({
  ActivityType: { QUOTE_CREATED: "QUOTE_CREATED" },
}));

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { POST } from "@/app/api/quotes/route";

const mockDb = db as unknown as {
  organizationMember: { findFirst: ReturnType<typeof vi.fn> };
  organization: { findUnique: ReturnType<typeof vi.fn> };
  productVendor: { findMany: ReturnType<typeof vi.fn> };
  quoteShare: { create: ReturnType<typeof vi.fn> };
};
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const USER_ID = "user-test-1";

function makeRequest(body: unknown): Request {
  return {
    json: async () => body,
    headers: {
      get: (_: string) => null,
    },
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  enforcementSpies.complete.mockReset();
  enforcementSpies.fail.mockReset();
  createQuoteMock.mockReset();
  mockAuth.mockResolvedValue({
    user: { id: USER_ID, email: "u@test", name: "테스트", role: "USER" },
  });
  mockDb.organizationMember.findFirst.mockResolvedValue(null);
  mockDb.organization.findUnique.mockResolvedValue(null);
  mockDb.productVendor.findMany.mockResolvedValue([]);
  mockDb.quoteShare.create.mockResolvedValue({ shareToken: "token_test" });
});

describe("§11.203 /api/quotes POST — snapshot-backed search submission", () => {
  it("snapshot-only items (DB Product 부재) → 500 0, createQuote 가 itemsDetailed 로 호출됨", async () => {
    // RequestWizardModal 이 보내는 payload 형태 — productId 는 catalog ref
    // (예: "p1") 일 수 있음. snapshot fields (name / catalogNumber / specification) 보유.
    const body = {
      title: "테스트 견적",
      items: [
        {
          productId: "p1",
          name: "Anti-GAPDH antibody",
          catalogNumber: "ab8245",
          specification: "100 µg",
          quantity: 2,
          allowSubstitute: false,
        },
        {
          productId: "p2",
          name: "DMEM high glucose",
          catalogNumber: "11965-118",
          specification: "500 mL",
          quantity: 1,
          allowSubstitute: true,
        },
      ],
    };

    // createQuote 가 정상 반환 (snapshot path 통과)
    createQuoteMock.mockResolvedValue({
      id: "q-test",
      title: "테스트 견적",
      organizationId: null,
      items: [],
    });

    const res = await POST(makeRequest(body) as never);

    // §11.203 핵심 — 500 절대 0
    expect(res.status).not.toBe(500);
    // structured 201 또는 200 — 정상 생성
    expect([200, 201]).toContain(res.status);

    // §11.203 핵심 — createQuote 가 itemsDetailed 로 호출됨 (snapshot path)
    expect(createQuoteMock).toHaveBeenCalled();
    const callArg = createQuoteMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(
      callArg.itemsDetailed,
      "route 가 snapshot fields 를 itemsDetailed 로 forward 해야 함",
    ).toBeDefined();
    expect(Array.isArray(callArg.itemsDetailed)).toBe(true);
    expect((callArg.itemsDetailed as unknown[]).length).toBe(2);
  });

  it("createQuote 가 'No valid products' throw — route 가 500 대신 structured 400 반환", async () => {
    // 정확히 호영님 prod 의 발화 시나리오. createQuote (legacy path) 가
    // snapshot 미forward 시 throw 하던 메시지.
    createQuoteMock.mockRejectedValue(
      new Error("No valid products found. Please add products from the search."),
    );
    const body = {
      title: "테스트",
      items: [{ productId: "ghost-1", name: "Ghost product", quantity: 1 }],
    };

    const res = await POST(makeRequest(body) as never);

    // §11.203 핵심 — 500 0, 400 으로 structured fallback
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(400);
    const json = (await (res as { json: () => Promise<unknown> }).json()) as { error?: string };
    // 운영자 친화 한국어 메시지 (raw stack trace 노출 0)
    expect(json.error).toBeTruthy();
    expect(json.error).not.toMatch(/stack|TypeError|Cannot read/);
    // enforcement.fail() 호출 확인 — lock 누수 차단 (§11.21 lesson)
    expect(enforcementSpies.fail).toHaveBeenCalledTimes(1);
    expect(enforcementSpies.complete).not.toHaveBeenCalled();
  });

  it("items 가 빈 배열 → structured 400 (DB write 0)", async () => {
    const res = await POST(makeRequest({ title: "빈", items: [] }) as never);
    expect(res.status).toBe(400);
    expect(createQuoteMock).not.toHaveBeenCalled();
  });

  it("Prisma P2003 (Foreign key) → 500 fallback 시 운영자 친화 메시지 + enforcement.fail()", async () => {
    const fkError = Object.assign(new Error("Foreign key constraint failed"), {
      code: "P2003",
    });
    createQuoteMock.mockRejectedValue(fkError);
    const body = {
      title: "테스트",
      items: [{ productId: "x", name: "X", quantity: 1 }],
    };

    const res = await POST(makeRequest(body) as never);
    // P2003 은 Foreign key 결함 → infrastructure error 로 500 유지하되 메시지 한국어
    // (현재 route 가 이미 P2003 → "존재하지 않는 제품 또는 조직 정보" 매핑)
    expect(res.status).toBe(500);
    const json = (await (res as { json: () => Promise<unknown> }).json()) as { error?: string };
    expect(json.error).toMatch(/존재하지\s*않는|제품|조직/);
    expect(enforcementSpies.fail).toHaveBeenCalledTimes(1);
  });

  it("snapshot-only items 시 raw productId 가 catalogRef 형태로 createQuote 에 전달됨", async () => {
    createQuoteMock.mockResolvedValue({
      id: "q-1",
      title: "T",
      organizationId: null,
      items: [],
    });

    const body = {
      items: [
        {
          productId: "p1",
          name: "Test",
          catalogNumber: "cat-001",
          quantity: 5,
        },
      ],
    };
    await POST(makeRequest(body) as never);

    const callArg = createQuoteMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const items = callArg.itemsDetailed as Array<Record<string, unknown>>;
    expect(items[0].productId).toBe("p1");
    expect(items[0].productName).toBe("Test");
    expect(items[0].catalogNumber).toBe("cat-001");
    expect(items[0].quantity).toBe(5);
  });
});
