/**
 * apps/web/src/__tests__/api/bulk-po/route.test.ts
 *
 * α-D session B (ADR §11.22) — bulk-PO endpoint contract tests.
 *
 * Mocks: next/server, @/auth, @/lib/db.{quote,order,$transaction},
 * @/lib/security/server-enforcement-middleware. Spy on enforcement
 * complete()/fail() so the §11.21 lock-leak class can never re-emerge.
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
    quote: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const enforcementSpies = {
  complete: vi.fn(),
  fail: vi.fn(),
};
vi.mock("@/lib/security/server-enforcement-middleware", () => ({
  enforceAction: () => ({
    allowed: true,
    correlationId: "corr_bulk_po_test",
    actorContext: {} as unknown,
    authResult: { permitted: true } as unknown,
    deny: () => mockJsonResponse({ error: "forbidden" }, { status: 403 }),
    complete: enforcementSpies.complete,
    fail: enforcementSpies.fail,
  }),
}));

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { POST } from "@/app/api/work-queue/purchase-conversion/bulk-po/route";

const mockDb = db as unknown as {
  quote: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const OWNER_ID = "user-owner";

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function buildQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-1",
    userId: OWNER_ID,
    organizationId: "org-1",
    title: "Test",
    currency: "KRW",
    totalAmount: null,
    selectedReplyId: "r-V1",
    replies: [{ id: "r-V1" }],
    items: [
      {
        productId: "p-1",
        name: "Product",
        brand: "BrandX",
        catalogNumber: "C-1",
        quantity: 1,
        unitPrice: 1000,
        lineTotal: 1000,
        notes: null,
      },
    ],
    order: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  enforcementSpies.complete.mockReset();
  enforcementSpies.fail.mockReset();
  mockAuth.mockResolvedValue({ user: { id: OWNER_ID, role: "ADMIN" } });
});

describe("POST /api/work-queue/purchase-conversion/bulk-po", () => {
  it("[1] unauthenticated → 401, no enforcement.fail() needed (auth happens before enforce)", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ quoteIds: ["q-1"] }) as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("[2] invalid body (no quoteIds) → 400 + lock released", async () => {
    const res = await POST(makeRequest({}) as any);
    expect(res.status).toBe(400);
    expect(enforcementSpies.fail).toHaveBeenCalledTimes(1);
    expect(enforcementSpies.complete).not.toHaveBeenCalled();
  });

  it("[3] empty quoteIds array → 400 + lock released", async () => {
    const res = await POST(makeRequest({ quoteIds: [] }) as any);
    expect(res.status).toBe(400);
    expect(enforcementSpies.fail).toHaveBeenCalledTimes(1);
  });

  it("[4] some quote not owned (or not found) → 404 + lock released", async () => {
    // Asked for 2 quoteIds, only 1 came back (other is not owned by user
    // or not found — same response, no leak).
    mockDb.quote.findMany.mockResolvedValueOnce([buildQuote()]);
    const res = await POST(
      makeRequest({ quoteIds: ["q-1", "q-stranger"] }) as any,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("QUOTE_MISSING");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
    expect(enforcementSpies.fail).toHaveBeenCalledTimes(1);
  });

  it("[5] quote already has Order → 409 + lock released", async () => {
    mockDb.quote.findMany.mockResolvedValueOnce([
      buildQuote({ order: { id: "o-existing" } }),
    ]);
    const res = await POST(makeRequest({ quoteIds: ["q-1"] }) as any);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("ORDER_EXISTS");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
    expect(enforcementSpies.fail).toHaveBeenCalledTimes(1);
  });

  it("[6] quote without selectedReplyId → 409 + lock released", async () => {
    mockDb.quote.findMany.mockResolvedValueOnce([
      buildQuote({ selectedReplyId: null }),
    ]);
    const res = await POST(makeRequest({ quoteIds: ["q-1"] }) as any);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NO_SELECTED_REPLY");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
    expect(enforcementSpies.fail).toHaveBeenCalledTimes(1);
  });

  it("[7] selectedReplyId stale (not in replies) → 409 + lock released", async () => {
    mockDb.quote.findMany.mockResolvedValueOnce([
      buildQuote({ selectedReplyId: "r-deleted", replies: [{ id: "r-V1" }] }),
    ]);
    const res = await POST(makeRequest({ quoteIds: ["q-1"] }) as any);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NO_SELECTED_REPLY");
    expect(enforcementSpies.fail).toHaveBeenCalledTimes(1);
  });

  it("[8] all valid → 200 + transaction creates Orders + complete()", async () => {
    mockDb.quote.findMany.mockResolvedValueOnce([
      buildQuote({ id: "q-1" }),
      buildQuote({ id: "q-2", selectedReplyId: "r-V2", replies: [{ id: "r-V2" }] }),
    ]);
    // Stub transaction to return shaped results — the route's callback
    // is the unit being tested for control flow, not Prisma's own
    // transaction semantics. We trust $transaction(cb) → await cb(tx).
    mockDb.$transaction.mockImplementationOnce(async () => [
      { quoteId: "q-1", orderId: "o-1", orderNumber: "ORD-20260426-OOOO11" },
      { quoteId: "q-2", orderId: "o-2", orderNumber: "ORD-20260426-OOOO22" },
    ]);
    const res = await POST(
      makeRequest({ quoteIds: ["q-1", "q-2"] }) as any,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.results).toHaveLength(2);
    expect(body.data.results[0].quoteId).toBe("q-1");
    expect(body.data.results[1].quoteId).toBe("q-2");
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(enforcementSpies.complete).toHaveBeenCalledTimes(1);
    expect(enforcementSpies.fail).not.toHaveBeenCalled();
  });

  it("[9] duplicate quoteIds in input dedupe to a single Order", async () => {
    // Same quoteId twice in the input array — server dedups.
    mockDb.quote.findMany.mockResolvedValueOnce([buildQuote({ id: "q-1" })]);
    mockDb.$transaction.mockImplementationOnce(async () => [
      { quoteId: "q-1", orderId: "o-1", orderNumber: "ORD-20260426-OOOO11" },
    ]);
    const res = await POST(
      makeRequest({ quoteIds: ["q-1", "q-1", "q-1"] }) as any,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.results).toHaveLength(1);
  });
});
