/**
 * apps/web/src/__tests__/api/work-queue/purchase-conversion.test.ts
 *
 * Integration tests for GET /api/work-queue/purchase-conversion
 * (#P02 Phase B-α step α-B).
 *
 * Mocks: next/server (NextResponse), @/auth, @/lib/db (quote.findMany,
 * aiActionItem.findMany). Resolver itself is NOT mocked — we want to
 * verify the wiring end-to-end as far as the route can see, with real
 * resolver behaviour validating the join + stats.
 *
 * Quality gate per plan §α-B: ≥ 8 tests, no N+1 in Prisma query log.
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
    aiActionItem: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { GET } from "@/app/api/work-queue/purchase-conversion/route";

// Cast for type-safe mock access
const mockDb = db as unknown as {
  quote: { findMany: ReturnType<typeof vi.fn> };
  aiActionItem: { findMany: ReturnType<typeof vi.fn> };
};
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const NOW_REF = new Date("2026-04-25T12:00:00Z");

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function makeRequest() {
  // The route handler ignores request body / query for v0; a minimal
  // shape is enough.
  return {} as unknown as Request;
}

function buildQuoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    title: "Test Quote",
    description: null,
    status: "RESPONDED",
    totalAmount: 1_000_000,
    currency: "KRW",
    quoteNumber: "Q-20260425-0001",
    validUntil: new Date("2026-05-25T00:00:00Z"),
    createdAt: new Date("2026-04-20T00:00:00Z"),
    vendors: [],
    vendorRequests: [],
    replies: [],
    order: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "user-1" } });
  mockDb.quote.findMany.mockResolvedValue([]);
  mockDb.aiActionItem.findMany.mockResolvedValue([]);
  // Pin time so isExpired / createdDaysAgo are deterministic
  vi.useFakeTimers();
  vi.setSystemTime(NOW_REF);
});

// ──────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────

describe("GET /api/work-queue/purchase-conversion", () => {
  it("[1] auth missing → 401 with code UNAUTHORIZED", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(mockDb.quote.findMany).not.toHaveBeenCalled();
  });

  it("[2] empty inbox → empty items + zero stats", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.stats).toEqual({
      total: 0,
      review_required: 0,
      ready_for_po: 0,
      hold: 0,
      confirmed: 0,
      expired: 0,
    });
    // No second batched query when there are no quotes
    expect(mockDb.aiActionItem.findMany).not.toHaveBeenCalled();
  });

  it("[3] single PURCHASED quote → confirmed counter = 1", async () => {
    mockDb.quote.findMany.mockResolvedValue([buildQuoteRow({ status: "PURCHASED" })]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0].conversionStatus).toBe("confirmed");
    expect(body.data.stats.confirmed).toBe(1);
    expect(body.data.stats.total).toBe(1);
  });

  it("[4] mixed inbox → stats counters per status are correct", async () => {
    mockDb.quote.findMany.mockResolvedValue([
      buildQuoteRow({ id: "q-rev", status: "PARSED" }), // → review_required
      buildQuoteRow({ id: "q-rdy", status: "COMPLETED" }), // → ready_for_po
      buildQuoteRow({ id: "q-hold", status: "CANCELLED" }), // → hold
      buildQuoteRow({ id: "q-conf", status: "PURCHASED" }), // → confirmed
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.data.stats).toMatchObject({
      total: 4,
      review_required: 1,
      ready_for_po: 1,
      hold: 1,
      confirmed: 1,
      expired: 0,
    });
  });

  it("[5] expired quote → stats.expired counted independently of conversionStatus", async () => {
    mockDb.quote.findMany.mockResolvedValue([
      buildQuoteRow({
        id: "q-exp",
        status: "RESPONDED",
        validUntil: new Date("2026-04-20T00:00:00Z"), // before NOW_REF
        vendors: [{ id: "v1", vendorName: "V1", email: null }],
        replies: [
          {
            id: "r1",
            vendorName: "V1",
            fromEmail: "v1@x.com",
            receivedAt: new Date("2026-04-21T00:00:00Z"),
          },
        ],
      }),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.data.items[0].isExpired).toBe(true);
    expect(body.data.stats.expired).toBe(1);
    // conversionStatus still ready_for_po (replies match vendors)
    expect(body.data.stats.ready_for_po).toBe(1);
  });

  it("[6] AI actions are batched into a single query and grouped by quoteId", async () => {
    mockDb.quote.findMany.mockResolvedValue([
      buildQuoteRow({ id: "q-a" }),
      buildQuoteRow({ id: "q-b", quoteNumber: "Q-20260425-0002" }),
    ]);
    mockDb.aiActionItem.findMany.mockResolvedValue([
      {
        id: "a1",
        type: "VENDOR_RESPONSE_PARSED",
        status: "PENDING",
        taskStatus: "REVIEW_NEEDED",
        relatedEntityId: "q-a",
      },
      {
        id: "a2",
        type: "COMPARE_DECISION",
        status: "APPROVED",
        taskStatus: "READY",
        relatedEntityId: "q-b",
      },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    // Exactly one batched call to aiActionItem.findMany — no N+1
    expect(mockDb.aiActionItem.findMany).toHaveBeenCalledTimes(1);
    const aiCallArg = mockDb.aiActionItem.findMany.mock.calls[0][0];
    expect(aiCallArg.where.relatedEntityId.in).toEqual(["q-a", "q-b"]);

    // Grouping verified through the resolver output
    const itemA = body.data.items.find((i: { id: string }) => i.id === "q-a");
    const itemB = body.data.items.find((i: { id: string }) => i.id === "q-b");
    expect(itemA.aiRecommendationStatus).toBe("review_needed");
    expect(itemB.aiRecommendationStatus).toBe("recommended");
  });

  it("[7] AI actions with null relatedEntityId are ignored (not crashed on)", async () => {
    mockDb.quote.findMany.mockResolvedValue([buildQuoteRow({ id: "q-a" })]);
    mockDb.aiActionItem.findMany.mockResolvedValue([
      {
        id: "a-orphan",
        type: "REORDER_SUGGESTION",
        status: "PENDING",
        taskStatus: "READY",
        relatedEntityId: null,
      },
      {
        id: "a-good",
        type: "COMPARE_DECISION",
        status: "APPROVED",
        taskStatus: "READY",
        relatedEntityId: "q-a",
      },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0].aiRecommendationStatus).toBe("recommended");
  });

  it("[8] DB throws → 500 with INTERNAL_ERROR code (and no detail leak)", async () => {
    mockDb.quote.findMany.mockRejectedValue(new Error("connection lost"));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toMatchObject({ success: false, code: "INTERNAL_ERROR" });
    // Generic message — no raw error string
    expect(body.error).not.toContain("connection lost");
  });

  it("[9] Quote.findMany scope: userId + quoteNumber!=null", async () => {
    await GET(makeRequest());
    const arg = mockDb.quote.findMany.mock.calls[0][0];
    expect(arg.where.userId).toBe("user-1");
    expect(arg.where.quoteNumber).toEqual({ not: null });
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
  });

  it("[10] Quote.findMany select includes all four resolver-required relations", async () => {
    await GET(makeRequest());
    const arg = mockDb.quote.findMany.mock.calls[0][0];
    expect(arg.select).toMatchObject({
      vendors: expect.any(Object),
      vendorRequests: expect.any(Object),
      replies: expect.any(Object),
      order: expect.any(Object),
    });
  });
});
