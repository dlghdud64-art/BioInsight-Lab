/**
 * §11.216 quote item schema null payload — RED→GREEN test
 *
 * Production wizard (request-wizard-modal.tsx) 가 catalogNumber / specification
 * 미입력 시 `null` 보냄. zod `z.string().optional()` 는 `string | undefined`
 * 만 허용 — null reject → QUOTE_SUBMIT_VALIDATION_FAILED 발생.
 *
 * Fix: schema 의 모든 string optional field 를 `.nullish()` swap
 *      (= `.nullable().optional()`, `null | undefined | string` 모두 valid).
 *
 * Lock:
 *   - wizard 의 actual payload (`catalogNumber: null, specification: null`)
 *     가 zod parse 통과해야 함
 *   - 다른 string optional field (name, productName, vendorName, brand,
 *     notes, currency) 도 null 통과 — caller diversity 정합
 */

import { describe, it, expect } from "vitest";
import {
  quoteItemPayloadSchema,
  quoteCreatePayloadSchema,
} from "@/lib/validation/quote-create-schema";

describe("§11.216 quote item schema — null payload 통과 (wizard 정합)", () => {
  it("catalogNumber: null + specification: null 통과 (root cause)", () => {
    const result = quoteItemPayloadSchema.safeParse({
      productId: "product-pilot-pbs-1l",
      name: "PBS 1X 1L",
      catalogNumber: null,
      specification: null,
      quantity: 1,
      allowSubstitute: false,
    });
    expect(result.success).toBe(true);
  });

  it("name: null + productName: null + vendorName: null + brand: null 통과", () => {
    const result = quoteItemPayloadSchema.safeParse({
      productId: "p-1",
      name: null,
      productName: null,
      vendorName: null,
      brand: null,
    });
    expect(result.success).toBe(true);
  });

  it("notes: null + currency: null 통과", () => {
    const result = quoteItemPayloadSchema.safeParse({
      productId: "p-1",
      notes: null,
      currency: null,
    });
    expect(result.success).toBe(true);
  });

  it("기존 string + undefined 도 그대로 통과 (backward compat)", () => {
    const result = quoteItemPayloadSchema.safeParse({
      productId: "p-1",
      name: "PBS",
      catalogNumber: "ABC-123",
    });
    expect(result.success).toBe(true);
  });

  it("wizard 전체 payload (실 production capture) 통과", () => {
    const result = quoteCreatePayloadSchema.safeParse({
      items: [
        {
          productId: "product-pilot-pbs-1l",
          name: "PBS 1X 1L",
          catalogNumber: null,
          specification: null,
          quantity: 1,
          allowSubstitute: false,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
