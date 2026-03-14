/**
 * A-2. ClassificationProcessor — AI 문서 분류
 *
 * OpenAI JSON response_format으로 documentType + confidence 반환.
 * API 키 없거나 실패 시 fallback(키워드 기반) 사용.
 */

import type {
  ClassificationInput,
  ClassificationOutput,
  StageResult,
  IClassificationProcessor,
} from "../types";

const DOCUMENT_TYPES = [
  "VENDOR_QUOTE",
  "VENDOR_REPLY",
  "INVOICE",
  "TRANSACTION_STATEMENT",
  "PURCHASE_ORDER_DOCUMENT",
  "DELIVERY_UPDATE",
  "RECEIVING_DOCUMENT",
  "UNKNOWN",
] as const;

export class ClassificationProcessor implements IClassificationProcessor {
  readonly stage = "CLASSIFICATION" as const;

  async process(input: ClassificationInput): Promise<StageResult<ClassificationOutput>> {
    const start = Date.now();

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        const fallback = classifyByKeywords(input.rawText, input.filename);
        return {
          success: true,
          stage: this.stage,
          data: fallback,
          durationMs: Date.now() - start,
          continueToNext: true,
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: CLASSIFICATION_SYSTEM_PROMPT },
            { role: "user", content: buildClassificationUserPrompt(input) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 200,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI ${response.status}: ${JSON.stringify(errData)}`);
      }

      const data = await response.json();
      const content = JSON.parse(data.choices[0].message.content);

      const documentType = DOCUMENT_TYPES.includes(content.documentType)
        ? content.documentType
        : "UNKNOWN";
      const confidence = typeof content.confidence === "number"
        ? Math.max(0, Math.min(1, content.confidence))
        : 0.5;

      return {
        success: true,
        stage: this.stage,
        data: { documentType, confidence },
        durationMs: Date.now() - start,
        continueToNext: true,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);

      // AI 실패 시 키워드 fallback
      const fallback = classifyByKeywords(input.rawText, input.filename);
      return {
        success: true,
        stage: this.stage,
        data: fallback,
        error: `AI fallback used: ${errMsg}`,
        durationMs: Date.now() - start,
        continueToNext: true,
      };
    }
  }
}

const CLASSIFICATION_SYSTEM_PROMPT = `당신은 바이오·제약 B2B 구매 문서 분류 전문가입니다.
입력 텍스트를 분석하여 아래 JSON을 반환하세요:

{
  "documentType": "VENDOR_QUOTE" | "VENDOR_REPLY" | "INVOICE" | "TRANSACTION_STATEMENT" | "PURCHASE_ORDER_DOCUMENT" | "DELIVERY_UPDATE" | "RECEIVING_DOCUMENT" | "UNKNOWN",
  "confidence": 0.0 ~ 1.0,
  "reasoning": "분류 근거 한 줄"
}

분류 기준:
- VENDOR_QUOTE: 견적서, quotation, 단가표
- VENDOR_REPLY: 벤더 회신 이메일 (견적 응답, 납기 회신 등)
- INVOICE: 세금계산서, 인보이스, tax invoice
- TRANSACTION_STATEMENT: 거래명세서, 거래내역
- PURCHASE_ORDER_DOCUMENT: 발주서, PO, purchase order
- DELIVERY_UPDATE: 배송 안내, 출고 통보, 납기 변경
- RECEIVING_DOCUMENT: 입고 확인서, 수령증, 검수서
- UNKNOWN: 위 어디에도 해당하지 않음

확실하지 않으면 confidence를 낮추고 UNKNOWN을 반환하세요.
JSON만 반환하세요.`;

function buildClassificationUserPrompt(input: ClassificationInput): string {
  const parts: string[] = [];
  if (input.filename) parts.push(`파일명: ${input.filename}`);
  if (input.mimeType) parts.push(`MIME: ${input.mimeType}`);
  parts.push(`\n문서 내용 (처음 2000자):\n${input.rawText.slice(0, 2000)}`);
  return parts.join("\n");
}

function classifyByKeywords(
  rawText: string,
  filename?: string,
): ClassificationOutput {
  const text = `${filename || ""} ${rawText}`.toLowerCase();

  if (/견적서|quotation|단가표|quote/.test(text)) {
    return { documentType: "VENDOR_QUOTE", confidence: 0.7 };
  }
  if (/세금계산서|인보이스|tax invoice|invoice/.test(text)) {
    return { documentType: "INVOICE", confidence: 0.7 };
  }
  if (/거래명세서|transaction statement/.test(text)) {
    return { documentType: "TRANSACTION_STATEMENT", confidence: 0.7 };
  }
  if (/발주서|purchase order|po\s*#/.test(text)) {
    return { documentType: "PURCHASE_ORDER_DOCUMENT", confidence: 0.65 };
  }
  // 회신/Reply는 배송보다 먼저 체크 (이메일 회신에 납기 언급 빈번)
  if (/회신|reply|re:|답변|response/.test(text)) {
    return { documentType: "VENDOR_REPLY", confidence: 0.6 };
  }
  if (/배송|출고|납기|delivery|shipment/.test(text)) {
    return { documentType: "DELIVERY_UPDATE", confidence: 0.6 };
  }
  if (/입고|수령|검수|receiving/.test(text)) {
    return { documentType: "RECEIVING_DOCUMENT", confidence: 0.6 };
  }

  return { documentType: "UNKNOWN", confidence: 0.3 };
}
