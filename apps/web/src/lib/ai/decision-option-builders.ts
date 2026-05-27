/**
 * Decision Option Builders — compare/request 3-option set 생성
 *
 * 고정 규칙:
 * 1. AI 기본 출력 = 3-option set. 단일 추천 금지.
 * 2. 각 option: title + rationale + strengths + risks + bestFor + nextAction + confidence.
 * 3. Option A=보수형, B=균형형, C=대안형. 의미 있는 decision frame 차이 필수.
 * 4. option preview와 실제 commit은 분리. 자동 선택/확정/전송 금지.
 * 5. 3안이 성립 안 되면 차라리 조용히 숨김. 어설픈 1안만 남기기 금지.
 */

import type {
  DecisionOption,
  DecisionOptionSet,
  DecisionOptionRisk,
  SourcingStrategyContext,
  CompareDecisionContext,
  RequestStrategyContext,
} from "./decision-option-set";

let _c = 0;
function uid(prefix: string): string { return `${prefix}_${Date.now()}_${++_c}`; }

// ══════════════════════════════════════════════════════════════════════════════
// Compare Decision Option Builder
// ══════════════════════════════════════════════════════════════════════════════

export function buildCompareDecisionOptionSet(
  ctx: CompareDecisionContext
): DecisionOptionSet | null {
  if (ctx.products.length < 2) return null;

  // NaN-safe sort: Infinity - Infinity = NaN 방지
  const safeSort = (arr: typeof ctx.products, key: keyof typeof ctx.products[0], desc = false) => {
    return [...arr].sort((a, b) => {
      const va = (a as any)[key] ?? null;
      const vb = (b as any)[key] ?? null;
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return desc ? (vb as number) - (va as number) : (va as number) - (vb as number);
    });
  };

  const sorted = {
    byCost: safeSort(ctx.products, "priceKRW"),
    byLeadTime: safeSort(ctx.products, "leadTimeDays"),
    bySpec: safeSort(ctx.products, "specMatchScore", true),
  };

  const costTarget = sorted.byCost[0];
  const balancedTarget = sorted.byLeadTime[0]; // lead time 기준 균형
  const specTarget = sorted.bySpec[0];

  // 3안 모두 같은 제품이면 의미 없음 → null
  const uniqueTargets = new Set([costTarget?.id, balancedTarget?.id, specTarget?.id].filter(Boolean));
  if (uniqueTargets.size < 2) return null;

  const hasPriceData = ctx.products.some(p => p.priceKRW && p.priceKRW > 0);
  const hasLeadTimeData = ctx.products.some(p => p.leadTimeDays && p.leadTimeDays > 0);

  const optionA: DecisionOption = {
    id: uid("copt"),
    frame: "conservative",
    title: "비용 중심안",
    rationale: `총 비용이 가장 낮은 ${costTarget?.name?.substring(0, 15) || "후보"}를 기준안으로 제안합니다.`,
    strengths: [
      hasPriceData ? `최저 단가 ₩${(costTarget?.priceKRW ?? 0).toLocaleString()}` : "가격 기준 최우선",
      "예산 리스크 최소화",
    ],
    risks: [
      { id: uid("risk"), label: "납기가 가장 빠르지 않을 수 있음", severity: "medium" },
      { id: uid("risk"), label: "규격 적합성이 최고가 아닐 수 있음", severity: "low" },
    ],
    recommendedUseCase: "예산이 가장 중요한 경우",
    nextAction: "이 안으로 기준안 설정",
    confidence: hasPriceData ? 0.8 : 0.5,
  };

  const optionB: DecisionOption = {
    id: uid("copt"),
    frame: "balanced",
    title: "균형형 기준안",
    rationale: `비용, 납기, 규격을 종합 고려한 ${balancedTarget?.name?.substring(0, 15) || "후보"}를 제안합니다.`,
    strengths: [
      "비용·납기·규격 적합성 균형",
      "일반적인 검토 시나리오에 적합",
    ],
    risks: [
      { id: uid("risk"), label: "특정 기준에서는 최선이 아닐 수 있음", severity: "low" },
    ],
    recommendedUseCase: "종합적 판단이 필요한 경우",
    nextAction: "이 안으로 기준안 설정",
    confidence: 0.75,
  };

  const optionC: DecisionOption = {
    id: uid("copt"),
    frame: "alternative",
    title: "규격·안정성 중심안",
    rationale: `규격 일치도가 가장 높은 ${specTarget?.name?.substring(0, 15) || "후보"}를 기준안으로 제안합니다.`,
    strengths: [
      "실험 재현성과 규격 적합성 최우선",
      "공급 안정성 확보",
    ],
    risks: [
      { id: uid("risk"), label: "비용이 가장 낮지 않을 수 있음", severity: "medium" },
      ...(hasLeadTimeData ? [{ id: uid("risk"), label: "납기가 더 걸릴 수 있음", severity: "low" as const }] : []),
    ],
    recommendedUseCase: "규격 정확성이 가장 중요한 경우",
    nextAction: "이 안으로 기준안 설정",
    confidence: specTarget?.specMatchScore ? 0.85 : 0.6,
  };

  return {
    id: uid("dset"),
    scope: "compare_decision",
    targetId: ctx.compareSessionId,
    contextHash: `compare_${ctx.compareSessionId}_${ctx.products.map(p => p.id).sort().join(",")}`,
    options: [optionA, optionB, optionC],
    defaultHighlight: "balanced",
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Strategy Option Builder
// ══════════════════════════════════════════════════════════════════════════════

export function buildRequestStrategyOptionSet(
  ctx: RequestStrategyContext
): DecisionOptionSet | null {
  if (ctx.items.length === 0) return null;

  const hasExistingMessage = ctx.messageBody.trim().length > 20;
  const itemCount = ctx.items.length;
  const vendorShort = ctx.vendorName.substring(0, 15);

  const optionA: DecisionOption = {
    id: uid("ropt"),
    frame: "conservative",
    title: "간단 확인안",
    rationale: `${vendorShort}에 최소한의 견적/납기 확인만 포함합니다. 기존 거래처나 빠른 회신이 필요할 때 적합합니다.`,
    strengths: [
      "빠른 회신 가능성",
      "공급사 부담 최소화",
      `${itemCount}건 품목 기본 견적 요청`,
    ],
    risks: [
      { id: uid("risk"), label: "규격/대체품 확인이 빠질 수 있음", severity: "low" },
      { id: uid("risk"), label: "납기 문의가 제한적", severity: "low" },
    ],
    recommendedUseCase: "기존 거래처에 간단 확인이 필요한 경우",
    nextAction: "이 안을 초안에 반영",
    confidence: 0.7,
  };

  const optionB: DecisionOption = {
    id: uid("ropt"),
    frame: "balanced",
    title: "표준 견적안",
    rationale: `납기 문의, 주요 스펙 확인을 포함한 표준 견적 요청입니다. 일반적인 구매 검토에 적합합니다.`,
    strengths: [
      "납기 문의 포함",
      ...(ctx.substituteIncluded ? [] : ["대체 가능 여부 문의 추가 가능"]),
      `${itemCount}건 품목 상세 요청`,
    ],
    risks: [
      { id: uid("risk"), label: "확장 질문은 별도 추가 필요", severity: "low" },
    ],
    recommendedUseCase: "일반적인 견적 요청 및 비교 검토",
    nextAction: "이 안을 초안에 반영",
    confidence: 0.8,
  };

  const optionC: DecisionOption = {
    id: uid("ropt"),
    frame: "alternative",
    title: "확장 검토안",
    rationale: `납기/대체/첨부/추가 질문을 모두 포함합니다. 신규 공급사나 고가 품목 검증에 적합합니다.`,
    strengths: [
      "납기 + 대체품 + 규격 확인 모두 포함",
      "첨부 문서 포함 가능",
      "응답 품질 최대화",
    ],
    risks: [
      { id: uid("risk"), label: "공급사 응답 시간이 길어질 수 있음", severity: "medium" },
      { id: uid("risk"), label: "과도한 문의로 부정적 인상 가능", severity: "low" },
    ],
    recommendedUseCase: "신규 공급사 또는 고가/중요 품목 검증",
    nextAction: "이 안을 초안에 반영",
    confidence: 0.75,
  };

  return {
    id: uid("dset"),
    scope: "request_strategy",
    targetId: `${ctx.vendorName}`,
    contextHash: `request_${ctx.vendorName}_${itemCount}_${ctx.missingFields.join(",")}`,
    options: [optionA, optionB, optionC],
    defaultHighlight: "balanced",
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Sourcing Strategy Option Builder
// ══════════════════════════════════════════════════════════════════════════════

export function buildSourcingStrategyOptionSet(
  ctx: SourcingStrategyContext
): DecisionOptionSet | null {
  if (ctx.products.length < 2) return null;

  const withPrice = ctx.products.filter(p => p.priceKRW && p.priceKRW > 0);
  const withLeadTime = ctx.products.filter(p => p.leadTimeDays && p.leadTimeDays > 0);
  const withSpec = ctx.products.filter(p => p.specMatchScore && p.specMatchScore > 0);

  const optionA: DecisionOption = {
    id: uid("sopt"),
    frame: "conservative",
    title: "최저가 우선",
    rationale: `가격이 가장 낮은 후보 ${Math.min(3, withPrice.length)}개를 비교 대상으로 묶어 비용 리스크를 최소화합니다.`,
    strengths: [
      `가격 확인된 후보 ${withPrice.length}건`,
      "예산 관리 우선",
    ],
    risks: [
      { id: uid("risk"), label: `납기 미확인 ${ctx.products.length - withLeadTime.length}건`, severity: withLeadTime.length < withPrice.length ? "medium" : "low" },
    ],
    recommendedUseCase: "예산이 최우선인 소싱",
    nextAction: "비교 후보 담기",
    confidence: withPrice.length >= 2 ? 0.8 : 0.5,
  };

  const optionB: DecisionOption = {
    id: uid("sopt"),
    frame: "balanced",
    title: "납기·가격 균형",
    rationale: `비용과 납기를 함께 고려해 실무 운영에 가장 균형 잡힌 후보를 묶습니다.`,
    strengths: [
      "비용과 납기 동시 고려",
      "일반적 소싱 시나리오에 적합",
    ],
    risks: [
      { id: uid("risk"), label: "특정 기준 최적은 아닐 수 있음", severity: "low" },
    ],
    recommendedUseCase: "일반적인 소싱 검토",
    nextAction: "비교 후보 담기",
    confidence: 0.75,
  };

  const optionC: DecisionOption = {
    id: uid("sopt"),
    frame: "alternative",
    title: "규격 안정성 우선",
    rationale: `규격 일치도가 높은 후보를 우선 묶어 실험 재현성과 안정성을 확보합니다.`,
    strengths: [
      "규격 적합성 최우선",
      "실험 재현성 확보",
    ],
    risks: [
      { id: uid("risk"), label: "가격이 최저가 아닐 수 있음", severity: "medium" },
    ],
    recommendedUseCase: "규격 정확성이 최우선인 소싱",
    nextAction: "비교 후보 담기",
    confidence: withSpec.length >= 2 ? 0.8 : 0.5,
  };

  return {
    id: uid("dset"),
    scope: "sourcing_strategy",
    targetId: ctx.query,
    contextHash: `sourcing_${ctx.query}_${ctx.products.length}_${ctx.compareIds.length}`,
    options: [optionA, optionB, optionC],
    defaultHighlight: "balanced",
    generatedAt: new Date().toISOString(),
  };
}
