/**
 * Available Stock Release Workbench — lot-aware release + hold resolution + availability event
 *
 * 고정 규칙:
 * 1. stocked_recorded ≠ available stock. release eligibility 통과 후에만 가용 전환.
 * 2. lot 단위 eligibility 판단. aggregate-only release 금지.
 * 3. quarantine / hold resolution은 canonical event. free-text 메모 금지.
 * 4. stocked_recorded → stock_release_in_progress → stock_available_recorded 단방향.
 * 5. inventory list / lot detail / reorder signal은 release event 기준. stock movement 직접 재사용 금지.
 * 6. stock_available_recorded ≠ 전량 정상 사용 가능. partial availability 구분 유지.
 * 7. queue badge = detail availability status. 동일 source.
 */

import type { PODetailModel, PODraftState } from "./po-created-detail";
import type { StockMovement, StockMovementLine, StockDisposition } from "./inventory-intake-workbench";

// ══════════════════════════════════════════════════════════════════════════════
// Stock Availability Substatus
// ══════════════════════════════════════════════════════════════════════════════

export type StockAvailabilitySubstatus =
  | "awaiting_release_review"
  | "lot_release_pending"
  | "quarantine_hold_remaining"
  | "release_blocked"
  | "partially_available"
  | "available_release_completed";

export const STOCK_AVAILABILITY_SUBSTATUS_LABELS: Record<StockAvailabilitySubstatus, string> = {
  awaiting_release_review: "가용 검토 대기",
  lot_release_pending: "Lot 해제 대기",
  quarantine_hold_remaining: "격리/보류 잔존",
  release_blocked: "가용 전환 차단",
  partially_available: "부분 가용",
  available_release_completed: "가용 전환 완료",
};

// ══════════════════════════════════════════════════════════════════════════════
// Stock Availability Tracking
// ══════════════════════════════════════════════════════════════════════════════

export interface StockAvailabilityTracking {
  purchaseOrderId: string;
  stockAvailabilityStatus: StockAvailabilitySubstatus;
  stockReleaseStartedAt: string | null;
  stockReleaseStartedBy: string | null;
  stockAvailableRecordedAt: string | null;
  stockAvailableRecordedBy: string | null;
  availableQtySummary: string | null;
  heldQtySummary: string | null;
  quarantineRemainingQtySummary: string | null;
  releaseBlockedFlag: boolean;
  releaseBlockedReason: string | null;
  availabilityReleaseEventId: string | null;
  stockMovementId: string | null;
}

export function createInitialStockAvailabilityTracking(
  purchaseOrderId: string,
  stockMovementId: string
): StockAvailabilityTracking {
  return {
    purchaseOrderId,
    stockAvailabilityStatus: "awaiting_release_review",
    stockReleaseStartedAt: null,
    stockReleaseStartedBy: null,
    stockAvailableRecordedAt: null,
    stockAvailableRecordedBy: null,
    availableQtySummary: null,
    heldQtySummary: null,
    quarantineRemainingQtySummary: null,
    releaseBlockedFlag: false,
    releaseBlockedReason: null,
    availabilityReleaseEventId: null,
    stockMovementId,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Start Availability Release Review
// ══════════════════════════════════════════════════════════════════════════════

export interface StartReleaseReviewResult {
  success: boolean;
  tracking: StockAvailabilityTracking;
  newState: PODraftState;
  reason: string | null;
}

export function startAvailabilityReleaseReview(
  detail: PODetailModel,
  tracking: StockAvailabilityTracking,
  startedBy?: string | null
): StartReleaseReviewResult {
  if (detail.draftState !== "stocked_recorded") {
    return { success: false, tracking, newState: detail.draftState, reason: "재고 반영 완료 상태에서만 가용 전환을 시작할 수 있습니다." };
  }
  if (tracking.stockReleaseStartedAt) {
    return { success: false, tracking, newState: detail.draftState, reason: "이미 가용 전환이 시작되었습니다." };
  }
  if (!tracking.stockMovementId) {
    return { success: false, tracking, newState: detail.draftState, reason: "재고 이동 기록이 없습니다." };
  }

  const now = new Date().toISOString();
  return {
    success: true,
    tracking: {
      ...tracking,
      stockAvailabilityStatus: "lot_release_pending",
      stockReleaseStartedAt: now,
      stockReleaseStartedBy: startedBy ?? null,
    },
    newState: "stock_release_in_progress",
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Lot Release Eligibility
// ══════════════════════════════════════════════════════════════════════════════

export interface LotEligibility {
  lineId: string;
  lotNumber: string | null;
  itemName: string;
  currentDisposition: StockDisposition;
  eligible: boolean;
  blockReasons: string[];
  qty: number;
}

export interface LotReleaseEligibilityResult {
  eligibleLots: LotEligibility[];
  blockedLots: LotEligibility[];
  availableQtySummary: number;
  heldQtySummary: number;
  quarantineQtySummary: number;
  blockingIssues: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
}

export interface LotReleasePolicy {
  requireLotNumber: boolean;
  requireExpiryValid: boolean;
  requireStorageCompliant: boolean;
  autoReleaseOnInspectionClear: boolean;
  blockDamagedFromRelease: boolean;
}

export const DEFAULT_LOT_RELEASE_POLICY: LotReleasePolicy = {
  requireLotNumber: true,
  requireExpiryValid: true,
  requireStorageCompliant: false,
  autoReleaseOnInspectionClear: false,
  blockDamagedFromRelease: true,
};

export function evaluateLotReleaseEligibility(
  movement: StockMovement,
  policy: LotReleasePolicy = DEFAULT_LOT_RELEASE_POLICY
): LotReleaseEligibilityResult {
  const eligible: LotEligibility[] = [];
  const blocked: LotEligibility[] = [];
  const globalBlocking: { code: string; message: string }[] = [];
  const globalWarnings: { code: string; message: string }[] = [];

  for (const line of movement.lines) {
    const blockReasons: string[] = [];

    // Lot check
    if (policy.requireLotNumber && !line.lotNumber) {
      blockReasons.push("Lot 번호 없음");
    }

    // Expiry check
    if (policy.requireExpiryValid && line.expiryDate) {
      const exp = new Date(line.expiryDate).getTime();
      if (exp < Date.now()) {
        blockReasons.push("유효기한 만료");
      }
    } else if (policy.requireExpiryValid && !line.expiryDate && line.disposition !== "discard") {
      blockReasons.push("유효기한 없음");
    }

    // Damaged / discard
    if (line.disposition === "damaged" && policy.blockDamagedFromRelease) {
      blockReasons.push("파손 품목");
    }
    if (line.disposition === "discard") {
      blockReasons.push("폐기 대상");
    }

    // Quarantine
    if (line.disposition === "quarantine") {
      blockReasons.push("격리 상태 미해제");
    }

    const lotEntry: LotEligibility = {
      lineId: line.lineId,
      lotNumber: line.lotNumber,
      itemName: line.itemName,
      currentDisposition: line.disposition,
      eligible: blockReasons.length === 0,
      blockReasons,
      qty: line.stockedQty,
    };

    if (blockReasons.length === 0) {
      eligible.push(lotEntry);
    } else {
      blocked.push(lotEntry);
    }
  }

  if (eligible.length === 0) {
    globalBlocking.push({ code: "no_eligible_lots", message: "가용 전환 가능한 Lot이 없습니다." });
  }

  const quarantineLots = blocked.filter(l => l.currentDisposition === "quarantine");
  if (quarantineLots.length > 0) {
    globalWarnings.push({ code: "quarantine_remaining", message: `격리 Lot ${quarantineLots.length}건이 남아 있습니다.` });
  }

  const damagedLots = blocked.filter(l => l.currentDisposition === "damaged");
  if (damagedLots.length > 0) {
    globalWarnings.push({ code: "damaged_remaining", message: `파손 Lot ${damagedLots.length}건이 있습니다.` });
  }

  return {
    eligibleLots: eligible,
    blockedLots: blocked,
    availableQtySummary: eligible.reduce((s, l) => s + l.qty, 0),
    heldQtySummary: blocked.filter(l => l.currentDisposition === "hold").reduce((s, l) => s + l.qty, 0),
    quarantineQtySummary: quarantineLots.reduce((s, l) => s + l.qty, 0),
    blockingIssues: globalBlocking,
    warnings: globalWarnings,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Hold / Quarantine Resolution
// ══════════════════════════════════════════════════════════════════════════════

export type HoldResolutionType =
  | "inspection_cleared"
  | "quarantine_maintained"
  | "quarantine_released"
  | "damaged_kept_blocked"
  | "discard_pending"
  | "supplier_issue_pending"
  | "documentation_pending";

export const HOLD_RESOLUTION_TYPE_LABELS: Record<HoldResolutionType, string> = {
  inspection_cleared: "검사 통과",
  quarantine_maintained: "격리 유지",
  quarantine_released: "격리 해제",
  damaged_kept_blocked: "파손 차단 유지",
  discard_pending: "폐기 대기",
  supplier_issue_pending: "공급사 이슈 보류",
  documentation_pending: "문서 보완 대기",
};

export interface HoldResolutionRecord {
  resolutionId: string;
  lotIds: string[];
  resolutionType: HoldResolutionType;
  resolvedAt: string;
  resolvedBy: string | null;
  resolutionReason: string;
  availableReleaseAllowed: boolean;
  followupRequired: boolean;
}

let _hr = 0;
function hrUid(): string { return `hr_${Date.now()}_${++_hr}`; }

export function resolveStockHoldDisposition(
  movement: StockMovement,
  lotLineIds: string[],
  resolutionType: HoldResolutionType,
  reason: string,
  resolvedBy?: string | null
): { movement: StockMovement; resolution: HoldResolutionRecord } {
  const allowRelease = resolutionType === "inspection_cleared" || resolutionType === "quarantine_released";

  // Update movement lines
  const updatedMovement: StockMovement = {
    ...movement,
    lines: movement.lines.map(l => {
      if (!lotLineIds.includes(l.lineId)) return l;
      if (allowRelease) return { ...l, disposition: "available" as StockDisposition };
      if (resolutionType === "discard_pending") return { ...l, disposition: "discard" as StockDisposition };
      return l;
    }),
  };

  // Recompute qtys
  updatedMovement.availableQty = updatedMovement.lines.filter(l => l.disposition === "available").reduce((s, l) => s + l.stockedQty, 0);
  updatedMovement.holdQty = updatedMovement.lines.filter(l => l.disposition === "hold").reduce((s, l) => s + l.stockedQty, 0);
  updatedMovement.quarantineQty = updatedMovement.lines.filter(l => l.disposition === "quarantine").reduce((s, l) => s + l.stockedQty, 0);
  updatedMovement.damagedQty = updatedMovement.lines.filter(l => l.disposition === "damaged").reduce((s, l) => s + l.stockedQty, 0);
  updatedMovement.discardQty = updatedMovement.lines.filter(l => l.disposition === "discard").reduce((s, l) => s + l.stockedQty, 0);

  const resolution: HoldResolutionRecord = {
    resolutionId: hrUid(),
    lotIds: lotLineIds,
    resolutionType,
    resolvedAt: new Date().toISOString(),
    resolvedBy: resolvedBy ?? null,
    resolutionReason: reason,
    availableReleaseAllowed: allowRelease,
    followupRequired: resolutionType === "supplier_issue_pending" || resolutionType === "documentation_pending",
  };

  return { movement: updatedMovement, resolution };
}

// ══════════════════════════════════════════════════════════════════════════════
// Availability Release Validator
// ══════════════════════════════════════════════════════════════════════════════

export interface ReleaseValidationResult {
  canFinalizeRelease: boolean;
  blockingIssues: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  missingReleaseItems: string[];
  recommendedNextAction: string;
}

export function validateAvailabilityReleaseBeforeFinalize(
  movement: StockMovement | null,
  eligibility: LotReleaseEligibilityResult | null
): ReleaseValidationResult {
  const blocking: { code: string; message: string }[] = [];
  const warnings: { code: string; message: string }[] = [];
  const missingItems: string[] = [];

  if (!movement) {
    blocking.push({ code: "no_movement", message: "재고 이동 기록이 없습니다." });
    return { canFinalizeRelease: false, blockingIssues: blocking, warnings, missingReleaseItems: ["재고 이동 기록"], recommendedNextAction: "재고 이동 기록 확인" };
  }

  if (!eligibility) {
    blocking.push({ code: "no_eligibility", message: "Lot 가용성 평가가 없습니다." });
    missingItems.push("Lot 가용성 평가");
  } else {
    if (eligibility.eligibleLots.length === 0) {
      blocking.push({ code: "no_eligible", message: "가용 전환 가능한 Lot이 없습니다." });
      missingItems.push("가용 가능 Lot");
    }
    if (eligibility.quarantineQtySummary > 0) {
      warnings.push({ code: "quarantine_remaining", message: `격리 수량 ${eligibility.quarantineQtySummary}이(가) 남아 있습니다.` });
    }
    // Propagate eligibility blocking
    for (const issue of eligibility.blockingIssues) {
      blocking.push(issue);
    }
  }

  // Lineage
  if (!movement.receivingEventId) {
    blocking.push({ code: "no_lineage", message: "입고 기록 연결이 없습니다." });
    missingItems.push("입고 기록 연결");
  }

  let recommendedNextAction: string;
  if (blocking.length > 0) {
    recommendedNextAction = `차단 항목 ${blocking.length}건 해결 필요`;
  } else if (warnings.length > 0) {
    recommendedNextAction = `주의 ${warnings.length}건 확인 후 가용 전환 가능`;
  } else {
    recommendedNextAction = "가용 재고 전환 가능";
  }

  return { canFinalizeRelease: blocking.length === 0, blockingIssues: blocking, warnings, missingReleaseItems: missingItems, recommendedNextAction };
}

// ══════════════════════════════════════════════════════════════════════════════
// Availability Release Event (canonical)
// ══════════════════════════════════════════════════════════════════════════════

export interface AvailabilityReleaseEvent {
  eventId: string;
  purchaseOrderId: string;
  stockMovementId: string;
  releasedAt: string;
  releasedBy: string | null;
  availableQty: number;
  heldQty: number;
  quarantineQty: number;
  damagedQty: number;
  discardQty: number;
  eligibleLotCount: number;
  blockedLotCount: number;
  lotStatuses: { lineId: string; lotNumber: string | null; status: StockDisposition; qty: number }[];
  resolutions: HoldResolutionRecord[];
  isPartialRelease: boolean;
}

let _are = 0;
function areUid(): string { return `are_${Date.now()}_${++_are}`; }

// ══════════════════════════════════════════════════════════════════════════════
// Finalize Availability Release
// ══════════════════════════════════════════════════════════════════════════════

export interface FinalizeReleaseResult {
  success: boolean;
  event: AvailabilityReleaseEvent | null;
  tracking: StockAvailabilityTracking;
  newState: PODraftState;
  reason: string | null;
}

export function finalizeAvailabilityRelease(
  detail: PODetailModel,
  tracking: StockAvailabilityTracking,
  movement: StockMovement,
  eligibility: LotReleaseEligibilityResult,
  resolutions: HoldResolutionRecord[],
  releasedBy?: string | null
): FinalizeReleaseResult {
  if (detail.draftState !== "stock_release_in_progress") {
    return { success: false, event: null, tracking, newState: detail.draftState, reason: "가용 전환 진행 중에만 완료할 수 있습니다." };
  }

  const validation = validateAvailabilityReleaseBeforeFinalize(movement, eligibility);
  if (!validation.canFinalizeRelease) {
    return {
      success: false,
      event: null,
      tracking: { ...tracking, stockAvailabilityStatus: "release_blocked", releaseBlockedFlag: true, releaseBlockedReason: validation.blockingIssues.map(i => i.message).join("; ") },
      newState: detail.draftState,
      reason: `차단 항목 ${validation.blockingIssues.length}건이 해결되지 않았습니다.`,
    };
  }

  const now = new Date().toISOString();
  const isPartial = eligibility.blockedLots.length > 0 || movement.quarantineQty > 0 || movement.holdQty > 0;

  const event: AvailabilityReleaseEvent = {
    eventId: areUid(),
    purchaseOrderId: detail.purchaseOrderId,
    stockMovementId: movement.movementId,
    releasedAt: now,
    releasedBy: releasedBy ?? null,
    availableQty: movement.availableQty,
    heldQty: movement.holdQty,
    quarantineQty: movement.quarantineQty,
    damagedQty: movement.damagedQty,
    discardQty: movement.discardQty,
    eligibleLotCount: eligibility.eligibleLots.length,
    blockedLotCount: eligibility.blockedLots.length,
    lotStatuses: movement.lines.map(l => ({ lineId: l.lineId, lotNumber: l.lotNumber, status: l.disposition, qty: l.stockedQty })),
    resolutions,
    isPartialRelease: isPartial,
  };

  let substatus: StockAvailabilitySubstatus;
  if (isPartial && movement.quarantineQty > 0) {
    substatus = "quarantine_hold_remaining";
  } else if (isPartial) {
    substatus = "partially_available";
  } else {
    substatus = "available_release_completed";
  }

  return {
    success: true,
    event,
    tracking: {
      ...tracking,
      stockAvailabilityStatus: substatus,
      stockAvailableRecordedAt: now,
      stockAvailableRecordedBy: releasedBy ?? null,
      availableQtySummary: `${movement.availableQty}`,
      heldQtySummary: `${movement.holdQty}`,
      quarantineRemainingQtySummary: movement.quarantineQty > 0 ? `${movement.quarantineQty}` : null,
      releaseBlockedFlag: false,
      releaseBlockedReason: null,
      availabilityReleaseEventId: event.eventId,
    },
    newState: "stock_available_recorded",
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Inventory Sync (downstream surfaces)
// ══════════════════════════════════════════════════════════════════════════════

export type InventoryLotAvailabilityStatus = "Available" | "Hold" | "Quarantine" | "Blocked" | "Damaged";

export interface InventorySyncResult {
  updatedLotStatuses: { lineId: string; lotNumber: string | null; availabilityStatus: InventoryLotAvailabilityStatus; usableQty: number }[];
  totalUsableQty: number;
  totalHeldQty: number;
  reorderSignalTriggered: boolean;
}

export function syncAvailabilityFromReleaseEvent(
  event: AvailabilityReleaseEvent,
  safetyStockLevel?: number
): InventorySyncResult {
  const updatedLotStatuses = event.lotStatuses.map(l => {
    let availabilityStatus: InventoryLotAvailabilityStatus;
    switch (l.status) {
      case "available": availabilityStatus = "Available"; break;
      case "hold": availabilityStatus = "Hold"; break;
      case "quarantine": availabilityStatus = "Quarantine"; break;
      case "damaged": availabilityStatus = "Damaged"; break;
      case "discard": availabilityStatus = "Blocked"; break;
      default: availabilityStatus = "Hold";
    }
    return {
      lineId: l.lineId,
      lotNumber: l.lotNumber,
      availabilityStatus,
      usableQty: l.status === "available" ? l.qty : 0,
    };
  });

  const totalUsableQty = updatedLotStatuses.reduce((s, l) => s + l.usableQty, 0);
  const totalHeldQty = event.heldQty + event.quarantineQty + event.damagedQty;
  const reorderSignalTriggered = safetyStockLevel !== undefined && totalUsableQty < safetyStockLevel;

  return { updatedLotStatuses, totalUsableQty, totalHeldQty, reorderSignalTriggered };
}

// ══════════════════════════════════════════════════════════════════════════════
// Stock Release Workbench Model (center + rail + dock)
// ══════════════════════════════════════════════════════════════════════════════

export interface StockReleaseWorkbenchModel {
  detail: PODetailModel | null;
  tracking: StockAvailabilityTracking | null;
  eligibility: LotReleaseEligibilityResult | null;
  validation: ReleaseValidationResult | null;
  isReleaseVisible: boolean;
  releaseBadge: string;
  releaseColor: "slate" | "amber" | "emerald" | "red" | "blue";
  primaryAction: { id: string; label: string; enabled: boolean; reason: string | null };
  secondaryActions: { id: string; label: string; enabled: boolean; reason: string | null }[];
  checklistItems: { label: string; status: "done" | "pending" | "blocked" }[];
}

export function buildStockReleaseWorkbenchModel(input: {
  detail: PODetailModel | null;
  tracking: StockAvailabilityTracking | null;
  movement: StockMovement | null;
  eligibility: LotReleaseEligibilityResult | null;
}): StockReleaseWorkbenchModel {
  const { detail, tracking, movement, eligibility } = input;
  const validation = movement && eligibility ? validateAvailabilityReleaseBeforeFinalize(movement, eligibility) : null;

  const validStates: PODraftState[] = ["stocked_recorded", "stock_release_in_progress", "stock_available_recorded"];
  if (!detail || !tracking || !validStates.includes(detail.draftState)) {
    return {
      detail: null, tracking: null, eligibility: null, validation: null,
      isReleaseVisible: false, releaseBadge: "—", releaseColor: "slate",
      primaryAction: { id: "noop", label: "—", enabled: false, reason: null },
      secondaryActions: [], checklistItems: [],
    };
  }

  const badge = STOCK_AVAILABILITY_SUBSTATUS_LABELS[tracking.stockAvailabilityStatus];
  let color: StockReleaseWorkbenchModel["releaseColor"] = "slate";
  if (tracking.releaseBlockedFlag) color = "red";
  else if (tracking.stockAvailabilityStatus === "available_release_completed") color = "emerald";
  else if (tracking.stockAvailabilityStatus === "partially_available") color = "amber";
  else if (tracking.stockAvailabilityStatus === "quarantine_hold_remaining") color = "amber";
  else if (tracking.availabilityReleaseEventId) color = "blue";

  let primaryAction: StockReleaseWorkbenchModel["primaryAction"];
  if (!tracking.stockReleaseStartedAt) {
    primaryAction = { id: "start_review", label: "가용 검토 시작", enabled: true, reason: null };
  } else if (!eligibility) {
    primaryAction = { id: "evaluate_eligibility", label: "Lot 가용성 평가", enabled: true, reason: null };
  } else if (tracking.releaseBlockedFlag) {
    primaryAction = { id: "review_blockers", label: "차단 항목 검토", enabled: true, reason: null };
  } else if (!tracking.availabilityReleaseEventId) {
    primaryAction = { id: "finalize_release", label: "가용 재고 전환 완료", enabled: validation?.canFinalizeRelease ?? false, reason: validation && !validation.canFinalizeRelease ? `차단 ${validation.blockingIssues.length}건` : null };
  } else {
    primaryAction = { id: "open_inventory", label: "재고 상세 확인", enabled: true, reason: null };
  }

  const secondaryActions: StockReleaseWorkbenchModel["secondaryActions"] = [];
  if (eligibility && eligibility.blockedLots.length > 0 && !tracking.availabilityReleaseEventId) {
    secondaryActions.push({ id: "resolve_holds", label: "보류/격리 해제", enabled: true, reason: null });
  }
  if (tracking.availabilityReleaseEventId && primaryAction.id !== "open_inventory") {
    secondaryActions.push({ id: "open_inventory", label: "재고 상세 확인", enabled: true, reason: null });
  }

  const hasEligibility = !!eligibility;
  const hasRelease = !!tracking.availabilityReleaseEventId;
  const noBlocked = !eligibility || eligibility.blockedLots.length === 0;

  const checklist: StockReleaseWorkbenchModel["checklistItems"] = [
    { label: "가용 검토 시작", status: tracking.stockReleaseStartedAt ? "done" : "pending" },
    { label: "Lot 가용성 평가", status: hasEligibility ? "done" : "pending" },
    { label: "보류/격리 해결", status: hasEligibility ? (noBlocked ? "done" : "pending") : "pending" },
    { label: "가용 전환 완료", status: hasRelease ? "done" : tracking.releaseBlockedFlag ? "blocked" : "pending" },
  ];

  return {
    detail, tracking, eligibility, validation,
    isReleaseVisible: true, releaseBadge: badge, releaseColor: color,
    primaryAction, secondaryActions, checklistItems: checklist,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Stock Release Queue Row Badge
// ══════════════════════════════════════════════════════════════════════════════

export interface StockReleaseQueueRowBadge {
  purchaseOrderId: string;
  vendorName: string;
  stateBadge: string;
  releaseBadge: string;
  stateColor: "slate" | "amber" | "emerald" | "red" | "blue";
  quarantineRemaining: boolean;
  releaseBlocked: boolean;
  nextAction: string;
}

export function buildStockReleaseQueueRowBadge(
  detail: PODetailModel,
  tracking: StockAvailabilityTracking
): StockReleaseQueueRowBadge {
  let stateColor: StockReleaseQueueRowBadge["stateColor"] = "slate";
  if (tracking.releaseBlockedFlag) stateColor = "red";
  else if (tracking.stockAvailabilityStatus === "quarantine_hold_remaining") stateColor = "amber";
  else if (tracking.stockAvailabilityStatus === "partially_available") stateColor = "amber";
  else if (tracking.stockAvailabilityStatus === "available_release_completed") stateColor = "emerald";
  else if (tracking.availabilityReleaseEventId) stateColor = "blue";

  let nextAction: string;
  if (!tracking.stockReleaseStartedAt) nextAction = "가용 검토 시작 필요";
  else if (tracking.releaseBlockedFlag) nextAction = tracking.releaseBlockedReason ?? "차단 항목 확인";
  else if (!tracking.availabilityReleaseEventId) nextAction = "가용 전환 완료 필요";
  else if (tracking.stockAvailabilityStatus === "quarantine_hold_remaining") nextAction = "격리 해제 대기";
  else nextAction = "가용 전환 완료";

  return {
    purchaseOrderId: detail.purchaseOrderId,
    vendorName: detail.supplierName,
    stateBadge: detail.draftState === "stock_available_recorded" ? "가용 재고 전환 완료" : detail.draftState === "stock_release_in_progress" ? "가용 전환 진행 중" : "재고 반영 완료",
    releaseBadge: STOCK_AVAILABILITY_SUBSTATUS_LABELS[tracking.stockAvailabilityStatus],
    stateColor,
    quarantineRemaining: tracking.quarantineRemainingQtySummary !== null,
    releaseBlocked: tracking.releaseBlockedFlag,
    nextAction,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Stock Release Activity Events
// ══════════════════════════════════════════════════════════════════════════════

export type StockReleaseActivityType =
  | "release_review_started"
  | "lot_eligibility_evaluated"
  | "hold_resolution_recorded"
  | "availability_release_finalized"
  | "inventory_sync_completed"
  | "reorder_signal_triggered"
  | "release_blocked";

export interface StockReleaseActivity {
  type: StockReleaseActivityType;
  at: string;
  actorId: string | null;
  summary: string;
  eventId: string | null;
}

export function createStockReleaseActivity(input: {
  type: StockReleaseActivityType;
  actorId?: string;
  summary: string;
  eventId?: string;
}): StockReleaseActivity {
  return {
    type: input.type,
    at: new Date().toISOString(),
    actorId: input.actorId ?? null,
    summary: input.summary,
    eventId: input.eventId ?? null,
  };
}
