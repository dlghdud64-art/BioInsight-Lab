/**
 * #vendor-catalog-product-matching Phase 3 — RED test
 *
 * Goal: resolveSuppliers 가 quote.items × organizationVendorProducts 매칭 시
 *       vendor 의 confidence 한 단계 boost (medium → high, low → medium).
 *       매칭 없으면 기존 confidence 유지 (backward compat).
 *
 * canonical truth lock:
 *   - ResolveInput.organizationVendorProducts? optional Array<{vendorId, productId}>.
 *   - quote.items[].product.id × organizationVendorProducts.productId 매칭 +
 *     같은 vendor.email 또는 vendorId 매칭 시 boost.
 *   - matching 없으면 기존 confidence (Phase 1+2 의 tier 매핑 또는 backward compat) 유지.
 *   - reason 에 "취급 제품 일치" marker 추가.
 *   - 호영님 결정 4A — confidence boost (한 단계 ↑).
 */

import { describe, it, expect } from "vitest";
import { resolveSuppliers } from "../../../components/quotes/dispatch/resolve-suppliers";

function emptyQuote(extras: Record<string, unknown> = {}) {
  return { id: "q-test", items: [], ...extras } as any;
}

describe("#vendor-catalog-product-matching Phase 3 — product matching → confidence boost", () => {
  it("medium → high (org_book GENERAL tier + product match)", () => {
    const result = resolveSuppliers({
      quote: emptyQuote({
        items: [{ product: { id: "prod-A", name: "Product A" } }],
      }),
      organizationVendors: [
        { id: "ov1", vendorName: "v1", vendorEmail: "v1@x.com", partnershipTier: "GENERAL" } as any,
      ],
      organizationVendorProducts: [
        { vendorId: "ov1", productId: "prod-A" },
      ],
    } as any);
    expect(result[0].confidence).toBe("high");
    expect(result[0].reason).toMatch(/취급 제품 일치|carry/);
  });

  it("low → medium (UNVERIFIED tier + product match)", () => {
    const result = resolveSuppliers({
      quote: emptyQuote({
        items: [{ product: { id: "prod-B", name: "Product B" } }],
      }),
      organizationVendors: [
        { id: "ov2", vendorName: "v2", vendorEmail: "v2@x.com", partnershipTier: "UNVERIFIED" } as any,
      ],
      organizationVendorProducts: [
        { vendorId: "ov2", productId: "prod-B" },
      ],
    } as any);
    expect(result[0].confidence).toBe("medium");
  });

  it("matching 없으면 boost 안 함 (기존 confidence 유지)", () => {
    const result = resolveSuppliers({
      quote: emptyQuote({
        items: [{ product: { id: "prod-X", name: "Product X" } }],
      }),
      organizationVendors: [
        { id: "ov3", vendorName: "v3", vendorEmail: "v3@x.com", partnershipTier: "GENERAL" } as any,
      ],
      organizationVendorProducts: [
        { vendorId: "ov3", productId: "prod-OTHER" }, // 다른 product
      ],
    } as any);
    expect(result[0].confidence).toBe("medium");
  });

  it("organizationVendorProducts 미전달 (backward compat) — 기존 동작", () => {
    const result = resolveSuppliers({
      quote: emptyQuote({
        items: [{ product: { id: "prod-Y", name: "Product Y" } }],
      }),
      organizationVendors: [
        { id: "ov4", vendorName: "v4", vendorEmail: "v4@x.com", partnershipTier: "GENERAL" } as any,
      ],
    } as any);
    expect(result[0].confidence).toBe("medium");
  });

  it("high tier + product match → 'high' (이미 max — boost 없이 reason 만 추가)", () => {
    const result = resolveSuppliers({
      quote: emptyQuote({
        items: [{ product: { id: "prod-D", name: "Product D" } }],
      }),
      organizationVendors: [
        { id: "ov5", vendorName: "v5", vendorEmail: "v5@x.com", partnershipTier: "DIRECT_PARTNER" } as any,
      ],
      organizationVendorProducts: [
        { vendorId: "ov5", productId: "prod-D" },
      ],
    } as any);
    expect(result[0].confidence).toBe("high");
    expect(result[0].reason).toMatch(/취급 제품 일치|carry/);
  });
});

describe("#vendor-catalog-product-matching Phase 3 — caller wiring", () => {
  it("dashboard/quotes 의 useQuery 가 /api/organization-vendor-products 호출", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/organization-vendor-products/);
    expect(src).toMatch(/organizationVendorProducts/);
  });

  it("resolveSuppliers caller 에 organizationVendorProducts forward", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/resolveSuppliers[\s\S]{0,300}organizationVendorProducts/);
  });
});

describe("#vendor-catalog-product-matching Phase 3 — cluster trace marker", () => {
  it("resolve-suppliers.ts 의 cluster marker", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../components/quotes/dispatch/resolve-suppliers.ts"),
      "utf8",
    );
    expect(src).toMatch(/#vendor-catalog-product-matching|organizationVendorProducts/);
  });
});
