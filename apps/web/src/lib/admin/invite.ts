/**
 * §11.116 #admin-user-invite-flow (link-only)
 *
 * Admin invite input validation + link builder helpers.
 *
 * 책임:
 *   - validateInviteInput: email/name/role 정합성 검증 + normalize
 *   - buildInviteLink: invite link 생성 (`<baseUrl>/auth/signin?email=<encoded>`)
 *
 * Pure function — DB 접근 / Prisma 의존 0.
 *
 * Token DB store 0 — NextAuth jwt callback 의 email match 흐름으로 활성화.
 * (옵션 A — link-only, email send 0)
 */

import type { UserRole } from "@prisma/client";

export class InviteValidationError extends Error {
  field: "email" | "name" | "role";
  reason: string;

  constructor(
    field: "email" | "name" | "role",
    reason: string,
  ) {
    super(`Invalid ${field}: ${reason}`);
    this.name = "InviteValidationError";
    this.field = field;
    this.reason = reason;
  }
}

const VALID_ROLES = new Set<UserRole>([
  "OWNER",
  "ADMIN",
  "APPROVER",
  "REQUESTER",
  "VIEWER",
  "RESEARCHER",
] as UserRole[]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InviteInput {
  email?: string;
  name?: string | null;
  role?: UserRole;
}

export interface InviteNormalized {
  email: string;
  name: string | null;
  role: UserRole;
}

export function validateInviteInput(input: InviteInput): InviteNormalized {
  // email
  if (!input.email || typeof input.email !== "string") {
    throw new InviteValidationError("email", "이메일을 입력해 주세요.");
  }
  const email = input.email.trim().toLowerCase();
  if (email.length === 0) {
    throw new InviteValidationError("email", "이메일을 입력해 주세요.");
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new InviteValidationError(
      "email",
      "이메일 형식이 올바르지 않습니다.",
    );
  }

  // role
  if (!input.role) {
    throw new InviteValidationError("role", "역할을 선택해 주세요.");
  }
  if (!VALID_ROLES.has(input.role)) {
    throw new InviteValidationError(
      "role",
      "지원하지 않는 역할입니다.",
    );
  }

  // name
  let name: string | null = null;
  if (typeof input.name === "string") {
    const trimmed = input.name.trim();
    name = trimmed.length > 0 ? trimmed : null;
  }

  return {
    email,
    name,
    role: input.role,
  };
}

export function buildInviteLink(email: string, baseUrl: string): string {
  // baseUrl trailing slash 정규화
  const normalized = baseUrl.replace(/\/+$/, "");
  return `${normalized}/auth/signin?email=${encodeURIComponent(email)}`;
}
