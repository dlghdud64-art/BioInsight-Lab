/**
 * §11.134 #admin-user-soft-delete-restore
 *
 * Source-level regression guard — soft-deleted user 복구 surface.
 *
 * 새 endpoint POST /api/admin/users/[id]/restore + getUsers helper 의
 * onlyDeleted query param 지원 + admin/users page 에 "삭제된 사용자"
 * dialog 추가.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("admin user soft-delete restore — regression guard (§11.134)", () => {
  const RESTORE_ROUTE = resolve(
    __dirname,
    "../../../app/api/admin/users/[id]/restore/route.ts",
  );
  const ADMIN_HELPER = resolve(__dirname, "../../../lib/api/admin.ts");
  const USERS_PAGE = resolve(
    __dirname,
    "../../../app/admin/users/page.tsx",
  );
  const USERS_GET_ROUTE = resolve(
    __dirname,
    "../../../app/api/admin/users/route.ts",
  );

  it("restore endpoint 파일 존재", () => {
    expect(existsSync(RESTORE_ROUTE)).toBe(true);
  });

  it("POST handler export + isAdmin guard", () => {
    if (!existsSync(RESTORE_ROUTE)) return;
    const source = readFileSync(RESTORE_ROUTE, "utf8");
    expect(source).toMatch(/export\s+async\s+function\s+POST/);
    expect(source).toMatch(/\bisAdmin\b/);
  });

  it("restore: db.user.update + deletedAt: null", () => {
    if (!existsSync(RESTORE_ROUTE)) return;
    const source = readFileSync(RESTORE_ROUTE, "utf8");
    expect(source).toMatch(/db\.user\.update/);
    expect(source).toMatch(/deletedAt:\s*null/);
  });

  it("restore: 이미 active user 는 400 (deletedAt 부재)", () => {
    if (!existsSync(RESTORE_ROUTE)) return;
    const source = readFileSync(RESTORE_ROUTE, "utf8");
    expect(source).toMatch(/already_active|이미 활성|not_deleted/);
  });

  it("restore: USER_UPDATED audit (action=user_restore)", () => {
    if (!existsSync(RESTORE_ROUTE)) return;
    const source = readFileSync(RESTORE_ROUTE, "utf8");
    expect(source).toMatch(/USER_UPDATED/);
    expect(source).toMatch(/user_restore|restore/);
  });

  it("getUsers helper 가 onlyDeleted param 지원", () => {
    const source = readFileSync(ADMIN_HELPER, "utf8");
    expect(source).toMatch(/onlyDeleted/);
  });

  it("/api/admin/users GET 가 onlyDeleted query param forward", () => {
    const source = readFileSync(USERS_GET_ROUTE, "utf8");
    expect(source).toMatch(/onlyDeleted/);
  });

  it("admin/users page 에 \"삭제된 사용자\" surface (button 또는 dialog)", () => {
    const source = readFileSync(USERS_PAGE, "utf8");
    expect(source).toMatch(/삭제된 사용자|deletedUsersDialog|onlyDeleted|DeletedUsersDialog/);
  });

  it("§11.133 회귀 0 — DELETE soft-delete 패턴 유지", () => {
    const deleteRoute = resolve(
      __dirname,
      "../../../app/api/admin/users/[id]/route.ts",
    );
    const source = readFileSync(deleteRoute, "utf8");
    expect(source).toMatch(/deletedAt:\s*new Date/);
  });
});
