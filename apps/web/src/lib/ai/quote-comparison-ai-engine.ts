/**
 * 견적 관리 — AI 견적서 비교 + 네고 포인트 추출 엔진
 *
 * 입력: 공급업체 견적서 데이터 (PDF/이미지 텍스트 or 구조화된 데이터)
 * 출력: QuoteComparisonAiResponse (비교 테이블 + 추천 + 협상 가이드)
 */

import {
  QUOTE_COMPARISON_SYSTEM_PROMPT,
  type QuoteComparisonAiResponse,
  type QuoteComparisonVendor,
} from "./ai-prompt-registry";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

/** 견적서 raw 입력 (PDF 파싱 또는 수동 입력) */
export interface QuoteRawInput {
  vendorName: string;
  /** 견적서 원문 텍스트 (PDF OCR / 이미지 OCR 결과) */
  rawText?: string;
  /** 구조화된 데이터 (이미 파싱된 경우) */
  parsedData?: {
    unitPrice: number;
    leadTime: string;
    shippingFee: number;
    currency?: string;
    validUntil?: string;
  };
}

export interface QuoteComparisonInput {
  productName: string;
  quantity: number;
  quotes: QuoteRawInput[];
}

export interface QuoteComparisonResult {
  success: boolean;
  response: QuoteComparisonAiResponse | null;
  /** 로컬 계산 결과 (AI 미사용 시 fallback) */
  localAnalysis: {
    cheapestVendor: string | null;
    fastestVendor: string | null;
    priceDiffPercent: number | null;
  };
  error?: string;
}

// ══════════════════════════════════════════════════════════════
// Local Analysis (AI 호출 전/없이도 동작하는 fallback)
// ══════════════════════════════════════════════════════════════

export function computeLocalQuoteAnalysis(vendors: QuoteComparisonVendor[]): QuoteComparisonResult["localAnalysis"] {
  if (vendors.length === 0) return { cheapestVendor: null, fastestVendor: null, priceDiffPercent: null };

  const sorted = [...vendors].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0];
  const mostExpensive = sorted[sorted.length - 1];

  // 납기 파싱 (숫자 추출)
  const parseLeadDays = (lt: string): number => {
    const num = parseInt(lt.replace(/[^0-9]/g, ""));
    if (lt.includes("주")) return num * 7;
    if (lt.includes("개월") || lt.includes("월")) return num * 30;
    return isNaN(num) ? 9999 : num;
  };

  const fastest = [...vendors].sort((a, b) => parseLeadDays(a.leadTime) - parseLeadDays(b.leadTime))[0];

  const priceDiff = mostExpensive.price > 0
    ? Math.round(((mostExpensive.price - cheapest.price) / mostExpensive.price) * 100)
    : null;

  return {
    cheapestVendor: cheapest.vendor,
    fastestVendor: fastest.vendor,
    priceDiffPercent: priceDiff,
  };
}

// ══════════════════════════════════════════════════════════════
// AI 기반 견적 비교 (서버사이드 API 호출용 유틸)
// ══════════════════════════════════════════════════════════════

/**
 * 견적 비교 요청 메시지 빌드 (AI에 전달할 user prompt)
 */
export function buildQuoteComparisonUserPrompt(input: QuoteComparisonInput): string {
  const lines: string[] = [
    `[비교 대상 제품] ${input.productName} (수량: ${input.quantity})`,
    "",
    "[견적서 데이터]",
  ];

  for (const q of input.quotes) {
    if (q.parsedData) {
      lines.push(`- ${q.vendorName}: 단가 ${q.parsedData.unitPrice.toLocaleString()}원, 납기 ${q.parsedData.leadTime}, 배송비 ${q.parsedData.shippingFee.toLocaleString()}원`);
    } else if (q.rawText) {
      lines.push(`--- ${q.vendorName} 견적서 원문 ---`);
      lines.push(q.rawText.slice(0, 2000)); // 토큰 절약
      lines.push("--- 끝 ---");
    }
  }

  lines.push("");
  lines.push("위 견적서들을 비교 분석하고, 네고 포인트를 포함한 JSON을 반환해주세요.");

  return lines.join("\n");
}

/**
 * AI 응답 JSON 파싱 (안전한 파싱 + 유효성 검증)
 */
export function parseQuoteComparisonResponse(raw: string): QuoteComparisonAiResponse | null {
  try {
    // JSON 블록 추출 (```json ... ``` 형태 대응)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as QuoteComparisonAiResponse;

    // 최소 유효성 검증
    if (!Array.isArray(parsed.comparison) || parsed.comparison.length === 0) return null;
    if (typeof parsed.recommendation !== "string") return null;
    if (typeof parsed.negotiationGuide !== "string") return null;

    return parsed;
  } catch {
    return null;
  }
}

/**
 * 구조화된 견적 데이터로 직접 비교 결과 생성 (AI 없이 로컬)
 */
export function buildLocalQuoteComparison(input: QuoteComparisonInput): QuoteComparisonResult {
  const vendors: QuoteComparisonVendor[] = input.quotes
    .filter((q) => q.parsedData)
    .map((q) => ({
      vendor: q.vendorName,
      price: q.parsedData!.unitPrice,
      leadTime: q.parsedData!.leadTime,
      shippingFee: q.parsedData!.shippingFee,
    }));

  if (vendors.length === 0) {
    return {
      success: false,
      response: null,
      localAnalysis: { cheapestVendor: null, fastestVendor: null, priceDiffPercent: null },
      error: "구조화된 견적 데이터가 없습니다.",
    };
  }

  const local = computeLocalQuoteAnalysis(vendors);

  // 로컬 분석 기반 추천/네고 포인트 자동 생성
  const cheapest = vendors.find((v) => v.vendor === local.cheapestVendor);
  const fastest = vendors.find((v) => v.vendor === local.fastestVendor);

  let recommendation = "";
  let negotiationGuide = "";

  if (cheapest && fastest && cheapest.vendor !== fastest.vendor) {
    recommendation = `가격 기준: ${cheapest.vendor} (${cheapest.price.toLocaleString()}원), 납기 기준: ${fastest.vendor} (${fastest.leadTime})`;
    negotiationGuide = `${cheapest.vendor}의 단가가 가장 저렴하지만, ${fastest.vendor}의 납기가 더 빠릅니다. ${fastest.vendor}에 ${cheapest.vendor}의 단가를 언급하며 가격 인하를 요청하거나, ${cheapest.vendor}에 납기 단축을 요청해보세요.`;
  } else if (cheapest) {
    recommendation = `${cheapest.vendor}가 가격과 납기 모두 가장 유리합니다.`;
    negotiationGuide = `${cheapest.vendor}가 최적 옵션이지만, 대량 구매 할인이나 장기 계약 조건으로 추가 협상 여지가 있습니다.`;
  }

  return {
    success: true,
    response: { comparison: vendors, recommendation, negotiationGuide },
    localAnalysis: local,
  };
}

/**
 * 시스템 프롬프트 getter (API Route에서 사용)
 */
export function getQuoteComparisonSystemPrompt(): string {
  return QUOTE_COMPARISON_SYSTEM_PROMPT;
}
