/**
 * Supplier Confirmation Workbench — confirmation capture + discrepancy + receiving handoff
 *
 * 고정 규칙:
 * 1. acknowledgment ≠ confirmation. 수신 확인 ≠ 공급 조건 확정.
 * 2. confirmation은 canonical snapshot. raw reply는 보조 evidence.
 * 3. discrepancy는 구조화된 판단. free-text warning 금지.
 * 4. supplier_acknowledged → supplier_confirmed 단방향.
 * 5. receiving handoff는 confirmation snapshot 기반. snapshot 없이 inbound seed 금지.
 * 6. queue badge = detail confirmation status = rail summary. 동일 source.
 * 7. confirmed ≠ 문제 없음. discrepancy가 있어도 confirmed일 수 있음.
 */

import type { PODetailModel, PODraftState } from "./po-created-detail";
import type { PostSendTracking, SupplierResponseSource } from "./po-sent-detail";

// ══════════════════════════════════════════════════════════════════════════════
// Confirmation Substatus
// ══════════════════════════════════════════════════════════════════════════════

export type ConfirmationSubstatus =
  | "confirmation_pending"
  | "confirmation_recorded"
  | "discrepancy_detected"
  | "confirmation_blocked"
  | "ready_for_receiving_prep";

export const CONFIRMATION_SUBSTATUS_LABELS: Record<ConfirmationSubstatus, string> = {
  confirmation_pending: "확정 대기",
  confirmation_recorded: "확정 기록됨",
  discrepancy_detected: "차이 감지",
  confirmation_blocked: "확정 불가",
  ready_for_receiving_prep: "입고 준비 가능",
};

// ══════════════════════════════════════════════════════════════════════════════
// Confirmation Snapshot (canonical — source of truth for receiving)
// ══════════════════════════════════════════════════════════════════════════════

export interface SupplierConfirmationSnapshot {
  snapshotId: string;
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;

  // ── Source ──
  confirmationSource: SupplierResponseSource;
  confirmedAt: string;
  recordedAt: string;
  recordedBy: string | null;

  // ── Fulfillment ──
  confirmedEta: string | null;
  confirmedShipDate: string | null;
  confirmedQtyStatus: ConfirmedQtyStatus;
  partialShipmentFlag: boolean;
  confirmedDeliveryNote: string | null;

  // ── Commercial ──
  confirmedCommercialStatus: ConfirmedCommercialStatus;
  confirmedUnitPriceChanged: boolean;
  confirmedShippingSurcharge: boolean;
  confirmedPaymentTermReaffirmed: boolean;
  commercialVarianceNote: string | null;

  // ── Issue ──
  issueFlag: boolean;
  issueSummary: string | null;

  // ── Operator ──
  operatorSummary: string;
  verificationConfidence: "high" | "medium" | "low";

  // ── Reference ──
  sourceResponseIds: string[];
}

export type ConfirmedQtyStatus =
  | "full_quantity_confirmed"
  | "partial_quantity_confirmed"
  | "quantity_reduced"
  | "quantity_pending";

export const CONFIRMED_QTY_STATUS_LABELS: Record<ConfirmedQtyStatus, string> = {
  full_quantity_confirmed: "전량 확인",
  partial_quantity_confirmed: "부분 확인",
  quantity_reduced: "수량 축소",
  quantity_pending: "수량 미확정",
};

export type ConfirmedCommercialStatus =
  | "no_change"
  | "price_adjusted"
  | "surcharge_added"
  | "terms_changed"
  | "pending_review";

export const CONFIRMED_COMMERCIAL_STATUS_LABELS: Record<ConfirmedCommercialStatus, string> = {
  no_change: "변동 없음",
  price_adjusted: "가격 조정",
  surcharge_added: "부과금 추가",
  terms_changed: "조건 변경",
  pending_review: "검토 중",
};

let _csn = 0;
function csnUid(): string { return `csn_${Date.now()}_${++_csn}`; }

// ══════════════════════════════════════════════════════════════════════════════
// Confirmation Tracking (extends PostSendTracking concept)
// ══════════════════════════════════════════════════════════════════════════════

export interface ConfirmationTracking {
  purchaseOrderId: string;

  // ── Status ──
  confirmationStatus: ConfirmationSubstatus;
  confirmationRecordedAt: string | null;
  confirmationRecordedBy: string | null;

  // ── Snapshot ref ──
  confirmationSnapshotId: string | null;

  // ── Discrepancy ──
  discrepancyFlag: boolean;
  discrepancySummary: string | null;

  // ── Receiving readiness ──
  receivingPrepAllowed: boolean;
  receivingBlockReason: string | null;
}

export function createInitialConfirmationTracking(
  purchaseOrderId: string
): ConfirmationTracking {
  return {
    purchaseOrderId,
    confirmationStatus: "confirmation_pending",
    confirmationRecordedAt: null,
    confirmationRecordedBy: null,
    confirmationSnapshotId: null,
    discrepancyFlag: false,
    discrepancySummary: null,
    receivingPrepAllowed: false,
    receivingBlockReason: "확정 기록 없음",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Record Supplier Confirmation
// ══════════════════════════════════════════════════════════════════════════════

export interface RecordConfirmationInput {
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;
  confirmationSource: SupplierResponseSource;
  confirmedAt?: string;
  confirmedEta?: string | null;
  confirmedShipDate?: string | null;
  confirmedQtyStatus: ConfirmedQtyStatus;
  partialShipmentFlag?: boolean;
  confirmedDeliveryNote?: string | null;
  confirmedCommercialStatus: ConfirmedCommercialStatus;
  confirmedUnitPriceChanged?: boolean;
  confirmedShippingSurcharge?: boolean;
  confirmedPaymentTermReaffirmed?: boolean;
  commercialVarianceNote?: string | null;
  issueFlag?: boolean;
  issueSummary?: string | null;
  operatorSummary: string;
  verificationConfidence: "high" | "medium" | "low";
  sourceResponseIds?: string[];
  recordedBy?: string | null;
}

export interface RecordConfirmationResult {
  success: boolean;
  snapshot: SupplierConfirmationSnapshot | null;
  tracking: ConfirmationTracking;
  newState: PODraftState;
  reason: string | null;
}

export function recordSupplierConfirmation(
  detail: PODetailModel,
  tracking: ConfirmationTracking,
  input: RecordConfirmationInput
): RecordConfirmationResult {
  // Guard: must be supplier_acknowledged (or already supplier_confirmed for update)
  if (detail.draftState !== "po_acknowledged" && detail.draftState !== "supplier_confirmed") {
    return {
      success: false,
      snapshot: null,
      tracking,
      newState: detail.draftState,
      reason: "공급사 확인 수신 상태에서만 확정값을 기록할 수 있습니다.",
    };
  }

  // Guard: duplicate if already confirmed
  if (detail.draftState === "supplier_confirmed" && tracking.confirmationSnapshotId) {
    return {
      success: false,
      snapshot: null,
      tracking,
      newState: detail.draftState,
      reason: "이미 확정 기록이 존재합니다. 수정이 필요하면 별도 업데이트를 사용하세요.",
    };
  }

  const now = new Date().toISOString();

  const snapshot: SupplierConfirmationSnapshot = {
    snapshotId: csnUid(),
    purchaseOrderId: input.purchaseOrderId,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    confirmationSource: input.confirmationSource,
    confirmedAt: input.confirmedAt ?? now,
    recordedAt: now,
    recordedBy: input.recordedBy ?? null,
    confirmedEta: input.confirmedEta ?? null,
    confirmedShipDate: input.confirmedShipDate ?? null,
    confirmedQtyStatus: input.confirmedQtyStatus,
    partialShipmentFlag: input.partialShipmentFlag ?? false,
    confirmedDeliveryNote: input.confirmedDeliveryNote ?? null,
    confirmedCommercialStatus: input.confirmedCommercialStatus,
    confirmedUnitPriceChanged: input.confirmedUnitPriceChanged ?? false,
    confirmedShippingSurcharge: input.confirmedShippingSurcharge ?? false,
    confirmedPaymentTermReaffirmed: input.confirmedPaymentTermReaffirmed ?? false,
    commercialVarianceNote: input.commercialVarianceNote ?? null,
    issueFlag: input.issueFlag ?? false,
    issueSummary: input.issueSummary ?? null,
    operatorSummary: input.operatorSummary,
    verificationConfidence: input.verificationConfidence,
    sourceResponseIds: input.sourceResponseIds ?? [],
  };

  const updatedTracking: ConfirmationTracking = {
    ...tracking,
    confirmationStatus: "confirmation_recorded",
    confirmationRecordedAt: now,
    confirmationRecordedBy: input.recordedBy ?? null,
    confirmationSnapshotId: snapshot.snapshotId,
  };

  return {
    success: true,
    snapshot,
    tracking: updatedTracking,
    newState: "supplier_confirmed",
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Discrepancy Evaluator
// ══════════════════════════════════════════════════════════════════════════════

export type DiscrepancyType =
  | "eta_shifted"
  | "quantity_reduced"
  | "partial_shipment_proposed"
  | "price_changed"
  | "shipping_surcharge_added"
  | "terms_changed"
  | "reference_mismatch"
  | "supplier_issue_unresolved";

export const DISCREPANCY_TYPE_LABELS: Record<DiscrepancyType, string> = {
  eta_shifted: "납기 변동",
  quantity_reduced: "수량 축소",
  partial_shipment_proposed: "분할 납품 제안",
  price_changed: "가격 변동",
  shipping_surcharge_added: "배송 부과금 추가",
  terms_changed: "조건 변경",
  reference_mismatch: "참조/주소 불일치",
  supplier_issue_unresolved: "미해결 공급사 이슈",
};

export type DiscrepancySeverity = "none" | "info" | "warning" | "blocking";

export interface DiscrepancyIssue {
  type: DiscrepancyType;
  severity: DiscrepancySeverity;
  message: string;
  field?: string;
  recommendedAction: string;
}

export interface DiscrepancyEvaluation {
  hasDiscrepancy: boolean;
  blockingIssues: DiscrepancyIssue[];
  warningIssues: DiscrepancyIssue[];
  severityLevel: DiscrepancySeverity;
  recommendedResolutionPath: string;
}

export interface DiscrepancyPolicy {
  blockOnPriceIncrease: boolean;
  blockOnQtyReduction: boolean;
  blockOnPartialShipment: boolean;
  warnOnEtaShift: boolean;
  blockOnUnresolvedIssue: boolean;
}

export const DEFAULT_DISCREPANCY_POLICY: DiscrepancyPolicy = {
  blockOnPriceIncrease: true,
  blockOnQtyReduction: true,
  blockOnPartialShipment: false,
  warnOnEtaShift: true,
  blockOnUnresolvedIssue: true,
};

export function evaluateSupplierConfirmationDiscrepancy(
  detail: PODetailModel,
  snapshot: SupplierConfirmationSnapshot,
  policy: DiscrepancyPolicy = DEFAULT_DISCREPANCY_POLICY
): DiscrepancyEvaluation {
  const blocking: DiscrepancyIssue[] = [];
  const warning: DiscrepancyIssue[] = [];

  // ETA shift
  if (snapshot.confirmedEta && detail.requestedDeliveryDate) {
    const confirmedDate = new Date(snapshot.confirmedEta).getTime();
    const requestedDate = new Date(detail.requestedDeliveryDate).getTime();
    if (confirmedDate > requestedDate) {
      const issue: DiscrepancyIssue = {
        type: "eta_shifted",
        severity: policy.warnOnEtaShift ? "warning" : "info",
        message: "확정 납기가 요청 납기보다 늦습니다.",
        field: "confirmedEta",
        recommendedAction: "납기 지연 사유 확인 및 대응 검토",
      };
      if (policy.warnOnEtaShift) warning.push(issue);
    }
  }

  // Qty reduction
  if (snapshot.confirmedQtyStatus === "quantity_reduced") {
    const issue: DiscrepancyIssue = {
      type: "quantity_reduced",
      severity: policy.blockOnQtyReduction ? "blocking" : "warning",
      message: "공급 확정 수량이 발주 수량보다 적습니다.",
      field: "confirmedQtyStatus",
      recommendedAction: "부족분 대응 방안 결정 (추가 발주 / 대체 공급사)",
    };
    if (policy.blockOnQtyReduction) blocking.push(issue); else warning.push(issue);
  }

  // Partial shipment
  if (snapshot.partialShipmentFlag) {
    const issue: DiscrepancyIssue = {
      type: "partial_shipment_proposed",
      severity: policy.blockOnPartialShipment ? "blocking" : "warning",
      message: "분할 납품이 제안되었습니다.",
      field: "partialShipmentFlag",
      recommendedAction: "분할 납품 조건 확인 및 수락 여부 결정",
    };
    if (policy.blockOnPartialShipment) blocking.push(issue); else warning.push(issue);
  }

  // Price changed
  if (snapshot.confirmedUnitPriceChanged) {
    const issue: DiscrepancyIssue = {
      type: "price_changed",
      severity: policy.blockOnPriceIncrease ? "blocking" : "warning",
      message: "단가가 변동되었습니다.",
      field: "confirmedUnitPriceChanged",
      recommendedAction: "가격 변동 사유 확인 및 승인 검토",
    };
    if (policy.blockOnPriceIncrease) blocking.push(issue); else warning.push(issue);
  }

  // Shipping surcharge
  if (snapshot.confirmedShippingSurcharge) {
    warning.push({
      type: "shipping_surcharge_added",
      severity: "warning",
      message: "배송 부과금이 추가되었습니다.",
      field: "confirmedShippingSurcharge",
      recommendedAction: "부과금 금액 확인 및 예산 반영",
    });
  }

  // Terms changed
  if (snapshot.confirmedCommercialStatus === "terms_changed") {
    warning.push({
      type: "terms_changed",
      severity: "warning",
      message: "상업 조건이 변경되었습니다.",
      field: "confirmedCommercialStatus",
      recommendedAction: "변경된 조건 검토 및 승인 여부 결정",
    });
  }

  // Unresolved supplier issue
  if (snapshot.issueFlag && policy.blockOnUnresolvedIssue) {
    blocking.push({
      type: "supplier_issue_unresolved",
      severity: "blocking",
      message: "공급사 미해결 이슈가 있습니다.",
      recommendedAction: "이슈 해결 후 확정값 재검토",
    });
  }

  // Determine overall severity
  let severityLevel: DiscrepancySeverity = "none";
  if (blocking.length > 0) severityLevel = "blocking";
  else if (warning.length > 0) severityLevel = "warning";
  else if (blocking.length === 0 && warning.length === 0) severityLevel = "none";

  // Resolution path
  let recommendedResolutionPath: string;
  if (blocking.length > 0) {
    recommendedResolutionPath = `차단 항목 ${blocking.length}건 해결 필요`;
  } else if (warning.length > 0) {
    recommendedResolutionPath = `주의 항목 ${warning.length}건 확인 후 진행 가능`;
  } else {
    recommendedResolutionPath = "차이 없음 — 입고 준비 진행 가능";
  }

  return {
    hasDiscrepancy: blocking.length > 0 || warning.length > 0,
    blockingIssues: blocking,
    warningIssues: warning,
    severityLevel,
    recommendedResolutionPath,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Apply Discrepancy to Confirmation Tracking
// ══════════════════════════════════════════════════════════════════════════════

export function applyDiscrepancyToTracking(
  tracking: ConfirmationTracking,
  evaluation: DiscrepancyEvaluation
): ConfirmationTracking {
  const hasBlocking = evaluation.blockingIssues.length > 0;

  let confirmationStatus: ConfirmationSubstatus;
  if (hasBlocking) {
    confirmationStatus = "discrepancy_detected";
  } else if (evaluation.warningIssues.length > 0) {
    confirmationStatus = "confirmation_recorded";
  } else {
    confirmationStatus = "ready_for_receiving_prep";
  }

  return {
    ...tracking,
    confirmationStatus,
    discrepancyFlag: evaluation.hasDiscrepancy,
    discrepancySummary: evaluation.hasDiscrepancy
      ? evaluation.recommendedResolutionPath
      : null,
    receivingPrepAllowed: !hasBlocking,
    receivingBlockReason: hasBlocking
      ? `차단 항목 ${evaluation.blockingIssues.length}건`
      : null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Handoff Bundle
// ══════════════════════════════════════════════════════════════════════════════

export interface ReceivingHandoffBundle {
  handoffId: string;
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;

  // ── Confirmation basis ──
  confirmationSnapshotId: string;
  confirmedEta: string | null;
  confirmedShipDate: string | null;
  confirmedQtySummary: ConfirmedQtyStatus;
  partialShipmentFlag: boolean;

  // ── Discrepancy context ──
  discrepancySummary: string | null;
  hasBlockingDiscrepancy: boolean;

  // ── Receiving seed ──
  receivingNoteSeed: string;
  inboundExpectedDateSeed: string | null;

  // ── Line reference ──
  lineCount: number;
  currency: string;
  grandTotal: number;

  // ── Metadata ──
  preparedAt: string;
  preparedBy: string | null;
}

let _rhb = 0;
function rhbUid(): string { return `rhb_${Date.now()}_${++_rhb}`; }

export interface BuildReceivingHandoffInput {
  detail: PODetailModel;
  snapshot: SupplierConfirmationSnapshot;
  discrepancy: DiscrepancyEvaluation;
  preparedBy?: string | null;
}

export interface BuildReceivingHandoffResult {
  success: boolean;
  bundle: ReceivingHandoffBundle | null;
  reason: string | null;
}

export function buildReceivingPreparationHandoff(
  input: BuildReceivingHandoffInput
): BuildReceivingHandoffResult {
  const { detail, snapshot, discrepancy } = input;

  // Guard: must have confirmation snapshot
  if (!snapshot.snapshotId) {
    return {
      success: false,
      bundle: null,
      reason: "확정 기록 없이 입고 준비 번들을 생성할 수 없습니다.",
    };
  }

  // Guard: blocking discrepancy
  if (discrepancy.blockingIssues.length > 0) {
    return {
      success: false,
      bundle: null,
      reason: `차단 항목 ${discrepancy.blockingIssues.length}건이 해결되지 않았습니다.`,
    };
  }

  const now = new Date().toISOString();

  // Build receiving note seed from confirmation
  const noteParts: string[] = [];
  if (snapshot.partialShipmentFlag) noteParts.push("분할 납품");
  if (snapshot.confirmedDeliveryNote) noteParts.push(snapshot.confirmedDeliveryNote);
  if (discrepancy.warningIssues.length > 0) {
    noteParts.push(`주의 항목 ${discrepancy.warningIssues.length}건`);
  }

  const bundle: ReceivingHandoffBundle = {
    handoffId: rhbUid(),
    purchaseOrderId: detail.purchaseOrderId,
    vendorId: detail.supplierId,
    vendorName: detail.supplierName,
    confirmationSnapshotId: snapshot.snapshotId,
    confirmedEta: snapshot.confirmedEta,
    confirmedShipDate: snapshot.confirmedShipDate,
    confirmedQtySummary: snapshot.confirmedQtyStatus,
    partialShipmentFlag: snapshot.partialShipmentFlag,
    discrepancySummary: discrepancy.hasDiscrepancy ? discrepancy.recommendedResolutionPath : null,
    hasBlockingDiscrepancy: false,
    receivingNoteSeed: noteParts.length > 0 ? noteParts.join(" / ") : "특이사항 없음",
    inboundExpectedDateSeed: snapshot.confirmedEta ?? snapshot.confirmedShipDate ?? null,
    lineCount: detail.lineCount,
    currency: detail.currency,
    grandTotal: detail.grandTotal,
    preparedAt: now,
    preparedBy: input.preparedBy ?? null,
  };

  return {
    success: true,
    bundle,
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Enhanced Receiving Preparation Gate (confirmation-aware)
// ══════════════════════════════════════════════════════════════════════════════

export interface ConfirmationAwareReceivingGate {
  allowed: boolean;
  blockingIssues: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  missingConfirmationItems: string[];
}

export function canEnterReceivingFromConfirmation(
  detail: PODetailModel,
  confirmTracking: ConfirmationTracking,
  snapshot: SupplierConfirmationSnapshot | null,
  discrepancy: DiscrepancyEvaluation | null
): ConfirmationAwareReceivingGate {
  const blockingIssues: { code: string; message: string }[] = [];
  const warnings: { code: string; message: string }[] = [];
  const missingItems: string[] = [];

  // State check
  if (detail.draftState !== "supplier_confirmed") {
    blockingIssues.push({ code: "not_confirmed", message: "공급 확정 상태가 아닙니다." });
  }

  // Snapshot check
  if (!snapshot || !confirmTracking.confirmationSnapshotId) {
    blockingIssues.push({ code: "no_snapshot", message: "확정 기록(snapshot)이 없습니다." });
    missingItems.push("공급사 확정 기록");
  }

  // Discrepancy blocking
  if (discrepancy && discrepancy.blockingIssues.length > 0) {
    blockingIssues.push({
      code: "blocking_discrepancy",
      message: `차단 차이 ${discrepancy.blockingIssues.length}건 미해결`,
    });
    missingItems.push("차단 항목 해결");
  }

  // Issue flag
  if (snapshot?.issueFlag) {
    blockingIssues.push({ code: "unresolved_issue", message: "미해결 공급사 이슈가 있습니다." });
    missingItems.push("공급사 이슈 해결");
  }

  // ETA check
  if (snapshot && !snapshot.confirmedEta && !snapshot.confirmedShipDate) {
    warnings.push({ code: "no_eta", message: "확정 납기가 없습니다." });
    missingItems.push("납기 확인");
  }

  // Qty check
  if (snapshot?.confirmedQtyStatus === "quantity_pending") {
    warnings.push({ code: "qty_pending", message: "수량이 미확정 상태입니다." });
    missingItems.push("수량 확인");
  }

  // Partial shipment
  if (snapshot?.partialShipmentFlag) {
    warnings.push({ code: "partial_shipment", message: "분할 납품이 예정되어 있습니다." });
  }

  // Commercial variance
  if (discrepancy && discrepancy.warningIssues.length > 0) {
    warnings.push({
      code: "commercial_warnings",
      message: `상업 조건 주의 항목 ${discrepancy.warningIssues.length}건`,
    });
  }

  return {
    allowed: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    missingConfirmationItems: missingItems,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Confirmation Workbench Model (center + rail + dock common truth)
// ══════════════════════════════════════════════════════════════════════════════

export interface ConfirmationWorkbenchModel {
  detail: PODetailModel | null;
  confirmTracking: ConfirmationTracking | null;
  snapshot: SupplierConfirmationSnapshot | null;
  discrepancy: DiscrepancyEvaluation | null;
  receivingGate: ConfirmationAwareReceivingGate | null;

  isConfirmationSurfaceVisible: boolean;

  // ── Header ──
  confirmationBadge: string;
  confirmationColor: "slate" | "amber" | "emerald" | "red" | "blue";

  // ── Dock CTAs ──
  primaryAction: ConfirmationDockAction;
  secondaryActions: ConfirmationDockAction[];

  // ── Rail checklist ──
  checklistItems: ConfirmationChecklistItem[];
}

export interface ConfirmationDockAction {
  id: string;
  label: string;
  enabled: boolean;
  reason: string | null;
}

export interface ConfirmationChecklistItem {
  label: string;
  status: "done" | "pending" | "blocked";
}

export function buildConfirmationWorkbenchModel(input: {
  detail: PODetailModel | null;
  confirmTracking: ConfirmationTracking | null;
  snapshot: SupplierConfirmationSnapshot | null;
  discrepancy: DiscrepancyEvaluation | null;
}): ConfirmationWorkbenchModel {
  const { detail, confirmTracking, snapshot, discrepancy } = input;

  // Not visible if not in confirmation-capable state
  if (
    !detail ||
    !confirmTracking ||
    (detail.draftState !== "po_acknowledged" && detail.draftState !== "supplier_confirmed")
  ) {
    return {
      detail: null,
      confirmTracking: null,
      snapshot: null,
      discrepancy: null,
      receivingGate: null,
      isConfirmationSurfaceVisible: false,
      confirmationBadge: "—",
      confirmationColor: "slate",
      primaryAction: { id: "noop", label: "—", enabled: false, reason: null },
      secondaryActions: [],
      checklistItems: [],
    };
  }

  const receivingGate = canEnterReceivingFromConfirmation(detail, confirmTracking, snapshot, discrepancy);

  // Badge
  let confirmationBadge: string;
  let confirmationColor: ConfirmationWorkbenchModel["confirmationColor"];
  switch (confirmTracking.confirmationStatus) {
    case "confirmation_pending":
      confirmationBadge = "확정 대기";
      confirmationColor = "slate";
      break;
    case "confirmation_recorded":
      confirmationBadge = "확정 기록됨";
      confirmationColor = "blue";
      break;
    case "discrepancy_detected":
      confirmationBadge = "차이 감지";
      confirmationColor = "amber";
      break;
    case "confirmation_blocked":
      confirmationBadge = "확정 불가";
      confirmationColor = "red";
      break;
    case "ready_for_receiving_prep":
      confirmationBadge = "입고 준비 가능";
      confirmationColor = "emerald";
      break;
  }

  // Checklist
  const checklist: ConfirmationChecklistItem[] = [
    { label: "공급사 확인 수신", status: "done" },
    {
      label: "확정값 기록",
      status: confirmTracking.confirmationSnapshotId ? "done" : "pending",
    },
    {
      label: "차이 검토",
      status: discrepancy
        ? discrepancy.blockingIssues.length > 0
          ? "blocked"
          : "done"
        : "pending",
    },
    {
      label: "입고 준비 가능",
      status: receivingGate.allowed ? "done" : receivingGate.blockingIssues.length > 0 ? "blocked" : "pending",
    },
  ];

  // Dock actions
  const hasSnapshot = !!confirmTracking.confirmationSnapshotId;
  const hasBlockingDiscrepancy = discrepancy ? discrepancy.blockingIssues.length > 0 : false;

  let primaryAction: ConfirmationDockAction;
  if (!hasSnapshot) {
    primaryAction = {
      id: "record_confirmation",
      label: "확정값 기록",
      enabled: true,
      reason: null,
    };
  } else if (hasBlockingDiscrepancy) {
    primaryAction = {
      id: "review_discrepancy",
      label: "차이 검토",
      enabled: true,
      reason: null,
    };
  } else if (receivingGate.allowed) {
    primaryAction = {
      id: "prepare_receiving",
      label: "입고 준비 진행",
      enabled: true,
      reason: null,
    };
  } else {
    primaryAction = {
      id: "record_confirmation",
      label: "확정값 수정",
      enabled: true,
      reason: null,
    };
  }

  const secondaryActions: ConfirmationDockAction[] = [];

  if (hasSnapshot && !receivingGate.allowed) {
    secondaryActions.push({
      id: "request_reconfirmation",
      label: "재확인 요청",
      enabled: true,
      reason: null,
    });
  }

  if (hasBlockingDiscrepancy) {
    secondaryActions.push({
      id: "escalate_issue",
      label: "상업 이슈 에스컬레이션",
      enabled: true,
      reason: null,
    });
  }

  if (receivingGate.allowed && primaryAction.id !== "prepare_receiving") {
    secondaryActions.push({
      id: "prepare_receiving",
      label: "입고 준비 진행",
      enabled: true,
      reason: null,
    });
  }

  return {
    detail,
    confirmTracking,
    snapshot,
    discrepancy,
    receivingGate,
    isConfirmationSurfaceVisible: true,
    confirmationBadge,
    confirmationColor,
    primaryAction,
    secondaryActions,
    checklistItems: checklist,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Confirmation Queue Row Badge (operations hub sync)
// ══════════════════════════════════════════════════════════════════════════════

export interface ConfirmationQueueRowBadge {
  purchaseOrderId: string;
  vendorName: string;
  stateBadge: string;
  confirmationBadge: string;
  stateColor: "slate" | "amber" | "emerald" | "red" | "blue";
  agingHoursPostAck: number;
  hasDiscrepancy: boolean;
  discrepancySeverity: DiscrepancySeverity;
  receivingPrepAllowed: boolean;
  nextAction: string;
}

export function buildConfirmationQueueRowBadge(
  detail: PODetailModel,
  confirmTracking: ConfirmationTracking,
  discrepancy: DiscrepancyEvaluation | null,
  acknowledgedAt: string | null,
  nowIso?: string
): ConfirmationQueueRowBadge {
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const ackTime = acknowledgedAt ? new Date(acknowledgedAt).getTime() : now;
  const agingHours = Math.round((now - ackTime) / (1000 * 60 * 60));

  let stateColor: ConfirmationQueueRowBadge["stateColor"];
  if (discrepancy && discrepancy.blockingIssues.length > 0) {
    stateColor = "red";
  } else if (discrepancy && discrepancy.warningIssues.length > 0) {
    stateColor = "amber";
  } else if (confirmTracking.confirmationStatus === "ready_for_receiving_prep") {
    stateColor = "emerald";
  } else if (confirmTracking.confirmationSnapshotId) {
    stateColor = "blue";
  } else {
    stateColor = "slate";
  }

  const confirmationBadge = CONFIRMATION_SUBSTATUS_LABELS[confirmTracking.confirmationStatus];

  let nextAction: string;
  if (!confirmTracking.confirmationSnapshotId) {
    nextAction = "확정값 기록 필요";
  } else if (discrepancy && discrepancy.blockingIssues.length > 0) {
    nextAction = `차단 항목 ${discrepancy.blockingIssues.length}건 해결 필요`;
  } else if (confirmTracking.receivingPrepAllowed) {
    nextAction = "입고 준비 진행 가능";
  } else {
    nextAction = "확정 검토 중";
  }

  return {
    purchaseOrderId: detail.purchaseOrderId,
    vendorName: detail.supplierName,
    stateBadge: detail.draftState === "supplier_confirmed" ? "공급 확정" : "공급사 확인",
    confirmationBadge,
    stateColor,
    agingHoursPostAck: agingHours,
    hasDiscrepancy: discrepancy?.hasDiscrepancy ?? false,
    discrepancySeverity: discrepancy?.severityLevel ?? "none",
    receivingPrepAllowed: confirmTracking.receivingPrepAllowed,
    nextAction,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Confirmation Activity Events
// ══════════════════════════════════════════════════════════════════════════════

export type ConfirmationActivityType =
  | "confirmation_surface_opened"
  | "confirmation_recorded"
  | "discrepancy_evaluated"
  | "discrepancy_resolved"
  | "reconfirmation_requested"
  | "commercial_issue_escalated"
  | "receiving_handoff_prepared"
  | "receiving_handoff_blocked";

export interface ConfirmationActivity {
  type: ConfirmationActivityType;
  at: string;
  actorId: string | null;
  summary: string;
  snapshotId: string | null;
}

export function createConfirmationActivity(input: {
  type: ConfirmationActivityType;
  actorId?: string;
  summary: string;
  snapshotId?: string;
}): ConfirmationActivity {
  return {
    type: input.type,
    at: new Date().toISOString(),
    actorId: input.actorId ?? null,
    summary: input.summary,
    snapshotId: input.snapshotId ?? null,
  };
}
