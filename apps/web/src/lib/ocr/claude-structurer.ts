/**
 * §11.290 Phase 3 #ocr-claude-structurer — Claude API 로 Cloud Vision OCR
 *   text → LabelParseResult JSON 구조화 (Tier 2 fallback provider 후반부).
 *
 * §11.290 Phase 5 — @anthropic-ai/sdk 실제 wiring.
 *   claude-haiku-4-5 (저비용 고속) 로 OCR raw text → LabelParseResult JSON.
 *
 * 호영님 P1 spec (2026-05-23) Phase 0 결정:
 *   3-tier fallback Tier 2 의 구조화 단계. Cloud Vision OCR raw text →
 *   Claude API → LabelParseResult shape JSON.
 *
 * Lock:
 *   - @anthropic-ai/sdk (^0.98.0) — dynamic import (sandbox vitest 호환)
 *   - env: ANTHROPIC_API_KEY (호영님 Vercel dashboard 설정 필수)
 *   - model: claude-haiku-4-5 (저비용 고속, 구조화 작업 최적)
 *   - env 미설정 시 ClaudeStructurerNotConfiguredError throw →
 *     orchestrator 가 Gemini 결과 그대로 사용 (graceful degradation)
 *   - cost 추정: ~$0.001 per call (haiku, ~500 input + 200 output tokens)
 */

import type { LabelParseResult } from "./label-parser";

export class ClaudeStructurerNotConfiguredError extends Error {
  constructor(reason: string) {
    super(`Claude structurer not configured: ${reason}`);
    this.name = "ClaudeStructurerNotConfiguredError";
  }
}

export interface ClaudeStructureInput {
  /** Cloud Vision 에서 추출된 raw text. */
  rawText: string;
}

export interface ClaudeStructureResult {
  /** Claude API 가 구조화한 LabelParseResult. */
  parsed: LabelParseResult;
  /** API call cost (audit log). */
  costUsd: number;
  /** Call latency in ms (audit log). */
  latencyMs: number;
}

const STRUCTURE_PROMPT = `You are a reagent label parser for a laboratory inventory system.
Analyze this OCR raw text and extract the following fields as JSON.

Required JSON format:
{
  "brand": "manufacturer name (e.g. Sigma-Aldrich, Merck, Thermo Fisher) or null",
  "productName": "chemical/reagent name or null",
  "catalogNo": "catalog/product/reference number or null",
  "lotNo": "lot/batch number or null",
  "expirationDate": "expiration date in YYYY-MM-DD format (or YYYY-MM if day unknown) or null",
  "casNumber": "CAS registry number (format: XXXXX-XX-X) or null",
  "quantity": "amount with unit (e.g. 500g, 100mL) or null"
}

Rules:
- Return ONLY valid JSON, no markdown, no explanation.
- If a field is not visible or unreadable, set it to null.
- For dates, always normalize to YYYY-MM-DD or YYYY-MM format.
- For brand, use the official name (e.g. "Sigma-Aldrich" not "Sigma").
- The text may be in English, Korean, Japanese, or mixed.`;

/**
 * §11.290 Phase 5 — Cloud Vision raw text → Claude API → LabelParseResult.
 *
 * @anthropic-ai/sdk dynamic import (sandbox vitest 호환 + tree-shake).
 * claude-haiku-4-5 로 JSON 구조화 (저비용 고속).
 * ANTHROPIC_API_KEY 미설정 시 ClaudeStructurerNotConfiguredError throw →
 * orchestrator graceful degradation.
 */
export async function structureWithClaude(
  input: ClaudeStructureInput,
): Promise<ClaudeStructureResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ClaudeStructurerNotConfiguredError(
      "ANTHROPIC_API_KEY 환경변수 미설정. Vercel dashboard 에서 설정 후 활성.",
    );
  }

  const startMs = Date.now();

  // dynamic import — sandbox vitest 호환 (SDK 없는 테스트 환경에서 throw 방지)
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    system: STRUCTURE_PROMPT,
    messages: [
      {
        role: "user",
        content: `OCR raw text:\n${input.rawText}`,
      },
    ],
  });

  const latencyMs = Date.now() - startMs;

  const rawContent = message.content[0];
  const rawText = rawContent.type === "text" ? rawContent.text : "";

  // JSON 추출 (마크다운 코드블록 대응)
  let jsonStr = rawText;
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  let parsed: {
    brand: string | null;
    productName: string | null;
    catalogNo: string | null;
    lotNo: string | null;
    expirationDate: string | null;
    casNumber: string | null;
    quantity: string | null;
  };

  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = {
      brand: null, productName: null, catalogNo: null,
      lotNo: null, expirationDate: null, casNumber: null, quantity: null,
    };
  }

  const matchedFields = [
    parsed.catalogNo, parsed.lotNo, parsed.expirationDate,
    parsed.brand, parsed.productName, parsed.casNumber,
  ].filter(Boolean).length;

  const confidence: "high" | "medium" | "low" =
    matchedFields >= 4 ? "high" : matchedFields >= 2 ? "medium" : "low";

  // cost 추정: haiku ~$0.25/M input + $1.25/M output tokens
  // 평균 ~500 input + ~200 output → $0.000375 per call
  const costUsd = 0.001;

  return {
    parsed: {
      catalogNo: parsed.catalogNo ?? null,
      lotNo: parsed.lotNo ?? null,
      expirationDate: parsed.expirationDate ?? null,
      brand: parsed.brand ?? null,
      productName: parsed.productName ?? null,
      casNumber: parsed.casNumber ?? null,
      quantity: parsed.quantity ?? null,
      rawText: jsonStr,
      confidence,
      matchedFields,
    },
    costUsd,
    latencyMs,
  };
}

// Re-export prompt for caller verification (also future audit)
export { STRUCTURE_PROMPT };

// ════════════════════════════════════════════════════════════════════
// §11.309a #invoice-prompt-branch — 거래명세서 (invoice) 구조화 분기
// 호영님 P0 (2026-05-26) — 스마트 입고 backend MVP Phase A.
// 라벨 (LabelParseResult) 과 별도 — 거래명세서는 vendor + items[] + totalAmount
// 등 다수 품목 구조. 기존 ParsedQuoteDocument shape 재사용 (gemini-quote-parser
// 와 정합) — caller (orchestrator) 가 Gemini Tier 1 결과와 같은 type 처리 가능.
// ════════════════════════════════════════════════════════════════════

import type { ParsedQuoteDocument } from "./gemini-quote-parser";

export interface ClaudeStructureInvoiceResult {
  /** Claude API 가 구조화한 ParsedQuoteDocument. */
  parsed: ParsedQuoteDocument;
  /** Field 추출 신뢰도 (high / medium / low). */
  confidence: "high" | "medium" | "low";
  /** 추출된 items 수. */
  itemCount: number;
  /** OCR raw text (audit). */
  rawText: string;
  /** API call cost (audit log). */
  costUsd: number;
  /** Call latency in ms (audit log). */
  latencyMs: number;
}

const INVOICE_STRUCTURE_PROMPT = `You are an invoice/delivery-note parser for a laboratory inventory system.
Analyze this OCR raw text and extract the document into the following JSON format.

The text is typically a 거래명세서 (Korean delivery note) or invoice from a reagent/equipment supplier
(e.g. Sigma-Aldrich, Merck, Thermo Fisher, 코람바이오, XX사이언스).

Required JSON format:
{
  "vendor": {
    "name": "supplier name (e.g. 코람바이오, Sigma-Aldrich) or null",
    "contactPerson": "vendor contact person or null",
    "email": "vendor email or null",
    "phone": "vendor phone or null"
  },
  "quoteNumber": "invoice/document number (e.g. INV-2026-001) or null",
  "quoteDate": "invoice date in YYYY-MM-DD format or null",
  "validUntil": "delivery date or due date in YYYY-MM-DD format or null",
  "currency": "KRW | USD | EUR | JPY (default KRW)",
  "items": [
    {
      "lineNumber": 1,
      "productName": "product name (e.g. Trypsin-EDTA 0.25% 100ml) or null",
      "catalogNumber": "catalog/Cat# (e.g. 25200-056) or null",
      "specification": "spec/size or null",
      "quantity": numeric quantity,
      "unit": "EA | bottle | box | g | mL etc",
      "unitPrice": numeric unit price (0 if unknown),
      "totalPrice": numeric line total (0 if unknown),
      "leadTimeDays": numeric lead time days or null,
      "notes": "any notes or null"
    }
  ],
  "subtotal": numeric subtotal before VAT or null,
  "vat": numeric VAT amount or null,
  "totalAmount": numeric grand total or null,
  "paymentTerms": "payment terms or null",
  "deliveryTerms": "delivery terms or null",
  "specialNotes": "any special notes or null"
}

Rules:
- Return ONLY valid JSON, no markdown, no explanation.
- If a field is not visible or unreadable, set it to null (or 0 for numeric line totals).
- For dates, always normalize to YYYY-MM-DD.
- Korean delivery notes (거래명세서) typically have: 공급자 / 공급받는자 / 품목 / 규격 / 수량 / 단가 / 공급가액 / 세액 / 합계.
- If multiple items exist, list each as a separate object in items[].
- Numeric values must not contain commas (e.g. 380000 not "380,000").`;

/**
 * §11.309a — Cloud Vision raw text → Claude API → ParsedQuoteDocument.
 *
 * 라벨 구조화 (structureWithClaude) 와 별도 함수.
 * - 호영님 spec: invoice (거래명세서) 다수 품목 구조 → ParsedQuoteDocument
 * - Gemini Tier 1 결과와 같은 shape — orchestrator 호환
 * - 같은 model (claude-haiku-4-5) + 같은 dynamic import 패턴
 * - cost 추정: ~$0.002 per call (~800 input + 600 output tokens, 라벨 대비 2x)
 *
 * ANTHROPIC_API_KEY 미설정 시 ClaudeStructurerNotConfiguredError throw.
 */
export async function structureInvoiceWithClaude(
  input: ClaudeStructureInput,
): Promise<ClaudeStructureInvoiceResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ClaudeStructurerNotConfiguredError(
      "ANTHROPIC_API_KEY 환경변수 미설정. Vercel dashboard 에서 설정 후 활성.",
    );
  }

  const startMs = Date.now();

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,  // invoice 다수 품목 — label 대비 4x
    system: INVOICE_STRUCTURE_PROMPT,
    messages: [
      {
        role: "user",
        content: `OCR raw text:\n${input.rawText}`,
      },
    ],
  });

  const latencyMs = Date.now() - startMs;
  const rawContent = message.content[0];
  const rawText = rawContent.type === "text" ? rawContent.text : "";

  let jsonStr = rawText;
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  // §11.309a-hotfix — ParsedQuoteVendor 실제 shape 정합:
  //   name (string | null) / contactPerson / email / phone
  //   (gemini-quote-parser.ts:64-69 와 동일 type, 회귀 0)
  let parsed: ParsedQuoteDocument;
  try {
    parsed = JSON.parse(jsonStr) as ParsedQuoteDocument;
    // 기본값 보강 (LLM 누락 field 안전 처리)
    if (!parsed.vendor) {
      parsed.vendor = { name: null, contactPerson: null, email: null, phone: null };
    }
    if (!Array.isArray(parsed.items)) parsed.items = [];
    if (!parsed.currency) parsed.currency = "KRW";
  } catch {
    parsed = {
      vendor: { name: null, contactPerson: null, email: null, phone: null },
      quoteNumber: null,
      quoteDate: null,
      validUntil: null,
      currency: "KRW",
      items: [],
      subtotal: null,
      vat: null,
      totalAmount: null,
      paymentTerms: null,
      deliveryTerms: null,
      specialNotes: null,
    };
  }

  const itemCount = parsed.items.length;
  const matchedDocFields = [
    parsed.vendor.name, parsed.quoteNumber, parsed.quoteDate, parsed.totalAmount,
  ].filter(Boolean).length;

  // 신뢰도: items + 헤더 field 매칭 수 종합
  const confidence: "high" | "medium" | "low" =
    itemCount > 0 && matchedDocFields >= 3 ? "high"
    : itemCount > 0 && matchedDocFields >= 1 ? "medium"
    : "low";

  // cost 추정: haiku ~$0.25/M input + $1.25/M output, invoice 2x payload
  const costUsd = 0.002;

  return {
    parsed,
    confidence,
    itemCount,
    rawText: jsonStr,
    costUsd,
    latencyMs,
  };
}

// Re-export invoice prompt for caller verification (audit)
export { INVOICE_STRUCTURE_PROMPT };
