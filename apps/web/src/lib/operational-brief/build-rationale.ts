/**
 * #quote-rationale-inventory-context Phase 1 — 인과관계 한 줄 요약 helper.
 *
 * §11.221/222 desktop + mobile inline IIFE 의 6-case logic 추출. 두 곳에서
 * 같은 helper 호출 → drift 차단 + maintenance 단순화.
 *
 * 호영님 5/8 합의: "상태 반복" → "인과관계 + 실행 이유". 1차 노출 한 줄
 * (→ + emoji + 굵게). inventoryContext optional input 시 tail append:
 *   "📋 견적 미발송 → 비교·발주 차단 중. 발송이 첫 단계입니다.
 *    ⏰ FBS 5일 남음 / 예상 수령일 +5일"
 *
 * canonical truth lock:
 *   - selectedSignals (status/blocker/nextAction/compareReady/poReady) 이 base.
 *   - inventoryContext.mostUrgent 가 있으면 tail append.
 *   - mostUrgent === null 또는 미전달 시 base 그대로 (graceful fallback).
 *   - tail 조건: isLowStock OR daysRemaining 정의됨 (둘 다 없으면 의미 약해 tail X).
 */

export interface BriefRationaleInventoryUrgent {
  /** 매칭된 product 이름 (예: "FBS"). */
  productName: string;
  /**
   * 잔여 일수 (currentQuantity / averageDailyUsage).
   * undefined 시 계산 불가 (averageDailyUsage 0 또는 미입력).
   */
  daysRemaining?: number;
  /** safetyStock 임계 통과 여부 (currentQuantity < safetyStock). */
  isLowStock: boolean;
  /**
   * 예상 수령 리드타임 (일).
   * ProductInventory.leadTimeDays 우선 + ProductVendor.leadTime fallback.
   */
  leadTimeDays?: number;
}

export interface BriefRationaleInventoryContext {
  /**
   * quote.items 매칭 inventory 중 가장 위급한 1개.
   * null 시 매칭 0건 또는 모두 정상 — tail 노출 안 함.
   */
  mostUrgent: BriefRationaleInventoryUrgent | null;
}

export interface BriefRationaleInput {
  status?: string | null;
  blocker?: string | null;
  nextAction?: string | null;
  compareReady?: string | null;
  poReady?: string | null;
  replyCount: number;
  totalItems: number;
  isSent: boolean;
  /** §11.223 — optional inventory tail. 미전달 시 base 그대로. */
  inventoryContext?: BriefRationaleInventoryContext;
}

/**
 * 6-case base 인과관계 메시지.
 */
function buildBaseSummary(input: BriefRationaleInput): string {
  const { status, blocker, nextAction, compareReady, poReady, replyCount, totalItems, isSent } = input;

  if (blocker?.includes("공급사 미전송") || status?.includes("요청 생성")) {
    return "📋 견적 미발송 → 비교·발주 차단 중. 발송이 첫 단계입니다.";
  }
  if (isSent && replyCount === 0) {
    return "📤 발송 완료 → 회신 대기 중. 응답 수집이 다음 단계입니다.";
  }
  if (replyCount > 0 && replyCount < totalItems) {
    return `📥 회신 ${replyCount}/${totalItems} → 일부 수신 중. 추가 회신 대기 또는 비교 검토 진입 가능.`;
  }
  if (replyCount > 0 && replyCount >= totalItems && (compareReady === "가능" || compareReady === "완료")) {
    return "📊 회신 수집 완료 → 비교 검토 가능. 최적안 선택이 다음 단계입니다.";
  }
  if (poReady === "가능") {
    return "✅ 비교 완료 → 발주 전환 가능. 결재 또는 PO 생성이 다음 단계입니다.";
  }
  return `${blocker && blocker !== "차단 없음" ? `⚠️ 차단: ${blocker} → ` : "→ "}다음 단계: ${nextAction ?? "-"}`;
}

/**
 * inventory tail — mostUrgent 가 있고 (isLowStock OR daysRemaining 정의) 일 때만.
 */
function buildInventoryTail(ctx: BriefRationaleInventoryContext | undefined): string | null {
  if (!ctx?.mostUrgent) return null;
  const { productName, daysRemaining, isLowStock, leadTimeDays } = ctx.mostUrgent;
  // 의미 있는 정보 — isLowStock 또는 daysRemaining 정의돼야.
  if (!isLowStock && daysRemaining === undefined) return null;

  const parts: string[] = ["⏰"];
  if (productName) parts.push(productName);
  if (daysRemaining !== undefined && Number.isFinite(daysRemaining)) {
    parts.push(`${Math.max(0, Math.round(daysRemaining))}일 남음`);
  } else if (isLowStock) {
    parts.push("재고 부족");
  }
  if (leadTimeDays !== undefined && Number.isFinite(leadTimeDays) && leadTimeDays > 0) {
    parts.push(`/ 예상 수령일 +${leadTimeDays}일`);
  }
  return parts.join(" ");
}

/**
 * 인과관계 한 줄 요약 (호영님 5/8 합의).
 *
 * @example
 * buildBriefRationaleSummary({
 *   blocker: "공급사 미전송",
 *   status: "요청 생성 완료",
 *   replyCount: 0,
 *   totalItems: 1,
 *   isSent: false,
 *   inventoryContext: {
 *     mostUrgent: { productName: "FBS", daysRemaining: 5, isLowStock: true, leadTimeDays: 5 },
 *   },
 * });
 * // → "📋 견적 미발송 → 비교·발주 차단 중. 발송이 첫 단계입니다.
 * //    ⏰ FBS 5일 남음 / 예상 수령일 +5일"
 */
export function buildBriefRationaleSummary(input: BriefRationaleInput): string {
  const base = buildBaseSummary(input);
  const tail = buildInventoryTail(input.inventoryContext);
  return tail ? `${base}\n${tail}` : base;
}
