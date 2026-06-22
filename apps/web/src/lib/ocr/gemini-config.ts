/**
 * §11.315 #gemini-model-config — Gemini 모델 ID 중앙 관리 + fallback 헬퍼.
 *
 * 호영님 P0 spec (2026-05-28):
 *   기존 `gemini-2.5-flash-preview-04-17` (preview) 가 정식 출시 후 폐기되어
 *   404 NOT_FOUND. preview/experimental 모델은 하드코딩 금지 — 환경변수로
 *   분리하여 다음 폐기 시 코드 수정 없이 교체 가능.
 *
 * 정책:
 *   - PRIMARY: process.env.GEMINI_MODEL ?? "gemini-2.5-flash" (정식 GA, vision+generateContent 지원)
 *   - FALLBACK: process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash-lite"
 *   - 호출 실패가 404/NOT_FOUND 면 fallback 1회 재시도. fallback 도 실패 시 원본 throw.
 *   - server-side log 만 raw error 보존(console.warn), 사용자 메시지는 caller 가 친화 변환.
 */

export const GEMINI_PRIMARY_MODEL =
  process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export const GEMINI_FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash-lite";

/**
 * §scan-stability — 일시적(transient) Gemini 오류 판별.
 *   호영님 모바일 라이브: 동일 선명 라벨이 13:43 성공 / 15:42 실패 = 간헐적 →
 *   이미지가 아니라 백엔드 안정성(rate limit 429 / timeout / 5xx). 연속 스캔이
 *   분당 한도(RPM)를 넘기면 첫 호출 통과 후 후속이 429 로 떨어지는 패턴.
 *   결정론적 오류(4xx 검증 등)와 구분 — 이 분류만 backoff 재시도 대상.
 */
const TRANSIENT_GEMINI_RE =
  /429|RESOURCE_EXHAUSTED|rate.?limit|quota|UNAVAILABLE|DEADLINE_EXCEEDED|timed?\s*out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|"code":\s*5\d\d|status.*\b5\d\d\b/i;

export function isTransientGeminiError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return TRANSIENT_GEMINI_RE.test(message);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gemini SDK 호출.
 *   1. 404/NOT_FOUND (모델 폐기) → FALLBACK 모델로 1회 재시도 (§11.315).
 *   2. 429/timeout/5xx 등 일시적 오류 → exponential backoff 재시도(총 3회).
 *      연속 스캔 rate limit 흡수 — 같은 선명 라벨 간헐 실패 해소.
 *
 * @example
 *   const response = await callGeminiWithFallback((model) =>
 *     ai.models.generateContent({ model, contents, config }),
 *   );
 */
export async function callGeminiWithFallback<T>(
  invoke: (model: string) => Promise<T>,
): Promise<T> {
  const MAX_TRANSIENT_RETRIES = 2; // 총 3회 시도 (초기 + 2회 재시도)
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    try {
      return await invoke(GEMINI_PRIMARY_MODEL);
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      const isModelNotFound =
        /NOT_FOUND|"code":\s*404|status.*404/.test(message) &&
        GEMINI_FALLBACK_MODEL !== GEMINI_PRIMARY_MODEL;
      if (isModelNotFound) {
        console.warn(
          `[gemini-config] PRIMARY 모델 "${GEMINI_PRIMARY_MODEL}" 404 NOT_FOUND → ` +
            `FALLBACK "${GEMINI_FALLBACK_MODEL}" 로 재시도.`,
        );
        return await invoke(GEMINI_FALLBACK_MODEL);
      }
      // §scan-stability — 일시적 오류면 backoff 후 재시도, 아니면 즉시 throw.
      if (isTransientGeminiError(err) && attempt < MAX_TRANSIENT_RETRIES) {
        const backoffMs = 600 * 2 ** attempt; // 600ms → 1200ms
        console.warn(
          `[gemini-config] 일시적 오류 (시도 ${attempt + 1}/${MAX_TRANSIENT_RETRIES + 1}) → ` +
            `${backoffMs}ms 후 재시도: ${message.slice(0, 140)}`,
        );
        await sleep(backoffMs);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * 사용자에게 노출할 친화 에러 메시지. raw Gemini JSON 차단용.
 * caller 는 (1) raw 를 console.error 로 서버 로그에 남기고
 * (2) 본 헬퍼의 결과만 response.error 로 반환해야 한다.
 */
export function friendlyGeminiErrorMessage(
  context: "label" | "quote" | "bom" = "label",
): string {
  switch (context) {
    case "quote":
      return "거래명세서 이미지 분석에 실패했습니다. 다시 시도하거나 직접 입력해 주세요.";
    case "bom":
      return "BOM 파싱에 실패했습니다. 다시 시도하거나 직접 입력해 주세요.";
    case "label":
    default:
      return "이미지 분석에 실패했습니다. 다시 시도하거나 직접 입력해 주세요.";
  }
}
