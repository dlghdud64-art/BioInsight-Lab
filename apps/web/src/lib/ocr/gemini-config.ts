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
 * Gemini SDK 호출을 primary 모델로 시도하고, 404/NOT_FOUND 발생 시 fallback 으로 1회 재시도.
 *
 * @example
 *   const response = await callGeminiWithFallback((model) =>
 *     ai.models.generateContent({ model, contents, config }),
 *   );
 */
export async function callGeminiWithFallback<T>(
  invoke: (model: string) => Promise<T>,
): Promise<T> {
  try {
    return await invoke(GEMINI_PRIMARY_MODEL);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isModelNotFound =
      /NOT_FOUND|"code":\s*404|status.*404/.test(message) &&
      GEMINI_FALLBACK_MODEL !== GEMINI_PRIMARY_MODEL;
    if (!isModelNotFound) {
      throw err;
    }
    console.warn(
      `[gemini-config] PRIMARY 모델 "${GEMINI_PRIMARY_MODEL}" 404 NOT_FOUND → ` +
        `FALLBACK "${GEMINI_FALLBACK_MODEL}" 로 재시도.`,
    );
    return await invoke(GEMINI_FALLBACK_MODEL);
  }
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
