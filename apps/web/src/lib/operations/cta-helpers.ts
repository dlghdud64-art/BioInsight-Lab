/**
 * P7-2 — CTA Visibility / Disabled Helpers
 *
 * Pure functions that determine whether each CTA should be shown or disabled.
 * No side effects, no DB calls — just state inspection.
 */

import type { QuoteStatus, OrderStatus, PurchaseRequestStatus } from "@prisma/client";
import type { QuotePhase, PurchasePhase, ReceivingStatus, InventoryCondition } from "./state-definitions";
import { quoteStatusToPhase, computePurchasePhase } from "./state-definitions";
// §approver-axis (나)-2 — 승인 권한 역할 집합 정본 (client-safe · Prisma 미포함).
import { isOrgApprover } from "@/lib/permissions/org-approver-roles";

// ══════════════════════════════════════════════════════════════════════════════
// Quote CTAs
// ══════════════════════════════════════════════════════════════════════════════

export function canShowSendQuote(status: QuoteStatus): boolean {
  const phase = quoteStatusToPhase(status);
  return phase === "REQUEST";
}

export function canShowConfirmQuote(status: QuoteStatus): boolean {
  return status === "RESPONDED";
}

export function canShowConvertToPurchase(
  status: QuoteStatus,
  hasPurchaseRequest: boolean,
): boolean {
  const phase = quoteStatusToPhase(status);
  return phase === "CONFIRMED" && !hasPurchaseRequest;
}

export function canShowCancelQuote(status: QuoteStatus): boolean {
  const phase = quoteStatusToPhase(status);
  return phase !== "CANCELLED" && phase !== "CONFIRMED";
}

// ══════════════════════════════════════════════════════════════════════════════
// Purchase CTAs
// ══════════════════════════════════════════════════════════════════════════════

export function canShowSubmitApproval(
  prStatus: PurchaseRequestStatus,
  hasApprover: boolean,
): boolean {
  const phase = computePurchasePhase(prStatus, null, hasApprover);
  return phase === "REQUEST";
}

export function canShowApprovePurchase(
  prStatus: PurchaseRequestStatus,
  hasApprover: boolean,
  userRole: string,
  isRequester: boolean,
): boolean {
  const phase = computePurchasePhase(prStatus, null, hasApprover);
  if (phase !== "PENDING_APPROVAL") return false;
  if (isRequester) return false;
  // §approver-axis (나)-2 (2026-08-30) — 인라인 3역할 사본 제거. 정본 import.
  //   같은 집합이 코드에 여러 벌 있으면 한쪽만 바뀌어 화면끼리 승인권자 수가 갈린다
  //   (통일 전 실측: 정의 5개). 계산은 그대로, 출처만 정본으로 옮긴다.
  return isOrgApprover(userRole);
}

export function canShowRejectPurchase(
  prStatus: PurchaseRequestStatus,
  hasApprover: boolean,
  userRole: string,
  isRequester: boolean,
): boolean {
  return canShowApprovePurchase(prStatus, hasApprover, userRole, isRequester);
}

export function canShowCreateOrder(
  prStatus: PurchaseRequestStatus,
  hasLinkedOrder: boolean,
): boolean {
  return prStatus === "APPROVED" && !hasLinkedOrder;
}

// ══════════════════════════════════════════════════════════════════════════════
// Order CTAs
// ══════════════════════════════════════════════════════════════════════════════

export function canShowConfirmOrder(orderStatus: OrderStatus): boolean {
  return orderStatus === "ORDERED";
}

export function canShowStartShipping(orderStatus: OrderStatus): boolean {
  return orderStatus === "CONFIRMED";
}

export function canShowConfirmDelivery(orderStatus: OrderStatus): boolean {
  return orderStatus === "SHIPPING";
}

export function canShowCancelOrder(orderStatus: OrderStatus): boolean {
  return orderStatus === "ORDERED" || orderStatus === "CONFIRMED";
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving CTAs
// ══════════════════════════════════════════════════════════════════════════════

export function canShowCompleteReceiving(
  receivingStatus: ReceivingStatus,
  receivedQuantity: number,
): boolean {
  if (receivingStatus !== "PENDING" && receivingStatus !== "PARTIAL") return false;
  return receivedQuantity > 0;
}

export function canShowReportIssue(receivingStatus: ReceivingStatus): boolean {
  return receivingStatus === "PARTIAL";
}

// ══════════════════════════════════════════════════════════════════════════════
// Inventory CTAs
// ══════════════════════════════════════════════════════════════════════════════

export function canShowReorder(
  condition: InventoryCondition,
  hasActiveReorder: boolean,
): boolean {
  return condition === "LOW" && !hasActiveReorder;
}

export function canShowScheduleDisposal(
  condition: InventoryCondition,
  disposalAlreadyScheduled: boolean,
): boolean {
  if (disposalAlreadyScheduled) return false;
  return condition === "EXPIRED" || condition === "DISPOSAL_SCHEDULED";
}

// ══════════════════════════════════════════════════════════════════════════════
// Search / Compare CTAs
// ══════════════════════════════════════════════════════════════════════════════

export function canShowAddToCompare(
  compareListLength: number,
  alreadyInList: boolean,
): boolean {
  return compareListLength < 4 && !alreadyInList;
}

export function canShowRequestQuoteFromSearch(): boolean {
  return true; // Always visible when product selected
}

export function canShowRequestQuoteFromCompare(
  compareListLength: number,
  selectedCount: number,
): boolean {
  return compareListLength >= 1 && selectedCount > 0;
}
