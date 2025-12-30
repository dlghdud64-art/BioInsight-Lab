// MSDS/SDS에서 안전 취급 요약 자동 추출
import { parseAiJsonResponse } from "./json-cleaner";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface SafetySummary {
  hazardCodes?: string[];
  pictograms?: string[];
  storageCondition?: string;
  ppe?: string[];
  handlingPrecautions?: string;
  disposalMethod?: string;
  emergencyMeasures?: string;
  summary?: string;
}

/**
 * MSDS/SDS 텍스트에서 안전 정보 추출
 */
export async function extractSafetyInfoFromMSDS(msdsText: string): Promise<SafetySummary> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  // 텍스트가 너무 길면 앞부분만 사용 (MSDS는 보통 앞부분에 핵심 정보가 있음)
  const truncatedText = msdsText.slice(0, 20000);

  const prompt = `다음은 MSDS/SDS (Material Safety Data Sheet / Safety Data Sheet) 문서의 텍스트입니다. 
이 문서에서 안전 취급에 필요한 핵심 정보를 추출해주세요.

중요 지침:
1. 위험 코드 (Hazard Codes, 예: H314, H290)를 모두 추출하세요.
2. GHS 피크토그램 (예: corrosive, exclamation, skull, flame 등)을 추출하세요.
3. 보관 조건 (Storage conditions)을 추출하세요.
4. 개인보호장비 (PPE, Personal Protective Equipment)를 추출하세요.
5. 취급 시 주의사항을 요약하세요.
6. 폐기 방법을 추출하세요.
7. 응급 조치 방법을 요약하세요.

MSDS/SDS 텍스트:
${truncatedText}

다음 JSON 형식으로 응답해주세요:
{
  "hazardCodes": ["H314", "H290", ...],
  "pictograms": ["corrosive", "exclamation", ...],
  "storageCondition": "보관 조건 설명 (예: 2~8°C 냉장 보관, 빛을 피해 서늘한 곳에 보관)",
  "ppe": ["gloves", "goggles", "lab coat", ...],
  "handlingPrecautions": "취급 시 주의사항 요약",
  "disposalMethod": "폐기 방법",
  "emergencyMeasures": "응급 조치 요약",
  "summary": "전체 안전 취급 요약 (2-3문장)"
}

위험 코드와 피크토그램은 정확하게 추출하고, 보관 조건과 PPE는 한국어로 번역하여 제공하세요.
정보가 없는 필드는 null로 반환하세요.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 MSDS/SDS 문서를 분석하여 안전 취급 정보를 추출하는 전문가입니다. 문서에서 위험 코드, 피크토그램, 보관 조건, PPE, 취급 주의사항 등을 정확하게 추출합니다.\n\nIMPORTANT: Return raw JSON only. Do not use markdown formatting like ```json or ```. Do not include any explanatory text before or after the JSON. Your response must start with { and end with }.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "GPT API 호출 실패");
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("GPT 응답이 비어있습니다.");
    }

    // JSON 클리닝 및 파싱 (마크다운 코드블록 등 제거)
    const result = parseAiJsonResponse<SafetySummary>(
      content,
      "Safety Extractor"
    );
    return result;
  } catch (error) {
    console.error("Error extracting safety info from MSDS:", error);
    throw new Error("MSDS 분석에 실패했습니다.");
  }
}

/**
 * MSDS/SDS URL에서 텍스트 추출 (간단한 구현)
 * 실제로는 PDF 파싱 또는 웹 스크래핑이 필요
 */
export async function fetchMSDSText(url: string): Promise<string> {
  try {
    // URL이 PDF인 경우
    if (url.toLowerCase().endsWith(".pdf")) {
      // PDF 다운로드 및 파싱은 서버 사이드에서만 가능
      // 클라이언트에서는 에러 반환
      throw new Error("PDF 파싱은 서버 사이드에서만 가능합니다.");
    }

    // HTML 페이지인 경우 (간단한 텍스트 추출)
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch MSDS: ${response.status}`);
    }

    const html = await response.text();
    // 간단한 HTML 텍스트 추출 (실제로는 더 정교한 파싱 필요)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return text;
  } catch (error) {
    console.error("Error fetching MSDS text:", error);
    throw new Error("MSDS 문서를 가져올 수 없습니다.");
  }
}

