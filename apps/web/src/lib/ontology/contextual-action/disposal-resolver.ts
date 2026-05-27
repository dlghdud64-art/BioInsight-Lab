/**
 * Ontology Disposal Resolver
 * ────────────────────────────────────────────────────────────
 * Deterministic next-step resolver for LOT disposal.
 *
 * Input:  selected lot / qty / expiry / hazardous / msds / safety-stock
 * Output: disposal route + contextual metadata
 *
 * Rules (ordered):
 *   1. MSDS missing & hazardous → msds_check_then_dispose
 *   2. Hazardous / requires isolation → quarantine_then_dispose
 *   3. Disposal causes safety-stock breach → dispose_and_reorder_review
 *   4. Otherwise → immediate_dispose
 */

// ── Types ──

export interface DisposalInput {
  /** 품목 정보 */
  productName: string;
  brand?: string;
  catalogNumber?: string;
  unit?: string;

  /** LOT 정보 */
  lotNumber: string;
  lotQuantity: number;
  expiryDate: string;
  location?: string;

  /** 위험물/MSDS */
  isHazardous?: boolean;
  hasMsds?: boolean;
  requiresIsolation?: boolean;

  /** 재고 영향 */
  totalItemQuantity: number; // 전체 item (parent) 수량
  safetyStock?: number;

  /** 사용 추이 */
  averageDailyUsage?: number;
}

export type DisposalRoute =
  | "immediate_dispose"
  | "quarantine_then_dispose"
  | "msds_check_then_dispose"
  | "dispose_and_reorder_review";

export interface DisposalResolution {
  route: DisposalRoute;
  title: string;
  description: string;

  /** 기본 폐기 사유 */
  defaultReason: DisposalReason;

  /** 격리 필요 여부 */
  requiresQuarantine: boolean;

  /** 폐기 후 안전재고 미달 여부 */
  causesStockBreach: boolean;

  /** 폐기 후 예상 잔량 */
  remainingAfterDisposal: number;

  /** 재주문 검토 필요 여부 */
  needsReorderReview: boolean;

  /** MSDS 확인 필요 여부 */
  needsMsdsCheck: boolean;
}

export type DisposalReason =
  | "expiry"
  | "contamination"
  | "damage"
  | "other";

export const DISPOSAL_REASON_LABELS: Record<DisposalReason, string> = {
  expiry: "유효기간 만료",
  contamination: "오염/변질",
  damage: "파손",
  other: "기타",
};

// ── Resolver ──

export function resolveDisposal(input: DisposalInput): DisposalResolution {
  const remainingAfterDisposal = input.totalItemQuantity - input.lotQuantity;
  const safetyStock = input.safetyStock ?? 0;
  const causesStockBreach = safetyStock > 0 && remainingAfterDisposal < safetyStock;
  const needsReorderReview = causesStockBreach;

  // 만료 여부로 기본 사유 결정
  const expiryDate = new Date(input.expiryDate);
  const isExpired = expiryDate.getTime() < Date.now();
  const defaultReason: DisposalReason = isExpired ? "expiry" : "other";

  // MSDS 미확보 + 위험물
  const needsMsdsCheck = !!input.isHazardous && !input.hasMsds;
  if (needsMsdsCheck) {
    return {
      route: "msds_check_then_dispose",
      title: "MSDS 확인 후 폐기",
      description: "위험물로 분류되었으나 MSDS가 확인되지 않았습니다. MSDS를 먼저 확인한 후 폐기를 진행하세요.",
      defaultReason,
      requiresQuarantine: true,
      causesStockBreach,
      remainingAfterDisposal,
      needsReorderReview,
      needsMsdsCheck: true,
    };
  }

  // 위험물 또는 격리 필요
  const requiresQuarantine = !!input.isHazardous || !!input.requiresIsolation;
  if (requiresQuarantine) {
    return {
      route: "quarantine_then_dispose",
      title: "격리 후 폐기",
      description: "위험물 또는 격리 대상입니다. 격리 조치 후 폐기를 진행합니다.",
      defaultReason,
      requiresQuarantine: true,
      causesStockBreach,
      remainingAfterDisposal,
      needsReorderReview,
      needsMsdsCheck: false,
    };
  }

  // 안전재고 미달 발생
  if (causesStockBreach) {
    return {
      route: "dispose_and_reorder_review",
      title: "폐기 후 재주문 검토",
      description: `폐기 시 안전재고(${safetyStock}${input.unit || "ea"}) 미달이 발생합니다. 폐기 확정 후 재주문을 검토하세요.`,
      defaultReason,
      requiresQuarantine: false,
      causesStockBreach: true,
      remainingAfterDisposal,
      needsReorderReview: true,
      needsMsdsCheck: false,
    };
  }

  // 즉시 폐기
  return {
    route: "immediate_dispose",
    title: isExpired ? "만료 LOT 폐기 처리" : "LOT 폐기 처리",
    description: isExpired
      ? "유효기간이 만료된 LOT입니다. 폐기를 진행하세요."
      : "해당 LOT의 폐기를 진행합니다.",
    defaultReason,
    requiresQuarantine: false,
    causesStockBreach: false,
    remainingAfterDisposal,
    needsReorderReview: false,
    needsMsdsCheck: false,
  };
}
