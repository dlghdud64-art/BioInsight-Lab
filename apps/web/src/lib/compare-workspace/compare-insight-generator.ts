/**
 * Compare Insight Generator — V1 최소 구현
 *
 * structured diff 위에 AI 해석 레이어를 붙인다.
 * GPT-4o-mini를 사용하여 핵심 변경 요약, 추천 액션, 불확실 필드를 추출.
 *
 * 금지: provenance 없는 단정형 판단, action 없는 generic summary.
 */

import type { DiffResult, DiffItem } from "./03-diff-output-spec";

// ── AI Insight 출력 타입 (V1 최소) ──

export interface CompareInsight {
  keyChanges: string[];
  reviewPoints: InsightReviewPoint[];
  recommendedActions: InsightAction[];
  uncertainFields: InsightUncertainField[];
  overallAssessment: string;
  generatedAt: string;
}

export interface InsightReviewPoint {
  field: string;
  reason: string;
  urgency: "HIGH" | "MEDIUM" | "LOW";
}

export interface InsightAction {
  actionType: "INQUIRE_VENDOR" | "REQUEST_EXPERT_REVIEW" | "PROCEED_WITH_ORDER" | "HOLD_FOR_REVIEW";
  label: string;
  description: string;
  targetField?: string;
}

export interface InsightUncertainField {
  field: string;
  reason: string;
  suggestedResolution: string;
}

// ── Fallback (AI API 없을 때) ──

function generateFallbackInsight(diffResult: DiffResult): CompareInsight {
  const criticalItems = diffResult.items.filter(
    (i) => i.significance === "CRITICAL" && i.diffType !== "IDENTICAL"
  );
  const highItems = diffResult.items.filter(
    (i) => i.significance === "HIGH" && i.diffType !== "IDENTICAL"
  );
  const diffItems = diffResult.items.filter(
    (i) => i.diffType !== "IDENTICAL" && i.diffType !== "FORMAT_DIFF"
  );

  const keyChanges: string[] = [];
  for (const item of diffItems.slice(0, 5)) {
    keyChanges.push(
      `${item.fieldLabel}: ${formatValue(item.sourceValue)} → ${formatValue(item.targetValue)}`
    );
  }

  const reviewPoints: InsightReviewPoint[] = criticalItems.map((item) => ({
    field: item.fieldLabel,
    reason: `${item.fieldLabel}에 치명적 차이가 있습니다. 대체 전 확인이 필요합니다.`,
    urgency: "HIGH" as const,
  }));

  const recommendedActions: InsightAction[] = [];
  if (highItems.some((i) => i.fieldKey === "quoteAmount" || i.fieldKey === "leadTimeDays")) {
    recommendedActions.push({
      actionType: "INQUIRE_VENDOR",
      label: "공급사 문의",
      description: "가격/납기 차이에 대해 공급사에 문의합니다.",
      targetField: "quoteAmount",
    });
  }
  if (criticalItems.length > 0) {
    recommendedActions.push({
      actionType: "REQUEST_EXPERT_REVIEW",
      label: "전문가 검토 요청",
      description: "치명적 차이 항목에 대해 전문가 검토를 요청합니다.",
    });
  }
  if (diffResult.summary.overallVerdict === "EQUIVALENT" || diffResult.summary.overallVerdict === "MINOR_DIFFERENCES") {
    recommendedActions.push({
      actionType: "PROCEED_WITH_ORDER",
      label: "주문 진행",
      description: "차이가 경미하여 주문을 진행해도 됩니다.",
    });
  }

  const uncertainFields: InsightUncertainField[] = diffItems
    .filter((i) => i.diffType === "SOURCE_ONLY" || i.diffType === "TARGET_ONLY")
    .map((i) => ({
      field: i.fieldLabel,
      reason: i.diffType === "SOURCE_ONLY" ? "비교 대상에 해당 정보 없음" : "기준 제품에 해당 정보 없음",
      suggestedResolution: "공급사에 해당 정보를 요청하세요.",
    }));

  return {
    keyChanges,
    reviewPoints,
    recommendedActions,
    uncertainFields,
    overallAssessment: diffResult.summary.verdictReason,
    generatedAt: new Date().toISOString(),
  };
}

function formatValue(val: unknown): string {
  if (val == null) return "(없음)";
  if (typeof val === "number") return val.toLocaleString("ko-KR");
  return String(val);
}

// ── AI 기반 Insight 생성 ──

export async function generateCompareInsight(
  diffResult: DiffResult,
  sourceProductName: string,
  targetProductName: string
): Promise<CompareInsight> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return generateFallbackInsight(diffResult);
  }

  try {
    const diffSummaryForPrompt = buildDiffPromptContext(diffResult, sourceProductName, targetProductName);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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
            content: `당신은 바이오/제약 연구실의 구매 담당자를 돕는 제품 비교 전문가입니다.
두 제품의 structured diff 결과를 분석하여 실무적 insight를 제공합니다.

응답은 반드시 아래 JSON 형식으로만 반환하세요:
{
  "keyChanges": ["핵심 변경 사항 1", ...],
  "reviewPoints": [{"field": "필드명", "reason": "검토 사유", "urgency": "HIGH|MEDIUM|LOW"}],
  "recommendedActions": [{"actionType": "INQUIRE_VENDOR|REQUEST_EXPERT_REVIEW|PROCEED_WITH_ORDER|HOLD_FOR_REVIEW", "label": "액션명", "description": "설명", "targetField": "관련필드"}],
  "uncertainFields": [{"field": "필드명", "reason": "불확실 사유", "suggestedResolution": "해결 방안"}],
  "overallAssessment": "종합 평가 (1-2문장)"
}

규칙:
- 모든 판단에 구체적 근거(diff 데이터)를 기반으로 해야 함
- 추천 액션은 실제 실행 가능한 것만 제안
- 불확실한 필드는 반드시 명시
- 한국어로 작성`,
          },
          {
            role: "user",
            content: diffSummaryForPrompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn("[CompareInsight] OpenAI API error, falling back");
      return generateFallbackInsight(diffResult);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    return {
      keyChanges: Array.isArray(parsed.keyChanges) ? parsed.keyChanges : [],
      reviewPoints: Array.isArray(parsed.reviewPoints) ? parsed.reviewPoints : [],
      recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [],
      uncertainFields: Array.isArray(parsed.uncertainFields) ? parsed.uncertainFields : [],
      overallAssessment: parsed.overallAssessment || diffResult.summary.verdictReason,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[CompareInsight] AI 생성 실패, fallback 사용:", err);
    return generateFallbackInsight(diffResult);
  }
}

function buildDiffPromptContext(
  diffResult: DiffResult,
  sourceName: string,
  targetName: string
): string {
  const lines: string[] = [
    `기준 제품(A): ${sourceName}`,
    `비교 대상(B): ${targetName}`,
    `전체 비교 항목: ${diffResult.totalFieldsCompared}개`,
    `차이 발견: ${diffResult.totalDifferences}건`,
    `종합 판정: ${diffResult.summary.overallVerdict}`,
    "",
    "차이 항목:",
  ];

  for (const item of diffResult.items) {
    if (item.diffType === "IDENTICAL") continue;
    lines.push(
      `- [${item.significance}] ${item.fieldLabel}: A=${formatValue(item.sourceValue)} / B=${formatValue(item.targetValue)} (${item.diffType})`
    );
  }

  return lines.join("\n");
}
