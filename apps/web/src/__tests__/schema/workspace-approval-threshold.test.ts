/**
 * #approver-routing-threshold-admin-ui Phase 1 — RED test
 *
 * Workspace.approvalThresholdKrw Int @default(10000000) — 결재 임계치
 * workspace 별 변경 가능. 직전 §11.209d-approver-routing 의 hardcoded
 * 1,000만원 default 의 admin UI override.
 *
 * canonical truth:
 *   - schema 의 Workspace.approvalThresholdKrw single source
 *   - default 10000000 (1,000만원) — 모든 기존 workspace backward compat
 *   - selectApproverByAmount 가 threshold 인자 받음 (없으면 helper 상수 fallback)
 *
 * Out of scope:
 *   - per-user limit
 *   - multi-tier 임계치
 *   - 부서별 routing
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

describe("#approver-routing-threshold-admin-ui — schema.prisma Workspace.approvalThresholdKrw", () => {
  it("Workspace 모델 안에 approvalThresholdKrw Int @default(10000000) 정의", () => {
    const src = read(SCHEMA);
    // Workspace 블록 안 approvalThresholdKrw Int @default(10000000)
    expect(src).toMatch(/approvalThresholdKrw\s+Int\s+@default\(10000000\)/);
  });

  it("§11.209d-approver-routing-threshold 코멘트 명시 (drift 차단)", () => {
    const src = read(SCHEMA);
    expect(src).toMatch(/§11\.209d-approver-routing|approvalThresholdKrw/);
  });
});

describe("#approver-routing-threshold-admin-ui — migration SQL", () => {
  it("workspace_approval_threshold 또는 비슷한 migration 디렉토리 존재", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const found = entries.some((e) =>
      /approval_threshold|approval-threshold|approvalThreshold/i.test(e),
    );
    expect(found).toBe(true);
  });

  it("ALTER TABLE Workspace ADD COLUMN approvalThresholdKrw + DEFAULT", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) =>
      /approval_threshold|approval-threshold|approvalThreshold/i.test(e),
    );
    expect(target).toBeDefined();
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      expect(existsSync(sqlPath)).toBe(true);
      const sql = readFileSync(sqlPath, "utf8");
      expect(sql).toMatch(/ALTER\s+TABLE\s+"Workspace"/);
      expect(sql).toMatch(/ADD\s+COLUMN[^;]*approvalThresholdKrw/);
      expect(sql).toMatch(/DEFAULT\s+10000000/);
    }
  });
});
