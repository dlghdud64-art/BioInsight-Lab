/**
 * §11.290 Phase 4a #ocr-run-quote-pipeline — Quote (거래명세서) OCR pipeline
 *   entry point. 기존 /api/quotes/parse-image + /api/quotes/parse-pdf 의
 *   parseQuoteWithGemini / parseQuotePDFWithGemini 직접 호출을 본 wrapper 로 swap.
 *
 * §11.290 Phase 5.5 — Audit log + 48h TTL cache wiring (image path 한정).
 *   image case: getOcrImageHash → findCachedOcrJob → uploadOcrImage →
 *     OcrJob.create → Gemini → OcrResult.create → OcrJob.update.
 *   PDF case: graceful skip (audit log + cache 미사용) — PDF support 는
 *     Phase 5.5.b 백로그 (image-storage.ts 의 mime type 처리 확장 필요).
 *   image-storage upload 실패 시 graceful fallback (jobId: null, 기존 동작 보존).
 *
 * Logic:
 *   image path:
 *     (0) Cache lookup — same image hash + 48h TTL → 즉시 반환 (cached: true)
 *     (1) uploadOcrImage → OcrJob.create → Gemini → OcrResult.create
 *     (2) OcrJob.update (status SUCCESS/NEEDS_REVIEW + finalResultId)
 *   PDF path:
 *     (1) parseQuotePDFWithGemini → graceful return (jobId: null)
 *     (2) Phase 5.5.b 에서 PDF audit log 추가 예정
 *
 * Input variants:
 *   - { kind: "image", base64 } → parseQuoteWithGemini + audit log + cache
 *   - { kind: "pdf", buffer } → parseQuotePDFWithGemini + graceful skip
 *
 * 호환 contract:
 *   기존 caller 가 parseQuoteWithGemini / parseQuotePDFWithGemini 반환
 *   QuoteParseResult 그대로 사용 → wrapper output 의 `result` 가 동일 shape.
 */

import type { QuoteParseResult } from "./gemini-quote-parser";
import {
  parseQuoteWithGemini,
  parseQuotePDFWithGemini,
} from "./gemini-quote-parser";
import {
  getOcrImageHash,
  uploadOcrImage,
  findCachedOcrJob,
} from "./image-storage";

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
  /** OcrJob.id — STORAGE_PROVIDER 미설정 / PDF case 시 null. */
  jobId: string | null;
  /** OcrJobStatus. */
  status: "SUCCESS" | "NEEDS_REVIEW" | "FAILED";
  /** 채택된 provider. */
  providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
  /** Cache hit 여부. */
  cached: boolean;
}

// Gemini cost 추정 (별도 백로그 — token 기반 정확화 필요)
const GEMINI_COST_USD = 0.001;

/**
 * 견적서 / 거래명세서 OCR pipeline entry point.
 *
 * §11.290 Phase 5.5 — image path full audit log + cache wiring.
 * PDF path graceful skip (Phase 5.5.b 백로그).
 * 모든 실패 path 는 graceful fallback (production 중단 0).
 */
export async function runQuoteOcrPipeline(
  input: RunQuoteOcrPipelineInput,
): Promise<RunQuoteOcrPipelineResult> {
  // PDF case — graceful skip (audit log + cache 미사용, Phase 5.5.b 백로그)
  if (input.kind === "pdf") {
    const result = await parseQuotePDFWithGemini(input.buffer);
    const status: RunQuoteOcrPipelineResult["status"] =
      result.confidence === "high" || result.confidence === "medium"
        ? "SUCCESS"
        : "NEEDS_REVIEW";
    return {
      result,
      jobId: null,
      status,
      providerUsed: "GEMINI",
      cached: false,
    };
  }

  // §11.290 Phase 5.5 — image path full wiring
  const imageHash = getOcrImageHash(input.base64);

  // (0) Cache lookup — same image + 48h TTL → 즉시 반환
  try {
    const cached = await findCachedOcrJob(imageHash, "QUOTE");
    if (cached && cached.finalResultId) {
      const { db } = await import("@/lib/db");
      const finalResult = await db.ocrResult.findUnique({
        where: { id: cached.finalResultId },
      });
      if (finalResult) {
        return {
          result: finalResult.parsedFields as unknown as QuoteParseResult,
          jobId: cached.id,
          status: cached.status as "SUCCESS" | "NEEDS_REVIEW" | "FAILED",
          providerUsed: finalResult.provider as
            | "GEMINI"
            | "CLOUD_VISION_CLAUDE"
            | "REGEX",
          cached: true,
        };
      }
    }
  } catch (cacheErr) {
    console.warn(
      "[OCR-quote] cache lookup skipped:",
      (cacheErr as Error).message,
    );
  }

  // (1) Image upload — graceful (STORAGE_PROVIDER 미설정 시 audit log skip)
  let uploadedUrl: string | null = null;
  let jobId: string | null = null;
  try {
    const uploadResult = await uploadOcrImage({
      base64: input.base64,
      organizationId: input.organizationId,
      type: "QUOTE",
    });
    uploadedUrl = uploadResult.url;
  } catch (uploadErr) {
    console.warn(
      "[OCR-quote] image upload skipped:",
      (uploadErr as Error).message,
    );
  }

  // OcrJob.create — upload 성공 시만 (audit log row)
  if (uploadedUrl) {
    try {
      const { db } = await import("@/lib/db");
      const job = await db.ocrJob.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          type: "QUOTE",
          imageUrl: uploadedUrl,
          imageHash,
          status: "RUNNING",
        },
      });
      jobId = job.id;
    } catch (dbErr) {
      console.warn(
        "[OCR-quote] OcrJob.create skipped:",
        (dbErr as Error).message,
      );
    }
  }

  // (2) Gemini 호출 (image, latency 측정)
  const tier1Start = Date.now();
  const result = await parseQuoteWithGemini(input.base64);
  const tier1LatencyMs = Date.now() - tier1Start;

  // confidence enum (high/medium/low) → status mapping
  const status: RunQuoteOcrPipelineResult["status"] =
    result.confidence === "high" || result.confidence === "medium"
      ? "SUCCESS"
      : "NEEDS_REVIEW";

  // OcrResult.create + OcrJob.update — jobId 있을 때만
  if (jobId) {
    try {
      const { db } = await import("@/lib/db");
      const ocrResult = await db.ocrResult.create({
        data: {
          jobId,
          provider: "GEMINI",
          parsedFields: result as unknown as object,
          confidence:
            result.confidence === "high"
              ? 0.9
              : result.confidence === "medium"
                ? 0.75
                : 0.5,
          rawText: result.rawText ?? null,
          costUsd: GEMINI_COST_USD,
          latencyMs: tier1LatencyMs,
        },
      });
      await db.ocrJob.update({
        where: { id: jobId },
        data: { status, finalResultId: ocrResult.id },
      });
    } catch (dbErr) {
      console.warn(
        "[OCR-quote] OcrResult.create skipped:",
        (dbErr as Error).message,
      );
    }
  }

  return {
    result,
    jobId,
    status,
    providerUsed: "GEMINI",
    cached: false,
  };
}
