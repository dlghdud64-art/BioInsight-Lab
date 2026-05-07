/**
 * #quote-payload-zod-schema — /api/quotes POST payload validation
 *
 * §11.203 silent assumption (route 가 createQuote 의 snapshot path 를 알고
 * 있다고 가정했지만 itemsDetailed forward 안 했음) 의 root cause 가 payload
 * validation 부재. zod schema 도입 = 미래 P0 재발 차단 + caller drift 즉시
 * catch.
 *
 * canonical truth:
 *   - createQuote 의 snapshot path (itemsDetailed) 와 legacy path
 *     (productIds + quantities) 둘 다 보존 (호환성).
 *   - QuoteListItem.productId 는 nullable (snapshot 안전).
 *   - validation fail → /api/quotes route 가 structured 400 (운영자 친화
 *     한국어 메시지) 반환. raw stack trace 노출 0.
 */

import { z } from "zod";

/**
 * 단일 quote item — search → 비교 → wizard step 2 에서 추가된 품목.
 *
 * snapshot fields (productId 가 catalog ref 가 아닌 search-backed 이거나
 * vendor 가 새로 보낸 품목인 경우) 와 canonical productId 모두 허용.
 */
// §11.216 — wizard (request-wizard-modal.tsx) 가 user 미입력 string field
// 를 `null` 로 보냄 (catalogNumber, specification 등). zod `.optional()`
// 만으로는 `string | undefined` 만 허용 → null reject → QUOTE_SUBMIT_
// VALIDATION_FAILED. 모든 string optional field 를 `.nullish()` 로 swap
// (= `.nullable().optional()`, `null | undefined | string` 모두 valid).
// caller diversity 정합 (wizard / batch import / mobile / 기타 future
// caller) — schema 가 canonical contract.
export const quoteItemPayloadSchema = z.object({
  productId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  quantity: z.number().int().positive().optional().default(1),
  notes: z.string().nullish(),
  // ── snapshot fields (createQuote 의 itemsDetailed path) ──
  name: z.string().nullish(),
  productName: z.string().nullish(),
  vendorName: z.string().nullish(),
  brand: z.string().nullish(),
  catalogNumber: z.string().nullish(),
  specification: z.string().nullish(),
  lineNumber: z.number().int().nullish(),
  unitPrice: z.number().nullish(),
  currency: z.string().nullish(),
  lineTotal: z.number().nullish(),
  allowSubstitute: z.boolean().nullish(),
});

export type QuoteItemPayload = z.infer<typeof quoteItemPayloadSchema>;

/**
 * /api/quotes POST body — wizard 또는 legacy caller 모두 통과.
 *
 * - 새로운 형식: `items` array (snapshot path 통과 가능)
 * - 기존 형식 (하위 호환성): `productIds + quantities + notes` (legacy path)
 *
 * refine: 둘 중 하나는 최소 1 항목 필요. 빈 payload → "견적 요청에 최소
 * 1개 이상의 품목이 필요합니다." 운영자 친화 메시지.
 */
export const quoteCreatePayloadSchema = z
  .object({
    title: z.string().optional(),
    message: z.string().optional(),
    /** 벤더별 개별 메시지: { [vendorId]: string } */
    vendorMessages: z.record(z.string(), z.string()).optional(),
    deliveryDate: z.string().optional(),
    deliveryLocation: z.string().optional(),
    specialNotes: z.string().optional(),
    // 새 형식
    items: z.array(quoteItemPayloadSchema).optional(),
    // 기존 형식 (하위 호환성)
    productIds: z.array(z.string()).optional(),
    /** legacy: { [productId]: quantity } 또는 array 모두 허용 */
    quantities: z
      .union([z.record(z.string(), z.number()), z.array(z.number())])
      .optional(),
    /** legacy: { [productId]: note } 또는 array 모두 허용 */
    notes: z
      .union([z.record(z.string(), z.string()), z.array(z.string())])
      .optional(),
    organizationId: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      const itemsCount =
        (data.items?.length ?? 0) + (data.productIds?.length ?? 0);
      return itemsCount > 0;
    },
    {
      message: "견적 요청에 최소 1개 이상의 품목이 필요합니다.",
      path: ["items"],
    },
  );

export type QuoteCreatePayload = z.infer<typeof quoteCreatePayloadSchema>;

/**
 * Validation error → 운영자 친화 한국어 메시지 매핑.
 *
 * zod ZodError 의 issues 를 운영자가 이해할 수 있는 한 줄 메시지로 변환.
 * raw "Invalid input" / "Required" 영문 노출 0.
 */
export function formatQuoteValidationError(
  error: z.ZodError,
): { error: string; message: string; details: string[] } {
  const details = error.issues.map((issue) => {
    const path = issue.path.join(".");
    const baseMessage = issue.message;
    return path ? `${path}: ${baseMessage}` : baseMessage;
  });

  // 가장 첫 issue 의 message 를 운영자 친화 메시지로 노출
  const userMessage =
    error.issues[0]?.message ??
    "견적 요청 정보를 다시 확인해 주세요.";

  return {
    error: "QUOTE_SUBMIT_VALIDATION_FAILED",
    message: userMessage,
    details,
  };
}
