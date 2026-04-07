/**
 * Gemini 멀티모달 라벨 파서
 *
 * 이미지를 Gemini에 직접 전송하여 시약 라벨 정보를 구조화된 JSON으로 추출합니다.
 * OCR + 파싱을 단일 API 호출로 처리합니다.
 */

import type { LabelParseResult } from "./label-parser";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";

const PARSE_PROMPT = `You are a reagent label parser for a laboratory inventory system.
Analyze this reagent/chemical label image and extract the following fields as JSON.

Required JSON format:
{
  "brand": "manufacturer name (e.g. Sigma-Aldrich, Merck, Thermo Fisher)",
  "productName": "chemical/reagent name",
  "catalogNo": "catalog/product/reference number",
  "lotNo": "lot/batch number",
  "expirationDate": "expiration date in YYYY-MM-DD format (or YYYY-MM if day unknown)",
  "casNumber": "CAS registry number (format: XXXXX-XX-X)",
  "quantity": "amount with unit (e.g. 500g, 100mL)"
}

Rules:
- Return ONLY valid JSON, no markdown, no explanation.
- If a field is not visible or unreadable, set it to null.
- For dates, always normalize to YYYY-MM-DD or YYYY-MM format.
- For brand, use the official name (e.g. "Sigma-Aldrich" not "Sigma").
- The text on the label may be in English, Korean, Japanese, or mixed.`;

interface GeminiParseResponse {
  brand: string | null;
  productName: string | null;
  catalogNo: string | null;
  lotNo: string | null;
  expirationDate: string | null;
  casNumber: string | null;
  quantity: string | null;
}

/**
 * Gemini 멀티모달로 라벨 이미지를 파싱합니다.
 */
export async function parseWithGemini(imageBase64: string): Promise<LabelParseResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // data URI에서 순수 base64와 mime type 추출
  const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          { text: PARSE_PROMPT },
        ],
      },
    ],
    config: {
      temperature: 0.1,
      maxOutputTokens: 512,
    },
  });

  const rawText = response.text ?? "";

  // JSON 추출 (마크다운 코드블록 대응)
  let jsonStr = rawText;
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  let parsed: GeminiParseResponse;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // JSON 파싱 실패 시 빈 결과
    parsed = {
      brand: null,
      productName: null,
      catalogNo: null,
      lotNo: null,
      expirationDate: null,
      casNumber: null,
      quantity: null,
    };
  }

  const matchedFields = [
    parsed.catalogNo,
    parsed.lotNo,
    parsed.expirationDate,
    parsed.brand,
    parsed.productName,
    parsed.casNumber,
  ].filter(Boolean).length;

  const confidence: "high" | "medium" | "low" =
    matchedFields >= 4 ? "high" : matchedFields >= 2 ? "medium" : "low";

  return {
    catalogNo: parsed.catalogNo ?? null,
    lotNo: parsed.lotNo ?? null,
    expirationDate: parsed.expirationDate ?? null,
    brand: parsed.brand ?? null,
    productName: parsed.productName ?? null,
    casNumber: parsed.casNumber ?? null,
    quantity: parsed.quantity ?? null,
    rawText: jsonStr,
    confidence,
    matchedFields,
  };
}
