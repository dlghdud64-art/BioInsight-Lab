/**
 * Route integration tests for Compare Sessions API
 *
 * Uses CJS require() to avoid ESM/next-auth import chain issues.
 */

import { mockJsonResponse } from "@/__tests__/helpers/response-mock";

// ── Module mocks ──
vi.mock("next/server", () => ({
  NextRequest: class MockNextRequest {
    url: string;
    method: string;
    private _body: unknown;
    constructor(url: string | URL, init?: { method?: string; body?: string }) {
      this.url = typeof url === "string" ? url : url.toString();
      this.method = init?.method ?? "GET";
      this._body = init?.body ? JSON.parse(init.body) : null;
    }
    async json() { return this._body; }
  },
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) =>
      mockJsonResponse(data, init),
  },
}));

// @/auth → Jest auto-discovers src/__mocks__/auth.ts (manual mock)
vi.mock("@/auth");

vi.mock("@/lib/db", () => ({
  db: {
    compareSession: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    compareInquiryDraft: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    quote: { create: vi.fn(), findMany: vi.fn() },
    product: { findMany: vi.fn() },
    activityLog: { findFirst: vi.fn(), create: vi.fn() },
    aiActionItem: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/work-queue/work-queue-service", () => ({
  transitionWorkItem: vi.fn().mockResolvedValue(undefined),
  createWorkItem: vi.fn().mockResolvedValue("new-queue-item-id"),
}));

vi.mock("@/lib/activity-log", () => ({ createActivityLog: vi.fn() }));
vi.mock("@/lib/api-error-handler", () => ({
  handleApiError: vi.fn((error: Error | undefined) =>
    mockJsonResponse({ error: error?.message ?? "err" }, { status: 500 })),
}));
vi.mock("@/lib/api/products", () => ({ getProductsByIds: vi.fn() }));
vi.mock("@/lib/compare-workspace/compare-engine", () => ({ computeMultiProductDiff: vi.fn() }));
vi.mock("@/lib/compare-workspace/vendor-inquiry-draft", () => ({ generateVendorInquiryDraft: vi.fn() }));
vi.mock("@/lib/compare-workspace/compare-insight-generator", () => ({ generateCompareInsight: vi.fn() }));

// ── Now require mocked modules ──
const { db } = require("@/lib/db");
const { auth } = require("@/auth");
const { createActivityLog } = require("@/lib/activity-log");
const { getProductsByIds } = require("@/lib/api/products");
const { computeMultiProductDiff } = require("@/lib/compare-workspace/compare-engine");
const { generateVendorInquiryDraft } = require("@/lib/compare-workspace/vendor-inquiry-draft");
const { NextRequest } = require("next/server");
const { transitionWorkItem, createWorkItem: createQueueItem } = require("@/lib/work-queue/work-queue-service");

// Route handlers
const { GET: listSessions, POST: createSession } = require("@/app/api/compare-sessions/route");
const { GET: getSession } = require("@/app/api/compare-sessions/[id]/route");
const { POST: createInquiryDraft, GET: getInquiryDrafts, PATCH: patchInquiryDraft } = require("@/app/api/compare-sessions/[id]/inquiry-draft/route");
const { POST: createQuoteDraft } = require("@/app/api/compare-sessions/[id]/quote-draft/route");
const { PATCH: patchDecision } = require("@/app/api/compare-sessions/[id]/decision/route");

// ── Helpers ──

function makeRequest(
  url: string,
  options?: { method?: string; body?: unknown }
) {
  const init: { method: string; body?: string } = {
    method: options?.method ?? "GET",
  };
  if (options?.body) init.body = JSON.stringify(options.body);
  return new NextRequest(`http://localhost:3000${url}`, init);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const mockCompareSession = {
  id: "session-1",
  productIds: ["prod-a", "prod-b"],
  diffResult: [{ summary: { overallVerdict: "MINOR_DIFFERENCES" }, totalDifferences: 2 }],
  aiInsight: null, userId: "user-1", organizationId: "org-1",
  decisionState: null, decisionNote: null, decidedBy: null, decidedAt: null,
  createdAt: new Date("2026-03-01"), updatedAt: new Date("2026-03-01"),
  inquiryDrafts: [],
};

const mockDraft = {
  id: "draft-1", compareSessionId: "session-1", vendorName: "Fisher",
  vendorEmail: null, productName: "Methanol", subject: "문의", body: "본문",
  inquiryFields: ["가격"], status: "GENERATED", diffIndex: 0,
  userId: "user-1", organizationId: "org-1",
  createdAt: new Date("2026-03-01"), updatedAt: new Date("2026-03-01"),
};

// ── Setup ──

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "mock-user" } });
  createActivityLog.mockResolvedValue(undefined);
});

// ── Tests ──

describe("POST /api/compare-sessions", () => {
  it("should create a compare session successfully", async () => {
    const products = [
      { id: "prod-a", name: "A", brand: "X", catalogNumber: "1", vendors: [] },
      { id: "prod-b", name: "B", brand: "Y", catalogNumber: "2", vendors: [] },
    ];
    getProductsByIds.mockResolvedValue(products);
    db.compareSession.create.mockResolvedValue({ id: "session-1", productIds: ["prod-a", "prod-b"], createdAt: new Date() });
    db.compareSession.update.mockResolvedValue({});
    computeMultiProductDiff.mockReturnValue([{ totalDifferences: 2 }]);

    const res = await createSession(makeRequest("/api/compare-sessions", { method: "POST", body: { productIds: ["prod-a", "prod-b"] } }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.session.id).toBe("session-1");
    expect(data.products).toHaveLength(2);
    expect(createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ activityType: "PRODUCT_COMPARED" }));
  });

  it("should reject fewer than 2 products", async () => {
    const res = await createSession(makeRequest("/api/compare-sessions", { method: "POST", body: { productIds: ["prod-a"] } }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/compare-sessions/[id]", () => {
  it("should return enriched session with linked outcomes", async () => {
    db.compareSession.findUnique.mockResolvedValue(mockCompareSession);
    db.quote.findMany.mockResolvedValue([{ id: "quote-1", title: "견적", status: "PENDING", createdAt: new Date("2026-03-02") }]);

    const res = await getSession(makeRequest("/api/compare-sessions/session-1"), makeParams("session-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.session).toBeDefined();
    expect(data.linkedQuotes).toHaveLength(1);
    expect(data.inquiryDrafts).toBeDefined();
    expect(data.latestActionAt).toBeDefined();
    expect(createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ activityType: "COMPARE_RESULT_VIEWED" }));
  });

  it("should return 404 for non-existent session", async () => {
    db.compareSession.findUnique.mockResolvedValue(null);
    const res = await getSession(makeRequest("/api/compare-sessions/x"), makeParams("x"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/compare-sessions/[id]/inquiry-draft", () => {
  it("should create an inquiry draft", async () => {
    db.compareSession.findUnique.mockResolvedValue(mockCompareSession);
    generateVendorInquiryDraft.mockResolvedValue({
      subject: "문의", body: "본문", vendorName: "Fisher", productName: "Methanol", inquiryFields: ["가격"], generatedAt: new Date(),
    });
    db.compareInquiryDraft.create.mockResolvedValue(mockDraft);

    const res = await createInquiryDraft(
      makeRequest("/api/compare-sessions/session-1/inquiry-draft", { method: "POST", body: { vendorName: "Fisher" } }),
      makeParams("session-1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.draft.vendorName).toBe("Fisher");
    expect(createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ activityType: "EMAIL_DRAFT_GENERATED" }));
  });
});

describe("GET /api/compare-sessions/[id]/inquiry-draft", () => {
  it("should return drafts array", async () => {
    db.compareInquiryDraft.findMany.mockResolvedValue([mockDraft]);
    const res = await getInquiryDrafts(makeRequest("/api/compare-sessions/session-1/inquiry-draft"), makeParams("session-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.drafts).toHaveLength(1);
  });
});

describe("PATCH /api/compare-sessions/[id]/inquiry-draft", () => {
  it("should update draft status with before/after tracking", async () => {
    db.compareInquiryDraft.findUnique.mockResolvedValue({ status: "GENERATED" });
    db.compareInquiryDraft.update.mockResolvedValue({ ...mockDraft, status: "COPIED" });

    const res = await patchInquiryDraft(
      makeRequest("/api/compare-sessions/session-1/inquiry-draft", { method: "PATCH", body: { draftId: "draft-1", status: "COPIED" } }),
      makeParams("session-1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.draft.status).toBe("COPIED");
    expect(createActivityLog).toHaveBeenCalledWith(expect.objectContaining({
      activityType: "COMPARE_INQUIRY_DRAFT_STATUS_CHANGED", beforeStatus: "GENERATED", afterStatus: "COPIED",
    }));
  });
});

describe("POST /api/compare-sessions/[id]/quote-draft", () => {
  it("should create a quote from compare session", async () => {
    db.compareSession.findUnique.mockResolvedValue(mockCompareSession);
    db.product.findMany.mockResolvedValue([
      { id: "prod-a", name: "A", brand: "X", catalogNumber: "1", vendors: [{ priceInKRW: 10000, currency: "KRW", vendor: { name: "V" } }] },
    ]);
    db.quote.create.mockResolvedValue({ id: "quote-1", title: "견적", comparisonId: "session-1", items: [{ id: "i1" }] });

    const res = await createQuoteDraft(
      makeRequest("/api/compare-sessions/session-1/quote-draft", { method: "POST", body: {} }),
      makeParams("session-1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.quote.comparisonId).toBe("session-1");
    expect(createActivityLog).toHaveBeenCalledTimes(2);
    expect(createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ activityType: "QUOTE_CREATED" }));
    expect(createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ activityType: "QUOTE_DRAFT_STARTED_FROM_COMPARE" }));
  });
});

describe("PATCH /api/compare-sessions/[id]/decision", () => {
  it("should set decision state", async () => {
    db.compareSession.findUnique.mockResolvedValue({ decisionState: null, organizationId: "org-1", productIds: ["prod-a"], inquiryDrafts: [] });
    db.aiActionItem.findFirst.mockResolvedValue(null);
    db.compareSession.update.mockResolvedValue({ ...mockCompareSession, decisionState: "APPROVED", decidedBy: "user-1", decidedAt: new Date() });

    const res = await patchDecision(
      makeRequest("/api/compare-sessions/session-1/decision", { method: "PATCH", body: { decisionState: "APPROVED", decisionNote: "확인" } }),
      makeParams("session-1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.session.decisionState).toBe("APPROVED");
    expect(createActivityLog).toHaveBeenCalledWith(expect.objectContaining({
      activityType: "AI_TASK_COMPLETED", entityType: "COMPARE_SESSION", afterStatus: "APPROVED",
    }));
  });

  it("should log COMPARE_SESSION_REOPENED when reverting to UNDECIDED", async () => {
    db.compareSession.findUnique.mockResolvedValue({ decisionState: "APPROVED", organizationId: "org-1", productIds: ["prod-a"], inquiryDrafts: [] });
    db.aiActionItem.findFirst.mockResolvedValue(null);
    db.quote.findMany.mockResolvedValue([]);
    db.product.findMany.mockResolvedValue([{ id: "prod-a", name: "Product A" }]);
    db.compareSession.update.mockResolvedValue({ ...mockCompareSession, decisionState: "UNDECIDED" });

    const res = await patchDecision(
      makeRequest("/api/compare-sessions/session-1/decision", { method: "PATCH", body: { decisionState: "UNDECIDED" } }),
      makeParams("session-1")
    );
    expect(res.status).toBe(200);
    expect(createActivityLog).toHaveBeenCalledWith(expect.objectContaining({
      activityType: "COMPARE_SESSION_REOPENED", beforeStatus: "APPROVED", afterStatus: "UNDECIDED",
    }));
  });
});

describe("GET /api/compare-sessions (list)", () => {
  it("should return enriched sessions list", async () => {
    const mockSessions = [
      {
        id: "session-1", productIds: ["prod-a", "prod-b"],
        diffResult: [{ summary: { overallVerdict: "MINOR_DIFFERENCES" } }],
        decisionState: "APPROVED", decidedBy: "user-1", decidedAt: new Date("2026-03-10"),
        userId: "mock-user", organizationId: "org-1",
        createdAt: new Date("2026-03-01"), updatedAt: new Date("2026-03-10"),
        inquiryDrafts: [{ id: "d1", status: "COPIED" }],
      },
    ];
    db.compareSession.findMany.mockResolvedValue(mockSessions);
    db.compareSession.count.mockResolvedValue(1);
    db.quote.findMany.mockResolvedValue([{ id: "q1", comparisonId: "session-1" }]);
    db.product.findMany.mockResolvedValue([
      { id: "prod-a", name: "Product A" },
      { id: "prod-b", name: "Product B" },
    ]);

    const res = await listSessions(makeRequest("/api/compare-sessions"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sessions).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.sessions[0].productNames).toEqual(["Product A", "Product B"]);
    expect(data.sessions[0].linkedQuoteCount).toBe(1);
    expect(data.sessions[0].inquiryDraftCount).toBe(1);
    expect(data.sessions[0].diffSummaryVerdict).toBe("MINOR_DIFFERENCES");
    expect(data.sessions[0].decisionState).toBe("APPROVED");
  });

  it("should filter by decisionState", async () => {
    db.compareSession.findMany.mockResolvedValue([]);
    db.compareSession.count.mockResolvedValue(0);

    const res = await listSessions(makeRequest("/api/compare-sessions?status=APPROVED"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sessions).toEqual([]);
    expect(db.compareSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ decisionState: "APPROVED" }) })
    );
  });

  it("should return empty for no sessions", async () => {
    db.compareSession.findMany.mockResolvedValue([]);
    db.compareSession.count.mockResolvedValue(0);

    const res = await listSessions(makeRequest("/api/compare-sessions"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sessions).toEqual([]);
    expect(data.total).toBe(0);
  });
});

// ── Decision → Work Queue Integration ──

describe("PATCH decision — work queue integration", () => {
  it("should call transitionWorkItem with compare_decided on terminal decision", async () => {
    db.compareSession.findUnique.mockResolvedValue({
      decisionState: null,
      organizationId: "org-1",
      productIds: ["prod-a"],
      inquiryDrafts: [],
    });
    db.compareSession.update.mockResolvedValue({ ...mockCompareSession, decisionState: "APPROVED" });
    db.aiActionItem.findFirst.mockResolvedValue({ id: "queue-item-1" });

    const res = await patchDecision(
      makeRequest("/api/compare-sessions/session-1/decision", { method: "PATCH", body: { decisionState: "APPROVED" } }),
      makeParams("session-1")
    );

    expect(res.status).toBe(200);
    expect(transitionWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "queue-item-1",
        substatus: "compare_decided",
        userId: "mock-user",
      })
    );
  });

  it("should not call transitionWorkItem when no active queue item on terminal decision", async () => {
    db.compareSession.findUnique.mockResolvedValue({
      decisionState: null,
      organizationId: "org-1",
      productIds: ["prod-a"],
      inquiryDrafts: [],
    });
    db.compareSession.update.mockResolvedValue({ ...mockCompareSession, decisionState: "HELD" });
    db.aiActionItem.findFirst.mockResolvedValue(null);

    const res = await patchDecision(
      makeRequest("/api/compare-sessions/session-1/decision", { method: "PATCH", body: { decisionState: "HELD" } }),
      makeParams("session-1")
    );

    expect(res.status).toBe(200);
    expect(transitionWorkItem).not.toHaveBeenCalled();
  });

  it("should reopen completed queue item when reverting to UNDECIDED", async () => {
    db.compareSession.findUnique.mockResolvedValue({
      decisionState: "APPROVED",
      organizationId: "org-1",
      productIds: ["prod-a"],
      inquiryDrafts: [],
    });
    db.compareSession.update.mockResolvedValue({ ...mockCompareSession, decisionState: "UNDECIDED" });
    db.aiActionItem.findFirst.mockResolvedValue({ id: "completed-item-1" });
    db.quote.findMany.mockResolvedValue([]);

    const res = await patchDecision(
      makeRequest("/api/compare-sessions/session-1/decision", { method: "PATCH", body: { decisionState: "UNDECIDED" } }),
      makeParams("session-1")
    );

    expect(res.status).toBe(200);
    expect(transitionWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "completed-item-1",
        substatus: "compare_reopened",
      })
    );
  });

  it("should create new queue item on reopen when no completed item exists", async () => {
    db.compareSession.findUnique.mockResolvedValue({
      decisionState: "REJECTED",
      organizationId: "org-1",
      productIds: ["prod-a", "prod-b"],
      inquiryDrafts: [],
    });
    db.compareSession.update.mockResolvedValue({ ...mockCompareSession, decisionState: "UNDECIDED" });
    db.aiActionItem.findFirst.mockResolvedValue(null);
    db.quote.findMany.mockResolvedValue([]);
    db.product.findMany.mockResolvedValue([
      { id: "prod-a", name: "Product A" },
      { id: "prod-b", name: "Product B" },
    ]);

    const res = await patchDecision(
      makeRequest("/api/compare-sessions/session-1/decision", { method: "PATCH", body: { decisionState: "UNDECIDED" } }),
      makeParams("session-1")
    );

    expect(res.status).toBe(200);
    expect(createQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "COMPARE_DECISION",
        relatedEntityId: "session-1",
        relatedEntityType: "COMPARE_SESSION",
      })
    );
  });

  it("should use AI_TASK_COMPLETED activity type for terminal decisions (not QUOTE_STATUS_CHANGED)", async () => {
    db.compareSession.findUnique.mockResolvedValue({
      decisionState: null,
      organizationId: "org-1",
      productIds: ["prod-a"],
      inquiryDrafts: [],
    });
    db.compareSession.update.mockResolvedValue({ ...mockCompareSession, decisionState: "APPROVED" });
    db.aiActionItem.findFirst.mockResolvedValue(null);

    await patchDecision(
      makeRequest("/api/compare-sessions/session-1/decision", { method: "PATCH", body: { decisionState: "APPROVED" } }),
      makeParams("session-1")
    );

    expect(createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: "AI_TASK_COMPLETED",
        afterStatus: "APPROVED",
      })
    );
  });
});
