/**
 * §11.209d Phase 1 #internal-approval-status-resolver — RED test
 *
 * PurchaseConversionItem.internalApprovalStatus field + resolver derive
 * logic. Option B (정상화) — PurchaseRequest.status 기반 4 값.
 *
 * canonical truth:
 *   - PurchaseRequest (schema.prisma:1671) — canonical entity
 *   - PurchaseRequestStatus enum: PENDING / APPROVED / REJECTED / CANCELLED
 *   - resolver 가 latest PurchaseRequest 의 status → InternalApprovalStatus
 *     매핑
 *
 * Mapping:
 *   - PurchaseRequest 0 개 → "NOT_REQUIRED"
 *   - latest === "APPROVED" → "APPROVED"
 *   - latest === "REJECTED" → "REJECTED"
 *   - latest === "CANCELLED" → "NOT_REQUIRED" (re-set 가능)
 *   - 그 외 (PENDING / unknown) → "PENDING"
 */

import { describe, it, expect } from "vitest";
import {
  resolvePurchaseConversion,
  type PurchaseConversionInput,
  type PurchaseRequestInput,
} from "@/lib/ontology/purchase-conversion-resolver";

const baseQuoteInput: PurchaseConversionInput["quote"] = {
  id: "q-1",
  title: "테스트 견적",
  description: null,
  status: "RESPONDED",
  totalAmount: 100000,
  currency: "KRW",
  quoteNumber: "Q-20260504-0001",
  validUntil: new Date("2026-06-04"),
  createdAt: new Date("2026-05-01"),
  selectedReplyId: null,
};

function buildInput(
  purchaseRequests: readonly PurchaseRequestInput[],
): PurchaseConversionInput {
  return {
    quote: baseQuoteInput,
    vendors: [],
    vendorRequests: [],
    replies: [],
    order: null,
    aiActions: [],
    purchaseRequests,
    now: new Date("2026-05-04"),
  };
}

function buildPR(
  partial: Partial<PurchaseRequestInput>,
): PurchaseRequestInput {
  return {
    id: "pr-default",
    status: "PENDING",
    approverId: null,
    approvedAt: null,
    rejectedAt: null,
    createdAt: new Date("2026-05-01"),
    ...partial,
  };
}

describe("§11.209d Phase 1 — internalApprovalStatus derive", () => {
  it("PurchaseRequest 0 개 → 'NOT_REQUIRED'", () => {
    const result = resolvePurchaseConversion(buildInput([]));
    expect(result.internalApprovalStatus).toBe("NOT_REQUIRED");
  });

  it("latest PurchaseRequest.status === 'PENDING' → 'PENDING'", () => {
    const result = resolvePurchaseConversion(
      buildInput([buildPR({ status: "PENDING" })]),
    );
    expect(result.internalApprovalStatus).toBe("PENDING");
  });

  it("latest PurchaseRequest.status === 'APPROVED' → 'APPROVED'", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-1",
          status: "APPROVED",
          approvedAt: new Date("2026-05-03"),
        }),
      ]),
    );
    expect(result.internalApprovalStatus).toBe("APPROVED");
  });

  it("latest PurchaseRequest.status === 'REJECTED' → 'REJECTED'", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-1",
          status: "REJECTED",
          rejectedAt: new Date("2026-05-03"),
        }),
      ]),
    );
    expect(result.internalApprovalStatus).toBe("REJECTED");
  });

  it("latest PurchaseRequest.status === 'CANCELLED' → 'NOT_REQUIRED' (re-set 가능)", () => {
    const result = resolvePurchaseConversion(
      buildInput([buildPR({ status: "CANCELLED" })]),
    );
    expect(result.internalApprovalStatus).toBe("NOT_REQUIRED");
  });

  it("multiple PurchaseRequests — latest by createdAt 채택", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-old",
          status: "REJECTED",
          rejectedAt: new Date("2026-05-01"),
          createdAt: new Date("2026-05-01"),
        }),
        buildPR({
          id: "pr-new",
          status: "APPROVED",
          approvedAt: new Date("2026-05-03"),
          createdAt: new Date("2026-05-03"),
        }),
      ]),
    );
    // latest (newer createdAt) = APPROVED
    expect(result.internalApprovalStatus).toBe("APPROVED");
  });

  it("unknown status (defensive) → 'PENDING' fallback", () => {
    const result = resolvePurchaseConversion(
      buildInput([buildPR({ status: "UNKNOWN_STATE" })]),
    );
    expect(result.internalApprovalStatus).toBe("PENDING");
  });
});

describe("§11.209d Phase 1 — type 정합", () => {
  it("InternalApprovalStatus type 4 값 (NOT_REQUIRED / PENDING / APPROVED / REJECTED)", () => {
    // type-level 검증 — PurchaseConversionItem.internalApprovalStatus 의
    // type 이 4 값 union 인지 (compile-time)
    const result = resolvePurchaseConversion(buildInput([]));
    const validValues = ["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"];
    expect(validValues).toContain(result.internalApprovalStatus);
  });
});
