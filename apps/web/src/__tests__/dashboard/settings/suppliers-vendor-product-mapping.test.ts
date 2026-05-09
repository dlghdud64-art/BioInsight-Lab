/**
 * #vendor-catalog-product-matching Phase 2b — UI source-level guard.
 *
 * Goal: settings/suppliers 의 vendor row expand + carry product list +
 *       "+ 제품 추가" Dialog + Product search + POST/DELETE wiring.
 *
 * canonical truth lock:
 *   - vendor row expand toggle (state per vendor.id).
 *   - GET `/api/organization-vendor-products?vendorId={id}` 결과 inline list.
 *   - "+ 제품 추가" CTA → product search input + select → POST.
 *   - 각 carry row 의 삭제 버튼 → DELETE.
 *   - csrfFetch 사용 (1+2단계 패턴).
 *   - invalidate ["organization-vendor-products"] queryKey.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/settings/suppliers/page.tsx");
const src = readFileSync(PAGE_PATH, "utf8");

describe("#vendor-catalog-product-matching Phase 2b — settings/suppliers UI", () => {
  it("vendor expand state — Set 또는 Map 기반 toggle", () => {
    expect(src).toMatch(/expandedVendor|expandedVendors|expandVendor/);
  });

  it("/api/organization-vendor-products 호출 (carry product list)", () => {
    expect(src).toMatch(/\/api\/organization-vendor-products/);
  });

  it("vendor 별 grouping — entry.vendorId 매칭 또는 ?vendorId= filter", () => {
    // client-side group (entry.vendorId) 또는 server-side filter (?vendorId=) 둘 다 허용.
    expect(src).toMatch(/entry\.vendorId|\?vendorId=|vendorId:\s*vendor\.id/);
  });

  it("'제품 추가' 또는 '+ 제품' CTA 라벨 (한국어)", () => {
    expect(src).toMatch(/제품\s*추가|carry|취급\s*제품/);
  });

  it("product search input — /api/products/search 호출", () => {
    expect(src).toMatch(/\/api\/products\/search/);
  });

  it("POST mutation — csrfFetch + body 에 vendorId/productId", () => {
    expect(src).toMatch(/csrfFetch.*organization-vendor-products|csrfFetch[\s\S]{0,300}vendorId/);
    expect(src).toMatch(/productId/);
  });

  it("DELETE mutation — csrfFetch /api/organization-vendor-products/[id]", () => {
    expect(src).toMatch(/csrfFetch[\s\S]{0,200}organization-vendor-products\/\$\{/);
    expect(src).toMatch(/method:\s*["']DELETE["']/);
  });

  it("invalidate queryKey — organization-vendor-products", () => {
    expect(src).toMatch(/invalidateQueries[\s\S]{0,200}organization-vendor-products/);
  });

  it("cluster trace marker", () => {
    expect(src).toMatch(/#vendor-catalog-product-matching/);
  });
});
