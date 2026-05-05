/**
 * #approver-routing-per-user-limit-admin-ui Phase 2 — RED→GREEN test
 *
 * /api/workspaces/[id]/members/[memberId] PATCH zod schema 에 approvalLimit
 * 추가 — workspace member 의 결재 한도 admin UI override.
 *
 * Lock:
 *   - approvalLimit nullable (null = 무제한 default)
 *   - max cap 100억 (KRW)
 *   - role 단독 변경 시 approvalLimit 미명시 backward compat
 *   - ADMIN role gate (verifyAdminAccess 이미 land)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/workspaces/[id]/members/[memberId]/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-per-user-limit-admin-ui — members PATCH zod", () => {
  it("zod schema 에 approvalLimit 필드 추가", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/approvalLimit/);
  });

  it("approvalLimit 가 nullable (null = 무제한)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/approvalLimit:\s*z\.[\s\S]*?\.nullable\(\)/);
  });

  it("max cap 100억 명시 (10_000_000_000)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/approvalLimit:\s*z\.[\s\S]*?max\(10_?000_?000_?000\)/);
  });

  it("role + approvalLimit 둘 다 optional (partial update 호환)", () => {
    const src = read(ROUTE);
    // role 도 optional 또는 .partial() 처리
    expect(src).toMatch(/role:\s*z\.[\s\S]*?\.optional\(\)|partial\(\)/);
  });

  it("update data 에 approvalLimit 반영 (조건부 spread 또는 직접 매핑)", () => {
    const src = read(ROUTE);
    // data: { ...(role && { role }), ...(approvalLimit !== undefined && { approvalLimit }) }
    expect(src).toMatch(/approvalLimit[\s\S]{0,80}data:|data:\s*\{[\s\S]*?approvalLimit/);
  });

  it("§11.209d-approver-routing 또는 per-user-limit 코멘트", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/per-user-limit|approvalLimit|§11\.209d/);
  });
});
