/**
 * Gemini 멀티모달 라벨 파서
 *
 * 이미지를 Gemini에 직접 전송하여 시약 라벨 정보를 구조화된 JSON으로 추출합니다.
 * OCR + 파싱을 단일 API 호출로 처리합니다.
 */

import type { LabelParseResult } from "./label-parser";
import { callGeminiWithFallback } from "./gemini-config";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";

const PARSE_PROMPT = `You are a reagent label parser for a laboratory inventory system.
Analyze this reagent/chemical label image and extract the following fields as JSON.

Required JSON format:
{
  "brand": "manufacturer name (e.g. Sigma-Aldrich, Merck, Thermo Fisher)",
  "productName": "chemical/reagent name",
  "catalogNo": "catalog/product/reference number",
  "lotNo": "lot/batch number (also labeled: Lot, Batch, Batch No.)",
  "expirationDate": "validity/expiration date in YYYY-MM-DD format (or YYYY-MM if day unknown)",
  "casNumber": "CAS registry number (format: XXXXX-XX-X)",
  "quantity": "amount with unit (e.g. 500g, 100mL)"
}

Rules:
- Return ONLY valid JSON, no markdown, no explanation.
- If a field is not visible or unreadable, set it to null.
- For dates, always normalize to YYYY-MM-DD or YYYY-MM format.
- For brand, use the official name (e.g. "Sigma-Aldrich" not "Sigma").
- The text on the label may be in English, Korean, Japanese, Spanish, or mixed.
- expirationDate = the validity/use-by date. Reagent labels rarely say "Expiration"
  literally — map ANY of these to expirationDate: "Exp", "Exp. Date", "Expiry",
  "Use By", "Best Before", "Valid Until", "Valid to", "Retest", "Retest Date",
  "Next Retest", "Cad." / "Caducidad" (Spanish), "유효기간", "유효기한", "사용기한".
  e.g. Condalab prints "NEXT RETEST: 2028/06" → expirationDate "2028-06".
  Sigma-Aldrich/Merck often print "Retest Date" or "Recommended Retest Date".
- Do NOT invent or guess a date. If no validity/retest/expiry date is printed, set expirationDate to null (never default to today).
- catalogNo = catalog/product/reference number. Thermo Fisher / Gibco / Invitrogen labels print this as "REF" (next to a barcode), also "Cat", "Cat. No.", "Catalog", "Catalog No.", "Product No.", "P/N". Map any of these to catalogNo.
- quantity = amount with unit. Also labeled "NET", "Net", "Net Wt", "Net Weight", "Content", "내용량". Forms like "477.5 g/pkg", "500 mL", "100 g" → quantity. Keep the unit.
- expirationDate may appear next to an hourglass pictogram (⧗ / a small hourglass icon) with NO "Exp" text — common on Gibco/Thermo. If a date sits beside an hourglass/calendar icon, treat it as expirationDate. A date beside a small factory/clock icon next to "LOT" is the manufacture date (NOT expiration) — do not map manufacture date to expirationDate.
- Read every visible field even if some are unclear; fill what you can read and set only truly-unreadable fields to null. Do NOT return all-null for a legible label.

Example (different product, for format only):
Label text: "Sigma-Aldrich  Sodium chloride  Cat No. S9888  Lot# SLBT1234  Retest 2027-05  500 g  CAS 7647-14-5"
→ {"brand":"Sigma-Aldrich","productName":"Sodium chloride","catalogNo":"S9888","lotNo":"SLBT1234","expirationDate":"2027-05","casNumber":"7647-14-5","quantity":"500 g"}`;

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
 * §label-scan-extraction — Gemini 응답에서 JSON 객체를 견고하게 추출.
 *   기존: ```json``` fence 만 처리 → unfenced/앞말("Here is…")/trailing 텍스트면
 *   JSON.parse(rawText) throw → silent catch → 전 필드 null(선명 라벨인데 빈 폼).
 *   개선: (1) fence 우선 (2) fence 없으면 첫 '{' ~ 마지막 '}' balanced 슬라이스.
 *   순수 함수 — unit test 로 회귀 고정(Gemini 호출 불요).
 */
export function extractLabelJsonString(raw: string): string | null {
  if (!raw) return null;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) return raw.slice(start, end + 1).trim();
  return null;
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

  // §11.315 — preview-04-17 폐기 → env-aware PRIMARY + 404 시 FALLBACK 재시도.
  const response = await callGeminiWithFallback((model) =>
    ai.models.generateContent({
      model,
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
    }),
  );

  const rawText = response.text ?? "";

  // §label-scan-extraction — 견고한 JSON 추출(fence/unfenced/앞말 대응).
  const jsonStr = extractLabelJsonString(rawText) ?? rawText;

  let parsed: GeminiParseResponse;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    // §label-scan-extraction — silent blank 제거: 실패 분해 로깅(rawText 가시화).
    //   다음 실제 스캔에서 OCR 실패(빈 응답) vs 파싱 실패(텍스트有) 즉시 판별.
    console.error(
      "[label-parser] JSON 파싱 실패 — Gemini rawText(앞 800자):",
      rawText.slice(0, 800),
      "| err:",
      (err as Error).message,
    );
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

  // §label-scan-extraction — valid JSON 인데 0필드(프롬프트/레이아웃 미스매치 H_C) 도 로깅.
  //   파싱은 됐는데 전부 null = 모델이 읽고도 매핑 못 함 → rawText 로 원인 확정.
  if (matchedFields === 0) {
    console.warn(
      "[label-parser] 0 필드 추출 — Gemini rawText(앞 800자):",
      rawText.slice(0, 800),
    );
  }

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
