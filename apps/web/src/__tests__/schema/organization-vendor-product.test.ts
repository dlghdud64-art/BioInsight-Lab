/**
 * #vendor-catalog-product-matching Phase 1 — RED test
 *
 * Goal: 새 model `OrganizationVendorProduct` — organization × vendor × product
 *       3-way unique 매핑. operator 직접 입력 (Phase 2 UI), resolveSuppliers
 *       confidence boost (Phase 3) 의 base.
 *
 * canonical truth lock:
 *   - id (cuid), organizationId, vendorId, productId, notes? optional, createdById,
 *     createdAt, updatedAt.
 *   - @@unique([organizationId, vendorId, productId]) — 같은 vendor-product 중복 차단.
 *   - Organization / Vendor / Product 와 onDelete Cascade.
 *   - 인덱스: organizationId, vendorId, productId.
 *
 * 호영님 6 결정 (권장안 그대로):
 *   1.A OrganizationVendorProduct
 *   2.A 새 model
 *   3.A operator 직접 입력
 *   4.A confidence boost (Phase 3)
 *   5.A settings/suppliers vendor expand
 *   6.A Phase 1 → 2 → 3 분리 push
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA_PATH = resolve(__dirname, "../../../prisma/schema.prisma");
const schema = readFileSync(SCHEMA_PATH, "utf8");

describe("#vendor-catalog-product-matching Phase 1 — OrganizationVendorProduct model", () => {
  it("model OrganizationVendorProduct 정의 존재", () => {
    expect(schema).toMatch(/model\s+OrganizationVendorProduct\s*\{/);
  });

  it("required fields — id / organizationId / vendorId / productId / createdById", () => {
    const block = schema.match(/model\s+OrganizationVendorProduct\s*\{[\s\S]*?\n\}/);
    expect(block).toBeTruthy();
    const src = block?.[0] ?? "";
    expect(src).toMatch(/id\s+String\s+@id/);
    expect(src).toMatch(/organizationId\s+String/);
    expect(src).toMatch(/vendorId\s+String/);
    expect(src).toMatch(/productId\s+String/);
    expect(src).toMatch(/createdById\s+String/);
  });

  it("optional notes (memo) field", () => {
    const block = schema.match(/model\s+OrganizationVendorProduct\s*\{[\s\S]*?\n\}/);
    expect(block?.[0]).toMatch(/notes\s+String\?/);
  });

  it("createdAt / updatedAt timestamps", () => {
    const block = schema.match(/model\s+OrganizationVendorProduct\s*\{[\s\S]*?\n\}/);
    expect(block?.[0]).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(block?.[0]).toMatch(/updatedAt\s+DateTime\s+@updatedAt/);
  });

  it("@@unique composite key — organizationId, vendorId, productId", () => {
    const block = schema.match(/model\s+OrganizationVendorProduct\s*\{[\s\S]*?\n\}/);
    expect(block?.[0]).toMatch(/@@unique\(\[organizationId,\s*vendorId,\s*productId\]\)/);
  });

  it("관계 — Organization / Vendor / Product / User (createdBy)", () => {
    const block = schema.match(/model\s+OrganizationVendorProduct\s*\{[\s\S]*?\n\}/);
    const src = block?.[0] ?? "";
    expect(src).toMatch(/organization\s+Organization/);
    expect(src).toMatch(/vendor\s+Vendor/);
    expect(src).toMatch(/product\s+Product/);
    expect(src).toMatch(/createdBy\s+User/);
  });

  it("Cascade onDelete (organizationId/vendorId/productId)", () => {
    const block = schema.match(/model\s+OrganizationVendorProduct\s*\{[\s\S]*?\n\}/);
    const src = block?.[0] ?? "";
    expect(src).toMatch(/onDelete:\s*Cascade/);
  });

  it("인덱스 — organizationId / vendorId / productId 검색 정합", () => {
    const block = schema.match(/model\s+OrganizationVendorProduct\s*\{[\s\S]*?\n\}/);
    const src = block?.[0] ?? "";
    expect(src).toMatch(/@@index\(\[organizationId\]\)/);
    expect(src).toMatch(/@@index\(\[vendorId\]\)/);
    expect(src).toMatch(/@@index\(\[productId\]\)/);
  });
});

describe("#vendor-catalog-product-matching Phase 1 — back-relations", () => {
  it("Organization 에 organizationVendorProducts back-relation", () => {
    expect(schema).toMatch(/organizationVendorProducts\s+OrganizationVendorProduct\[\]/);
  });

  it("Vendor 에 organizationProductLinks back-relation (또는 동등 이름)", () => {
    // back-relation field name — 정확한 이름은 코드에 따라 다양 가능, OrganizationVendorProduct[] 매칭만 확인
    const vendorBlock = schema.match(/model\s+Vendor\s*\{[\s\S]*?\n\}/);
    expect(vendorBlock?.[0]).toMatch(/OrganizationVendorProduct\[\]/);
  });

  it("Product 에 OrganizationVendorProduct[] back-relation", () => {
    const productBlock = schema.match(/model\s+Product\s*\{[\s\S]*?\n\}/);
    expect(productBlock?.[0]).toMatch(/OrganizationVendorProduct\[\]/);
  });
});
