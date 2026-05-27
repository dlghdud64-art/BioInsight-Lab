/**
 * Claude (Anthropic) 기반 견적서 정밀 분석
 * - 깨진 텍스트도 찰떡같이 이해
 * - 가격, 캣넘버, 납기일 자동 추출
 * - 순수 숫자로 변환 (기호 제거)
 * - 구조화 진단 로깅 (requestId 기반)
 *
 * Phase 5 of #α-F-followup-anthropic-migration (ADR §11.26):
 * migrated from gpt-4o direct fetch to claude-haiku-4-5-20251001 via
 * lib/ai/anthropic.ts. Pipeline metering (logPipelineStage) preserved
 * verbatim — model field reports ANTHROPIC_DEFAULT_MODEL. Manual
 * markdown-codeblock unwrapping kept since the wrapper returns plain
 * text content (no response_format json_object on Anthropic).
 */

import {
  logPipelineStage,
  createRequestId,
  type PipelineErrorCode,
} from "./pipeline-logger";
import {
  callAnthropicMessage,
  AnthropicKeyMissingError,
  AnthropicHttpError,
  AnthropicEmptyContentError,
  ANTHROPIC_DEFAULT_MODEL,
} from "@/lib/ai/anthropic";

// GPT-4가 반환하는 원본 타입 (문자열 가능)
interface RawQuoteItem {
  name: string;
  catalogNumber: string | null;
  price: string | number | null;
  leadTime: string | null;
  quantity: string | number | null;
  unit: string | null;
}

// 최종 변환된 타입 (숫자만)
interface QuoteItem {
  name: string;
  catalogNumber: string | null;
  price: number | null;
  leadTime: string | null;
  quantity: number | null;
  unit: string | null;
}

// GPT-4 응답 원본 타입
interface RawQuoteParseResult {
  vendor: string;
  items: RawQuoteItem[];
  totalAmount: string | number | null;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
}

// 최종 결과 타입
interface QuoteParseResult {
  vendor: string;
  items: QuoteItem[];
  totalAmount: number | null;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
  rawText?: string; // 디버깅용
}

/**
 * LLM 에러 분류 — Anthropic 마이그레이션 후 버전.
 */
function classifyLlmError(
  error: unknown,
  statusCode?: number
): { errorCode: PipelineErrorCode; message: string } {
  const msg =
    error instanceof Error ? error.message : String(error ?? "unknown");

  if (error instanceof AnthropicKeyMissingError) {
    return { errorCode: "LLM_AUTH_MISSING", message: "ANTHROPIC_API_KEY not configured" };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { errorCode: "LLM_AUTH_MISSING", message: "ANTHROPIC_API_KEY not configured" };
  }
  const status =
    statusCode ?? (error instanceof AnthropicHttpError ? error.status : undefined);
  if (status === 401 || status === 403) {
    return { errorCode: "LLM_AUTH_FAILED", message: msg };
  }
  if (status === 404 || /model.*not found/i.test(msg)) {
    return { errorCode: "LLM_MODEL_ERROR", message: msg };
  }
  if (
    /timeout|ETIMEDOUT|ECONNABORTED|aborted/i.test(msg) ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return { errorCode: "LLM_TIMEOUT", message: msg };
  }
  if (error instanceof AnthropicEmptyContentError) {
    return { errorCode: "LLM_PARSE_ERROR", message: msg };
  }
  return { errorCode: "LLM_PARSE_ERROR", message: msg };
}

/**
 * OpenAI GPT-4로 견적서 분석
 */
export async function parseQuoteWithAI(
  extractedText: string,
  requestId?: string
): Promise<QuoteParseResult> {
  const reqId = requestId ?? createRequestId();

  if (!process.env.ANTHROPIC_API_KEY) {
    logPipelineStage({
      stage: "llm_request_failed",
      requestId: reqId,
      timestamp: new Date().toISOString(),
      errorCode: "LLM_AUTH_MISSING",
      errorMessage: "ANTHROPIC_API_KEY is not configured",
    });
    throw new Error('AI API 키가 설정되지 않았습니다.');
  }

  const prompt = `너는 바이오 연구용품 견적서 전문 AI야.
아래 텍스트는 PDF에서 추출한 견적서 내용인데, 레이아웃이 깨져 있을 수 있어.
하지만 너는 찰떡같이 알아듣고, 아래 정보를 JSON으로 정확하게 추출해야 해:

**추출할 정보:**
1. **vendor** (공급사 이름): 회사명을 찾아. 없으면 "Unknown"
2. **items** (제품 리스트): 배열로 반환
   - name: 제품명
   - catalogNumber: 카탈로그 번호 (Cat#, Part#, Model# 등)
   - price: 가격 (숫자만, ₩ , 원 같은 기호 제거)
   - leadTime: 납기일 (예: "3-5일", "1주", 있으면)
   - quantity: 수량 (숫자만)
   - unit: 단위 (EA, BOX, SET 등)
3. **totalAmount**: 총 금액 (숫자만)
4. **currency**: 통화 ("KRW", "USD" 등)
5. **confidence**: 추출 신뢰도 ("high", "medium", "low")

**중요 규칙:**
- 가격은 반드시 순수 숫자(Integer)로 변환해. 예: "₩150,000원" → 150000
- catalogNumber가 없으면 null
- leadTime이 없으면 null
- 여러 제품이 있으면 모두 추출
- JSON만 반환하고 다른 설명 붙이지 마

**입력 텍스트:**
${extractedText}

**응답 형식:**
\`\`\`json
{
  "vendor": "공급사명",
  "items": [
    {
      "name": "제품명",
      "catalogNumber": "CAT-123",
      "price": 150000,
      "leadTime": "3-5일",
      "quantity": 1,
      "unit": "EA"
    }
  ],
  "totalAmount": 150000,
  "currency": "KRW",
  "confidence": "high"
}
\`\`\``;

  logPipelineStage({
    stage: "llm_request_started",
    requestId: reqId,
    timestamp: new Date().toISOString(),
    model: ANTHROPIC_DEFAULT_MODEL,
    textLength: extractedText.length,
  });

  const llmStart = Date.now();

  try {
    let r;
    try {
      r = await callAnthropicMessage({
        systemPrompt:
          '너는 바이오 연구용품 견적서 분석 전문 AI다. 깨진 텍스트에서도 정확한 정보를 추출한다.',
        userPrompt: prompt,
        maxTokens: 2000,
        temperature: 0.1, // 낮은 온도로 일관성 확보
        timeoutMs: 30_000,
      });
    } catch (httpErr) {
      const { errorCode, message } = classifyLlmError(
        httpErr,
        httpErr instanceof AnthropicHttpError ? httpErr.status : undefined
      );

      logPipelineStage({
        stage: "llm_request_failed",
        requestId: reqId,
        timestamp: new Date().toISOString(),
        errorCode,
        errorMessage:
          httpErr instanceof AnthropicHttpError
            ? `HTTP ${httpErr.status}: ${httpErr.bodyText.slice(0, 200) || "unknown"}`
            : message,
        model: ANTHROPIC_DEFAULT_MODEL,
        durationMs: Date.now() - llmStart,
      });

      throw httpErr instanceof Error
        ? httpErr
        : new Error(`LLM API 호출 실패`);
    }

    logPipelineStage({
      stage: "llm_response_received",
      requestId: reqId,
      timestamp: new Date().toISOString(),
      model: r.model || ANTHROPIC_DEFAULT_MODEL,
      durationMs: Date.now() - llmStart,
    });

    // JSON 추출 (코드 블록 제거) — Anthropic은 response_format 미지원이라
    // 모델이 ```json ... ``` 래핑을 붙여올 가능성을 v0와 동일하게 방어한다.
    let jsonText = r.content.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    let rawParsed: RawQuoteParseResult;
    try {
      rawParsed = JSON.parse(jsonText);
    } catch (parseErr) {
      logPipelineStage({
        stage: "schema_validation",
        requestId: reqId,
        timestamp: new Date().toISOString(),
        errorCode: "LLM_PARSE_ERROR",
        errorMessage: `JSON parse failed: ${parseErr instanceof Error ? parseErr.message : "unknown"}`,
      });
      throw new Error("AI 응답 JSON 파싱 실패");
    }

    logPipelineStage({
      stage: "schema_validation",
      requestId: reqId,
      timestamp: new Date().toISOString(),
      vendor: rawParsed.vendor,
      itemCount: rawParsed.items?.length ?? 0,
      confidence: rawParsed.confidence,
    });

    // 가격 숫자 변환 (문자열 → 숫자)
    const normalizedItems: QuoteItem[] = rawParsed.items.map((item) => ({
      ...item,
      price:
        typeof item.price === 'string'
          ? parseInt(item.price.replace(/[^0-9]/g, ''), 10) || null
          : item.price,
      quantity:
        typeof item.quantity === 'string'
          ? parseInt(item.quantity.replace(/[^0-9]/g, ''), 10) || null
          : item.quantity,
    }));

    const normalizedTotalAmount =
      typeof rawParsed.totalAmount === 'string'
        ? parseInt(rawParsed.totalAmount.replace(/[^0-9]/g, ''), 10) || null
        : rawParsed.totalAmount;

    const parsed: QuoteParseResult = {
      vendor: rawParsed.vendor,
      items: normalizedItems,
      totalAmount: normalizedTotalAmount,
      currency: rawParsed.currency,
      confidence: rawParsed.confidence,
    };

    console.log('[AI Parser] Success:', {
      vendor: parsed.vendor,
      itemCount: parsed.items?.length || 0,
      confidence: parsed.confidence,
    });

    return {
      ...parsed,
      rawText: extractedText.slice(0, 500), // 디버깅용 (처음 500자만)
    };
  } catch (error) {
    const { errorCode, message } = classifyLlmError(error);

    logPipelineStage({
      stage: "llm_request_failed",
      requestId: reqId,
      timestamp: new Date().toISOString(),
      errorCode,
      errorMessage: message,
      model: ANTHROPIC_DEFAULT_MODEL,
      durationMs: Date.now() - llmStart,
    });

    console.error('[AI Parser] Error:', error);
    throw new Error(
      `AI 분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    );
  }
}
