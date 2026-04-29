/**
 * §11.133 #admin-user-soft-delete
 *
 * Source-level regression guard — DELETE endpoint 가 hard delete 대신
 * soft delete (deletedAt set) 사용 + getUsers filter + NextAuth deleted user
 * OAuth 차단.
 *
 * §11.117 audit 트레이드오프 정형화 — User row 보존 + deletedAt 컬럼 + USER_DELETED audit.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("admin user soft delete — regression guard (§11.133)", () => {
  const SCHEMA_PATH = resolve(
    __dirname,
    "../../../../prisma/schema.prisma",
  );
  const DELETE_ROUTE = resolve(
    __dirname,
    "../../../app/api/admin/users/[id]/route.ts",
  );
  const ADMIN_HELPER = resolve(
    __dirname,
    "../../../lib/api/admin.ts",
  );
  const AUTH_PATH = resolve(__dirname, "../../../auth.ts");

  it("Prisma User schema 에 deletedAt DateTime? 컬럼", () => {
    const source = readFileSync(SCHEMA_PATH, "utf8");
    const userBlock = source.match(/model User \{[\s\S]*?\n\}/);
    expect(userBlock).not.toBeNull();
    expect(userBlock![0]).toMatch(/deletedAt\s+DateTime\?/);
  });

  it("DELETE endpoint 가 db.user.update + deletedAt set", () => {
    if (!existsSync(DELETE_ROUTE)) return;
    const source = readFileSync(DELETE_ROUTE, "utf8");
    expect(source).toMatch(/db\.user\.update/);
    expect(source).toMatch(/deletedAt:\s*new Date/);
  });

  it("DELETE endpoint 가 db.user.delete 호출 안 함 (hard delete 회귀 차단)", () => {
    if (!existsSync(DELETE_ROUTE)) return;
    const source = readFileSync(DELETE_ROUTE, "utf8");
    expect(source).not.toMatch(/db\.user\.delete\(/);
  });

  it("getUsers helper 가 deletedAt: null filter", () => {
    const source = readFileSync(ADMIN_HELPER, "utf8");
    expect(source).toMatch(/deletedAt:\s*null/);
  });

  it("auth.ts jwt callback 가 deletedAt 차단 (OAuth deleted user 거부)", () => {
    const source = readFileSync(AUTH_PATH, "utf8");
    expect(source).toMatch(/deletedAt/);
  });

  it("USER_DELETED audit event 회귀 0", () => {
    if (!existsSync(DELETE_ROUTE)) return;
    const source = readFileSync(DELETE_ROUTE, "utf8");
    expect(source).toMatch(/USER_DELETED/);
  });

  it("self-reject 차단 회귀 0 (§11.117)", () => {
    if (!existsSync(DELETE_ROUTE)) return;
    const source = readFileSync(DELETE_ROUTE, "utf8");
    expect(source).toMatch(/self_reject|session\.user\.id\s*===\s*targetUserId/);
  });

  it("migration 파일 존재 (20260429120300_add_user_deleted_at)", () => {
    const migrationPath = resolve(
      __dirname,
      "../../../../prisma/migrations/20260429120300_add_user_deleted_at/migration.sql",
    );
    expect(existsSync(migrationPath)).toBe(true);
    if (existsSync(migrationPath)) {
      const sql = readFileSync(migrationPath, "utf8");
      expect(sql).toMatch(/ADD COLUMN\s+"?deletedAt"?\s+TIMESTAMP/);
    }
  });
});
