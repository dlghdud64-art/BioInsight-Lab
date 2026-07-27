/**
 * §inventory-delta-label-kpi Phase 1 (호영님 2026-07-27 핸드오프 §1 — 재발주 권장수량 canonical 산식)
 *
 * 재발주 권장수량 = 안전재고 갭 + 납기 중 소진 → 최소 주문 단위(MOQ) 반올림.
 *   구 산식(safetyStock + 월간소진 − currentQty)은 "월(30일)" 기준이라 리드타임과 무관 →
 *   핸드오프 §1 산식(리드타임 기간 소진)으로 교체. 근거 3항(갭·납기중소진·MOQ) 함께 반환.
 *
 * canonical 단일점: 서버 route(reorder-recommendations)가 이 헬퍼로 산출 → 레일·모바일 시트·
 *   상태카드·smart-pick 이 동일 recommendedQuantity 소비(웹·모바일 숫자 일치, §5-1).
 *   순수 함수 — 조작 0, 서버/클라 동형.
 *
 * 차원 정합: leadTimeDays(일) × dailyUsage(개/일) = 리드타임 기간 소진(개). 핸드오프의
 *   "리드타임 × 주당 소진"은 리드타임 동안의 소진을 뜻하며 일 단위로 계산(dailyUsage 기준).
 */

export interface ReorderQuantityInput {
  /** 현재 가용 수량 */
  currentQuantity: number;
  /** 안전재고 (null이면 0 취급) */
  safetyStock?: number | null;
  /** 일평균 소진 (개/일). null이면 0 → 납기중 소진 0 */
  dailyUsage?: number | null;
  /** 리드타임 (일). null이면 0 → 납기중 소진 0 */
  leadTimeDays?: number | null;
  /** 최소 주문 단위. null/0이면 1 취급 */
  minOrderQty?: number | null;
}

export interface ReorderQuantityBreakdown {
  /** 안전재고 갭 = max(0, safetyStock − currentQuantity) */
  safetyGap: number;
  /** 납기 중 소진 = ceil(leadTimeDays × dailyUsage) */
  leadTimeConsumption: number;
  /** 반올림 전 원시 합 = safetyGap + leadTimeConsumption */
  rawQuantity: number;
  /** 적용된 최소 주문 단위 */
  minOrderQty: number;
}

export interface ReorderQuantityResult {
  /** 최종 권장 수량 (MOQ 반올림, 최소 1 MOQ) */
  recommendedQuantity: number;
  breakdown: ReorderQuantityBreakdown;
}

/**
 * 핸드오프 §1 canonical 산식.
 * recommendedQuantity = max(MOQ, roundUpToMOQ(안전재고 갭 + 납기중 소진)).
 */
export function computeReorderRecommendation(
  input: ReorderQuantityInput,
): ReorderQuantityResult {
  const current = Number.isFinite(input.currentQuantity) ? input.currentQuantity : 0;
  const safety = Math.max(0, input.safetyStock ?? 0);
  const daily = Math.max(0, input.dailyUsage ?? 0);
  const lead = Math.max(0, input.leadTimeDays ?? 0);
  const moq = input.minOrderQty && input.minOrderQty > 0 ? input.minOrderQty : 1;

  const safetyGap = Math.max(0, safety - current);
  const leadTimeConsumption = Math.ceil(daily * lead);
  const rawQuantity = safetyGap + leadTimeConsumption;

  // MOQ 반올림 + 최소 1 MOQ 보장(재발주 필요인데 0 방지).
  const rounded = Math.ceil(rawQuantity / moq) * moq;
  const recommendedQuantity = Math.max(moq, rounded);

  return {
    recommendedQuantity,
    breakdown: { safetyGap, leadTimeConsumption, rawQuantity, minOrderQty: moq },
  };
}
