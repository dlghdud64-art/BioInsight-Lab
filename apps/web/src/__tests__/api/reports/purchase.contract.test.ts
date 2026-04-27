/**
 * Contract test for GET /api/reports/purchase (§11.46)
 *
 * Asserts the response shape that the /dashboard/reports client
 * (apps/web/src/app/dashboard/reports/page.tsx) depends on:
 *   - categoryData[]: { name: string, amount: number }
 *   - vendorData[]:   { name: string, amount: number }
 *   - monthlyData[]:  { month: string, amount: number }
 *
 * §11.42 closed a silent contract drift where the server returned
 * `{ name, amount }` but the client expected `{ name, value }` for
 * categoryData and `{ vendor, amount }` for vendorData. The drift
 * survived a release because no shape test existed. This test
 * prevents recurrence.
 *
 * See ADR-002 §11.42 (drift fix) and §11.46 (this guard).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockJsonResponse } from "@/__tests__/helpers/response-mock";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) =>
      mockJsonResponse(data, init),
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    quote: { findMany: vi.fn() },
    purchaseRecord: { findMany: vi.fn() },
    budget: { findMany: vi.fn() },
  },
}));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { GET } from "@/app/api/reports/purchase/route";

const mockedAuth = vi.mocked(auth);
const mockedDb = vi.mocked(db, true);

function makeRequest(qs = ""): Request {
  return new Request(`http://localhost:3000/api/reports/purchase${qs ? `?${qs}` : ""}`);
}

describe("GET /api/reports/purchase — contract shape (§11.46)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error — auth() returns NextAuth Session | null; for the
    // route handler's purposes only `.user.id` is read.
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockedDb.budget.findMany.mockResolvedValue([] as never);
    mockedDb.quote.findMany.mockResolvedValue([] as never);
  });

  it("categoryData entries carry { name: string, amount: number }", async () => {
    mockedDb.purchaseRecord.findMany.mockResolvedValue([
      {
        id: "rec-1",
        scopeKey: "guest-demo",
        category: "REAGENT",
        vendorName: "Thermo Fisher",
        itemName: "Trypsin-EDTA",
        amount: 45000,
        purchasedAt: new Date("2026-04-26T00:00:00Z"),
      },
    ] as never);

    const res = await GET(makeRequest() as never);
    const json = await res.json();

    expect(Array.isArray(json.categoryData)).toBe(true);
    expect(json.categoryData.length).toBeGreaterThan(0);
    const cat = json.categoryData[0];
    // ⚠️ contract — the /dashboard/reports client filters by `c.amount > 0`
    // and renders pie slices with `dataKey="amount"`. If this changes to
    // `value`, every donut + KPI in the reports page silently breaks.
    expect(cat).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        amount: expect.any(Number),
      }),
    );
    // Negative shape — must NOT have legacy `value` field that the
    // pre-§11.42 client depended on.
    expect(cat).not.toHaveProperty("value");
  });

  it("vendorData entries carry { name: string, amount: number }", async () => {
    mockedDb.purchaseRecord.findMany.mockResolvedValue([
      {
        id: "rec-1",
        scopeKey: "guest-demo",
        category: "REAGENT",
        vendorName: "Thermo Fisher Scientific",
        itemName: "Trypsin-EDTA",
        amount: 45000,
        purchasedAt: new Date("2026-04-26T00:00:00Z"),
      },
    ] as never);

    const res = await GET(makeRequest() as never);
    const json = await res.json();

    expect(Array.isArray(json.vendorData)).toBe(true);
    expect(json.vendorData.length).toBeGreaterThan(0);
    const vendor = json.vendorData[0];
    // ⚠️ contract — the /dashboard/reports client renders the bar
    // chart Y-axis with `<YAxis dataKey="name">`. Pre-§11.42 the
    // server emitted `{ vendor, amount }` and the chart silently
    // showed empty Y-axis labels.
    expect(vendor).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        amount: expect.any(Number),
      }),
    );
    expect(vendor).not.toHaveProperty("vendor");
  });

  it("monthlyData entries carry { month: string, amount: number }", async () => {
    mockedDb.purchaseRecord.findMany.mockResolvedValue([
      {
        id: "rec-1",
        scopeKey: "guest-demo",
        category: "REAGENT",
        vendorName: "Thermo Fisher",
        itemName: "Trypsin-EDTA",
        amount: 45000,
        purchasedAt: new Date("2026-04-26T00:00:00Z"),
      },
    ] as never);

    const res = await GET(makeRequest() as never);
    const json = await res.json();

    expect(Array.isArray(json.monthlyData)).toBe(true);
    expect(json.monthlyData.length).toBeGreaterThan(0);
    const m = json.monthlyData[0];
    expect(m).toEqual(
      expect.objectContaining({
        month: expect.any(String), // "YYYY-MM"
        amount: expect.any(Number),
      }),
    );
    expect(m.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("returns the documented top-level keys (no silent rename)", async () => {
    mockedDb.purchaseRecord.findMany.mockResolvedValue([] as never);

    const res = await GET(makeRequest() as never);
    const json = await res.json();

    // Top-level keys consumed by /dashboard/reports:
    expect(json).toHaveProperty("metrics");
    expect(json).toHaveProperty("monthlyData");
    expect(json).toHaveProperty("vendorData");
    expect(json).toHaveProperty("categoryData");
    expect(json).toHaveProperty("details");
    expect(json).toHaveProperty("budgetUsage");

    // metrics shape used by the KPI strip:
    expect(json.metrics).toEqual(
      expect.objectContaining({
        totalAmount: expect.any(Number),
        vendorCount: expect.any(Number),
        itemCount: expect.any(Number),
      }),
    );
  });
});
