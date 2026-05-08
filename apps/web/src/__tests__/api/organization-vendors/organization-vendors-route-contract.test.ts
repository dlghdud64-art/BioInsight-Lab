/**
 * #user-supplier-registration Phase 2 RED — `/api/organization-vendors` CRUD
 * route contract regression guard.
 *
 * Goal: 4 endpoint 의 source-level contract 검증 (auth + zod + ownership + audit).
 *
 * canonical truth lock:
 *   - POST /api/organization-vendors (create) — current user organization 자동 scope.
 *   - GET /api/organization-vendors (list) — current user organization 의 vendors.
 *   - PATCH /api/organization-vendors/[id] — ownership check via organizationId.
 *   - DELETE /api/organization-vendors/[id] — ownership check.
 *   - 모든 route: auth() 필수 + zod 검증 + audit log + 한국어 error message.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const COLLECTION_PATH = resolve(__dirname, "../../../app/api/organization-vendors/route.ts");
const ITEM_PATH = resolve(__dirname, "../../../app/api/organization-vendors/[id]/route.ts");

describe("#user-supplier-registration Phase 2 — collection route file 존재", () => {
  it("/api/organization-vendors/route.ts 존재", () => {
    expect(existsSync(COLLECTION_PATH)).toBe(true);
  });

  it("/api/organization-vendors/[id]/route.ts 존재", () => {
    expect(existsSync(ITEM_PATH)).toBe(true);
  });
});

describe("#user-supplier-registration Phase 2 — collection route contract (POST + GET)", () => {
  if (!existsSync(COLLECTION_PATH)) return;
  const source = readFileSync(COLLECTION_PATH, "utf8");

  it("POST handler export (create vendor)", () => {
    expect(source).toMatch(/export\s+async\s+function\s+POST\b/);
  });

  it("GET handler export (list vendors for current organization)", () => {
    expect(source).toMatch(/export\s+async\s+function\s+GET\b/);
  });

  it("auth() import + 호출 (logged-in 필수)", () => {
    expect(source).toMatch(/import.*auth.*from.*\/auth/);
    expect(source).toMatch(/await\s+auth\(\)/);
  });

  it("zod schema — vendorName / vendorEmail required + 한국어 error", () => {
    expect(source).toMatch(/z\.object/);
    expect(source).toMatch(/vendorName/);
    expect(source).toMatch(/vendorEmail/);
    expect(source).toMatch(/공급사|이메일|등록/); // 한국어 error message
  });

  it("organizationVendor.create + organizationId 자동 scope (current user)", () => {
    expect(source).toMatch(/organizationVendor\.create/);
    expect(source).toMatch(/organizationId/);
  });

  it("audit — createdById + activity/audit log", () => {
    expect(source).toMatch(/createdById/);
    expect(source).toMatch(/createActivityLog|createAuditLog|createDataAuditLog/);
  });

  it("@@unique([organizationId, vendorEmail]) 충돌 시 409 또는 한국어 메시지", () => {
    expect(source).toMatch(/이미 등록|중복|already.*registered|409|P2002/);
  });

  it("#user-supplier-registration 주석 marker", () => {
    expect(source).toMatch(/#user-supplier-registration|user supplier registration/i);
  });
});

describe("#user-supplier-registration Phase 2 — item route contract (PATCH + DELETE)", () => {
  if (!existsSync(ITEM_PATH)) return;
  const source = readFileSync(ITEM_PATH, "utf8");

  it("PATCH handler export (update vendor)", () => {
    expect(source).toMatch(/export\s+async\s+function\s+PATCH\b/);
  });

  it("DELETE handler export (delete vendor)", () => {
    expect(source).toMatch(/export\s+async\s+function\s+DELETE\b/);
  });

  it("auth() 호출 + ownership check via organizationId", () => {
    expect(source).toMatch(/await\s+auth\(\)/);
    // ownership: vendor.organizationId === user.organizationId 분기
    expect(source).toMatch(/organizationId/);
  });

  it("zod schema — partial update (PATCH 만)", () => {
    expect(source).toMatch(/z\.object/);
    // partial / .optional() 패턴
    expect(source).toMatch(/optional|partial/);
  });

  it("organizationVendor.update + delete prisma call", () => {
    expect(source).toMatch(/organizationVendor\.update|organizationVendor\.delete/);
  });

  it("audit log (update + delete)", () => {
    expect(source).toMatch(/createActivityLog|createAuditLog|createDataAuditLog/);
  });

  it("404 또는 한국어 'not found' (ownership 실패 시)", () => {
    expect(source).toMatch(/찾을 수 없|not\s*found|404|존재하지 않/);
  });
});
