import { extractTextFromPDF } from "./pdf-parser";

// OpenAI API 키 확인
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY가 설정되지 않았습니다.");
}

/**
 * 견적서 PDF에서 추출된 정보 인터페이스
 */
export interface QuoteExtractionResult {
  items: Array<{
    productName?: string;
    catalogNumber?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    leadTime?: number; // 납기일 (일 단위)
    minOrderQty?: number; // 최소 주문량
    notes?: string;
  }>;
  vendorName?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  quoteDate?: string;
  validUntil?: string;
  totalAmount?: number;
  currency?: string;
  notes?: string;
  confidence: number; // 추출 신뢰도 (0-1)
}

/**
 * 견적서 PDF에서 제품 정보를 추출
 * @param pdfBuffer PDF 파일 버퍼
 * @returns 추출된 견적서 정보
 */
export async function extractQuoteFromPDF(pdfBuffer: Buffer): Promise<QuoteExtractionResult> {
  // PDF에서 텍스트 추출
  const pdfText = await extractTextFromPDF(pdfBuffer);
  
  // 텍스트 정리 (너무 긴 경우 앞부분만 사용)
  let cleanedText = pdfText;
  if (cleanedText.length > 15000) {
    cleanedText = cleanedText.substring(0, 15000) + "...";
  }

  // GPT로 견적서 정보 추출
  const systemPrompt = `You are an expert at extracting information from quote/quotation PDFs. 
Extract the following information from the provided text:
- Product items (product name, catalog number, quantity, unit price, total price, lead time, MOQ, notes)
- Vendor information (name, email, phone)
- Quote metadata (quote date, valid until date, total amount, currency, general notes)

Return the result as a JSON object with this structure:
{
  "items": [
    {
      "productName": "string (optional)",
      "catalogNumber": "string (optional)",
      "quantity": "number (optional)",
      "unitPrice": "number (optional)",
      "totalPrice": "number (optional)",
      "leadTime": "number (optional, in days)",
      "minOrderQty": "number (optional)",
      "notes": "string (optional)"
    }
  ],
  "vendorName": "string (optional)",
  "vendorEmail": "string (optional)",
  "vendorPhone": "string (optional)",
  "quoteDate": "string (optional, ISO date format)",
  "validUntil": "string (optional, ISO date format)",
  "totalAmount": "number (optional)",
  "currency": "string (optional, default: KRW)",
  "notes": "string (optional)",
  "confidence": "number (0-1, how confident you are in the extraction)"
}

If information is not found, use null or omit the field. Be accurate and only extract information that is clearly present in the text.`;

  const userPrompt = `Extract quote information from this PDF text:\n\n${cleanedText}`;

  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    const responseText = data.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("GPT 응답이 없습니다.");
    }

    const extracted = JSON.parse(responseText) as QuoteExtractionResult;
    
    // 기본값 설정
    if (!extracted.currency) {
      extracted.currency = "KRW";
    }
    if (extracted.confidence === undefined || extracted.confidence === null) {
      extracted.confidence = 0.7; // 기본 신뢰도
    }

    return extracted;
  } catch (error: any) {
    console.error("Error extracting quote from PDF:", error);
    throw new Error(`견적서 정보 추출에 실패했습니다: ${error.message}`);
  }
}

