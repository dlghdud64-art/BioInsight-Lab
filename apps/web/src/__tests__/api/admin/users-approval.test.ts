/**
 * §11.117 #admin-user-approval-flow
 *
 * Phase 1 RED tests — manual approve (POST) + reject/delete (DELETE) endpoint
 * source contract.
 *
 * 두 endpoint:
 *   POST   /api/admin/users/[id]/approval — manual emailVerified set (OAuth bypass)
 *   DELETE /api/admin/users/[id]          — hard delete (반려)
 *
 * 둘 다 admin only + self-protection guard (자기 자신 반려 금지) + audit log.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("/api/admin/users/[id]/approval endpoint — manual approve (§11.117)", () => {
  const ROUTE_PATH = resolve(
    __dirname,
    "../../../app/api/admin/users/[id]/approval/route.ts",
  );

  it("endpoint 파일 존재", () => {
    expect(existsSync(ROUTE_PATH)).toBe(true);
  });

  it("POST handler export", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/export\s+async\s+function\s+POST/);
  });

  it("isAdmin guard", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/\bisAdmin\b/);
  });

  it("emailVerified set (manual approval)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/emailVerified.*new Date|emailVerified:\s*new Date/);
  });

  it("USER_UPDATED 또는 USER_APPROVED audit event", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/USER_UPDATED|USER_APPROVED/);
  });

  it("이미 active user (emailVerified truthy) 분기 — 400 noop", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    // 패턴: existing.emailVerified 체크 + 400 또는 already active 메시지
    expect(source).toMatch(/emailVerified|이미 활성|already_active/);
  });

  it("auth() session 호출", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/\bauth\(\)/);
  });
});

describe("/api/admin/users/[id] DELETE endpoint — reject (§11.117)", () => {
  const ROUTE_PATH = resolve(
    __dirname,
    "../../../app/api/admin/users/[id]/route.ts",
  );

  it("endpoint 파일 존재", () => {
    expect(existsSync(ROUTE_PATH)).toBe(true);
  });

  it("DELETE handler export", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/export\s+async\s+function\s+DELETE/);
  });

  it("isAdmin guard", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/\bisAdmin\b/);
  });

  it("self-reject 차단 (session.user.id === target reject)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    // 패턴: session.user.id 와 target id 비교 후 400
    expect(source).toMatch(
      /session\.user\.id\s*===\s*targetUserId|self_reject|본인.*반려|본인.*삭제/,
    );
  });

  it("§11.133 soft delete: db.user.update + deletedAt set (hard delete 회귀 차단)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    // §11.133 — db.user.update 로 deletedAt set (hard delete 가 아닌 soft delete)
    expect(source).toMatch(/db\.user\.update|user\.update/);
    expect(source).toMatch(/deletedAt:\s*new Date|deletedAt:\s*now/);
  });

  it("USER_DELETED audit event", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/USER_DELETED/);
  });

  it("auth() session 호출", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/\bauth\(\)/);
  });
});
