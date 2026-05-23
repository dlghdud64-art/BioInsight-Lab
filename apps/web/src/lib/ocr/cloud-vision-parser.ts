/**
 * §11.290 Phase 3 #ocr-cloud-vision — Google Cloud Vision OCR text extraction
 *   (Tier 2 fallback provider, before Claude structuring).
 *
 * 호영님 P1 spec (2026-05-23) Phase 0 결정:
 *   3-tier fallback Tier 2 의 OCR 추출 단계. Cloud Vision API 가 image →
 *   raw text 만 반환, 구조화는 claude-structurer.ts 가 처리.
 *
 * Lock:
 *   - dynamic import (@google-cloud/vision) — sandbox vitest 호환,
 *     호영님 환경 `pnpm add @google-cloud/vision` 미설치 시 graceful throw
 *   - env: GOOGLE_VISION_API_KEY (Phase 5 호영님 dashboard 작업)
 *   - SDK 미설치 / env 미설정 시 CloudVisionNotConfiguredError throw →
 *     orchestrator 가 try/catch 로 fallback (next tier or fail)
 *
 * Implementation 본 batch:
 *   - 함수 시그니처 + lazy import 패턴 + error class
 *   - 실제 Cloud Vision SDK 호출 wiring 은 Phase 5 (Vercel env 설정 후)
 *     별도 mini-batch — env 미설정 시 throw 만으로 graceful path 보장
 */

export class CloudVisionNotConfiguredError extends Error {
  constructor(reason: string) {
    super(`Cloud Vision OCR not configured: ${reason}`);
    this.name = "CloudVisionNotConfiguredError";
  }
}

export interface CloudVisionExtractInput {
  /** Image base64 data URI 또는 raw base64. */
  base64: string;
}

export interface CloudVisionExtractResult {
  /** 추출된 raw text (Claude structurer 입력). */
  rawText: string;
  /** API call cost (audit log). */
  costUsd: number;
  /** Call latency in ms (audit log). */
  latencyMs: number;
}

/**
 * Google Cloud Vision API 로 image → raw text 추출.
 *
 * SDK 미설치 또는 GOOGLE_VISION_API_KEY 미설정 시 CloudVisionNotConfiguredError
 * throw — orchestrator 가 try/catch 로 fallback.
 *
 * Phase 5 실제 wiring:
 *   1. @google-cloud/vision SDK import
 *   2. ImageAnnotatorClient.textDetection({ image: { content: base64Data } })
 *   3. result.fullTextAnnotation.text 반환
 *   4. cost 추정 ($0.0015 per call)
 */
export async function extractWithCloudVision(
  _input: CloudVisionExtractInput,
): Promise<CloudVisionExtractResult> {
  if (!process.env.GOOGLE_VISION_API_KEY) {
    throw new CloudVisionNotConfiguredError(
      "GOOGLE_VISION_API_KEY 환경변수 미설정. Phase 5 호영님 Vercel dashboard 작업 후 활성.",
    );
  }

  // Phase 5 실제 wiring placeholder
  // const { ImageAnnotatorClient } = await import("@google-cloud/vision");
  // ...
  throw new CloudVisionNotConfiguredError(
    "Cloud Vision SDK wiring not implemented (Phase 5 별도 batch).",
  );
}
