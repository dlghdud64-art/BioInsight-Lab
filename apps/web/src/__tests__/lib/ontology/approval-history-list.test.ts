/**
 * §11.209d-history-expand #approval-history-list — RED test
 *
 * resolver 의 deriveApprovalHistory 가 latest 외에 전체 chronological
 * history list 도 반환. PurchaseConversionItem 에 approvalHistoryEntries
 * field 추가.
 *
 * canonical: PurchaseRequest 전체 (CANCELLED 포함, 시간순 sort).
 * UI 가 "더 보기" / "expand" 시 latest 외 entries 표시.
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

describe("§11.209d-history-expand — approvalHistoryEntries derive", () => {
  it("PR 0 개 → approvalHistoryEntries = []", () => {
    const result = resolvePurchaseConversion(buildInput([]));
    expect(result.approvalHistoryEntries).toEqual([]);
  });

  it("PR 1 개 (PENDING) → entries 1 개 (latest 와 동일)", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-1",
          status: "PENDING",
          approverName: "김관리",
          createdAt: new Date("2026-05-02"),
        }),
      ]),
    );
    expect(result.approvalHistoryEntries).toHaveLength(1);
    expect(result.approvalHistoryEntries[0]?.id).toBe("pr-1");
    expect(result.approvalHistoryEntries[0]?.status).toBe("PENDING");
  });

  it("multiple PR → chronological list (newest first)", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-old",
          status: "REJECTED",
          rejectedAt: new Date("2026-05-01"),
          rejectedReason: "초기 반려",
          createdAt: new Date("2026-05-01"),
        }),
        buildPR({
          id: "pr-mid",
          status: "CANCELLED",
          createdAt: new Date("2026-05-02"),
        }),
        buildPR({
          id: "pr-new",
          status: "PENDING",
          approverName: "김관리",
          createdAt: new Date("2026-05-03"),
        }),
      ]),
    );
    expect(result.approvalHistoryEntries).toHaveLength(3);
    // newest first
    expect(result.approvalHistoryEntries[0]?.id).toBe("pr-new");
    expect(result.approvalHistoryEntries[1]?.id).toBe("pr-mid");
    expect(result.approvalHistoryEntries[2]?.id).toBe("pr-old");
  });

  it("entries 의 각 entry 가 status / requestedAt / approverName / decidedAt / rejectionReason 보유", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-1",
          status: "REJECTED",
          approverName: "박반려",
          rejectedAt: new Date("2026-05-03"),
          rejectedReason: "예산 초과",
          createdAt: new Date("2026-05-02"),
        }),
      ]),
    );
    const entry = result.approvalHistoryEntries[0];
    expect(entry).toBeDefined();
    expect(entry?.id).toBe("pr-1");
    expect(entry?.status).toBe("REJECTED");
    expect(entry?.requestedAt).toEqual(new Date("2026-05-02"));
    expect(entry?.approverName).toBe("박반려");
    expect(entry?.decidedAt).toEqual(new Date("2026-05-03"));
    expect(entry?.rejectionReason).toBe("예산 초과");
  });

  it("entries 의 CANCELLED entry — decidedAt = null + rejectionReason = null", () => {
    const result = resolvePurchaseConversion(
      buildInput([
        buildPR({
          id: "pr-1",
          status: "CANCELLED",
          createdAt: new Date("2026-05-02"),
        }),
      ]),
    );
    const entry = result.approvalHistoryEntries[0];
    expect(entry?.status).toBe("CANCELLED");
    expect(entry?.decidedAt).toBeNull();
    expect(entry?.rejectionReason).toBeNull();
  });
});
