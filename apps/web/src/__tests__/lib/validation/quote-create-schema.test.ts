/**
 * #quote-payload-zod-schema — quote-create-schema unit test
 *
 * §11.203 silent assumption 후속 — payload validation 정합 검증.
 * - valid payload (snapshot path / legacy path / 둘 다) 통과
 * - invalid payload (빈 items / 잘못된 type) → ZodError 반환
 * - formatQuoteValidationError 가 운영자 친화 한국어 메시지 생성
 */

import { describe, it, expect } from "vitest";
import {
  quoteCreatePayloadSchema,
  quoteItemPayloadSchema,
  formatQuoteValidationError,
} from "@/lib/validation/quote-create-schema";

describe("#quote-payload-zod-schema — quoteItemPayloadSchema", () => {
  it("snapshot-only item (productId null + name) 통과", () => {
    const result = quoteItemPayloadSchema.safeParse({
      productId: null,
      name: "Anti-CD3 항체",
      catalogNumber: "ABC-123",
      quantity: 2,
    });
    expect(result.success).toBe(true);
  });

  it("canonical item (productId + quantity) 통과", () => {
    const result = quoteItemPayloadSchema.safeParse({
      productId: "prod-123",
      quantity: 5,
    });
    expect(result.success).toBe(true);
  });

  it("quantity 부재 시 default 1", () => {
    const result = quoteItemPayloadSchema.safeParse({ productId: "prod-1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.quantity).toBe(1);
  });

  it("quantity 음수 → fail", () => {
    const result = quoteItemPayloadSchema.safeParse({
      productId: "prod-1",
      quantity: -1,
    });
    expect(result.success).toBe(false);
  });

  it("snapshot fields 모두 optional", () => {
    const result = quoteItemPayloadSchema.safeParse({
      productId: "prod-1",
      productName: "X",
      vendorName: "Y",
      brand: "Z",
      catalogNumber: "C",
      specification: "S",
      lineNumber: 1,
      unitPrice: 1000,
      currency: "KRW",
      lineTotal: 2000,
      allowSubstitute: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("#quote-payload-zod-schema — quoteCreatePayloadSchema", () => {
  it("새 형식 (items array) — snapshot path 통과", () => {
    const result = quoteCreatePayloadSchema.safeParse({
      title: "테스트 견적",
      items: [
        { productId: null, name: "FBS", quantity: 1 },
        { productId: "prod-2", quantity: 3 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("기존 형식 (productIds + quantities) — legacy path 통과", () => {
    const result = quoteCreatePayloadSchema.safeParse({
      productIds: ["prod-1", "prod-2"],
      quantities: { "prod-1": 1, "prod-2": 5 },
      notes: { "prod-1": "긴급" },
    });
    expect(result.success).toBe(true);
  });

  it("빈 items + 빈 productIds → refine fail (운영자 친화 메시지)", () => {
    const result = quoteCreatePayloadSchema.safeParse({
      title: "빈 견적",
      items: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatQuoteValidationError(result.error);
      expect(formatted.message).toMatch(/최소 1개 이상의 품목/);
      expect(formatted.error).toBe("QUOTE_SUBMIT_VALIDATION_FAILED");
    }
  });

  it("items / productIds 모두 부재 → refine fail", () => {
    const result = quoteCreatePayloadSchema.safeParse({ title: "X" });
    expect(result.success).toBe(false);
  });

  it("vendorMessages record 통과", () => {
    const result = quoteCreatePayloadSchema.safeParse({
      productIds: ["prod-1"],
      vendorMessages: { "vendor-a": "특별 메시지" },
    });
    expect(result.success).toBe(true);
  });

  it("organizationId nullable + optional", () => {
    expect(
      quoteCreatePayloadSchema.safeParse({
        productIds: ["prod-1"],
        organizationId: null,
      }).success,
    ).toBe(true);
    expect(
      quoteCreatePayloadSchema.safeParse({
        productIds: ["prod-1"],
        organizationId: "org-1",
      }).success,
    ).toBe(true);
    expect(
      quoteCreatePayloadSchema.safeParse({ productIds: ["prod-1"] }).success,
    ).toBe(true);
  });
});

describe("#quote-payload-zod-schema — formatQuoteValidationError", () => {
  it("error code = QUOTE_SUBMIT_VALIDATION_FAILED (§11.203 호환)", () => {
    const result = quoteCreatePayloadSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatQuoteValidationError(result.error);
      expect(formatted.error).toBe("QUOTE_SUBMIT_VALIDATION_FAILED");
    }
  });

  it("운영자 친화 한국어 메시지 (raw 'Invalid input' 노출 0)", () => {
    const result = quoteCreatePayloadSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatQuoteValidationError(result.error);
      // 한국어 메시지 정합
      expect(formatted.message).not.toMatch(/Invalid|Required|expected/i);
    }
  });

  it("details array 가 path: message 형식", () => {
    // quantity 음수 (path = items.0.quantity) 검증
    const result = quoteCreatePayloadSchema.safeParse({
      items: [{ productId: "p1", quantity: -1 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatQuoteValidationError(result.error);
      expect(formatted.details.length).toBeGreaterThan(0);
      expect(formatted.details[0]).toMatch(/items\.0\.quantity:/);
    }
  });
});
