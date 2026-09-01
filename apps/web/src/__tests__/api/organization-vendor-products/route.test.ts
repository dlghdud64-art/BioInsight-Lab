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

  it("organizationId 자동 scope — 공유 resolver (구 getCurrentOrganizationId helper 승계)", () => {
    /* 🔁 승계 교체 (§invite-flow Phase 2-3 · 2026-09-02).
     * 옛 계약: 이 파일이 자기 `getCurrentOrganizationId` 복사본으로 `organizationMember.findFirst`
     *   를 직접 쳐서 **첫 멤버십**을 골랐다. 같은 복사본이 vendor 계열 4파일에 각각 있었다.
     * 새 계약: 조직 선택은 공유 resolver 한 곳에서만 일어난다 — 읽기는 활성 조직(관대),
     *   쓰기는 명시값을 무시하지 않는다(hint_forbidden → 403).
     * 잠그는 것은 그대로 "이 라우트가 조직 스코프를 자동 적용한다" 이고, 그 수단만 바뀌었다.
     * 세부 짝 계약은 regression/vendors-org-hint-pairing.test.ts 가 소유한다. */
    expect(collection).toMatch(/resolveActiveOrganizationId/);
    expect(collection).toMatch(/resolveOrganizationIdForMutation/);
    /* 역방향 잠금 — 파일별 복사본이 되살아나면 RED */
    expect(collection).not.toMatch(/async function getCurrentOrganizationId/);
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
