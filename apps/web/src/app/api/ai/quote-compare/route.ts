/**
 * POST /api/ai/quote-compare  (§10 견적 비교 백엔드 + 숫자 세부표 v1)
 *
 * 견적 관리 화면(dashboard/quotes)의 "AI 견적 비교" CTA(runAiQuoteCompare) 엔드포인트.
 *
 * 입력(프론트 계약, page.tsx runAiQuoteCompare):
 *   { quotes: Array<{ vendor; items; rawText; totalPrice: number | null }> }  // 최대 5
 *     totalPrice = 해당 견적 회신 최저 totalPrice(canonical). 없으면 null(미수집).
 * 출력(모달 consumer 계약, aiCompareResult shape):
 *   { success, data: { comparison: Array<{ vendor; price; leadTime; shippingFee;
 *                                          totalPrice; rank; score; recommended }>,
 *                      recommendation, negotiationGuide } }
 *
 * canonical truth 보호(§11.318 정합):
 *   숫자 비교 축은 canonical 총액(totalPrice) 하나뿐. 단가·납기·최소주문(moq)은 데이터
 *   모델에 없으므로 AI 로 추정하지 않는다("미수집" 표기). 순위/점수/추천은 총액으로
 *   결정론적으로 계산하고, 정성 텍스트(추천·협상)만 Gemini 가 생성한다.
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";

interface QuoteCompareInput {
  vendor: string;
  items: string;
  rawText: string;
  totalPrice?: number | null;
}

interface CompareRow {
  vendor: string;
  price: string;
  leadTime: string;
  shippingFee: string;
  totalPrice: number | null;
  rank: number | null;
  score: number | null;
  recommended: boolean;
}

interface QuoteCompareData {
  comparison: CompareRow[];
  recommendation: string;
  negotiationGuide: string;
}

const SYSTEM_PROMPT = `당신은 바이오/화학 연구실의 구매 견적을 비교 분석하는 'AI 구매 분석가'입니다.
사용자가 여러 공급사의 견적 후보(공급사명 + 요청 품목 + 예상 총액)를 제시하면, 발주 담당자가 다음 행동을 정할 수 있도록 분석합니다.

# 작업 목적
1) 종합 추천(recommendation): 어느 공급사를 우선 고려하고 무엇을 확인해야 하는지 2~3문장으로 요약합니다. 총액이 제공된 경우 최저 총액 공급사를 우선 언급하되, 단가·납기 등 미확정 조건 확인 필요성도 덧붙입니다.
2) 협상 포인트(negotiationGuide): 단가 인하·납기 단축·MOQ 조정 등 협상 레버 2~3개를 줄바꿈으로 구분해 제시합니다.

# 절대 규칙 (canonical truth 보호)
- 예상 총액 외의 숫자(단가/납기/배송비/MOQ)는 주어지지 않았습니다. 임의로 숫자를 만들어 내지 마십시오.
- 총액이 주어지지 않은 공급사는 "견적 확인 필요"로 다루고, 회신 확보가 우선임을 반영합니다.

# 출력 형식
마크다운 코드 블록 없이 순수 JSON 만 반환하십시오.
{
  "recommendation": "string (종합 추천, 2~3문장)",
  "negotiationGuide": "string (협상 포인트 2~3개, 줄바꿈 구분)"
}`;

/**
 * canonical 총액(totalPrice)으로 순위/가격점수/추천을 결정론적으로 계산.
 * 단가/납기/배송비는 데이터 부재 → "미수집"/"견적 확인 필요"(환각 0).
 *   - 순위: 유효 총액(>0) asc. 총액 없으면 rank null.
 *   - 가격 점수: 최저가=100, 최고가=60 (단일축 60~100 선형). 단일/동일가=100.
 *   - 추천: rank === 1.
 */
function buildComparisonRows(quotes: QuoteCompareInput[]): CompareRow[] {
  const totals = quotes.map((q) =>
    typeof q.totalPrice === "number" && q.totalPrice > 0 ? q.totalPrice : null,
  );
  const valid = totals.filter((t): t is number => t !== null);
  const minT = valid.length ? Math.min(...valid) : 0;
  const maxT = valid.length ? Math.max(...valid) : 0;

  // 순위 맵: 유효 총액만 asc 정렬해 1-base 순위 부여.
  const rankMap = new Map<number, number>();
  totals
    .map((t, i) => ({ i, t }))
    .filter((x): x is { i: number; t: number } => x.t !== null)
    .sort((a, b) => a.t - b.t)
    .forEach((x, idx) => rankMap.set(x.i, idx + 1));

  return quotes.map((q, i) => {
    const t = totals[i];
    let score: number | null = null;
    if (t !== null) {
      score = maxT === minT ? 100 : Math.round(((maxT - t) / (maxT - minT)) * 40 + 60);
    }
    const rank = rankMap.get(i) ?? null;
    return {
      vendor: q.vendor || "미지정 공급사",
      price: t !== null ? `₩${t.toLocaleString("ko-KR")}` : "견적 확인 필요",
      leadTime: "미수집",
      shippingFee: "미수집",
      totalPrice: t,
      rank,
      score,
      recommended: rank === 1,
    };
  });
}

/** API 키 없음/모듈 로드 실패 시 로컬 fallback(정성 텍스트만 로컬, 숫자는 결정론 enrich 그대로). */
function buildLocalText(quotes: QuoteCompareInput[], rows: CompareRow[]): { recommendation: string; negotiationGuide: string } {
  const ranked = rows.filter((r) => r.rank !== null).sort((a, b) => (a.rank! - b.rank!));
  const top = ranked[0];
  const recommendation = top
    ? `예상 총액 기준 ${top.vendor}(${top.price})가 가장 유리합니다. 다만 단가·납기·최소주문 조건은 아직 수집되지 않았으니, 발주 전 각 공급사에 회신을 받아 확정하세요.`
    : `${quotes.length}개 공급사 견적을 비교합니다. 예상 총액이 아직 확정되지 않았으므로, 각 공급사에 견적 회신을 받아 같은 기준으로 비교하세요.`;
  const negotiationGuide = [
    top
      ? `단가 협상: 최저 총액(${top.vendor})을 기준으로 타 공급사에 인하를 요청하세요.`
      : "단가 협상: 회신 단가를 경쟁 견적과 비교해 인하를 요청하세요.",
    "납기 협상: 가장 빠른 납기를 기준으로 다른 공급사에 단축을 요청하세요.",
    "조건 협상: MOQ(최소주문수량)·배송비·결제 조건을 묶어 총비용 기준으로 협상하세요.",
  ].join("\n");
  return { recommendation, negotiationGuide };
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await req.json();
    const { quotes } = body as { quotes?: QuoteCompareInput[] };

    if (!Array.isArray(quotes) || quotes.length < 2) {
      return NextResponse.json(
        { error: "비교하려면 견적 후보가 2건 이상 필요합니다." },
        { status: 400 },
      );
    }

    // 최대 5개 제한(프론트도 slice(0,5)).
    const capped = quotes.slice(0, 5);
    const comparison = buildComparisonRows(capped); // 결정론 숫자(총액·순위·점수·추천)
    const localText = buildLocalText(capped, comparison);

    // API 키 없으면 로컬 fallback(숫자 enrich + 로컬 텍스트).
    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        success: true,
        data: { comparison, ...localText } as QuoteCompareData,
        fallback: true,
      });
    }

    const userMessage = `다음 ${capped.length}개 공급사 견적 후보를 비교 분석해 주세요:\n${JSON.stringify(
      capped.map((q) => ({
        vendor: q.vendor || "미지정 공급사",
        items: q.items || "",
        예상총액: typeof q.totalPrice === "number" && q.totalPrice > 0 ? `₩${q.totalPrice.toLocaleString("ko-KR")}` : "견적 확인 필요",
        note: q.rawText || "",
      })),
      null,
      2,
    )}`;

    let rawText = "";
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + userMessage }] }],
        config: { temperature: 0.2, maxOutputTokens: 1024 },
      });
      rawText = response.text ?? "";
    } catch (importErr) {
      console.warn("[quote-compare] @google/genai 로드 실패, 로컬 fallback:", importErr);
      return NextResponse.json({
        success: true,
        data: { comparison, ...localText } as QuoteCompareData,
        fallback: true,
      });
    }

    // JSON 추출(마크다운 코드블록 대응).
    let jsonStr = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let parsed: { recommendation?: unknown; negotiationGuide?: unknown };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // 파싱 실패 시 로컬 텍스트 fallback(빈 모달/가짜 성공 방지). 숫자는 결정론 enrich 유지.
      return NextResponse.json({
        success: true,
        data: { comparison, ...localText } as QuoteCompareData,
        fallback: true,
      });
    }

    const recommendation =
      typeof parsed.recommendation === "string" && parsed.recommendation.trim()
        ? parsed.recommendation.trim()
        : localText.recommendation;
    const negotiationGuide =
      typeof parsed.negotiationGuide === "string" && parsed.negotiationGuide.trim()
        ? parsed.negotiationGuide.trim()
        : localText.negotiationGuide;

    const data: QuoteCompareData = { comparison, recommendation, negotiationGuide };
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[quote-compare] Error:", error);
    return NextResponse.json({ error: "AI 견적 비교 중 오류가 발생했습니다." }, { status: 500 });
  }
}
