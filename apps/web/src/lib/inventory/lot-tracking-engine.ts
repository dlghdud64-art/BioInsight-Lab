/**
 * lot-tracking-engine.ts
 * ───────────────────────
 * Pure-function engine for lot-level inventory tracking.
 * No side-effects, no DB access — receives data, returns computed views.
 */

/* ── Types ── */

export type LotStatus = "active" | "expiring_soon" | "expired" | "depleted";

export interface LotRecord {
  /** Unique lot identifier (composite: itemId + lotCode) */
  lotId: string;
  /** Parent inventory item ID */
  itemId: string;
  /** Lot code (e.g., "24A01-X") */
  lotCode: string;
  /** Product name (denormalized for display) */
  productName: string;
  /** Brand (denormalized) */
  brand: string | null;
  /** Catalog number (denormalized) */
  catalogNumber: string | null;
  /** Current quantity on hand */
  qtyOnHand: number;
  /** Unit */
  unit: string;
  /** Storage location */
  location: string | null;
  /** Date received (ISO) */
  receivedAt: string;
  /** Expiry date (ISO, nullable) */
  expiresAt: string | null;
  /** Computed status */
  status: LotStatus;
  /** Source document (PO number, restock ID, etc.) */
  sourceDocumentId: string | null;
  /** Last event timestamp (ISO) */
  lastEventAt: string;
  /** Storage condition */
  storageCondition?: string | null;
}

export type LotEventType = "receive" | "use" | "move" | "adjust" | "dispose";

export interface LotEvent {
  id: string;
  lotId: string;
  type: LotEventType;
  quantity: number;
  /** Positive = in, Negative = out */
  delta: number;
  operator: string | null;
  note: string | null;
  timestamp: string;
  /** For "move" events */
  fromLocation?: string | null;
  toLocation?: string | null;
}

export interface LotSummary {
  totalLots: number;
  activeLots: number;
  expiringSoonLots: number;
  expiredLots: number;
  depletedLots: number;
  locationUnassigned: number;
}

export type LotStatusFilter = "all" | LotStatus;

/* ── Constants ── */

/** Days before expiry to flag as "expiring_soon" */
const EXPIRY_WARNING_DAYS = 14;

/* ── Engine Functions ── */

/**
 * Compute lot status from quantity and expiry date.
 */
export function computeLotStatus(
  qtyOnHand: number,
  expiresAt: string | null,
  now: Date = new Date()
): LotStatus {
  if (qtyOnHand <= 0) return "depleted";

  if (expiresAt) {
    const expiryDate = new Date(expiresAt);
    const daysLeft = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft <= 0) return "expired";
    if (daysLeft <= EXPIRY_WARNING_DAYS) return "expiring_soon";
  }

  return "active";
}

/**
 * Sort lots by urgency: expiring_soon → expired → active → depleted.
 * Within same status, sort by expiry date ascending (soonest first).
 */
export function sortLots(lots: LotRecord[]): LotRecord[] {
  const statusOrder: Record<LotStatus, number> = {
    expiring_soon: 0,
    expired: 1,
    active: 2,
    depleted: 3,
  };

  return [...lots].sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;

    // Within same status, sort by expiry (soonest first, null last)
    if (a.expiresAt && b.expiresAt) {
      return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    }
    if (a.expiresAt && !b.expiresAt) return -1;
    if (!a.expiresAt && b.expiresAt) return 1;

    // Fallback: most recently received first
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });
}

/**
 * Compute summary counts for the lot dashboard.
 */
export function computeLotSummary(lots: LotRecord[]): LotSummary {
  const summary: LotSummary = {
    totalLots: lots.length,
    activeLots: 0,
    expiringSoonLots: 0,
    expiredLots: 0,
    depletedLots: 0,
    locationUnassigned: 0,
  };

  for (const lot of lots) {
    switch (lot.status) {
      case "active":
        summary.activeLots++;
        break;
      case "expiring_soon":
        summary.expiringSoonLots++;
        break;
      case "expired":
        summary.expiredLots++;
        break;
      case "depleted":
        summary.depletedLots++;
        break;
    }
    if (!lot.location || lot.location.trim() === "") {
      summary.locationUnassigned++;
    }
  }

  return summary;
}

/**
 * Filter lots by status. "all" returns everything.
 */
export function filterLotsByStatus(
  lots: LotRecord[],
  status: LotStatusFilter
): LotRecord[] {
  if (status === "all") return lots;
  return lots.filter((lot) => lot.status === status);
}

/**
 * Search lots by text query (lotCode, productName, brand, catalogNumber, location).
 */
export function searchLots(lots: LotRecord[], query: string): LotRecord[] {
  if (!query.trim()) return lots;
  const q = query.toLowerCase();
  return lots.filter(
    (lot) =>
      lot.lotCode.toLowerCase().includes(q) ||
      lot.productName.toLowerCase().includes(q) ||
      (lot.brand && lot.brand.toLowerCase().includes(q)) ||
      (lot.catalogNumber && lot.catalogNumber.toLowerCase().includes(q)) ||
      (lot.location && lot.location.toLowerCase().includes(q))
  );
}

/**
 * Get status label in Korean.
 */
export function getLotStatusLabel(status: LotStatus): string {
  const labels: Record<LotStatus, string> = {
    active: "활성",
    expiring_soon: "만료 임박",
    expired: "만료",
    depleted: "소진",
  };
  return labels[status];
}

/**
 * Get status color scheme for badges.
 */
export function getLotStatusColor(status: LotStatus): {
  bg: string;
  text: string;
  border: string;
} {
  const colors: Record<LotStatus, { bg: string; text: string; border: string }> = {
    active: { bg: "#0F2A1A", text: "#34D399", border: "#16A34A33" },
    expiring_soon: { bg: "#2A1F0F", text: "#FBBF24", border: "#F59E0B33" },
    expired: { bg: "#2A0F0F", text: "#F87171", border: "#EF444433" },
    depleted: { bg: "#1A1A2E", text: "#8A99AF", border: "#34425733" },
  };
  return colors[status];
}
