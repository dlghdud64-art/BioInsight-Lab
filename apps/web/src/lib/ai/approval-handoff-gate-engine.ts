/**
 * Approval Handoff Gate Engine — compare review → approval 이관 전 canonical gate
 *
 * 고정 규칙:
 * 1. compare review completed ≠ approval ready — gate가 별도 상태로 분리.
 * 2. blocked = 절대 handoff 불가, warning = operator 확인 후 가능, ready = 즉시 가능.
 * 3. canonical approval handoff package를 생성해서 approval workbench 단일 입력 source로.
 * 4. gate는 dead-end가 아니라 fix-and-return loop.
 * 5. preview가 actual truth를 덮지 않음.
 */

import type { CompareReviewCenterState, CompareOption, SelectionReasonCode } from "./compare-review-center-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Gate Status
// ══════════════════════════════════════════════════════════════════════════════

export type ApprovalHandoffGateStatus = "not_ready" | "blocked" | "warning" | "ready" | "handed_off";

// ══════════════════════════════════════════════════════════════════════════════
// Blocker / Warning
// ══════════════════════════════════════════════════════════════════════════════

export type GateItemSeverity = "blocker" | "warning" | "info";

export interface GateItem {
  id: string;
  severity: GateItemSeverity;
  message: string;
  fixAction: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Gate State
// ══════════════════════════════════════════════════════════════════════════════

export interface ApprovalHandoffGateState {
  gateStatus: ApprovalHandoffGateStatus;
  gateEnteredAt: string;
  compareReviewId: string;
  requestReference: string;
  gateItems: GateItem[];
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  approvalPayloadPreview: ApprovalPayloadPreview | null;
  handoffPackageId: string | null;
  handedOffAt: string | null;
  handedOffBy: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Approval Payload Preview (read-only — does NOT override canonical truth)
// ══════════════════════════════════════════════════════════════════════════════

export interface ApprovalPayloadPreview {
  selectedOptionSummary: string;
  vendorSummary: string;
  qtyPackPriceSummary: string;
  expectedLeadTimeSummary: string;
  selectionRationaleSummary: string;
  exclusionSummary: string;
  followupStatus: string;
  requesterContext: string;
  budgetPolicyNote: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Gate Evaluation
// ══════════════════════════════════════════════════════════════════════════════

export function evaluateApprovalHandoffGate(
  reviewState: CompareReviewCenterState,
): ApprovalHandoffGateState {
  const gateItems: GateItem[] = [];

  const shortlisted = reviewState.options.filter((o) => o.reviewStatus === "shortlisted");
  const excluded = reviewState.options.filter((o) => o.reviewStatus === "excluded");
  const followup = reviewState.options.filter((o) => o.reviewStatus === "needs_followup");

  // ── Hard blockers ──
  if (reviewState.compareReviewCenterStatus !== "completed" && reviewState.compareReviewCenterStatus !== "handoff_ready") {
    gateItems.push({ id: "blk_not_completed", severity: "blocker", message: "검토가 아직 완료되지 않았습니다", fixAction: "검토로 돌아가기" });
  }

  if (shortlisted.length === 0) {
    gateItems.push({ id: "blk_no_shortlist", severity: "blocker", message: "Shortlist가 0개입니다", fixAction: "후보 선택" });
  }

  const slWithoutReason = shortlisted.filter((o) => o.rationale.selectionReasonCodes.length === 0);
  if (slWithoutReason.length > 0) {
    gateItems.push({ id: "blk_sl_no_reason", severity: "blocker", message: `${slWithoutReason.length}개 Shortlist에 선택 사유가 없습니다`, fixAction: "사유 입력" });
  }

  const exWithoutReason = excluded.filter((o) => o.rationale.exclusionReasonCodes.length === 0);
  if (exWithoutReason.length > 0) {
    gateItems.push({ id: "blk_ex_no_reason", severity: "blocker", message: `${exWithoutReason.length}개 제외에 제외 사유가 없습니다`, fixAction: "사유 입력" });
  }

  // ── Soft warnings ──
  if (followup.length > 0) {
    gateItems.push({ id: "warn_followup", severity: "warning", message: `${followup.length}개 옵션이 추가 확인 필요 상태입니다`, fixAction: "확인 완료" });
  }

  const substituteInShortlist = shortlisted.filter((o) => o.packSpec.toLowerCase().includes("substitute") || o.riskFlags.includes("substitute"));
  if (substituteInShortlist.length > 0) {
    gateItems.push({ id: "warn_substitute", severity: "warning", message: "Shortlist에 대체품이 포함되어 있습니다", fixAction: null });
  }

  const vendorRisk = shortlisted.filter((o) => o.riskFlags.some((f) => f.includes("risk")));
  if (vendorRisk.length > 0) {
    gateItems.push({ id: "warn_vendor_risk", severity: "warning", message: "Shortlist에 공급사 리스크 플래그가 있습니다", fixAction: null });
  }

  // ── Info ──
  if (shortlisted.length === 1) {
    gateItems.push({ id: "info_single_sl", severity: "info", message: "Shortlist가 1개만 선택되었습니다 (단일 공급사 승인)", fixAction: null });
  }

  const blockerCount = gateItems.filter((g) => g.severity === "blocker").length;
  const warningCount = gateItems.filter((g) => g.severity === "warning").length;
  const infoCount = gateItems.filter((g) => g.severity === "info").length;

  const gateStatus: ApprovalHandoffGateStatus =
    blockerCount > 0 ? "blocked"
    : warningCount > 0 ? "warning"
    : reviewState.compareReviewCenterStatus === "completed" || reviewState.compareReviewCenterStatus === "handoff_ready" ? "ready"
    : "not_ready";

  // Build preview
  const primarySl = shortlisted[0];
  const payloadPreview: ApprovalPayloadPreview | null = primarySl ? {
    selectedOptionSummary: `${shortlisted.length}개 선택`,
    vendorSummary: shortlisted.map((o) => o.supplier).join(", "),
    qtyPackPriceSummary: primarySl.priceKRW ? `₩${primarySl.priceKRW.toLocaleString("ko-KR")} · ${primarySl.packSpec}` : primarySl.packSpec,
    expectedLeadTimeSummary: primarySl.leadTimeDays ? `${primarySl.leadTimeDays}영업일` : "미확인",
    selectionRationaleSummary: shortlisted.flatMap((o) => o.rationale.selectionReasonCodes).join(", ") || "미입력",
    exclusionSummary: `${excluded.length}개 제외`,
    followupStatus: followup.length > 0 ? `${followup.length}개 확인 필요` : "없음",
    requesterContext: reviewState.requestReference,
    budgetPolicyNote: "",
  } : null;

  return {
    gateStatus,
    gateEnteredAt: new Date().toISOString(),
    compareReviewId: reviewState.compareId,
    requestReference: reviewState.requestReference,
    gateItems,
    blockerCount,
    warningCount,
    infoCount,
    approvalPayloadPreview: payloadPreview,
    handoffPackageId: null,
    handedOffAt: null,
    handedOffBy: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Approval Handoff Package
// ══════════════════════════════════════════════════════════════════════════════

export interface CanonicalApprovalHandoffPackage {
  id: string;
  sourceRequestId: string;
  sourceCompareReviewId: string;
  sourceCompareDecisionSnapshotId: string;
  selectedOptionIds: string[];
  selectedVendorId: string;
  selectionReasonCodes: SelectionReasonCode[];
  selectionNote: string;
  exclusionSummary: string;
  followupSummary: string;
  blockerSnapshot: GateItem[];
  warningSnapshot: GateItem[];
  requestContext: string;
  quoteContext: string;
  budgetPolicyContext: string;
  createdAt: string;
  createdBy: string;
  handedOffAt: string;
  handedOffBy: string;
}

export function buildCanonicalApprovalHandoffPackage(
  reviewState: CompareReviewCenterState,
  gateState: ApprovalHandoffGateState,
): CanonicalApprovalHandoffPackage {
  const shortlisted = reviewState.options.filter((o) => o.reviewStatus === "shortlisted");
  const excluded = reviewState.options.filter((o) => o.reviewStatus === "excluded");
  const followup = reviewState.options.filter((o) => o.reviewStatus === "needs_followup");
  const allSelectionCodes = [...new Set(shortlisted.flatMap((o) => o.rationale.selectionReasonCodes))];
  const now = new Date().toISOString();

  return {
    id: `ahpkg_${Date.now().toString(36)}`,
    sourceRequestId: reviewState.requestReference,
    sourceCompareReviewId: reviewState.compareId,
    sourceCompareDecisionSnapshotId: "",
    selectedOptionIds: shortlisted.map((o) => o.optionId),
    selectedVendorId: shortlisted[0]?.supplier || "",
    selectionReasonCodes: allSelectionCodes,
    selectionNote: shortlisted.map((o) => o.rationale.selectionNote).filter(Boolean).join("; "),
    exclusionSummary: `${excluded.length}개 제외`,
    followupSummary: followup.length > 0 ? `${followup.length}개 확인 필요` : "없음",
    blockerSnapshot: gateState.gateItems.filter((g) => g.severity === "blocker"),
    warningSnapshot: gateState.gateItems.filter((g) => g.severity === "warning"),
    requestContext: reviewState.requestReference,
    quoteContext: "",
    budgetPolicyContext: "",
    createdAt: now,
    createdBy: "operator",
    handedOffAt: now,
    handedOffBy: "operator",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Activity Events
// ══════════════════════════════════════════════════════════════════════════════

export type GateActivityEventType =
  | "gate_entered"
  | "gate_blocker_detected"
  | "gate_warning_detected"
  | "gate_fixed"
  | "approval_handoff_confirmed"
  | "approval_handoff_blocked_attempt";

export interface GateActivityEvent {
  eventType: GateActivityEventType;
  actor: string;
  timestamp: string;
  previousGateStatus: ApprovalHandoffGateStatus;
  nextGateStatus: ApprovalHandoffGateStatus;
  changedFields: string[];
  note: string;
}

export function createGateActivityEvent(
  eventType: GateActivityEventType,
  previousStatus: ApprovalHandoffGateStatus,
  nextStatus: ApprovalHandoffGateStatus,
  note: string = "",
): GateActivityEvent {
  return {
    eventType,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousGateStatus: previousStatus,
    nextGateStatus: nextStatus,
    changedFields: [],
    note,
  };
}
