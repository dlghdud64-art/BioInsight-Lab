/**
 * #post-approval-purchase-order-flow Phase 1.3 — RED→GREEN test
 *
 * POCandidate → Order vendor-aware conversion service.
 *
 * canonical truth = Order (DB). 1 Quote → N Order (vendor 별, option A).
 * input: quoteId + 결재 통과 POCandidate[] → output: vendor 별 Order N개
 * 생성 + audit log.
 *
 * service 의 책임 (RED test 가 강제):
 *   1. helper file `lib/orders/convert-pocandidate-to-orders.ts` 존재
 *   2. `convertPOCandidatesToOrders` export
 *   3. POCandidate.vendor (String) → Vendor master 매핑 (findFirst by name)
 *   4. duplicate prevention — 이미 (quoteId, vendorId) Order 존재 시 skip
 *   5. db.order.create 또는 createMany 안 vendorId / poCandidateId 매핑
 *   6. createAuditLog wiring (eventType ORDER_CREATED 또는 SETTINGS_CHANGED)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const HELPER = "src/lib/orders/convert-pocandidate-to-orders.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#post-approval-purchase-order-flow Phase 1.3 — service file", () => {
  it("helper file `lib/orders/convert-pocandidate-to-orders.ts` 존재", () => {
    expect(existsSync(join(REPO_ROOT, HELPER))).toBe(true);
  });

  it("`convertPOCandidatesToOrders` 함수 export", () => {
    const src = read(HELPER);
    expect(src).toMatch(/export\s+(async\s+)?function\s+convertPOCandidatesToOrders/);
  });

  it("function 시그니처에 quoteId / userId / candidates 파라미터 명시", () => {
    const src = read(HELPER);
    expect(src).toMatch(/quoteId/);
    expect(src).toMatch(/userId/);
    expect(src).toMatch(/candidates/);
  });
});

describe("#post-approval-purchase-order-flow Phase 1.3 — vendor 매핑 + Order create", () => {
  it("POCandidate.vendor (String) → Vendor master 매핑 (findFirst by name)", () => {
    const src = read(HELPER);
    // vendor name → Vendor.id 매핑이 있어야 — findFirst({ where: { name: ... } })
    // 또는 findUnique by id (POCandidate.vendor 가 vendor name string 이지만
    // vendor master 매핑 시도) 패턴.
    expect(src).toMatch(/db\.vendor\.findFirst|db\.vendor\.findUnique|vendor\.findFirst/);
  });

  it("Order create 안 vendorId / poCandidateId 매핑", () => {
    const src = read(HELPER);
    // db.order.create 또는 tx.order.create 안에 vendorId + poCandidateId 명시
    const createBlocks = src.match(/order\.create\s*\(\s*\{[\s\S]*?\}\s*\)/g);
    expect(createBlocks).not.toBeNull();
    if (createBlocks) {
      // 적어도 하나의 create 블록에 vendorId 와 poCandidateId 둘 다 명시
      const hasBoth = createBlocks.some(
        (b) => /vendorId/.test(b) && /poCandidateId/.test(b),
      );
      expect(hasBoth).toBe(true);
    }
  });

  it("orderNumber 생성 (ORD-YYYYMMDD-XXXX 패턴 또는 generateOrderNumber 호출)", () => {
    const src = read(HELPER);
    expect(src).toMatch(/orderNumber|generateOrderNumber|ORD-/);
  });
});

describe("#post-approval-purchase-order-flow Phase 1.3 — duplicate prevention + audit", () => {
  it("composite (quoteId, vendorId) duplicate prevention — findFirst 또는 findUnique", () => {
    const src = read(HELPER);
    // findFirst({ where: { quoteId, vendorId } }) 또는 findUnique with composite
    // 또는 upsert 패턴 가능. 어느 한 패턴 매칭.
    expect(src).toMatch(
      /findFirst[\s\S]*?quoteId[\s\S]*?vendorId|findUnique[\s\S]*?quoteId_vendorId|upsert/,
    );
  });

  it("createAuditLog 호출 (ORDER 생성 audit log wiring)", () => {
    const src = read(HELPER);
    expect(src).toMatch(/createAuditLog/);
  });

  it("legacy fallback — vendor null 인 candidate 도 1개 Order (vendorId NULL)", () => {
    const src = read(HELPER);
    // null / undefined / 빈 string vendor 처리 분기 명시
    expect(src).toMatch(/vendorId:\s*null|vendor.*===.*null|vendor.*\?\?|vendorId\s*\?/);
  });
});
