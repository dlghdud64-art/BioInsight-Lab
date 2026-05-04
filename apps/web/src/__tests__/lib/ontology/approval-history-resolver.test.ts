/**
 * §11.209d-history Phase 1 #approval-history-resolver — RED test
 *
 * PurchaseConversionItem 에 latest PR 의 history fields 노출:
 *   - approvalRequestedAt (latest PR.createdAt)
 *   - approverName (latest PR.approver.name)
 *   - approvalDecidedAt (latest PR.approvedAt 또는 rejectedAt)
 *   - rejectionReason (latest PR.rejectedReason)
 *
 * canonical truth: PurchaseRequest (latest by createdAt).
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

function buildPR(partial: Partial<PurchaseRequestInput>): PurchaseRequestInput {
  return {
    id: "pr-default",
    status: "PENDING",
    approverId: null,
    approverName: null,
    approvedAt: null,
    rejectedAt: null,
    rejectedReason: null,
    createdAt: new Date("2026-05-01"),
    ...partial,
  };
}

describe("§11.209d-history Phase 1 — approval history fields", () => {
  it("PR 0 개 → 모든 history field null", () => {
    const result = resolvePurchaseConversion(buildInput([]));
    expect(result.approvalRequestedAt).toBeNull();
    expect(result.approverName).toBeNull();
    expect(result.approvalDecidedAt).toBeNull();
    expect(result.rejectionReason).toBeNull();
  });

  it("PENDING PR → approvalRequestedAt + approverName, decidedAt + reason null", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-1",
          status: "PENDING",
          approverId: "u-admin",
          approverName: "김관리",
          createdAt: new Date("2026-05-02"),
        }),
      ]),
    );
    expect(result.approvalRequestedAt).toEqual(new Date("2026-05-02"));
    expect(result.approverName).toBe("김관리");
    expect(result.approvalDecidedAt).toBeNull();
    expect(result.rejectionReason).toBeNull();
  });

  it("APPROVED PR → approvalDecidedAt = approvedAt, reason null", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-1",
          status: "APPROVED",
          approverId: "u-admin",
          approverName: "이결재",
          approvedAt: new Date("2026-05-03"),
          createdAt: new Date("2026-05-02"),
        }),
      ]),
    );
    expect(result.approvalRequestedAt).toEqual(new Date("2026-05-02"));
    expect(result.approverName).toBe("이결재");
    expect(result.approvalDecidedAt).toEqual(new Date("2026-05-03"));
    expect(result.rejectionReason).toBeNull();
  });

  it("REJECTED PR → approvalDecidedAt = rejectedAt + rejectionReason", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-1",
          status: "REJECTED",
          approverId: "u-admin",
          approverName: "박반려",
          rejectedAt: new Date("2026-05-03"),
          rejectedReason: "예산 초과",
          createdAt: new Date("2026-05-02"),
        }),
      ]),
    );
    expect(result.approvalDecidedAt).toEqual(new Date("2026-05-03"));
    expect(result.rejectionReason).toBe("예산 초과");
  });

  it("multiple PR — latest by createdAt 채택", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-old",
          status: "REJECTED",
          approverName: "박반려",
          rejectedAt: new Date("2026-05-01"),
          rejectedReason: "초기 반려",
          createdAt: new Date("2026-05-01"),
        }),
        buildPR({
          id: "pr-new",
          status: "PENDING",
          approverName: "김관리",
          createdAt: new Date("2026-05-03"),
        }),
      ]),
    );
    expect(result.approvalRequestedAt).toEqual(new Date("2026-05-03"));
    expect(result.approverName).toBe("김관리");
    expect(result.rejectionReason).toBeNull();
  });

  it("CANCELLED PR → history null (re-set 가능 정합 — internalApprovalStatus 와 동일 branch)", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          status: "CANCELLED",
          approverName: "취소관리",
          createdAt: new Date("2026-05-02"),
        }),
      ]),
    );
    expect(result.approvalRequestedAt).toBeNull();
    expect(result.approverName).toBeNull();
    expect(result.approvalDecidedAt).toBeNull();
    expect(result.rejectionReason).toBeNull();
  });
});
