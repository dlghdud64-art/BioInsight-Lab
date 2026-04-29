/**
 * §11.116 #admin-user-invite-flow (link-only)
 *
 * Phase 1 RED tests — invite helper + endpoint source contract.
 *
 * Helper 책임 (canonical):
 *   - validateInviteInput({email, name, role}):
 *     · email: required, valid format
 *     · name: optional, trim
 *     · role: required, UserRole enum 매칭
 *   - buildInviteLink(email, baseUrl): "${baseUrl}/auth/signin?email=${encoded}"
 *
 * Endpoint:
 *   - POST /api/admin/users/invite
 *   - admin only (isAdmin)
 *   - 동일 email 중복 invite reject (409)
 *   - User row create (emailVerified=null, status="pending" derive)
 *   - audit log USER_CREATED
 *
 * NextAuth jwt callback patch:
 *   - 기존 dbUser link 분기에서 emailVerified 가 null 이면 자동 set
 *     (OAuth login 으로 invite acceptance)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  validateInviteInput,
  buildInviteLink,
  InviteValidationError,
} from "@/lib/admin/invite";

describe("validateInviteInput — helper contract (§11.116)", () => {
  describe("email", () => {
    it("valid email → 통과", () => {
      const result = validateInviteInput({
        email: "user@example.com",
        role: "RESEARCHER",
      });
      expect(result.email).toBe("user@example.com");
    });

    it("trim + lowercase normalize", () => {
      const result = validateInviteInput({
        email: "  USER@Example.COM  ",
        role: "RESEARCHER",
      });
      expect(result.email).toBe("user@example.com");
    });

    it("missing email throws", () => {
      expect(() =>
        validateInviteInput({ role: "RESEARCHER" } as any),
      ).toThrow(InviteValidationError);
    });

    it("empty string email throws", () => {
      expect(() =>
        validateInviteInput({ email: "", role: "RESEARCHER" }),
      ).toThrow(InviteValidationError);
    });

    it("invalid format (no @) throws", () => {
      expect(() =>
        validateInviteInput({ email: "notanemail", role: "RESEARCHER" }),
      ).toThrow(InviteValidationError);
    });

    it("invalid format (no domain) throws", () => {
      expect(() =>
        validateInviteInput({ email: "user@", role: "RESEARCHER" }),
      ).toThrow(InviteValidationError);
    });
  });

  describe("name", () => {
    it("undefined → null", () => {
      const result = validateInviteInput({
        email: "u@a.com",
        role: "RESEARCHER",
      });
      expect(result.name).toBeNull();
    });

    it("empty string → null", () => {
      const result = validateInviteInput({
        email: "u@a.com",
        name: "",
        role: "RESEARCHER",
      });
      expect(result.name).toBeNull();
    });

    it("trim", () => {
      const result = validateInviteInput({
        email: "u@a.com",
        name: "  홍길동  ",
        role: "RESEARCHER",
      });
      expect(result.name).toBe("홍길동");
    });
  });

  describe("role", () => {
    const validRoles = [
      "OWNER",
      "ADMIN",
      "APPROVER",
      "REQUESTER",
      "VIEWER",
      "RESEARCHER",
    ];

    validRoles.forEach((role) => {
      it(`'${role}' → 정상 통과`, () => {
        const result = validateInviteInput({
          email: "u@a.com",
          role: role as any,
        });
        expect(result.role).toBe(role);
      });
    });

    it("missing role throws", () => {
      expect(() =>
        validateInviteInput({ email: "u@a.com" } as any),
      ).toThrow(InviteValidationError);
    });

    it("invalid role 'GUEST' throws", () => {
      expect(() =>
        validateInviteInput({ email: "u@a.com", role: "GUEST" as any }),
      ).toThrow(InviteValidationError);
    });
  });
});

describe("buildInviteLink — helper contract (§11.116)", () => {
  it("기본 형식: baseUrl + /auth/signin?email=encoded", () => {
    const link = buildInviteLink("user@example.com", "https://labaxis.io");
    expect(link).toBe(
      "https://labaxis.io/auth/signin?email=user%40example.com",
    );
  });

  it("baseUrl 의 trailing slash 정규화", () => {
    const link = buildInviteLink("user@example.com", "https://labaxis.io/");
    expect(link).toBe(
      "https://labaxis.io/auth/signin?email=user%40example.com",
    );
  });

  it("special chars (+, .) 정상 encode", () => {
    const link = buildInviteLink("a.b+tag@example.com", "https://labaxis.io");
    expect(link).toContain("a.b%2Btag%40example.com");
  });
});

describe("/api/admin/users/invite endpoint — source contract (§11.116)", () => {
  const ROUTE_PATH = resolve(
    __dirname,
    "../../../app/api/admin/users/invite/route.ts",
  );

  it("endpoint 파일 존재", () => {
    expect(existsSync(ROUTE_PATH)).toBe(true);
  });

  it("POST handler export", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/export\s+async\s+function\s+POST/);
  });

  it("admin guard 호출 (isAdmin)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/\bisAdmin\b/);
  });

  it("validateInviteInput helper 사용", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/\bvalidateInviteInput\b/);
  });

  it("db.user.create 호출 (User row create)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/db\.user\.create|user\.create/);
  });

  it("USER_CREATED audit event", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/USER_CREATED/);
  });

  it("buildInviteLink 호출 (response 에 link 포함)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/\bbuildInviteLink\b/);
  });

  it("auth() session 호출 (Unauthorized 분기)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/\bauth\(\)/);
  });
});

describe("auth.ts jwt callback — emailVerified link patch (§11.116)", () => {
  const AUTH_PATH = resolve(__dirname, "../../../auth.ts");

  it("emailVerified link logic 존재 (invited user OAuth acceptance)", () => {
    const source = readFileSync(AUTH_PATH, "utf8");
    // dbUser 있는 분기에서 emailVerified null 시 update 호출
    expect(source).toMatch(/emailVerified/);
  });

  it("invited user 의 dbUser.emailVerified 가 falsy 시 db.user.update 호출", () => {
    const source = readFileSync(AUTH_PATH, "utf8");
    // 패턴: emailVerified 체크 + user.update
    expect(source).toMatch(
      /!\s*dbUser\.emailVerified|dbUser\.emailVerified\s*===?\s*null|emailVerified:\s*new Date\(\)/,
    );
  });
});
