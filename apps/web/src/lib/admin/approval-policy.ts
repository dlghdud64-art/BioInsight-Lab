/**
 * §11.115 #admin-user-approval-policy-set-surface
 *
 * Admin write 의 input normalization helper.
 *
 * 책임 (canonical):
 *   - approvalLimit: null/undefined/empty → null. integer >= 0 → BigInt.
 *     음수 / 비정수 / non-numeric → throw ApprovalPolicyValidationError.
 *     콤마 포함 (`100,000,000`) 허용 — 운영자 입력 친화.
 *   - costCenter: null/undefined/empty/whitespace-only → null. trim.
 *   - defaultLocation: null/undefined/empty/whitespace-only → null. trim.
 *
 * Pure function — DB 접근 / Prisma 의존 0. unit testable.
 *
 * §11.97 schema (`User.approvalLimit BigInt?`, `User.costCenter String?`,
 * `User.defaultLocation String?`) 의 admin-side write 분기 — settings 페이지의
 * read display 와 cross-surface canonical truth 보장.
 */

export class ApprovalPolicyValidationError extends Error {
  field: "approvalLimit" | "costCenter" | "defaultLocation";
  reason: string;

  constructor(
    field: "approvalLimit" | "costCenter" | "defaultLocation",
    reason: string,
  ) {
    super(`Invalid ${field}: ${reason}`);
    this.name = "ApprovalPolicyValidationError";
    this.field = field;
    this.reason = reason;
  }
}

export interface ApprovalPolicyInput {
  approvalLimit?: string | number | null;
  costCenter?: string | null;
  defaultLocation?: string | null;
}

export interface ApprovalPolicyNormalized {
  approvalLimit: bigint | null;
  costCenter: string | null;
  defaultLocation: string | null;
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

function normalizeApprovalLimit(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;

  // string input — empty/whitespace 는 null
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (cleaned.length === 0) return null;
    if (!/^-?\d+$/.test(cleaned)) {
      throw new ApprovalPolicyValidationError(
        "approvalLimit",
        "정수만 입력 가능합니다 (콤마 허용).",
      );
    }
    const parsed = BigInt(cleaned);
    if (parsed < BigInt(0)) {
      throw new ApprovalPolicyValidationError(
        "approvalLimit",
        "0 이상의 값만 입력 가능합니다.",
      );
    }
    return parsed;
  }

  // number input
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ApprovalPolicyValidationError(
        "approvalLimit",
        "유한한 숫자만 입력 가능합니다.",
      );
    }
    if (!Number.isInteger(value)) {
      throw new ApprovalPolicyValidationError(
        "approvalLimit",
        "정수만 입력 가능합니다.",
      );
    }
    if (value < 0) {
      throw new ApprovalPolicyValidationError(
        "approvalLimit",
        "0 이상의 값만 입력 가능합니다.",
      );
    }
    return BigInt(value);
  }

  // bigint input — 직접 허용
  if (typeof value === "bigint") {
    if (value < BigInt(0)) {
      throw new ApprovalPolicyValidationError(
        "approvalLimit",
        "0 이상의 값만 입력 가능합니다.",
      );
    }
    return value;
  }

  throw new ApprovalPolicyValidationError(
    "approvalLimit",
    "지원하지 않는 입력 형식입니다.",
  );
}

export function normalizeApprovalPolicyInput(
  input: ApprovalPolicyInput,
): ApprovalPolicyNormalized {
  return {
    approvalLimit: normalizeApprovalLimit(input.approvalLimit),
    costCenter: normalizeText(input.costCenter),
    defaultLocation: normalizeText(input.defaultLocation),
  };
}
