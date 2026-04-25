/**
 * apps/web/src/__tests__/lib/quote/resolve-add-to-quote-toast.test.ts
 *
 * Tests for #P02-e2e-blocker fix — call-site toast policy.
 *
 * The toast text MUST follow the result mode, not optimistic
 * assumptions. Three success modes (added / vendor-pending / merged)
 * each get distinct copy; the only failure mode (missing-product-id)
 * gets an error toast.
 */

import { describe, it, expect } from "vitest";

import { resolveAddToQuoteToast } from "@/lib/quote/resolve-add-to-quote-toast";
import type { ComputeAddToQuoteResult } from "@/lib/quote/add-product-to-quote";

// ──────────────────────────────────────────────────────────
// Builders
// ──────────────────────────────────────────────────────────

const ITEM_BASE = {
  id: "item-1",
  productId: "p1",
  productName: "Trypsin-EDTA 100ml",
  vendorId: "",
  vendorName: "",
  unitPrice: 0,
  currency: "KRW",
  quantity: 1,
  lineTotal: 0,
  notes: "",
} as const;

function ok(
  mode: "added" | "vendor-pending" | "merged",
): ComputeAddToQuoteResult {
  return { ok: true, mode, nextItems: [ITEM_BASE], itemId: ITEM_BASE.id };
}

function fail(): ComputeAddToQuoteResult {
  return { ok: false, reason: "missing-product-id" };
}

// ──────────────────────────────────────────────────────────
// Cases
// ──────────────────────────────────────────────────────────

describe("resolveAddToQuoteToast", () => {
  it("[1] mode='added' → success intent + canonical copy", () => {
    const t = resolveAddToQuoteToast(ok("added"));
    expect(t.intent).toBe("success");
    expect(t.message).toContain("견적함");
    expect(t.message).not.toContain("가격은");
    expect(t.message).not.toContain("수량을");
  });

  it("[2] mode='vendor-pending' → info intent, copy must mention price-pending", () => {
    const t = resolveAddToQuoteToast(ok("vendor-pending"));
    expect(t.intent).toBe("info");
    expect(t.message).toContain("후보");
    expect(t.message).toMatch(/가격|단가|견적/);
    // Must NOT promise a confirmed price.
    expect(t.message).not.toContain("성공적으로 담겼");
  });

  it("[3] mode='merged' → info intent, copy must mention quantity bump", () => {
    const t = resolveAddToQuoteToast(ok("merged"));
    expect(t.intent).toBe("info");
    expect(t.message).toMatch(/수량|이미/);
    // Must NOT claim a fresh add.
    expect(t.message).not.toContain("성공적으로 담겼");
  });

  it("[4] ok=false reason='missing-product-id' → error intent", () => {
    const t = resolveAddToQuoteToast(fail());
    expect(t.intent).toBe("error");
    expect(t.message.length).toBeGreaterThan(0);
    // Must NOT say "성공" anywhere.
    expect(t.message).not.toMatch(/성공/);
  });

  it("[5] all three success modes produce distinct copy (no fake-success collision)", () => {
    const a = resolveAddToQuoteToast(ok("added")).message;
    const v = resolveAddToQuoteToast(ok("vendor-pending")).message;
    const m = resolveAddToQuoteToast(ok("merged")).message;
    expect(new Set([a, v, m]).size).toBe(3);
  });
});
