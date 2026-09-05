/**
 * Gemini 멀티모달 견적서 파서
 *
 * 공급사 견적서(PDF / 이미지)를 Gemini 2.5 Flash에 직접 전송하여
 * 구조화된 JSON으로 품목별 단가/납기/조건을 추출합니다.
 *
 * - PDF: Buffer를 직접 base64로 변환하여 전송 (pdf-parse 텍스트 추출 불필요)
 * - 이미지: data URI에서 base64 추출하여 전송
 * - Gemini 2.5 Flash: 네이티브 PDF 이해, 테이블/레이아웃/이미지 인식
 */

import { callGeminiWithFallback } from "./gemini-config";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";

const QUOTE_PARSE_PROMPT = `You are a vendor quote document parser for a laboratory procurement system.
Analyze this vendor quote/quotation document (image or PDF page) and extract the following structured JSON.

Required JSON format:
{
  "vendor": {
    "name": "company/supplier name",
    "contactPerson": "sales rep name or null",
    "email": "contact email or null",
    "phone": "phone number or null"
  },
  "quoteNumber": "quotation/reference number or null",
  "quoteDate": "date in YYYY-MM-DD format or null",
  "validUntil": "validity/expiry date in YYYY-MM-DD or null",
  "currency": "KRW or USD or EUR etc. Default KRW if unclear",
  "items": [
    {
      "lineNumber": 1,
      "productName": "product/chemical/reagent name",
      "catalogNumber": "catalog/part number or null",
      "specification": "grade/purity/size or null",
      "quantity": 1,
      "unit": "EA or BOX or mL or g etc.",
      "lotNumber": "lot/batch number printed on the line, or null",
      "expiryDate": "expiry/use-by date in YYYY-MM-DD, or null",
      "unitPrice": 50000,
      "totalPrice": 50000,
      "leadTimeDays": 7,
      "notes": "special terms/conditions or null"
    }
  ],
  "subtotal": 50000,
  "vat": 5000,
  "totalAmount": 55000,
  "paymentTerms": "payment conditions or null",
  "deliveryTerms": "delivery conditions or null",
  "specialNotes": "any special notes or null"
}

Rules:
- Return ONLY valid JSON, no markdown, no explanation.
- If a field is not visible or unreadable, set it to null.
- For dates, always normalize to YYYY-MM-DD format.
- Prices must be numbers (not strings). Remove commas/currency symbols.
- If VAT is not explicitly shown, set vat to null.
- The document may be in English, Korean, Japanese, or mixed languages.
- Extract ALL line items, not just the first one.
- If leadTime is "2~3 weeks", convert to approximate days (e.g. 17).
- unit should be standardized: EA, BOX, mL, L, g, kg, etc.
- Delivery notes (거래명세서) often carry a Lot/Batch column and an expiry column per line.
  Put them in lotNumber / expiryDate. Do NOT fold them into notes.
- "specification" is the package size of ONE unit (e.g. "4 L", "500 mL", "50 EA").
  "quantity" is how many of those units. Keep them separate.
- "unit" is the unit that COUNTS quantity, not the unit inside specification.
  For "4 L 짜리 6개" → specification "4 L", quantity 6, unit "EA".
  NEVER copy the specification's unit into "unit" — "4 L" x "6 L" would read as 24 L.`;

import {
  describeParseFailure,
  stripCodeFence,
  type ParseFailure,
} from "./parse-failure";

// ── Response Types ──

export interface ParsedQuoteVendor {
  name: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
}

export interface ParsedQuoteLineItem {
  lineNumber: number;
  productName: string | null;
  catalogNumber: string | null;
  /** 1개의 포장 규격 — "4 L" · "500 mL" · "50 EA". quantity 와 다른 축이다. */
  specification: string | null;
  quantity: number;
  unit: string;
  /**
   * §scan-lot-slot (호영님 2026-09-05) — Lot/배치 번호.
   *
   * 🛑 자리를 만드는 것이 정답이다. 실측(2026-09-05): 자리가 없자 모델이
   *    `notes: "Lot No: MB2409A17, Expiry Date: 2029-03-31"` 로 밀어넣었다.
   *    그 문자열을 정규식으로 캐면 **임시 형식이 계약이 된다** — 다음에 모델이
   *    "LOT: … / EXP: …" 로 쓰면 조용히 null 이 되고 "Lot 인식 안 됨" 으로 오독한다.
   *    자리가 있는 필드(specification·catalogNumber)는 전부 정확히 들어왔다.
   *
   * optional 이 아니라 nullable 이다 — 견적서에는 대개 없고, 그때 null 이 정답이다.
   */
  lotNumber: string | null;
  /** §scan-lot-slot — 유효기간(YYYY-MM-DD). 위와 같은 이유로 자리를 만든다. */
  expiryDate: string | null;
  unitPrice: number;
  totalPrice: number;
  leadTimeDays: number | null;
  notes: string | null;
}

export interface ParsedQuoteDocument {
  vendor: ParsedQuoteVendor;
  quoteNumber: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  currency: string;
  items: ParsedQuoteLineItem[];
  subtotal: number | null;
  vat: number | null;
  totalAmount: number | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  specialNotes: string | null;
}

export interface QuoteParseResult {
  parsed: ParsedQuoteDocument;
  confidence: "high" | "medium" | "low";
  matchedFields: number;
  itemCount: number;
  rawText: string;
  /**
   * §ocr-parse-failure — 구조화에 **실패**했을 때의 사유. 성공이면 null.
   * 🛑 이게 없어서 "응답 잘림" 이 화면에 "0 품목 인식" 으로 나갔다(2026-09-05).
   *    빈 결과와 실패는 같은 모양이면 안 된다.
   */
  parseFailure: ParseFailure | null;
}

// ── Internal: Gemini API call + JSON extraction ──
// §11.315 — 모델 ID 는 lib/ocr/gemini-config 에서 env-aware 로 주입(preview 폐기 대응).

async function callGeminiAndParse(
  mimeType: string,
  base64Data: string,
): Promise<QuoteParseResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // §11.315 — PRIMARY (env GEMINI_MODEL 또는 gemini-2.5-flash) + 404 시 FALLBACK 재시도.
  const response = await callGeminiWithFallback((model) =>
    ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: QUOTE_PARSE_PROMPT },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
    }),
  );

  const rawText = response.text ?? "";
  // §ocr-parse-failure — API 가 "왜 끝났는지" 를 말해준다. 안 읽으면 잘림이 인식 실패로 위장된다.
  const finishReason =
    (response as { candidates?: { finishReason?: string }[] }).candidates?.[0]?.finishReason ?? null;

  // JSON 추출 — 닫는 펜스를 **요구하지 않는다**(잘린 응답에서 매칭이 통째로 실패했다).
  const jsonStr = stripCodeFence(rawText);

  let parsed: ParsedQuoteDocument;
  let parseFailure: ParseFailure | null = null;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    // 🛑 값을 지어내지 않는다 — 빈 문서는 자리를 채우기 위한 것이고, **사유가 진짜 결과**다.
    parseFailure = describeParseFailure({ finishReason, rawText, error: err });
    parsed = {
      vendor: { name: null, contactPerson: null, email: null, phone: null },
      quoteNumber: null,
      quoteDate: null,
      validUntil: null,
      currency: "KRW",
      items: [],
      subtotal: null,
      vat: null,
      totalAmount: null,
      paymentTerms: null,
      deliveryTerms: null,
      specialNotes: null,
    };
  }

  // Confidence 계산
  const topFields = [
    parsed.vendor?.name,
    parsed.quoteNumber,
    parsed.quoteDate,
    parsed.currency,
    parsed.totalAmount,
  ].filter(Boolean).length;

  const itemFields = parsed.items?.length > 0
    ? parsed.items.reduce((sum, item) => {
        return sum + [item.productName, item.unitPrice, item.quantity].filter(Boolean).length;
      }, 0) / (parsed.items.length * 3)
    : 0;

  const matchedFields = topFields + Math.round(itemFields * 5);
  const confidence: "high" | "medium" | "low" =
    matchedFields >= 7 ? "high" : matchedFields >= 4 ? "medium" : "low";

  return {
    parsed,
    confidence,
    matchedFields,
    itemCount: parsed.items?.length ?? 0,
    rawText: jsonStr,
    parseFailure,
  };
}

/**
 * 견적서 이미지(data URI)를 Gemini 2.5 Flash로 파싱합니다.
 */
export async function parseQuoteWithGemini(imageBase64: string): Promise<QuoteParseResult> {
  const mimeMatch = imageBase64.match(/^data:(image\/\w+|application\/pdf);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, "");
  return callGeminiAndParse(mimeType, base64Data);
}

/**
 * 견적서 PDF Buffer를 Gemini 2.5 Flash에 직접 전송하여 파싱합니다.
 * pdf-parse 텍스트 추출 단계 없이 네이티브 PDF 이해.
 */
export async function parseQuotePDFWithGemini(pdfBuffer: Buffer): Promise<QuoteParseResult> {
  const base64Data = pdfBuffer.toString("base64");
  return callGeminiAndParse("application/pdf", base64Data);
}
