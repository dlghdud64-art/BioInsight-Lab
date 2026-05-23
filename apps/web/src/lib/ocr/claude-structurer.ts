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
