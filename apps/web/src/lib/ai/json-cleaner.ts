/**
 * AI 응답에서 순수 JSON만 추출하는 유틸리티
 *
 * LLM(GPT, Gemini 등)이 응답할 때 종종 마크다운 코드 블록이나
 * 잡다한 텍스트를 섞어서 보내는 문제를 해결합니다.
 *
 * 🛡️ Fail-safe 설계: indexOf/lastIndexOf 기반 정밀 추출
 */

/**
 * AI 응답에서 마크다운 코드 블록과 잡다한 텍스트를 제거하고
 * 순수한 JSON만 추출합니다.
 *
 * 🛡️ 3단계 방어:
 * 1. 마크다운 코드 블록 제거 (regex)
 * 2. indexOf/lastIndexOf로 JSON 경계 정밀 추출 (수술적 접근)
 * 3. 유효성 검증
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

  // ========================================
  // 1단계: 마크다운 코드 블록 제거 (regex)
  // ========================================
  const codeBlockPatterns = [
    /^```json\s*\n?([\s\S]*?)\n?```\s*$/i,
    /^```\s*\n?([\s\S]*?)\n?```\s*$/i,
    /```json\s*\n?([\s\S]*?)\n?```/i,
    /```\s*\n?([\s\S]*?)\n?```/i,
  ];

  for (const pattern of codeBlockPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      cleaned = match[1].trim();
      break;
    }
  }

  // ========================================
  // 2단계: indexOf/lastIndexOf 기반 정밀 JSON 추출
  // 🛡️ 수술적 접근: 첫 번째 '{' 또는 '['부터 마지막 '}' 또는 ']'까지
  // ========================================
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");

  // JSON 객체 ({...}) 또는 배열 ([...]) 중 먼저 시작하는 것 찾기
  let startIndex = -1;
  let endIndex = -1;
  let isObject = false;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    // JSON 객체가 먼저 시작
    startIndex = firstBrace;
    endIndex = lastBrace;
    isObject = true;
  } else if (firstBracket !== -1) {
    // JSON 배열이 먼저 시작
    startIndex = firstBracket;
    endIndex = lastBracket;
    isObject = false;
  }

  // JSON 경계 추출
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    cleaned = cleaned.substring(startIndex, endIndex + 1);
  }

  // ========================================
  // 3단계: 최종 정리 및 유효성 검증
  // ========================================
  cleaned = cleaned.trim();

  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    throw new Error(
      `유효한 JSON 형식이 아닙니다. 응답이 '{' 또는 '['로 시작하지 않습니다. ` +
      `원본 응답 시작: "${rawResponse.slice(0, 100)}..."`
    );
  }

  if (!cleaned.endsWith("}") && !cleaned.endsWith("]")) {
    throw new Error(
      `유효한 JSON 형식이 아닙니다. 응답이 '}' 또는 ']'로 끝나지 않습니다. ` +
      `원본 응답 끝: "...${rawResponse.slice(-100)}"`
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
