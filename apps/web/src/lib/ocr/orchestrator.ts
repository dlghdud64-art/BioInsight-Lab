/**
 * §11.290 Phase 3 #ocr-orchestrator — Multi-provider OCR fallback +
 *   cross-validation + audit log.
 *
 * 호영님 P1 spec (2026-05-23):
 *   3-tier fallback (Phase 0 결정 표):
 *     Tier 1: Gemini 2.5 Flash multimodal (lib/ocr/gemini-label-parser.ts)
 *     Tier 2: Cloud Vision OCR + Claude 구조화 (lib/ocr/cloud-vision-parser
 *             + claude-structurer)
 *     Tier 3: regex (lib/ocr/label-parser.ts, text input only)
 *
 * Confidence threshold (Phase 0):
 *   - ≥ 0.85 → SUCCESS (auto prefill 가능)
 *   - 0.70 ~ 0.85 → cross-validate (secondary 호출 + 가중평균)
 *   - < 0.70 → NEEDS_REVIEW (manual review)
 *
 * Cross-validation (Phase 0):
 *   - field-level agreement ratio = matched field count / total compared
 *     fields (양쪽 null 제외)
 *   - agreement ≥ 0.8 → 가중평균 confidence 사용
 *   - agreement < 0.8 → NEEDS_REVIEW + mismatch alert
 *
 * Audit log (Phase 1 schema):
 *   - OcrResult.costUsd / latencyMs / errorMessage 기록
 *   - finalResultId 로 canonical winner 표시
 *
 * Lock:
 *   - Provider client 는 dynamic import (sandbox vitest 호환)
 *   - SDK 미설치 시 graceful degradation (해당 provider skip)
 *   - 본 batch 는 pure orchestration logic — 실제 Gemini/Vision/Claude
 *     호출 wiring 은 Phase 4 (UI + API route) 에서 caller 정합
 */

import type { LabelParseResult } from "./label-parser";

// ─── Confidence threshold constants ───
export const CONFIDENCE_AUTO_THRESHOLD = 0.85;
export const CONFIDENCE_REVIEW_THRESHOLD = 0.7;
export const AGREEMENT_THRESHOLD = 0.8;

// ─── Provider result wrapper ───
export interface ProviderRun {
  result: LabelParseResult;
  /** 0.0 ~ 1.0 numeric confidence (LabelParseResult.confidence 가 high|medium|low 인 enum 을 숫자로 변환). */
  confidenceNum: number;
  /** API call cost in USD (audit log). */
  costUsd?: number;
  /** Call latency in ms (audit log). */
  latencyMs?: number;
  /** Provider 호출 실패 시 error message (audit log). */
  errorMessage?: string;
}

// ─── Orchestration final result ───
export interface OrchestrationFinalResult {
  /** 최종 status — OcrJobStatus enum 정합. */
  status: "SUCCESS" | "FAILED" | "NEEDS_REVIEW";
  /** 채택된 LabelParseResult. */
  result: LabelParseResult | null;
  /** 최종 confidence (cross-validation 시 가중평균). */
  confidence: number;
  /** 채택된 provider — OcrProvider enum 정합. */
  providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX" | null;
  /** Cross-validation agreement ratio (양쪽 호출 시만). null = 단일 provider. */
  crossValidationRatio: number | null;
  /** Mismatch detected (agreement < threshold). */
  mismatchAlert: boolean;
}

// ─── Cross-validation helper ───

const COMPARED_FIELDS: (keyof LabelParseResult)[] = [
  "catalogNo",
  "lotNo",
  "expirationDate",
  "brand",
  "productName",
  "casNumber",
];

export interface AgreementResult {
  matchedFields: number;
  comparedFields: number;
  ratio: number;
}

/**
 * Field-level agreement between two LabelParseResult.
 *
 * 양쪽 null 인 field 는 비교에서 제외 (denominator 감소).
 * 한쪽만 null → 불일치 (denominator 포함, numerator 미포함).
 */
export function computeAgreement(
  a: LabelParseResult,
  b: LabelParseResult,
): AgreementResult {
  let matched = 0;
  let compared = 0;
  for (const field of COMPARED_FIELDS) {
    const av = a[field];
    const bv = b[field];
    // 양쪽 null → skip (denominator 감소)
    if (av === null && bv === null) continue;
    compared += 1;
    if (av === bv) matched += 1;
  }
  const ratio = compared === 0 ? 0 : matched / compared;
  return { matchedFields: matched, comparedFields: compared, ratio };
}

// ─── Finalize orchestration result ───

export interface FinalizeInput {
  primary: ProviderRun | null;
  secondary?: ProviderRun | null;
  tertiary?: ProviderRun | null;
}

/**
 * Provider run results → 최종 orchestration result.
 *
 * Logic:
 *   - primary high confidence (≥0.85) → SUCCESS, secondary skip
 *   - primary medium (0.70~0.85) + secondary 있음 → cross-validate
 *   - primary fail + secondary 성공 → fallback
 *   - 모두 fail → FAILED
 */
export function finalizeOrchestrationResult({
  primary,
  secondary,
  tertiary,
}: FinalizeInput): OrchestrationFinalResult {
  // (1) primary + secondary 둘 다 있음 → cross-validation
  if (primary && secondary) {
    const agreement = computeAgreement(primary.result, secondary.result);
    if (agreement.ratio >= AGREEMENT_THRESHOLD) {
      // 가중평균 confidence
      const weightedConfidence =
        (primary.confidenceNum + secondary.confidenceNum) / 2;
      return {
        status: weightedConfidence >= CONFIDENCE_REVIEW_THRESHOLD ? "SUCCESS" : "NEEDS_REVIEW",
        result: primary.result, // primary 우선 채택
        confidence: weightedConfidence,
        providerUsed: "GEMINI",
        crossValidationRatio: agreement.ratio,
        mismatchAlert: false,
      };
    }
    // Mismatch → NEEDS_REVIEW + alert
    return {
      status: "NEEDS_REVIEW",
      result: primary.result, // primary 표시, 사용자 보정 필요
      confidence: Math.max(primary.confidenceNum, secondary.confidenceNum),
      providerUsed: "GEMINI",
      crossValidationRatio: agreement.ratio,
      mismatchAlert: true,
    };
  }

  // (2) primary 만 있음
  if (primary) {
    let status: OrchestrationFinalResult["status"];
    if (primary.confidenceNum >= CONFIDENCE_AUTO_THRESHOLD) {
      status = "SUCCESS";
    } else if (primary.confidenceNum >= CONFIDENCE_REVIEW_THRESHOLD) {
      status = "SUCCESS"; // medium도 SUCCESS, but secondary 없어 cross-validate 불가
    } else {
      status = "NEEDS_REVIEW";
    }
    return {
      status,
      result: primary.result,
      confidence: primary.confidenceNum,
      providerUsed: "GEMINI",
      crossValidationRatio: null,
      mismatchAlert: false,
    };
  }

  // (3) primary 실패 + secondary 성공 → fallback
  if (secondary) {
    const status: OrchestrationFinalResult["status"] =
      secondary.confidenceNum >= CONFIDENCE_REVIEW_THRESHOLD ? "SUCCESS" : "NEEDS_REVIEW";
    return {
      status,
      result: secondary.result,
      confidence: secondary.confidenceNum,
      providerUsed: "CLOUD_VISION_CLAUDE",
      crossValidationRatio: null,
      mismatchAlert: false,
    };
  }

  // (4) primary + secondary 모두 실패 + tertiary (regex) 있음
  if (tertiary) {
    return {
      status: tertiary.confidenceNum >= CONFIDENCE_REVIEW_THRESHOLD ? "SUCCESS" : "NEEDS_REVIEW",
      result: tertiary.result,
      confidence: tertiary.confidenceNum,
      providerUsed: "REGEX",
      crossValidationRatio: null,
      mismatchAlert: false,
    };
  }

  // (5) 모든 provider 실패
  return {
    status: "FAILED",
    result: null,
    confidence: 0,
    providerUsed: null,
    crossValidationRatio: null,
    mismatchAlert: false,
  };
}

// ─── Provider invocation wrapper (lazy SDK import) ───

/**
 * LabelParseResult.confidence enum (high/medium/low) → numeric 0.0~1.0.
 *
 * Heuristic mapping based on matchedFields:
 *   - high (matchedFields ≥ 4): 0.85 baseline + 0.025 per extra field
 *   - medium (matchedFields ≥ 2): 0.70 baseline + 0.05 per field over 2
 *   - low (matchedFields < 2): 0.30 baseline + 0.15 per field
 */
export function enumConfidenceToNumber(result: LabelParseResult): number {
  const { confidence, matchedFields } = result;
  if (confidence === "high") {
    return Math.min(1, 0.85 + 0.025 * Math.max(0, matchedFields - 4));
  }
  if (confidence === "medium") {
    return Math.min(0.85, 0.7 + 0.05 * Math.max(0, matchedFields - 2));
  }
  return Math.min(0.7, 0.3 + 0.15 * matchedFields);
}
