/**
 * POST /api/ai/budget-anomaly
 *
 * 발주 항목의 금액을 연결된 예산과 비교하여
 * 이상 탐지(Anomaly) 및 소진률(Burn-rate) 예측을 수행합니다.
 *
 * Gemini AI 사용 + 로컬 fallback (API 키 없을 때)
 */

import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";

const BUDGET_ANOMALY_PROMPT = `You are an AI Financial Controller for a research lab procurement system in South Korea.
Analyze the current order against the budget and historical context.

Order Item: {itemName}
Order Amount: {orderAmount} KRW
Budget Name: {budgetName}
Budget Total: {budgetTotal} KRW
Budget Current Spend: {budgetCurrent} KRW
Budget Period: {budgetPeriod}

Task 1: Anomaly Detection. Is the order amount unusually high for this type of item? Consider that standard lab reagents cost 50,000-500,000 KRW, consumables 10,000-200,000 KRW, and equipment 1,000,000-50,000,000 KRW. Flag if the amount significantly deviates from these ranges.

Task 2: Burn-rate Prediction. Based on the budget (total vs current + new order) and assuming a linear spend over a 6-month period, when will the budget run out?

Task 3: Risk Assessment. Evaluate overall budget risk considering the remaining balance after this order.

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "isAnomaly": boolean,
  "anomalyReason": "string in Korean (e.g., '과거 평균가 대비 정상 범위' or '시약 평균가 대비 300% 높음')",
  "anomalySeverity": "NORMAL" | "WARNING" | "CRITICAL",
  "remainingAfterOrder": number,
  "remainingPercent": number,
  "predictedDepletionDate": "string in Korean (e.g., '2026년 11월 2주차')",
  "burnRateStatus": "SAFE" | "WARNING" | "CRITICAL",
  "burnRateDetail": "string in Korean explaining the burn rate",
  "recommendation": "string in Korean with actionable advice"
}`;

interface BudgetAnomalyRequest {
  itemName: string;
  orderAmount: number;
  budgetName?: string;
  budgetTotal: number;
  budgetCurrent: number;
  budgetPeriod?: string;
}

interface BudgetAnomalyResult {
  isAnomaly: boolean;
  anomalyReason: string;
  anomalySeverity: "NORMAL" | "WARNING" | "CRITICAL";
  remainingAfterOrder: number;
  remainingPercent: number;
  predictedDepletionDate: string;
  burnRateStatus: "SAFE" | "WARNING" | "CRITICAL";
  burnRateDetail: string;
  recommendation: string;
}

// ── 로컬 fallback (API 키 없을 때) ──────────────────────────────

function localBudgetAnalysis(req: BudgetAnomalyRequest): BudgetAnomalyResult {
  const remaining = req.budgetTotal - req.budgetCurrent;
  const remainingAfterOrder = remaining - req.orderAmount;
  const remainingPercent = req.budgetTotal > 0
    ? Math.round((remainingAfterOrder / req.budgetTotal) * 100)
    : 0;

  // 이상 탐지: 단순 규칙 기반
  const orderRatio = req.budgetTotal > 0
    ? req.orderAmount / req.budgetTotal
    : 0;
  const isAnomaly = orderRatio > 0.15 || req.orderAmount > 5000000;
  const anomalySeverity = orderRatio > 0.3 ? "CRITICAL" : orderRatio > 0.15 ? "WARNING" : "NORMAL";

  let anomalyReason: string;
  if (anomalySeverity === "CRITICAL") {
    anomalyReason = `총 예산의 ${Math.round(orderRatio * 100)}%를 차지하는 고액 발주`;
  } else if (anomalySeverity === "WARNING") {
    anomalyReason = `총 예산의 ${Math.round(orderRatio * 100)}% — 주의 필요`;
  } else {
    anomalyReason = "정상 범위 내 발주 금액";
  }

  // 소진률 예측 (6개월 기준)
  const totalSpentAfter = req.budgetCurrent + req.orderAmount;
  const monthlyBurn = totalSpentAfter / 3; // 3개월 경과 가정
  const monthsRemaining = monthlyBurn > 0
    ? Math.max(0, Math.round(remainingAfterOrder / monthlyBurn))
    : 99;

  let burnRateStatus: "SAFE" | "WARNING" | "CRITICAL";
  if (remainingPercent < 10) burnRateStatus = "CRITICAL";
  else if (remainingPercent < 30) burnRateStatus = "WARNING";
  else burnRateStatus = "SAFE";

  const now = new Date();
  const depletionMonth = new Date(now);
  depletionMonth.setMonth(depletionMonth.getMonth() + monthsRemaining);
  const predictedDepletionDate = monthsRemaining > 12
    ? "12개월 이상 여유"
    : `${depletionMonth.getFullYear()}년 ${depletionMonth.getMonth() + 1}월 예상`;

  return {
    isAnomaly,
    anomalyReason,
    anomalySeverity,
    remainingAfterOrder,
    remainingPercent,
    predictedDepletionDate,
    burnRateStatus,
    burnRateDetail: `월 평균 소진 ${Math.round(monthlyBurn).toLocaleString()}원 — 잔여 ${monthsRemaining}개월`,
    recommendation: burnRateStatus === "CRITICAL"
      ? "예산 잔여가 10% 미만입니다. 추가 예산 배정을 검토하세요."
      : burnRateStatus === "WARNING"
        ? "예산 소진 속도가 빠릅니다. 향후 발주 계획을 점검하세요."
        : "예산 운영이 정상 범위입니다.",
  };
}

// ── Route Handler ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/ai/budget-anomaly',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body: BudgetAnomalyRequest = await request.json();

    if (!body.itemName || body.orderAmount == null || body.budgetTotal == null) {
      return NextResponse.json(
        { success: false, error: "itemName, orderAmount, budgetTotal 필수" },
        { status: 400 },
      );
    }

    // Gemini API 호출 시도
    if (GEMINI_API_KEY) {
      try {
        const prompt = BUDGET_ANOMALY_PROMPT
          .replace("{itemName}", body.itemName)
          .replace("{orderAmount}", String(body.orderAmount))
          .replace("{budgetName}", body.budgetName ?? "연구 예산")
          .replace("{budgetTotal}", String(body.budgetTotal))
          .replace("{budgetCurrent}", String(body.budgetCurrent ?? 0))
          .replace("{budgetPeriod}", body.budgetPeriod ?? "2026년 상반기");

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 1024,
              },
            }),
          },
        );

        if (res.ok) {
          const json = await res.json();
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed: BudgetAnomalyResult = JSON.parse(cleaned);
          return NextResponse.json({ success: true, data: parsed, source: "gemini" });
        }
      } catch {
        // Gemini 실패 시 fallback
      }
    }

    // 로컬 fallback
    const result = localBudgetAnalysis(body);
    return NextResponse.json({ success: true, data: result, source: "local" });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Budget anomaly 분석 중 오류 발생" },
      { status: 500 },
    );
  }
}
