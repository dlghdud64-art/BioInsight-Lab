/**
 * #vendor-partnership-tier Phase 3 — RED test
 *
 * Goal: resolveSuppliers 의 confidence 가 partnership tier 기반 boost.
 *       호영님 결정 5A:
 *         DIRECT_PARTNER / VERIFIED → "high"
 *         GENERAL → "medium"
 *         UNVERIFIED → "low"
 *
 * canonical truth lock:
 *   - overlay: organizationVendor.partnershipTier (override) > vendor.partnershipTier (baseline) > GENERAL fallback.
 *   - 4-source priority chain (recent_rfq → org_book → supplier_book → ai_recommended) 보존.
 *   - isPrimary 와 partnership tier 공존 — tier 가 confidence 결정, isPrimary 는 reason boost.
 *   - backward compat — tier 미전달 시 기존 동작 보존 (org_book isPrimary boost / supplier_book "high").
 */

import { describe, it, expect } from "vitest";
import { resolveSuppliers } from "../../../components/quotes/dispatch/resolve-suppliers";

// ── Helpers ──
function emptyQuote(extras: Record<string, unknown> = {}) {
  return { id: "q-test", items: [], ...extras } as any;
}

describe("#vendor-partnership-tier Phase 3 — org_book confidence by tier", () => {
  it("DIRECT_PARTNER → confidence 'high'", () => {
    const result = resolveSuppliers({
      quote: emptyQuote(),
      organizationVendors: [
        { id: "ov1", vendorName: "v1", vendorEmail: "a@x.com", partnershipTier: "DIRECT_PARTNER" } as any,
      ],
    });
    expect(result[0].confidence).toBe("high");
  });

  it("VERIFIED → 'high'", () => {
    const result = resolveSuppliers({
      quote: emptyQuote(),
      organizationVendors: [
        { id: "ov2", vendorName: "v2", vendorEmail: "b@x.com", partnershipTier: "VERIFIED" } as any,
      ],
    });
    expect(result[0].confidence).toBe("high");
  });

  it("GENERAL → 'medium'", () => {
    const result = resolveSuppliers({
      quote: emptyQuote(),
      organizationVendors: [
        { id: "ov3", vendorName: "v3", vendorEmail: "c@x.com", partnershipTier: "GENERAL" } as any,
      ],
    });
    expect(result[0].confidence).toBe("medium");
  });

  it("UNVERIFIED → 'low'", () => {
    const result = resolveSuppliers({
      quote: emptyQuote(),
      organizationVendors: [
        { id: "ov4", vendorName: "v4", vendorEmail: "d@x.com", partnershipTier: "UNVERIFIED" } as any,
      ],
    });
    expect(result[0].confidence).toBe("low");
  });
});

describe("#vendor-partnership-tier Phase 3 — supplier_book confidence by vendor.partnershipTier", () => {
  it("Vendor.partnershipTier DIRECT_PARTNER → 'high'", () => {
    const result = resolveSuppliers({
      quote: emptyQuote({
        items: [{
          product: {
            name: "p1",
            vendors: [{ vendor: { id: "v1", name: "vendor1", email: "x@y.com", partnershipTier: "DIRECT_PARTNER" } }],
          },
        }],
      }),
    });
    const found = result.find(r => r.email === "x@y.com");
    expect(found?.confidence).toBe("high");
  });

  it("Vendor.partnershipTier UNVERIFIED → 'low'", () => {
    const result = resolveSuppliers({
      quote: emptyQuote({
        items: [{
          product: {
            name: "p2",
            vendors: [{ vendor: { id: "v2", name: "vendor2", email: "y@y.com", partnershipTier: "UNVERIFIED" } }],
          },
        }],
      }),
    });
    const found = result.find(r => r.email === "y@y.com");
    expect(found?.confidence).toBe("low");
  });

  it("Vendor.partnershipTier GENERAL → 'medium'", () => {
    const result = resolveSuppliers({
      quote: emptyQuote({
        items: [{
          product: {
            name: "p3",
            vendors: [{ vendor: { id: "v3", name: "vendor3", email: "z@y.com", partnershipTier: "GENERAL" } }],
          },
        }],
      }),
    });
    const found = result.find(r => r.email === "z@y.com");
    expect(found?.confidence).toBe("medium");
  });
});

describe("#vendor-partnership-tier Phase 3 — overlay (org override > vendor baseline)", () => {
  it("OrganizationVendor.partnershipTier 가 글로벌 baseline 보다 우선", () => {
    // org_book 가 먼저 잡혀서 supplier_book 못 도달 — overlay 효과 검증.
    const result = resolveSuppliers({
      quote: emptyQuote({
        items: [{
          product: {
            name: "p",
            vendors: [{ vendor: { id: "vG", name: "global", email: "same@x.com", partnershipTier: "DIRECT_PARTNER" } }],
          },
        }],
      }),
      organizationVendors: [
        { id: "ov", vendorName: "org", vendorEmail: "same@x.com", partnershipTier: "UNVERIFIED" } as any,
      ],
    });
    // org_book 먼저 처리 → UNVERIFIED tier → "low"
    expect(result[0].confidence).toBe("low");
    expect(result[0].contactSource).toBe("org_book");
  });
});

describe("#vendor-partnership-tier Phase 3 — backward compat", () => {
  it("partnershipTier 없는 org_book + isPrimary → 'high' (기존 동작 보존)", () => {
    const result = resolveSuppliers({
      quote: emptyQuote(),
      organizationVendors: [
        { id: "ov-bp", vendorName: "v", vendorEmail: "p@x.com", isPrimary: true } as any,
      ],
    });
    expect(result[0].confidence).toBe("high");
  });

  it("partnershipTier 없는 org_book + !isPrimary → 'medium' (기존 동작 보존)", () => {
    const result = resolveSuppliers({
      quote: emptyQuote(),
      organizationVendors: [
        { id: "ov-np", vendorName: "v", vendorEmail: "n@x.com", isPrimary: false } as any,
      ],
    });
    expect(result[0].confidence).toBe("medium");
  });

  it("partnershipTier 없는 supplier_book → 'high' (기존 동작 보존)", () => {
    const result = resolveSuppliers({
      quote: emptyQuote({
        items: [{
          product: {
            name: "p",
            vendors: [{ vendor: { id: "vN", name: "v", email: "n@y.com" } }],
          },
        }],
      }),
    });
    const found = result.find(r => r.email === "n@y.com");
    expect(found?.confidence).toBe("high");
  });
});

describe("#vendor-partnership-tier Phase 3 — recent_rfq 보존 (외부 actor, tier 무관)", () => {
  it("recent_rfq RESPONDED → 'high' (기존 동작)", () => {
    const result = resolveSuppliers({
      quote: emptyQuote(),
      vendorRequests: [
        { id: "vr1", vendorEmail: "r@x.com", vendorName: "r", status: "RESPONDED" },
      ],
    });
    expect(result[0].confidence).toBe("high");
  });

  it("recent_rfq SENT (회신 전) → 'medium' (기존 동작)", () => {
    const result = resolveSuppliers({
      quote: emptyQuote(),
      vendorRequests: [
        { id: "vr2", vendorEmail: "s@x.com", vendorName: "s", status: "SENT" },
      ],
    });
    expect(result[0].confidence).toBe("medium");
  });
});

describe("#vendor-partnership-tier Phase 3 — 4-source priority chain 보존", () => {
  it("recent_rfq 가 org_book 보다 우선", () => {
    const result = resolveSuppliers({
      quote: emptyQuote(),
      vendorRequests: [
        { id: "vr", vendorEmail: "shared@x.com", vendorName: "rfq", status: "RESPONDED" },
      ],
      organizationVendors: [
        { id: "ov", vendorName: "org", vendorEmail: "shared@x.com", partnershipTier: "UNVERIFIED" } as any,
      ],
    });
    expect(result[0].contactSource).toBe("recent_rfq");
  });
});

describe("#vendor-partnership-tier Phase 3 — cluster trace marker", () => {
  it("source 코드에 #vendor-partnership-tier marker", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const src = fs.readFileSync(path.resolve(__dirname, "../../../components/quotes/dispatch/resolve-suppliers.ts"), "utf8");
    expect(src).toMatch(/#vendor-partnership-tier|partnershipTier|PARTNERSHIP_TIER/);
  });
});
