/**
 * §11.138 #admin-user-soft-delete-purge-cron
 *
 * Source-level regression guard — daily cron 으로 30일 경과 soft-deleted user
 * hard purge. GDPR right-to-be-forgotten 정합.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/cron/user-soft-delete-purge/route.ts",
);
const VERCEL_JSON = resolve(__dirname, "../../../../vercel.json");

describe("user soft-delete purge cron — regression guard (§11.138)", () => {
  it("cron endpoint 파일 존재", () => {
    expect(existsSync(ROUTE_PATH)).toBe(true);
  });

  it("GET handler + CRON_SECRET / x-vercel-cron-signature auth", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/export\s+async\s+function\s+GET/);
    expect(source).toMatch(/CRON_SECRET|x-vercel-cron-signature/);
  });

  it("PURGE_AFTER_DAYS = 30 (GDPR cooldown)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/PURGE_AFTER_DAYS\s*=\s*30|30\s*\)\)?\s*;?\s*\/\/.*GDPR|30일/);
  });

  it("deletedAt: { not: null, lt: cutoff } query", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/deletedAt/);
    expect(source).toMatch(/not:\s*null/);
    expect(source).toMatch(/lt:\s*cutoff/);
  });

  it("audit log USER_DELETED + action=auto_purge_30d (hard delete 전)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/USER_DELETED/);
    expect(source).toMatch(/auto_purge/);
  });

  it("db.user.delete (hard delete cascade)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/db\.user\.delete/);
  });

  it("partial failure tolerance (errors 수집 + 다음 user 계속)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/errors\.push|catch\s*\(\s*err/);
  });

  it("vercel.json 에 cron 등록 (path + schedule)", () => {
    const source = readFileSync(VERCEL_JSON, "utf8");
    expect(source).toMatch(/user-soft-delete-purge/);
    expect(source).toMatch(/"schedule":\s*"0 2 \* \* \*"|"schedule":\s*"\d+ \d+ /);
  });

  it("§11.133 soft delete + §11.134 restore 회귀 0", () => {
    const deletePath = resolve(
      __dirname,
      "../../../app/api/admin/users/[id]/route.ts",
    );
    const restorePath = resolve(
      __dirname,
      "../../../app/api/admin/users/[id]/restore/route.ts",
    );
    expect(existsSync(deletePath)).toBe(true);
    expect(existsSync(restorePath)).toBe(true);
  });
});
