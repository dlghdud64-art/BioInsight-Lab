/**
 * #approver-routing-per-user-limit Phase 1 — RED→GREEN test
 *
 * WorkspaceMember.approvalLimit Int? — 단일 건 결재 한도 (KRW). null =
 * 무제한 (default). 값 있음 = 한도 초과 시 helper 가 다음 tier fallback.
 *
 * 매트릭스 정교화 lock — 직전 multi-tier matrix (low/mid/high) 위에
 * candidate per-user 한도 검증 layer 추가.
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

describe("#approver-routing-per-user-limit — schema.prisma", () => {
  it("WorkspaceMember 모델 안에 approvalLimit Int? 정의 (nullable, 무제한 = null)", () => {
    const src = read(SCHEMA);
    const wsmBlock = src.match(/model\s+WorkspaceMember\s*\{[\s\S]*?\n\}/);
    expect(wsmBlock).not.toBeNull();
    if (wsmBlock) {
      // approvalLimit Int? 또는 approvalLimit Int? @default(null) 같은 패턴
      expect(wsmBlock[0]).toMatch(/approvalLimit\s+Int\?/);
    }
  });

  it("#approver-routing-per-user-limit 코멘트 명시", () => {
    const src = read(SCHEMA);
    expect(src).toMatch(/per-user-limit|approvalLimit/);
  });
});

describe("#approver-routing-per-user-limit — migration SQL", () => {
  it("approval_limit migration 디렉토리 존재", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const found = entries.some((e) =>
      /approval_limit|approval-limit|approvalLimit|per_user|per-user/i.test(e),
    );
    expect(found).toBe(true);
  });

  it("ALTER TABLE WorkspaceMember ADD COLUMN approvalLimit INTEGER (nullable)", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) =>
      /approval_limit|approval-limit|approvalLimit|per_user|per-user/i.test(e),
    );
    expect(target).toBeDefined();
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      expect(existsSync(sqlPath)).toBe(true);
      const sql = readFileSync(sqlPath, "utf8");
      expect(sql).toMatch(/ALTER\s+TABLE\s+"WorkspaceMember"/);
      expect(sql).toMatch(/ADD\s+COLUMN[^;]*"approvalLimit"\s+INTEGER/);
      // nullable — NOT NULL 잔존 0
      expect(sql).not.toMatch(/"approvalLimit"\s+INTEGER\s+NOT\s+NULL/);
    }
  });
});
