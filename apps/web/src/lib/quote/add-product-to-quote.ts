/**
 * apps/web/src/lib/quote/add-product-to-quote.ts
 *
 * Pure composer for the sourcing → quote candidacy step.
 *
 * Why this exists (#P02-e2e-blocker, ADR-002 §11.16 follow-up)
 * --------------------------------------------------------------
 * The previous addProductToQuote in test-flow-provider.tsx had a
 * silent dead path: when a product had no vendors it
 *   `console.warn("No vendor found for product", id); return;`
 * while the call site (sourcing-result-row) fired
 *   `toast.success("견적함에 성공적으로 담겼습니다.")`
 * unconditionally. The toast lied; the candidacy state never moved.
 *
 * Pilot tenant catalog seeds 15 products with zero ProductVendor
 * rows by design (see scripts/pilot/pilot.ts §92-94 — vendor backfill
 * was deferred to #P02). Every "견적 담기" click therefore hit the
 * fake-success branch.
 *
 * This module fixes the rule: "vendor missing" is a normal LabAxis
 * ontology state ("견적 필요") and must produce a real candidacy
 * row. The call site decides toast copy from the result mode, never
 * from optimistic assumptions.
 *
 * Contract
 * --------
 * - Pure: no React, no toast, no clock unless injected.
 * - Returns the *next* items list — caller is responsible for
 *   committing it via setQuoteItems / Redux / wherever.
 * - The only `ok: false` case is a missing productId. Vendor absence
 *   is a successful "vendor-pending" candidacy.
 */

export type ProductVendorInput = {
  vendor?: { id?: string; name?: string };
  priceInKRW?: number;
  currency?: string;
};

export type ProductInput = {
  id: string;
  name?: string;
  brand?: string;
  vendors?: ProductVendorInput[];
};

export type QuoteCandidateItem = {
  id: string;
  productId: string;
  productName: string;
  vendorId: string; // "" when vendor-pending
  vendorName: string;
  unitPrice: number; // 0 when vendor-pending
  currency: string;
  quantity: number;
  lineTotal: number;
  notes: string;
};

export type ComputeAddToQuoteInput = {
  product: ProductInput;
  vendorId?: string;
  currentItems: readonly QuoteCandidateItem[];
  /**
   * Override item-id generator for deterministic tests.
   * Default: timestamp + short random suffix.
   */
  nextId?: () => string;
};

export type ComputeAddToQuoteResult =
  | {
      ok: true;
      /**
       * "added"          → new candidacy with a vendor wired.
       * "vendor-pending" → new candidacy without a vendor; price=0.
       *                    Caller must label this differently in the UI.
       * "merged"         → same product+vendor already in the list,
       *                    quantity bumped by 1.
       */
      mode: "added" | "vendor-pending" | "merged";
      nextItems: QuoteCandidateItem[];
      itemId: string;
    }
  | { ok: false; reason: "missing-product-id" };

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function pickVendor(
  vendors: ProductVendorInput[] | undefined,
  vendorId?: string,
): ProductVendorInput | undefined {
  if (!vendors || vendors.length === 0) return undefined;
  if (vendorId) {
    const match = vendors.find((v) => v.vendor?.id === vendorId);
    if (match) return match;
  }
  return vendors[0];
}

function defaultNextId(): string {
  // Suffix avoids collisions when callers add multiple items inside
  // the same millisecond (e.g. "select all → add to quote").
  const random = Math.random().toString(36).slice(2, 8);
  return `item-${Date.now()}-${random}`;
}

// ──────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────

export function computeAddToQuote(
  input: ComputeAddToQuoteInput,
): ComputeAddToQuoteResult {
  const { product, vendorId, currentItems, nextId = defaultNextId } = input;

  if (!product?.id) {
    return { ok: false, reason: "missing-product-id" };
  }

  const selected = pickVendor(product.vendors, vendorId);
  const resolvedVendorId = selected?.vendor?.id || "";
  const resolvedVendorName = selected?.vendor?.name || product.brand || "";
  const unitPrice = selected?.priceInKRW || 0;
  const currency = selected?.currency || "KRW";

  // Duplicate detection keys on (productId, vendorId). Two candidacies
  // for the same product but different vendors are valid — the user
  // is comparison shopping. vendor-pending duplicates also collapse
  // because their vendorId is "" on both sides.
  const existingIndex = currentItems.findIndex(
    (item) =>
      item.productId === product.id && item.vendorId === resolvedVendorId,
  );

  if (existingIndex >= 0) {
    const existing = currentItems[existingIndex];
    const nextQuantity = (existing.quantity || 1) + 1;
    const merged: QuoteCandidateItem = {
      ...existing,
      quantity: nextQuantity,
      lineTotal: existing.unitPrice * nextQuantity,
    };
    const nextItems = [
      ...currentItems.slice(0, existingIndex),
      merged,
      ...currentItems.slice(existingIndex + 1),
    ];
    return { ok: true, mode: "merged", nextItems, itemId: merged.id };
  }

  const newItem: QuoteCandidateItem = {
    id: nextId(),
    productId: product.id,
    productName: product.name || "",
    vendorId: resolvedVendorId,
    vendorName: resolvedVendorName,
    unitPrice,
    currency,
    quantity: 1,
    lineTotal: unitPrice,
    notes: "",
  };

  const nextItems = [...currentItems, newItem];
  const mode: "added" | "vendor-pending" = selected ? "added" : "vendor-pending";
  return { ok: true, mode, nextItems, itemId: newItem.id };
}
