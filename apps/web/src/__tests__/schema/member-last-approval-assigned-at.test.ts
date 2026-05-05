/**
 * #approver-routing-multi-owner-roundrobin — RED→GREEN test
 *
 * WorkspaceMember + OrganizationMember 에 lastApprovalAssignedAt DateTime?
 * 추가 — round-robin 분산 lock. helper 가 orderBy lastApprovalAssignedAt
 * asc (null 우선 — 한 번도 안 받은 member 우선) + createdAt asc tie-breaker.
 *
 * mutation 시 candidate 의 lastApprovalAssignedAt 업데이트 (request-approval
 * route 안에서 try/catch graceful — round-robin 분산 보장).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCHEMA = "prisma/schema.prisma";
const MIGRATIONS_DIR = "prisma/migrations";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-multi-owner-roundrobin — schema field", () => {
  it("WorkspaceMember 에 lastApprovalAssignedAt DateTime? 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/model\s+WorkspaceMember\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/lastApprovalAssignedAt\s+DateTime\?/);
    }
  });

  it("OrganizationMember 에 lastApprovalAssignedAt DateTime? 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/model\s+OrganizationMember\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/lastApprovalAssignedAt\s+DateTime\?/);
    }
  });

  it("multi-owner-roundrobin 또는 lastApprovalAssignedAt 코멘트 명시", () => {
    const src = read(SCHEMA);
    expect(src).toMatch(/multi-owner-roundrobin|lastApprovalAssignedAt/);
  });
});

describe("#approver-routing-multi-owner-roundrobin — migration SQL", () => {
  it("multi_owner_roundrobin migration 디렉토리 존재", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const found = entries.some((e) =>
      /multi_owner_roundrobin|last_approval_assigned/i.test(e),
    );
    expect(found).toBe(true);
  });

  it("ALTER TABLE WorkspaceMember + OrganizationMember 둘 다 ADD COLUMN", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) =>
      /multi_owner_roundrobin|last_approval_assigned/i.test(e),
    );
    expect(target).toBeDefined();
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      expect(existsSync(sqlPath)).toBe(true);
      const sql = readFileSync(sqlPath, "utf8");
      expect(sql).toContain("WorkspaceMember");
      expect(sql).toContain("OrganizationMember");
      expect(sql).toContain("lastApprovalAssignedAt");
      expect(sql).toContain("TIMESTAMP");
    }
  });
});
