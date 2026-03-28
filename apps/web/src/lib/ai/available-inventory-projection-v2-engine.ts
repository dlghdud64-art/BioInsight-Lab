/**
 * Available Inventory Projection v2 Engine — stock release → inventory availability truth
 *
 * stock release 완료 후 실제 가용 재고 상태를 canonical하게 투영.
 * available ≠ released (released는 physical movement, available은 system availability).
 *
 * TRUTH CONTRACT:
 * - reads: StockReleaseSessionV2 (released lines, qty, location/bin)
 * - writes: AvailableInventorySnapshotV2 (per-line available qty, location, lot/expiry)
 * - forbidden: disposition 미완료 line 포함, hold/rejected qty를 available에 포함
 */

import type { StockReleaseSessionV2, StockReleaseLineV2 } from "./stock-release-resolution-v2-engine";

export interface AvailableInventoryLineV2 {
  lineId: string; availableQty: number; location: string; bin: string;
  lotNumber: string; expiryDate: string; unit: string;
  sourceReleaseSessionId: string; releasedAt: string;
}

export interface AvailableInventorySnapshotV2 {
  snapshotId: string; caseId: string; sentStateRecordId: string; releaseSessionId: string;
  availableLines: AvailableInventoryLineV2[];
  totalAvailableQty: number;
  projectedAt: string; projectedBy: string;
  reorderTriggerEligible: boolean;
  nextDestination: "reorder_evaluation" | "inventory_complete";
}

export function projectAvailableInventory(releaseSession: StockReleaseSessionV2): AvailableInventorySnapshotV2 {
  const releasedLines = releaseSession.releaseLines.filter(l => l.releaseStatus === "released");
  const availableLines: AvailableInventoryLineV2[] = releasedLines.map(l => ({
    lineId: l.lineId, availableQty: l.releasableQty, location: l.locationAssigned, bin: l.binAssigned,
    lotNumber: "", expiryDate: "", unit: "",
    sourceReleaseSessionId: releaseSession.releaseSessionId, releasedAt: releaseSession.releasedAt || new Date().toISOString(),
  }));
  const totalAvailable = availableLines.reduce((s, l) => s + l.availableQty, 0);

  return {
    snapshotId: `invsnap_${Date.now().toString(36)}`, caseId: releaseSession.caseId, sentStateRecordId: releaseSession.sentStateRecordId, releaseSessionId: releaseSession.releaseSessionId,
    availableLines, totalAvailableQty: totalAvailable,
    projectedAt: new Date().toISOString(), projectedBy: "system",
    reorderTriggerEligible: totalAvailable > 0,
    nextDestination: "reorder_evaluation",
  };
}
