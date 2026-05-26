/**
 * §11.309c #smart-receiving-api — Regression sentinel
 *
 * route 파일 존재 + 핵심 패턴 강제:
 *   - POST handler export
 *   - auth() 미들웨어
 *   - enforceAction("inventory_smart_receiving")
 *   - db.$transaction 원자성
 *   - 기존 분기 (inventoryId) + 신규 분기 (Product create)
 *   - §11.309a 새 필드 (ocrJobId + extractedData) 사용
 *   - createAuditLog (INVENTORY_RESTOCK CREATE)
 *   - 입력 validation (ocrJobId / quantity / productName)
 *   - multi-tenant 격리 (ocrJob organization match)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const ROUTE_PATH = "src/app/api/inventory/smart-receiving/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.309c — route 파일 존재 + 패턴", () => {
  it("route 파일 존재", () => {
    expect(existsSync(join(REPO_ROOT, ROUTE_PATH))).toBe(true);
  });

  it("POST handler export", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/export\s+async\s+function\s+POST\s*\(/);
  });

  it("auth() 미들웨어 호출 + 401 분기", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/await\s+auth\(\)/);
    expect(src).toMatch(/Unauthorized.*401/);
  });

  it("enforceAction(inventory_smart_receiving) 보안", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/enforceAction\(/);
    expect(src).toMatch(/action:\s*["']inventory_smart_receiving["']/);
    expect(src).toMatch(/routePath:\s*["']\/api\/inventory\/smart-receiving["']/);
  });

  it("enforcement.deny() / .complete() / .fail() 정합 (기존 패턴)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/enforcement\.deny\(\)/);
    expect(src).toMatch(/enforcement\.complete\(/);
    expect(src).toMatch(/enforcement\?\.fail\(\)/);
  });
});

describe("§11.309c — 입력 validation", () => {
  it("ocrJobId 필수 (없으면 400)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/ocrJobId는 필수입니다/);
    expect(src).toMatch(/!ocrJobId\s*\|\|\s*typeof\s+ocrJobId\s*!==\s*["']string["']/);
  });

  it("quantity > 0 검증 (없으면 400)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/confirmedData\.quantity는 0보다 큰 숫자여야 합니다/);
    expect(src).toMatch(/confirmedData\.quantity\s*<=\s*0/);
  });

  it("신규 시 productName 필수 (없으면 400)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/productName이 필수입니다/);
  });
});

describe("§11.309c — OcrJob multi-tenant 격리", () => {
  it("OcrJob 존재 검증 (없으면 404)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/db\.ocrJob\.findUnique/);
    expect(src).toMatch(/ocrJob을 찾을 수 없습니다/);
  });

  it("OcrJob org/owner 매칭 또는 membership 검증", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/ocrOrgMatches/);
    expect(src).toMatch(/ocrOwnerMatches/);
    expect(src).toMatch(/organizationMember\.findFirst/);
  });
});

describe("§11.309c — 분기 A (기존 inventoryId)", () => {
  it("ProductInventory.findUnique 권한 확인", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/db\.productInventory\.findUnique[\s\S]*where:\s*\{\s*id:\s*inventoryId\s*\}/);
  });

  it("db.$transaction 안 currentQuantity increment", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/db\.\$transaction/);
    expect(src).toMatch(/currentQuantity:\s*\{\s*increment:\s*confirmedData\.quantity\s*\}/);
  });

  it("InventoryRestock create with ocrJobId + extractedData (§11.309a 정합)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/inventoryRestock\.create/);
    expect(src).toMatch(/ocrJobId,/);
    expect(src).toMatch(/extractedData:\s*confirmedData/);
  });

  it("createAuditLog INVENTORY_RESTOCK CREATE (기존 분기)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/createAuditLog/);
    expect(src).toMatch(/AuditAction\.CREATE/);
    expect(src).toMatch(/AuditEntityType\.INVENTORY_RESTOCK/);
    expect(src).toMatch(/source:\s*["']smart_receiving["']/);
  });

  it("isNew: false 응답 (기존 분기)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/isNew:\s*false/);
  });
});

describe("§11.309c — 분기 B (신규 품목)", () => {
  it("Product create (name/brand/catalogNumber/category)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/tx\.product\.create/);
    expect(src).toMatch(/name:\s*confirmedData\.productName/);
    expect(src).toMatch(/category:[\s\S]{0,80}DEFAULT_CATEGORY/);
  });

  it("ProductInventory create (productId + userId + initial quantity)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/tx\.productInventory\.create/);
    expect(src).toMatch(/productId:\s*product\.id/);
    expect(src).toMatch(/currentQuantity:\s*confirmedData\.quantity/);
  });

  it("InventoryRestock create (ocrJobId + extractedData) 신규 분기 포함", () => {
    const src = read(ROUTE_PATH);
    // 신규 분기 안에도 inventoryRestock.create 가 있어야 함
    const restocks = src.match(/inventoryRestock\.create/g);
    expect(restocks?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("isNew: true 응답 (신규 분기)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/isNew:\s*true/);
  });

  it("DEFAULT_CATEGORY = OTHER (Prisma ProductCategory fallback)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/DEFAULT_CATEGORY[^=]*=\s*["']OTHER["']/);
  });
});

describe("§11.309c — 의존성 import", () => {
  it("auth / db / Prisma / audit / enforcement import", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/from\s+["']@\/auth["']/);
    expect(src).toMatch(/from\s+["']@\/lib\/db["']/);
    expect(src).toMatch(/from\s+["']@prisma\/client["']/);
    expect(src).toMatch(/from\s+["']@\/lib\/audit["']/);
    expect(src).toMatch(/from\s+["']@\/lib\/security\/server-enforcement-middleware["']/);
  });

  it("ProductCategory enum import (신규 분기 fallback)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/ProductCategory.*from\s+["']@prisma\/client["']|import\s*\{[^}]*ProductCategory[^}]*\}/);
  });
});
