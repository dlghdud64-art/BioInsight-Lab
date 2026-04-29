/**
 * §11.135 #admin-user-bulk-approve-reject
 *
 * Source-level regression guard — admin/users 의 multi-row bulk approve/reject.
 * §11.102 admin-order-bulk-status 와 동일 패턴 — sequential single-item 호출
 * + partial failure tolerance.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("admin user bulk actions — regression guard (§11.135)", () => {
  const APPROVE_ROUTE = resolve(
    __dirname,
    "../../../app/api/admin/users/bulk-approve/route.ts",
  );
  const REJECT_ROUTE = resolve(
    __dirname,
    "../../../app/api/admin/users/bulk-reject/route.ts",
  );
  const PAGE_PATH = resolve(
    __dirname,
    "../../../app/admin/users/page.tsx",
  );

  it("bulk-approve endpoint 파일 존재", () => {
    expect(existsSync(APPROVE_ROUTE)).toBe(true);
  });

  it("bulk-approve: POST + isAdmin + body.userIds[] iterate", () => {
    if (!existsSync(APPROVE_ROUTE)) return;
    const source = readFileSync(APPROVE_ROUTE, "utf8");
    expect(source).toMatch(/export\s+async\s+function\s+POST/);
    expect(source).toMatch(/\bisAdmin\b/);
    expect(source).toMatch(/userIds/);
  });

  it("bulk-approve: partial failure tolerance (failedItems / successCount)", () => {
    if (!existsSync(APPROVE_ROUTE)) return;
    const source = readFileSync(APPROVE_ROUTE, "utf8");
    expect(source).toMatch(/successCount|failedItems/);
  });

  it("bulk-reject endpoint 파일 존재", () => {
    expect(existsSync(REJECT_ROUTE)).toBe(true);
  });

  it("bulk-reject: POST + isAdmin + userIds + self-reject 차단", () => {
    if (!existsSync(REJECT_ROUTE)) return;
    const source = readFileSync(REJECT_ROUTE, "utf8");
    expect(source).toMatch(/export\s+async\s+function\s+POST/);
    expect(source).toMatch(/\bisAdmin\b/);
    expect(source).toMatch(/userIds/);
    // 본인 자기 self-reject 차단 (§11.117 정합 — 본인 ID 가 list 에 있으면 skip 또는 reject)
    expect(source).toMatch(/self_reject|session\.user\.id/);
  });

  it("admin/users page bulk action bar (selectedUserIds set + 일괄 승인/반려 button)", () => {
    const source = readFileSync(PAGE_PATH, "utf8");
    expect(source).toMatch(/selectedUserIds|bulkApprove|bulkReject|일괄 승인|일괄 반려/);
  });

  it("bulk action bar 가 fixed bottom (모바일 §11.119 패턴 일관)", () => {
    const source = readFileSync(PAGE_PATH, "utf8");
    // §11.119 admin-orders 와 동일 fixed bottom pattern
    expect(source).toMatch(/(fixed|sticky)\s+(bottom-0|inset-x-0)/);
  });

  it("§11.117 single-item approve/reject 회귀 0", () => {
    const source = readFileSync(PAGE_PATH, "utf8");
    expect(source).toMatch(/approveMutation/);
    expect(source).toMatch(/rejectMutation/);
  });
});
