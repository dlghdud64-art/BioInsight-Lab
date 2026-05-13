export type InventoryDisposalPriorityInput = {
  id: string;
  lotNumber?: string | null;
  currentQuantity?: number | string | null;
  unit?: string | null;
  safetyStock?: number | string | null;
  location?: string | null;
  expiryDate?: Date | string | null;
  disposalScheduledAt?: Date | string | null;
};

export type InventoryDisposalPriority = {
  lotId: string;
  status: "available" | "expired_empty" | "disposal_required";
  useProhibited: boolean;
  primaryAction: "review_inventory" | "confirm_disposal";
  secondaryAction: "reorder_if_below_safety" | "reorder_after_disposal";
  reorderBlockedUntil: "disposal_completed" | null;
  nextActionLabel: string;
  lotSummary: {
    lotId: string;
    qty: number;
    unit: string | null;
    expiry: string | null;
    location: string | null;
    reason: "none" | "expired_lot_empty" | "expired_lot_use_prohibited";
    oneLineSummary: string;
    stockImpact: {
      beforeQty: number;
      disposalQty: number;
      afterDisposalQty: number;
      safetyStock: number | null;
      belowSafetyAfterDisposal: boolean;
    };
  };
};

export type InventoryDisposalPrioritySummary = {
  total: number;
  expiredLotCount: number;
  disposalRequiredCount: number;
  reorderDeferredCount: number;
  primaryActionOrder: ["confirm_disposal", "reorder_after_disposal"];
};

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hasExpired(value: Date | string | null | undefined): boolean {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

export function buildInventoryDisposalPriority(
  inventory: InventoryDisposalPriorityInput
): InventoryDisposalPriority {
  const lotId = inventory.lotNumber || inventory.id;
  const qty = Math.max(0, toNumber(inventory.currentQuantity));
  const safetyStock =
    inventory.safetyStock === null || inventory.safetyStock === undefined
      ? null
      : Math.max(0, toNumber(inventory.safetyStock));
  const expiry = toIsoDate(inventory.expiryDate);
  const expired = hasExpired(inventory.expiryDate);
  const disposalRequired = expired && qty > 0;
  const afterDisposalQty = disposalRequired ? 0 : qty;
  const belowSafetyAfterDisposal =
    safetyStock !== null ? afterDisposalQty < safetyStock : afterDisposalQty <= 0;
  const reason = disposalRequired
    ? "expired_lot_use_prohibited"
    : expired
      ? "expired_lot_empty"
      : "none";

  const stockImpact = {
    beforeQty: qty,
    disposalQty: disposalRequired ? qty : 0,
    afterDisposalQty,
    safetyStock,
    belowSafetyAfterDisposal,
  };

  return {
    lotId,
    status: disposalRequired ? "disposal_required" : expired ? "expired_empty" : "available",
    useProhibited: disposalRequired,
    primaryAction: disposalRequired ? "confirm_disposal" : "review_inventory",
    secondaryAction: disposalRequired ? "reorder_after_disposal" : "reorder_if_below_safety",
    reorderBlockedUntil: disposalRequired ? "disposal_completed" : null,
    nextActionLabel: disposalRequired
      ? "Confirm disposal before reviewing reorder"
      : "Review inventory and reorder only if below safety stock",
    lotSummary: {
      lotId,
      qty,
      unit: inventory.unit ?? null,
      expiry,
      location: inventory.location ?? null,
      reason,
      oneLineSummary: [
        `lot=${lotId}`,
        `qty=${qty}`,
        `expiry=${expiry ?? "none"}`,
        `location=${inventory.location ?? "unassigned"}`,
        `reason=${reason}`,
        `stockImpact=${stockImpact.beforeQty}->${stockImpact.afterDisposalQty}`,
      ].join(" | "),
      stockImpact,
    },
  };
}

export function summarizeInventoryDisposalPriorities(
  inventories: InventoryDisposalPriorityInput[]
): InventoryDisposalPrioritySummary {
  const priorities = inventories.map(buildInventoryDisposalPriority);

  return {
    total: priorities.length,
    expiredLotCount: priorities.filter((priority) => priority.status !== "available").length,
    disposalRequiredCount: priorities.filter(
      (priority) => priority.primaryAction === "confirm_disposal"
    ).length,
    reorderDeferredCount: priorities.filter(
      (priority) => priority.reorderBlockedUntil === "disposal_completed"
    ).length,
    primaryActionOrder: ["confirm_disposal", "reorder_after_disposal"],
  };
}
