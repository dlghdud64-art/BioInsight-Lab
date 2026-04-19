/**
 * Webhook Idempotency Integration Test (Task #40)
 *
 * Evidence lock for commit 549fee1e (Stripe webhook 멱등성 가드).
 * 이 테스트는 "새 기능 검증"이 아니라 "release-prep governance 정합"이다.
 *
 * 검증 대상:
 * - route.ts L286-312: event.id PK create-first 패턴 → 중복 skip
 * - route.ts L344-354: handler 실패 시 StripeEvent rollback (Stripe 재시도 허용)
 * - route.ts L256-278: 서명 검증 실패 → 400 + StripeEvent 미생성
 *
 * Strategy: Prisma client mock (in-memory, 빠르고 격리됨).
 * Real Stripe webhook retry는 docs/runbooks/BILLING_WEBHOOK_RETRY_SMOKE.md 로 별도 검증.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockJsonResponse } from "@/__tests__/helpers/response-mock";

// ── env 변수 (route module load 전 설정) ──
process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || "sk_test_dummy_for_tests";
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_dummy";

// ── hoisted mocks (vi.mock factory 는 top-level var 참조 불가 → vi.hoisted 로 감싼다) ──
const mocks = vi.hoisted(() => {
  // Prisma 에러 타입 재현
  class PrismaClientKnownRequestErrorMock extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
      this.name = "PrismaClientKnownRequestError";
    }
  }

  const stripeEventStore = new Map<
    string,
    { eventId: string; type: string }
  >();

  // Prisma client mock — in-memory StripeEvent + workspace.
  // vi.hoisted factory 내부에서 top-level import 된 vi 를 그대로 사용 가능
  // (vi.hoisted block 은 imports 바로 아래로 hoist 되므로 vi 가 먼저 로드됨).
  const dbMock = {
    stripeEvent: {
      create: vi.fn(
        async ({ data }: { data: { eventId: string; type: string } }) => {
          if (stripeEventStore.has(data.eventId)) {
            throw new PrismaClientKnownRequestErrorMock(
              "Unique constraint failed",
              "P2002"
            );
          }
          stripeEventStore.set(data.eventId, data);
          return data;
        }
      ),
      delete: vi.fn(
        async ({ where }: { where: { eventId: string } }) => {
          stripeEventStore.delete(where.eventId);
          return { eventId: where.eventId };
        }
      ),
    },
    workspace: {
      update: vi.fn(async () => ({ id: "ws-test" })),
    },
  };

  const constructEventMock = vi.fn();
  const subscriptionsRetrieveMock = vi.fn();

  return {
    PrismaClientKnownRequestErrorMock,
    stripeEventStore,
    dbMock,
    constructEventMock,
    subscriptionsRetrieveMock,
  };
});

// ── next/server mock ──
vi.mock("next/server", () => ({
  NextRequest: class MockNextRequest {
    url: string;
    method: string;
    headers: { get: (k: string) => string | null };
    private _bodyText: string;
    constructor(
      url: string | URL,
      init?: {
        method?: string;
        body?: string;
        headers?: Record<string, string>;
      }
    ) {
      this.url = typeof url === "string" ? url : url.toString();
      this.method = init?.method ?? "GET";
      this._bodyText = init?.body ?? "";
      const headerMap = new Map<string, string>();
      Object.entries(init?.headers ?? {}).forEach(([k, v]) => {
        headerMap.set(k.toLowerCase(), v);
      });
      this.headers = {
        get: (k: string) => headerMap.get(k.toLowerCase()) ?? null,
      };
    }
    async text() {
      return this._bodyText;
    }
  },
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) =>
      mockJsonResponse(data, init),
  },
}));

// ── @prisma/client mock (Prisma.PrismaClientKnownRequestError instanceof 분기 재현) ──
vi.mock("@prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: mocks.PrismaClientKnownRequestErrorMock,
  },
}));

// ── @/lib/db mock ──
vi.mock("@/lib/db", () => ({ db: mocks.dbMock }));

// ── logger mock ──
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ── stripe mock ──
vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      webhooks = { constructEvent: mocks.constructEventMock };
      subscriptions = { retrieve: mocks.subscriptionsRetrieveMock };
    },
  };
});

// ── Route 불러오기 (mock 이후) ──
import { POST } from "@/app/api/billing/webhook/route";
import { NextRequest } from "next/server";

// ── Helpers ──

function makeSubscriptionUpdatedEvent(
  eventId: string,
  workspaceId = "ws-test"
) {
  return {
    id: eventId,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_123",
        status: "active",
        metadata: { workspaceId },
        items: { data: [{ price: { id: "price_team" } }] },
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      },
    },
  };
}

function makeWebhookRequest(body: object) {
  return new NextRequest("http://localhost/api/billing/webhook", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "stripe-signature": "t=123,v1=mock_signature",
    },
  });
}

// ── Tests ──

describe("POST /api/billing/webhook — Idempotency Guard (Task #40 evidence lock)", () => {
  beforeEach(() => {
    mocks.stripeEventStore.clear();
    mocks.dbMock.stripeEvent.create.mockClear();
    mocks.dbMock.stripeEvent.delete.mockClear();
    mocks.dbMock.workspace.update.mockClear();
    mocks.constructEventMock.mockReset();
    mocks.subscriptionsRetrieveMock.mockReset();
  });

  it("Case 1: duplicate event.id → second call returns duplicate:true, workspace.update called exactly once", async () => {
    const event = makeSubscriptionUpdatedEvent("evt_duplicate_001");
    mocks.constructEventMock.mockReturnValue(event);

    const req1 = makeWebhookRequest(event);
    const res1 = await POST(req1);
    const body1 = await res1.json();

    const req2 = makeWebhookRequest(event);
    const res2 = await POST(req2);
    const body2 = await res2.json();

    // 첫 번째: 정상 처리
    expect(res1.status).toBe(200);
    expect(body1).toEqual({ received: true });

    // 두 번째: duplicate skip
    expect(res2.status).toBe(200);
    expect(body2).toEqual({ received: true, duplicate: true });

    // 멱등 보장: workspace.update 는 정확히 1회만 호출
    expect(mocks.dbMock.workspace.update).toHaveBeenCalledTimes(1);

    // stripeEvent.create 는 2회 시도됨 (두번째는 P2002 throw)
    expect(mocks.dbMock.stripeEvent.create).toHaveBeenCalledTimes(2);

    // rollback delete 는 호출되면 안 됨 (정상 처리 경로)
    expect(mocks.dbMock.stripeEvent.delete).not.toHaveBeenCalled();
  });

  it("Case 2: handler failure → 500 + StripeEvent rollback (Stripe can retry)", async () => {
    const event = makeSubscriptionUpdatedEvent("evt_handler_fail_002");
    mocks.constructEventMock.mockReturnValue(event);

    // handler 내부에서 workspace.update 가 throw 하도록
    mocks.dbMock.workspace.update.mockRejectedValueOnce(
      new Error("Database connection lost")
    );

    const req = makeWebhookRequest(event);
    const res = await POST(req);
    const body = await res.json();

    // 500 반환으로 Stripe 가 재시도 받게 해야 함
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Webhook processing failed" });

    // stripeEvent row 는 rollback (delete 호출) — 재시도 시 중복으로 skip 안되도록
    expect(mocks.dbMock.stripeEvent.delete).toHaveBeenCalledTimes(1);
    expect(mocks.dbMock.stripeEvent.delete).toHaveBeenCalledWith({
      where: { eventId: "evt_handler_fail_002" },
    });

    // in-memory store 에서 실제로 제거됨
    expect(mocks.stripeEventStore.has("evt_handler_fail_002")).toBe(false);
  });

  it("Case 3: invalid signature → 400 + StripeEvent NOT created (no rollback needed)", async () => {
    // constructEvent throw → 서명 검증 실패 분기
    mocks.constructEventMock.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const req = makeWebhookRequest({ id: "evt_invalid_sig_003" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid signature" });

    // 서명 실패 시 stripeEvent 는 아예 생성되지 않아야 함
    expect(mocks.dbMock.stripeEvent.create).not.toHaveBeenCalled();
    expect(mocks.dbMock.stripeEvent.delete).not.toHaveBeenCalled();
    expect(mocks.dbMock.workspace.update).not.toHaveBeenCalled();
  });
});
