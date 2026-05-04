/**
 * §11.209d-contact #approver-contact-info — RED test
 *
 * resolver 의 deriveApprovalHistory 가 approverEmail / approverPhone
 * 도 반환. PurchaseConversionItem 에 두 field 추가.
 *
 * canonical truth: User.email (required) + User.phone (optional, §11.69).
 */

import { describe, it, expect } from "vitest";
import {
  resolvePurchaseConversion,
  type PurchaseConversionInput,
  type PurchaseRequestInput,
} from "@/lib/ontology/purchase-conversion-resolver";

const baseQuoteInput: PurchaseConversionInput["quote"] = {
  id: "q-1",
  title: "테스트",
  description: null,
  status: "RESPONDED",
  totalAmount: 100000,
  currency: "KRW",
  quoteNumber: "Q-1",
  validUntil: null,
  createdAt: new Date("2026-05-01"),
  selectedReplyId: null,
};

function buildInput(prs: readonly PurchaseRequestInput[]): PurchaseConversionInput {
  return {
    quote: baseQuoteInput,
    vendors: [],
    vendorRequests: [],
    replies: [],
    order: null,
    aiActions: [],
    purchaseRequests: prs,
    now: new Date("2026-05-04"),
  };
}

function buildPR(partial: Partial<PurchaseRequestInput>): PurchaseRequestInput {
  return {
    id: "pr-default",
    status: "PENDING",
    approverId: null,
    approverName: null,
    approverEmail: null,
    approverPhone: null,
    approvedAt: null,
    rejectedAt: null,
    rejectedReason: null,
    createdAt: new Date("2026-05-01"),
    ...partial,
  };
}

describe("§11.209d-contact — approverEmail / approverPhone derive", () => {
  it("PR 0 개 → email/phone 모두 null", () => {
    const result = resolvePurchaseConversion(buildInput([]));
    expect(result.approverEmail).toBeNull();
    expect(result.approverPhone).toBeNull();
  });

  it("PENDING PR 에 email + phone → 그대로 노출", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-1",
          status: "PENDING",
          approverName: "김관리",
          approverEmail: "admin@labaxis.com",
          approverPhone: "010-1234-5678",
        }),
      ]),
    );
    expect(result.approverEmail).toBe("admin@labaxis.com");
    expect(result.approverPhone).toBe("010-1234-5678");
  });

  it("APPROVED PR 에 email 있고 phone null → email 만 노출, phone null", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-1",
          status: "APPROVED",
          approverName: "이결재",
          approverEmail: "approver@labaxis.com",
          approverPhone: null,
          approvedAt: new Date("2026-05-03"),
        }),
      ]),
    );
    expect(result.approverEmail).toBe("approver@labaxis.com");
    expect(result.approverPhone).toBeNull();
  });

  it("CANCELLED PR → email/phone null (re-set 가능 정합)", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          status: "CANCELLED",
          approverEmail: "cancelled@labaxis.com",
          approverPhone: "010-0000-0000",
        }),
      ]),
    );
    expect(result.approverEmail).toBeNull();
    expect(result.approverPhone).toBeNull();
  });

  it("multiple PR — latest non-CANCELLED 의 email/phone 채택", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-old",
          status: "REJECTED",
          approverName: "박반려",
          approverEmail: "old@labaxis.com",
          approverPhone: "010-1111-1111",
          rejectedAt: new Date("2026-05-01"),
          createdAt: new Date("2026-05-01"),
        }),
        buildPR({
          id: "pr-new",
          status: "PENDING",
          approverName: "김관리",
          approverEmail: "new@labaxis.com",
          approverPhone: "010-2222-2222",
          createdAt: new Date("2026-05-03"),
        }),
      ]),
    );
    expect(result.approverEmail).toBe("new@labaxis.com");
    expect(result.approverPhone).toBe("010-2222-2222");
  });
});
