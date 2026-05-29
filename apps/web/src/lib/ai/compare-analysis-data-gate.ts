/**
 * §11.318 Phase 1d-1 — compare-analysis 환각 억제 데이터 게이트 (순수 모듈)
 *
 * canonical 표면 = /app/search 워크벤치(comparison-modal → /api/ai/compare-analysis).
 * 목적: 가격/납기 실데이터가 없으면 cost/balanced/speed "전략 시나리오"를 생성하지 않는다.
 *   (Gemini + buildLocalAnalysis 둘 다 route 경계에서 이 게이트로 차단.)
 *
 * 호영님 확정 경계(2026-05-30):
 *   ① 시나리오 = "해당 축(가격/납기) 데이터를 가진 제품이 2개 이상"일 때만.
 *      1개만 있으면 비교 불가 → 억제.
 *   ② null/undefined = "없음". 숫자값 = "있음".
 *      가격 0/음수 = 비정상 → "없음". 납기 0일 = 당일납품 → "있음".
 *
 * ⚠️ DOM/서버 의존 import 금지(순수). route 가 이 함수로 분기.
 */

export interface AnalysisProductInput {
  id: string;
  name: string;
  price?: number | null;
  leadTime?: string | null;
  brand?: string | null;
  catalogNumber?: string | null;
  specification?: string | null;
}

export type ScenarioType = "cost_first" | "balanced" | "speed_first";

export interface AnalysisAvailability {
  /** 비교 가능한 가격 데이터를 가진 제품 수(0/음수·null 제외). */
  countPrice: number;
  /** 비교 가능한 납기 데이터를 가진 제품 수(0일 포함, null 제외). */
  countLead: number;
  /** 가격 축 비교 가능(≥2). */
  hasComparablePrice: boolean;
  /** 납기 축 비교 가능(≥2). */
  hasComparableLead: boolean;
  /** 생성 허용 시나리오. */
  allowedScenarios: ScenarioType[];
  /** 허용 시나리오 0 → 전체 억제(빈 상태). */
  suppressed: boolean;
  /** 억제 사유(한국어, 빈 상태 안내용). suppressed=false 면 "". */
  reason: string;
}

/** 납기 문자열 → 일수. 첫 정수 추출. 숫자 없으면 null. "0일"→0(당일). */
export function parseLeadDays(leadTime: string | null | undefined): number | null {
  if (!leadTime) return null;
  const m = String(leadTime).match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

/** 가격 유효성: 유한 숫자 + 양수(0/음수 비정상 제외). */
function isValidPrice(price: number | null | undefined): boolean {
  return typeof price === "number" && Number.isFinite(price) && price > 0;
}

/** 납기 유효성: 파싱 가능 + 0 이상(당일납품 0 유효). */
function isValidLead(leadTime: string | null | undefined): boolean {
  const d = parseLeadDays(leadTime);
  return d != null && d >= 0;
}

/**
 * 제품 목록의 가격/납기 데이터 가용성 평가 → 허용 시나리오 산출.
 * 환각 차단의 단일 판정점.
 */
export function assessAnalysisDataAvailability(
  products: AnalysisProductInput[],
): AnalysisAvailability {
  let countPrice = 0;
  let countLead = 0;
  for (const p of products) {
    if (isValidPrice(p.price)) countPrice++;
    if (isValidLead(p.leadTime)) countLead++;
  }

  const hasComparablePrice = countPrice >= 2;
  const hasComparableLead = countLead >= 2;

  const allowedScenarios: ScenarioType[] = [];
  if (hasComparablePrice) allowedScenarios.push("cost_first");
  if (hasComparablePrice && hasComparableLead) allowedScenarios.push("balanced");
  if (hasComparableLead) allowedScenarios.push("speed_first");

  const suppressed = allowedScenarios.length === 0;
  const reason = suppressed
    ? "비교할 가격·납기 데이터가 부족합니다 (같은 항목 2개 이상 필요). 견적을 먼저 요청하세요."
    : "";

  return {
    countPrice,
    countLead,
    hasComparablePrice,
    hasComparableLead,
    allowedScenarios,
    suppressed,
    reason,
  };
}
