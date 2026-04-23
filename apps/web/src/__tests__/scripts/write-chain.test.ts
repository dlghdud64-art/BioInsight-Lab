/**
 * ADR-001 Path C regression — write-chain builder + assertion contract.
 *
 * We unit-test the pure helpers only: every builder must produce data
 * scoped to the sentinel, and the assertion helpers must reject any
 * row that escapes the sentinel (the canonical-truth protection lives
 * here even though the script writes through Prisma at runtime).
 */

import { describe, it, expect } from "vitest";
import {
  SENTINEL_ORG_ID,
  SENTINEL_WORKSPACE_ID,
  SENTINEL_USER_ID,
  SENTINEL_PRODUCT_ID,
} from "../../../scripts/smoke/sentinel";
import {
  createRunContext,
  buildSmokeQuoteData,
  buildSmokeQuoteItemData,
  buildSmokeOrderData,
  buildSmokeOrderItemData,
  buildSmokeInventoryWhere,
  assertSentinelScoped,
  assertSentinelUserOwned,
} from "../../../scripts/smoke/write-chain";

describe("createRunContext", () => {
  it("derives a deterministic runId from the supplied timestamp", () => {
    const ctx = createRunContext(1_700_000_000_000);
    expect(ctx.runId).toBe("smoke-1700000000000");
    expect(ctx.startedAt.getTime()).toBe(1_700_000_000_000);
  });

  it("produces distinct runIds across different timestamps", () => {
    const a = createRunContext(1_700_000_000_000);
    const b = createRunContext(1_700_000_000_001);
    expect(a.runId).not.toBe(b.runId);
  });
});

describe("buildSmokeQuoteData", () => {
  it("always scopes to the sentinel user / org / workspace", () => {
    const data = buildSmokeQuoteData("smoke-42");
    expect(data.userId).toBe(SENTINEL_USER_ID);
    expect(data.organizationId).toBe(SENTINEL_ORG_ID);
    expect(data.workspaceId).toBe(SENTINEL_WORKSPACE_ID);
  });

  it("always starts the Quote in PENDING with KRW currency", () => {
    const data = buildSmokeQuoteData("smoke-42");
    expect(data.status).toBe("PENDING");
    expect(data.currency).toBe("KRW");
  });

  it("embeds the runId in the human-readable title", () => {
    const data = buildSmokeQuoteData("smoke-xyz");
    expect(data.title).toContain("smoke-xyz");
  });
});

describe("buildSmokeQuoteItemData", () => {
  it("targets the sentinel product", () => {
    const data = buildSmokeQuoteItemData();
    expect(data.productId).toBe(SENTINEL_PRODUCT_ID);
  });

  it("uses safe fixed numbers (1 @ 10_000 KRW)", () => {
    const data = buildSmokeQuoteItemData();
    expect(data.quantity).toBe(1);
    expect(data.unitPrice).toBe(10000);
    expect(data.lineTotal).toBe(10000);
    expect(data.unit).toBe("ea");
    expect(data.currency).toBe("KRW");
  });
});

describe("buildSmokeOrderData", () => {
  it("scopes to the sentinel user / org and the passed-in quoteId", () => {
    const data = buildSmokeOrderData("smoke-99", "quote-abc");
    expect(data.userId).toBe(SENTINEL_USER_ID);
    expect(data.organizationId).toBe(SENTINEL_ORG_ID);
    expect(data.quoteId).toBe("quote-abc");
  });

  it("derives orderNumber from the runId with an ORD-SMOKE prefix", () => {
    const data = buildSmokeOrderData("smoke-777", "quote-zzz");
    expect(data.orderNumber).toBe("ORD-SMOKE-smoke-777");
  });

  it("keeps totalAmount at the fixed 10_000 KRW value", () => {
    const data = buildSmokeOrderData("smoke-1", "quote-1");
    expect(data.totalAmount).toBe(10000);
  });
});

describe("buildSmokeOrderItemData", () => {
  it("uses fixed 1 @ 10_000 KRW line", () => {
    const data = buildSmokeOrderItemData();
    expect(data.quantity).toBe(1);
    expect(data.unitPrice).toBe(10000);
    expect(data.lineTotal).toBe(10000);
  });
});

describe("buildSmokeInventoryWhere", () => {
  it("builds the compound where clause strictly from sentinel identifiers", () => {
    const where = buildSmokeInventoryWhere();
    expect(where.organizationId_productId.organizationId).toBe(SENTINEL_ORG_ID);
    expect(where.organizationId_productId.productId).toBe(SENTINEL_PRODUCT_ID);
  });

  it("has no other keys that could broaden the scope", () => {
    const where = buildSmokeInventoryWhere();
    expect(Object.keys(where)).toEqual(["organizationId_productId"]);
    expect(Object.keys(where.organizationId_productId).sort()).toEqual([
      "organizationId",
      "productId",
    ]);
  });
});

describe("assertSentinelScoped", () => {
  it("accepts rows whose organizationId matches the sentinel", () => {
    expect(() =>
      assertSentinelScoped({ organizationId: SENTINEL_ORG_ID }),
    ).not.toThrow();
  });

  it("throws when organizationId is null", () => {
    expect(() => assertSentinelScoped({ organizationId: null })).toThrow(
      /scope violation/,
    );
  });

  it("throws when organizationId is missing", () => {
    expect(() => assertSentinelScoped({})).toThrow(/scope violation/);
  });

  it("throws when organizationId is a stray org id (e.g. #16c)", () => {
    expect(() =>
      assertSentinelScoped({ organizationId: "some-other-org" }),
    ).toThrow(/scope violation/);
  });
});

describe("assertSentinelUserOwned", () => {
  it("accepts rows whose userId matches the sentinel user", () => {
    expect(() =>
      assertSentinelUserOwned({ userId: SENTINEL_USER_ID }),
    ).not.toThrow();
  });

  it("throws when userId is null or missing", () => {
    expect(() => assertSentinelUserOwned({ userId: null })).toThrow(
      /owner violation/,
    );
    expect(() => assertSentinelUserOwned({})).toThrow(/owner violation/);
  });

  it("throws when userId belongs to another user", () => {
    expect(() =>
      assertSentinelUserOwned({ userId: "some-real-user-id" }),
    ).toThrow(/owner violation/);
  });
});
