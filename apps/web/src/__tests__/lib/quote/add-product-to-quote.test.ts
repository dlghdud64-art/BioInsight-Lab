/**
 * apps/web/src/__tests__/lib/quote/add-product-to-quote.test.ts
 *
 * Tests for #P02-e2e-blocker fix — sourcing → quote candidacy
 * pure-function path. Covers:
 *   - vendor present (new / duplicate / explicit vendorId)
 *   - vendor absent (new / duplicate)  ← previously silent dead path
 *   - missing productId (only true failure case)
 *
 * The function is pure: it takes the current quoteItems list + a
 * product input + optional vendorId, returns the next list and a
 * result mode. No React, no toast, no network.
 *
 * Goal: fake-success ("Toast says it worked while state stayed at 0")
 * stops being possible because the call site can branch on the
 * result mode.
 */

import { describe, it, expect } from "vitest";

import {
  computeAddToQuote,
  type ComputeAddToQuoteInput,
  type ProductInput,
  type ProductVendorInput,
  type QuoteCandidateItem,
} from "@/lib/quote/add-product-to-quote";

// ──────────────────────────────────────────────────────────
// Builders
// ──────────────────────────────────────────────────────────

let idCounter = 0;
const stableId = () => {
  idCounter += 1;
  return `item-test-${idCounter}`;
};

function vendor(
  vendorId: string,
  overrides: Partial<ProductVendorInput> = {},
): ProductVendorInput {
  return {
    vendor: { id: vendorId, name: `Vendor ${vendorId}` },
    priceInKRW: 50_000,
    currency: "KRW",
    ...overrides,
  };
}

function product(
  id: string,
  vendors: ProductVendorInput[] | undefined,
  overrides: Partial<ProductInput> = {},
): ProductInput {
  return {
    id,
    name: `Product ${id}`,
    brand: "TestBrand",
    vendors,
    ...overrides,
  };
}

function input(
  p: ProductInput,
  currentItems: readonly QuoteCandidateItem[] = [],
  vendorId?: string,
): ComputeAddToQuoteInput {
  return {
    product: p,
    currentItems,
    vendorId,
    nextId: stableId,
  };
}

// ──────────────────────────────────────────────────────────
// Cases
// ──────────────────────────────────────────────────────────

describe("computeAddToQuote", () => {
  // 1. vendor 있는 신규 → mode="added"
  it("[1] product with vendors, new candidacy → added with vendor wired", () => {
    const p = product("p1", [vendor("v1", { priceInKRW: 30_000 })]);

    const r = computeAddToQuote(input(p));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe("added");
    expect(r.nextItems).toHaveLength(1);
    expect(r.nextItems[0]).toMatchObject({
      productId: "p1",
      productName: "Product p1",
      vendorId: "v1",
      vendorName: "Vendor v1",
      unitPrice: 30_000,
      currency: "KRW",
      quantity: 1,
      lineTotal: 30_000,
    });
    expect(r.itemId).toBe(r.nextItems[0].id);
  });

  // 2. vendor 있는 중복 (같은 product+vendor) → mode="merged", 수량 +1
  it("[2] same product + same vendor twice → merged with quantity bumped", () => {
    const p = product("p1", [vendor("v1", { priceInKRW: 30_000 })]);
    const first = computeAddToQuote(input(p));
    if (!first.ok) throw new Error("first add must succeed");

    const r = computeAddToQuote(input(p, first.nextItems));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe("merged");
    expect(r.nextItems).toHaveLength(1);
    expect(r.nextItems[0]).toMatchObject({
      productId: "p1",
      vendorId: "v1",
      quantity: 2,
      unitPrice: 30_000,
      lineTotal: 60_000,
    });
    expect(r.itemId).toBe(r.nextItems[0].id);
  });

  // 3. vendor 없는 신규 → mode="vendor-pending"
  //    (Trypsin-EDTA 100ml 같은 pilot 시드 product 케이스)
  it("[3] product with no vendors → vendor-pending, vendorId='', unitPrice=0", () => {
    const p = product("p2", []);

    const r = computeAddToQuote(input(p));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe("vendor-pending");
    expect(r.nextItems).toHaveLength(1);
    expect(r.nextItems[0]).toMatchObject({
      productId: "p2",
      productName: "Product p2",
      vendorId: "",
      vendorName: "TestBrand", // brand fallback
      unitPrice: 0,
      currency: "KRW",
      quantity: 1,
      lineTotal: 0,
    });
  });

  // 4. vendor 없는 중복 (같은 vendor-pending 후보 재추가) → mode="merged"
  it("[4] vendor-pending duplicate → merged keeps vendorId='' and bumps quantity", () => {
    const p = product("p2", undefined);
    const first = computeAddToQuote(input(p));
    if (!first.ok) throw new Error("first add must succeed");

    const r = computeAddToQuote(input(p, first.nextItems));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe("merged");
    expect(r.nextItems).toHaveLength(1);
    expect(r.nextItems[0]).toMatchObject({
      productId: "p2",
      vendorId: "",
      unitPrice: 0,
      quantity: 2,
      lineTotal: 0,
    });
  });

  // 5. vendorId 인자 명시 → 해당 vendor 선택, mode="added"
  it("[5] explicit vendorId picks the matching vendor, not the first", () => {
    const p = product("p3", [
      vendor("v1", { priceInKRW: 30_000 }),
      vendor("v2", { priceInKRW: 50_000 }),
      vendor("v3", { priceInKRW: 70_000 }),
    ]);

    const r = computeAddToQuote(input(p, [], "v2"));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe("added");
    expect(r.nextItems[0]).toMatchObject({
      productId: "p3",
      vendorId: "v2",
      vendorName: "Vendor v2",
      unitPrice: 50_000,
      lineTotal: 50_000,
    });
  });

  // 6. productId 없음 (또는 비어있음) → ok:false, reason="missing-product-id"
  it("[6] product without an id → ok=false, reason='missing-product-id'", () => {
    const p = product("", [vendor("v1")]);
    p.id = ""; // explicit empty

    const r = computeAddToQuote(input(p));

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("missing-product-id");
  });

  // 7. vendor 있지만 vendorId 매칭 실패 → fallback to first vendor (createQuote 와 동일 의미)
  it("[7] explicit vendorId not in vendors → falls back to first, mode='added'", () => {
    const p = product("p4", [vendor("v1", { priceInKRW: 30_000 })]);

    const r = computeAddToQuote(input(p, [], "v-nonexistent"));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe("added");
    expect(r.nextItems[0]).toMatchObject({
      productId: "p4",
      vendorId: "v1",
      unitPrice: 30_000,
    });
  });

  // 8. 다른 product 추가 시 기존 후보 보존
  it("[8] adding a second different product preserves the first item", () => {
    const a = product("p-a", [vendor("v1", { priceInKRW: 30_000 })]);
    const b = product("p-b", [vendor("v2", { priceInKRW: 70_000 })]);

    const first = computeAddToQuote(input(a));
    if (!first.ok) throw new Error("first add must succeed");

    const r = computeAddToQuote(input(b, first.nextItems));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe("added");
    expect(r.nextItems).toHaveLength(2);
    expect(r.nextItems.map((i) => i.productId).sort()).toEqual(["p-a", "p-b"]);
  });
});
