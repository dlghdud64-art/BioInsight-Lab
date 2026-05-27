/**
 * P7-2 — CTA Routing Matrix
 *
 * All 20 CTAs across 7 screens. Each CTA has:
 *   - visibility condition (when to show)
 *   - disabled condition (when to gray out)
 *   - payload keys (what data travels with the click)
 *   - target screen + state
 *   - success/failure outcomes
 *   - log event name
 */

// ══════════════════════════════════════════════════════════════════════════════
// Screen IDs
// ══════════════════════════════════════════════════════════════════════════════

export type ScreenId =
  | "search"
  | "compare"
  | "quote"
  | "purchase"
  | "receiving"
  | "inventory"
  | "dashboard";

// ══════════════════════════════════════════════════════════════════════════════
// CTA Definition
// ══════════════════════════════════════════════════════════════════════════════

export interface CTADefinition {
  ctaId: string;
  ctaLabel: string;
  sourceScreen: ScreenId;
  visibleWhen: string;
  disabledWhen: string;
  payloadKeys: string[];
  targetScreen: ScreenId;
  targetState: string;
  successOutcome: string;
  failureOutcome: string;
  logEvent: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// CTA Labels (canonical Korean)
// ══════════════════════════════════════════════════════════════════════════════

export const CTA_LABELS = {
  ADD_TO_COMPARE: "비교함에 추가",
  REQUEST_QUOTE: "견적 요청",
  SEND_QUOTE: "견적 발송",
  CONFIRM_QUOTE: "견적 확정",
  CONVERT_TO_PURCHASE: "구매 전환",
  SUBMIT_APPROVAL: "승인 요청",
  APPROVE_PURCHASE: "구매 승인",
  REJECT_PURCHASE: "구매 반려",
  CREATE_ORDER: "발주 생성",
  CONFIRM_ORDER: "발주 확인",
  START_SHIPPING: "배송 시작",
  CONFIRM_DELIVERY: "배송 완료",
  START_RECEIVING: "입고 시작",
  COMPLETE_RECEIVING: "입고 완료",
  REPORT_ISSUE: "이슈 보고",
  ADD_INVENTORY: "재고 등록",
  REORDER: "재주문",
  SCHEDULE_DISPOSAL: "폐기 예약",
  CANCEL_QUOTE: "견적 취소",
  CANCEL_ORDER: "주문 취소",
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Forbidden CTA Labels (generic/ambiguous — never use these)
// ══════════════════════════════════════════════════════════════════════════════

export const FORBIDDEN_CTA_LABELS = [
  "자세히 보기",
  "확인",
  "진행",
  "다음",
  "완료",
  "처리",
  "실행",
  "Go",
  "Submit",
  "Next",
  "OK",
  "Continue",
  "Proceed",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// CTA Routing Matrix — 20 CTAs
// ══════════════════════════════════════════════════════════════════════════════

export const CTA_ROUTING_MATRIX: CTADefinition[] = [
  // ── Search Screen ──
  {
    ctaId: "CTA-S1",
    ctaLabel: CTA_LABELS.ADD_TO_COMPARE,
    sourceScreen: "search",
    visibleWhen: "product selected && compareList.length < 4",
    disabledWhen: "product already in compareList",
    payloadKeys: ["productId"],
    targetScreen: "compare",
    targetState: "compareList updated",
    successOutcome: "Product added to compare list",
    failureOutcome: "Compare list full (max 4)",
    logEvent: "CTA_ADD_TO_COMPARE",
  },
  {
    ctaId: "CTA-S2",
    ctaLabel: CTA_LABELS.REQUEST_QUOTE,
    sourceScreen: "search",
    visibleWhen: "product selected",
    disabledWhen: "no vendor info available",
    payloadKeys: ["productId", "vendorId", "quantity"],
    targetScreen: "quote",
    targetState: "quote.status = PENDING",
    successOutcome: "Quote created with PENDING status",
    failureOutcome: "Quote creation failed — show error toast",
    logEvent: "CTA_REQUEST_QUOTE",
  },

  // ── Compare Screen ──
  {
    ctaId: "CTA-C1",
    ctaLabel: CTA_LABELS.REQUEST_QUOTE,
    sourceScreen: "compare",
    visibleWhen: "compareList.length >= 1",
    disabledWhen: "no products selected for quote",
    payloadKeys: ["productIds[]", "vendorIds[]", "quantities[]"],
    targetScreen: "quote",
    targetState: "quote.status = PENDING",
    successOutcome: "Batch quote created for selected products",
    failureOutcome: "Quote creation failed — show error toast",
    logEvent: "CTA_BATCH_REQUEST_QUOTE",
  },

  // ── Quote Screen ──
  {
    ctaId: "CTA-Q1",
    ctaLabel: CTA_LABELS.SEND_QUOTE,
    sourceScreen: "quote",
    visibleWhen: "quote.phase === REQUEST",
    disabledWhen: "quote missing required fields",
    payloadKeys: ["quoteId"],
    targetScreen: "quote",
    targetState: "quote.status = SENT",
    successOutcome: "Quote sent to vendor",
    failureOutcome: "Send failed — retry or cancel",
    logEvent: "CTA_SEND_QUOTE",
  },
  {
    ctaId: "CTA-Q2",
    ctaLabel: CTA_LABELS.CONFIRM_QUOTE,
    sourceScreen: "quote",
    visibleWhen: "quote.phase === AWAITING_REPLY",
    disabledWhen: "quote.status !== RESPONDED",
    payloadKeys: ["quoteId"],
    targetScreen: "quote",
    targetState: "quote.status = COMPLETED",
    successOutcome: "Quote confirmed — purchase CTA enabled",
    failureOutcome: "Confirmation failed",
    logEvent: "CTA_CONFIRM_QUOTE",
  },
  {
    ctaId: "CTA-Q3",
    ctaLabel: CTA_LABELS.CONVERT_TO_PURCHASE,
    sourceScreen: "quote",
    visibleWhen: "quote.phase === CONFIRMED",
    disabledWhen: "quote already has linked purchaseRequest",
    payloadKeys: ["quoteId", "quoteItems[]"],
    targetScreen: "purchase",
    targetState: "purchaseRequest.status = PENDING",
    successOutcome: "PurchaseRequest created from quote",
    failureOutcome: "Conversion failed",
    logEvent: "CTA_CONVERT_TO_PURCHASE",
  },
  {
    ctaId: "CTA-Q4",
    ctaLabel: CTA_LABELS.CANCEL_QUOTE,
    sourceScreen: "quote",
    visibleWhen: "quote.phase !== CANCELLED && quote.phase !== CONFIRMED",
    disabledWhen: "never",
    payloadKeys: ["quoteId", "cancelReason"],
    targetScreen: "quote",
    targetState: "quote.status = CANCELLED",
    successOutcome: "Quote cancelled",
    failureOutcome: "Cancel failed",
    logEvent: "CTA_CANCEL_QUOTE",
  },

  // ── Purchase Screen ──
  {
    ctaId: "CTA-P1",
    ctaLabel: CTA_LABELS.SUBMIT_APPROVAL,
    sourceScreen: "purchase",
    visibleWhen: "purchase.phase === REQUEST",
    disabledWhen: "no approver assigned in org",
    payloadKeys: ["purchaseRequestId", "approverId"],
    targetScreen: "purchase",
    targetState: "purchase.phase = PENDING_APPROVAL",
    successOutcome: "Approval request sent to approver",
    failureOutcome: "Submission failed",
    logEvent: "CTA_SUBMIT_APPROVAL",
  },
  {
    ctaId: "CTA-P2",
    ctaLabel: CTA_LABELS.APPROVE_PURCHASE,
    sourceScreen: "purchase",
    visibleWhen: "purchase.phase === PENDING_APPROVAL && user.role >= APPROVER",
    disabledWhen: "user is the requester",
    payloadKeys: ["purchaseRequestId"],
    targetScreen: "purchase",
    targetState: "purchaseRequest.status = APPROVED",
    successOutcome: "Purchase approved — order CTA enabled",
    failureOutcome: "Approval failed",
    logEvent: "CTA_APPROVE_PURCHASE",
  },
  {
    ctaId: "CTA-P3",
    ctaLabel: CTA_LABELS.REJECT_PURCHASE,
    sourceScreen: "purchase",
    visibleWhen: "purchase.phase === PENDING_APPROVAL && user.role >= APPROVER",
    disabledWhen: "user is the requester",
    payloadKeys: ["purchaseRequestId", "rejectionReason"],
    targetScreen: "purchase",
    targetState: "purchaseRequest.status = REJECTED",
    successOutcome: "Purchase rejected",
    failureOutcome: "Rejection failed",
    logEvent: "CTA_REJECT_PURCHASE",
  },
  {
    ctaId: "CTA-P4",
    ctaLabel: CTA_LABELS.CREATE_ORDER,
    sourceScreen: "purchase",
    visibleWhen: "purchase.phase === ORDERED && no linked Order",
    disabledWhen: "purchaseRequest.status !== APPROVED",
    payloadKeys: ["purchaseRequestId", "vendorId", "items[]"],
    targetScreen: "purchase",
    targetState: "order.status = ORDERED",
    successOutcome: "Order created + receiving records auto-created",
    failureOutcome: "Order creation failed",
    logEvent: "CTA_CREATE_ORDER",
  },

  // ── Order sub-actions (within Purchase screen) ──
  {
    ctaId: "CTA-O1",
    ctaLabel: CTA_LABELS.CONFIRM_ORDER,
    sourceScreen: "purchase",
    visibleWhen: "order.status === ORDERED",
    disabledWhen: "never",
    payloadKeys: ["orderId"],
    targetScreen: "purchase",
    targetState: "order.status = CONFIRMED",
    successOutcome: "Order confirmed by vendor",
    failureOutcome: "Confirmation failed",
    logEvent: "CTA_CONFIRM_ORDER",
  },
  {
    ctaId: "CTA-O2",
    ctaLabel: CTA_LABELS.START_SHIPPING,
    sourceScreen: "purchase",
    visibleWhen: "order.status === CONFIRMED",
    disabledWhen: "never",
    payloadKeys: ["orderId", "trackingNumber"],
    targetScreen: "purchase",
    targetState: "order.status = SHIPPING",
    successOutcome: "Shipping started",
    failureOutcome: "Update failed",
    logEvent: "CTA_START_SHIPPING",
  },
  {
    ctaId: "CTA-O3",
    ctaLabel: CTA_LABELS.CONFIRM_DELIVERY,
    sourceScreen: "purchase",
    visibleWhen: "order.status === SHIPPING",
    disabledWhen: "never",
    payloadKeys: ["orderId"],
    targetScreen: "receiving",
    targetState: "order.status = DELIVERED, receiving CTA enabled",
    successOutcome: "Delivery confirmed — navigate to receiving",
    failureOutcome: "Delivery confirmation failed",
    logEvent: "CTA_CONFIRM_DELIVERY",
  },
  {
    ctaId: "CTA-O4",
    ctaLabel: CTA_LABELS.CANCEL_ORDER,
    sourceScreen: "purchase",
    visibleWhen: "order.status === ORDERED || order.status === CONFIRMED",
    disabledWhen: "order.status === SHIPPING || order.status === DELIVERED",
    payloadKeys: ["orderId", "cancelReason"],
    targetScreen: "purchase",
    targetState: "order.status = CANCELLED",
    successOutcome: "Order cancelled",
    failureOutcome: "Cancel failed — order may be in transit",
    logEvent: "CTA_CANCEL_ORDER",
  },

  // ── Receiving Screen ──
  {
    ctaId: "CTA-R1",
    ctaLabel: CTA_LABELS.COMPLETE_RECEIVING,
    sourceScreen: "receiving",
    visibleWhen: "receiving.status === PENDING || receiving.status === PARTIAL",
    disabledWhen: "receivedQuantity === 0",
    payloadKeys: ["restockId", "receivedQuantity", "lotNumber", "expiryDate"],
    targetScreen: "receiving",
    targetState: "receiving.status = COMPLETED, inventory increased",
    successOutcome: "Receiving completed — inventory auto-updated",
    failureOutcome: "Receiving failed — check quantity/lot",
    logEvent: "CTA_COMPLETE_RECEIVING",
  },
  {
    ctaId: "CTA-R2",
    ctaLabel: CTA_LABELS.REPORT_ISSUE,
    sourceScreen: "receiving",
    visibleWhen: "receiving.status === PARTIAL",
    disabledWhen: "never",
    payloadKeys: ["restockId", "issueNote"],
    targetScreen: "receiving",
    targetState: "receiving.status = ISSUE",
    successOutcome: "Issue reported — follow-up required",
    failureOutcome: "Report failed",
    logEvent: "CTA_REPORT_ISSUE",
  },

  // ── Inventory Screen ──
  {
    ctaId: "CTA-I1",
    ctaLabel: CTA_LABELS.REORDER,
    sourceScreen: "inventory",
    visibleWhen: "inventory.condition === LOW",
    disabledWhen: "active reorder already exists",
    payloadKeys: ["inventoryId", "productId", "suggestedQuantity"],
    targetScreen: "quote",
    targetState: "quote.status = PENDING (pre-filled from inventory)",
    successOutcome: "Reorder quote created",
    failureOutcome: "Reorder failed",
    logEvent: "CTA_REORDER",
  },
  {
    ctaId: "CTA-I2",
    ctaLabel: CTA_LABELS.SCHEDULE_DISPOSAL,
    sourceScreen: "inventory",
    visibleWhen: "inventory.condition === EXPIRED || inventory.condition === DISPOSAL_SCHEDULED",
    disabledWhen: "disposal already scheduled",
    payloadKeys: ["inventoryId", "disposalDate", "reason"],
    targetScreen: "inventory",
    targetState: "inventory.disposalScheduledAt set",
    successOutcome: "Disposal scheduled",
    failureOutcome: "Schedule failed",
    logEvent: "CTA_SCHEDULE_DISPOSAL",
  },
];
