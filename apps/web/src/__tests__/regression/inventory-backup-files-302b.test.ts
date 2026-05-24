/**
 * §11.302b #inventory-backup-files — inventory-content.tsx.full +
 *   .full2 dead backup file 삭제 회귀 차단.
 *
 * 배경 (§11.302a 후속):
 * §11.297 family v6 (재고 batch) 진행 중 임시 backup 으로 생성됐던
 * inventory-content.tsx 의 .full / .full2 sibling file 이 잔존.
 * Active code import 0 — sentinel grep audit 결과:
 *   - 본 sentinel file 자체의 trace mention
 *   - ADR-002-pilot-tenant-seed.md historical record 단일 언급 (보존)
 *   - §11.298f / §11.302a commit draft 의 mention (히스토리)
 *
 * 호영님 권장순서 OK (2026-05-25):
 *   `git rm apps/web/src/app/dashboard/inventory/inventory-content.tsx.full`
 *   `git rm apps/web/src/app/dashboard/inventory/inventory-content.tsx.full2`
 *
 * sandbox 자동 삭제 0 — CLAUDE.md prohibited actions (permanent
 * deletions). 호영님 환경 git rm 후 본 sentinel test 통과.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const BACKUP_FULL = resolve(
  REPO_ROOT,
  "apps/web/src/app/dashboard/inventory/inventory-content.tsx.full",
);
const BACKUP_FULL2 = resolve(
  REPO_ROOT,
  "apps/web/src/app/dashboard/inventory/inventory-content.tsx.full2",
);
const ADR_002_SRC = readFileSync(
  resolve(REPO_ROOT, "docs/decisions/ADR-002-pilot-tenant-seed.md"),
  "utf8",
);

describe("§11.302b — inventory-content backup file dead cleanup", () => {
  it("§11.302b trace marker (self-referential sentinel)", () => {
    const selfSrc = readFileSync(__filename, "utf8");
    expect(selfSrc).toMatch(/§11\.302b/);
  });

  it("apps/web/src/app/dashboard/inventory/inventory-content.tsx.full 부재", () => {
    expect(existsSync(BACKUP_FULL)).toBe(false);
  });

  it("apps/web/src/app/dashboard/inventory/inventory-content.tsx.full2 부재", () => {
    expect(existsSync(BACKUP_FULL2)).toBe(false);
  });

  it("active production file (inventory-content.tsx) 보존 (회귀 0)", () => {
    const productionFile = resolve(
      REPO_ROOT,
      "apps/web/src/app/dashboard/inventory/inventory-content.tsx",
    );
    expect(existsSync(productionFile)).toBe(true);
  });

  it("ADR-002 historical mention 보존 (히스토리 기록)", () => {
    // backup file 의 historical context 는 ADR-002 에 남아있음 — 보존
    expect(ADR_002_SRC).toMatch(/inventory-content/);
  });
});
