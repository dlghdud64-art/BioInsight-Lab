// @ts-nocheck — mockJsonResponse 재선언 등 test helper 타입 이슈 (Phase 4 deferred)
/**
 * Behavioral tests for POST /api/work-queue/compare-sync
 *
 * Tests idempotency, duplicate prevention, reopen handling, stale cleanup.
 */

const mockJsonResponse = (data, init) => ({
  status: init?.status ?? 200,
  json: async () => data,
});

vi.mock("next/server", () => ({
  NextResponse: { json: (data, init) => mockJsonResponse(data, init) },
}));

vi.mock("@/auth");

vi.mock("@/lib/db", () => ({
  db: {
    compareSession: { findMany: vi.fn() },
    aiActionItem: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    quote: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/work-queue/work-queue-service", () => ({
  createWorkItem: vi.fn().mockResolvedValue("new-item-id"),
  transitionWorkItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api-error-handler", () => ({
  handleApiError: vi.fn((error) => mockJsonResponse({ error: error?.message }, { status: 500 })),
}));

const { db } = require("@/lib/db");
const { auth } = require("@/auth");
const { createWorkItem, transitionWorkItem } = require("@/lib/work-queue/work-queue-service");
const { POST } = require("@/app/api/work-queue/compare-sync/route");

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "user-1" } });
  db.product.findMany.mockResolvedValue([
    { id: "prod-a", name: "Product A" },
    { id: "prod-b", name: "Product B" },
  ]);
  db.quote.findMany.mockResolvedValue([]);
});

const mockSession = {
  id: "session-1",
  productIds: ["prod-a", "prod-b"],
  createdAt: new Date("2026-03-01"),
  diffResult: [{ summary: { overallVerdict: "MINOR_DIFFERENCES" } }],
  inquiryDrafts: [],
};

describe("POST /api/work-queue/compare-sync", () => {
  it("returns { synced: 0 } for unauthenticated user", async () => {
    auth.mockResolvedValue(null);
    const res = await POST();
    const data = await res.json();
    expect(data.synced).toBe(0);
  });

  it("returns { synced: 0 } when no undecided sessions", async () => {
    db.compareSession.findMany.mockResolvedValue([]);
    // Also mock stale cleanup query
    db.aiActionItem.findMany.mockResolvedValue([]);

    const res = await POST();
    const data = await res.json();
    expect(data.synced).toBe(0);
    expect(createWorkItem).not.toHaveBeenCalled();
  });

  it("creates queue item for new session", async () => {
    db.compareSession.findMany.mockResolvedValue([mockSession]);
    db.aiActionItem.findMany
      .mockResolvedValueOnce([])   // existing items query
      .mockResolvedValueOnce([]);  // stale cleanup query

    const res = await POST();
    const data = await res.json();

    expect(data.synced).toBe(1);
    expect(createWorkItem).toHaveBeenCalledTimes(1);
    expect(createWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "COMPARE_DECISION",
        relatedEntityId: "session-1",
        relatedEntityType: "COMPARE_SESSION",
      })
    );
  });

  it("does not create duplicate when active item exists (idempotency)", async () => {
    db.compareSession.findMany.mockResolvedValue([mockSession]);
    db.aiActionItem.findMany
      .mockResolvedValueOnce([
        { id: "item-1", relatedEntityId: "session-1", substatus: "compare_decision_pending", taskStatus: "REVIEW_NEEDED" },
      ])
      .mockResolvedValueOnce([]); // stale cleanup

    const res = await POST();
    const data = await res.json();

    expect(data.synced).toBe(0);
    expect(createWorkItem).not.toHaveBeenCalled();
    expect(transitionWorkItem).not.toHaveBeenCalled();
  });

  it("does not create duplicate when completed item exists (no reopen without UNDECIDED)", async () => {
    // Session is UNDECIDED (in query) with a completed item → should reopen
    db.compareSession.findMany.mockResolvedValue([mockSession]);
    db.aiActionItem.findMany
      .mockResolvedValueOnce([
        { id: "item-1", relatedEntityId: "session-1", substatus: "compare_decided", taskStatus: "COMPLETED" },
      ])
      .mockResolvedValueOnce([]); // stale cleanup

    const res = await POST();
    const data = await res.json();

    expect(data.synced).toBe(1);
    expect(createWorkItem).not.toHaveBeenCalled();
    expect(transitionWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "item-1",
        substatus: "compare_reopened",
      })
    );
  });

  it("transitions substatus when lifecycle changes (inquiry followup)", async () => {
    const sessionWithInquiry = {
      ...mockSession,
      inquiryDrafts: [{ status: "GENERATED" }],
    };
    db.compareSession.findMany.mockResolvedValue([sessionWithInquiry]);
    db.aiActionItem.findMany
      .mockResolvedValueOnce([
        { id: "item-1", relatedEntityId: "session-1", substatus: "compare_decision_pending", taskStatus: "REVIEW_NEEDED" },
      ])
      .mockResolvedValueOnce([]); // stale cleanup

    const res = await POST();
    const data = await res.json();

    expect(data.synced).toBe(1);
    expect(transitionWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "item-1",
        substatus: "compare_inquiry_followup",
      })
    );
  });

  it("transitions substatus when lifecycle changes (quote in progress)", async () => {
    db.compareSession.findMany.mockResolvedValue([mockSession]);
    db.quote.findMany.mockResolvedValue([
      { comparisonId: "session-1", status: "PENDING" },
    ]);
    db.aiActionItem.findMany
      .mockResolvedValueOnce([
        { id: "item-1", relatedEntityId: "session-1", substatus: "compare_decision_pending", taskStatus: "REVIEW_NEEDED" },
      ])
      .mockResolvedValueOnce([]); // stale cleanup

    const res = await POST();
    const data = await res.json();

    expect(data.synced).toBe(1);
    expect(transitionWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "item-1",
        substatus: "compare_quote_in_progress",
      })
    );
  });

  it("cleans up stale items for sessions no longer undecided", async () => {
    db.compareSession.findMany.mockResolvedValue([mockSession]);
    db.aiActionItem.findMany
      .mockResolvedValueOnce([
        { id: "item-1", relatedEntityId: "session-1", substatus: "compare_decision_pending", taskStatus: "REVIEW_NEEDED" },
      ])
      // Stale cleanup: returns an item for a session NOT in the undecided set
      .mockResolvedValueOnce([
        { id: "stale-item", relatedEntityId: "session-old" },
      ]);

    await POST();

    // stale item should be transitioned to compare_decided
    expect(transitionWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "stale-item",
        substatus: "compare_decided",
      })
    );
  });
});
