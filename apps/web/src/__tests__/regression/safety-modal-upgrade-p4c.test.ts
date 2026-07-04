/**
 * §safety-modal-upgrade SM-P4c (호영님 2026-07-04) — 안전 목록 GET owner/org 스코프 정합.
 * 기존: organizationId 파라미터 없으면 세션만 확인·where 무스코프 → 임의 로그인 사용자에게 전
 * 테넌트 제품 노출(멀티테넌트 과다노출) + POST 점검(owner/org 게이트)과 읽기/쓰기 불일치.
 * Fix: GET where 를 owner/org 로 스코프 → 목록 = 실행가능집합(POST 게이트와 동일), 과다노출 해소.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const ROUTE = readFileSync(join(__dirname, "..", "..", "app/api/safety/products/route.ts"), "utf8");

describe("§safety-modal-upgrade SM-P4c — GET owner/org 스코프", () => {
  it("무파라미터 GET where 를 ProductInventory(inventories) 소유/org 로 스코프(과다노출 해소)", () => {
    // Product 는 글로벌 카탈로그(userId/org 없음) → 소유는 inventories relation(ProductInventory) 로만.
    expect(ROUTE).toMatch(/where\.inventories\s*=/);
    expect(ROUTE).toMatch(/userId: session\.user\.id/);
    expect(ROUTE).toMatch(/organizationId: \{ in: userOrgIds \}/);
  });
  it("명시 organizationId 는 inventories.some.organizationId 로 스코프(멤버십 게이트 후)", () => {
    expect(ROUTE).toMatch(/where\.inventories = \{ some: \{ organizationId \} \}/);
  });
  it("옛 무스코프 else 분기(세션만 확인) 잔재 0", () => {
    expect(ROUTE).not.toMatch(/Unauthorized: organization scope required/);
  });
});
