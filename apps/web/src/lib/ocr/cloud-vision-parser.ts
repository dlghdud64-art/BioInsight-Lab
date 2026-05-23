/**
 * §11.290 Phase 3 #ocr-cloud-vision — Google Cloud Vision OCR text extraction
 *   (Tier 2 fallback provider, before Claude structuring).
 *
 * §11.290 Phase 5 — REST API 실제 wiring (SDK 없이 fetch 사용,
 *   Vercel 번들 크기 최적화. @google-cloud/vision SDK install 불필요).
 *
 * 호영님 P1 spec (2026-05-23) Phase 0 결정:
 *   3-tier fallback Tier 2 의 OCR 추출 단계. Cloud Vision API 가 image →
 *   raw text 만 반환, 구조화는 claude-structurer.ts 가 처리.
 *
 * Lock:
 *   - REST API (fetch) — SDK 없이 호출, Vercel serverless 최적
 *   - env: GOOGLE_VISION_API_KEY (호영님 Vercel dashboard 설정 필수)
 *   - env 미설정 시 CloudVisionNotConfiguredError throw →
 *     orchestrator 가 try/catch 로 Gemini 결과 그대로 사용
 *   - cost 추정: $0.0015 per call (TEXT_DETECTION 1 unit)
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
 * §11.290 Phase 5 — Google Cloud Vision REST API 로 image → raw text 추출.
 *
 * GOOGLE_VISION_API_KEY 미설정 시 CloudVisionNotConfiguredError throw →
 * orchestrator 가 Gemini 결과를 그대로 반환 (graceful degradation).
 *
 * REST API endpoint:
 *   POST https://vision.googleapis.com/v1/images:annotate?key=API_KEY
 *   features: TEXT_DETECTION → fullTextAnnotation.text
 */
export async function extractWithCloudVision(
  input: CloudVisionExtractInput,
): Promise<CloudVisionExtractResult> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new CloudVisionNotConfiguredError(
      "GOOGLE_VISION_API_KEY 환경변수 미설정. Vercel dashboard 에서 설정 후 활성.",
    );
  }

  // data URI → raw base64 추출
  const base64Data = input.base64.replace(/^data:image\/\w+;base64,/, "");

  const startMs = Date.now();

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Data },
            features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
          },
        ],
      }),
    },
  );

  const latencyMs = Date.now() - startMs;

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new CloudVisionNotConfiguredError(
      `Cloud Vision API error ${response.status}: ${errBody.slice(0, 200)}`,
    );
  }

  const data = await response.json() as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string };
      error?: { message?: string };
    }>;
  };

  const visionResponse = data.responses?.[0];
  if (visionResponse?.error) {
    throw new CloudVisionNotConfiguredError(
      `Cloud Vision response error: ${visionResponse.error.message}`,
    );
  }

  const rawText = visionResponse?.fullTextAnnotation?.text ?? "";

  return {
    rawText,
    costUsd: 0.0015, // TEXT_DETECTION 1 unit 추정
    latencyMs,
  };
}
