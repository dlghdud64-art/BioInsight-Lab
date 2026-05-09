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
 * #operational-brief-emoji-sweep — 6 canonical case ID.
 *   Phase B-1 (호영님 redesign) — 이모지 prefix 제거 후 caller 가 case + tone
 *   따라 Lucide icon + 컬러 도트 매핑. 메시지는 텍스트만 (B2B 톤 정합).
 */
export type BriefRationaleCase =
  | "not_sent"
  | "awaiting_reply"
  | "partial_reply"
  | "reply_complete"
  | "po_ready"
  | "fallback";

export type BriefRationaleTone = "slate" | "amber" | "blue" | "emerald" | "red";

export interface BriefRationaleInventoryTail {
  /** 텍스트 message (이모지 0). caller 가 Clock icon 별도 표시. */
  message: string;
  productName: string;
  daysRemaining?: number;
  leadTimeDays?: number;
  isLowStock: boolean;
}

export interface BriefRationaleResult {
  /** 인과관계 한 줄 message (이모지 0, 텍스트만). */
  message: string;
  case: BriefRationaleCase;
  tone: BriefRationaleTone;
  /** mostUrgent 매칭 시 inventory tail (별도 row 로 표시). */
  inventoryTail?: BriefRationaleInventoryTail;
}

/**
 * 6-case base 인과관계 메시지 — case + tone + 이모지 0 message 반환.
 */
function buildBaseResult(
  input: BriefRationaleInput,
): { message: string; case: BriefRationaleCase; tone: BriefRationaleTone } {
  const { status, blocker, nextAction, compareReady, poReady, replyCount, totalItems, isSent } = input;

  if (blocker?.includes("공급사 미전송") || status?.includes("요청 생성")) {
    return {
      message: "견적 미발송 → 비교·발주 차단 중. 발송이 첫 단계입니다.",
      case: "not_sent",
      tone: "slate",
    };
  }
  if (isSent && replyCount === 0) {
    return {
      message: "발송 완료 → 회신 대기 중. 응답 수집이 다음 단계입니다.",
      case: "awaiting_reply",
      tone: "amber",
    };
  }
  if (replyCount > 0 && replyCount < totalItems) {
    return {
      message: `회신 ${replyCount}/${totalItems} → 일부 수신 중. 추가 회신 대기 또는 비교 검토 진입 가능.`,
      case: "partial_reply",
      tone: "blue",
    };
  }
  if (replyCount > 0 && replyCount >= totalItems && (compareReady === "가능" || compareReady === "완료")) {
    return {
      message: "회신 수집 완료 → 비교 검토 가능. 최적안 선택이 다음 단계입니다.",
      case: "reply_complete",
      tone: "blue",
    };
  }
  if (poReady === "가능") {
    return {
      message: "비교 완료 → 발주 전환 가능. 결재 또는 PO 생성이 다음 단계입니다.",
      case: "po_ready",
      tone: "emerald",
    };
  }
  const hasBlocker = blocker && blocker !== "차단 없음";
  return {
    message: hasBlocker
      ? `차단: ${blocker} → 다음 단계: ${nextAction ?? "-"}`
      : `다음 단계: ${nextAction ?? "-"}`,
    case: "fallback",
    tone: hasBlocker ? "red" : "slate",
  };
}

/**
 * inventory tail — mostUrgent 가 있고 (isLowStock OR daysRemaining 정의) 일 때만.
 * #operational-brief-emoji-sweep — 이모지 (⏰) 제거. caller 가 Clock icon 별도 표시.
 */
function buildInventoryTailResult(
  ctx: BriefRationaleInventoryContext | undefined,
): BriefRationaleInventoryTail | null {
  if (!ctx?.mostUrgent) return null;
  const { productName, daysRemaining, isLowStock, leadTimeDays } = ctx.mostUrgent;
  // 의미 있는 정보 — isLowStock 또는 daysRemaining 정의돼야.
  if (!isLowStock && daysRemaining === undefined) return null;

  const parts: string[] = [];
  if (productName) parts.push(productName);
  if (daysRemaining !== undefined && Number.isFinite(daysRemaining)) {
    parts.push(`${Math.max(0, Math.round(daysRemaining))}일 남음`);
  } else if (isLowStock) {
    parts.push("재고 부족");
  }
  if (leadTimeDays !== undefined && Number.isFinite(leadTimeDays) && leadTimeDays > 0) {
    parts.push(`/ 예상 수령일 +${leadTimeDays}일`);
  }
  return {
    message: parts.join(" "),
    productName,
    daysRemaining,
    leadTimeDays,
    isLowStock,
  };
}

/**
 * #quote-rationale-inventory-context Phase 2 — match helper.
 *
 * quote.items 의 productId × ProductInventory.productId 매칭 → 가장 위급한
 * 1개 추출. low-stock 판정: safetyStock OR 소진속도 (호영님 결정 2C).
 *
 *   (a) safetyStock != null && currentQuantity < safetyStock
 *   (b) averageDailyUsage > 0 && leadTimeDays > 0 &&
 *       (currentQuantity / averageDailyUsage) < leadTimeDays × 1.5
 *
 * mostUrgent: low-stock 인 row 중 daysRemaining 최소 (undefined 마지막).
 * 매칭 0 또는 모두 정상 → null (graceful).
 */
export interface InventoryRow {
  productId: string;
  currentQuantity: number;
  safetyStock?: number | null;
  averageDailyUsage?: number | null;
  leadTimeDays?: number | null;
  product?: { name?: string | null } | null;
}

export interface QuoteItemForMatch {
  product?: { id?: string | null; name?: string | null } | null;
}

export function findMostUrgentInventoryForQuote(
  quoteItems: ReadonlyArray<QuoteItemForMatch>,
  inventories: ReadonlyArray<InventoryRow>,
): BriefRationaleInventoryUrgent | null {
  if (!quoteItems.length || !inventories.length) return null;

  const productIds = new Set<string>();
  for (const item of quoteItems) {
    if (item.product?.id) productIds.add(item.product.id);
  }
  if (productIds.size === 0) return null;

  type Candidate = BriefRationaleInventoryUrgent & { _rank: number };
  const candidates: Candidate[] = [];

  for (const inv of inventories) {
    if (!productIds.has(inv.productId)) continue;
    const productName = inv.product?.name ?? quoteItems.find(
      (q) => q.product?.id === inv.productId,
    )?.product?.name ?? inv.productId;

    const usage = inv.averageDailyUsage;
    const leadTime = inv.leadTimeDays;
    const daysRemaining =
      usage !== undefined && usage !== null && usage > 0
        ? inv.currentQuantity / usage
        : undefined;

    const safetyTrigger =
      inv.safetyStock !== undefined &&
      inv.safetyStock !== null &&
      inv.currentQuantity < inv.safetyStock;
    const leadTimeTrigger =
      daysRemaining !== undefined &&
      leadTime !== undefined &&
      leadTime !== null &&
      leadTime > 0 &&
      daysRemaining < leadTime * 1.5;

    const isLowStock = safetyTrigger || leadTimeTrigger;
    if (!isLowStock) continue;

    candidates.push({
      productName,
      daysRemaining,
      isLowStock: true,
      leadTimeDays: leadTime ?? undefined,
      // _rank: 정렬 키 — daysRemaining 작을수록 위급. undefined 는 큰 값으로.
      _rank: daysRemaining !== undefined ? daysRemaining : Number.POSITIVE_INFINITY,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a._rank - b._rank);
  const winner = candidates[0];
  return {
    productName: winner.productName,
    daysRemaining: winner.daysRemaining,
    isLowStock: winner.isLowStock,
    leadTimeDays: winner.leadTimeDays,
  };
}

/**
 * #operational-brief-emoji-sweep — 새 structured helper (Phase B-1).
 *
 * caller (quotes/page.tsx desktop §11.221 + mobile §11.222) 가 case + tone
 * 따라 Lucide icon + 컬러 도트 별도 표시. 메시지는 텍스트만.
 *
 * @example
 * const r = buildBriefRationale({
 *   blocker: "차단 없음", status: "회신 대기",
 *   replyCount: 0, totalItems: 1, isSent: true,
 * });
 * // r = { message: "발송 완료 → 회신 대기 중. ...", case: "awaiting_reply", tone: "amber" }
 */
export function buildBriefRationale(input: BriefRationaleInput): BriefRationaleResult {
  const base = buildBaseResult(input);
  const tail = buildInventoryTailResult(input.inventoryContext);
  return tail
    ? { message: base.message, case: base.case, tone: base.tone, inventoryTail: tail }
    : { message: base.message, case: base.case, tone: base.tone };
}

/**
 * 인과관계 한 줄 요약 (호영님 5/8 합의) — backward compat.
 *
 * #operational-brief-emoji-sweep — 이모지 제거 (텍스트만). caller 가 새 structured
 * helper buildBriefRationale 로 점진 마이그레이션 권장. 본 helper 는 text-only
 * 단일 string 반환 (기존 caller 호환).
 *
 * @example
 * buildBriefRationaleSummary({
 *   blocker: "공급사 미전송", status: "요청 생성 완료",
 *   replyCount: 0, totalItems: 1, isSent: false,
 *   inventoryContext: { mostUrgent: { productName: "FBS", daysRemaining: 5, isLowStock: true, leadTimeDays: 5 } },
 * });
 * // → "견적 미발송 → 비교·발주 차단 중. 발송이 첫 단계입니다.
 * //    FBS 5일 남음 / 예상 수령일 +5일"
 */
export function buildBriefRationaleSummary(input: BriefRationaleInput): string {
  const result = buildBriefRationale(input);
  return result.inventoryTail
    ? `${result.message}\n${result.inventoryTail.message}`
    : result.message;
}
