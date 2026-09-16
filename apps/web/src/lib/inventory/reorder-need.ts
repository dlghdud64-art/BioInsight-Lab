/**
 * §stock-risk-consolidation P3 (호영님 2026-07-03) — 재고 부족(재주문 필요) 판정 canonical 단일점.
 *
 * stock-risk 폐기·재고 통합의 §3 "각자 계산 금지". dashboard/stats·inventory-content·
 * reorder-recommendations 3곳의 중복/이원화(dashboard·inventory=복합, recommendations=단순)를
 * 하나로 통일한다. 복합 정의:
 *   1) 리드타임 소진: dailyUsage>0 && leadTime>0 && currentQuantity ≤ dailyUsage×leadTime
 *   2) 안전재고 미달: safetyStock!=null && currentQuantity ≤ safetyStock
 *   3) 소진: currentQuantity ≤ 0
 * 순수 함수 — 서버(route)·클라(inventory) 동형 사용(카운트 일치 보장).
 */
export interface ReorderNeedInput {
  currentQuantity: number;
  safetyStock?: number | null;
  averageDailyUsage?: number | null;
  leadTimeDays?: number | null;
}

/** 리드타임 기반 소진 판정(복합의 한 요인). */
export function isReorderNeededByLeadTime(inv: ReorderNeedInput): boolean {
  const dailyUsage = inv.averageDailyUsage ?? 0;
  const leadTime = inv.leadTimeDays ?? 0;
  if (dailyUsage > 0 && leadTime > 0) {
    return inv.currentQuantity <= dailyUsage * leadTime;
  }
  return false;
}

/**
 * 안전재고 축만(복합의 한 요인) — 리드타임 입력이 없는 화면용.
 *
 * 🛑 2026-09-16 §reorder-need-canonical-call — 추출 전에는 이 경계를 부를 수 있는
 *   export 가 없어, leadTime 을 안 받는 화면들이 조건을 각자 복사했다.
 *   그래서 갈렸다(제품 상세·브리핑 모두 `<`). 동작 변화 0 인 순수 추출이다.
 */
export function isReorderNeededBySafetyStock(
  inv: Pick<ReorderNeedInput, "currentQuantity" | "safetyStock">,
): boolean {
  if (inv.safetyStock !== null && inv.safetyStock !== undefined) {
    return inv.currentQuantity <= inv.safetyStock;
  }
  return inv.currentQuantity <= 0;
}

/** 재주문 필요(재고 부족) canonical 판정 — 복합(리드타임 OR 안전재고 OR 소진). */
export function isReorderNeeded(inv: ReorderNeedInput): boolean {
  if (isReorderNeededByLeadTime(inv)) return true;
  return isReorderNeededBySafetyStock(inv);
}
