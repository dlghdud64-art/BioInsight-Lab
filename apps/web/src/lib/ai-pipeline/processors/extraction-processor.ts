/**
 * A-3. ExtractionProcessor — AI 필드 추출
 *
 * documentType별 프롬프트 분기, ExtractionResult JSON 생성.
 * field별 confidence 저장.
 */

import type {
  ExtractionInput,
  ExtractionOutput,
  ExtractionResult,
  ExtractedField,
  ExtractedLineItem,
  StageResult,
  IExtractionProcessor,
} from "../types";

function field<T>(value: T, confidence: number = 0.0): ExtractedField<T> {
  return { value, confidence };
}

const EMPTY_EXTRACTION: ExtractionResult = {
  documentDate: field(null),
  documentNumber: field(null),
  vendorName: field(null),
  vendorEmail: field(null),
  vendorPhone: field(null),
  vendorAddress: field(null),
  quoteNumber: field(null),
  orderNumber: field(null),
  invoiceNumber: field(null),
  poNumber: field(null),
  currency: field(null),
  subtotalAmount: field(null),
  taxAmount: field(null),
  totalAmount: field(null),
  deliveryDate: field(null),
  leadTime: field(null),
  lineItems: [],
  overallConfidence: 0,
  aiModel: "none",
  processingDurationMs: 0,
};

export class ExtractionProcessor implements IExtractionProcessor {
  readonly stage = "EXTRACTION" as const;

  async process(input: ExtractionInput): Promise<StageResult<ExtractionOutput>> {
    const start = Date.now();

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return {
          success: true,
          stage: this.stage,
          data: { extractionResult: { ...EMPTY_EXTRACTION, processingDurationMs: Date.now() - start } },
          error: "OpenAI API key not configured",
          durationMs: Date.now() - start,
          continueToNext: true,
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
            { role: "user", content: buildExtractionUserPrompt(input) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 2000,
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
      const usage = data.usage || {};

      const result = normalizeExtractionResult(content, Date.now() - start, usage);

      return {
        success: true,
        stage: this.stage,
        data: { extractionResult: result },
        durationMs: Date.now() - start,
        continueToNext: true,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        stage: this.stage,
        data: { extractionResult: { ...EMPTY_EXTRACTION, processingDurationMs: Date.now() - start } },
        error: errMsg,
        durationMs: Date.now() - start,
        continueToNext: true, // extraction 실패해도 linking 시도 가능 (빈 결과로)
      };
    }
  }
}

const EXTRACTION_SYSTEM_PROMPT = `당신은 바이오·제약 B2B 구매 문서에서 구조화된 데이터를 추출하는 전문가입니다.
입력 문서에서 아래 필드를 추출하여 JSON으로 반환하세요. 각 필드는 { "value": ..., "confidence": 0.0~1.0 } 형태입니다.
확인할 수 없는 필드는 { "value": null, "confidence": 0.0 }으로 반환하세요.

{
  "documentDate": { "value": "YYYY-MM-DD" or null, "confidence": number },
  "documentNumber": { "value": string or null, "confidence": number },
  "vendorName": { "value": string or null, "confidence": number },
  "vendorEmail": { "value": string or null, "confidence": number },
  "vendorPhone": { "value": string or null, "confidence": number },
  "vendorAddress": { "value": string or null, "confidence": number },
  "quoteNumber": { "value": string or null, "confidence": number },
  "orderNumber": { "value": string or null, "confidence": number },
  "invoiceNumber": { "value": string or null, "confidence": number },
  "poNumber": { "value": string or null, "confidence": number },
  "currency": { "value": "KRW"|"USD"|"EUR" or null, "confidence": number },
  "subtotalAmount": { "value": number or null, "confidence": number },
  "taxAmount": { "value": number or null, "confidence": number },
  "totalAmount": { "value": number or null, "confidence": number },
  "deliveryDate": { "value": "YYYY-MM-DD" or null, "confidence": number },
  "leadTime": { "value": string or null, "confidence": number },
  "lineItems": [
    {
      "itemName": { "value": string, "confidence": number },
      "itemCode": { "value": string or null, "confidence": number },
      "quantity": { "value": number or null, "confidence": number },
      "unitPrice": { "value": number or null, "confidence": number },
      "totalAmount": { "value": number or null, "confidence": number },
      "unit": { "value": string or null, "confidence": number },
      "leadTime": { "value": string or null, "confidence": number },
      "moq": { "value": number or null, "confidence": number }
    }
  ],
  "overallConfidence": number
}

금액은 숫자(콤마 제거), 날짜는 ISO 형식으로 정규화하세요.
JSON만 반환하세요.`;

function buildExtractionUserPrompt(input: ExtractionInput): string {
  return `문서 유형: ${input.documentType}\n\n문서 내용:\n${input.rawText.slice(0, 4000)}`;
}

function normalizeExtractionResult(
  raw: Record<string, unknown>,
  durationMs: number,
  usage: Record<string, number>,
): ExtractionResult {
  const f = (v: unknown): ExtractedField<string | null> => {
    if (v && typeof v === "object" && "value" in v) {
      const obj = v as Record<string, unknown>;
      return { value: obj.value as string | null, confidence: Number(obj.confidence) || 0 };
    }
    return field(null);
  };
  const fn = (v: unknown): ExtractedField<number | null> => {
    if (v && typeof v === "object" && "value" in v) {
      const obj = v as Record<string, unknown>;
      return { value: obj.value != null ? Number(obj.value) : null, confidence: Number(obj.confidence) || 0 };
    }
    return field(null);
  };

  const lineItems: ExtractedLineItem[] = Array.isArray(raw.lineItems)
    ? (raw.lineItems as Record<string, unknown>[]).map((li) => ({
        itemName: f(li.itemName) as ExtractedField<string>,
        itemCode: f(li.itemCode),
        quantity: fn(li.quantity),
        unitPrice: fn(li.unitPrice),
        totalAmount: fn(li.totalAmount),
        unit: f(li.unit),
        leadTime: f(li.leadTime),
        moq: fn(li.moq),
      }))
    : [];

  return {
    documentDate: f(raw.documentDate),
    documentNumber: f(raw.documentNumber),
    vendorName: f(raw.vendorName),
    vendorEmail: f(raw.vendorEmail),
    vendorPhone: f(raw.vendorPhone),
    vendorAddress: f(raw.vendorAddress),
    quoteNumber: f(raw.quoteNumber),
    orderNumber: f(raw.orderNumber),
    invoiceNumber: f(raw.invoiceNumber),
    poNumber: f(raw.poNumber),
    currency: f(raw.currency),
    subtotalAmount: fn(raw.subtotalAmount),
    taxAmount: fn(raw.taxAmount),
    totalAmount: fn(raw.totalAmount),
    deliveryDate: f(raw.deliveryDate),
    leadTime: f(raw.leadTime),
    lineItems,
    overallConfidence: typeof raw.overallConfidence === "number" ? raw.overallConfidence : 0.5,
    aiModel: "gpt-4o",
    processingDurationMs: durationMs,
    rawResponseTokens: (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
  };
}
