/**
 * §11.290 Phase 4a #ocr-run-pipeline — High-level orchestration entry
 *   point. 기존 3 route (scan-label / parse-image / parse-pdf) 의 parseWithGemini
 *   직접 호출을 본 wrapper 로 swap (호영님 Phase 0 결정 minimum-diff).
 *
 * §11.290 Phase 5 — Tier 2 (Cloud Vision + Claude) fallback 실제 wiring.
 *   Gemini confidence medium/low 시 Tier 2 자동 fallback.
 *   GOOGLE_VISION_API_KEY + ANTHROPIC_API_KEY 미설정 시 graceful degradation
 *   (Gemini 결과 그대로 반환).
 *
 * §11.290 Phase 5.5 — Audit log + cache wiring.
 *   image hash 기반 cache lookup (48h TTL) + cache miss 시 uploadOcrImage +
 *   OcrJob.create + Tier 1/2 결과 OcrResult.create + OcrJob.update(finalResultId)
 *   + costUsd populate. happy path 에서만 audit log + cache, 실패 path 는
 *   기존 Phase 5 graceful fallback 보존 (jobId: null + production 중단 0).
 *
 * Logic:
 *   (0) Cache lookup — same image hash + 48h TTL → 즉시 반환 (cached: true)
 *   (1) Image upload (try/catch) + OcrJob.create (audit log row)
 *   (2) Tier 1 — Gemini 호출 + OcrResult.create (provider GEMINI)
 *   (3) Gemini confidence high (≥0.85) → SUCCESS + OcrJob.update(finalResult)
 *   (4) Gemini confidence medium/low → Tier 2 시도
 *       (a) extractWithCloudVision → rawText + costUsd
 *       (b) structureWithClaude(rawText) → LabelParseResult + costUsd
 *       (c) OcrResult.create (provider CLOUD_VISION_CLAUDE) + costUsd 합산
 *       (d) Tier 2 성공 → CLOUD_VISION_CLAUDE 결과 반환
 *       (e) Tier 2 실패 (env 미설정 등) → Gemini 결과 fallback + OcrJob.update
 *   (5) STORAGE_PROVIDER 미설정 / upload 실패 → jobId=null (audit log 미생성)
 *
 * 호환 contract:
 *   기존 caller 가 parseWithGemini 반환 LabelParseResult 그대로 사용 →
 *   wrapper output 의 `result` 가 동일 shape.
 */

import type { LabelParseResult } from "./label-parser";
import type { OcrJobType } from "@prisma/client";
import { parseWithGemini } from "./gemini-label-parser";
import {
  extractWithCloudVision,
  CloudVisionNotConfiguredError,
} from "./cloud-vision-parser";
import {
  structureWithClaude,
  ClaudeStructurerNotConfiguredError,
} from "./claude-structurer";
import { enumConfidenceToNumber } from "./orchestrator";
import {
  getOcrImageHash,
  uploadOcrImage,
  findCachedOcrJob,
} from "./image-storage";

export interface RunOcrPipelineInput {
  /** Image base64 data URI 또는 raw base64. */
  base64: string;
  /** OcrJobType — LABEL / QUOTE. */
  type: OcrJobType;
  /** Organization 격리 (multi-tenant). */
  organizationId: string;
  /** Scan 실행자 userId. */
  userId: string;
}

export interface RunOcrPipelineResult {
  /** 호환 shape — 기존 caller 가 parseWithGemini 결과로 사용. */
  result: LabelParseResult;
  /** OcrJob.id — STORAGE_PROVIDER 미설정 시 null (audit log 미생성). */
  jobId: string | null;
  /** OcrJobStatus. */
  status: "SUCCESS" | "NEEDS_REVIEW" | "FAILED";
  /** 채택된 provider. */
  providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
  /** Cache hit 여부. */
  cached: boolean;
  /** §11.382 P4 — Gemini 채택 사유(silent degradation 제거, 운영자 가시화). */
  fallbackReason?: "high_confidence" | "tier2_unconfigured" | "tier2_error" | null;
}

// Gemini confidence → numeric threshold
const CONFIDENCE_HIGH_THRESHOLD = 0.85; // 이 이상이면 Tier 2 skip
// Gemini cost 추정 (별도 백로그 — token 기반 정확화 필요)
const GEMINI_COST_USD = 0.001;

/**
 * §11.290 Phase 5 + 5.5 — Tier 1 (Gemini) + Tier 2 (Cloud Vision + Claude)
 *   실제 wiring + audit log + 48h TTL cache.
 *
 * Gemini confidence medium/low 시 Tier 2 자동 시도.
 * STORAGE_PROVIDER 설정 시 OcrJob/OcrResult DB write + image cache 활성.
 * Tier 2 env 미설정 시 graceful degradation — Gemini 결과 그대로 반환.
 * Image upload / DB write 실패 시 graceful fallback (jobId: null, 기존 동작 보존).
 */
export async function runOcrPipeline(
  input: RunOcrPipelineInput,
): Promise<RunOcrPipelineResult> {
  // §11.290 Phase 5.5 — image hash 계산 (cache key + audit log)
  const imageHash = getOcrImageHash(input.base64);

  // (0) Cache lookup — same image + 48h TTL → 즉시 반환
  try {
    const cached = await findCachedOcrJob(imageHash, input.type);
    if (cached && cached.finalResultId) {
      const { db } = await import("@/lib/db");
      const finalResult = await db.ocrResult.findUnique({
        where: { id: cached.finalResultId },
      });
      if (finalResult) {
        // §11.290 Phase 6.b — cache hit audit log INSERT (graceful)
        try {
          await db.ocrCacheHit.create({
            data: {
              cachedJobId: cached.id,
              organizationId: input.organizationId,
              userId: input.userId,
              imageHash,
            },
          });
        } catch (auditErr) {
          console.warn(
            "[OCR] cache hit audit skipped:",
            (auditErr as Error).message,
          );
        }
        return {
          result: finalResult.parsedFields as unknown as LabelParseResult,
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
    console.warn("[OCR] cache lookup skipped:", (cacheErr as Error).message);
  }

  // (1) Image upload — graceful (STORAGE_PROVIDER 미설정 시 audit log skip)
  let uploadedUrl: string | null = null;
  let jobId: string | null = null;
  try {
    const uploadResult = await uploadOcrImage({
      base64: input.base64,
      organizationId: input.organizationId,
      type: input.type,
    });
    uploadedUrl = uploadResult.url;
  } catch (uploadErr) {
    // STORAGE_PROVIDER 미설정 또는 Vercel Blob 실패 → audit log skip,
    // Phase 5 graceful fallback (production 중단 0)
    console.warn("[OCR] image upload skipped:", (uploadErr as Error).message);
  }

  // OcrJob.create — upload 성공 시만 (audit log row)
  if (uploadedUrl) {
    try {
      const { db } = await import("@/lib/db");
      const job = await db.ocrJob.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          type: input.type,
          imageUrl: uploadedUrl,
          imageHash,
          status: "RUNNING",
        },
      });
      jobId = job.id;
    } catch (dbErr) {
      console.warn(
        "[OCR] OcrJob.create skipped:",
        (dbErr as Error).message,
      );
    }
  }

  // (2) Tier 1 — Gemini 호출 (항상 실행, latency 측정)
  const tier1Start = Date.now();
  const geminiResult = await parseWithGemini(input.base64);
  const tier1LatencyMs = Date.now() - tier1Start;
  const geminiConfidence = enumConfidenceToNumber(geminiResult);

  // OcrResult.create — Gemini 결과 (jobId 있을 때만)
  let geminiResultId: string | null = null;
  if (jobId) {
    try {
      const { db } = await import("@/lib/db");
      const ocrResult = await db.ocrResult.create({
        data: {
          jobId,
          provider: "GEMINI",
          parsedFields: geminiResult as unknown as object,
          confidence: geminiConfidence,
          rawText: geminiResult.rawText ?? null,
          costUsd: GEMINI_COST_USD,
          latencyMs: tier1LatencyMs,
        },
      });
      geminiResultId = ocrResult.id;
    } catch (dbErr) {
      console.warn(
        "[OCR] OcrResult.create (Gemini) skipped:",
        (dbErr as Error).message,
      );
    }
  }

  // (3) Gemini confidence high → SUCCESS, Tier 2 skip
  // §ocr-cat-critical (호영님 2026-07-03) — Cat.No.(품목 유일 식별키)가 비면 high confidence여도
  //   Tier 2 rescue 를 시도한다. confidence 가 필드 *개수*(matchedFields≥4) 기반이라, 라벨의
  //   brand/name/lot/expiry/CAS 만 읽히고 작은 "Cat No." 를 놓친 스캔(Sigma/Gibco 곡면 라벨 등)이
  //   high 로 판정돼 Tier 2 를 건너뛰고 Cat 이 영구 누락되던 결함 보정. Cat 존재 시에만 skip(기존 fast-path 유지).
  if (geminiConfidence >= CONFIDENCE_HIGH_THRESHOLD && !!geminiResult.catalogNo) {
    if (jobId && geminiResultId) {
      try {
        const { db } = await import("@/lib/db");
        await db.ocrJob.update({
          where: { id: jobId },
          data: { status: "SUCCESS", finalResultId: geminiResultId },
        });
      } catch (dbErr) {
        console.warn(
          "[OCR] OcrJob.update (Gemini SUCCESS) skipped:",
          (dbErr as Error).message,
        );
      }
    }
    return {
      result: geminiResult,
      jobId,
      status: "SUCCESS",
      providerUsed: "GEMINI",
      cached: false,
      fallbackReason: "high_confidence",
    };
  }

  // (4) Gemini confidence medium/low → Tier 2 시도 (Phase 5 실제 wiring)
  // §11.382 P4 — Tier2 미채택 사유 캡처(silent degradation 제거).
  let tier2FallbackReason: "tier2_unconfigured" | "tier2_error" = "tier2_error";
  try {
    const visionResult = await extractWithCloudVision({ base64: input.base64 });

    if (!visionResult.rawText.trim()) {
      throw new CloudVisionNotConfiguredError("Cloud Vision returned empty text");
    }

    const claudeResult = await structureWithClaude({
      rawText: visionResult.rawText,
    });

    // Tier 2 cost = visionResult.costUsd + claudeResult.costUsd
    const tier2CostUsd = visionResult.costUsd + claudeResult.costUsd;
    const tier2LatencyMs = visionResult.latencyMs + claudeResult.latencyMs;
    const tier2Confidence = enumConfidenceToNumber(claudeResult.parsed);
    const tier2Status =
      claudeResult.parsed.matchedFields >= 2 ? "SUCCESS" : "NEEDS_REVIEW";

    // OcrResult.create — Tier 2 결과 (jobId 있을 때만)
    if (jobId) {
      try {
        const { db } = await import("@/lib/db");
        const tier2Result = await db.ocrResult.create({
          data: {
            jobId,
            provider: "CLOUD_VISION_CLAUDE",
            parsedFields: claudeResult.parsed as unknown as object,
            confidence: tier2Confidence,
            rawText: visionResult.rawText,
            costUsd: tier2CostUsd,
            latencyMs: tier2LatencyMs,
          },
        });
        await db.ocrJob.update({
          where: { id: jobId },
          data: { status: tier2Status, finalResultId: tier2Result.id },
        });
      } catch (dbErr) {
        console.warn(
          "[OCR] OcrResult.create (Tier 2) skipped:",
          (dbErr as Error).message,
        );
      }
    }

    return {
      result: claudeResult.parsed,
      jobId,
      status: tier2Status,
      providerUsed: "CLOUD_VISION_CLAUDE",
      cached: false,
      fallbackReason: null,
    };
  } catch (err) {
    if (
      err instanceof CloudVisionNotConfiguredError ||
      err instanceof ClaudeStructurerNotConfiguredError
    ) {
      // env 미설정 또는 Tier 2 실패 → Gemini 결과 graceful fallback
      tier2FallbackReason = "tier2_unconfigured";
      console.warn("[OCR] Tier 2 fallback skipped:", (err as Error).message);
    } else {
      // 예상치 못한 오류도 graceful degradation (production 중단 방지)
      tier2FallbackReason = "tier2_error";
      console.error("[OCR] Tier 2 unexpected error (falling back to Gemini):", err);
    }
  }

  // (5) Tier 2 실패 → Gemini 결과 graceful fallback
  const fallbackStatus =
    geminiResult.matchedFields >= 2 ? "SUCCESS" : "NEEDS_REVIEW";
  if (jobId && geminiResultId) {
    try {
      const { db } = await import("@/lib/db");
      await db.ocrJob.update({
        where: { id: jobId },
        data: { status: fallbackStatus, finalResultId: geminiResultId },
      });
    } catch (dbErr) {
      console.warn(
        "[OCR] OcrJob.update (Gemini fallback) skipped:",
        (dbErr as Error).message,
      );
    }
  }
  return {
    result: geminiResult,
    jobId,
    status: fallbackStatus,
    providerUsed: "GEMINI",
    cached: false,
    fallbackReason: tier2FallbackReason,
  };
}
