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
- unit should be standardized: EA, BOX, mL, L, g, kg, etc.`;

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
  specification: string | null;
  quantity: number;
  unit: string;
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
}

// ── Internal: Gemini API call + JSON extraction ──

const GEMINI_MODEL = "gemini-2.5-flash-preview-04-17";

async function callGeminiAndParse(
  mimeType: string,
  base64Data: string,
): Promise<QuoteParseResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
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
  });

  const rawText = response.text ?? "";

  // JSON 추출 (마크다운 코드블록 대응)
  let jsonStr = rawText;
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  let parsed: ParsedQuoteDocument;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
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
