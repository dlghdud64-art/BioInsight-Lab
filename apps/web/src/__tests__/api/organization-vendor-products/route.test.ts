/**
 * #vendor-catalog-product-matching Phase 2 — API CRUD route guard test
 *
 * Goal: collection (GET/POST) + item (DELETE) route 의 source-level guard.
 *       1단계 organization-vendors API 패턴 mirror.
 *
 * canonical truth lock:
 *   - GET: organizationId 자동 scope, optional ?vendorId= filter.
 *   - POST: zod schema (vendorId/productId required, notes optional) + orphan 차단
 *     (vendor / product / orgVendor 매칭) + P2002 → 409 한국어.
 *   - DELETE: ownership check (entry.organizationId === current) + 404 fallback.
 *   - audit log (best-effort).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COLLECTION_PATH = resolve(__dirname, "../../../app/api/organization-vendor-products/route.ts");
const ITEM_PATH = resolve(__dirname, "../../../app/api/organization-vendor-products/[id]/route.ts");

const collection = readFileSync(COLLECTION_PATH, "utf8");
const item = readFileSync(ITEM_PATH, "utf8");

describe("#vendor-catalog-product-matching Phase 2 — collection route", () => {
  it("GET / POST 함수 export", () => {
    expect(collection).toMatch(/export\s+async\s+function\s+GET/);
    expect(collection).toMatch(/export\s+async\s+function\s+POST/);
  });

  it("zod schema CreateOrganizationVendorProductSchema — vendorId / productId required", () => {
    expect(collection).toMatch(/CreateOrganizationVendorProductSchema/);
    expect(collection).toMatch(/vendorId:\s*z\.string\(\)\.min\(1/);
    expect(collection).toMatch(/productId:\s*z\.string\(\)\.min\(1/);
  });

  it("notes optional (nullish)", () => {
    expect(collection).toMatch(/notes:\s*z\.string\(\)[\s\S]{0,80}\.nullish\(\)/);
  });

  it("auth() 필수 + 401 fallback", () => {
    expect(collection).toMatch(/await auth\(\)/);
    expect(collection).toMatch(/로그인이 필요합니다/);
  });

  it("organizationId 자동 scope — getCurrentOrganizationId helper", () => {
    expect(collection).toMatch(/getCurrentOrganizationId/);
    expect(collection).toMatch(/organizationMember\.findFirst/);
  });

  it("orphan 차단 — vendor / product / OrganizationVendor 모두 검증", () => {
    expect(collection).toMatch(/db\.vendor\.findUnique/);
    expect(collection).toMatch(/db\.product\.findUnique/);
    expect(collection).toMatch(/organizationVendor\.findFirst/);
  });

  it("P2002 → 409 한국어 메시지", () => {
    expect(collection).toMatch(/P2002/);
    expect(collection).toMatch(/이미 등록된 거래처-제품 매핑/);
    expect(collection).toMatch(/status:\s*409/);
  });

  it("audit log — createActivityLog (best-effort)", () => {
    expect(collection).toMatch(/createActivityLog/);
    expect(collection).toMatch(/organization_vendor_product_created/);
  });

  it("optional ?vendorId= filter", () => {
    expect(collection).toMatch(/searchParams\.get\(["']vendorId["']\)/);
  });
});

describe("#vendor-catalog-product-matching Phase 2 — item DELETE route", () => {
  it("DELETE 함수 export", () => {
    expect(item).toMatch(/export\s+async\s+function\s+DELETE/);
  });

  it("auth() 필수", () => {
    expect(item).toMatch(/await auth\(\)/);
  });

  it("ownership check — entry.organizationId === current organizationId", () => {
    expect(item).toMatch(/entry\.organizationId\s*!==\s*organizationId/);
  });

  it("404 fallback (existence leak avoidance)", () => {
    expect(item).toMatch(/매핑을 찾을 수 없습니다/);
    expect(item).toMatch(/status:\s*404/);
  });

  it("audit log — organization_vendor_product_deleted", () => {
    expect(item).toMatch(/organization_vendor_product_deleted/);
  });
});

describe("#vendor-catalog-product-matching Phase 2 — cluster trace", () => {
  it("collection cluster marker 주석", () => {
    expect(collection).toMatch(/#vendor-catalog-product-matching/);
  });
  it("item cluster marker 주석", () => {
    expect(item).toMatch(/#vendor-catalog-product-matching/);
  });
});
