/**
 * §11.115 #admin-user-approval-policy-set-surface
 *
 * Phase 1 RED tests — `normalizeApprovalPolicyInput` helper contract.
 *
 * Helper 책임 (canonical):
 *   - approvalLimit: null/undefined/empty → null. integer >= 0 → BigInt. 그 외 throw.
 *   - costCenter: null/undefined/empty/"  " → null. trim. throw 0건.
 *   - defaultLocation: null/undefined/empty/"  " → null. trim. throw 0건.
 *
 * Endpoint 본체 (PATCH /api/admin/users/[id]/approval-policy) 는 별도 source-level
 * lint 로 회귀 차단 (admin guard 호출 + audit log 호출 + helper 사용 확인).
 *
 * sandbox 환경에서 Prisma mocking 회피 — pure helper unit tests + source-level
 * grep contract.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  normalizeApprovalPolicyInput,
  ApprovalPolicyValidationError,
} from "@/lib/admin/approval-policy";

describe("normalizeApprovalPolicyInput — helper contract (§11.115)", () => {
  describe("approvalLimit", () => {
    it("null → null (정책 미설정 보존)", () => {
      const result = normalizeApprovalPolicyInput({ approvalLimit: null });
      expect(result.approvalLimit).toBeNull();
    });

    it("undefined → null (제외 input 도 honest empty)", () => {
      const result = normalizeApprovalPolicyInput({});
      expect(result.approvalLimit).toBeNull();
    });

    it("empty string → null", () => {
      const result = normalizeApprovalPolicyInput({ approvalLimit: "" });
      expect(result.approvalLimit).toBeNull();
    });

    it("'   ' (whitespace) → null", () => {
      const result = normalizeApprovalPolicyInput({ approvalLimit: "   " });
      expect(result.approvalLimit).toBeNull();
    });

    it("'0' → BigInt(0)", () => {
      const result = normalizeApprovalPolicyInput({ approvalLimit: "0" });
      expect(result.approvalLimit).toBe(BigInt(0));
    });

    it("number 100000 → BigInt(100000)", () => {
      const result = normalizeApprovalPolicyInput({ approvalLimit: 100000 });
      expect(result.approvalLimit).toBe(BigInt(100000));
    });

    it("'100,000,000' (콤마 포함) → BigInt(100000000)", () => {
      const result = normalizeApprovalPolicyInput({
        approvalLimit: "100,000,000",
      });
      expect(result.approvalLimit).toBe(BigInt(100000000));
    });

    it("음수 throws ApprovalPolicyValidationError", () => {
      expect(() =>
        normalizeApprovalPolicyInput({ approvalLimit: -1 }),
      ).toThrow(ApprovalPolicyValidationError);
    });

    it("'-100' throws ApprovalPolicyValidationError", () => {
      expect(() =>
        normalizeApprovalPolicyInput({ approvalLimit: "-100" }),
      ).toThrow(ApprovalPolicyValidationError);
    });

    it("'abc' (non-numeric) throws ApprovalPolicyValidationError", () => {
      expect(() =>
        normalizeApprovalPolicyInput({ approvalLimit: "abc" }),
      ).toThrow(ApprovalPolicyValidationError);
    });

    it("non-integer (1.5) throws ApprovalPolicyValidationError", () => {
      expect(() =>
        normalizeApprovalPolicyInput({ approvalLimit: 1.5 }),
      ).toThrow(ApprovalPolicyValidationError);
    });
  });

  describe("costCenter", () => {
    it("null → null", () => {
      const result = normalizeApprovalPolicyInput({ costCenter: null });
      expect(result.costCenter).toBeNull();
    });

    it("undefined → null", () => {
      const result = normalizeApprovalPolicyInput({});
      expect(result.costCenter).toBeNull();
    });

    it("empty string → null", () => {
      const result = normalizeApprovalPolicyInput({ costCenter: "" });
      expect(result.costCenter).toBeNull();
    });

    it("'   ' (whitespace) → null", () => {
      const result = normalizeApprovalPolicyInput({ costCenter: "   " });
      expect(result.costCenter).toBeNull();
    });

    it("'  RND-01  ' → 'RND-01' (trim)", () => {
      const result = normalizeApprovalPolicyInput({ costCenter: "  RND-01  " });
      expect(result.costCenter).toBe("RND-01");
    });

    it("'RND-BIO-SITE01' → 'RND-BIO-SITE01' (정상 통과)", () => {
      const result = normalizeApprovalPolicyInput({
        costCenter: "RND-BIO-SITE01",
      });
      expect(result.costCenter).toBe("RND-BIO-SITE01");
    });
  });

  describe("defaultLocation", () => {
    it("null → null", () => {
      const result = normalizeApprovalPolicyInput({ defaultLocation: null });
      expect(result.defaultLocation).toBeNull();
    });

    it("'  제1R&D센터 중앙창고  ' → trim", () => {
      const result = normalizeApprovalPolicyInput({
        defaultLocation: "  제1R&D센터 중앙창고  ",
      });
      expect(result.defaultLocation).toBe("제1R&D센터 중앙창고");
    });
  });

  describe("combined input", () => {
    it("3 필드 모두 정상 input → 모두 정상 normalize", () => {
      const result = normalizeApprovalPolicyInput({
        approvalLimit: 100000000,
        costCenter: "RND-BIO-SITE01",
        defaultLocation: "제1R&D센터 중앙창고",
      });
      expect(result.approvalLimit).toBe(BigInt(100000000));
      expect(result.costCenter).toBe("RND-BIO-SITE01");
      expect(result.defaultLocation).toBe("제1R&D센터 중앙창고");
    });

    it("3 필드 모두 null/empty → 모두 null (정책 reset)", () => {
      const result = normalizeApprovalPolicyInput({
        approvalLimit: null,
        costCenter: "",
        defaultLocation: "   ",
      });
      expect(result.approvalLimit).toBeNull();
      expect(result.costCenter).toBeNull();
      expect(result.defaultLocation).toBeNull();
    });
  });
});

describe("/api/admin/users/[id]/approval-policy endpoint — source contract (§11.115)", () => {
  const ROUTE_PATH = resolve(
    __dirname,
    "../../../app/api/admin/users/[id]/approval-policy/route.ts",
  );

  it("endpoint 파일 존재", () => {
    expect(existsSync(ROUTE_PATH)).toBe(true);
  });

  it("PATCH handler export (Next.js convention)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/export\s+async\s+function\s+PATCH/);
  });

  it("admin guard 호출 (isAdmin)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/\bisAdmin\b/);
  });

  it("normalizeApprovalPolicyInput helper 사용", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/\bnormalizeApprovalPolicyInput\b/);
  });

  it("audit log 호출 (logAuditEvent or AuditEventType.USER_UPDATED)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/USER_UPDATED|logAuditEvent/);
  });

  it("BigInt → string serialize (response payload)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    // approvalLimit BigInt 직접 직렬화 불가 — toString or Number cast 필요
    expect(source).toMatch(/(\.toString\(\)|Number\()/);
  });

  it("auth() session 호출 (Unauthorized 분기)", () => {
    if (!existsSync(ROUTE_PATH)) return;
    const source = readFileSync(ROUTE_PATH, "utf8");
    expect(source).toMatch(/\bauth\(\)/);
  });
});
