/**
 * P7-1 — State Machine
 *
 * Centralized transition validation for all operational domains.
 * Each domain has an explicit allowed-transitions map.
 * No implicit transitions — if it's not in the map, it's forbidden.
 */

import type {
  QuoteStatus,
  OrderStatus,
  PurchaseRequestStatus,
} from "@prisma/client";
import type { ReceivingStatus, OperationDomain } from "./state-definitions";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Quote Transitions
// ══════════════════════════════════════════════════════════════════════════════

const ALLOWED_QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  PENDING: ["PARSED", "SENT", "CANCELLED"],
  PARSED: ["SENT", "CANCELLED"],
  SENT: ["RESPONDED", "COMPLETED", "CANCELLED"],
  RESPONDED: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["PURCHASED"],
  PURCHASED: [],
  CANCELLED: [],
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. Order Transitions
// ══════════════════════════════════════════════════════════════════════════════

const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ORDERED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

// ══════════════════════════════════════════════════════════════════════════════
// 3. PurchaseRequest Transitions
// ══════════════════════════════════════════════════════════════════════════════

const ALLOWED_PURCHASE_REQUEST_TRANSITIONS: Record<PurchaseRequestStatus, PurchaseRequestStatus[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
};

// ══════════════════════════════════════════════════════════════════════════════
// 4. Receiving Transitions
// ══════════════════════════════════════════════════════════════════════════════

const ALLOWED_RECEIVING_TRANSITIONS: Record<ReceivingStatus, ReceivingStatus[]> = {
  PENDING: ["PARTIAL", "COMPLETED"],
  PARTIAL: ["COMPLETED", "ISSUE"],
  COMPLETED: [],
  ISSUE: ["PARTIAL", "COMPLETED"],
};

// ══════════════════════════════════════════════════════════════════════════════
// 5. Transition Validation
// ══════════════════════════════════════════════════════════════════════════════

type TransitionMap = Record<string, string[]>;

const DOMAIN_TRANSITION_MAPS: Record<string, TransitionMap> = {
  QUOTE: ALLOWED_QUOTE_TRANSITIONS,
  ORDER: ALLOWED_ORDER_TRANSITIONS,
  PURCHASE: ALLOWED_PURCHASE_REQUEST_TRANSITIONS,
  RECEIVING: ALLOWED_RECEIVING_TRANSITIONS,
};

export interface TransitionResult {
  valid: boolean;
  reason?: string;
}

/**
 * Check whether a state transition is allowed.
 */
export function validateTransition(
  domain: OperationDomain,
  from: string,
  to: string,
): TransitionResult {
  const map = DOMAIN_TRANSITION_MAPS[domain];
  if (!map) {
    return { valid: false, reason: `Unknown domain: ${domain}` };
  }

  const allowed = map[from];
  if (!allowed) {
    return { valid: false, reason: `Unknown source state: ${from} in ${domain}` };
  }

  if (!allowed.includes(to)) {
    return {
      valid: false,
      reason: `Transition ${from} → ${to} is not allowed in ${domain}. Allowed: [${allowed.join(", ")}]`,
    };
  }

  return { valid: true };
}

/**
 * Assert that a transition is valid. Throws if not.
 */
export function assertTransitionAllowed(
  domain: OperationDomain,
  from: string,
  to: string,
): void {
  const result = validateTransition(domain, from, to);
  if (!result.valid) {
    throw new Error(`[StateTransition] ${result.reason}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. Receiving Gate
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Inventory increase is only allowed when receiving is COMPLETED.
 * This prevents partial/unverified stock from entering the system.
 */
export function canInventoryIncrease(receivingStatus: ReceivingStatus): boolean {
  return receivingStatus === "COMPLETED";
}

// ══════════════════════════════════════════════════════════════════════════════
// Exports for testing / introspection
// ══════════════════════════════════════════════════════════════════════════════

export {
  ALLOWED_QUOTE_TRANSITIONS,
  ALLOWED_ORDER_TRANSITIONS,
  ALLOWED_PURCHASE_REQUEST_TRANSITIONS,
  ALLOWED_RECEIVING_TRANSITIONS,
};
