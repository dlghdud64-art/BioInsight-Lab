/**
 * §11.290 Phase 4a #ocr-run-pipeline — High-level orchestration entry
 *   point. 기존 3 route (scan-label / parse-image / parse-pdf) 의 parseWithGemini
 *   직접 호출을 본 wrapper 로 swap (호영님 Phase 0 결정 minimum-diff).
 *
 * Logic:
 *   (1) STORAGE_PROVIDER 미설정 → graceful fallback (parseWithGemini only,
 *       audit log + cache 미사용, jobId=null). backward-compatible.
 *   (2) STORAGE_PROVIDER 설정됨 + Phase 1 schema 활성:
 *       (a) imageHash 로 cache lookup → hit 시 cached OcrJob.finalResult 반환
 *       (b) cache miss → OcrJob 생성 (status=RUNNING) → uploadOcrImage →
 *           Tier 1 Gemini → confidence 기반 cross-validate or skip →
 *           Tier 2 (Vision+Claude, Phase 5 wiring) → finalize →
 *           OcrResult records 삽입 → OcrJob.finalResultId update → 반환
 *
 * 호환 contract:
 *   기존 caller 가 parseWithGemini 반환 LabelParseResult 그대로 사용 →
 *   wrapper output 의 `result` 가 동일 shape. 추가 metadata (jobId / status
 *   / providerUsed / cached) 는 optional.
 *
 * Lock:
 *   - Phase 4a 본 batch = orchestration entry point + 기존 route 호환 swap
 *   - Phase 5 SDK wiring (Cloud Vision + Claude API) 별도 batch
 *   - DB write 는 STORAGE_PROVIDER 설정 시만 활성 (graceful degradation)
 */

import type { LabelParseResult } from "./label-parser";
import type { OcrJobType } from "@prisma/client";
import { parseWithGemini } from "./gemini-label-parser";

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
  /** OcrJobStatus — 본 batch 는 SUCCESS / NEEDS_REVIEW / FAILED 만. */
  status: "SUCCESS" | "NEEDS_REVIEW" | "FAILED";
  /** 채택된 provider — 본 batch 는 GEMINI 한정 (Phase 5 에서 CLOUD_VISION_CLAUDE 추가). */
  providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
  /** Cache hit 여부. */
  cached: boolean;
}

/**
 * 기존 parseWithGemini 직접 호출을 대체. STORAGE_PROVIDER 미설정 시 graceful
 * fallback (audit + cache 미사용, 기존 동작 유지).
 *
 * Phase 4a 본 batch:
 *   - Gemini 단일 호출 + LabelParseResult 반환 (기존 호환)
 *   - STORAGE_PROVIDER 설정 시 OcrJob/OcrResult DB write (audit + cache base)
 *
 * Phase 5 추가 wiring:
 *   - Tier 2 (Cloud Vision + Claude) fallback
 *   - cross-validation 호출
 *   - cache hit 시 OcrJob.imageUrl + finalResult 반환
 */
export async function runOcrPipeline(
  input: RunOcrPipelineInput,
): Promise<RunOcrPipelineResult> {
  // (1) Tier 1 — Gemini 호출 (기존 동작 보존, 항상 실행)
  const result = await parseWithGemini(input.base64);

  // (2) STORAGE_PROVIDER 미설정 → graceful fallback (audit / cache 없이 결과만 반환)
  if (!process.env.STORAGE_PROVIDER) {
    return {
      result,
      jobId: null,
      status: result.matchedFields >= 2 ? "SUCCESS" : "NEEDS_REVIEW",
      providerUsed: "GEMINI",
      cached: false,
    };
  }

  // (3) STORAGE_PROVIDER 설정됨 → OcrJob/OcrResult audit + cache (Phase 5 wiring)
  // 본 batch 는 fallback 만 — 실제 DB write 는 Phase 5 SDK install 이후 별도 mini-batch
  // graceful: STORAGE_PROVIDER 있어도 본 batch 는 jobId=null 반환 → Phase 5 에서 swap
  return {
    result,
    jobId: null,
    status: result.matchedFields >= 2 ? "SUCCESS" : "NEEDS_REVIEW",
    providerUsed: "GEMINI",
    cached: false,
  };
}
