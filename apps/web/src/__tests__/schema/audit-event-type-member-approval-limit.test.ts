/**
 * #approver-routing-per-user-limit-audit-log — RED→GREEN test
 *
 * AuditEventType enum 에 dedicated value 추가:
 *   - MEMBER_APPROVAL_LIMIT_CHANGED — workspace member 결재 한도 변경
 *
 * 직전 #approver-routing-event-type-enum-add 의 패턴 (WORKSPACE_THRESHOLD_CHANGED
 * + PURCHASE_REQUEST_CREATED) 정합. event-labels + migration SQL.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCHEMA = "prisma/schema.prisma";
const MIGRATIONS_DIR = "prisma/migrations";
const LABELS = "src/lib/audit/event-labels.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-per-user-limit-audit-log — schema enum", () => {
  it("AuditEventType enum 안에 MEMBER_APPROVAL_LIMIT_CHANGED 추가", () => {
    const src = read(SCHEMA);
    const enumBlock = src.match(/enum\s+AuditEventType\s*\{[\s\S]*?\n\}/);
    expect(enumBlock).not.toBeNull();
    if (enumBlock) {
      expect(enumBlock[0]).toMatch(/MEMBER_APPROVAL_LIMIT_CHANGED/);
    }
  });
});

describe("#approver-routing-per-user-limit-audit-log — migration SQL", () => {
  it("ALTER TYPE migration 디렉토리 존재", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const found = entries.some((e) =>
      /audit_event_type_member_approval_limit/i.test(e),
    );
    expect(found).toBe(true);
  });

  it("ALTER TYPE AuditEventType ADD VALUE MEMBER_APPROVAL_LIMIT_CHANGED", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) =>
      /audit_event_type_member_approval_limit/i.test(e),
    );
    expect(target).toBeDefined();
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      expect(existsSync(sqlPath)).toBe(true);
      const sql = readFileSync(sqlPath, "utf8");
      // ALTER TYPE + AuditEventType + MEMBER_APPROVAL_LIMIT_CHANGED 모두 존재
      expect(sql).toContain("ALTER TYPE");
      expect(sql).toContain("AuditEventType");
      expect(sql).toContain("ADD VALUE");
      expect(sql).toContain("MEMBER_APPROVAL_LIMIT_CHANGED");
    }
  });
});

describe("#approver-routing-per-user-limit-audit-log — event-labels.ts", () => {
  it("MEMBER_APPROVAL_LIMIT_CHANGED 한국어 label '결재 한도 변경' + tone storage", () => {
    const src = read(LABELS);
    expect(src).toMatch(/MEMBER_APPROVAL_LIMIT_CHANGED:\s*\{[\s\S]*?label:\s*["'][^"']*결재 한도[^"']*["'][\s\S]*?tone:\s*["']storage["']/);
  });
});

describe("#approver-routing-per-user-limit-audit-log — route audit", () => {
  const ROUTE = "src/app/api/workspaces/[id]/members/[memberId]/route.ts";

  it("createAuditLog import (lib/audit)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/createAuditLog/);
  });

  it("eventType: MEMBER_APPROVAL_LIMIT_CHANGED 명시", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/eventType:\s*["']MEMBER_APPROVAL_LIMIT_CHANGED["']/);
  });

  it("approvalLimit 변경 시 createAuditLog 호출 (조건부 — 다른 field 단독 변경 시 skip)", () => {
    const src = read(ROUTE);
    // approvalLimit !== undefined 분기 + createAuditLog 호출 (다른 field 단독
    // 변경 시 skip lock). source 안에 둘 다 명시.
    expect(src).toMatch(/approvalLimit\s*!==\s*undefined/);
    expect(src).toMatch(/createAuditLog/);
  });

  it("changes.before / changes.after 명시 (approvalLimit before/after)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/before:\s*\{[\s\S]*?approvalLimit/);
    expect(src).toMatch(/after:\s*\{[\s\S]*?approvalLimit/);
  });

  it("try/catch graceful (audit fail → mutation 결과 영향 0)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/try[\s\S]*?createAuditLog[\s\S]*?catch/);
  });

  it("§11.209d-approver-routing 또는 per-user-limit-audit-log 코멘트", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/per-user-limit-audit-log|MEMBER_APPROVAL_LIMIT_CHANGED|결재 한도 변경/);
  });
});
