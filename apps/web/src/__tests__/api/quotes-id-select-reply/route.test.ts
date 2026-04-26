/**
 * apps/web/src/__tests__/api/quotes-id-select-reply/route.test.ts
 *
 * α-D session A endpoint tests (ADR-002 §11.21).
 *
 * Mocks: next/server, @/auth, @/lib/db.quote, @/lib/security/server-enforcement-middleware.
 * The route's real branches are tested: auth → enforce → body → ownership →
 * reply membership → update.
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
    quote: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Lightweight enforcement stub: always allowed, complete/fail/deny noop.
vi.mock("@/lib/security/server-enforcement-middleware", () => ({
  enforceAction: () => ({
    allowed: true,
    correlationId: "corr_test",
    actorContext: {} as unknown,
    authResult: { permitted: true } as unknown,
    deny: () => mockJsonResponse({ error: "forbidden" }, { status: 403 }),
    complete: () => {},
    fail: () => {},
  }),
}));

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { POST } from "@/app/api/quotes/[id]/select-reply/route";

const mockDb = db as unknown as {
  quote: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const OWNER_ID = "user-owner";
const QUOTE_ID = "q-test-1";

function makeRequest(body: unknown): Request {
  return {
    json: async () => body,
  } as unknown as Request;
}

const params = Promise.resolve({ id: QUOTE_ID });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: OWNER_ID, role: "ADMIN" } });
});

describe("POST /api/quotes/[id]/select-reply", () => {
  it("[1] unauthenticated → 401", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ replyId: "r1" }) as any, { params });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("[2] invalid body (replyId missing) → 400", async () => {
    const res = await POST(makeRequest({}) as any, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("[3] quote not found → 404", async () => {
    mockDb.quote.findUnique.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ replyId: "r1" }) as any, { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(mockDb.quote.update).not.toHaveBeenCalled();
  });

  it("[4] quote owned by someone else → 404 (don't leak existence)", async () => {
    mockDb.quote.findUnique.mockResolvedValueOnce({
      id: QUOTE_ID,
      userId: "user-other",
      replies: [{ id: "r1" }],
    });
    const res = await POST(makeRequest({ replyId: "r1" }) as any, { params });
    expect(res.status).toBe(404);
    expect(mockDb.quote.update).not.toHaveBeenCalled();
  });

  it("[5] replyId not on quote → 400 REPLY_NOT_ON_QUOTE", async () => {
    mockDb.quote.findUnique.mockResolvedValueOnce({
      id: QUOTE_ID,
      userId: OWNER_ID,
      replies: [{ id: "r1" }, { id: "r2" }],
    });
    const res = await POST(
      makeRequest({ replyId: "r-stranger" }) as any,
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("REPLY_NOT_ON_QUOTE");
    expect(mockDb.quote.update).not.toHaveBeenCalled();
  });

  it("[6] valid replyId → 200 + selectedReplyId persisted", async () => {
    mockDb.quote.findUnique.mockResolvedValueOnce({
      id: QUOTE_ID,
      userId: OWNER_ID,
      replies: [{ id: "r1" }, { id: "r2" }],
    });
    mockDb.quote.update.mockResolvedValueOnce({
      id: QUOTE_ID,
      selectedReplyId: "r2",
    });
    const res = await POST(makeRequest({ replyId: "r2" }) as any, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.selectedReplyId).toBe("r2");
    expect(mockDb.quote.update).toHaveBeenCalledTimes(1);
    const updateCall = mockDb.quote.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe(QUOTE_ID);
    expect(updateCall.data.selectedReplyId).toBe("r2");
  });

  it("[7] replyId === null → unset (200 + selectedReplyId persisted as null)", async () => {
    mockDb.quote.findUnique.mockResolvedValueOnce({
      id: QUOTE_ID,
      userId: OWNER_ID,
      replies: [{ id: "r1" }], // membership check skipped when replyId is null
    });
    mockDb.quote.update.mockResolvedValueOnce({
      id: QUOTE_ID,
      selectedReplyId: null,
    });
    const res = await POST(makeRequest({ replyId: null }) as any, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.selectedReplyId).toBeNull();
    const updateCall = mockDb.quote.update.mock.calls[0][0];
    expect(updateCall.data.selectedReplyId).toBeNull();
  });

  it("[8] replyId === null + replies empty → still 200 (unset is always valid)", async () => {
    mockDb.quote.findUnique.mockResolvedValueOnce({
      id: QUOTE_ID,
      userId: OWNER_ID,
      replies: [],
    });
    mockDb.quote.update.mockResolvedValueOnce({
      id: QUOTE_ID,
      selectedReplyId: null,
    });
    const res = await POST(makeRequest({ replyId: null }) as any, { params });
    expect(res.status).toBe(200);
  });
});
