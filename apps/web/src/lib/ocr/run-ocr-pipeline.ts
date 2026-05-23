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
 * Logic:
 *   (1) Tier 1 — Gemini 호출 (항상 실행)
 *   (2) Gemini confidence high (≥0.85) → SUCCESS, Tier 2 skip
 *   (3) Gemini confidence medium/low → Tier 2 시도
 *       (a) extractWithCloudVision → rawText
 *       (b) structureWithClaude(rawText) → LabelParseResult
 *       (c) Tier 2 성공 → CLOUD_VISION_CLAUDE 결과 반환
 *       (d) Tier 2 실패 (env 미설정 등) → Gemini 결과 fallback
 *   (4) STORAGE_PROVIDER 미설정 → jobId=null (audit log 미생성)
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
}

// Gemini confidence → numeric threshold
const CONFIDENCE_HIGH_THRESHOLD = 0.85; // 이 이상이면 Tier 2 skip

/**
 * §11.290 Phase 5 — Tier 1 (Gemini) + Tier 2 (Cloud Vision + Claude) 실제 wiring.
 *
 * Gemini confidence medium/low 시 Tier 2 자동 시도.
 * Tier 2 env 미설정 시 graceful degradation — Gemini 결과 그대로 반환.
 */
export async function runOcrPipeline(
  input: RunOcrPipelineInput,
): Promise<RunOcrPipelineResult> {
  // (1) Tier 1 — Gemini 호출 (항상 실행)
  const geminiResult = await parseWithGemini(input.base64);
  const geminiConfidence = enumConfidenceToNumber(geminiResult);

  // (2) Gemini confidence high → SUCCESS, Tier 2 skip
  if (geminiConfidence >= CONFIDENCE_HIGH_THRESHOLD) {
    return {
      result: geminiResult,
      jobId: null,
      status: "SUCCESS",
      providerUsed: "GEMINI",
      cached: false,
    };
  }

  // (3) Gemini confidence medium/low → Tier 2 시도 (Phase 5 실제 wiring)
  try {
    const visionResult = await extractWithCloudVision({ base64: input.base64 });

    if (!visionResult.rawText.trim()) {
      // Cloud Vision 이 text 를 추출하지 못함 → Gemini fallback
      throw new CloudVisionNotConfiguredError("Cloud Vision returned empty text");
    }

    const claudeResult = await structureWithClaude({ rawText: visionResult.rawText });

    return {
      result: claudeResult.parsed,
      jobId: null,
      status: claudeResult.parsed.matchedFields >= 2 ? "SUCCESS" : "NEEDS_REVIEW",
      providerUsed: "CLOUD_VISION_CLAUDE",
      cached: false,
    };
  } catch (err) {
    if (
      err instanceof CloudVisionNotConfiguredError ||
      err instanceof ClaudeStructurerNotConfiguredError
    ) {
      // env 미설정 또는 Tier 2 실패 → Gemini 결과 graceful fallback
      console.warn("[OCR] Tier 2 fallback skipped:", (err as Error).message);
    } else {
      // 예상치 못한 오류도 graceful degradation (production 중단 방지)
      console.error("[OCR] Tier 2 unexpected error (falling back to Gemini):", err);
    }
  }

  // (4) Tier 2 실패 → Gemini 결과 반환 (graceful degradation)
  return {
    result: geminiResult,
    jobId: null,
    status: geminiResult.matchedFields >= 2 ? "SUCCESS" : "NEEDS_REVIEW",
    providerUsed: "GEMINI",
    cached: false,
  };
}
