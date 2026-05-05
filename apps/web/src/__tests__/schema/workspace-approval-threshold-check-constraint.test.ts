/**
 * #approver-routing-cross-field-validation-db-check-constraint — RED→GREEN test
 *
 * PostgreSQL CHECK constraint — workspace_approval_threshold_low_le_high.
 * 4-layer defense in depth 의 마지막 DB level lock:
 *   - approvalLowThresholdKrw <= approvalThresholdKrw 강제
 *   - 직접 SQL / Prisma raw update 우회 차단
 *
 * Scope:
 *   - migration SQL ALTER TABLE ADD CONSTRAINT 정합
 *   - constraint name 명시 (rollback + error message 정합)
 *   - schema.prisma 의 Workspace 모델 코멘트 (CHECK 명시 — reader 정합)
 *
 * Out of scope:
 *   - prisma schema CHECK syntax (Prisma 미지원)
 *   - 다른 model CHECK
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

describe("#approver-routing-cross-field-validation-db-check-constraint — migration SQL", () => {
  it("CHECK constraint migration 디렉토리 존재 (check_constraint 또는 비슷)", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const found = entries.some((e) =>
      /threshold_check|threshold-check|check_constraint|low_le_high|approval.*check/i.test(e),
    );
    expect(found).toBe(true);
  });

  it("ALTER TABLE Workspace ADD CONSTRAINT CHECK (low <= high)", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) =>
      /threshold_check|threshold-check|check_constraint|low_le_high|approval.*check/i.test(e),
    );
    expect(target).toBeDefined();
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      expect(existsSync(sqlPath)).toBe(true);
      const sql = readFileSync(sqlPath, "utf8");
      expect(sql).toMatch(/ALTER\s+TABLE\s+"Workspace"/);
      expect(sql).toMatch(/ADD\s+CONSTRAINT/);
      expect(sql).toMatch(/CHECK\s*\([^)]*approvalLowThresholdKrw[\s\S]*?<=[\s\S]*?approvalThresholdKrw/);
    }
  });

  it("constraint name 명시 (workspace_approval_threshold_low_le_high)", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) =>
      /threshold_check|threshold-check|check_constraint|low_le_high|approval.*check/i.test(e),
    );
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      const sql = readFileSync(sqlPath, "utf8");
      expect(sql).toMatch(/workspace_approval_threshold_low_le_high|approval_threshold_low_le_high/);
    }
  });
});

describe("#approver-routing-cross-field-validation-db-check-constraint — schema.prisma 코멘트", () => {
  it("Workspace 모델 안에 CHECK constraint 코멘트 명시 (Prisma syntax 0, reader 정합)", () => {
    const src = read(SCHEMA);
    // Workspace 모델 안 또는 직후에 CHECK constraint 명시 (코멘트)
    const wsBlock = src.match(/model\s+Workspace\s*\{[\s\S]*?\n\}/);
    expect(wsBlock).not.toBeNull();
    if (wsBlock) {
      // CHECK constraint 또는 low_le_high 또는 cross-field-validation-db-check 코멘트
      expect(wsBlock[0]).toMatch(/CHECK|low_le_high|cross-field-validation-db-check|migration[^"]*CHECK|DB level/i);
    }
  });
});
