/**
 * #supplier-resolution-quote-vendor-email — `/api/quotes` GET prisma include
 * + response mapping regression guard.
 *
 * Goal: resolveSuppliers 의 3 source (recent_rfq / supplier_book / ai_recommended)
 *       가 정상 작동하도록 server forward chain 정합.
 *
 * canonical truth lock:
 *   - Prisma include: items.product 의 select → include 변환 + vendors join
 *     + vendor.{id, name, email} select.
 *   - vendorRequests.select 에 vendorEmail / vendorName / respondedAt /
 *     createdAt 포함.
 *   - response mapping 에 product.vendors 와 vendorRequests 의 새 field forward.
 *
 * canonical truth path:
 *   schema.prisma:284 Product.vendors -> ProductVendor.vendor -> Vendor.email
 *   schema.prisma:VendorRequest.vendorEmail (이미 존재)
 *
 * 본 트랙은 server forward chain 만 검증. ProductVendor seed 부재는 별도 트랙
 * (#vendor-master-seed-from-search).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(__dirname, "../../../app/api/quotes/route.ts");
const source = readFileSync(ROUTE_PATH, "utf8");

describe("#supplier-resolution-quote-vendor-email — Prisma include 확장", () => {
  it("items.include.product 가 select 가 아닌 include 패턴 (vendors join 가능)", () => {
    // canonical: items.include.product 안 vendors / vendor 포함
    // 강제: 'product:' block 안 'vendors:' 또는 'include:' 등장
    const productInItemsRegex = /items:\s*\{[\s\S]*?include:\s*\{[\s\S]*?product:\s*\{[\s\S]*?(include|select)[\s\S]*?vendors[\s\S]*?\},?\s*responses/m;
    expect(source).toMatch(productInItemsRegex);
  });

  it("product.vendors include 안 vendor.email select", () => {
    // canonical truth: ProductVendor → Vendor → email
    // 강제: 'vendors:' block 안 'vendor:' + 'email: true'
    expect(source).toMatch(/vendors:\s*\{[\s\S]*?include:\s*\{[\s\S]*?vendor:\s*\{[\s\S]*?select:\s*\{[\s\S]*?email:\s*true/);
  });

  it("vendor.id 와 vendor.name 도 select (resolveSuppliers vendorId/vendorName 사용)", () => {
    // canonical: Vendor.id / Vendor.name forward (resolveSuppliers 가 vendor.id, vendor.name 참조)
    expect(source).toMatch(/vendor:\s*\{[\s\S]*?select:\s*\{[\s\S]*?id:\s*true[\s\S]*?name:\s*true/);
  });

  it("vendorRequests.select 가 vendorEmail 포함 (recent_rfq source 정합)", () => {
    expect(source).toMatch(/vendorRequests:\s*\{[\s\S]*?select:\s*\{[\s\S]*?vendorEmail:\s*true/);
  });

  it("vendorRequests.select 가 vendorName 포함", () => {
    expect(source).toMatch(/vendorRequests:\s*\{[\s\S]*?select:\s*\{[\s\S]*?vendorName:\s*true/);
  });

  it("vendorRequests.select 가 respondedAt 와 createdAt 포함 (lastUsed source)", () => {
    expect(source).toMatch(/vendorRequests:\s*\{[\s\S]*?select:\s*\{[\s\S]*?respondedAt:\s*true/);
    expect(source).toMatch(/vendorRequests:\s*\{[\s\S]*?select:\s*\{[\s\S]*?createdAt:\s*true/);
  });
});

describe("#supplier-resolution-quote-vendor-email — response mapping forward", () => {
  it("mapped item.product 안 vendors forward", () => {
    // canonical: response mapping 에 product.vendors 가 그대로 forward 되거나
    // explicit map 으로 vendor 정보 보존.
    // 강제: 'product:' block 다음에 'vendors' 등장 (mapping function 안)
    const mappedProductRegex = /product:\s*item\.product[\s\S]*?vendors|product:\s*\{[\s\S]*?vendors:[\s\S]*?\}/;
    expect(source).toMatch(mappedProductRegex);
  });

  it("mapped vendorRequests 가 vendorEmail forward", () => {
    expect(source).toMatch(/vendorRequests:[\s\S]*?(map|=)[\s\S]*?vendorEmail/);
  });

  it("§11.217 후속 marker 또는 #supplier-resolution 주석 marker", () => {
    // 본 변경의 의도 명시 — 향후 회귀 시 grep 으로 식별 가능
    expect(source).toMatch(/#supplier-resolution|supplier resolution|vendor email forward/i);
  });
});
