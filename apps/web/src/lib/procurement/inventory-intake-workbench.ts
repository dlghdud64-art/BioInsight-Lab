/**
 * Inventory Intake Workbench — stock movement creation + lot registration + disposition + stocked
 *
 * 고정 규칙:
 * 1. received_recorded 이후 재고 반영은 receiving event 기반. confirmation/prep 직접 재사용 금지.
 * 2. stock movement는 canonical object. inventory list 표시값을 source of truth로 삼지 말 것.
 * 3. lot registration은 line-level. aggregate-only stock 금지.
 * 4. received_recorded → inventory_intake_in_progress → stocked_recorded 단방향.
 * 5. disposition (available/hold/quarantine/damaged) 결정은 intake 단계에서 잠김.
 * 6. stocked_recorded ≠ 사용 가능 재고. availability release가 별도 필요.
 * 7. queue badge = detail intake status. 동일 source.
 */

import type { PODetailModel, PODraftState } from "./po-created-detail";
import type { ReceivingEvent, ReceivedLineRecord } from "./receiving-execution-workbench";

// ══════════════════════════════════════════════════════════════════════════════
// Inventory Intake Substatus
// ══════════════════════════════════════════════════════════════════════════════

export type InventoryIntakeSubstatus =
  | "awaiting_intake_start"
  | "lot_registration_in_progress"
  | "disposition_pending"
  | "intake_blocked"
  | "stocked_complete";

export const INVENTORY_INTAKE_SUBSTATUS_LABELS: Record<InventoryIntakeSubstatus, string> = {
  awaiting_intake_start: "재고 반영 대기",
  lot_registration_in_progress: "Lot 등록 진행 중",
  disposition_pending: "배치 결정 대기",
  intake_blocked: "반영 차단",
  stocked_complete: "재고 반영 완료",
};

// ══════════════════════════════════════════════════════════════════════════════
// Stock Movement (canonical inventory object)
// ══════════════════════════════════════════════════════════════════════════════

export type StockDisposition = "available" | "hold" | "quarantine" | "damaged" | "discard";

export const STOCK_DISPOSITION_LABELS: Record<StockDisposition, string> = {
  available: "사용 가능",
  hold: "보류",
  quarantine: "격리",
  damaged: "파손",
  discard: "폐기 대기",
};

export interface StockMovementLine {
  lineId: string;
  itemId: string | null;
  itemName: string;
  lotNumber: string | null;
  expiryDate: string | null;
  stockedQty: number;
  disposition: StockDisposition;
  storageLocation: string | null;
  storageCondition: string | null;
  lineNote: string | null;
}

export interface StockMovement {
  movementId: string;
  purchaseOrderId: string;
  receivingEventId: string;

  // ── Lines ──
  lines: StockMovementLine[];
  totalStockedQty: number;
  lotCount: number;

  // ── Disposition summary ──
  availableQty: number;
  holdQty: number;
  quarantineQty: number;
  damagedQty: number;
  discardQty: number;

  // ── Metadata ──
  createdAt: string;
  createdBy: string | null;
}

let _sm = 0;
function smUid(): string { return `sm_${Date.now()}_${++_sm}`; }

// ══════════════════════════════════════════════════════════════════════════════
// Inventory Intake Tracking
// ══════════════════════════════════════════════════════════════════════════════

export interface InventoryIntakeTracking {
  purchaseOrderId: string;
  inventoryIntakeStatus: InventoryIntakeSubstatus;
  intakeStartedAt: string | null;
  intakeStartedBy: string | null;
  stockedRecordedAt: string | null;
  stockedRecordedBy: string | null;
  stockMovementId: string | null;
  receivingEventId: string | null;
  totalStockedQty: number;
  dispositionSummary: string | null;
  intakeBlockFlag: boolean;
  intakeBlockReason: string | null;
}

export function createInitialInventoryIntakeTracking(
  purchaseOrderId: string,
  receivingEventId: string
): InventoryIntakeTracking {
  return {
    purchaseOrderId,
    inventoryIntakeStatus: "awaiting_intake_start",
    intakeStartedAt: null,
    intakeStartedBy: null,
    stockedRecordedAt: null,
    stockedRecordedBy: null,
    stockMovementId: null,
    receivingEventId,
    totalStockedQty: 0,
    dispositionSummary: null,
    intakeBlockFlag: false,
    intakeBlockReason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Start Inventory Intake
// ══════════════════════════════════════════════════════════════════════════════

export interface StartIntakeResult {
  success: boolean;
  tracking: InventoryIntakeTracking;
  newState: PODraftState;
  reason: string | null;
}

export function startInventoryIntake(
  detail: PODetailModel,
  tracking: InventoryIntakeTracking,
  startedBy?: string | null
): StartIntakeResult {
  if (detail.draftState !== "received_recorded") {
    return { success: false, tracking, newState: detail.draftState, reason: "입고 기록 완료 상태에서만 재고 반영을 시작할 수 있습니다." };
  }
  if (tracking.intakeStartedAt) {
    return { success: false, tracking, newState: detail.draftState, reason: "이미 재고 반영이 시작되었습니다." };
  }
  if (!tracking.receivingEventId) {
    return { success: false, tracking, newState: detail.draftState, reason: "입고 기록이 없습니다." };
  }

  const now = new Date().toISOString();
  return {
    success: true,
    tracking: {
      ...tracking,
      inventoryIntakeStatus: "lot_registration_in_progress",
      intakeStartedAt: now,
      intakeStartedBy: startedBy ?? null,
    },
    newState: "inventory_intake_in_progress",
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Build Stock Movement from Receiving Event
// ══════════════════════════════════════════════════════════════════════════════

export function buildStockMovementFromReceivingEvent(
  purchaseOrderId: string,
  event: ReceivingEvent,
  createdBy?: string | null
): StockMovement {
  const lines: StockMovementLine[] = event.receivedLines
    .filter(l => l.status !== "not_received" && l.status !== "rejected")
    .map(l => ({
      lineId: `sml_${l.lineId}`,
      itemId: l.itemId,
      itemName: l.itemName,
      lotNumber: l.lotNumber,
      expiryDate: l.expiryDate,
      stockedQty: l.actualReceivedQty,
      disposition: l.status === "damaged" ? "damaged" as StockDisposition : "hold" as StockDisposition,
      storageLocation: null,
      storageCondition: l.storageCondition,
      lineNote: l.damageNote ?? l.lineNote,
    }));

  const totalStocked = lines.reduce((s, l) => s + l.stockedQty, 0);
  const availableQty = lines.filter(l => l.disposition === "available").reduce((s, l) => s + l.stockedQty, 0);
  const holdQty = lines.filter(l => l.disposition === "hold").reduce((s, l) => s + l.stockedQty, 0);
  const quarantineQty = lines.filter(l => l.disposition === "quarantine").reduce((s, l) => s + l.stockedQty, 0);
  const damagedQty = lines.filter(l => l.disposition === "damaged").reduce((s, l) => s + l.stockedQty, 0);
  const discardQty = lines.filter(l => l.disposition === "discard").reduce((s, l) => s + l.stockedQty, 0);

  return {
    movementId: smUid(),
    purchaseOrderId,
    receivingEventId: event.eventId,
    lines,
    totalStockedQty: totalStocked,
    lotCount: lines.filter(l => l.lotNumber).length,
    availableQty,
    holdQty,
    quarantineQty,
    damagedQty,
    discardQty,
    createdAt: new Date().toISOString(),
    createdBy: createdBy ?? null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Update Line Disposition
// ══════════════════════════════════════════════════════════════════════════════

export function updateStockMovementLineDisposition(
  movement: StockMovement,
  lineId: string,
  disposition: StockDisposition,
  note?: string | null
): StockMovement {
  const lines = movement.lines.map(l =>
    l.lineId === lineId ? { ...l, disposition, lineNote: note ?? l.lineNote } : l
  );
  const availableQty = lines.filter(l => l.disposition === "available").reduce((s, l) => s + l.stockedQty, 0);
  const holdQty = lines.filter(l => l.disposition === "hold").reduce((s, l) => s + l.stockedQty, 0);
  const quarantineQty = lines.filter(l => l.disposition === "quarantine").reduce((s, l) => s + l.stockedQty, 0);
  const damagedQty = lines.filter(l => l.disposition === "damaged").reduce((s, l) => s + l.stockedQty, 0);
  const discardQty = lines.filter(l => l.disposition === "discard").reduce((s, l) => s + l.stockedQty, 0);

  return { ...movement, lines, availableQty, holdQty, quarantineQty, damagedQty, discardQty };
}

// ══════════════════════════════════════════════════════════════════════════════
// Inventory Intake Validator
// ══════════════════════════════════════════════════════════════════════════════

export interface IntakeValidationResult {
  canFinalize: boolean;
  blockingIssues: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  missingItems: string[];
}

export function validateInventoryIntakeBeforeFinalize(
  movement: StockMovement | null
): IntakeValidationResult {
  const blocking: { code: string; message: string }[] = [];
  const warnings: { code: string; message: string }[] = [];
  const missingItems: string[] = [];

  if (!movement) {
    blocking.push({ code: "no_movement", message: "재고 이동 기록이 없습니다." });
    return { canFinalize: false, blockingIssues: blocking, warnings, missingItems: ["재고 이동 기록"] };
  }

  if (movement.lines.length === 0) {
    blocking.push({ code: "no_lines", message: "재고 반영 라인이 없습니다." });
    missingItems.push("재고 라인");
  }

  // Lot check
  const missingLot = movement.lines.filter(l => !l.lotNumber && l.disposition !== "discard");
  if (missingLot.length > 0) {
    warnings.push({ code: "lot_missing", message: `${missingLot.length}개 라인의 Lot 번호가 없습니다.` });
  }

  // Expiry check
  const missingExpiry = movement.lines.filter(l => !l.expiryDate && l.disposition !== "discard" && l.disposition !== "damaged");
  if (missingExpiry.length > 0) {
    warnings.push({ code: "expiry_missing", message: `${missingExpiry.length}개 라인의 유효기한이 없습니다.` });
  }

  // All hold check (nothing dispositioned yet)
  const allHold = movement.lines.every(l => l.disposition === "hold");
  if (allHold && movement.lines.length > 0) {
    warnings.push({ code: "all_hold", message: "모든 라인이 보류 상태입니다. 배치 결정을 진행하세요." });
  }

  return { canFinalize: blocking.length === 0, blockingIssues: blocking, warnings, missingItems };
}

// ══════════════════════════════════════════════════════════════════════════════
// Finalize Inventory Intake (→ stocked_recorded)
// ══════════════════════════════════════════════════════════════════════════════

export interface FinalizeIntakeResult {
  success: boolean;
  tracking: InventoryIntakeTracking;
  newState: PODraftState;
  reason: string | null;
}

export function finalizeInventoryIntake(
  detail: PODetailModel,
  tracking: InventoryIntakeTracking,
  movement: StockMovement | null,
  finalizedBy?: string | null
): FinalizeIntakeResult {
  if (detail.draftState !== "inventory_intake_in_progress") {
    return { success: false, tracking, newState: detail.draftState, reason: "재고 반영 진행 중에만 완료할 수 있습니다." };
  }

  const validation = validateInventoryIntakeBeforeFinalize(movement);
  if (!validation.canFinalize) {
    return {
      success: false,
      tracking: { ...tracking, inventoryIntakeStatus: "intake_blocked", intakeBlockFlag: true, intakeBlockReason: validation.blockingIssues.map(i => i.message).join("; ") },
      newState: detail.draftState,
      reason: `차단 항목 ${validation.blockingIssues.length}건이 해결되지 않았습니다.`,
    };
  }

  const now = new Date().toISOString();
  const dispositionSummary = movement
    ? `가용 ${movement.availableQty} / 보류 ${movement.holdQty} / 격리 ${movement.quarantineQty} / 파손 ${movement.damagedQty}`
    : null;

  return {
    success: true,
    tracking: {
      ...tracking,
      inventoryIntakeStatus: "stocked_complete",
      stockedRecordedAt: now,
      stockedRecordedBy: finalizedBy ?? null,
      stockMovementId: movement?.movementId ?? null,
      totalStockedQty: movement?.totalStockedQty ?? 0,
      dispositionSummary,
      intakeBlockFlag: false,
      intakeBlockReason: null,
    },
    newState: "stocked_recorded",
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Inventory Intake Workbench Model
// ══════════════════════════════════════════════════════════════════════════════

export interface InventoryIntakeWorkbenchModel {
  detail: PODetailModel | null;
  tracking: InventoryIntakeTracking | null;
  movement: StockMovement | null;
  validation: IntakeValidationResult | null;
  isIntakeVisible: boolean;
  intakeBadge: string;
  intakeColor: "slate" | "amber" | "emerald" | "red" | "blue";
  primaryAction: { id: string; label: string; enabled: boolean; reason: string | null };
  checklistItems: { label: string; status: "done" | "pending" | "blocked" }[];
}

export function buildInventoryIntakeWorkbenchModel(input: {
  detail: PODetailModel | null;
  tracking: InventoryIntakeTracking | null;
  movement: StockMovement | null;
}): InventoryIntakeWorkbenchModel {
  const { detail, tracking, movement } = input;
  const validation = movement ? validateInventoryIntakeBeforeFinalize(movement) : null;

  const validStates: PODraftState[] = ["received_recorded", "inventory_intake_in_progress", "stocked_recorded"];
  if (!detail || !tracking || !validStates.includes(detail.draftState)) {
    return {
      detail: null, tracking: null, movement: null, validation: null,
      isIntakeVisible: false, intakeBadge: "—", intakeColor: "slate",
      primaryAction: { id: "noop", label: "—", enabled: false, reason: null },
      checklistItems: [],
    };
  }

  const badge = INVENTORY_INTAKE_SUBSTATUS_LABELS[tracking.inventoryIntakeStatus];
  let color: InventoryIntakeWorkbenchModel["intakeColor"] = "slate";
  if (tracking.intakeBlockFlag) color = "red";
  else if (tracking.inventoryIntakeStatus === "stocked_complete") color = "emerald";
  else if (tracking.stockMovementId) color = "blue";

  let primaryAction: InventoryIntakeWorkbenchModel["primaryAction"];
  if (!tracking.intakeStartedAt) {
    primaryAction = { id: "start_intake", label: "재고 반영 시작", enabled: true, reason: null };
  } else if (!movement) {
    primaryAction = { id: "create_movement", label: "재고 이동 생성", enabled: true, reason: null };
  } else if (tracking.inventoryIntakeStatus !== "stocked_complete") {
    primaryAction = { id: "finalize_intake", label: "재고 반영 완료", enabled: validation?.canFinalize ?? false, reason: validation && !validation.canFinalize ? `차단 ${validation.blockingIssues.length}건` : null };
  } else {
    primaryAction = { id: "open_release", label: "가용 재고 전환", enabled: true, reason: null };
  }

  const checklist: InventoryIntakeWorkbenchModel["checklistItems"] = [
    { label: "재고 반영 시작", status: tracking.intakeStartedAt ? "done" : "pending" },
    { label: "재고 이동 생성", status: movement ? "done" : "pending" },
    { label: "Lot/배치 결정", status: movement && !movement.lines.every(l => l.disposition === "hold") ? "done" : "pending" },
    { label: "재고 반영 완료", status: tracking.inventoryIntakeStatus === "stocked_complete" ? "done" : tracking.intakeBlockFlag ? "blocked" : "pending" },
  ];

  return { detail, tracking, movement, validation, isIntakeVisible: true, intakeBadge: badge, intakeColor: color, primaryAction, checklistItems: checklist };
}

// ══════════════════════════════════════════════════════════════════════════════
// Inventory Intake Activity Events
// ══════════════════════════════════════════════════════════════════════════════

export type InventoryIntakeActivityType =
  | "intake_started"
  | "stock_movement_created"
  | "disposition_updated"
  | "intake_finalized"
  | "intake_blocked";

export interface InventoryIntakeActivity {
  type: InventoryIntakeActivityType;
  at: string;
  actorId: string | null;
  summary: string;
  movementId: string | null;
}

export function createInventoryIntakeActivity(input: {
  type: InventoryIntakeActivityType;
  actorId?: string;
  summary: string;
  movementId?: string;
}): InventoryIntakeActivity {
  return {
    type: input.type,
    at: new Date().toISOString(),
    actorId: input.actorId ?? null,
    summary: input.summary,
    movementId: input.movementId ?? null,
  };
}
