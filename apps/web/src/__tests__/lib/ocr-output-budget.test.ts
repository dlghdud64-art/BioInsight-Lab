/**
 * §ocr-output-budget (호영님 2026-09-05, ①) — thinking 예산 분리 + 상한 산정.
 *
 * 배경: ④(lotNumber·expiryDate 자리 신설)가 ①을 악화시켰다.
 *   4품목 rawText 1094 → 1534 (+40%). 경계선이던 4품목이 **안정적 잘림**이 됐다
 *   (finishReason=MAX_TOKENS 실측 · 길이 1534).
 *   ⇒ 스키마에 필드를 추가하는 것은 출력 예산의 소비이기도 하다.
 */

import { describe, it, expect } from "vitest";
import {
  ocrGenerationConfig,
  OCR_THINKING_BUDGET,
  OCR_QUOTE_MAX_OUTPUT_TOKENS,
  OCR_LABEL_MAX_OUTPUT_TOKENS,
} from "@/lib/ocr/output-budget";

describe("§ocr-output-budget — thinking 분리가 상향보다 먼저다", () => {
  it("thinkingBudget 이 config 에 실재한다 (없으면 상향해도 thinking 이 먹는다)", () => {
    const c = ocrGenerationConfig(8192);
    expect(c.thinkingConfig).toBeDefined();
    expect(c.thinkingConfig.thinkingBudget).toBe(OCR_THINKING_BUDGET);
  });

  it("기본 thinking 예산 = 0 (구조화 추출은 추론 여지가 적다)", () => {
    // ⚠️ 품질 저하가 실측되면 이 값만 올린다. 그 사실을 기록으로 남긴다(호영님).
    expect(OCR_THINKING_BUDGET).toBe(0);
  });

  it("temperature 는 기존 값을 유지한다 (회귀 0)", () => {
    expect(ocrGenerationConfig(512).temperature).toBe(0.1);
  });

  it("상한은 인자로 받는다 — 경로마다 다르다", () => {
    expect(ocrGenerationConfig(8192).maxOutputTokens).toBe(8192);
    expect(ocrGenerationConfig(512).maxOutputTokens).toBe(512);
  });
});

describe("§ocr-output-budget — 상한 산정", () => {
  it("견적·명세서 상한이 실측 기반 산정치 이상이다", () => {
    // 실측: 4품목 1534자 → 품목당 ~380자. 10품목 ≈ 4100자 ≈ 2000~2900 토큰.
    // 구 값 4096 에서는 4품목이 잘렸다 — 그 이상이어야 한다.
    expect(OCR_QUOTE_MAX_OUTPUT_TOKENS).toBeGreaterThan(4096);
    expect(OCR_QUOTE_MAX_OUTPUT_TOKENS).toBe(8192);
  });

  it("라벨 상한은 기존 값 유지 (필드 7개 고정 · 회귀 0)", () => {
    expect(OCR_LABEL_MAX_OUTPUT_TOKENS).toBe(512);
  });

  it("🛑 상한이 잘림을 없애지 않는다 — 감지가 마지막 방어선", () => {
    // 이 단언은 값이 아니라 **설계 의도**를 잠근다: 상한을 올렸다고
    // finishReason 감지를 걷어내면 20품목에서 다시 침묵한다.
    // 실제 감지 계약은 §ocr-parse-failure sentinel 이 본다.
    expect(Number.isFinite(OCR_QUOTE_MAX_OUTPUT_TOKENS)).toBe(true);
  });
});
