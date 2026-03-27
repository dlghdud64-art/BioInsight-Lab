/**
 * Receiving Preparation Workbench — inbound expectation lock + readiness gate + execution handoff
 *
 * 고정 규칙:
 * 1. confirmed ≠ receiving prepared. 공급 확정 ≠ 입고 기준값 잠금.
 * 2. receiving seed는 confirmation snapshot 기반. request/approval truth 직접 재사용 금지.
 * 3. partial shipment는 별도 운영 상태. full receiving 전제로 숨기기 금지.
 * 4. supplier_confirmed → receiving_prepared 단방향.
 * 5. receiving execution handoff는 preparation snapshot 기반. confirmation snapshot은 보조 lineage.
 * 6. queue badge = detail receiving prep status = rail summary. 동일 source.
 * 7. receiving_prepared ≠ 입고 완료. 기준값 잠금 완료라는 의미.
 */

import type { PODetailModel, PODraftState } from "./po-created-detail";
import type {
  SupplierConfirmationSnapshot,
  ConfirmationTracking,
  ConfirmedQtyStatus,
  DiscrepancyEvaluation,
} from "./supplier-confirmation-workbench";

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Preparation Substatus
// ══════════════════════════════════════════════════════════════════════════════

export type ReceivingPrepSubstatus =
  | "receiving_prep_pending"
  | "inbound_expectation_locked"
  | "partial_receiving_expected"
  | "receiving_blocked"
  | "ready_for_receiving_execution";

export const RECEIVING_PREP_SUBSTATUS_LABELS: Record<ReceivingPrepSubstatus, string> = {
  receiving_prep_pending: "입고 준비 대기",
  inbound_expectation_locked: "입고 기준값 잠금",
  partial_receiving_expected: "부분 입고 예정",
  receiving_blocked: "입고 차단",
  ready_for_receiving_execution: "입고 실행 가능",
};

// ══════════════════════════════════════════════════════════════════════════════
// Inbound Expectation (canonical receiving seed from confirmation)
// ══════════════════════════════════════════════════════════════════════════════

export interface InboundExpectation {
  expectationId: string;
  purchaseOrderId: string;

  // ── Source ──
  confirmationSnapshotId: string;
  derivedAt: string;
  derivedBy: string | null;

  // ── Expected delivery ──
  expectedReceivingDate: string | null;
  expectedShipDate: string | null;
  expectedArrivalWindow: string | null;

  // ── Expected quantities ──
  expectedReceivingQtyStatus: ConfirmedQtyStatus;
  expectedTotalQty: number | null;

  // ── Partial / split ──
  partialReceivingExpected: boolean;
  expectedSplitCount: number;
  expectedFirstInboundDate: string | null;
  expectedRemainingInboundNote: string | null;

  // ── Handling ──
  storageNote: string | null;
  handlingNote: string | null;
  lotExpiryCaptureExpected: boolean;
  documentReferenceComplete: boolean;

  // ── Operator ──
  operatorPreparationNote: string | null;
}

let _ie = 0;
function ieUid(): string { return `ie_${Date.now()}_${++_ie}`; }

export function buildInboundExpectationFromConfirmation(
  detail: PODetailModel,
  snapshot: SupplierConfirmationSnapshot,
  derivedBy?: string | null
): InboundExpectation {
  const now = new Date().toISOString();

  return {
    expectationId: ieUid(),
    purchaseOrderId: detail.purchaseOrderId,
    confirmationSnapshotId: snapshot.snapshotId,
    derivedAt: now,
    derivedBy: derivedBy ?? null,
    expectedReceivingDate: snapshot.confirmedEta,
    expectedShipDate: snapshot.confirmedShipDate,
    expectedArrivalWindow: null,
    expectedReceivingQtyStatus: snapshot.confirmedQtyStatus,
    expectedTotalQty: null,
    partialReceivingExpected: snapshot.partialShipmentFlag,
    expectedSplitCount: snapshot.partialShipmentFlag ? 2 : 1,
    expectedFirstInboundDate: snapshot.partialShipmentFlag
      ? snapshot.confirmedShipDate ?? snapshot.confirmedEta
      : null,
    expectedRemainingInboundNote: snapshot.partialShipmentFlag
      ? "잔량 납기 공급사 확인 필요"
      : null,
    storageNote: null,
    handlingNote: snapshot.confirmedDeliveryNote,
    lotExpiryCaptureExpected: true,
    documentReferenceComplete: true,
    operatorPreparationNote: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Preparation Tracking
// ══════════════════════════════════════════════════════════════════════════════

export interface ReceivingPreparationTracking {
  purchaseOrderId: string;

  // ── Status ──
  receivingPreparationStatus: ReceivingPrepSubstatus;
  receivingPreparedAt: string | null;
  receivingPreparedBy: string | null;

  // ── Expectation ref ──
  inboundExpectationId: string | null;
  receivingPreparationSnapshotId: string | null;

  // ── Expected values ──
  expectedReceivingDate: string | null;
  expectedReceivingQtySummary: ConfirmedQtyStatus | null;
  partialReceivingExpected: boolean;
  expectedReceivingNote: string | null;

  // ── Block ──
  receivingBlockFlag: boolean;
  receivingBlockReason: string | null;
}

export function createInitialReceivingPreparationTracking(
  purchaseOrderId: string
): ReceivingPreparationTracking {
  return {
    purchaseOrderId,
    receivingPreparationStatus: "receiving_prep_pending",
    receivingPreparedAt: null,
    receivingPreparedBy: null,
    inboundExpectationId: null,
    receivingPreparationSnapshotId: null,
    expectedReceivingDate: null,
    expectedReceivingQtySummary: null,
    partialReceivingExpected: false,
    expectedReceivingNote: null,
    receivingBlockFlag: false,
    receivingBlockReason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Partial Shipment / Quantity Variance Evaluator
// ══════════════════════════════════════════════════════════════════════════════

export type PartialReceivingScenario =
  | "full_receiving_expected"
  | "partial_receiving_expected"
  | "staggered_delivery_expected"
  | "quantity_reduced_inbound"
  | "date_split_inbound";

export const PARTIAL_RECEIVING_SCENARIO_LABELS: Record<PartialReceivingScenario, string> = {
  full_receiving_expected: "전량 입고 예정",
  partial_receiving_expected: "부분 입고 예정",
  staggered_delivery_expected: "순차 배송 예정",
  quantity_reduced_inbound: "수량 축소 입고",
  date_split_inbound: "일자 분할 입고",
};

export interface PartialReceivingEvaluation {
  scenario: PartialReceivingScenario;
  isPartialReceivingExpected: boolean;
  receivingSplitCount: number;
  expectedFirstInboundDate: string | null;
  expectedRemainingInboundStatus: string;
  blockingIssues: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
}

export function evaluatePartialReceivingScenario(
  expectation: InboundExpectation,
  snapshot: SupplierConfirmationSnapshot
): PartialReceivingEvaluation {
  const blockingIssues: { code: string; message: string }[] = [];
  const warnings: { code: string; message: string }[] = [];

  // Determine scenario
  let scenario: PartialReceivingScenario;
  if (!snapshot.partialShipmentFlag && snapshot.confirmedQtyStatus === "full_quantity_confirmed") {
    scenario = "full_receiving_expected";
  } else if (snapshot.partialShipmentFlag) {
    scenario = "partial_receiving_expected";
  } else if (snapshot.confirmedQtyStatus === "quantity_reduced") {
    scenario = "quantity_reduced_inbound";
  } else if (snapshot.confirmedQtyStatus === "partial_quantity_confirmed") {
    scenario = "partial_receiving_expected";
  } else {
    scenario = "full_receiving_expected";
  }

  const isPartial = scenario !== "full_receiving_expected";

  // Validate partial scenario
  if (isPartial) {
    if (!expectation.expectedFirstInboundDate) {
      warnings.push({ code: "first_inbound_date_missing", message: "첫 입고 예정일이 없습니다." });
    }
    if (snapshot.confirmedQtyStatus === "quantity_pending") {
      blockingIssues.push({ code: "qty_not_confirmed", message: "수량이 미확정 상태에서 부분 입고 계획을 세울 수 없습니다." });
    }
  }

  // Qty reduced check
  if (snapshot.confirmedQtyStatus === "quantity_reduced") {
    warnings.push({ code: "qty_reduced", message: "확정 수량이 발주 수량보다 적습니다. 부족분 대응이 필요합니다." });
  }

  const remainingStatus = isPartial
    ? "잔량 추가 입고 대기"
    : "해당 없음";

  return {
    scenario,
    isPartialReceivingExpected: isPartial,
    receivingSplitCount: expectation.expectedSplitCount,
    expectedFirstInboundDate: expectation.expectedFirstInboundDate,
    expectedRemainingInboundStatus: remainingStatus,
    blockingIssues,
    warnings,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Readiness Gate (validation before lock)
// ══════════════════════════════════════════════════════════════════════════════

export interface ReceivingReadinessGateResult {
  canPrepareReceiving: boolean;
  blockingIssues: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  missingPreparationItems: string[];
}

export interface ReceivingReadinessPolicy {
  requireExpectedDate: boolean;
  requireQtyConfirmation: boolean;
  allowPartialWithoutPlan: boolean;
  blockOnUnresolvedDiscrepancy: boolean;
}

export const DEFAULT_RECEIVING_READINESS_POLICY: ReceivingReadinessPolicy = {
  requireExpectedDate: true,
  requireQtyConfirmation: true,
  allowPartialWithoutPlan: false,
  blockOnUnresolvedDiscrepancy: true,
};

export function validateReceivingPreparationBeforeLock(
  detail: PODetailModel,
  snapshot: SupplierConfirmationSnapshot | null,
  expectation: InboundExpectation | null,
  discrepancy: DiscrepancyEvaluation | null,
  policy: ReceivingReadinessPolicy = DEFAULT_RECEIVING_READINESS_POLICY
): ReceivingReadinessGateResult {
  const blockingIssues: { code: string; message: string }[] = [];
  const warnings: { code: string; message: string }[] = [];
  const missingItems: string[] = [];

  // State check
  if (detail.draftState !== "supplier_confirmed") {
    blockingIssues.push({ code: "not_confirmed", message: "공급 확정 상태가 아닙니다." });
  }

  // Confirmation snapshot
  if (!snapshot) {
    blockingIssues.push({ code: "no_confirmation_snapshot", message: "공급사 확정 기록이 없습니다." });
    missingItems.push("공급사 확정 기록");
  }

  // Inbound expectation
  if (!expectation) {
    blockingIssues.push({ code: "no_inbound_expectation", message: "입고 예상값이 생성되지 않았습니다." });
    missingItems.push("입고 예상값 생성");
  }

  // Expected date
  if (policy.requireExpectedDate && expectation && !expectation.expectedReceivingDate && !expectation.expectedShipDate) {
    blockingIssues.push({ code: "no_expected_date", message: "입고 예정일이 없습니다." });
    missingItems.push("입고 예정일");
  }

  // Qty confirmation
  if (policy.requireQtyConfirmation && snapshot?.confirmedQtyStatus === "quantity_pending") {
    blockingIssues.push({ code: "qty_not_confirmed", message: "수량이 확정되지 않았습니다." });
    missingItems.push("수량 확정");
  }

  // Blocking discrepancy
  if (policy.blockOnUnresolvedDiscrepancy && discrepancy && discrepancy.blockingIssues.length > 0) {
    blockingIssues.push({
      code: "unresolved_discrepancy",
      message: `미해결 차단 항목 ${discrepancy.blockingIssues.length}건`,
    });
    missingItems.push("차이 항목 해결");
  }

  // Partial without plan
  if (!policy.allowPartialWithoutPlan && expectation?.partialReceivingExpected && !expectation.expectedFirstInboundDate) {
    warnings.push({ code: "partial_no_plan", message: "부분 입고 예정이나 첫 입고일이 없습니다." });
    missingItems.push("부분 입고 일정");
  }

  // Supplier issue
  if (snapshot?.issueFlag) {
    blockingIssues.push({ code: "supplier_issue", message: "미해결 공급사 이슈가 있습니다." });
    missingItems.push("공급사 이슈 해결");
  }

  // Document reference
  if (expectation && !expectation.documentReferenceComplete) {
    warnings.push({ code: "document_incomplete", message: "참조 문서가 완전하지 않습니다." });
  }

  // Discrepancy warnings
  if (discrepancy && discrepancy.warningIssues.length > 0) {
    warnings.push({
      code: "discrepancy_warnings",
      message: `주의 항목 ${discrepancy.warningIssues.length}건 확인 필요`,
    });
  }

  return {
    canPrepareReceiving: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    missingPreparationItems: missingItems,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Preparation Snapshot (locked seed)
// ══════════════════════════════════════════════════════════════════════════════

export interface ReceivingPreparationSnapshot {
  snapshotId: string;
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;

  // ── Lineage ──
  confirmationSnapshotId: string;
  inboundExpectationId: string;

  // ── Locked values ──
  expectedReceivingDate: string | null;
  expectedReceivingQtyStatus: ConfirmedQtyStatus;
  partialReceivingExpected: boolean;
  expectedSplitCount: number;

  // ── Handling ──
  receivingNoteSeed: string;
  storageNote: string | null;
  handlingNote: string | null;
  lotExpiryCaptureExpected: boolean;

  // ── Discrepancy context ──
  discrepancySummary: string | null;
  hasActiveWarnings: boolean;

  // ── Metadata ──
  preparedAt: string;
  preparedBy: string | null;
  lineCount: number;
  currency: string;
  grandTotal: number;
}

let _rps = 0;
function rpsUid(): string { return `rps_${Date.now()}_${++_rps}`; }

// ══════════════════════════════════════════════════════════════════════════════
// Lock Inbound Expectation (state transition)
// ══════════════════════════════════════════════════════════════════════════════

export interface LockInboundExpectationResult {
  success: boolean;
  snapshot: ReceivingPreparationSnapshot | null;
  tracking: ReceivingPreparationTracking;
  newState: PODraftState;
  reason: string | null;
}

export function lockInboundExpectation(input: {
  detail: PODetailModel;
  confirmSnapshot: SupplierConfirmationSnapshot;
  expectation: InboundExpectation;
  discrepancy: DiscrepancyEvaluation | null;
  tracking: ReceivingPreparationTracking;
  preparedBy?: string | null;
}): LockInboundExpectationResult {
  const { detail, confirmSnapshot, expectation, discrepancy, tracking } = input;

  // Guard: state
  if (detail.draftState !== "supplier_confirmed") {
    return {
      success: false,
      snapshot: null,
      tracking,
      newState: detail.draftState,
      reason: "공급 확정 상태에서만 입고 기준값을 잠글 수 있습니다.",
    };
  }

  // Guard: duplicate
  if (tracking.receivingPreparationSnapshotId) {
    return {
      success: false,
      snapshot: null,
      tracking,
      newState: detail.draftState,
      reason: "이미 입고 준비 기준값이 잠겨 있습니다.",
    };
  }

  // Validate readiness
  const gate = validateReceivingPreparationBeforeLock(detail, confirmSnapshot, expectation, discrepancy);
  if (!gate.canPrepareReceiving) {
    return {
      success: false,
      snapshot: null,
      tracking: {
        ...tracking,
        receivingPreparationStatus: "receiving_blocked",
        receivingBlockFlag: true,
        receivingBlockReason: gate.blockingIssues.map(i => i.message).join("; "),
      },
      newState: detail.draftState,
      reason: `차단 항목 ${gate.blockingIssues.length}건이 해결되지 않았습니다.`,
    };
  }

  const now = new Date().toISOString();

  // Build receiving note seed
  const noteParts: string[] = [];
  if (expectation.partialReceivingExpected) noteParts.push("부분 입고 예정");
  if (expectation.handlingNote) noteParts.push(expectation.handlingNote);
  if (expectation.storageNote) noteParts.push(expectation.storageNote);
  if (discrepancy && discrepancy.warningIssues.length > 0) {
    noteParts.push(`주의 항목 ${discrepancy.warningIssues.length}건`);
  }
  if (expectation.operatorPreparationNote) noteParts.push(expectation.operatorPreparationNote);

  const snapshot: ReceivingPreparationSnapshot = {
    snapshotId: rpsUid(),
    purchaseOrderId: detail.purchaseOrderId,
    vendorId: detail.supplierId,
    vendorName: detail.supplierName,
    confirmationSnapshotId: confirmSnapshot.snapshotId,
    inboundExpectationId: expectation.expectationId,
    expectedReceivingDate: expectation.expectedReceivingDate,
    expectedReceivingQtyStatus: expectation.expectedReceivingQtyStatus,
    partialReceivingExpected: expectation.partialReceivingExpected,
    expectedSplitCount: expectation.expectedSplitCount,
    receivingNoteSeed: noteParts.length > 0 ? noteParts.join(" / ") : "특이사항 없음",
    storageNote: expectation.storageNote,
    handlingNote: expectation.handlingNote,
    lotExpiryCaptureExpected: expectation.lotExpiryCaptureExpected,
    discrepancySummary: discrepancy?.hasDiscrepancy ? discrepancy.recommendedResolutionPath : null,
    hasActiveWarnings: (discrepancy?.warningIssues.length ?? 0) > 0,
    preparedAt: now,
    preparedBy: input.preparedBy ?? null,
    lineCount: detail.lineCount,
    currency: detail.currency,
    grandTotal: detail.grandTotal,
  };

  // Determine substatus
  let substatus: ReceivingPrepSubstatus;
  if (expectation.partialReceivingExpected) {
    substatus = "partial_receiving_expected";
  } else if (gate.warnings.length === 0) {
    substatus = "ready_for_receiving_execution";
  } else {
    substatus = "inbound_expectation_locked";
  }

  const updatedTracking: ReceivingPreparationTracking = {
    ...tracking,
    receivingPreparationStatus: substatus,
    receivingPreparedAt: now,
    receivingPreparedBy: input.preparedBy ?? null,
    inboundExpectationId: expectation.expectationId,
    receivingPreparationSnapshotId: snapshot.snapshotId,
    expectedReceivingDate: expectation.expectedReceivingDate,
    expectedReceivingQtySummary: expectation.expectedReceivingQtyStatus,
    partialReceivingExpected: expectation.partialReceivingExpected,
    expectedReceivingNote: snapshot.receivingNoteSeed,
    receivingBlockFlag: false,
    receivingBlockReason: null,
  };

  return {
    success: true,
    snapshot,
    tracking: updatedTracking,
    newState: "receiving_prepared",
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Execution Handoff Bundle
// ══════════════════════════════════════════════════════════════════════════════

export interface ReceivingExecutionHandoff {
  handoffId: string;
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;

  // ── Source ──
  receivingPreparationSnapshotId: string;
  confirmationSnapshotId: string;

  // ── Expected values ──
  expectedReceivingDate: string | null;
  expectedReceivingQtyStatus: ConfirmedQtyStatus;
  partialReceivingExpected: boolean;
  expectedSplitCount: number;

  // ── Receiving context ──
  receivingNoteSeed: string;
  lotExpiryCaptureExpected: boolean;
  storageNote: string | null;
  handlingNote: string | null;

  // ── Warnings/blockers ──
  discrepancySummary: string | null;
  hasActiveWarnings: boolean;
  blockerSummary: string | null;

  // ── Lineage ──
  lineCount: number;
  currency: string;
  grandTotal: number;

  // ── Metadata ──
  preparedAt: string;
  preparedBy: string | null;
}

let _reh = 0;
function rehUid(): string { return `reh_${Date.now()}_${++_reh}`; }

export function buildReceivingExecutionHandoff(
  detail: PODetailModel,
  prepSnapshot: ReceivingPreparationSnapshot
): ReceivingExecutionHandoff {
  return {
    handoffId: rehUid(),
    purchaseOrderId: detail.purchaseOrderId,
    vendorId: detail.supplierId,
    vendorName: detail.supplierName,
    receivingPreparationSnapshotId: prepSnapshot.snapshotId,
    confirmationSnapshotId: prepSnapshot.confirmationSnapshotId,
    expectedReceivingDate: prepSnapshot.expectedReceivingDate,
    expectedReceivingQtyStatus: prepSnapshot.expectedReceivingQtyStatus,
    partialReceivingExpected: prepSnapshot.partialReceivingExpected,
    expectedSplitCount: prepSnapshot.expectedSplitCount,
    receivingNoteSeed: prepSnapshot.receivingNoteSeed,
    lotExpiryCaptureExpected: prepSnapshot.lotExpiryCaptureExpected,
    storageNote: prepSnapshot.storageNote,
    handlingNote: prepSnapshot.handlingNote,
    discrepancySummary: prepSnapshot.discrepancySummary,
    hasActiveWarnings: prepSnapshot.hasActiveWarnings,
    blockerSummary: null,
    lineCount: prepSnapshot.lineCount,
    currency: prepSnapshot.currency,
    grandTotal: prepSnapshot.grandTotal,
    preparedAt: prepSnapshot.preparedAt,
    preparedBy: prepSnapshot.preparedBy,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Preparation Workbench Model (center + rail + dock)
// ══════════════════════════════════════════════════════════════════════════════

export interface ReceivingPrepWorkbenchModel {
  detail: PODetailModel | null;
  tracking: ReceivingPreparationTracking | null;
  expectation: InboundExpectation | null;
  prepSnapshot: ReceivingPreparationSnapshot | null;
  readinessGate: ReceivingReadinessGateResult | null;
  partialEval: PartialReceivingEvaluation | null;

  isReceivingPreparationVisible: boolean;

  // ── Header ──
  prepBadge: string;
  prepColor: "slate" | "amber" | "emerald" | "red" | "blue";

  // ── Dock CTAs ──
  primaryAction: ReceivingPrepDockAction;
  secondaryActions: ReceivingPrepDockAction[];

  // ── Rail checklist ──
  checklistItems: ReceivingPrepChecklistItem[];
}

export interface ReceivingPrepDockAction {
  id: string;
  label: string;
  enabled: boolean;
  reason: string | null;
}

export interface ReceivingPrepChecklistItem {
  label: string;
  status: "done" | "pending" | "blocked";
}

export function buildReceivingPrepWorkbenchModel(input: {
  detail: PODetailModel | null;
  tracking: ReceivingPreparationTracking | null;
  expectation: InboundExpectation | null;
  prepSnapshot: ReceivingPreparationSnapshot | null;
  readinessGate: ReceivingReadinessGateResult | null;
  partialEval: PartialReceivingEvaluation | null;
}): ReceivingPrepWorkbenchModel {
  const { detail, tracking, expectation, prepSnapshot, readinessGate, partialEval } = input;

  if (!detail || !tracking || detail.draftState !== "supplier_confirmed" && detail.draftState !== "receiving_prepared") {
    return {
      detail: null,
      tracking: null,
      expectation: null,
      prepSnapshot: null,
      readinessGate: null,
      partialEval: null,
      isReceivingPreparationVisible: false,
      prepBadge: "—",
      prepColor: "slate",
      primaryAction: { id: "noop", label: "—", enabled: false, reason: null },
      secondaryActions: [],
      checklistItems: [],
    };
  }

  // Badge
  let prepBadge: string;
  let prepColor: ReceivingPrepWorkbenchModel["prepColor"];
  switch (tracking.receivingPreparationStatus) {
    case "receiving_prep_pending":
      prepBadge = "입고 준비 대기";
      prepColor = "slate";
      break;
    case "inbound_expectation_locked":
      prepBadge = "기준값 잠금";
      prepColor = "blue";
      break;
    case "partial_receiving_expected":
      prepBadge = "부분 입고 예정";
      prepColor = "amber";
      break;
    case "receiving_blocked":
      prepBadge = "입고 차단";
      prepColor = "red";
      break;
    case "ready_for_receiving_execution":
      prepBadge = "입고 실행 가능";
      prepColor = "emerald";
      break;
  }

  // Checklist
  const hasExpectation = !!expectation;
  const hasSnapshot = !!prepSnapshot;
  const isBlocked = tracking.receivingBlockFlag;
  const isReady = tracking.receivingPreparationStatus === "ready_for_receiving_execution";

  const checklist: ReceivingPrepChecklistItem[] = [
    { label: "공급 확정 완료", status: "done" },
    {
      label: "입고 예상값 생성",
      status: hasExpectation ? "done" : "pending",
    },
    {
      label: "부분 입고 검토",
      status: partialEval
        ? partialEval.blockingIssues.length > 0
          ? "blocked"
          : "done"
        : (expectation?.partialReceivingExpected ? "pending" : "done"),
    },
    {
      label: "입고 기준값 잠금",
      status: hasSnapshot ? "done" : isBlocked ? "blocked" : "pending",
    },
    {
      label: "입고 실행 가능",
      status: isReady ? "done" : isBlocked ? "blocked" : "pending",
    },
  ];

  // Dock actions
  let primaryAction: ReceivingPrepDockAction;
  if (!hasExpectation) {
    primaryAction = {
      id: "build_expectation",
      label: "입고 예상값 생성",
      enabled: true,
      reason: null,
    };
  } else if (!hasSnapshot && !isBlocked) {
    primaryAction = {
      id: "lock_expectation",
      label: "입고 기준값 잠금",
      enabled: readinessGate ? readinessGate.canPrepareReceiving : false,
      reason: readinessGate && !readinessGate.canPrepareReceiving
        ? `차단 항목 ${readinessGate.blockingIssues.length}건`
        : null,
    };
  } else if (isBlocked) {
    primaryAction = {
      id: "review_blockers",
      label: "차단 항목 검토",
      enabled: true,
      reason: null,
    };
  } else if (isReady || hasSnapshot) {
    primaryAction = {
      id: "open_receiving_workbench",
      label: "입고 실행 화면 열기",
      enabled: true,
      reason: null,
    };
  } else {
    primaryAction = {
      id: "lock_expectation",
      label: "입고 기준값 잠금",
      enabled: false,
      reason: "준비 조건 미충족",
    };
  }

  const secondaryActions: ReceivingPrepDockAction[] = [];

  if (hasExpectation && !hasSnapshot) {
    secondaryActions.push({
      id: "update_confirmation",
      label: "확정값 수정",
      enabled: true,
      reason: null,
    });
  }

  if (isBlocked) {
    secondaryActions.push({
      id: "escalate_issue",
      label: "이슈 에스컬레이션",
      enabled: true,
      reason: null,
    });
  }

  if (hasSnapshot && primaryAction.id !== "open_receiving_workbench") {
    secondaryActions.push({
      id: "open_receiving_workbench",
      label: "입고 실행 화면 열기",
      enabled: true,
      reason: null,
    });
  }

  return {
    detail,
    tracking,
    expectation,
    prepSnapshot,
    readinessGate,
    partialEval,
    isReceivingPreparationVisible: true,
    prepBadge,
    prepColor,
    primaryAction,
    secondaryActions,
    checklistItems: checklist,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Preparation Queue Row Badge
// ══════════════════════════════════════════════════════════════════════════════

export interface ReceivingPrepQueueRowBadge {
  purchaseOrderId: string;
  vendorName: string;
  stateBadge: string;
  prepBadge: string;
  stateColor: "slate" | "amber" | "emerald" | "red" | "blue";
  partialReceivingExpected: boolean;
  receivingBlockFlag: boolean;
  nextAction: string;
}

export function buildReceivingPrepQueueRowBadge(
  detail: PODetailModel,
  tracking: ReceivingPreparationTracking
): ReceivingPrepQueueRowBadge {
  let stateColor: ReceivingPrepQueueRowBadge["stateColor"];
  if (tracking.receivingBlockFlag) {
    stateColor = "red";
  } else if (tracking.receivingPreparationStatus === "partial_receiving_expected") {
    stateColor = "amber";
  } else if (tracking.receivingPreparationStatus === "ready_for_receiving_execution") {
    stateColor = "emerald";
  } else if (tracking.receivingPreparationSnapshotId) {
    stateColor = "blue";
  } else {
    stateColor = "slate";
  }

  const prepBadge = RECEIVING_PREP_SUBSTATUS_LABELS[tracking.receivingPreparationStatus];

  let nextAction: string;
  if (tracking.receivingBlockFlag) {
    nextAction = tracking.receivingBlockReason ?? "차단 항목 확인 필요";
  } else if (!tracking.inboundExpectationId) {
    nextAction = "입고 예상값 생성 필요";
  } else if (!tracking.receivingPreparationSnapshotId) {
    nextAction = "입고 기준값 잠금 필요";
  } else if (tracking.receivingPreparationStatus === "ready_for_receiving_execution") {
    nextAction = "입고 실행 가능";
  } else {
    nextAction = "입고 준비 진행 중";
  }

  return {
    purchaseOrderId: detail.purchaseOrderId,
    vendorName: detail.supplierName,
    stateBadge: detail.draftState === "receiving_prepared" ? "입고 준비 완료" : "공급 확정",
    prepBadge,
    stateColor,
    partialReceivingExpected: tracking.partialReceivingExpected,
    receivingBlockFlag: tracking.receivingBlockFlag,
    nextAction,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Preparation Activity Events
// ══════════════════════════════════════════════════════════════════════════════

export type ReceivingPrepActivityType =
  | "receiving_prep_started"
  | "inbound_expectation_built"
  | "partial_receiving_evaluated"
  | "inbound_expectation_locked"
  | "receiving_prep_blocked"
  | "receiving_prep_unblocked"
  | "receiving_execution_handoff_created";

export interface ReceivingPrepActivity {
  type: ReceivingPrepActivityType;
  at: string;
  actorId: string | null;
  summary: string;
  snapshotId: string | null;
}

export function createReceivingPrepActivity(input: {
  type: ReceivingPrepActivityType;
  actorId?: string;
  summary: string;
  snapshotId?: string;
}): ReceivingPrepActivity {
  return {
    type: input.type,
    at: new Date().toISOString(),
    actorId: input.actorId ?? null,
    summary: input.summary,
    snapshotId: input.snapshotId ?? null,
  };
}
