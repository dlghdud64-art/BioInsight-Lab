/**
 * AI 응답에서 순수 JSON만 추출하는 유틸리티
 *
 * LLM(GPT, Gemini 등)이 응답할 때 종종 마크다운 코드 블록이나
 * 잡다한 텍스트를 섞어서 보내는 문제를 해결합니다.
 */

/**
 * AI 응답에서 마크다운 코드 블록과 잡다한 텍스트를 제거하고
 * 순수한 JSON만 추출합니다.
 *
 * @param rawResponse - AI로부터 받은 원본 응답 텍스트
 * @returns 클린한 JSON 문자열
 * @throws 유효한 JSON을 찾을 수 없을 때
 */
export function cleanJsonResponse(rawResponse: string): string {
  if (!rawResponse || typeof rawResponse !== "string") {
    throw new Error("빈 응답이거나 문자열이 아닙니다.");
  }

  let cleaned = rawResponse.trim();

  // 1. 마크다운 코드 블록 제거: ```json ... ``` 또는 ``` ... ```
  // 가장 흔한 패턴부터 처리
  const codeBlockPatterns = [
    /^```json\s*\n?([\s\S]*?)\n?```\s*$/i, // ```json ... ```
    /^```\s*\n?([\s\S]*?)\n?```\s*$/i, // ``` ... ```
    /```json\s*\n?([\s\S]*?)\n?```/i, // 중간에 있는 ```json ... ```
    /```\s*\n?([\s\S]*?)\n?```/i, // 중간에 있는 ``` ... ```
  ];

  for (const pattern of codeBlockPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      cleaned = match[1].trim();
      break;
    }
  }

  // 2. JSON 객체/배열 추출: { ... } 또는 [ ... ]
  // 응답 앞뒤에 잡다한 텍스트가 있을 수 있음
  const jsonObjectMatch = cleaned.match(/(\{[\s\S]*\})/);
  const jsonArrayMatch = cleaned.match(/(\[[\s\S]*\])/);

  if (jsonObjectMatch) {
    cleaned = jsonObjectMatch[1];
  } else if (jsonArrayMatch) {
    cleaned = jsonArrayMatch[1];
  }

  // 3. 최종 정리: 앞뒤 공백 제거
  cleaned = cleaned.trim();

  // 4. 유효성 검증: { 또는 [ 로 시작해야 함
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    throw new Error(
      `유효한 JSON 형식이 아닙니다. 응답이 '{' 또는 '['로 시작하지 않습니다.`
    );
  }

  return cleaned;
}

/**
 * AI 응답을 클리닝하고 JSON으로 파싱합니다.
 * 실패 시 상세한 에러 로깅을 제공합니다.
 *
 * @param rawResponse - AI로부터 받은 원본 응답 텍스트
 * @param context - 에러 로깅용 컨텍스트 (어떤 기능에서 호출했는지)
 * @returns 파싱된 JSON 객체
 * @throws JSON 파싱 실패 시
 */
export function parseAiJsonResponse<T = unknown>(
  rawResponse: string,
  context: string = "AI Response"
): T {
  try {
    // 1단계: JSON 클리닝
    const cleanedJson = cleanJsonResponse(rawResponse);

    // 2단계: JSON 파싱
    try {
      return JSON.parse(cleanedJson) as T;
    } catch (parseError) {
      // 파싱 실패 시 상세 로깅
      console.error(`[${context}] JSON 파싱 실패`);
      console.error(`[${context}] 클리닝된 JSON (처음 500자):`, cleanedJson.slice(0, 500));
      console.error(`[${context}] 파싱 에러:`, parseError);
      throw new Error(`JSON 파싱 실패: ${(parseError as Error).message}`);
    }
  } catch (cleanError) {
    // 클리닝 실패 시 원본 응답 로깅
    console.error(`[${context}] JSON 클리닝 실패`);
    console.error(`[${context}] 원본 응답 (처음 1000자):`, rawResponse?.slice(0, 1000));
    console.error(`[${context}] 클리닝 에러:`, cleanError);
    throw cleanError;
  }
}

/**
 * JSON 파싱을 안전하게 시도하고, 실패 시 null 반환
 * (에러를 throw하지 않음)
 *
 * @param rawResponse - AI로부터 받은 원본 응답 텍스트
 * @param context - 에러 로깅용 컨텍스트
 * @returns 파싱된 JSON 객체 또는 null
 */
export function safeParseAiJsonResponse<T = unknown>(
  rawResponse: string,
  context: string = "AI Response"
): T | null {
  try {
    return parseAiJsonResponse<T>(rawResponse, context);
  } catch {
    return null;
  }
}
