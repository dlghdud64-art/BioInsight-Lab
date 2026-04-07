/**
 * POST /api/ai/quote-compare
 *
 * 여러 공급업체 견적서 데이터를 비교 분석하여
 * 비교 테이블, 추천, 협상 가이드를 반환합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";

const SYSTEM_PROMPT = `당신은 연구실 구매팀의 전문 AI 협상가이자 데이터 분석가입니다.
사용자가 여러 공급업체의 견적서 데이터를 제공하면, 이를 비교 분석하여 표 형태의 데이터와 협상 가이드를 제공해야 합니다.

[분석 지시사항]
1. 각 견적서에서 '공급사명', '단가(VAT 제외)', '예상 납기일', '배송비'를 추출하여 비교 배열로 만드세요.
2. 가장 저렴한 견적과 가장 납기가 빠른 견적을 식별하세요.
3. 구매자가 공급사에게 가격이나 납기를 협상할 수 있는 구체적인 '네고 포인트' 1~2가지를 작성하세요.

[출력 형식 (JSON)]
반드시 아래 JSON 스키마를 준수하여 응답하십시오. 마크다운 코드 블록 없이 순수 JSON만 반환하십시오.
{
  "comparison": [
    {"vendor": "공급사명", "price": 숫자, "leadTime": "납기", "shippingFee": 숫자}
  ],
  "recommendation": "가장 추천하는 옵션 및 이유 요약",
  "negotiationGuide": "구체적인 협상 멘트 및 전략"
}`;

/** API 키 없을 때 로컬 fallback */
function buildLocalQuoteCompare(quotes: { vendor: string; items: string; rawText?: string }[]) {
  return {
    comparison: quotes.map((q) => ({
      vendor: q.vendor,
      price: "견적 확인 필요",
      leadTime: "확인 필요",
      shippingFee: "확인 필요",
    })),
    recommendation: `${quotes.length}개 공급사의 견적을 확보했습니다. 가격과 납기를 직접 비교하여 최적 공급사를 선정하세요. 동일 품목의 가격 차이가 10% 이상이면 가격 협상 여지가 있습니다.`,
    negotiationGuide: `1. 최저가 견적을 기준으로 타 공급사에 가격 매칭을 요청하세요.\n2. 대량 구매 시 추가 할인 가능성을 확인하세요.\n3. 납기 단축이 가능한지 확인하고, 긴급 납품 옵션의 추가 비용을 비교하세요.`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quotes } = body as { quotes: { vendor: string; items: string; rawText?: string }[] };

    if (!quotes || quotes.length < 2) {
      return NextResponse.json({ error: "2개 이상의 견적서 데이터가 필요합니다." }, { status: 400 });
    }

    // API 키 없으면 로컬 fallback
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: true, data: buildLocalQuoteCompare(quotes), fallback: true });
    }

    const userMessage = `다음 ${quotes.length}개 공급업체 견적서를 비교 분석해 주세요:\n${JSON.stringify(quotes, null, 2)}`;

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + userMessage }] }],
      config: { temperature: 0.2, maxOutputTokens: 2048 },
    });

    const rawText = response.text ?? "";
    let jsonStr = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error("[quote-compare] Error:", error);
    return NextResponse.json({ error: "AI 견적 비교 중 오류가 발생했습니다." }, { status: 500 });
  }
}
