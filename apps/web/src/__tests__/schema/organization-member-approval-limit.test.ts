/**
 * #approver-routing-per-user-limit-organization-member Phase 1 server —
 * RED→GREEN test
 *
 * OrganizationMember.approvalLimit Int? — 단일 건 결재 한도 (KRW). null
 * = 무제한. 매트릭스의 mid/high tier (org_admin / org_owner) 분기에서
 * approvalLimit 검증 + 다음 tier fallback.
 *
 * 직전 #approver-routing-per-user-limit (Phase 1 server, WorkspaceMember
 * 만) 의 자연 follow-up — org member 도 한도 적용으로 lock 완성.
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

describe("#approver-routing-per-user-limit-organization-member — schema", () => {
  it("OrganizationMember 모델 안에 approvalLimit Int? 정의", () => {
    const src = read(SCHEMA);
    const omBlock = src.match(/model\s+OrganizationMember\s*\{[\s\S]*?\n\}/);
    expect(omBlock).not.toBeNull();
    if (omBlock) {
      expect(omBlock[0]).toMatch(/approvalLimit\s+Int\?/);
    }
  });

  it("approvalLimit 코멘트 — null 무제한 명시", () => {
    const src = read(SCHEMA);
    const omBlock = src.match(/model\s+OrganizationMember\s*\{[\s\S]*?\n\}/);
    if (omBlock) {
      expect(omBlock[0]).toMatch(/approvalLimit|per-user-limit-organization|null.*무제한/);
    }
  });
});

describe("#approver-routing-per-user-limit-organization-member — migration SQL", () => {
  it("organization_member_approval_limit migration 존재", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const found = entries.some((e) =>
      /organization_member_approval_limit/i.test(e),
    );
    expect(found).toBe(true);
  });

  it("ALTER TABLE OrganizationMember ADD COLUMN approvalLimit INTEGER (nullable)", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) =>
      /organization_member_approval_limit/i.test(e),
    );
    expect(target).toBeDefined();
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      expect(existsSync(sqlPath)).toBe(true);
      const sql = readFileSync(sqlPath, "utf8");
      expect(sql).toContain("ALTER TABLE");
      expect(sql).toContain("OrganizationMember");
      expect(sql).toContain("approvalLimit");
      expect(sql).toContain("INTEGER");
      // nullable — NOT NULL 잔존 0
      expect(sql).not.toMatch(/"approvalLimit"\s+INTEGER\s+NOT\s+NULL/);
    }
  });
});
