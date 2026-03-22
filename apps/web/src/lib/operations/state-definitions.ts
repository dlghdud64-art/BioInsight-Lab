/**
 * P7-1 — Operations State Definitions
 *
 * Single source of truth for canonical states, Korean labels, badge colors,
 * and mapping functions across all 4 operational domains:
 *   Quote, Purchase, Receiving, Inventory
 *
 * DB enums are preserved; canonical phases are computed at the application layer.
 */

import type {
  QuoteStatus,
  OrderStatus,
  PurchaseRequestStatus,
} from "@prisma/client";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Quote Phase
// ══════════════════════════════════════════════════════════════════════════════

export type QuotePhase =
  | "REQUEST"          // 요청
  | "AWAITING_REPLY"   // 회신대기
  | "CONFIRMED"        // 확정
  | "CANCELLED";       // 취소

export const QUOTE_PHASE_LABELS: Record<QuotePhase, string> = {
  REQUEST: "요청",
  AWAITING_REPLY: "회신대기",
  CONFIRMED: "확정",
  CANCELLED: "취소",
};

export const QUOTE_PHASE_BADGE_COLORS: Record<QuotePhase, string> = {
  REQUEST: "bg-blue-100 text-blue-800",
  AWAITING_REPLY: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  CANCELLED: "bg-el text-gray-500",
};

const QUOTE_STATUS_TO_PHASE: Record<QuoteStatus, QuotePhase> = {
  PENDING: "REQUEST",
  PARSED: "REQUEST",
  SENT: "AWAITING_REPLY",
  RESPONDED: "AWAITING_REPLY",
  COMPLETED: "CONFIRMED",
  PURCHASED: "CONFIRMED",
  CANCELLED: "CANCELLED",
};

export function quoteStatusToPhase(status: QuoteStatus): QuotePhase {
  return QUOTE_STATUS_TO_PHASE[status];
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. Purchase Phase
// ══════════════════════════════════════════════════════════════════════════════

export type PurchasePhase =
  | "REQUEST"            // 요청
  | "PENDING_APPROVAL"   // 승인대기
  | "ORDERED"            // 발주
  | "RECEIVING"          // 입고중
  | "COMPLETED"          // 완료
  | "CANCELLED";         // 취소

export const PURCHASE_PHASE_LABELS: Record<PurchasePhase, string> = {
  REQUEST: "요청",
  PENDING_APPROVAL: "승인대기",
  ORDERED: "발주",
  RECEIVING: "입고중",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

export const PURCHASE_PHASE_BADGE_COLORS: Record<PurchasePhase, string> = {
  REQUEST: "bg-blue-100 text-blue-800",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  ORDERED: "bg-blue-100 text-blue-800",
  RECEIVING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-el text-gray-500",
};

/**
 * Compute canonical purchase phase from PurchaseRequest + optional Order.
 * The phase is derived from the combination of both entities' statuses.
 */
export function computePurchasePhase(
  prStatus: PurchaseRequestStatus,
  orderStatus?: OrderStatus | null,
  hasApprover?: boolean,
): PurchasePhase {
  if (prStatus === "CANCELLED") return "CANCELLED";
  if (prStatus === "REJECTED") return "CANCELLED";

  if (prStatus === "PENDING") {
    return hasApprover ? "PENDING_APPROVAL" : "REQUEST";
  }

  if (prStatus === "APPROVED") {
    if (!orderStatus) return "ORDERED";
    if (orderStatus === "CANCELLED") return "CANCELLED";
    if (orderStatus === "DELIVERED") return "COMPLETED";
    if (orderStatus === "SHIPPING") return "RECEIVING";
    // ORDERED, CONFIRMED
    return "ORDERED";
  }

  return "REQUEST";
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Receiving Status
// ══════════════════════════════════════════════════════════════════════════════

export type ReceivingStatus =
  | "PENDING"     // 대기
  | "PARTIAL"     // 일부입고
  | "COMPLETED"   // 완료
  | "ISSUE";      // 이슈

export const RECEIVING_STATUS_LABELS: Record<ReceivingStatus, string> = {
  PENDING: "대기",
  PARTIAL: "일부입고",
  COMPLETED: "완료",
  ISSUE: "이슈",
};

export const RECEIVING_STATUS_BADGE_COLORS: Record<ReceivingStatus, string> = {
  PENDING: "bg-el text-slate-700",
  PARTIAL: "bg-orange-100 text-orange-800",
  COMPLETED: "bg-green-100 text-green-800",
  ISSUE: "bg-red-100 text-red-800",
};

// ══════════════════════════════════════════════════════════════════════════════
// 4. Inventory Condition
// ══════════════════════════════════════════════════════════════════════════════

export type InventoryCondition =
  | "NORMAL"              // 정상
  | "LOW"                 // 부족
  | "EXPIRING"            // 유효기한 임박
  | "EXPIRED"             // 만료
  | "DISPOSAL_SCHEDULED"; // 폐기예정

export const INVENTORY_CONDITION_LABELS: Record<InventoryCondition, string> = {
  NORMAL: "정상",
  LOW: "부족",
  EXPIRING: "유효기한 임박",
  EXPIRED: "만료",
  DISPOSAL_SCHEDULED: "폐기예정",
};

export const INVENTORY_CONDITION_BADGE_COLORS: Record<InventoryCondition, string> = {
  NORMAL: "bg-green-100 text-green-800",
  LOW: "bg-yellow-100 text-yellow-800",
  EXPIRING: "bg-orange-100 text-orange-800",
  EXPIRED: "bg-red-100 text-red-800",
  DISPOSAL_SCHEDULED: "bg-el text-gray-600",
};

/** Days before expiry that triggers EXPIRING condition */
const EXPIRY_WARNING_DAYS = 30;

/**
 * Compute inventory condition from current state.
 * Priority: DISPOSAL_SCHEDULED > EXPIRED > EXPIRING > LOW > NORMAL
 */
export function computeInventoryCondition(inventory: {
  currentQuantity: number;
  safetyStock: number | null;
  expiryDate: Date | null;
  disposalScheduledAt?: Date | null;
}): InventoryCondition {
  const now = new Date();

  if (inventory.disposalScheduledAt) {
    return "DISPOSAL_SCHEDULED";
  }

  if (inventory.expiryDate) {
    if (inventory.expiryDate <= now) {
      return "EXPIRED";
    }
    const daysUntilExpiry = Math.ceil(
      (inventory.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
      return "EXPIRING";
    }
  }

  if (
    inventory.safetyStock !== null &&
    inventory.currentQuantity <= inventory.safetyStock
  ) {
    return "LOW";
  }

  return "NORMAL";
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. Domain enum (for transition logger / CTA logger)
// ══════════════════════════════════════════════════════════════════════════════

export type OperationDomain =
  | "QUOTE"
  | "PURCHASE"
  | "RECEIVING"
  | "INVENTORY"
  | "ORDER";
