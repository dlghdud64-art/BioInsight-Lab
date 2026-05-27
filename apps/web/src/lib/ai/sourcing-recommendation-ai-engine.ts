/**
 * 구매 운영 (소싱) — 논문 기반 대체품 추천 AI 엔진
 *
 * 입력: 검색어 (논문명, 타겟 단백질, 화학물질명 등)
 * 출력: SourcingRecommendationResult (추천 제품 + 추천 사유)
 */

import {
  SOURCING_RECOMMEND_SYSTEM_PROMPT,
  type SourcingRecommendAiResponse,
  type SourcingRecommendProduct,
} from "./ai-prompt-registry";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export interface SourcingRecommendInput {
  /** 검색어 (예: "Nature 2023 anti-p53 DO-1 clone") */
  query: string;
  /** 현재 사용 중인 제품 정보 (있으면) */
  currentProduct?: {
    name: string;
    brand: string;
    catalogNumber: string;
    specification?: string;
  };
  /** 대체 사유 */
  reason?: "discontinued" | "long_lead_time" | "cost_reduction" | "paper_reference" | "other";
}

export interface SourcingRecommendationResult {
  success: boolean;
  response: SourcingRecommendAiResponse | null;
  /** 로컬 분석 (AI 미사용 시 fallback) */
  localAnalysis: {
    queryType: "paper" | "protein" | "chemical" | "general";
    extractedKeywords: string[];
    suggestedSearchTerms: string[];
  };
  error?: string;
}

// ══════════════════════════════════════════════════════════════
// Query Analysis (로컬 키워드 추출)
// ══════════════════════════════════════════════════════════════

/** 논문 참조 패턴 감지 */
const PAPER_PATTERNS = [
  /nature\s*\d{4}/i,
  /science\s*\d{4}/i,
  /cell\s*\d{4}/i,
  /lancet\s*\d{4}/i,
  /nejm\s*\d{4}/i,
  /doi[:\s]/i,
  /pmid[:\s]/i,
  /pubmed/i,
];

/** 단백질/항체 관련 키워드 */
const PROTEIN_KEYWORDS = [
  "antibody", "항체", "clone", "클론", "anti-", "receptor", "수용체",
  "kinase", "ligand", "enzyme", "효소", "protein", "단백질",
];

/** 화학물질 패턴 */
const CHEMICAL_PATTERNS = [
  /cas[\s-]*\d{2,7}-\d{2}-\d/i,
  /\d+\.?\d*\s*(mg|g|ml|l|mol|mmol)/i,
  /purity\s*[>≥]\s*\d+/i,
  /순도/,
  /grade/i,
];

export function analyzeQuery(query: string): SourcingRecommendationResult["localAnalysis"] {
  const q = query.toLowerCase().trim();
  const keywords: string[] = [];
  const searchTerms: string[] = [];

  // 논문 참조 감지
  const isPaper = PAPER_PATTERNS.some((p) => p.test(q));
  if (isPaper) {
    // 논문명에서 물질 키워드 추출
    const words = q.split(/[\s,;]+/).filter((w) => w.length > 2);
    keywords.push(...words.filter((w) => !["and", "the", "for", "with", "from"].includes(w)));
    searchTerms.push(query);
    searchTerms.push(...keywords.slice(0, 3).map((k) => `${k} alternative supplier`));
    return { queryType: "paper", extractedKeywords: keywords.slice(0, 5), suggestedSearchTerms: searchTerms.slice(0, 3) };
  }

  // 단백질/항체 감지
  const isProtein = PROTEIN_KEYWORDS.some((k) => q.includes(k.toLowerCase()));
  if (isProtein) {
    // 클론명, 타겟 추출
    const cloneMatch = q.match(/clone\s+([a-z0-9-]+)/i) || q.match(/클론\s+([a-z0-9-]+)/i);
    if (cloneMatch) keywords.push(`clone ${cloneMatch[1]}`);
    const antiMatch = q.match(/anti-([a-z0-9]+)/i);
    if (antiMatch) keywords.push(`anti-${antiMatch[1]}`);
    searchTerms.push(query);
    if (cloneMatch) searchTerms.push(`${cloneMatch[1]} clone antibody alternative`);
    return { queryType: "protein", extractedKeywords: keywords.slice(0, 5), suggestedSearchTerms: searchTerms.slice(0, 3) };
  }

  // 화학물질 감지
  const isChemical = CHEMICAL_PATTERNS.some((p) => p.test(q));
  if (isChemical) {
    const casMatch = q.match(/cas[\s-]*(\d{2,7}-\d{2}-\d)/i);
    if (casMatch) keywords.push(`CAS ${casMatch[1]}`);
    searchTerms.push(query);
    if (casMatch) searchTerms.push(`CAS ${casMatch[1]} supplier`);
    return { queryType: "chemical", extractedKeywords: keywords.slice(0, 5), suggestedSearchTerms: searchTerms.slice(0, 3) };
  }

  // 일반 검색
  const words = q.split(/[\s,;]+/).filter((w) => w.length > 2);
  keywords.push(...words.slice(0, 5));
  searchTerms.push(query);
  return { queryType: "general", extractedKeywords: keywords, suggestedSearchTerms: searchTerms };
}

// ══════════════════════════════════════════════════════════════
// AI 기반 추천 (서버사이드 API 호출용 유틸)
// ══════════════════════════════════════════════════════════════

/**
 * 대체품 추천 요청 메시지 빌드 (AI에 전달할 user prompt)
 */
export function buildSourcingRecommendUserPrompt(input: SourcingRecommendInput): string {
  const lines: string[] = [];

  // 검색 의도
  const reasonMap: Record<string, string> = {
    discontinued: "단종으로 인한 대체품 필요",
    long_lead_time: "긴 납기로 인한 대체품 필요",
    cost_reduction: "비용 절감을 위한 대체품 탐색",
    paper_reference: "논문에서 사용된 물질 검색",
    other: "기타 사유",
  };
  const reasonText = input.reason ? reasonMap[input.reason] || "대체품 추천 요청" : "대체품 추천 요청";
  lines.push(`[검색 의도] ${reasonText}`);
  lines.push(`[검색어] ${input.query}`);

  if (input.currentProduct) {
    lines.push("");
    lines.push("[현재 사용 제품]");
    lines.push(`- 제품명: ${input.currentProduct.name}`);
    lines.push(`- 브랜드: ${input.currentProduct.brand}`);
    lines.push(`- 카탈로그 번호: ${input.currentProduct.catalogNumber}`);
    if (input.currentProduct.specification) {
      lines.push(`- 스펙: ${input.currentProduct.specification}`);
    }
  }

  lines.push("");
  lines.push("위 정보를 바탕으로 최적의 대체 제품을 추천하고, 과학적 근거를 포함한 JSON을 반환해주세요.");

  return lines.join("\n");
}

/**
 * AI 응답 JSON 파싱
 */
export function parseSourcingRecommendResponse(raw: string): SourcingRecommendAiResponse | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as SourcingRecommendAiResponse;

    // 최소 유효성 검증
    if (typeof parsed.title !== "string" || !parsed.title) return null;
    if (typeof parsed.description !== "string") return null;
    if (!parsed.product || typeof parsed.product.name !== "string") return null;

    return parsed;
  } catch {
    return null;
  }
}

/**
 * 로컬 fallback 추천 결과 생성
 */
export function buildLocalSourcingRecommendation(input: SourcingRecommendInput): SourcingRecommendationResult {
  const localAnalysis = analyzeQuery(input.query);

  return {
    success: true,
    response: null, // AI 없이는 실제 제품 추천 불가
    localAnalysis,
  };
}

/**
 * 시스템 프롬프트 getter
 */
export function getSourcingRecommendSystemPrompt(): string {
  return SOURCING_RECOMMEND_SYSTEM_PROMPT;
}
