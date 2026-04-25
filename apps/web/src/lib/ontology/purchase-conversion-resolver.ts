/**
 * apps/web/src/lib/ontology/purchase-conversion-resolver.ts
 *
 * #P02 Phase B-α (PLAN_phase-b-alpha-purchase-conversion.md, ADR-002 §11.10
 * follow-up): deterministic, rule-based composer that takes the existing
 * canonical models (Quote + replies + vendors + vendorRequests + order +
 * AiActionItem) and emits a flat PurchaseConversionItem for the
 * /dashboard/purchases UI.
 *
 * DESIGN PRINCIPLES (mirrors ontology-next-action-resolver.ts):
 *  1. Pure function. No I/O, no Prisma, no fetch. All inputs explicit.
 *  2. Rule-based, not LLM. Same surface as the deterministic next-action
 *     resolver — every branch is testable.
 *  3. Reads only. Never mutates inputs.
 *  4. Conservative defaults. When data is missing (e.g. no per-reply price
 *     yet), default to the safer rendering: blockerType "approval_unknown",
 *     externalApprovalStatus "unknown", selectedOptionId null.
 *  5. v0 ships with the fields that exist today. Fields that need new schema
 *     (selectedReplyId persistence, real Approval model, AI rationale) are
 *     parked behind null/"unknown"/empty rationale so the UI can render
 *     them as not-yet-decided without dead-button risk.
 */

// ──────────────────────────────────────────────────────────
// Public types — match the UI's old PurchaseExecutionItem shape
// ──────────────────────────────────────────────────────────

export type ConversionStatus =
  | "review_required"
  | "ready_for_po"
  | "hold"
  | "confirmed";

export type BlockerType =
  | "none"
  | "partial_reply"
  | "price_gap"
  | "lead_time"
  | "moq_issue"
  | "approval_unknown";

export type NextAction =
  | "review_selection"
  | "prepare_po"
  | "wait_reply"
  | "check_external_approval";

export type AiRecommendationStatus = "recommended" | "review_needed" | "hold";

export type ExternalApprovalStatus = "approved" | "pending" | "unknown";

export type RecommendationLevel = "primary" | "alternate" | "conservative";

export interface AiOption {
  readonly id: string;
  readonly supplierName: string;
  readonly recommendationLevel: RecommendationLevel;
  readonly price: number | null;
  readonly leadDays: number | null;
  readonly moq: number | null;
  readonly rationale: readonly string[];
}

export interface PurchaseConversionItem {
  readonly id: string;
  readonly requestTitle: string;
  readonly itemSummary: string;
  readonly totalBudget: number | null;
  readonly currency: string;
  readonly quoteNumber: string | null;
  readonly createdDaysAgo: number;
  readonly validUntil: Date | null;
  readonly isExpired: boolean;
  readonly conversionStatus: ConversionStatus;
  readonly blockerType: BlockerType;
  readonly blockerReason: string;
  readonly nextAction: NextAction;
  readonly nextStage: string;
  readonly supplierReplies: number;
  readonly totalSuppliers: number;
  readonly aiRecommendationStatus: AiRecommendationStatus;
  readonly aiOptions: readonly AiOption[];
  readonly selectedOptionId: string | null;
  readonly externalApprovalStatus: ExternalApprovalStatus;
}

// ──────────────────────────────────────────────────────────
// Input shape — what the server-side composer endpoint will pass in.
// Kept Prisma-agnostic: only the fields the resolver actually reads.
// ──────────────────────────────────────────────────────────

/** Minimal Quote subset the resolver needs. Mirrors prisma `model Quote`. */
export interface QuoteInput {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  /**
   * QuoteStatus enum from prisma:
   * "PENDING" | "PARSED" | "SENT" | "RESPONDED" | "COMPLETED" | "PURCHASED" | "CANCELLED"
   */
  readonly status: string;
  readonly totalAmount: number | null;
  readonly currency: string;
  readonly quoteNumber: string | null;
  readonly validUntil: Date | null;
  readonly createdAt: Date;
}

/** Minimal QuoteVendor subset. Mirrors prisma `model QuoteVendor`. */
export interface QuoteVendorInput {
  readonly id: string;
  readonly vendorName: string;
  readonly email: string | null;
}

/**
 * Minimal QuoteVendorRequest subset. Mirrors prisma `model QuoteVendorRequest`.
 * `respondedAt` non-null means the vendor submitted a response via the public
 * RFQ token path.
 */
export interface QuoteVendorRequestInput {
  readonly id: string;
  readonly vendorName: string | null;
  readonly vendorEmail: string | null;
  /** "SENT" | "RESPONDED" | "EXPIRED" | ... — VendorRequestStatus enum. */
  readonly status: string;
  readonly respondedAt: Date | null;
}

/** Minimal QuoteReply subset. Mirrors prisma `model QuoteReply` (email-based). */
export interface QuoteReplyInput {
  readonly id: string;
  readonly vendorName: string | null;
  readonly fromEmail: string;
  readonly receivedAt: Date;
}

/** Minimal Order subset. Mirrors prisma `model Order`. */
export interface OrderInput {
  readonly id: string;
  readonly orderNumber: string;
  /** OrderStatus enum: "ORDERED" | "SHIPPING" | "DELIVERED" | "CANCELLED" | ... */
  readonly status: string;
}

/** Minimal AiActionItem subset. Mirrors prisma `model AiActionItem`. */
export interface AiActionInput {
  readonly id: string;
  /** AiActionType enum. */
  readonly type: string;
  /** AiActionStatus enum: "PENDING" | "APPROVED" | "DISMISSED" | ... */
  readonly status: string;
  /** TaskStatus enum: "READY" | "REVIEW_NEEDED" | "ACTION_NEEDED" | ... */
  readonly taskStatus: string;
}

export interface PurchaseConversionInput {
  readonly quote: QuoteInput;
  readonly vendors: readonly QuoteVendorInput[];
  readonly vendorRequests: readonly QuoteVendorRequestInput[];
  readonly replies: readonly QuoteReplyInput[];
  readonly order: OrderInput | null;
  readonly aiActions: readonly AiActionInput[];
  readonly now: Date;
}

// ──────────────────────────────────────────────────────────
// Label maps — Korean display strings for the UI
// ──────────────────────────────────────────────────────────

const BLOCKER_REASON: Record<BlockerType, string> = {
  none: "차단 없음 — 즉시 발주 가능",
  partial_reply: "공급사 회신 미완료 — 비교 불완전",
  price_gap: "공급사 간 가격 차이 큼 — 선택안 검토 필요",
  lead_time: "견적 유효기간 만료 — 재요청 필요",
  moq_issue: "최소 주문 수량 충돌 — 조정 필요",
  approval_unknown: "외부 승인 결과 미확인",
};

const NEXT_STAGE: Record<NextAction, string> = {
  review_selection: "선택안 확정 후 발주 전환",
  prepare_po: "PO 생성 → 공급사 발송",
  wait_reply: "추가 회신 확보 후 선택안 검토",
  check_external_approval: "외부 승인 확인 → 발주 전환",
};

// ──────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function isQuoteExpired(quote: QuoteInput, now: Date): boolean {
  return quote.validUntil !== null && quote.validUntil.getTime() < now.getTime();
}

function isOrderConfirmedShape(order: OrderInput): boolean {
  // OrderStatus values that mean "fulfilled" for UI purposes.
  return order.status === "DELIVERED" || order.status === "COMPLETED";
}

function countReplies(input: PurchaseConversionInput): number {
  // Count distinct vendors that replied via either the email channel
  // (QuoteReply) or the public RFQ token channel (QuoteVendorRequest with
  // respondedAt). Use vendor names as the dedupe key when available.
  const repliedKeys = new Set<string>();
  for (const reply of input.replies) {
    repliedKeys.add(reply.vendorName?.trim() || reply.fromEmail.trim().toLowerCase());
  }
  for (const req of input.vendorRequests) {
    if (req.respondedAt !== null) {
      repliedKeys.add(req.vendorName?.trim() || req.vendorEmail?.trim().toLowerCase() || req.id);
    }
  }
  return repliedKeys.size;
}

function countTotalSuppliers(input: PurchaseConversionInput): number {
  // Take the max of explicit vendor list and outbound RFQ requests.
  // Either path counts as "an ask was made / a supplier is on the table".
  return Math.max(input.vendors.length, input.vendorRequests.length);
}

function deriveConversionStatus(
  input: PurchaseConversionInput,
  supplierReplies: number,
  totalSuppliers: number,
): ConversionStatus {
  const { quote, order } = input;

  // Order present → forward of "ready" or "confirmed"
  if (order !== null) {
    if (isOrderConfirmedShape(order)) return "confirmed";
    return "ready_for_po";
  }

  // PURCHASED on the quote means a PurchaseRecord exists (legacy path)
  if (quote.status === "PURCHASED") return "confirmed";
  if (quote.status === "COMPLETED") return "ready_for_po";
  if (quote.status === "CANCELLED") return "hold";

  // RESPONDED with all suppliers in → ready
  if (
    quote.status === "RESPONDED" &&
    totalSuppliers > 0 &&
    supplierReplies >= totalSuppliers
  ) {
    return "ready_for_po";
  }

  // Default: needs review
  return "review_required";
}

function deriveBlockerType(
  input: PurchaseConversionInput,
  conversionStatus: ConversionStatus,
  supplierReplies: number,
  totalSuppliers: number,
): BlockerType {
  // Confirmed / hold are not "blocked" in the actionable sense
  if (conversionStatus === "confirmed") return "none";
  if (input.quote.status === "CANCELLED") return "none";

  // Expired quote is the most concrete blocker we can detect today
  if (isQuoteExpired(input.quote, input.now)) return "lead_time";

  // Partial reply takes priority over approval unknown — operator should
  // chase replies first
  if (totalSuppliers > 0 && supplierReplies < totalSuppliers) {
    return "partial_reply";
  }

  // Ready for PO but external approval signal is missing → flag for the
  // operator. Approval data isn't modelled yet (see plan §0.2 / §1) so we
  // surface "approval_unknown" instead of fabricating an approved/pending.
  if (conversionStatus === "ready_for_po") {
    return "approval_unknown";
  }

  // No specific blocker visible; the queue will route the operator to
  // selection review via nextAction
  return "none";
}

function deriveNextAction(
  conversionStatus: ConversionStatus,
  blockerType: BlockerType,
): NextAction {
  if (blockerType === "partial_reply") return "wait_reply";
  if (blockerType === "approval_unknown") return "check_external_approval";
  if (conversionStatus === "ready_for_po" || conversionStatus === "confirmed") {
    return "prepare_po";
  }
  return "review_selection";
}

function deriveAiRecommendationStatus(
  input: PurchaseConversionInput,
  supplierReplies: number,
): AiRecommendationStatus {
  // Look for explicit AI signal first
  for (const action of input.aiActions) {
    // Anything still asking for human review pins the status to review_needed
    if (
      action.taskStatus === "REVIEW_NEEDED" ||
      action.status === "PENDING"
    ) {
      return "review_needed";
    }
  }

  for (const action of input.aiActions) {
    if (action.status === "APPROVED") return "recommended";
  }

  // No AI signal — fall back to a conservative rule:
  //   any reply at all → recommended (operator has data to choose from)
  //   no replies      → hold
  return supplierReplies > 0 ? "recommended" : "hold";
}

function buildAiOptions(input: PurchaseConversionInput): readonly AiOption[] {
  // v0: enumerate the suppliers we know about, label the first as primary,
  // the rest as alternate. price/leadDays/moq are not modelled per-supplier
  // yet, so they are nulls and the UI should render "—".
  const suppliers: { id: string; name: string; replied: boolean }[] = [];

  // Track names already seen so we don't double-list a vendor that exists
  // both in the static vendors list AND a vendorRequest.
  const seen = new Set<string>();

  function add(id: string, name: string | null | undefined, replied: boolean) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    suppliers.push({ id, name: trimmed, replied });
  }

  // Email replies first — strongest signal a real supplier engaged
  for (const reply of input.replies) {
    add(reply.id, reply.vendorName, true);
  }
  // Then explicit vendor records
  for (const vendor of input.vendors) {
    const replied = input.replies.some(
      (r) =>
        (r.vendorName || "").trim().toLowerCase() ===
        vendor.vendorName.trim().toLowerCase(),
    );
    add(vendor.id, vendor.vendorName, replied);
  }
  // Finally outbound RFQ requests
  for (const req of input.vendorRequests) {
    add(req.id, req.vendorName, req.respondedAt !== null);
  }

  return suppliers.map((s, idx) => ({
    id: s.id,
    supplierName: s.name,
    recommendationLevel:
      idx === 0 ? "primary" : s.replied ? "alternate" : "conservative",
    price: null,
    leadDays: null,
    moq: null,
    rationale: s.replied ? (["회신 완료"] as const) : (["회신 대기"] as const),
  }));
}

// ──────────────────────────────────────────────────────────
// Public entry point
// ──────────────────────────────────────────────────────────

export function resolvePurchaseConversion(
  input: PurchaseConversionInput,
): PurchaseConversionItem {
  const supplierReplies = countReplies(input);
  const totalSuppliers = countTotalSuppliers(input);
  const conversionStatus = deriveConversionStatus(
    input,
    supplierReplies,
    totalSuppliers,
  );
  const blockerType = deriveBlockerType(
    input,
    conversionStatus,
    supplierReplies,
    totalSuppliers,
  );
  const nextAction = deriveNextAction(conversionStatus, blockerType);
  const aiRecommendationStatus = deriveAiRecommendationStatus(
    input,
    supplierReplies,
  );
  const aiOptions = buildAiOptions(input);

  // itemSummary: prefer description, fall back to "{N}개 품목" placeholder
  const itemSummary =
    input.quote.description?.trim() ||
    (totalSuppliers > 0 ? `공급사 ${totalSuppliers}곳` : "품목 정보 없음");

  return {
    id: input.quote.id,
    requestTitle: input.quote.title,
    itemSummary,
    totalBudget: input.quote.totalAmount,
    currency: input.quote.currency,
    quoteNumber: input.quote.quoteNumber,
    createdDaysAgo: Math.max(0, daysBetween(input.quote.createdAt, input.now)),
    validUntil: input.quote.validUntil,
    isExpired: isQuoteExpired(input.quote, input.now),
    conversionStatus,
    blockerType,
    blockerReason: BLOCKER_REASON[blockerType],
    nextAction,
    nextStage: NEXT_STAGE[nextAction],
    supplierReplies,
    totalSuppliers,
    aiRecommendationStatus,
    aiOptions,
    // v0: no schema column for selected reply yet (see plan §1 / §7)
    selectedOptionId: null,
    // v0: no Approval model yet (see plan §0.2)
    externalApprovalStatus: "unknown",
  };
}
