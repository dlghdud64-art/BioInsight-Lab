// OpenAI API 클라이언트 유틸리티

export interface SearchIntentResult {
  category?: "REAGENT" | "TOOL" | "EQUIPMENT";
  purpose?: string;
  targetExperiment?: string;
  properties?: string[];
  brandPreference?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  suggestedFilters?: string[];
}

// 간단한 메모리 캐시 (프로덕션에서는 Redis 등 사용 권장)
const intentCache = new Map<string, { result: SearchIntentResult; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1시간

export async function analyzeSearchIntent(
  query: string
): Promise<SearchIntentResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  // 캐시 확인
  const cacheKey = query.toLowerCase().trim();
  const cached = intentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  if (!apiKey) {
    // API 키가 없으면 기본 키워드 기반 분류
    const result = analyzeSearchIntentFallback(query);
    intentCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `당신은 바이오·제약 분야 제품 검색 의도를 분석하는 전문가입니다. 
사용자의 검색 쿼리를 분석하여 다음 정보를 JSON 형식으로 반환하세요:

{
  "category": "REAGENT" | "TOOL" | "EQUIPMENT" | null,
  "purpose": "검색 목적 (예: ELISA, PCR, 세포배양, 단백질 정제 등)",
  "targetExperiment": "타깃 실험 (예: Western blot, qPCR, Flow cytometry 등)",
  "properties": ["주요 물성/스펙 키워드 배열"],
  "brandPreference": ["선호 브랜드 배열 (있는 경우)"],
  "priceRange": {"min": 숫자, "max": 숫자} 또는 null,
  "suggestedFilters": ["추천 필터 태그 배열"]
}

중요:
- category는 REAGENT(시약), TOOL(기구), EQUIPMENT(장비) 중 하나만 선택하거나 null
- properties는 검색어에서 추출한 주요 스펙/물성 키워드 (예: ["고순도", "무균", "96-well"])
- suggestedFilters는 사용자가 클릭할 수 있는 필터 태그 (예: ["ELISA kit", "PCR Master Mix"])
- 불확실한 정보는 null 또는 빈 배열로 반환

JSON만 반환하고 다른 설명은 하지 마세요.`,
          },
          {
            role: "user",
            content: `다음 검색어를 분석해주세요: "${query}"`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);

    const result: SearchIntentResult = {
      category: content.category || null,
      purpose: content.purpose || null,
      targetExperiment: content.targetExperiment || null,
      properties: Array.isArray(content.properties) ? content.properties : [],
      brandPreference: Array.isArray(content.brandPreference) ? content.brandPreference : [],
      priceRange: content.priceRange || null,
      suggestedFilters: Array.isArray(content.suggestedFilters) ? content.suggestedFilters : [],
    };

    // 캐시 저장
    intentCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error("OpenAI API timeout");
    } else {
      console.error("Error analyzing search intent with OpenAI:", error);
    }
    // 에러 발생 시 폴백 사용
    const result = analyzeSearchIntentFallback(query);
    intentCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  }
}

function analyzeSearchIntentFallback(query: string): SearchIntentResult {
  const queryLower = query.toLowerCase();
  const result: SearchIntentResult = {
    properties: [],
    brandPreference: [],
    suggestedFilters: [],
  };

  // 카테고리 분류
  if (
    queryLower.includes("elisa") ||
    queryLower.includes("kit") ||
    queryLower.includes("시약") ||
    queryLower.includes("reagent")
  ) {
    result.category = "REAGENT";
    result.purpose = "ELISA";
    result.suggestedFilters = ["ELISA kit", "96 well plate"];
  } else if (
    queryLower.includes("플라스크") ||
    queryLower.includes("flask") ||
    queryLower.includes("기구") ||
    queryLower.includes("tube")
  ) {
    result.category = "TOOL";
    result.purpose = "세포배양";
    result.suggestedFilters = ["세포배양 플라스크"];
  } else if (
    queryLower.includes("pcr") ||
    queryLower.includes("시약") ||
    queryLower.includes("master mix")
  ) {
    result.category = "REAGENT";
    result.purpose = "PCR";
    result.suggestedFilters = ["PCR kit", "Master Mix"];
  } else if (
    queryLower.includes("장비") ||
    queryLower.includes("equipment") ||
    queryLower.includes("machine") ||
    queryLower.includes("system")
  ) {
    result.category = "EQUIPMENT";
  }

  return result;
}

// 번역 캐시
const translationCache = new Map<string, string>();
const TRANSLATION_CACHE_TTL = 1000 * 60 * 60 * 24; // 24시간

export async function translateText(
  text: string,
  sourceLang: string = "en",
  targetLang: string = "ko"
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!text || text.trim().length === 0) {
    return text;
  }

  // 캐시 확인
  const cacheKey = `${sourceLang}:${targetLang}:${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (!apiKey) {
    // API 키가 없으면 기본 번역 (실제로는 번역 없음)
    const result = sourceLang === "en" && targetLang === "ko" 
      ? `[번역 필요] ${text}`
      : text;
    translationCache.set(cacheKey, result);
    return result;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃

    const langNames: Record<string, string> = {
      ko: "한국어",
      en: "영어",
      ja: "일본어",
      zh: "중국어",
    };

    const sourceLangName = langNames[sourceLang] || sourceLang;
    const targetLangName = langNames[targetLang] || targetLang;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `당신은 바이오·제약 분야 전문 번역가입니다. 
다음 원칙을 따라 정확하게 번역해주세요:
1. 전문 용어는 표준 번역어를 사용하세요 (예: "ELISA kit" → "ELISA 키트")
2. 제품명, 브랜드명은 원문을 유지하되 괄호로 번역을 추가할 수 있습니다
3. 기술적 정확성을 유지하면서 자연스러운 문장으로 번역하세요
4. 숫자, 단위, 화학식은 그대로 유지하세요
5. 원문의 의미를 정확히 전달하세요`,
          },
          {
            role: "user",
            content: `다음 텍스트를 ${sourceLangName}에서 ${targetLangName}로 번역해주세요:\n\n${text}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    const translated = data.choices[0].message.content.trim();

    // 캐시 저장
    translationCache.set(cacheKey, translated);

    return translated;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error("OpenAI API translation timeout");
    } else {
      console.error("Error translating text with OpenAI:", error);
    }
    // 에러 발생 시 원문 반환
    const result = `[번역 오류] ${text}`;
    translationCache.set(cacheKey, result);
    return result;
  }
}

