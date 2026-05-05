/**
 * #approver-routing-per-user-limit-organization-member-admin-ui Phase 2 —
 * RED→GREEN test
 *
 * /api/organizations/[id]/members PATCH 가 zod schema 도입 + approvalLimit
 * 추가. 직전 workspace member 패턴 정합:
 *   - role + approvalLimit 둘 다 optional (partial update)
 *   - approvalLimit nullable (null = 무제한)
 *   - max 100억 (KRW)
 *   - audit log (MEMBER_APPROVAL_LIMIT_CHANGED + entityType ORGANIZATION_MEMBER)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/organizations/[id]/members/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-per-user-limit-organization-member-admin-ui — PATCH zod", () => {
  it("zod import + schema 정의", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/from\s+["']zod["']/);
    expect(src).toMatch(/z\.object/);
  });

  it("zod schema 에 approvalLimit nullable + max 100억", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/approvalLimit:\s*z\.[\s\S]*?\.nullable\(\)/);
    expect(src).toMatch(/approvalLimit:\s*z\.[\s\S]*?max\(10_?000_?000_?000\)/);
  });

  it("memberId + role + approvalLimit 모두 optional / role 은 OrganizationRole enum", () => {
    const src = read(ROUTE);
    // role 이 OrganizationRole enum (또는 string) — 직전 workspace 와 다름 (OWNER/ADMIN/...)
    expect(src).toMatch(/role:\s*z\.[\s\S]*?\.optional\(\)/);
    expect(src).toMatch(/approvalLimit:\s*z\.[\s\S]*?\.optional\(\)/);
  });

  it("update data 에 approvalLimit 조건부 spread", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/approvalLimit\s*!==\s*undefined[\s\S]*?approvalLimit/);
  });

  it("audit log (MEMBER_APPROVAL_LIMIT_CHANGED) 호출 — entityType ORGANIZATION_MEMBER", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/createAuditLog/);
    expect(src).toMatch(/eventType:\s*["']MEMBER_APPROVAL_LIMIT_CHANGED["']/);
    expect(src).toMatch(/entityType:\s*["']ORGANIZATION_MEMBER["']/);
  });

  it("audit log try/catch graceful (mutation 정합 보호)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/try[\s\S]*?createAuditLog[\s\S]*?catch/);
  });

  it("§11.209d-approver-routing 또는 organization-member-admin-ui 코멘트", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/per-user-limit-organization-member|approvalLimit|§11\.209d/);
  });
});
