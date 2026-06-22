/**
 * POST /api/ai/quote-compare  (§10 견적 비교 백엔드 — 시안 CompareModal 풀 빌드)
 *
 * 견적 관리 "AI 견적 비교" CTA(runAiQuoteCompare) 엔드포인트.
 * 출력은 시안(quote-modals.jsx CompareModal) 구조 그대로:
 *   - recommendation(네이비 종합 추천) + recommendedIdx
 *   - ranks[]: 순위 카드(종합점수·예상총액·한 줄 이유·추천 리본)
 *   - rows[]: 세부표(단가·납기·최소주문) — 행별 최적값 bestIdx
 *   - totalRow: 예상 총액 행
 *   - negotiationPoints[]: AI 협상 포인트
 *   - note: 납기 주석
 *
 * canonical truth(§11.318): 숫자 비교 축 중 canonical 은 회신 총액(totalPrice)뿐.
 *   단가·납기·최소주문(moq)은 QuoteVendorResponseItem 와이어링(Phase 2) 전까지 "미수집"
 *   으로 정직 표기(AI 추정 금지). 순위·점수·총액은 결정론, 정성 텍스트만 Gemini.
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";

interface QuoteCompareInput {
  vendor: string;
  items: string;
  rawText: string;
  totalPrice?: number | null;
  // Phase 2(QuoteVendorResponseItem 와이어링) 시 채워질 canonical 필드.
  unitPrice?: number | null;
  leadTimeDays?: number | null;
  moq?: number | null;
}

interface RankCard {
  vendor: string;
  rank: number | null;
  score: number | null;
  totalDisplay: string;
  reason: string;
  recommended: boolean;
}
interface CompareTableRow {
  label: string;
  hint?: string;
  values: string[];
  bestIdx: number | null;
}
interface QuoteCompareData {
  vendors: string[];
  recommendedIdx: number | null;
  recommendation: string;
  ranks: RankCard[];
  rows: CompareTableRow[];
  totalRow: { values: string[]; bestIdx: number | null };
  negotiationPoints: string[];
  note: string;
  dataState: "ready" | "partial";
}

const won = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

/** canonical 총액으로 순위/점수/추천 결정론 계산 + 세부표(단가/납기/moq 있으면 채우고 없으면 미수집). */
function buildCompareData(quotes: QuoteCompareInput[], text: { recommendation: string; negotiationPoints: string[] }): QuoteCompareData {
  const vendors = quotes.map((q) => q.vendor || "미지정 공급사");
  const totals = quotes.map((q) => (typeof q.totalPrice === "number" && q.totalPrice > 0 ? q.totalPrice : null));
  const valid = totals.filter((t): t is number => t !== null);
  const minT = valid.length ? Math.min(...valid) : 0;
  const maxT = valid.length ? Math.max(...valid) : 0;

  // 순위(총액 asc) → rank 맵.
  const rankMap = new Map<number, number>();
  totals
    .map((t, i) => ({ i, t }))
    .filter((x): x is { i: number; t: number } => x.t !== null)
    .sort((a, b) => a.t - b.t)
    .forEach((x, idx) => rankMap.set(x.i, idx + 1));
  const recommendedIdx = totals.findIndex((_, i) => rankMap.get(i) === 1);

  const ranks: RankCard[] = quotes.map((q, i) => {
    const t = totals[i];
    const score = t === null ? null : maxT === minT ? 100 : Math.round(((maxT - t) / (maxT - minT)) * 40 + 60);
    const rank = rankMap.get(i) ?? null;
    const reason =
      t === null
        ? "견적 미수신 · 회신 확보 필요"
        : rank === 1
          ? "예상 총액이 가장 낮습니다"
          : `예상 총액 ${minT > 0 ? Math.round(((t - minT) / minT) * 100) : 0}% 높음`;
    return { vendor: vendors[i], rank, score, totalDisplay: t === null ? "견적 확인 필요" : won(t), reason, recommended: rank === 1 };
  });
  // 순위 카드는 rank asc, 미수신은 뒤로.
  const ranksSorted = [...ranks].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  // 세부표: 단가/납기/최소주문. canonical 있으면 채우고 없으면 "미수집"(bestIdx null).
  const hasUnit = quotes.some((q) => typeof q.unitPrice === "number" && q.unitPrice! > 0);
  const hasLead = quotes.some((q) => typeof q.leadTimeDays === "number");
  const hasMoq = quotes.some((q) => typeof q.moq === "number");
  const bestBy = (arr: (number | null)[], dir: "min" | "max" = "min"): number | null => {
    const present = arr.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v !== null);
    if (present.length < 2) return null;
    return present.reduce((a, b) => (dir === "min" ? (b.v < a.v ? b : a) : b.v > a.v ? b : a)).i;
  };
  const unitArr = quotes.map((q) => (typeof q.unitPrice === "number" && q.unitPrice! > 0 ? q.unitPrice! : null));
  const leadArr = quotes.map((q) => (typeof q.leadTimeDays === "number" ? q.leadTimeDays! : null));
  const moqArr = quotes.map((q) => (typeof q.moq === "number" ? q.moq! : null));
  const rows: CompareTableRow[] = [
    {
      label: "단가",
      values: quotes.map((_, i) => (unitArr[i] !== null ? won(unitArr[i]!) : "미수집")),
      bestIdx: hasUnit ? bestBy(unitArr, "min") : null,
    },
    {
      label: "납기",
      hint: hasLead ? "견적 제시" : undefined,
      values: quotes.map((_, i) => (leadArr[i] !== null ? `약 ${leadArr[i]}일` : "미수집")),
      bestIdx: hasLead ? bestBy(leadArr, "min") : null,
    },
    {
      label: "최소 주문",
      values: quotes.map((_, i) => (moqArr[i] !== null ? `${moqArr[i]} EA` : "미수집")),
      bestIdx: hasMoq ? bestBy(moqArr, "min") : null,
    },
  ];
  const totalRow = {
    values: totals.map((t) => (t === null ? "견적 확인 필요" : won(t))),
    bestIdx: bestBy(totals, "min"),
  };

  const note =
    hasUnit && hasLead
      ? "납기는 공급사가 견적에 제시한 값입니다. 실제 납품일은 발주 확정 시 공급사와 협의해 확정됩니다."
      : "단가·납기·최소주문은 공급사 회신 수집 후 채워집니다. 현재는 예상 총액(회신 최저가) 기준 비교입니다.";

  return {
    vendors,
    recommendedIdx: recommendedIdx >= 0 ? recommendedIdx : null,
    recommendation: text.recommendation,
    ranks: ranksSorted,
    rows,
    totalRow,
    negotiationPoints: text.negotiationPoints,
    note,
    dataState: hasUnit && hasLead ? "ready" : "partial",
  };
}

/** 로컬 정성 텍스트(키 부재/파싱 실패 시). 숫자 날조 0. */
function buildLocalText(quotes: QuoteCompareInput[]): { recommendation: string; negotiationPoints: string[] } {
  const totals = quotes.map((q) => (typeof q.totalPrice === "number" && q.totalPrice > 0 ? q.totalPrice : null));
  const valid = totals.map((t, i) => ({ t, i })).filter((x): x is { t: number; i: number } => x.t !== null);
  const top = valid.length ? valid.reduce((a, b) => (b.t < a.t ? b : a)) : null;
  const topName = top ? quotes[top.i].vendor || "미지정 공급사" : null;
  const recommendation = topName
    ? `${topName}를 우선 검토하세요 — 예상 총액이 가장 낮습니다. 단가·납기·최소주문 조건은 회신 수집 후 확정해 균형을 재평가하세요.`
    : "예상 총액이 아직 확정되지 않았습니다. 각 공급사에 견적 회신을 받아 같은 기준으로 비교하세요.";
  const negotiationPoints = [
    topName ? `${topName}의 최저 총액을 기준으로 타 공급사에 단가 인하를 요청하세요.` : "회신 단가를 경쟁 견적과 비교해 인하를 요청하세요.",
    "납기가 급하면 가장 빠른 공급사와 단가 차를 협상 카드로 활용하세요.",
    "최소 주문(MOQ)·배송비·결제 조건을 묶어 총비용 기준으로 협상하세요.",
  ];
  return { recommendation, negotiationPoints };
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
      return NextResponse.json({ error: "비교하려면 견적 후보가 2건 이상 필요합니다." }, { status: 400 });
    }
    const capped = quotes.slice(0, 5);
    const localText = buildLocalText(capped);

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: true, data: buildCompareData(capped, localText), fallback: true });
    }

    const SYSTEM_PROMPT = `당신은 바이오/화학 연구실 구매 견적을 비교 분석하는 'AI 구매 분석가'입니다.
공급사별 예상 총액(canonical)과 품목 정보를 보고, 균형(최저가가 아닌 단가·납기·조건 종합) 관점의 종합 추천과 협상 포인트를 제시합니다.
[절대 규칙] 예상 총액 외 숫자(단가/납기/배송비/MOQ)는 주어지지 않았으면 임의로 만들지 마십시오.
[출력] 마크다운 없이 순수 JSON: {"recommendation":"종합 추천 1~2문장(추천 공급사명 포함)","negotiationPoints":["협상 포인트 3개"]}`;
    const userMessage = `공급사 견적 후보:\n${JSON.stringify(
      capped.map((q) => ({ vendor: q.vendor, items: q.items, 예상총액: typeof q.totalPrice === "number" && q.totalPrice > 0 ? won(q.totalPrice) : "견적 확인 필요" })),
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
      return NextResponse.json({ success: true, data: buildCompareData(capped, localText), fallback: true });
    }

    let jsonStr = rawText;
    const m = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) jsonStr = m[1].trim();
    let parsed: { recommendation?: unknown; negotiationPoints?: unknown };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ success: true, data: buildCompareData(capped, localText), fallback: true });
    }
    const text = {
      recommendation:
        typeof parsed.recommendation === "string" && parsed.recommendation.trim() ? parsed.recommendation.trim() : localText.recommendation,
      negotiationPoints:
        Array.isArray(parsed.negotiationPoints) && parsed.negotiationPoints.length
          ? parsed.negotiationPoints.filter((p): p is string => typeof p === "string").slice(0, 3)
          : localText.negotiationPoints,
    };
    return NextResponse.json({ success: true, data: buildCompareData(capped, text) });
  } catch (error) {
    console.error("[quote-compare] Error:", error);
    return NextResponse.json({ error: "AI 견적 비교 중 오류가 발생했습니다." }, { status: 500 });
  }
}
