/**
 * §11.290 Phase 3 #ocr-claude-structurer — Claude API 로 Cloud Vision OCR
 *   text → LabelParseResult JSON 구조화 (Tier 2 fallback provider 후반부).
 *
 * 호영님 P1 spec (2026-05-23) Phase 0 결정:
 *   3-tier fallback Tier 2 의 구조화 단계. Cloud Vision OCR raw text →
 *   Claude API → LabelParseResult shape JSON.
 *
 * Lock:
 *   - lib/ai/anthropic.ts provider-agnostic wrapper 재활용
 *     (LABAXIS_AI_PROVIDER=anthropic, ANTHROPIC_DEFAULT_MODEL=claude-haiku-4-5)
 *   - env: ANTHROPIC_API_KEY (Phase 5 호영님 dashboard 작업)
 *   - Wrapper 미설정 / env 미설정 시 ClaudeStructurerNotConfiguredError throw
 *
 * Implementation 본 batch:
 *   - 함수 시그니처 + lazy import 패턴 + error class
 *   - 실제 Claude API 호출 wiring 은 Phase 5 (Vercel env 설정 후) 별도 mini-batch
 *   - lib/ai/anthropic.ts wrapper 의 `callAnthropic({ system, user })` 패턴 활용
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
 * Cloud Vision raw text → Claude API → LabelParseResult.
 *
 * lib/ai/anthropic.ts wrapper 의 callAnthropic 패턴 활용 (provider-agnostic
 * fallback for Anthropic → OpenAI swap).
 *
 * Phase 5 실제 wiring placeholder.
 */
export async function structureWithClaude(
  _input: ClaudeStructureInput,
): Promise<ClaudeStructureResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ClaudeStructurerNotConfiguredError(
      "ANTHROPIC_API_KEY 환경변수 미설정. Phase 5 호영님 Vercel dashboard 작업 후 활성.",
    );
  }

  // Phase 5 실제 wiring placeholder
  // const { callAnthropic } = await import("@/lib/ai/anthropic");
  // const response = await callAnthropic({
  //   system: STRUCTURE_PROMPT,
  //   user: `OCR raw text:\n${_input.rawText}`,
  // });
  // const parsed = JSON.parse(response.content);
  // ...
  throw new ClaudeStructurerNotConfiguredError(
    "Claude structurer wiring not implemented (Phase 5 별도 batch).",
  );
}

// Re-export prompt for caller verification (also future audit)
export { STRUCTURE_PROMPT };
