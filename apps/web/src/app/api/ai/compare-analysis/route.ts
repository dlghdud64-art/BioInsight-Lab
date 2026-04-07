/**
 * POST /api/ai/compare-analysis
 *
 * 선택된 비교 후보 제품들을 Gemini AI로 분석하여
 * 종합 의견, 3가지 시나리오, 개별 품목 분석을 반환합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";

interface ProductInput {
  id: string;
  name: string;
  brand?: string | null;
  catalogNumber?: string | null;
  specification?: string | null;
  price?: number | null;
  leadTime?: string | null;
}

const SYSTEM_PROMPT = `당신은 바이오/화학 연구실 및 기업의 구매 소싱을 최적화하는 'AI 구매 분석 전문가(AI Sourcing Analyst)'입니다. 사용자가 선택한 시약, 소모품, 기자재 목록을 분석하여 최적의 구매 전략을 제시해야 합니다.

# 작업 목적
사용자가 선택한 제품 목록을 바탕으로:
1) 종합적인 소싱 의견
2) 3가지 시나리오별 추천 전략
3) 개별 품목에 대한 예상 납기/비용 및 상태를 분석하여 JSON 형식으로 반환합니다.

# 분석 지침
1. 종합 의견 (aiSummary):
   - 선택된 품목들의 전반적인 수급 난이도, 예상되는 병목 현상(예: 해외 수입산 납기 지연), 비용 절감 가능성을 2~3문장으로 요약합니다.
2. 시나리오 분석 (scenarios):
   - 반드시 다음 3가지 시나리오를 제공: [비용 우선, 납기·가격 균형, 최단 납기]
   - 각 시나리오별로 어떤 공급사 조합이 유리한지, 트레이드오프를 설명합니다.
   - 3개 중 일반 상황에 가장 적합한 1개를 isRecommended: true로 설정합니다.
3. 개별 품목 분석 (productAnalysis):
   - 브랜드와 품목 특성을 기반으로 예상 비용과 예상 납기를 추정합니다.
   - 상태(status)는 다음 3가지 중 하나: "요청 가능" / "보류" / "제외"
   - 각 품목별로 상태 부여 이유를 짧은 코멘트로 작성합니다.

# 출력 형식
반드시 아래 JSON 스키마를 준수하여 응답하십시오. 마크다운 코드 블록 없이 순수 JSON만 반환하십시오.

{
  "aiSummary": "string (종합 분석 의견)",
  "scenarios": [
    {
      "type": "cost_first",
      "title": "비용 우선",
      "description": "string (시나리오 설명 및 기대 효과)",
      "isRecommended": boolean
    },
    {
      "type": "balanced",
      "title": "납기·가격 균형",
      "description": "string (시나리오 설명 및 기대 효과)",
      "isRecommended": boolean
    },
    {
      "type": "speed_first",
      "title": "최단 납기",
      "description": "string (시나리오 설명 및 기대 효과)",
      "isRecommended": boolean
    }
  ],
  "productAnalysis": [
    {
      "productId": "string",
      "estimatedPrice": "string (예: '45,500원')",
      "estimatedDelivery": "string (예: '2~3영업일')",
      "status": "요청 가능" | "보류" | "제외",
      "reason": "string"
    }
  ]
}`;

/** API 키 없을 때 로컬 fallback 분석 */
function buildLocalAnalysis(products: ProductInput[]) {
  const cheapest = products.reduce((a, b) =>
    (a.price ?? Infinity) < (b.price ?? Infinity) ? a : b
  );
  const fastest = products.find((p) => p.leadTime?.includes("1") || p.leadTime?.includes("2")) ?? products[0];

  return {
    aiSummary: `${products.length}개 제품을 비교한 결과, ${cheapest.name}이(가) 가장 경제적이며, ${fastest?.name || cheapest.name}이(가) 납기가 빠를 것으로 추정됩니다. 브랜드별 가격 편차와 납기를 종합 검토하시기 바랍니다.`,
    scenarios: [
      { type: "cost_first", title: "비용 우선", description: `${cheapest.name} (${cheapest.brand ?? "미상"})을 중심으로 발주 시 비용을 최소화할 수 있습니다.`, isRecommended: false },
      { type: "balanced", title: "납기·가격 균형", description: "가격과 납기를 종합 고려하여 균형 있는 공급사 조합을 추천합니다.", isRecommended: true },
      { type: "speed_first", title: "최단 납기", description: `${fastest?.name || "국내 재고 보유 품목"}을 우선 발주하여 최단 납기를 달성할 수 있습니다.`, isRecommended: false },
    ],
    productAnalysis: products.map((p) => ({
      productId: p.id,
      estimatedPrice: p.price ? `${p.price.toLocaleString()}원` : "가격 미확인",
      estimatedDelivery: p.leadTime ?? "납기 미확인",
      status: "요청 가능" as const,
      reason: `${p.brand ?? "미상"} 제품 — 견적 요청을 통해 정확한 조건을 확인하세요.`,
    })),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { products } = body as { products: ProductInput[] };

    if (!products || products.length < 1) {
      return NextResponse.json(
        { error: "분석할 제품이 필요합니다." },
        { status: 400 }
      );
    }

    // 최대 5개 제한
    const capped = products.slice(0, 5);

    // API 키 없으면 로컬 fallback
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: true, data: buildLocalAnalysis(capped), fallback: true });
    }

    const userMessage = `다음 ${capped.length}개 제품을 분석해 주세요:\n${JSON.stringify(
      capped.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand ?? "미상",
        catNo: p.catalogNumber ?? "N/A",
        spec: p.specification ?? "",
        price: p.price ? `${p.price.toLocaleString()}원` : "가격 미확인",
        leadTime: p.leadTime ?? "납기 미확인",
      })),
      null,
      2
    )}`;

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + userMessage }] },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });

    const rawText = response.text ?? "";

    // JSON 추출 (마크다운 코드블록 대응)
    let jsonStr = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error("[compare-analysis] Error:", error);
    return NextResponse.json(
      { error: "AI 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
