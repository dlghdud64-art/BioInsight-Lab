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

/**
 * 제품 사용 용도 설명 생성 (GPT 기반)
 */
export async function generateProductUsageDescription(
  productName: string,
  productDescription?: string,
  productCategory?: string,
  productSpecification?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // API 키가 없으면 기본 설명 반환
    return productDescription || "사용 용도 정보를 생성할 수 없습니다.";
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃

    const prompt = `다음 바이오·제약 제품에 대한 간결하고 실용적인 사용 용도 설명을 한국어로 작성해주세요.

제품명: ${productName}
${productCategory ? `카테고리: ${productCategory}` : ""}
${productDescription ? `설명: ${productDescription}` : ""}
${productSpecification ? `규격: ${productSpecification}` : ""}

요구사항:
- 2-3문장으로 간결하게 작성
- 실제 실험/연구에서 어떻게 사용되는지 구체적으로 설명
- 전문 용어는 그대로 사용하되, 일반 연구자도 이해할 수 있도록 작성
- 마케팅 문구나 과장된 표현은 피하고, 사실 기반으로 작성

사용 용도 설명만 반환하고 다른 설명은 하지 마세요.`;

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
            content: "당신은 바이오·제약 분야 제품의 사용 용도를 설명하는 전문가입니다. 제품 정보를 바탕으로 실용적이고 정확한 사용 용도 설명을 작성합니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 300,
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
    return data.choices[0].message.content.trim();
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다.");
    }
    console.error("Error generating product usage description:", error);
    throw error;
  }
}

// 번역 캐시
const translationCache = new Map<string, string>();
const TRANSLATION_CACHE_TTL = 1000 * 60 * 60 * 24; // 24시간

// 텍스트 번역
export async function translateText(
  text: string,
  fromLang: string = "ko",
  toLang: string = "en"
): Promise<string> {
  const cacheKey = `${fromLang}-${toLang}-${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // API 키가 없으면 원문 반환
    return text;
  }

  try {
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
            content: `You are a professional translator. Translate the following text from ${fromLang} to ${toLang}. Only return the translated text, no explanations.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error("Translation failed");
    }

    const data = await response.json();
    const translated = data.choices[0]?.message?.content?.trim() || text;
    
    translationCache.set(cacheKey, translated);
    return translated;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}