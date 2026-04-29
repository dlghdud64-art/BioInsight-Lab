/**
 * §11.141 #admin-user-purge-cron-soft-fail-alert
 *
 * Source-level regression guard — purge cron 실패 시 admin 가시성 강화.
 * critical AuditLog (action=auto_purge_failed) + console.error.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/api/cron/user-soft-delete-purge/route.ts",
);

describe("purge cron fail alert — regression guard (§11.141)", () => {
  const source = readFileSync(PATH, "utf8");

  it("auto_purge_failed audit action 존재", () => {
    expect(source).toMatch(/auto_purge_failed/);
  });

  it("errors.length > 0 분기로 alert log + console.error", () => {
    expect(source).toMatch(/errors\.length\s*>\s*0/);
    expect(source).toMatch(/console\.error.*FAIL ALERT|FAIL ALERT/);
  });

  it("alert audit log 가 success: false + errorMessage", () => {
    expect(source).toMatch(/success:\s*false/);
    expect(source).toMatch(/errorMessage/);
  });

  it("failedSample (errors slice) 보존 (max 5)", () => {
    expect(source).toMatch(/errors\.slice\(0,\s*5\)/);
  });

  it("§11.138 hard delete + audit 보존 회귀 0", () => {
    expect(source).toMatch(/db\.user\.delete/);
    expect(source).toMatch(/auto_purge_30d/);
  });
});
