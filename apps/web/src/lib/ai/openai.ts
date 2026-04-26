/**
 * apps/web/src/lib/ai/openai.ts
 *
 * Filename retained for caller compatibility — every caller imports
 * from "@/lib/ai/openai", and Phase 3 of the Anthropic migration
 * (#α-F-followup-anthropic-migration, ADR §11.26) does NOT rename
 * the file to avoid touching ~12 import sites.
 *
 * Body migrated to Anthropic Messages API via lib/ai/anthropic.ts.
 * Only embeddings.ts (separate file) keeps OpenAI — Anthropic has
 * no embedding API, tracked as #α-F-followup-embedding-strategy.
 *
 * Functions in this file
 * ----------------------
 * - analyzeSearchIntent(query)       — JSON output (search intent classification)
 * - generateProductUsageDescription  — plain text (Korean usage description)
 * - translateText                    — plain text (translation)
 *
 * Each retains its v0 fallback semantics:
 * - no API key → fallback (analyzeSearchIntent uses keyword fallback,
 *   translateText returns original text, generateProductUsageDescription
 *   throws to let caller decide)
 * - non-OK response → fallback / throw
 * - parse error → fallback / throw
 *
 * The `OPENAI_API_KEY` env var name is also retained — Phase 3 swaps
 * the implementation to use ANTHROPIC_API_KEY at the wrapper layer.
 */

import {
  callAnthropicMessage,
  AnthropicKeyMissingError,
} from "@/lib/ai/anthropic";

// ──────────────────────────────────────────────────────────
// analyzeSearchIntent
// ──────────────────────────────────────────────────────────

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
const intentCache = new Map<
  string,
  { result: SearchIntentResult; timestamp: number }
>();
const CACHE_TTL = 1000 * 60 * 60; // 1시간

export async function analyzeSearchIntent(
  query: string,
): Promise<SearchIntentResult> {
  const cacheKey = query.toLowerCase().trim();
  const cached = intentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const systemPrompt = `당신은 바이오·제약 분야 제품 검색 의도를 분석하는 전문가입니다.
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

JSON만 반환하고 다른 설명은 하지 마세요.`;

  try {
    const r = await callAnthropicMessage({
      systemPrompt,
      userPrompt: `다음 검색어를 분석해주세요: "${query}"`,
      maxTokens: 500,
      temperature: 0.3,
      timeoutMs: 10_000,
    });

    let content: any;
    try {
      content = JSON.parse(r.content);
    } catch {
      const result = analyzeSearchIntentFallback(query);
      intentCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }

    const result: SearchIntentResult = {
      category: content.category || undefined,
      purpose: content.purpose || undefined,
      targetExperiment: content.targetExperiment || undefined,
      properties: Array.isArray(content.properties) ? content.properties : [],
      brandPreference: Array.isArray(content.brandPreference)
        ? content.brandPreference
        : [],
      priceRange: content.priceRange || undefined,
      suggestedFilters: Array.isArray(content.suggestedFilters)
        ? content.suggestedFilters
        : [],
    };

    intentCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  } catch (error) {
    if (error instanceof AnthropicKeyMissingError) {
      // No key → keyword fallback (silent — same behavior as v0)
    } else {
      console.error("Error analyzing search intent:", error);
    }
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

// ──────────────────────────────────────────────────────────
// generateProductUsageDescription
// ──────────────────────────────────────────────────────────

/**
 * 제품 사용 용도 설명 생성. 평문 한국어 응답.
 *
 * Throws on every error (including no-key) so the caller decides
 * how to surface it. Behavior matches the v0 OpenAI version.
 */
export async function generateProductUsageDescription(
  productName: string,
  productDescription?: string,
  productCategory?: string,
  productSpecification?: string,
): Promise<string> {
  const userPrompt = `다음 바이오·제약 제품에 대한 간결하고 실용적인 사용 용도 설명을 한국어로 작성해주세요.

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

  try {
    const r = await callAnthropicMessage({
      systemPrompt:
        "당신은 바이오·제약 분야 제품의 사용 용도를 설명하는 전문가입니다. 제품 정보를 바탕으로 실용적이고 정확한 사용 용도 설명을 작성합니다.",
      userPrompt,
      maxTokens: 300,
      temperature: 0.5,
      timeoutMs: 15_000,
    });
    return r.content.trim();
  } catch (error) {
    if (error instanceof AnthropicKeyMissingError) {
      // Match v0: return the existing description as the cheapest
      // fallback so the UI has SOMETHING to render.
      return (
        productDescription || "사용 용도 정보를 생성할 수 없습니다."
      );
    }
    console.error("Error generating product usage description:", error);
    throw error;
  }
}

// ──────────────────────────────────────────────────────────
// translateText
// ──────────────────────────────────────────────────────────

const translationCache = new Map<string, string>();
// const TRANSLATION_CACHE_TTL = 1000 * 60 * 60 * 24; // 24시간 — TTL 미적용 (v0 유지)

export async function translateText(
  text: string,
  fromLang: string = "ko",
  toLang: string = "en",
): Promise<string> {
  const cacheKey = `${fromLang}-${toLang}-${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const r = await callAnthropicMessage({
      systemPrompt: `You are a professional translator. Translate the following text from ${fromLang} to ${toLang}. Only return the translated text, no explanations.`,
      userPrompt: text,
      maxTokens: 1000,
      temperature: 0.3,
      timeoutMs: 15_000,
    });
    const translated = r.content.trim() || text;
    translationCache.set(cacheKey, translated);
    return translated;
  } catch (error) {
    if (!(error instanceof AnthropicKeyMissingError)) {
      console.error("Translation error:", error);
    }
    // Match v0: any error (including no-key) → return original.
    return text;
  }
}
