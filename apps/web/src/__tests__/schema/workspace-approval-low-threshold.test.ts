/**
 * #approver-routing-multi-tier-threshold Phase 1 — RED test
 *
 * Workspace.approvalLowThresholdKrw Int @default(1000000) — 중액/저액 구분
 * 임계치. 직전 #approver-routing-threshold-admin-ui 의 approvalThresholdKrw
 * (default 10M) 와 함께 3 tier 매트릭스 정합:
 *   - amount < approvalLowThresholdKrw (default 1M) → workspace_admin (low)
 *   - low <= amount < approvalThresholdKrw (default 10M) → org_admin (mid)
 *   - amount >= approvalThresholdKrw → org_owner (high)
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

describe("#approver-routing-multi-tier-threshold — schema.prisma Workspace.approvalLowThresholdKrw", () => {
  it("Workspace 모델 안에 approvalLowThresholdKrw Int @default(1000000) 정의", () => {
    const src = read(SCHEMA);
    expect(src).toMatch(/approvalLowThresholdKrw\s+Int\s+@default\(1000000\)/);
  });

  it("approvalThresholdKrw (직전 batch field) 그대로 보존 (rename 없음)", () => {
    const src = read(SCHEMA);
    expect(src).toMatch(/approvalThresholdKrw\s+Int\s+@default\(10000000\)/);
  });

  it("§11.209d-approver-routing 또는 multi-tier 코멘트 명시", () => {
    const src = read(SCHEMA);
    expect(src).toMatch(/multi-tier|approvalLowThresholdKrw|§11\.209d-approver-routing/);
  });
});

describe("#approver-routing-multi-tier-threshold — migration SQL", () => {
  it("migration 디렉토리 존재 (low_threshold 또는 multi_tier 명시)", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const found = entries.some((e) =>
      /low_threshold|low-threshold|lowThreshold|multi_tier|multi-tier/i.test(e),
    );
    expect(found).toBe(true);
  });

  it("ALTER TABLE Workspace ADD COLUMN approvalLowThresholdKrw + DEFAULT 1000000", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) =>
      /low_threshold|low-threshold|lowThreshold|multi_tier|multi-tier/i.test(e),
    );
    expect(target).toBeDefined();
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      expect(existsSync(sqlPath)).toBe(true);
      const sql = readFileSync(sqlPath, "utf8");
      expect(sql).toMatch(/ALTER\s+TABLE\s+"Workspace"/);
      expect(sql).toMatch(/ADD\s+COLUMN[^;]*approvalLowThresholdKrw/);
      expect(sql).toMatch(/DEFAULT\s+1000000/);
    }
  });
});
