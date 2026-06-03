/**
 * §11.348-A-4 (회귀) — 입고안 승인/반려 sentinel
 *
 * A-4: 연구소 사람 승인 → 검증 대기 입고안(PENDING_REVIEW)을 canonical 입고로 확정
 * (ProductInventory 증분 + InventoryRestock 생성, 공급사 회신 LOT·실수량 기준).
 * 폐루프에서 처음 canonical 재고를 바꾸는 단계 → 다중 가드 필수.
 *
 * 문자열 매칭 toContain. 코드 가드는 주석 제거 후 검증.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
function codeOnly(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((ln) => ln.replace(/\/\/.*$/, ""))
    .join("\n");
}
const APPROVE = "src/app/api/receiving-drafts/[id]/approve/route.ts";
const REJECT = "src/app/api/receiving-drafts/[id]/reject/route.ts";

describe("§11.348-A-4 — 파일 존재", () => {
  it("approve/reject 라우트", () => {
    expect(existsSync(join(APP_WEB_ROOT, APPROVE))).toBe(true);
    expect(existsSync(join(APP_WEB_ROOT, REJECT))).toBe(true);
  });
});

describe("§11.348-A-4 — 승인 다중 가드", () => {
  it("auth + 권한(소유자/조직멤버)", () => {
    const src = read(APPROVE);
    expect(src).toContain("await auth()");
    expect(src).toContain("draft.userId === userId");
    expect(src).toContain("db.organizationMember.findFirst");
  });
  it("status PENDING_REVIEW + 이중입고 가드 2종", () => {
    const src = read(APPROVE);
    expect(src).toContain('draft.status !== "PENDING_REVIEW"');
    expect(src).toContain("draft.restockSyncedAt"); // 가드 ①
    expect(src).toContain('draft.order?.status === "DELIVERED"'); // 가드 ②
    expect(src).toContain('code: "NO_RESTOCKABLE_ITEMS"');
  });
});

describe("§11.348-A-4 — 승인 시 canonical 입고 반영", () => {
  it("ProductInventory 증분 + InventoryRestock 생성 + 발주 DELIVERED + 입고안 APPROVED+restockSyncedAt", () => {
    const src = read(APPROVE);
    expect(src).toContain("tx.productInventory.upsert");
    expect(src).toContain("increment: qty");
    expect(src).toContain("tx.inventoryRestock.create");
    expect(src).toContain('receivingStatus: "COMPLETED"');
    expect(src).toContain('status: "DELIVERED"');
    expect(src).toContain('status: "APPROVED"');
    expect(src).toContain("restockSyncedAt: new Date()");
    // 트랜잭션 원자성
    expect(src).toContain("db.$transaction");
  });
});

describe("§11.348-A-4 — 반려는 재고 무변경", () => {
  it("REJECTED 전이 + 재고/입고 mutation 0", () => {
    const src = read(REJECT);
    expect(src).toContain('status: "REJECTED"');
    const code = codeOnly(REJECT);
    expect(code).not.toContain("productInventory");
    expect(code).not.toContain("inventoryRestock");
    expect(code).not.toContain("increment");
  });
});
