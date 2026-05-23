/**
 * §11.290 Phase 4a #ocr-run-quote-pipeline — Quote (거래명세서) OCR pipeline
 *   entry point. 기존 /api/quotes/parse-image + /api/quotes/parse-pdf 의
 *   parseQuoteWithGemini / parseQuotePDFWithGemini 직접 호출을 본 wrapper 로 swap.
 *
 * Logic (run-ocr-pipeline.ts 와 동일 패턴):
 *   (1) STORAGE_PROVIDER 미설정 → graceful fallback (audit / cache 미사용)
 *   (2) STORAGE_PROVIDER 설정 시 OcrJob/OcrResult DB write (Phase 5 wiring)
 *
 * Input variants:
 *   - { type: "image", base64 } → parseQuoteWithGemini
 *   - { type: "pdf", buffer } → parseQuotePDFWithGemini
 *
 * Phase 4a 본 batch:
 *   - Gemini 단일 호출 + QuoteParseResult 반환 (기존 호환)
 *   - audit / cache infrastructure 는 Phase 5 SDK install 후 별도 batch
 */

import type { QuoteParseResult } from "./gemini-quote-parser";
import {
  parseQuoteWithGemini,
  parseQuotePDFWithGemini,
} from "./gemini-quote-parser";

export type RunQuoteOcrPipelineInput =
  | {
      kind: "image";
      /** Image base64 data URI 또는 raw base64. */
      base64: string;
      organizationId: string;
      userId: string;
    }
  | {
      kind: "pdf";
      /** PDF binary Buffer. */
      buffer: Buffer;
      organizationId: string;
      userId: string;
    };

export interface RunQuoteOcrPipelineResult {
  /** 호환 shape — 기존 caller 가 parseQuoteWithGemini 결과로 사용. */
  result: QuoteParseResult;
  /** OcrJob.id — STORAGE_PROVIDER 미설정 시 null. */
  jobId: string | null;
  /** OcrJobStatus. */
  status: "SUCCESS" | "NEEDS_REVIEW" | "FAILED";
  /** 채택된 provider. */
  providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
  /** Cache hit 여부. */
  cached: boolean;
}

/**
 * 견적서 / 거래명세서 OCR pipeline entry point.
 *
 * 기존 parseQuoteWithGemini / parseQuotePDFWithGemini 직접 호출을 본 wrapper
 * 로 swap. STORAGE_PROVIDER 미설정 시 graceful fallback (기존 동작 보존).
 */
export async function runQuoteOcrPipeline(
  input: RunQuoteOcrPipelineInput,
): Promise<RunQuoteOcrPipelineResult> {
  // (1) Tier 1 — Gemini 호출 (image 또는 pdf)
  let result: QuoteParseResult;
  if (input.kind === "image") {
    result = await parseQuoteWithGemini(input.base64);
  } else {
    result = await parseQuotePDFWithGemini(input.buffer);
  }

  // confidence enum (high/medium/low) → status mapping
  const status: RunQuoteOcrPipelineResult["status"] =
    result.confidence === "high" || result.confidence === "medium"
      ? "SUCCESS"
      : "NEEDS_REVIEW";

  // (2) STORAGE_PROVIDER 미설정 → graceful fallback
  if (!process.env.STORAGE_PROVIDER) {
    return {
      result,
      jobId: null,
      status,
      providerUsed: "GEMINI",
      cached: false,
    };
  }

  // (3) STORAGE_PROVIDER 설정 → Phase 5 SDK wiring 후 OcrJob/OcrResult DB write
  // 본 batch 는 fallback 만 (audit infrastructure 는 Phase 5 별도 batch)
  return {
    result,
    jobId: null,
    status,
    providerUsed: "GEMINI",
    cached: false,
  };
}
